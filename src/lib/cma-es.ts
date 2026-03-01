// CMA-ES (Covariance Matrix Adaptation Evolution Strategy)
// A state-of-the-art derivative-free optimizer that learns the correlation
// structure between bin positions and adapts its mutation distribution.

import { NUM_BINS, normalizeBins } from "./discovery-engine";

export interface CMAESState {
  /** Mean vector (the current "best guess" solution) */
  mean: Float64Array;
  /** Step size (overall mutation scale) */
  sigma: number;
  /** Covariance matrix (stored as flat array for efficiency, N×N) */
  C: Float64Array;
  /** Evolution path for sigma adaptation */
  pSigma: Float64Array;
  /** Evolution path for covariance adaptation */
  pC: Float64Array;
  /** Generation counter */
  generation: number;
  /** Effective dimension (we use a reduced dimension for efficiency) */
  dim: number;
  /** Population size lambda */
  lambda: number;
  /** Number of parents mu */
  mu: number;
  /** Recombination weights */
  weights: Float64Array;
  /** mueff = (sum(w))^2 / sum(w^2) */
  mueff: number;
  /** Learning rates */
  cSigma: number;
  dSigma: number;
  cc: number;
  c1: number;
  cmu: number;
}

/** Standard normal random number */
function randn(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-15))) * Math.cos(2 * Math.PI * u2);
}

/**
 * Initialize CMA-ES state for the given dimension.
 * We use a reduced dimension (16 principal components) rather than full 64 bins
 * to keep the covariance matrix tractable.
 */
export function createCMAES(dim: number = 16, lambda?: number): CMAESState {
  const n = dim;
  const lam = lambda ?? Math.max(8, Math.floor(4 + 3 * Math.log(n)));
  const mu = Math.floor(lam / 2);

  // Log-linear recombination weights
  const rawWeights = new Float64Array(mu);
  for (let i = 0; i < mu; i++) {
    rawWeights[i] = Math.log(mu + 0.5) - Math.log(i + 1);
  }
  const wSum = rawWeights.reduce((a, b) => a + b, 0);
  const weights = rawWeights.map(w => w / wSum);
  const mueff = 1 / weights.reduce((a, w) => a + w * w, 0);

  // Learning rates
  const cSigma = (mueff + 2) / (n + mueff + 5);
  const dSigma = 1 + 2 * Math.max(0, Math.sqrt((mueff - 1) / (n + 1)) - 1) + cSigma;
  const cc = (4 + mueff / n) / (n + 4 + 2 * mueff / n);
  const c1 = 2 / ((n + 1.3) ** 2 + mueff);
  const cmu = Math.min(1 - c1, 2 * (mueff - 2 + 1 / mueff) / ((n + 2) ** 2 + mueff));

  // Initialize mean from uniform distribution
  const mean = new Float64Array(n);
  for (let i = 0; i < n; i++) mean[i] = 1.0 / n;

  // Identity covariance matrix (flat)
  const C = new Float64Array(n * n);
  for (let i = 0; i < n; i++) C[i * n + i] = 1.0;

  return {
    mean, sigma: 0.3, C,
    pSigma: new Float64Array(n),
    pC: new Float64Array(n),
    generation: 0, dim: n, lambda: lam, mu, weights,
    mueff, cSigma, dSigma, cc, c1, cmu,
  };
}

/**
 * Sample lambda candidate solutions from the CMA-ES distribution.
 * Returns solutions in the reduced dimension space.
 */
export function sampleCMAES(state: CMAESState): Float64Array[] {
  const { mean, sigma, C, dim, lambda } = state;
  const samples: Float64Array[] = [];

  // Compute square root of C using Cholesky-like decomposition (simplified)
  // For efficiency, use eigendecomposition approximation
  const sqrtC = approximateSqrtC(C, dim);

  for (let k = 0; k < lambda; k++) {
    const z = new Float64Array(dim);
    for (let i = 0; i < dim; i++) z[i] = randn();

    // y = sqrt(C) * z
    const y = new Float64Array(dim);
    for (let i = 0; i < dim; i++) {
      let sum = 0;
      for (let j = 0; j < dim; j++) {
        sum += sqrtC[i * dim + j] * z[j];
      }
      y[i] = sum;
    }

    // x = mean + sigma * y
    const x = new Float64Array(dim);
    for (let i = 0; i < dim; i++) {
      x[i] = Math.max(0, mean[i] + sigma * y[i]);
    }

    samples.push(x);
  }

  return samples;
}

/**
 * Update CMA-ES state given ranked solutions (best first).
 */
