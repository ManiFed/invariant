// Pure LP strategy simulation engine — no React dependencies
import { createPool, executeArbitrage, gbmStep, calcIL, lpValue, hodlValue, poolPrice, type PoolState } from "./amm-engine";

export interface StrategyConfig {
  id: string;
  name: string;
  presetId: string;
  rangeWidth: number;        // e.g. 0.15 = +/-15% around spot
  rebalanceTrigger: number;  // deviation % before reposition
  rebalanceCooldown: number; // days between rebalances
  stopLoss: number;          // max IL % before exit
  maxILTolerance: number;    // alternative IL exit
  hedgeRatio: number;        // 0-1, fraction hedged
  color: string;
}

export interface DaySnapshot {
  day: number;
  price: number;
  equity: number;
  fees: number;
  il: number;
  netPnl: number;
  rebalanced: boolean;
  inRange: boolean;
}

export interface PathResult {
  snapshots: DaySnapshot[];
  finalReturn: number;
  totalFees: number;
  totalIL: number;
  netPnl: number;
  maxDrawdown: number;
  rebalanceCount: number;
  sharpe: number;
}

export interface BacktestResult {
  strategyId: string;
  strategyName: string;
  paths: PathResult[];
  meanReturn: number;
  medianReturn: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  avgRebalances: number;
  totalFeesAvg: number;
  totalILAvg: number;
  netPnlAvg: number;
  equityCurve: { day: number; mean: number; p5: number; p95: number }[];
  returnDist: { bin: string; count: number; isNeg: boolean }[];
}

export interface SimulationConfig {
  volatility: number;   // annualized %
  drift: number;        // annualized %
  jumpProb: number;     // daily %
  jumpSize: number;     // avg magnitude %
  numPaths: number;
  timeHorizon: number;  // days
  initialCapital: number;
  feeRate: number;      // decimal (e.g. 0.003)
  initialPrice: number;
}

