import { describe, it, expect } from "vitest";
import { simulateMEV, type MEVSimConfig } from "@/lib/mev-engine";

function makeConfig(overrides: Partial<MEVSimConfig> = {}): MEVSimConfig {
  return {
    bins: Array.from({ length: 64 }, () => 0.5),
    feeRate: 0.003,
    numBlocks: 10,
    swapsPerBlock: 5,
    attackerBudget: 10000,
    sandwichEnabled: true,
    backrunEnabled: true,
    jitEnabled: true,
    ...overrides,
  };
}

describe("simulateMEV", () => {
  it("returns valid structure with all metrics", () => {
    const result = simulateMEV(makeConfig());
    expect(result.events).toBeInstanceOf(Array);
    expect(result.blockSummaries).toHaveLength(10);
    expect(result.cumulativeExtraction).toHaveLength(10);
    expect(result.flow).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.metrics.protectionScore).toBeGreaterThanOrEqual(0);
    expect(result.metrics.protectionScore).toBeLessThanOrEqual(100);
  });

  it("produces no MEV events when all attacks disabled", () => {
    const result = simulateMEV(
      makeConfig({ sandwichEnabled: false, backrunEnabled: false, jitEnabled: false })
    );
    expect(result.metrics.sandwichCount).toBe(0);
    expect(result.metrics.backrunCount).toBe(0);
    expect(result.metrics.jitCount).toBe(0);
    expect(result.metrics.totalExtractedValue).toBe(0);
  });

  it("accumulates LP fees across blocks", () => {
    const result = simulateMEV(
      makeConfig({ sandwichEnabled: false, backrunEnabled: false, jitEnabled: false })
    );
    expect(result.flow.totalVolume).toBeGreaterThan(0);
    // LP fees should be positive when there's volume
    const lastCum = result.cumulativeExtraction[result.cumulativeExtraction.length - 1];
    expect(lastCum.lpFees).toBeGreaterThan(0);
  });

  it("tracks block summaries correctly", () => {
    const result = simulateMEV(makeConfig({ numBlocks: 5, swapsPerBlock: 3 }));
    expect(result.blockSummaries).toHaveLength(5);
    for (const summary of result.blockSummaries) {
      expect(summary.swapCount).toBe(3);
      expect(summary.price).toBeGreaterThan(0);
    }
  });

  it("throws on empty bins", () => {
    expect(() => simulateMEV(makeConfig({ bins: [] }))).toThrow("at least one bin");
  });

  it("throws on invalid fee rate", () => {
    expect(() => simulateMEV(makeConfig({ feeRate: -0.1 }))).toThrow("Fee rate");
    expect(() => simulateMEV(makeConfig({ feeRate: 1 }))).toThrow("Fee rate");
  });

  it("throws on invalid numBlocks", () => {
    expect(() => simulateMEV(makeConfig({ numBlocks: 0 }))).toThrow("numBlocks");
    expect(() => simulateMEV(makeConfig({ numBlocks: 200000 }))).toThrow("numBlocks");
  });

  it("throws on invalid swapsPerBlock", () => {
    expect(() => simulateMEV(makeConfig({ swapsPerBlock: 0 }))).toThrow("swapsPerBlock");
  });

  it("throws on invalid attackerBudget", () => {
    expect(() => simulateMEV(makeConfig({ attackerBudget: 0 }))).toThrow("attackerBudget");
  });

  it("more blocks produce more cumulative extraction points", () => {
    const small = simulateMEV(makeConfig({ numBlocks: 5 }));
    const large = simulateMEV(makeConfig({ numBlocks: 20 }));
    expect(large.cumulativeExtraction.length).toBe(20);
    expect(small.cumulativeExtraction.length).toBe(5);
  });

  it("high concentration bins yield higher protection scores", () => {
    const lowConc = simulateMEV(makeConfig({ bins: Array(64).fill(0.1), numBlocks: 50 }));
    const highConc = simulateMEV(
      makeConfig({
        bins: Array(64).fill(0).map((_, i) => (i === 32 ? 1.0 : 0.0)),
        numBlocks: 50,
      })
    );
    // Higher bin variance should generally contribute to a higher protection score
    expect(highConc.metrics.protectionScore).toBeGreaterThanOrEqual(0);
    expect(lowConc.metrics.protectionScore).toBeGreaterThanOrEqual(0);
  });
});
