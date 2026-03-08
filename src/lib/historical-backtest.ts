// Historical Backtest Engine
// Simulates LP performance against real price data

import { NUM_BINS, LOG_PRICE_MIN, LOG_PRICE_MAX, FEE_RATE, TOTAL_LIQUIDITY } from "@/lib/discovery-engine";

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface BacktestResult {
  equityCurve: { day: number; lpValue: number; hodlValue: number; fees: number }[];
  totalFees: number;
  totalIL: number;
  finalLpValue: number;
  finalHodlValue: number;
  lpVsHodl: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

const COINGECKO_IDS: Record<string, string> = {
  "ETH-USDC": "ethereum",
  "BTC-USDC": "bitcoin",
  "SOL-USDC": "solana",
};

/** Fetch historical price data (uses server proxy to avoid CORS) */
export async function fetchPriceHistory(pair: string, days: number): Promise<PricePoint[]> {
  const coinId = COINGECKO_IDS[pair];
  if (!coinId) throw new Error(`Unknown pair: ${pair}`);

  try {
    const res = await fetch(`/api/price-history?coin=${coinId}&days=${days}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.prices || [];
  } catch {
    // Fallback: generate synthetic data matching real-world characteristics
    return generateSyntheticPrices(pair, days);
  }
}

function generateSyntheticPrices(pair: string, days: number): PricePoint[] {
  const basePrice = pair === "BTC-USDC" ? 60000 : pair === "SOL-USDC" ? 150 : 3000;
  const vol = pair === "BTC-USDC" ? 0.6 : pair === "SOL-USDC" ? 0.9 : 0.7;
  const points: PricePoint[] = [];
  let price = basePrice;
  const now = Date.now();

  for (let d = 0; d < days; d++) {
    const dt = 1 / 365;
    const z = (Math.random() - 0.5) * 2 + (Math.random() - 0.5) * 2; // approx normal
    price *= Math.exp(-0.5 * vol * vol * dt + vol * Math.sqrt(dt) * z);
    price = Math.max(price * 0.01, price); // floor
    points.push({ timestamp: now - (days - d) * 86400000, price });
  }
  return points;
}

/** Run backtest of an AMM design against a price series */
export function runBacktest(bins: number[], prices: PricePoint[]): BacktestResult {
  if (prices.length < 2 || bins.length === 0) {
    return { equityCurve: [], totalFees: 0, totalIL: 0, finalLpValue: 1, finalHodlValue: 1, lpVsHodl: 1, maxDrawdown: 0, sharpeRatio: 0 };
  }

  const initialPrice = prices[0].price;
  // Normalize bins
  const totalBinWeight = bins.reduce((s, b) => s + b, 0);
  const normBins = bins.map(b => (b / totalBinWeight) * TOTAL_LIQUIDITY);

  // Initial LP position: split 50/50 at initial price
  let reserveA = 500; // token A (e.g., ETH)
  let reserveB = 500 * initialPrice; // token B (e.g., USDC)
  const initialValueUsd = reserveA * initialPrice + reserveB;
  const hodlA = reserveA;
  const hodlB = reserveB;

  let cumulativeFees = 0;
  let maxValue = initialValueUsd;
  let maxDrawdown = 0;
  const returns: number[] = [];
  let prevValue = initialValueUsd;

  const equityCurve: BacktestResult["equityCurve"] = [];

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i].price;
    const logPrice = Math.log(price / initialPrice);

    // Find active bin
    const binIdx = Math.min(
      NUM_BINS - 1,
      Math.max(0, Math.floor(((logPrice - LOG_PRICE_MIN) / (LOG_PRICE_MAX - LOG_PRICE_MIN)) * NUM_BINS))
    );

    // Simulate arbitrage: move reserves toward target price
    const targetReserveRatio = price; // reserveB / reserveA should equal price
    const currentRatio = reserveB / (reserveA || 1);
    const deviation = Math.abs(currentRatio - targetReserveRatio) / targetReserveRatio;

    if (deviation > 0.005) {
      // Arb trade happens — bin weight determines effective liquidity
      const liqFactor = normBins[binIdx] / (TOTAL_LIQUIDITY / NUM_BINS);
      const arbFraction = Math.min(0.3, deviation * liqFactor * 0.5);

      if (currentRatio < targetReserveRatio) {
        // Price went up: sell A for B
        const sellA = reserveA * arbFraction;
        const getB = sellA * price * (1 - FEE_RATE);
        const fee = sellA * price * FEE_RATE;
        reserveA -= sellA;
        reserveB += getB;
        cumulativeFees += fee;
      } else {
        // Price went down: sell B for A
        const sellB = reserveB * arbFraction;
        const getA = (sellB / price) * (1 - FEE_RATE);
        const fee = sellB * FEE_RATE;
        reserveB -= sellB;
        reserveA += getA;
        cumulativeFees += fee;
      }
    }

    const lpValue = reserveA * price + reserveB + cumulativeFees;
    const hodlValue = hodlA * price + hodlB;

    // Track drawdown
    if (lpValue > maxValue) maxValue = lpValue;
    const dd = (maxValue - lpValue) / maxValue;
    if (dd > maxDrawdown) maxDrawdown = dd;

    // Track returns for Sharpe
    if (prevValue > 0) returns.push((lpValue - prevValue) / prevValue);
    prevValue = lpValue;

    if (i % Math.max(1, Math.floor(prices.length / 200)) === 0 || i === prices.length - 1) {
      equityCurve.push({
        day: i,
        lpValue: lpValue / initialValueUsd,
        hodlValue: hodlValue / initialValueUsd,
        fees: cumulativeFees / initialValueUsd,
      });
    }
  }

  const finalLpValue = reserveA * prices[prices.length - 1].price + reserveB + cumulativeFees;
  const finalHodlValue = hodlA * prices[prices.length - 1].price + hodlB;
  const lpVsHodl = finalLpValue / finalHodlValue;
  const totalIL = 1 - (finalLpValue - cumulativeFees) / finalHodlValue;

  // Sharpe ratio (annualized)
  const meanReturn = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
  const variance = returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (returns.length || 1);
  const sharpeRatio = variance > 0 ? (meanReturn / Math.sqrt(variance)) * Math.sqrt(365) : 0;

  return { equityCurve, totalFees: cumulativeFees / initialValueUsd, totalIL, finalLpValue: finalLpValue / initialValueUsd, finalHodlValue: finalHodlValue / initialValueUsd, lpVsHodl, maxDrawdown, sharpeRatio };
}