export const STRATEGY_PRESETS: Omit<StrategyConfig, "id" | "color">[] = [
  { name: "Passive Hold", presetId: "passive", rangeWidth: 100, rebalanceTrigger: 100, rebalanceCooldown: 999, stopLoss: 100, maxILTolerance: 100, hedgeRatio: 0 },
  { name: "Range Rebalancer", presetId: "range", rangeWidth: 0.15, rebalanceTrigger: 0.01, rebalanceCooldown: 1, stopLoss: 50, maxILTolerance: 30, hedgeRatio: 0 },
  { name: "Volatility Tracker", presetId: "vol_track", rangeWidth: 0.30, rebalanceTrigger: 0.05, rebalanceCooldown: 3, stopLoss: 40, maxILTolerance: 25, hedgeRatio: 0.2 },
  { name: "Mean Reversion", presetId: "mean_rev", rangeWidth: 0.20, rebalanceTrigger: 0.10, rebalanceCooldown: 5, stopLoss: 35, maxILTolerance: 20, hedgeRatio: 0.3 },
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function normalFromUniform(u1: number, u2: number): number {
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
}

export function runStrategyBacktest(
  strategy: StrategyConfig,
  config: SimulationConfig,
  seed: number
): BacktestResult {
  const rng = seededRandom(seed);
  const dailyVol = (config.volatility / 100) / Math.sqrt(365);
  const dailyDrift = (config.drift / 100) / 365;
  const jumpP = config.jumpProb / 100;
  const jumpS = config.jumpSize / 100;
  const pathResults: PathResult[] = [];

  // Per-path simulation
  for (let p = 0; p < config.numPaths; p++) {
    let price = config.initialPrice;
    let pool = createPool(
      config.initialCapital / 2 / config.initialPrice,
      config.initialCapital / 2,
      config.feeRate
    );
    const initialX = pool.x;
    const initialY = pool.y;
    let rangeLow = price * (1 - strategy.rangeWidth);
    let rangeHigh = price * (1 + strategy.rangeWidth);
    let daysSinceRebalance = strategy.rebalanceCooldown; // allow immediate first
    let rebalanceCount = 0;
    let cumulativeFees = 0;
    let peak = config.initialCapital;
    let maxDD = 0;
    const dailyReturns: number[] = [];
    let prevEquity = config.initialCapital;
    const snapshots: DaySnapshot[] = [];

    snapshots.push({
      day: 0, price, equity: config.initialCapital,
      fees: 0, il: 0, netPnl: 0, rebalanced: false, inRange: true,
    });

    for (let day = 1; day <= config.timeHorizon; day++) {
      // Price step (GBM + jumps)
      const u1 = rng(), u2 = rng();
      const z = normalFromUniform(u1, u2);
      const jump = rng() < jumpP ? (rng() - 0.5) * 2 * jumpS : 0;
      price = price * Math.exp(dailyDrift - 0.5 * dailyVol * dailyVol + dailyVol * z + jump);

      // Arbitrage aligns pool price
      const arbResult = executeArbitrage(pool, price);
      pool = arbResult.pool;

      // Fee accrual (simplified: proportional to volume proxy)
      const volumeProxy = Math.abs(z) * config.initialCapital * 0.02;
      const inRange = price >= rangeLow && price <= rangeHigh;
      const dailyFee = inRange ? volumeProxy * config.feeRate : 0;
      cumulativeFees += dailyFee;
      pool = { ...pool, totalFees: pool.totalFees + dailyFee };

      // Check rebalance
      daysSinceRebalance++;
      let rebalanced = false;
      const outOfRange = !inRange;
      const cooldownMet = daysSinceRebalance >= strategy.rebalanceCooldown;
      const triggerMet = Math.abs(price - (rangeLow + rangeHigh) / 2) / ((rangeLow + rangeHigh) / 2) > strategy.rebalanceTrigger;

      if (outOfRange && cooldownMet && triggerMet && strategy.rangeWidth < 10) {
        // Rebalance: reposition around current price
        const rebalanceCost = config.initialCapital * 0.001; // gas + slippage
        cumulativeFees -= rebalanceCost;
        rangeLow = price * (1 - strategy.rangeWidth);
        rangeHigh = price * (1 + strategy.rangeWidth);
        // Reset pool at new price
        const newX = config.initialCapital / 2 / price;
        const newY = config.initialCapital / 2;
        pool = createPool(newX, newY, config.feeRate);
        daysSinceRebalance = 0;
        rebalanceCount++;
        rebalanced = true;
      }

      // Compute equity
      const lp = lpValue(pool, price) + cumulativeFees;
      const hedgePnl = strategy.hedgeRatio * (price - config.initialPrice) * initialX;
      const hedgeCost = strategy.hedgeRatio * config.initialCapital * 0.0002; // daily cost
      const equity = lp + hedgePnl - hedgeCost * day;
      const il = calcIL(config.initialPrice, price);
      const hodl = hodlValue(initialX, initialY, price);
      const netPnl = ((equity - config.initialCapital) / config.initialCapital) * 100;

      // Drawdown
      peak = Math.max(peak, equity);
      maxDD = Math.max(maxDD, (peak - equity) / peak);

      // Daily return
      const dailyRet = (equity - prevEquity) / prevEquity;
      dailyReturns.push(dailyRet);
      prevEquity = equity;

      snapshots.push({
        day, price, equity, fees: cumulativeFees,
        il, netPnl, rebalanced, inRange,
      });
    }

    const finalEquity = snapshots[snapshots.length - 1].equity;
    const finalReturn = (finalEquity - config.initialCapital) / config.initialCapital;
    const meanDaily = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const stdDaily = Math.sqrt(dailyReturns.reduce((a, b) => a + (b - meanDaily) ** 2, 0) / dailyReturns.length);
    const sharpe = stdDaily > 0 ? (meanDaily / stdDaily) * Math.sqrt(365) : 0;

    pathResults.push({
      snapshots,
      finalReturn,
      totalFees: cumulativeFees,
      totalIL: snapshots[snapshots.length - 1].il,
      netPnl: snapshots[snapshots.length - 1].netPnl,
      maxDrawdown: maxDD * 100,
      rebalanceCount,
      sharpe,
    });
  }

  // Aggregate stats
  const returns = pathResults.map(p => p.finalReturn);
  const sorted = [...returns].sort((a, b) => a - b);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Equity curve percentiles
  const equityCurve: BacktestResult["equityCurve"] = [];
  for (let d = 0; d <= config.timeHorizon; d++) {
    const dayEquities = pathResults.map(p => p.snapshots[d]?.equity ?? config.initialCapital).sort((a, b) => a - b);
    equityCurve.push({
      day: d,
      mean: dayEquities.reduce((a, b) => a + b, 0) / dayEquities.length,
      p5: dayEquities[Math.floor(dayEquities.length * 0.05)],
      p95: dayEquities[Math.floor(dayEquities.length * 0.95)],
    });
  }

  // Return distribution
  const bins = 20;
  const minR = Math.min(...returns);
  const maxR = Math.max(...returns);
  const binW = (maxR - minR) / bins || 0.01;
  const returnDist = Array.from({ length: bins }, (_, i) => {
    const start = minR + i * binW;
    return { bin: `${(start * 100).toFixed(0)}%`, count: 0, isNeg: start < 0 };
  });
  returns.forEach(r => {
    const idx = Math.min(Math.floor((r - minR) / binW), bins - 1);
    if (idx >= 0 && idx < bins) returnDist[idx].count++;
  });

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    paths: pathResults,
    meanReturn: mean * 100,
    medianReturn: median * 100,
    sharpe: std > 0 ? (mean / std) * Math.sqrt(365 / config.timeHorizon) : 0,
    maxDrawdown: Math.max(...pathResults.map(p => p.maxDrawdown)),
    winRate: (returns.filter(r => r > 0).length / returns.length) * 100,
    avgRebalances: pathResults.reduce((a, b) => a + b.rebalanceCount, 0) / pathResults.length,
    totalFeesAvg: pathResults.reduce((a, b) => a + b.totalFees, 0) / pathResults.length,
    totalILAvg: pathResults.reduce((a, b) => a + b.totalIL, 0) / pathResults.length,
    netPnlAvg: pathResults.reduce((a, b) => a + b.netPnl, 0) / pathResults.length,
    equityCurve,
    returnDist,
  };
}
