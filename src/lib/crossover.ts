// Crossover operators for the evolutionary search
// Enables combining good features from different parent candidates.

import { NUM_BINS, TOTAL_LIQUIDITY, normalizeBins, type InvariantFamilyId, INVARIANT_FAMILIES } from "./discovery-engine";

/** Standard normal */
function randn(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-15))) * Math.cos(2 * Math.PI * u2);
}

/**
 * Uniform crossover: per-bin swap with 50% probability, then normalize.
 */
export function crossoverBins(parentA: Float64Array, parentB: Float64Array): Float64Array {
  const child = new Float64Array(NUM_BINS);
  for (let i = 0; i < NUM_BINS; i++) {
    child[i] = Math.random() < 0.5 ? parentA[i] : parentB[i];
  }
  normalizeBins(child);
  return child;
}

/**
 * Segment crossover: take left half from A, right half from B (with blended transition).
 */
export function segmentCrossover(parentA: Float64Array, parentB: Float64Array): Float64Array {
  const child = new Float64Array(NUM_BINS);
  const crossPoint = Math.floor(NUM_BINS * (0.3 + Math.random() * 0.4));
  const blendWidth = 4 + Math.floor(Math.random() * 6);

  for (let i = 0; i < NUM_BINS; i++) {
    if (i < crossPoint - blendWidth) {
      child[i] = parentA[i];
    } else if (i > crossPoint + blendWidth) {
      child[i] = parentB[i];
    } else {
      const t = (i - (crossPoint - blendWidth)) / (2 * blendWidth);
      child[i] = parentA[i] * (1 - t) + parentB[i] * t;
    }
  }
  normalizeBins(child);
  return child;
}

/**
 * Arithmetic crossover: weighted blend of two parents.
 */
export function arithmeticCrossover(
  parentA: Float64Array,
  parentB: Float64Array,
  ratio: number = 0.5,
): Float64Array {
  const child = new Float64Array(NUM_BINS);
  for (let i = 0; i < NUM_BINS; i++) {
    child[i] = parentA[i] * ratio + parentB[i] * (1 - ratio);
  }
  normalizeBins(child);
  return child;
}

/**
 * Blend family parameters from two parents when they share the same family.
 */
export function crossoverParams(
  paramsA: Record<string, number>,
  paramsB: Record<string, number>,
  familyId: InvariantFamilyId,
): Record<string, number> {
  const family = INVARIANT_FAMILIES.find(f => f.id === familyId);
  if (!family) return { ...paramsA };

  const blended: Record<string, number> = {};
  for (const [key, range] of Object.entries(family.parameterRanges)) {
    const a = paramsA[key] ?? (range.min + range.max) / 2;
    const b = paramsB[key] ?? (range.min + range.max) / 2;
    const t = 0.3 + Math.random() * 0.4; // slight random bias
    const val = a * t + b * (1 - t) + randn() * (range.max - range.min) * 0.02;
    blended[key] = Math.min(range.max, Math.max(range.min, val));
  }
  return blended;
}

/**
 * Compute adaptive exploration rate based on population diversity.
 * High diversity → exploit (low rate). Low diversity → explore (high rate).
 */
export function adaptiveExplorationRate(scores: number[]): number {
  if (scores.length < 3) return 0.15;

  // Compute normalized entropy of score distribution
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;
  if (range < 1e-6) return 0.35; // fully converged → max exploration

  const NUM_BUCKETS = 8;
  const buckets = new Array(NUM_BUCKETS).fill(0);
  for (const s of scores) {
    const idx = Math.min(Math.floor(((s - min) / range) * NUM_BUCKETS), NUM_BUCKETS - 1);
    buckets[idx]++;
  }

  let entropy = 0;
  for (const count of buckets) {
    if (count > 0) {
      const p = count / scores.length;
      entropy -= p * Math.log2(p);
    }
  }
  const maxEntropy = Math.log2(NUM_BUCKETS);
  const normalizedEntropy = entropy / maxEntropy;

  // Low entropy (converged) → high exploration rate
  // High entropy (diverse) → low exploration rate
  return 0.05 + 0.25 * (1 - normalizedEntropy);
}
