import {
  type Candidate,
  type FeatureDescriptor,
  type PopulationState,
  type RegimeConfig,
  type RegimeId,
  REGIMES,
  computeFeatures,
  normalizeBins,
  runGeneration,
} from "@/lib/discovery-engine";

export interface RegimeVector {
  volatility: number;
  jumpIntensity: number;
  jumpMean: number;
  jumpStd: number;
  meanReversion: number;
  arbResponsiveness: number;
}

export interface RegimeMapEntry {
  id: string;
  regime: RegimeVector;
  champion: Candidate;
  features: FeatureDescriptor;
  stability: number;
  generations: number;
  converged: boolean;
  convergenceDelta: number;
  sampledAt: number;
}

export interface RegimeCoverage {
  sampled: number;
  converged: number;
  convergenceRatio: number;
  coverageRatio: number;
}

export interface RegimeEstimate {
  source: "evolved" | "interpolated";
  bins: Float64Array;
  features: FeatureDescriptor;
  stability: number;
  contributors: string[];
}

const BOUNDS = {
  volatility: [0.2, 1.2],
  jumpIntensity: [0, 8],
  jumpMean: [-0.12, 0.04],
  jumpStd: [0.02, 0.3],
  meanReversion: [0, 3],
  arbResponsiveness: [0.1, 1],
} as const;

export function createRegimeGrid(levels: number = 3): RegimeVector[] {
  const axis = (min: number, max: number) =>
    Array.from({ length: levels }, (_, i) => min + ((max - min) * i) / Math.max(levels - 1, 1));

  const vols = axis(...BOUNDS.volatility);
  const jumps = axis(...BOUNDS.jumpIntensity);
  const reversions = axis(...BOUNDS.meanReversion);
  const arbs = axis(...BOUNDS.arbResponsiveness);

  const vectors: RegimeVector[] = [];
  for (const volatility of vols) {
    for (const jumpIntensity of jumps) {
      for (const meanReversion of reversions) {
        for (const arbResponsiveness of arbs) {
          vectors.push({
            volatility,
            jumpIntensity,
            meanReversion,
            arbResponsiveness,
            jumpMean: -0.03 - jumpIntensity * 0.005,
            jumpStd: 0.06 + jumpIntensity * 0.02,
          });
        }
      }
    }
  }
  return vectors;
}

function regimeDistance(a: RegimeVector, b: RegimeVector): number {
  return Math.sqrt(
    ((a.volatility - b.volatility) / (BOUNDS.volatility[1] - BOUNDS.volatility[0])) ** 2 +
      ((a.jumpIntensity - b.jumpIntensity) / (BOUNDS.jumpIntensity[1] - BOUNDS.jumpIntensity[0])) ** 2 +
      ((a.meanReversion - b.meanReversion) / (BOUNDS.meanReversion[1] - BOUNDS.meanReversion[0])) ** 2 +
      ((a.arbResponsiveness - b.arbResponsiveness) / (BOUNDS.arbResponsiveness[1] - BOUNDS.arbResponsiveness[0])) ** 2,
  );
}

function nearestPresetId(vector: RegimeVector): string {
  if (vector.jumpIntensity > 1.5) return "jump-diffusion";
  if (vector.volatility > 0.7) return "high-vol";
  return "low-vol";
}

function makeRegimeConfig(vector: RegimeVector): RegimeConfig {
  const presetId = nearestPresetId(vector);
  const preset = REGIMES.find((r) => r.id === presetId)!;

  return {
    ...preset,
    id: preset.id,
    label: `Sampled regime ${preset.label}`,
    volatility: vector.volatility,
    jumpIntensity: vector.jumpIntensity,
    jumpMean: vector.jumpMean,
    jumpStd: vector.jumpStd,
    meanReversion: vector.meanReversion,
    arbResponsiveness: vector.arbResponsiveness,
  };
}

function emptyPopulation(regimeId: RegimeId): PopulationState {
  return {
    regime: regimeId,
    candidates: [],
    champion: null,
    metricChampions: {
      fees: null,
      utilization: null,
      lpValue: null,
      lowSlippage: null,
      lowArbLeak: null,
      lowDrawdown: null,
      stability: null,
    },
    generation: 0,
    totalEvaluated: 0,
  };
}

