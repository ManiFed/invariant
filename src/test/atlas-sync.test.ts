import { describe, expect, it } from "vitest";
import { NUM_BINS, TOTAL_LIQUIDITY, type Candidate, type RegimeId } from "@/lib/discovery-engine";
import { buildPopulationsFromArchive } from "@/lib/atlas-sync";

function candidate(id: string, regime: RegimeId): Candidate {
  return {
    id,
    bins: new Float64Array(NUM_BINS).fill(TOTAL_LIQUIDITY / NUM_BINS),
    familyId: "piecewise-bands",
    familyParams: { centerMass: 0.5, shoulder: 0.2, skew: 0 },
    regime,
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
    score: 1,
    timestamp: Date.now(),
  };
}

describe("buildPopulationsFromArchive", () => {
  it("always returns all regimes, including regime-shift", () => {
    const archive = [candidate("low", "low-vol")];
    const populations = buildPopulationsFromArchive(archive);

    expect(populations["regime-shift"]).toBeDefined();
    expect(populations["regime-shift"].regime).toBe("regime-shift");
    expect(populations["regime-shift"].candidates).toEqual([]);
  });
});
