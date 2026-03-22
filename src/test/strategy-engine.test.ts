import { describe, it, expect } from "vitest";
import {
  runStrategyBacktest,
  STRATEGY_PRESETS,
  type StrategyConfig,
  type SimulationConfig,
} from "@/lib/strategy-engine";

function makeStrategy(overrides: Partial<StrategyConfig> = {}): StrategyConfig {
  return {
    id: "test-strategy",
    name: "Test Strategy",
    presetId: "passive",
    rangeWidth: 100,
    rebalanceTrigger: 100,
    rebalanceCooldown: 999,
    stopLoss: 100,
    maxILTolerance: 100,
    hedgeRatio: 0,
    color: "#ff0000",
    ...overrides,
  };
}

function makeSimConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return {
    volatility: 50,
    drift: 0,
    jumpProb: 0,
    jumpSize: 0,
    numPaths: 5,
    timeHorizon: 30,
    initialCapital: 10000,
    feeRate: 0.003,
    initialPrice: 2000,
    ...overrides,
  };
}

describe("runStrategyBacktest", () => {
  it("returns a valid BacktestResult structure", () => {
    const result = runStrategyBacktest(makeStrategy(), makeSimConfig(), 42);
    expect(result.strategyId).toBe("test-strategy");
    expect(result.strategyName).toBe("Test Strategy");
    expect(result.paths).toHaveLength(5);
    expect(result.equityCurve).toHaveLength(31); // 0..30
    expect(result.returnDist).toHaveLength(20);
    expect(typeof result.meanReturn).toBe("number");
    expect(typeof result.medianReturn).toBe("number");
    expect(typeof result.sharpe).toBe("number");
    expect(typeof result.maxDrawdown).toBe("number");
    expect(typeof result.winRate).toBe("number");
  });

  it("produces deterministic results with same seed", () => {
    const r1 = runStrategyBacktest(makeStrategy(), makeSimConfig(), 123);
    const r2 = runStrategyBacktest(makeStrategy(), makeSimConfig(), 123);
    expect(r1.meanReturn).toBe(r2.meanReturn);
    expect(r1.medianReturn).toBe(r2.medianReturn);
    expect(r1.sharpe).toBe(r2.sharpe);
  });

  it("produces different results with different seeds", () => {
    const r1 = runStrategyBacktest(makeStrategy(), makeSimConfig(), 1);
    const r2 = runStrategyBacktest(makeStrategy(), makeSimConfig(), 99);
    // Very unlikely to be exactly equal with different seeds
    expect(r1.meanReturn).not.toBe(r2.meanReturn);
  });

  it("each path has correct number of snapshots", () => {
    const config = makeSimConfig({ timeHorizon: 10 });
    const result = runStrategyBacktest(makeStrategy(), config, 42);
    for (const pathResult of result.paths) {
      expect(pathResult.snapshots).toHaveLength(11); // day 0..10
      expect(pathResult.snapshots[0].day).toBe(0);
      expect(pathResult.snapshots[10].day).toBe(10);
    }
  });

  it("win rate is between 0 and 100", () => {
    const result = runStrategyBacktest(makeStrategy(), makeSimConfig({ numPaths: 20 }), 42);
    expect(result.winRate).toBeGreaterThanOrEqual(0);
    expect(result.winRate).toBeLessThanOrEqual(100);
  });

  it("max drawdown is non-negative", () => {
    const result = runStrategyBacktest(makeStrategy(), makeSimConfig(), 42);
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
  });

  it("equity curve has percentile bands", () => {
    const result = runStrategyBacktest(makeStrategy(), makeSimConfig({ numPaths: 20 }), 42);
    for (const point of result.equityCurve) {
      expect(point.p5).toBeLessThanOrEqual(point.mean);
      expect(point.p95).toBeGreaterThanOrEqual(point.mean);
    }
  });

  it("range rebalancer triggers rebalances", () => {
    const strategy = makeStrategy({
      presetId: "range",
      rangeWidth: 0.05, // very tight range
      rebalanceTrigger: 0.01,
      rebalanceCooldown: 1,
    });
    const config = makeSimConfig({ volatility: 80, numPaths: 3, timeHorizon: 60 });
    const result = runStrategyBacktest(strategy, config, 42);
    expect(result.avgRebalances).toBeGreaterThan(0);
  });

  it("hedging reduces exposure", () => {
    const noHedge = runStrategyBacktest(
      makeStrategy({ hedgeRatio: 0 }),
      makeSimConfig({ numPaths: 50, volatility: 80 }),
      42
    );
    const withHedge = runStrategyBacktest(
      makeStrategy({ hedgeRatio: 0.5 }),
      makeSimConfig({ numPaths: 50, volatility: 80 }),
      42
    );
    // Hedged strategy should have different return characteristics
    expect(noHedge.meanReturn).not.toBe(withHedge.meanReturn);
  });

  it("STRATEGY_PRESETS are well-formed", () => {
    expect(STRATEGY_PRESETS.length).toBeGreaterThan(0);
    for (const preset of STRATEGY_PRESETS) {
      expect(preset.name).toBeTruthy();
      expect(preset.presetId).toBeTruthy();
      expect(preset.rangeWidth).toBeGreaterThan(0);
    }
  });
});