export function evolveRegimePoint(
  vector: RegimeVector,
  options: { maxGenerations?: number; threshold?: number; patience?: number } = {},
): RegimeMapEntry {
  const maxGenerations = options.maxGenerations ?? 10;
  const threshold = options.threshold ?? 0.002;
  const patience = options.patience ?? 3;

  const config = makeRegimeConfig(vector);
  let population = emptyPopulation(config.id);
  let bestScore = Infinity;
  let stagnant = 0;
  let lastDelta = Infinity;

  for (let generation = 1; generation <= maxGenerations; generation++) {
    const { newPopulation } = runGeneration(population, config);
    population = newPopulation;

    const championScore = population.champion?.score ?? Infinity;
    lastDelta = bestScore - championScore;
    if (championScore < bestScore) {
      stagnant = lastDelta < threshold ? stagnant + 1 : 0;
      bestScore = championScore;
    } else {
      stagnant += 1;
    }

    if (generation >= patience && stagnant >= patience) {
      break;
    }
  }

  const champion = population.champion ?? population.candidates[0];
  if (!champion) {
    throw new Error("Failed to evolve champion for sampled regime point");
  }

  return {
    id: `regime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    regime: vector,
    champion,
    features: champion.features,
    stability: champion.stability,
    generations: population.generation,
    converged: stagnant >= patience,
    convergenceDelta: Number((Math.max(lastDelta, 0)).toFixed(6)),
    sampledAt: Date.now(),
  };
}

export function estimateRegimeGeometry(target: RegimeVector, entries: RegimeMapEntry[], k: number = 4): RegimeEstimate | null {
  if (entries.length === 0) return null;

  const direct = entries.find((entry) => regimeDistance(entry.regime, target) < 1e-6);
  if (direct) {
    return {
      source: "evolved",
      bins: new Float64Array(direct.champion.bins),
      features: direct.features,
      stability: direct.stability,
      contributors: [direct.id],
    };
  }

  const nearest = [...entries]
    .map((entry) => ({ entry, dist: regimeDistance(entry.regime, target) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, Math.min(k, entries.length));

  const bins = new Float64Array(nearest[0].entry.champion.bins.length);
  const featureAcc = {
    curvature: 0,
    curvatureGradient: 0,
    entropy: 0,
    symmetry: 0,
    tailDensityRatio: 0,
    peakConcentration: 0,
    concentrationWidth: 0,
  };
  let weightSum = 0;
  let stability = 0;

  for (const { entry, dist } of nearest) {
    const weight = 1 / Math.max(dist, 1e-3);
    weightSum += weight;
    for (let i = 0; i < bins.length; i++) bins[i] += entry.champion.bins[i] * weight;

    featureAcc.curvature += entry.features.curvature * weight;
    featureAcc.curvatureGradient += entry.features.curvatureGradient * weight;
    featureAcc.entropy += entry.features.entropy * weight;
    featureAcc.symmetry += entry.features.symmetry * weight;
    featureAcc.tailDensityRatio += entry.features.tailDensityRatio * weight;
    featureAcc.peakConcentration += entry.features.peakConcentration * weight;
    featureAcc.concentrationWidth += entry.features.concentrationWidth * weight;
    stability += entry.stability * weight;
  }

  for (let i = 0; i < bins.length; i++) bins[i] /= weightSum;
  normalizeBins(bins);

  return {
    source: "interpolated",
    bins,
    features: {
      curvature: featureAcc.curvature / weightSum,
      curvatureGradient: featureAcc.curvatureGradient / weightSum,
      entropy: featureAcc.entropy / weightSum,
      symmetry: featureAcc.symmetry / weightSum,
      tailDensityRatio: featureAcc.tailDensityRatio / weightSum,
      peakConcentration: featureAcc.peakConcentration / weightSum,
      concentrationWidth: featureAcc.concentrationWidth / weightSum,
    },
    stability: stability / weightSum,
    contributors: nearest.map((n) => n.entry.id),
  };
}

export function computeRegimeCoverage(entries: RegimeMapEntry[]): RegimeCoverage {
  if (entries.length === 0) {
    return { sampled: 0, converged: 0, convergenceRatio: 0, coverageRatio: 0 };
  }

  const grid = 5;
  const occupied = new Set<string>();
  for (const entry of entries) {
    const vx = Math.min(Math.floor(((entry.regime.volatility - BOUNDS.volatility[0]) / (BOUNDS.volatility[1] - BOUNDS.volatility[0])) * grid), grid - 1);
    const jx = Math.min(Math.floor(((entry.regime.jumpIntensity - BOUNDS.jumpIntensity[0]) / (BOUNDS.jumpIntensity[1] - BOUNDS.jumpIntensity[0])) * grid), grid - 1);
    occupied.add(`${Math.max(vx, 0)}:${Math.max(jx, 0)}`);
  }

  const converged = entries.filter((entry) => entry.converged).length;
  return {
    sampled: entries.length,
    converged,
    convergenceRatio: converged / entries.length,
    coverageRatio: occupied.size / (grid * grid),
  };
}

export function deriveFeaturesFromBins(bins: Float64Array): FeatureDescriptor {
  return computeFeatures(bins);
}