export function updateCMAES(
  state: CMAESState,
  rankedSolutions: Float64Array[],
): CMAESState {
  const { mean, sigma, C, pSigma, pC, dim, mu, weights, mueff, cSigma, dSigma, cc, c1, cmu } = state;
  const n = dim;

  // Compute new mean from weighted recombination of top-mu solutions
  const newMean = new Float64Array(n);
  for (let i = 0; i < mu; i++) {
    for (let j = 0; j < n; j++) {
      newMean[j] += weights[i] * rankedSolutions[i][j];
    }
  }

  // Displacement
  const meanShift = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    meanShift[i] = (newMean[i] - mean[i]) / sigma;
  }

  // Update evolution path for sigma
  const chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));
  const newPSigma = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    newPSigma[i] = (1 - cSigma) * pSigma[i] + Math.sqrt(cSigma * (2 - cSigma) * mueff) * meanShift[i];
  }

  // Update sigma
  const pSigmaNorm = Math.sqrt(newPSigma.reduce((a, v) => a + v * v, 0));
  const newSigma = sigma * Math.exp((cSigma / dSigma) * (pSigmaNorm / chiN - 1));
  const clampedSigma = Math.max(0.01, Math.min(newSigma, 2.0));

  // Heaviside function for pC update
  const hsig = pSigmaNorm / Math.sqrt(1 - Math.pow(1 - cSigma, 2 * (state.generation + 1))) < (1.4 + 2 / (n + 1)) * chiN ? 1 : 0;

  // Update evolution path for covariance
  const newPC = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    newPC[i] = (1 - cc) * pC[i] + hsig * Math.sqrt(cc * (2 - cc) * mueff) * meanShift[i];
  }

  // Update covariance matrix
  const newC = new Float64Array(n * n);
  const c1a = c1 * (1 - (1 - hsig * hsig) * cc * (2 - cc));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Rank-one update
      let val = (1 - c1a - cmu) * C[i * n + j] + c1 * newPC[i] * newPC[j];

      // Rank-mu update
      for (let k = 0; k < mu; k++) {
        const di = (rankedSolutions[k][i] - mean[i]) / sigma;
        const dj = (rankedSolutions[k][j] - mean[j]) / sigma;
        val += cmu * weights[k] * di * dj;
      }

      newC[i * n + j] = val;
    }
  }

  return {
    ...state,
    mean: newMean,
    sigma: clampedSigma,
    C: newC,
    pSigma: newPSigma,
    pC: newPC,
    generation: state.generation + 1,
  };
}

/**
 * Expand a reduced-dimension solution (e.g., 16D) to full 64-bin density.
 * Uses cubic interpolation for smooth liquidity curves.
 */
export function expandToFullBins(reduced: Float64Array, targetBins: number = NUM_BINS): Float64Array {
  const bins = new Float64Array(targetBins);
  const dim = reduced.length;
  const step = targetBins / dim;

  for (let i = 0; i < targetBins; i++) {
    const pos = i / step;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const v0 = reduced[Math.max(0, idx - 1)] ?? reduced[0];
    const v1 = reduced[Math.min(idx, dim - 1)];
    const v2 = reduced[Math.min(idx + 1, dim - 1)];
    const v3 = reduced[Math.min(idx + 2, dim - 1)];

    // Catmull-Rom interpolation
    const t = frac;
    const t2 = t * t;
    const t3 = t2 * t;
    bins[i] = Math.max(0,
      0.5 * ((2 * v1) + (-v0 + v2) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 + (-v0 + 3 * v1 - 3 * v2 + v3) * t3)
    );
  }

  normalizeBins(bins);
  return bins;
}

/**
 * Compress full 64-bin density to reduced dimension by averaging segments.
 */
export function compressBins(bins: Float64Array, targetDim: number = 16): Float64Array {
  const reduced = new Float64Array(targetDim);
  const segmentSize = bins.length / targetDim;

  for (let i = 0; i < targetDim; i++) {
    let sum = 0;
    const start = Math.floor(i * segmentSize);
    const end = Math.max(start + 1, Math.floor((i + 1) * segmentSize));
    const clampedEnd = Math.min(end, bins.length);
    for (let j = start; j < clampedEnd; j++) {
      sum += bins[j];
    }
    reduced[i] = sum / Math.max(1, clampedEnd - start);
  }

  return reduced;
}

/**
 * Approximate square root of covariance matrix using diagonal + low-rank approximation.
 * Full eigendecomposition is O(n^3) which is fine for n=16.
 */
function approximateSqrtC(C: Float64Array, n: number): Float64Array {
  // For small n (≤16), use simplified approach: diagonal scaling + cross-terms
  const sqrtC = new Float64Array(n * n);

  // Start with Cholesky decomposition (lower triangular)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = C[i * n + j];
      for (let k = 0; k < j; k++) {
        sum -= sqrtC[i * n + k] * sqrtC[j * n + k];
      }
      if (i === j) {
        sqrtC[i * n + j] = Math.sqrt(Math.max(sum, 1e-10));
      } else {
        sqrtC[i * n + j] = sum / Math.max(sqrtC[j * n + j], 1e-10);
      }
    }
  }

  return sqrtC;
}
