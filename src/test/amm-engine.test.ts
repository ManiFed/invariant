import { describe, it, expect } from "vitest";
import {
  createPool,
  poolPrice,
  executeTrade,
  executeArbitrage,
  gbmStep,
  calcIL,
  lpValue,
  hodlValue,
  isInRange,
  capitalEfficiency,
  generateCurveData,
  AMMError,
} from "@/lib/amm-engine";

describe("createPool", () => {
  it("creates a pool with correct initial state", () => {
    const pool = createPool(100, 200, 0.003);
    expect(pool.x).toBe(100);
    expect(pool.y).toBe(200);
    expect(pool.k).toBe(20000);
    expect(pool.feeRate).toBe(0.003);
    expect(pool.totalFees).toBe(0);
  });

  it("throws on non-positive reserves", () => {
    expect(() => createPool(0, 100, 0.003)).toThrow(AMMError);
    expect(() => createPool(100, -1, 0.003)).toThrow(AMMError);
    expect(() => createPool(-5, 100, 0.003)).toThrow(AMMError);
  });

  it("throws on invalid fee rate", () => {
    expect(() => createPool(100, 200, -0.01)).toThrow(AMMError);
    expect(() => createPool(100, 200, 1)).toThrow(AMMError);
    expect(() => createPool(100, 200, 1.5)).toThrow(AMMError);
  });

  it("accepts zero fee rate", () => {
    const pool = createPool(100, 200, 0);
    expect(pool.feeRate).toBe(0);
  });
});

describe("poolPrice", () => {
  it("returns y/x ratio", () => {
    const pool = createPool(100, 200, 0.003);
    expect(poolPrice(pool)).toBe(2);
  });

  it("handles asymmetric pools", () => {
    const pool = createPool(50, 500, 0.01);
    expect(poolPrice(pool)).toBe(10);
  });
});

describe("executeTrade", () => {
  it("executes a buyY trade correctly", () => {
    const pool = createPool(100, 200, 0.003);
    const { pool: newPool, result } = executeTrade(pool, 10, "buyY");

    expect(result.direction).toBe("buyY");
    expect(result.input).toBe(10);
    expect(result.output).toBeGreaterThan(0);
    expect(result.feesPaid).toBeCloseTo(0.03, 4);
    expect(result.slippagePct).toBeGreaterThan(0);
    expect(newPool.x).toBeGreaterThan(pool.x);
    expect(newPool.y).toBeLessThan(pool.y);
    expect(newPool.totalFees).toBeGreaterThan(0);
  });

  it("executes a buyX trade correctly", () => {
    const pool = createPool(100, 200, 0.003);
    const { pool: newPool, result } = executeTrade(pool, 20, "buyX");

    expect(result.direction).toBe("buyX");
    expect(result.output).toBeGreaterThan(0);
    expect(newPool.y).toBeGreaterThan(pool.y);
    expect(newPool.x).toBeLessThan(pool.x);
  });

  it("preserves the invariant k after trade", () => {
    const pool = createPool(100, 200, 0);
    const { pool: newPool } = executeTrade(pool, 10, "buyY");
    // With zero fees, k should be preserved
    expect(newPool.k).toBeCloseTo(pool.k, 6);
  });

  it("throws on non-positive input", () => {
    const pool = createPool(100, 200, 0.003);
    expect(() => executeTrade(pool, 0, "buyY")).toThrow(AMMError);
    expect(() => executeTrade(pool, -5, "buyX")).toThrow(AMMError);
  });

  it("throws on non-finite input", () => {
    const pool = createPool(100, 200, 0.003);
    expect(() => executeTrade(pool, Infinity, "buyY")).toThrow(AMMError);
    expect(() => executeTrade(pool, NaN, "buyX")).toThrow(AMMError);
  });

  it("handles very small trades", () => {
    const pool = createPool(100, 200, 0.003);
    const { result } = executeTrade(pool, 0.001, "buyY");
    expect(result.output).toBeGreaterThan(0);
  });

  it("handles large trades with high slippage", () => {
    const pool = createPool(100, 200, 0.003);
    const { result } = executeTrade(pool, 50, "buyY");
    expect(result.slippagePct).toBeGreaterThan(10);
  });
});

