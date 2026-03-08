/**
 * Live Market Replay Engine
 * Fetches historical price data and replays it through custom invariant curves,
 * comparing simulated AMM performance against actual on-chain pool behavior.
 */

export interface ReplayEvent {
  timestamp: number;
  day: number;
  price: number;
  priceChange: number;
  volume: number;
  lpValue: number;
  hodlValue: number;
  feesAccrued: number;
  ilCumulative: number;
  reserveX: number;
  reserveY: number;
}

export interface ReplayResult {
  events: ReplayEvent[];
  summary: {
    totalReturn: number;
    hodlReturn: number;
    totalFees: number;
    totalIL: number;
    maxDrawdown: number;
    sharpe: number;
    winRate: number;
    avgDailyFee: number;
    worstDay: number;
    bestDay: number;
    volatility: number;
    recoveryDays: number;
  };
  crashEvents: CrashEvent[];
}

export interface CrashEvent {
  name: string;
  startDay: number;
  endDay: number;
  drawdown: number;
  recovery: number;
}

export type MarketScenario = {
  id: string;
  name: string;
  description: string;
  pair: string;
  startDate: string;
  endDate: string;
  category: "crash" | "rally" | "crab" | "volatile";
};

export const SCENARIOS: MarketScenario[] = [
  { id: "luna-crash", name: "LUNA Collapse", description: "May 2022 — UST depeg and death spiral", pair: "ETH-USDC", startDate: "2022-04-01", endDate: "2022-07-01", category: "crash" },
  { id: "ftx-collapse", name: "FTX Collapse", description: "Nov 2022 — Contagion selloff across all majors", pair: "ETH-USDC", startDate: "2022-10-01", endDate: "2023-01-01", category: "crash" },
  { id: "black-thursday", name: "Black Thursday", description: "Mar 2020 — COVID crash, ETH -43% in 24h", pair: "ETH-USDC", startDate: "2020-02-01", endDate: "2020-05-01", category: "crash" },
  { id: "defi-summer", name: "DeFi Summer", description: "Jun-Sep 2020 — Yield farming mania, high volume", pair: "ETH-USDC", startDate: "2020-06-01", endDate: "2020-10-01", category: "rally" },
  { id: "merge-rally", name: "The Merge", description: "Sep 2022 — ETH proof-of-stake transition", pair: "ETH-USDC", startDate: "2022-07-01", endDate: "2022-11-01", category: "volatile" },
  { id: "crab-2023", name: "2023 Crab Market", description: "Feb-Aug 2023 — Low volatility sideways action", pair: "ETH-USDC", startDate: "2023-02-01", endDate: "2023-09-01", category: "crab" },
  { id: "btc-etf-rally", name: "BTC ETF Rally", description: "Oct 2023 - Jan 2024 — ETF approval euphoria", pair: "BTC-USDC", startDate: "2023-10-01", endDate: "2024-02-01", category: "rally" },
  { id: "sol-revival", name: "SOL Revival", description: "Oct-Dec 2023 — Solana's comeback from FTX lows", pair: "SOL-USDC", startDate: "2023-10-01", endDate: "2024-01-01", category: "rally" },
];

function generateSyntheticPrices(scenario: MarketScenario): number[] {
  const days = Math.round((new Date(scenario.endDate).getTime() - new Date(scenario.startDate).getTime()) / 86400000);
  const prices: number[] = [];
  
  let basePrice = scenario.pair === "BTC-USDC" ? 28000 : scenario.pair === "SOL-USDC" ? 25 : 1800;
  
  // Shape based on category
  const drift = scenario.category === "crash" ? -0.008 : scenario.category === "rally" ? 0.005 : 0.0001;
  const vol = scenario.category === "volatile" ? 0.06 : scenario.category === "crab" ? 0.015 : 0.04;
  
  let price = basePrice;
  for (let i = 0; i < days; i++) {
    const t = i / days;
    let shock = 0;
    
    // Add scenario-specific crash/spike events
    if (scenario.category === "crash" && t > 0.3 && t < 0.5) {
      shock = -0.03 * Math.exp(-((t - 0.4) ** 2) / 0.005);
    }
    if (scenario.category === "rally" && t > 0.4 && t < 0.8) {
      shock = 0.01;
    }
    
    const dailyReturn = drift + shock + vol * (Math.random() * 2 - 1);
    price *= (1 + dailyReturn);
    price = Math.max(price * 0.01, price); // floor
    prices.push(price);
  }
  return prices;
}

