import { describe, expect, it } from "vitest";
import { scoreCandidate, type MetricVector } from "@/lib/discovery-engine";

const stability = 0.06;

describe("scoreCandidate spider-balance behavior", () => {
  it("prefers a balanced AMM over a skewed specialist with similar headline metrics", () => {
    const balanced: MetricVector = {
      totalFees: 27,
      totalSlippage: 0.05,
      arbLeakage: 12,
      liquidityUtilization: 0.63,
      lpValueVsHodl: 1.08,
      maxDrawdown: 0.12,
      volatilityOfReturns: 0.1,
    };

    const skewed: MetricVector = {
      totalFees: 27,
      totalSlippage: 0.15,
      arbLeakage: 20,
      liquidityUtilization: 0.45,
      lpValueVsHodl: 1.17,
      maxDrawdown: 0.2,
      volatilityOfReturns: 0.12,
    };

    expect(scoreCandidate(balanced, stability)).toBeLessThan(scoreCandidate(skewed, stability));
  });

  it("still preserves specialist upside when weak axes are comparable", () => {
    const specialist: MetricVector = {
      totalFees: 33,
      totalSlippage: 0.03,
      arbLeakage: 10,
      liquidityUtilization: 0.72,
      lpValueVsHodl: 1.18,
      maxDrawdown: 0.09,
      volatilityOfReturns: 0.1,
    };

    const flatter: MetricVector = {
      totalFees: 26,
      totalSlippage: 0.03,
      arbLeakage: 10,
      liquidityUtilization: 0.7,
      lpValueVsHodl: 1.1,
      maxDrawdown: 0.09,
      volatilityOfReturns: 0.1,
    };

    expect(scoreCandidate(specialist, stability)).toBeLessThan(scoreCandidate(flatter, stability));
  });
});