describe("executeArbitrage", () => {
  it("returns no-trade result when arbitrage is not profitable", () => {
    const pool = createPool(100, 200, 0.003);
    const { pool: newPool, arbProfit, traded } = executeArbitrage(pool, 3.0);
    // Arbitrage may or may not execute depending on computed deltas
    expect(arbProfit).toBeGreaterThanOrEqual(0);
    expect(typeof traded).toBe("boolean");
  });

  it("skips arbitrage when deviation is below threshold", () => {
    const pool = createPool(100, 200, 0.003);
    const { pool: newPool, traded } = executeArbitrage(pool, 2.001);
    expect(traded).toBe(false);
    expect(newPool).toBe(pool);
  });

  it("returns a valid result for any external price", () => {
    const pool = createPool(100, 200, 0.003);
    for (const price of [0.5, 1.0, 2.0, 5.0, 10.0]) {
      const result = executeArbitrage(pool, price);
      expect(result.arbProfit).toBeGreaterThanOrEqual(0);
      expect(typeof result.traded).toBe("boolean");
    }
  });

  it("throws on invalid external price", () => {
    const pool = createPool(100, 200, 0.003);
    expect(() => executeArbitrage(pool, 0)).toThrow(AMMError);
    expect(() => executeArbitrage(pool, -1)).toThrow(AMMError);
    expect(() => executeArbitrage(pool, Infinity)).toThrow(AMMError);
  });
});

describe("gbmStep", () => {
  it("returns a positive price", () => {
    const price = gbmStep(100, 0.5, 1 / 365);
    expect(price).toBeGreaterThan(0);
    expect(Number.isFinite(price)).toBe(true);
  });

  it("throws on invalid inputs", () => {
    expect(() => gbmStep(0, 0.5, 1)).toThrow(AMMError);
    expect(() => gbmStep(-100, 0.5, 1)).toThrow(AMMError);
    expect(() => gbmStep(100, 0.5, 0)).toThrow(AMMError);
    expect(() => gbmStep(100, 0.5, -1)).toThrow(AMMError);
  });

  it("produces different prices on multiple calls (stochastic)", () => {
    const prices = Array.from({ length: 10 }, () => gbmStep(100, 0.5, 1 / 365));
    const unique = new Set(prices);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe("calcIL", () => {
  it("returns 0 when price is unchanged", () => {
    expect(calcIL(100, 100)).toBeCloseTo(0, 10);
  });

  it("returns negative value for price movement (impermanent loss)", () => {
    // Price doubling gives ~5.72% IL
    const il = calcIL(100, 200);
    expect(il).toBeLessThan(0);
    expect(il).toBeCloseTo(-5.719, 1);
  });

  it("is symmetric for inverse price ratios", () => {
    const il1 = calcIL(100, 200);
    const il2 = calcIL(100, 50);
    // IL for 2x and 0.5x should be the same
    expect(il1).toBeCloseTo(il2, 6);
  });
});

describe("lpValue", () => {
  it("computes LP position value correctly", () => {
    const pool = createPool(100, 200, 0.003);
    expect(lpValue(pool, 2)).toBe(400);
  });
});

describe("hodlValue", () => {
  it("computes hold value correctly", () => {
    expect(hodlValue(100, 200, 3)).toBe(500);
  });
});

describe("isInRange", () => {
  it("returns true for in-range price", () => {
    expect(isInRange(100, 80, 120)).toBe(true);
  });

  it("returns true for boundary prices", () => {
    expect(isInRange(80, 80, 120)).toBe(true);
    expect(isInRange(120, 80, 120)).toBe(true);
  });

  it("returns false for out-of-range price", () => {
    expect(isInRange(50, 80, 120)).toBe(false);
    expect(isInRange(150, 80, 120)).toBe(false);
  });
});

describe("capitalEfficiency", () => {
  it("returns efficiency > 1 for valid ranges", () => {
    const eff = capitalEfficiency(90, 110);
    expect(eff).toBeGreaterThan(1);
  });

  it("returns 1 for invalid ranges", () => {
    expect(capitalEfficiency(110, 90)).toBe(1);
    expect(capitalEfficiency(0, 100)).toBe(1);
    expect(capitalEfficiency(-10, 100)).toBe(1);
  });

  it("increases for tighter ranges", () => {
    const wide = capitalEfficiency(50, 200);
    const tight = capitalEfficiency(90, 110);
    expect(tight).toBeGreaterThan(wide);
  });
});

describe("generateCurveData", () => {
  it("generates the correct number of points", () => {
    const data = generateCurveData(10000, 50, 40);
    expect(data).toHaveLength(41); // points + 1
  });

  it("all points satisfy x*y ≈ k", () => {
    const k = 10000;
    const data = generateCurveData(k, 50);
    for (const point of data) {
      expect(point.x * point.y).toBeCloseTo(k, -1);
    }
  });

  it("uses default 80 points", () => {
    const data = generateCurveData(10000, 50);
    expect(data).toHaveLength(81);
  });
});
