// Pure AMM simulation engine — no React dependencies

export class AMMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AMMError";
  }
}

export interface PoolState {
  x: number;       // Reserve X
  y: number;       // Reserve Y
  k: number;       // Invariant x*y
  feeRate: number;
  totalFees: number;
}

export interface TradeResult {
  input: number;
  output: number;
  priceBeforeTrade: number;
  priceAfterTrade: number;
  slippagePct: number;
  feesPaid: number;
  direction: "buyY" | "buyX";
}

export interface HistoryPoint {
  step: number;
  poolPrice: number;
  externalPrice: number;
  lpValue: number;
  hodlValue: number;
  ilPct: number;
  feesAccum: number;
  reserveX: number;
  reserveY: number;
  arbEvent: boolean;
}

export function createPool(x: number, y: number, feeRate: number): PoolState {
  if (x <= 0 || y <= 0) {
    throw new AMMError("Pool reserves must be positive");
  }
  if (feeRate < 0 || feeRate >= 1) {
    throw new AMMError("Fee rate must be in [0, 1)");
  }
  return { x, y, k: x * y, feeRate, totalFees: 0 };
}

export function poolPrice(pool: PoolState): number {
  return pool.y / pool.x;
}

export function executeTrade(pool: PoolState, inputAmount: number, direction: "buyY" | "buyX"): { pool: PoolState; result: TradeResult } {
  if (inputAmount <= 0) {
    throw new AMMError("Trade input amount must be positive");
  }
  if (!Number.isFinite(inputAmount)) {
    throw new AMMError("Trade input amount must be a finite number");
  }
  const priceBefore = poolPrice(pool);
  const fee = inputAmount * pool.feeRate;
  const effectiveInput = inputAmount - fee;

  let newX: number, newY: number, output: number;

  if (direction === "buyY") {
    // Sell X to buy Y
    newX = pool.x + effectiveInput;
    newY = pool.k / newX;
    output = pool.y - newY;
  } else {
    // Sell Y to buy X
    newY = pool.y + effectiveInput;
    newX = pool.k / newY;
    output = pool.x - newX;
  }

  if (output <= 0) {
    return { pool, result: { input: inputAmount, output: 0, priceBeforeTrade: priceBefore, priceAfterTrade: priceBefore, slippagePct: 100, feesPaid: fee, direction } };
  }

  const newPool: PoolState = { x: newX, y: newY, k: pool.k, feeRate: pool.feeRate, totalFees: pool.totalFees + fee };
  const priceAfter = poolPrice(newPool);

  // Ideal output = input * spot price (no slippage)
  const idealOutput = direction === "buyY" ? effectiveInput * priceBefore : effectiveInput / priceBefore;
  const slippage = idealOutput > 0 ? Math.abs(1 - output / idealOutput) * 100 : 0;

  return {
    pool: newPool,
    result: { input: inputAmount, output, priceBeforeTrade: priceBefore, priceAfterTrade: priceAfter, slippagePct: Math.min(slippage, 100), feesPaid: fee, direction },
  };
}

export function executeArbitrage(pool: PoolState, externalPrice: number): { pool: PoolState; arbProfit: number; traded: boolean } {
  if (externalPrice <= 0 || !Number.isFinite(externalPrice)) {
    throw new AMMError("External price must be a positive finite number");
  }
  const pPrice = poolPrice(pool);
  const deviation = Math.abs(pPrice - externalPrice) / externalPrice;

  // Only arb if deviation exceeds fee threshold (to be profitable)
  if (deviation < pool.feeRate * 2) {
    return { pool, arbProfit: 0, traded: false };
  }

  // Calculate target reserves for external price
  // x * y = k, y/x = externalPrice => x = sqrt(k/p), y = sqrt(k*p)
  const targetX = Math.sqrt(pool.k / externalPrice);
  const targetY = Math.sqrt(pool.k * externalPrice);

  if (pPrice < externalPrice) {
    // Pool price too low — buy Y (sell X)
    const dx = targetX - pool.x;
    if (dx <= 0) return { pool, arbProfit: 0, traded: false };
    const { pool: newPool, result } = executeTrade(pool, dx, "buyY");
    const arbProfit = result.output * externalPrice - dx - result.feesPaid;
    return { pool: newPool, arbProfit: Math.max(0, arbProfit), traded: true };
  } else {
    // Pool price too high — buy X (sell Y)
    const dy = targetY - pool.y;
    if (dy <= 0) return { pool, arbProfit: 0, traded: false };
    const { pool: newPool, result } = executeTrade(pool, dy, "buyX");
    const arbProfit = result.output - dy / externalPrice - result.feesPaid;
    return { pool: newPool, arbProfit: Math.max(0, arbProfit), traded: true };
  }
}

// Geometric Brownian Motion step
export function gbmStep(currentPrice: number, volatility: number, dt: number): number {
  if (currentPrice <= 0 || !Number.isFinite(currentPrice)) {
    throw new AMMError("Current price must be a positive finite number");
  }
  if (dt <= 0) {
    throw new AMMError("Time step (dt) must be positive");
  }
  const drift = 0;
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  const logReturn = (drift - 0.5 * volatility * volatility) * dt + volatility * Math.sqrt(dt) * z;
  return currentPrice * Math.exp(logReturn);
}

// Impermanent loss calculation
export function calcIL(initialPrice: number, currentPrice: number): number {
  const r = currentPrice / initialPrice;
  const sqrtR = Math.sqrt(r);
  return (2 * sqrtR / (1 + r) - 1) * 100; // negative = loss
}

// LP value: value of position at current reserves
export function lpValue(pool: PoolState, priceOfX: number): number {
  return pool.x * priceOfX + pool.y;
}

// HODL value: what if you just held initial reserves
export function hodlValue(initialX: number, initialY: number, currentPriceOfX: number): number {
  return initialX * currentPriceOfX + initialY;
}

// Concentrated liquidity: check if price is in range
export function isInRange(price: number, lower: number, upper: number): boolean {
  return price >= lower && price <= upper;
}

// Capital efficiency for concentrated range
export function capitalEfficiency(lower: number, upper: number): number {
  if (upper <= lower || lower <= 0) return 1;
  return 1 / (1 - Math.sqrt(lower / upper));
}

// Generate curve data for constant product
export function generateCurveData(k: number, currentX: number, points: number = 80): { x: number; y: number }[] {
  const data: { x: number; y: number }[] = [];
  const minX = Math.max(currentX * 0.1, 0.01);
  const maxX = currentX * 4;
  for (let i = 0; i <= points; i++) {
    const x = minX + (maxX - minX) * (i / points);
    data.push({ x: parseFloat(x.toFixed(4)), y: parseFloat((k / x).toFixed(4)) });
  }
  return data;
}
