import { describe, expect, it } from "vitest";
import {
  type Candidate,
  learnMlRecommendation,
  NUM_BINS,
  TOTAL_LIQUIDITY,
} from "@/lib/discovery-engine";

const makeCandidate = (i: number): Candidate => {
  const bins = new Float64Array(NUM_BINS).fill(TOTAL_LIQUIDITY / NUM_BINS);
  return {
    id: `cand-${i}`,
    bins,
    familyId: "piecewise-bands",
    familyParams: { centerMass: 0.5, shoulder: 0.2, skew: 0 },
    regime: "low-vol",
    generation: 1,
    metrics: {
      totalFees: 20 + i,
      totalSlippage: 0.01 + i * 0.0001,
      arbLeakage: 1 + i * 0.01,
      liquidityUtilization: 0.6,
      lpValueVsHodl: 1.02,
      maxDrawdown: 0.08,
      volatilityOfReturns: 0.12,
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
    stability: 0.08,
    score: i,
    timestamp: Date.now(),
  };
};

describe("learnMlRecommendation", () => {
  it("returns a recommendation with three weakest axes when enough data exists", () => {
    const candidates = Array.from({ length: 20 }, (_, i) => makeCandidate(i));

    const recommendation = learnMlRecommendation(candidates);

    expect(recommendation).not.toBeNull();
    expect(recommendation?.weakestAxes).toHaveLength(3);
    expect(recommendation?.confidence).toBeGreaterThan(0);
    expect(recommendation?.targetCoverage).toBeGreaterThan(0);
  });

  it("returns null when there is not enough evidence", () => {
    const recommendation = learnMlRecommendation(Array.from({ length: 8 }, (_, i) => makeCandidate(i)));
    expect(recommendation).toBeNull();
  });
});
