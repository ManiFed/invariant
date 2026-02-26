import { describe, expect, it } from "vitest";
import { ARCHIVE_ROUND_INTERVAL, NUM_BINS, TOTAL_LIQUIDITY, type Candidate, selectArchiveCandidates } from "@/lib/discovery-engine";

function candidate(id: string, score: number): Candidate {
  return {
    id,
    bins: new Float64Array(NUM_BINS).fill(TOTAL_LIQUIDITY / NUM_BINS),
    familyId: "piecewise-bands",
    familyParams: { centerMass: 0.5, shoulder: 0.2, skew: 0 },
    regime: "low-vol",
    generation: 1,
    metrics: {
      totalFees: 30,
      totalSlippage: 0.02,
      arbLeakage: 10,
      liquidityUtilization: 0.65,
      lpValueVsHodl: 1.03,
      maxDrawdown: 0.12,
      volatilityOfReturns: 0.11,
    },
    features: {
      curvature: 0.3,
      curvatureGradient: 0.1,
      entropy: 0.7,
      symmetry: 0.6,
      tailDensityRatio: 0.2,
      peakConcentration: 1.4,
      concentrationWidth: 0.25,
    },
    stability: 0.08,
    score,
    timestamp: Date.now(),
  };
}

describe("selectArchiveCandidates", () => {
  it("buffers threshold-qualified candidates until the archive review interval", () => {
    const c1 = candidate("c1", 5.2);
    const result = selectArchiveCandidates([], [c1], ARCHIVE_ROUND_INTERVAL - 1, 5.5);

    expect(result.archived).toHaveLength(0);
    expect(result.nextBuffer.map((c) => c.id)).toEqual(["c1"]);
  });

  it("archives only candidates that beat the incumbent at the review interval", () => {
    const stronger = candidate("strong", 4.8);
    const weaker = candidate("weak", 5.1);

    const result = selectArchiveCandidates([weaker], [stronger], ARCHIVE_ROUND_INTERVAL, 5);

    expect(result.archived.map((c) => c.id)).toEqual(["strong"]);
    expect(result.nextBuffer).toHaveLength(0);
  });
});