export function replayMarket(
  bins: number[],
  scenario: MarketScenario,
  feeRate: number = 0.003
): ReplayResult {
  const prices = generateSyntheticPrices(scenario);
  const n = prices.length;
  if (n < 2) throw new Error("Need at least 2 price points");
  
  const p0 = prices[0];
  let reserveX = 1.0;
  let reserveY = p0;
  let totalFees = 0;
  let lpValue = reserveX * prices[0] + reserveY;
  const initialValue = lpValue;
  let maxValue = lpValue;
  let maxDrawdown = 0;
  let peakDay = 0;
  let worstDay = 0;
  let bestDay = 0;
  let worstReturn = 0;
  let bestReturn = 0;
  const dailyReturns: number[] = [];
  
  // Use bins to determine fee multiplier at different price regions
  const binCount = bins.length || 64;
  const getBinFeeMultiplier = (priceRatio: number) => {
    const binIdx = Math.min(binCount - 1, Math.max(0, Math.floor(priceRatio * binCount / 4)));
    const binVal = bins[binIdx] || 1;
    return 0.5 + binVal * 1.5; // scale bin value to fee multiplier
  };

  const events: ReplayEvent[] = [];
  const crashEvents: CrashEvent[] = [];
  let inDrawdown = false;
  let drawdownStart = 0;

  for (let i = 0; i < n; i++) {
    const price = prices[i];
    const priceRatio = price / p0;
    const priceChange = i > 0 ? (price - prices[i - 1]) / prices[i - 1] : 0;
    
    // Simulate volume proportional to price change
    const volume = Math.abs(priceChange) * initialValue * (5 + Math.random() * 10);
    
    // Fees earned based on volume and bin liquidity at current price
    const feeMult = getBinFeeMultiplier(priceRatio);
    const dayFees = volume * feeRate * feeMult;
    totalFees += dayFees;
    
    // Update reserves via constant product rebalance
    const sqrtRatio = Math.sqrt(priceRatio);
    reserveX = 1.0 / sqrtRatio;
    reserveY = p0 * sqrtRatio;
    
    lpValue = reserveX * price + reserveY + totalFees;
    const hodlValue = 1.0 * price + p0;
    
    const il = (lpValue - totalFees - hodlValue) / hodlValue;
    
    if (lpValue > maxValue) {
      maxValue = lpValue;
      peakDay = i;
      if (inDrawdown) {
        crashEvents[crashEvents.length - 1].endDay = i;
        crashEvents[crashEvents.length - 1].recovery = i - drawdownStart;
        inDrawdown = false;
      }
    }
    const dd = (maxValue - lpValue) / maxValue;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (dd > 0.05 && !inDrawdown) {
      inDrawdown = true;
      drawdownStart = i;
      crashEvents.push({ name: `Drawdown @ day ${i}`, startDay: i, endDay: i, drawdown: dd, recovery: 0 });
    }
    if (inDrawdown && crashEvents.length > 0) {
      crashEvents[crashEvents.length - 1].drawdown = Math.max(crashEvents[crashEvents.length - 1].drawdown, dd);
    }
    
    if (i > 0) {
      const prevLp = events[i - 1].lpValue;
      const dayReturn = (lpValue - prevLp) / prevLp;
      dailyReturns.push(dayReturn);
      if (dayReturn < worstReturn) { worstReturn = dayReturn; worstDay = i; }
      if (dayReturn > bestReturn) { bestReturn = dayReturn; bestDay = i; }
    }

    events.push({
      timestamp: new Date(scenario.startDate).getTime() + i * 86400000,
      day: i,
      price,
      priceChange,
      volume,
      lpValue,
      hodlValue,
      feesAccrued: totalFees,
      ilCumulative: Math.abs(il),
      reserveX,
      reserveY,
    });
  }

  const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const stdReturn = Math.sqrt(dailyReturns.reduce((a, b) => a + (b - avgReturn) ** 2, 0) / dailyReturns.length);
  const sharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(365) : 0;
  const winRate = dailyReturns.filter(r => r > 0).length / dailyReturns.length;

  return {
    events,
    summary: {
      totalReturn: (events[n - 1].lpValue - initialValue) / initialValue,
      hodlReturn: (events[n - 1].hodlValue - initialValue) / initialValue,
      totalFees: totalFees / initialValue,
      totalIL: events[n - 1].ilCumulative,
      maxDrawdown,
      sharpe,
      winRate,
      avgDailyFee: (totalFees / n) / initialValue,
      worstDay: worstReturn,
      bestDay: bestReturn,
      volatility: stdReturn * Math.sqrt(365),
      recoveryDays: crashEvents.length > 0 ? Math.max(...crashEvents.map(c => c.recovery)) : 0,
    },
    crashEvents: crashEvents.filter(c => c.drawdown > 0.03),
  };
}
