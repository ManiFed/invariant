import { afterEach, describe, expect, it, vi } from "vitest";
import { createRandomCandidate, learnMlRecommendation, NUM_BINS, TOTAL_LIQUIDITY, type Candidate } from "@/lib/discovery-engine";

const makeCandidate = (i: number, familyId: Candidate["familyId"]): Candidate => ({
  id: `cand-${i}`,
  bins: new Float64Array(NUM_BINS).fill(TOTAL_LIQUIDITY / NUM_BINS),
  familyId,
  familyParams: familyId === "amplified-hybrid"
    ? { amplification: 8.5, decay: 1.1, bias: 0 }
    : familyId === "tail-shielded"
      ? { tailWeight: 0.3, moatWidth: 0.12, centerBias: 0.4 }
      : { centerMass: 0.5, shoulder: 0.2, skew: 0 },
  regime: "low-vol",
  generation: 1,
  metrics: {
    totalFees: familyId === "amplified-hybrid" ? 31 : 21,
    totalSlippage: familyId === "amplified-hybrid" ? 0.02 : 0.05,
    arbLeakage: familyId === "amplified-hybrid" ? 6 : 18,
    liquidityUtilization: familyId === "amplified-hybrid" ? 0.78 : 0.55,
    lpValueVsHodl: familyId === "amplified-hybrid" ? 1.14 : 1.03,
    maxDrawdown: familyId === "amplified-hybrid" ? 0.08 : 0.17,
    volatilityOfReturns: 0.1,
  },
  features: {
    curvature: 0.3,
    curvatureGradient: 0.05,
    entropy: 0.7,
    symmetry: 0.6,
    tailDensityRatio: 0.25,
    peakConcentration: 1.4,
    concentrationWidth: 0.2,
  },
  stability: familyId === "amplified-hybrid" ? 0.06 : 0.11,
  score: i,
  timestamp: Date.now(),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("family guidance", () => {
  it("learns prioritized AMM families and steers candidate sampling", () => {
    const candidates = [
      ...Array.from({ length: 14 }, (_, i) => makeCandidate(i, "amplified-hybrid")),
      ...Array.from({ length: 8 }, (_, i) => makeCandidate(100 + i, "piecewise-bands")),
      ...Array.from({ length: 6 }, (_, i) => makeCandidate(200 + i, "tail-shielded")),
    ];

    const recommendation = learnMlRecommendation(candidates);
    expect(recommendation).not.toBeNull();
    expect(recommendation?.prioritizedFamilies[0]).toBe("amplified-hybrid");

    vi.spyOn(Math, "random").mockReturnValue(0);

    const sampled = createRandomCandidate("low-vol", 2, undefined, recommendation?.familyWeights);
    expect(sampled.familyId).toBe("amplified-hybrid");
  });
});
