import { describe, expect, it } from "vitest";
import { applyArbitrageStep, ARB_THRESHOLD, type RegimeConfig } from "@/lib/discovery-engine";

describe("applyArbitrageStep", () => {
  const regimeSlow: RegimeConfig = {
    id: "low-vol",
    label: "slow",
    volatility: 0.3,
    drift: 0,
    jumpIntensity: 0,
    jumpMean: 0,
    jumpStd: 0,
    arbResponsiveness: 0.05,
  };

  const regimeFast: RegimeConfig = {
    ...regimeSlow,
    arbResponsiveness: 1,
    label: "fast",
  };

  it("preserves a residual deviation when responsiveness is low", () => {
    const current = 0;
    const external = ARB_THRESHOLD * 3;

    const slow = applyArbitrageStep(current, external, regimeSlow);
    const fast = applyArbitrageStep(current, external, regimeFast);

    expect(fast.nextLogPrice).toBeCloseTo(external, 12);
    expect(slow.nextLogPrice).toBeLessThan(fast.nextLogPrice);
    expect(Math.abs(external - slow.nextLogPrice)).toBeGreaterThan(0);
    expect(slow.feeDelta).toBeCloseTo(fast.feeDelta, 12);
    expect(slow.arbLeakageDelta).toBeCloseTo(fast.arbLeakageDelta, 12);
  });
});
