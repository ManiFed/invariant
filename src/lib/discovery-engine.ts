// Discovery Engine — Pure computation library for the Invariant Atlas
// No React dependencies. Handles candidate representation, simulation, and evolutionary search.

// ─── Configuration Constants ────────────────────────────────────────────────

export const NUM_BINS = 64;
export const LOG_PRICE_MIN = -2; // log(price) range: exp(-2) ≈ 0.135
export const LOG_PRICE_MAX = 2;  // log(price) range: exp(2) ≈ 7.389
export const BIN_WIDTH = (LOG_PRICE_MAX - LOG_PRICE_MIN) / NUM_BINS;
export const TOTAL_LIQUIDITY = 1_000; // normalized constant
export const POPULATION_SIZE = 40;
export const ELITE_FRACTION = 0.25;
export const EXPLORATION_RATE = 0.15;
export const FEE_RATE = 0.003; // 30 bps
export const ARB_THRESHOLD = 0.005; // 50 bps deviation triggers arb
export const TRAINING_PATHS = 20;
export const EVAL_PATHS = 10;
export const PATH_STEPS = 200;
export const DT = 1 / 365; // daily steps

// ─── Types ──────────────────────────────────────────────────────────────────

export type RegimeId = "low-vol" | "high-vol" | "jump-diffusion";

export interface RegimeConfig {
  id: RegimeId;
  label: string;
  volatility: number;     // annualized
  drift: number;
  jumpIntensity: number;  // expected jumps per year
  jumpMean: number;       // mean log-jump size
  jumpStd: number;        // std of log-jump size
  meanReversion?: number; // OU pull toward anchor price
  arbResponsiveness?: number; // 0-1 fraction of deviation corrected per arb step
}

export const REGIMES: RegimeConfig[] = [
  { id: "low-vol", label: "Low Volatility GBM", volatility: 0.3, drift: 0, jumpIntensity: 0, jumpMean: 0, jumpStd: 0 },
  { id: "high-vol", label: "High Volatility GBM", volatility: 1.0, drift: 0, jumpIntensity: 0, jumpMean: 0, jumpStd: 0 },
  { id: "jump-diffusion", label: "Jump Diffusion", volatility: 0.6, drift: 0, jumpIntensity: 5, jumpMean: -0.05, jumpStd: 0.15 },
];

/** Multi-dimensional metric vector for a single candidate evaluation */
export interface MetricVector {
  totalFees: number;
  totalSlippage: number;
  arbLeakage: number;
  liquidityUtilization: number;
  lpValueVsHodl: number; // ratio: final LP value / final HODL value
  maxDrawdown: number;
  volatilityOfReturns: number;
}

/** Feature descriptors derived from the liquidity density shape */
export interface FeatureDescriptor {
  curvature: number;       // sum of squared second differences
  curvatureGradient: number; // first derivative of local curvature profile
  entropy: number;         // Shannon entropy of normalized bin weights
  symmetry: number;        // correlation between left and right halves
  tailDensityRatio: number; // ratio of tail bins to center bins
  peakConcentration: number; // max bin weight / mean bin weight
  concentrationWidth: number; // weighted stddev around center bin
}

/** A single AMM candidate */
export interface Candidate {
  id: string;
  bins: Float64Array;       // non-negative bin weights, sums to TOTAL_LIQUIDITY
  regime: RegimeId;
  generation: number;
  metrics: MetricVector;
  features: FeatureDescriptor;
  stability: number;        // cross-path variance of lpValueVsHodl
  score: number;            // composite ranking score (lower is better rank)
  timestamp: number;
  source?: "global" | "experiment";
  contributor?: string;
  experimentId?: string;
  objectiveType?: string;
}

/** Per-metric champion IDs */
export type ChampionMetric = "fees" | "utilization" | "lpValue" | "lowSlippage" | "lowArbLeak" | "lowDrawdown" | "stability";

export const CHAMPION_METRIC_LABELS: Record<ChampionMetric, string> = {
  fees: "Highest Fees",
  utilization: "Best Utilization",
  lpValue: "Best LP/HODL",
  lowSlippage: "Lowest Slippage",
  lowArbLeak: "Lowest Arb Leak",
  lowDrawdown: "Lowest Drawdown",
  stability: "Most Stable",
};

/** Population state for one regime */
export interface PopulationState {
  regime: RegimeId;
  candidates: Candidate[];
  champion: Candidate | null;
  metricChampions: Record<ChampionMetric, Candidate | null>;
  generation: number;
  totalEvaluated: number;
}

/** Activity log entry */
export interface ActivityEntry {
  timestamp: number;
  regime: RegimeId;
  type: "champion-replaced" | "generation-complete" | "convergence-plateau" | "exploration-spike";
  message: string;
  generation: number;
}

/** Full engine state */
export interface EngineState {
  populations: Record<RegimeId, PopulationState>;
  archive: Candidate[];
  activityLog: ActivityEntry[];
  running: boolean;
  totalGenerations: number;
  /** Display hint for followers: the leader's actual archive.length.
   *  Use `state.archiveSize ?? state.archive.length` for display. */
  archiveSize?: number;
}

// ─── Candidate Representation ───────────────────────────────────────────────

let candidateCounter = 0;
function nextId(): string {
  return `c${++candidateCounter}_${Date.now().toString(36)}`;
}

/** Create a random candidate with normalized bin weights */
export function createRandomCandidate(regime: RegimeId, generation: number): { bins: Float64Array } {
  const bins = new Float64Array(NUM_BINS);
  for (let i = 0; i < NUM_BINS; i++) {
    bins[i] = Math.random() * Math.random(); // bias toward lower values for diversity
  }
  normalizeBins(bins);
  return { bins };
}

/** Normalize bin weights to sum to TOTAL_LIQUIDITY */
export function normalizeBins(bins: Float64Array): void {
  let sum = 0;
  for (let i = 0; i < bins.length; i++) sum += bins[i];
  if (sum <= 0) {
    // Fallback: uniform
    const val = TOTAL_LIQUIDITY / bins.length;
    for (let i = 0; i < bins.length; i++) bins[i] = val;
    return;
  }
  const scale = TOTAL_LIQUIDITY / sum;
  for (let i = 0; i < bins.length; i++) bins[i] *= scale;
}

/** Get the log-price center of bin i */
export function binCenter(i: number): number {
  return LOG_PRICE_MIN + (i + 0.5) * BIN_WIDTH;
}

/** Get the actual price at bin center */
export function binPrice(i: number): number {
  return Math.exp(binCenter(i));
}

// ─── Reserve Derivation ─────────────────────────────────────────────────────

/**
 * From a liquidity density, derive implied reserves at a given reference price.
 * Liquidity in bins below the current price contributes to Y reserves.
 * Liquidity in bins above contributes to X reserves.
 * The bin containing the current price splits proportionally.
 */
export function deriveReserves(bins: Float64Array, refLogPrice: number): { reserveX: number; reserveY: number } {
  let reserveX = 0;
  let reserveY = 0;
  for (let i = 0; i < NUM_BINS; i++) {
    const center = binCenter(i);
    const lo = LOG_PRICE_MIN + i * BIN_WIDTH;
    const hi = lo + BIN_WIDTH;
    if (hi <= refLogPrice) {
      // Entire bin below price → Y reserve
      reserveY += bins[i];
    } else if (lo >= refLogPrice) {
      // Entire bin above price → X reserve
      reserveX += bins[i];
    } else {
      // Split bin
      const frac = (refLogPrice - lo) / BIN_WIDTH;
      reserveY += bins[i] * frac;
      reserveX += bins[i] * (1 - frac);
    }
  }
  return { reserveX: Math.max(reserveX, 1e-12), reserveY: Math.max(reserveY, 1e-12) };
}

/**
 * Price impact for a given trade size at a reference price.
 * Uses the local liquidity density to compute slippage.
 */
export function priceImpact(bins: Float64Array, refLogPrice: number, tradeSize: number, direction: "buy" | "sell"): { output: number; slippage: number; newLogPrice: number } {
  // Find the bin containing the current price
  let remaining = Math.abs(tradeSize);
  let output = 0;
  let currentLogPrice = refLogPrice;

  if (direction === "buy") {
    // Buying Y: consuming Y reserves from bins near and below price, pushing price up
    const startBin = Math.floor((currentLogPrice - LOG_PRICE_MIN) / BIN_WIDTH);
    for (let i = startBin; i >= 0 && remaining > 0; i--) {
      const available = bins[i];
      const consumed = Math.min(available, remaining);
      const price = Math.exp(binCenter(i));
      output += consumed / price;
      remaining -= consumed;
      currentLogPrice = binCenter(i) + BIN_WIDTH * 0.5;
    }
  } else {
    // Selling Y: consuming X reserves from bins near and above price, pushing price down
    const startBin = Math.floor((currentLogPrice - LOG_PRICE_MIN) / BIN_WIDTH);
    for (let i = startBin; i < NUM_BINS && remaining > 0; i++) {
      const available = bins[i];
      const consumed = Math.min(available, remaining);
      const price = Math.exp(binCenter(i));
      output += consumed * price;
      remaining -= consumed;
      currentLogPrice = binCenter(i) - BIN_WIDTH * 0.5;
    }
  }

  const idealOutput = tradeSize / Math.exp(refLogPrice);
  const slippage = idealOutput > 0 ? Math.abs(1 - output / idealOutput) : 0;
  return { output, slippage: Math.min(slippage, 1), newLogPrice: currentLogPrice };
}

// ─── Stochastic Price Processes ─────────────────────────────────────────────

/** Standard normal via Box-Muller */
function randn(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-15))) * Math.cos(2 * Math.PI * u2);
}

/** Generate a price path under a given regime */
export function generatePricePath(regime: RegimeConfig, steps: number, dt: number): Float64Array {
  const path = new Float64Array(steps + 1);
  path[0] = 0; // log-price starts at 0 (price = 1.0)
  const { volatility, drift, jumpIntensity, jumpMean, jumpStd } = regime;
  const meanReversion = regime.meanReversion ?? 0;
  const anchor = 0;

  for (let t = 1; t <= steps; t++) {
    const diffusion = (drift - 0.5 * volatility * volatility) * dt + volatility * Math.sqrt(dt) * randn();

    // Poisson jump component
    let jumpComponent = 0;
    if (jumpIntensity > 0) {
      const lambda = jumpIntensity * dt;
      // Simple Poisson: probability of at least one jump
      if (Math.random() < lambda) {
        jumpComponent = jumpMean + jumpStd * randn();
      }
    }

    const reversion = meanReversion * (anchor - path[t - 1]) * dt;
    path[t] = path[t - 1] + diffusion + jumpComponent + reversion;
  }
  return path;
}

// ─── Simulation Engine ──────────────────────────────────────────────────────

interface SimState {
  bins: Float64Array; // working copy of bins (modified by trades)
  currentLogPrice: number;
  totalFees: number;
  totalSlippage: number;
  arbLeakage: number;
  tradeCount: number;
  lpValueHistory: number[];
}

/** Initialize simulation state from candidate bins */
function initSimState(bins: Float64Array): SimState {
  const workingBins = new Float64Array(bins);
  return {
    bins: workingBins,
    currentLogPrice: 0,
    totalFees: 0,
    totalSlippage: 0,
    arbLeakage: 0,
    tradeCount: 0,
    lpValueHistory: [TOTAL_LIQUIDITY],
  };
}

/** Execute a random trade on the AMM */
function executeRandomTrade(state: SimState): void {
  // Trade size from log-normal distribution (mean ~1% of liquidity)
  const sizeMultiplier = Math.exp(randn() * 0.5 - 1);
  const tradeSize = TOTAL_LIQUIDITY * 0.01 * sizeMultiplier;
  const direction: "buy" | "sell" = Math.random() < 0.5 ? "buy" : "sell";

  const fee = tradeSize * FEE_RATE;
  const effectiveSize = tradeSize - fee;

  const { slippage } = priceImpact(state.bins, state.currentLogPrice, effectiveSize, direction);

  state.totalFees += fee;
  state.totalSlippage += slippage * effectiveSize;
  state.tradeCount++;
}

/** Execute arbitrage step: realign AMM price to external reference */
function executeArbitrage(state: SimState, externalLogPrice: number, regime?: RegimeConfig): void {
  const deviation = Math.abs(state.currentLogPrice - externalLogPrice);
  if (deviation < ARB_THRESHOLD) return;
  const arbResponsiveness = Math.min(Math.max(regime?.arbResponsiveness ?? 1, 0.05), 1);

  // Compute the optimal arb trade size to close the gap
  const arbSize = deviation * TOTAL_LIQUIDITY * 0.1;
  const fee = arbSize * FEE_RATE;
  const arbProfit = arbSize * deviation - fee;

  if (arbProfit > 0) {
    state.arbLeakage += arbProfit;
    state.totalFees += fee;
    const correction = (externalLogPrice - state.currentLogPrice) * arbResponsiveness;
    state.currentLogPrice += correction;
  }
}

/** Compute LP value at current state */
function computeLpValue(state: SimState, externalLogPrice: number): number {
  const { reserveX, reserveY } = deriveReserves(state.bins, externalLogPrice);
  const price = Math.exp(externalLogPrice);
  return reserveX * price + reserveY + state.totalFees;
}

/** Run a single simulation path and return metrics */
function simulatePath(bins: Float64Array, pricePath: Float64Array, regime?: RegimeConfig): MetricVector {
  const state = initSimState(bins);
  let hodlValue = TOTAL_LIQUIDITY;
  let peakLpValue = TOTAL_LIQUIDITY;
  let maxDrawdown = 0;
  const lpReturns: number[] = [];
  let prevLpValue = TOTAL_LIQUIDITY;

  for (let t = 1; t < pricePath.length; t++) {
    // Random trader flow (1-3 trades per step)
    const numTrades = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < numTrades; j++) {
      executeRandomTrade(state);
    }

    // Arbitrage correction
    executeArbitrage(state, pricePath[t], regime);
    state.currentLogPrice = pricePath[t];

    // Track values
    const lpVal = computeLpValue(state, pricePath[t]);
    const priceRatio = Math.exp(pricePath[t]);
    hodlValue = TOTAL_LIQUIDITY * 0.5 * (priceRatio + 1); // 50/50 initial

    state.lpValueHistory.push(lpVal);
    peakLpValue = Math.max(peakLpValue, lpVal);
    const dd = (peakLpValue - lpVal) / peakLpValue;
    maxDrawdown = Math.max(maxDrawdown, dd);

    const ret = lpVal / prevLpValue - 1;
    lpReturns.push(ret);
    prevLpValue = lpVal;
  }

  const finalLpValue = state.lpValueHistory[state.lpValueHistory.length - 1];

  // Utilization: fraction of bins that were "active" (near the price path range)
  const priceRange = pricePath.reduce((acc, v) => ({ min: Math.min(acc.min, v), max: Math.max(acc.max, v) }), { min: Infinity, max: -Infinity });
  let activeLiquidity = 0;
  for (let i = 0; i < NUM_BINS; i++) {
    const center = binCenter(i);
    if (center >= priceRange.min - BIN_WIDTH && center <= priceRange.max + BIN_WIDTH) {
      activeLiquidity += bins[i];
    }
  }
  const utilization = activeLiquidity / TOTAL_LIQUIDITY;

  // Volatility of returns
  const meanRet = lpReturns.reduce((a, b) => a + b, 0) / lpReturns.length;
  const varRet = lpReturns.reduce((a, r) => a + (r - meanRet) ** 2, 0) / lpReturns.length;

  return {
    totalFees: state.totalFees,
    totalSlippage: state.totalSlippage / Math.max(state.tradeCount, 1),
    arbLeakage: state.arbLeakage,
    liquidityUtilization: utilization,
    lpValueVsHodl: hodlValue > 0 ? finalLpValue / hodlValue : 1,
    maxDrawdown,
    volatilityOfReturns: Math.sqrt(varRet),
  };
}

/** Evaluate a candidate across multiple paths, return averaged metrics + stability */
export function evaluateCandidate(
  bins: Float64Array,
  regime: RegimeConfig,
  numTrainPaths: number,
  numEvalPaths: number
): { metrics: MetricVector; stability: number; equityCurve: number[] } {
  const allMetrics: MetricVector[] = [];

  // Training paths
  for (let p = 0; p < numTrainPaths; p++) {
    const pricePath = generatePricePath(regime, PATH_STEPS, DT);
    allMetrics.push(simulatePath(bins, pricePath, regime));
  }

  // Evaluation paths (separate for overfitting prevention)
  const evalMetrics: MetricVector[] = [];
  for (let p = 0; p < numEvalPaths; p++) {
    const pricePath = generatePricePath(regime, PATH_STEPS, DT);
    const m = simulatePath(bins, pricePath, regime);
    allMetrics.push(m);
    evalMetrics.push(m);
  }

  // Average metrics from eval paths
  const avg: MetricVector = {
    totalFees: 0, totalSlippage: 0, arbLeakage: 0,
    liquidityUtilization: 0, lpValueVsHodl: 0, maxDrawdown: 0, volatilityOfReturns: 0,
  };
  for (const m of evalMetrics) {
    avg.totalFees += m.totalFees;
    avg.totalSlippage += m.totalSlippage;
    avg.arbLeakage += m.arbLeakage;
    avg.liquidityUtilization += m.liquidityUtilization;
    avg.lpValueVsHodl += m.lpValueVsHodl;
    avg.maxDrawdown += m.maxDrawdown;
    avg.volatilityOfReturns += m.volatilityOfReturns;
  }
  const n = evalMetrics.length;
  avg.totalFees /= n;
  avg.totalSlippage /= n;
  avg.arbLeakage /= n;
  avg.liquidityUtilization /= n;
  avg.lpValueVsHodl /= n;
  avg.maxDrawdown /= n;
  avg.volatilityOfReturns /= n;

  // Stability: variance of lpValueVsHodl across all paths
  const allLpvh = allMetrics.map(m => m.lpValueVsHodl);
  const meanLpvh = allLpvh.reduce((a, b) => a + b, 0) / allLpvh.length;
  const varLpvh = allLpvh.reduce((a, v) => a + (v - meanLpvh) ** 2, 0) / allLpvh.length;

  // Simple equity curve from last eval path (normalized)
  const lastPath = generatePricePath(regime, PATH_STEPS, DT);
  const simState = initSimState(new Float64Array(bins));
  const equity: number[] = [1];
  for (let t = 1; t < lastPath.length; t++) {
    const numTrades = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < numTrades; j++) executeRandomTrade(simState);
    executeArbitrage(simState, lastPath[t], regime);
    simState.currentLogPrice = lastPath[t];
    equity.push(computeLpValue(simState, lastPath[t]) / TOTAL_LIQUIDITY);
  }

  return { metrics: avg, stability: Math.sqrt(varLpvh), equityCurve: equity };
}

// ─── Feature Descriptors ────────────────────────────────────────────────────

export function computeFeatures(bins: Float64Array): FeatureDescriptor {
  const n = bins.length;
  const total = bins.reduce((a, b) => a + b, 0);
  const norm = bins.map(b => b / total); // normalized to probability

  // Curvature: sum of squared second differences
  let curvature = 0;
  const localCurvature: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    const d2 = norm[i - 1] - 2 * norm[i] + norm[i + 1];
    curvature += d2 * d2;
    localCurvature.push(Math.abs(d2));
  }

  let curvatureGradient = 0;
  for (let i = 1; i < localCurvature.length; i++) {
    curvatureGradient += Math.abs(localCurvature[i] - localCurvature[i - 1]);
  }

  // Shannon entropy
  let entropy = 0;
  for (let i = 0; i < n; i++) {
    if (norm[i] > 1e-15) {
      entropy -= norm[i] * Math.log2(norm[i]);
    }
  }

  // Symmetry: Pearson correlation between left and right halves
  const half = Math.floor(n / 2);
  const left = Array.from(norm.slice(0, half));
  const right = Array.from(norm.slice(n - half)).reverse();
  const meanL = left.reduce((a, b) => a + b, 0) / half;
  const meanR = right.reduce((a, b) => a + b, 0) / half;
  let covLR = 0, varL = 0, varR = 0;
  for (let i = 0; i < half; i++) {
    covLR += (left[i] - meanL) * (right[i] - meanR);
    varL += (left[i] - meanL) ** 2;
    varR += (right[i] - meanR) ** 2;
  }
  const symmetry = (varL > 0 && varR > 0) ? covLR / (Math.sqrt(varL) * Math.sqrt(varR)) : 0;

  // Tail density ratio: outer 25% vs inner 50%
  const q1 = Math.floor(n * 0.25);
  const q3 = Math.floor(n * 0.75);
  let tailMass = 0, centerMass = 0;
  for (let i = 0; i < n; i++) {
    if (i < q1 || i >= q3) tailMass += norm[i];
    else centerMass += norm[i];
  }
  const tailDensityRatio = centerMass > 0 ? tailMass / centerMass : 0;

  // Peak concentration
  const maxBin = Math.max(...norm);
  const meanBin = 1 / n;
  const peakConcentration = maxBin / meanBin;

  const center = (n - 1) / 2;
  let weightedVariance = 0;
  for (let i = 0; i < n; i++) {
    weightedVariance += norm[i] * (i - center) ** 2;
  }
  const concentrationWidth = Math.sqrt(weightedVariance) / n;

  return { curvature, curvatureGradient, entropy, symmetry, tailDensityRatio, peakConcentration, concentrationWidth };
}

// ─── Scoring ────────────────────────────────────────────────────────────────

/** Compute a composite score from metrics. Lower is better.
 *  This is a multi-objective ranking, NOT a single opaque score.
 *  We standardize each axis within the population and sum ranks. */
export function scoreCandidate(metrics: MetricVector, stability: number): number {
  // Objectives (higher is better → negate for rank):
  // +fees, +utilization, +lpValueVsHodl
  // Objectives (lower is better):
  // +slippage, +arbLeakage, +maxDrawdown, +volatility, +stability

  const score =
    -metrics.totalFees * 2 +          // maximize fees
    metrics.totalSlippage * 1 +        // minimize slippage
    metrics.arbLeakage * 1.5 +         // minimize arb leakage
    -metrics.liquidityUtilization * 3 + // maximize utilization
    -(metrics.lpValueVsHodl - 1) * 5 + // maximize LP value vs HODL
    metrics.maxDrawdown * 2 +           // minimize drawdown
    metrics.volatilityOfReturns * 1 +   // minimize vol of returns
    stability * 2;                      // minimize instability

  return score;
}

// ─── Evolutionary Operators ─────────────────────────────────────────────────

/** Mutate a candidate's bins via local perturbation */
export function mutateBins(parent: Float64Array, intensity: number = 0.1): Float64Array {
  const child = new Float64Array(parent);
  const mutationType = Math.random();

  if (mutationType < 0.4) {
    // Local perturbation: add noise to random subset of bins
    const numMutated = 1 + Math.floor(Math.random() * (NUM_BINS / 4));
    for (let j = 0; j < numMutated; j++) {
      const idx = Math.floor(Math.random() * NUM_BINS);
      child[idx] = Math.max(0, child[idx] + randn() * intensity * TOTAL_LIQUIDITY / NUM_BINS);
    }
  } else if (mutationType < 0.7) {
    // Smoothing: apply a local average filter
    const smoothed = new Float64Array(child);
    const radius = 1 + Math.floor(Math.random() * 3);
    for (let i = radius; i < NUM_BINS - radius; i++) {
      let sum = 0;
      for (let j = -radius; j <= radius; j++) sum += child[i + j];
      smoothed[i] = sum / (2 * radius + 1);
    }
    // Blend: partially apply smoothing
    const blend = 0.2 + Math.random() * 0.3;
    for (let i = 0; i < NUM_BINS; i++) {
      child[i] = child[i] * (1 - blend) + smoothed[i] * blend;
    }
  } else {
    // Redistribution: move mass from one region to another
    const srcStart = Math.floor(Math.random() * (NUM_BINS - 8));
    const dstStart = Math.floor(Math.random() * (NUM_BINS - 8));
    const width = 4 + Math.floor(Math.random() * 8);
    const amount = intensity * TOTAL_LIQUIDITY * 0.05;
    for (let i = 0; i < width; i++) {
      const si = Math.min(srcStart + i, NUM_BINS - 1);
      const di = Math.min(dstStart + i, NUM_BINS - 1);
      const transfer = Math.min(child[si] * 0.3, amount / width);
      child[si] = Math.max(0, child[si] - transfer);
      child[di] += transfer;
    }
  }

  // Ensure non-negative
  for (let i = 0; i < NUM_BINS; i++) {
    child[i] = Math.max(0, child[i]);
  }
  normalizeBins(child);
  return child;
}

// ─── Single Generation Step ─────────────────────────────────────────────────

/** Run one generation of the evolutionary search for a single regime */
export function runGeneration(
  population: PopulationState,
  regimeConfig: RegimeConfig
): { newPopulation: PopulationState; newCandidates: Candidate[]; events: ActivityEntry[] } {
  const events: ActivityEntry[] = [];
  const gen = population.generation + 1;
  const allCandidates: Candidate[] = [];

  // If first generation, create initial population
  if (population.candidates.length === 0) {
    for (let i = 0; i < POPULATION_SIZE; i++) {
      const { bins } = createRandomCandidate(regimeConfig.id, gen);
      const { metrics, stability, equityCurve } = evaluateCandidate(bins, regimeConfig, TRAINING_PATHS, EVAL_PATHS);
      const features = computeFeatures(bins);
      const score = scoreCandidate(metrics, stability);
      const candidate: Candidate = {
        id: nextId(), bins, regime: regimeConfig.id, generation: gen,
        metrics, features, stability, score, timestamp: Date.now(),
      };
      allCandidates.push(candidate);
    }
  } else {
    // Sort current population by score (lower is better)
    const sorted = [...population.candidates].sort((a, b) => a.score - b.score);
    const eliteCount = Math.max(2, Math.floor(POPULATION_SIZE * ELITE_FRACTION));
    const elites = sorted.slice(0, eliteCount);

    // Generate children from elite parents via mutation
    const numChildren = POPULATION_SIZE - Math.floor(POPULATION_SIZE * EXPLORATION_RATE);
    for (let i = 0; i < numChildren; i++) {
      const parent = elites[i % eliteCount];
      const childBins = mutateBins(parent.bins, 0.1 + 0.05 * Math.random());
      const { metrics, stability } = evaluateCandidate(childBins, regimeConfig, TRAINING_PATHS, EVAL_PATHS);
      const features = computeFeatures(childBins);
      const score = scoreCandidate(metrics, stability);
      const candidate: Candidate = {
        id: nextId(), bins: childBins, regime: regimeConfig.id, generation: gen,
        metrics, features, stability, score, timestamp: Date.now(),
      };
      allCandidates.push(candidate);
    }

    // Inject random exploratory candidates
    const numExplore = POPULATION_SIZE - numChildren;
    for (let i = 0; i < numExplore; i++) {
      const { bins } = createRandomCandidate(regimeConfig.id, gen);
      const { metrics, stability } = evaluateCandidate(bins, regimeConfig, TRAINING_PATHS, EVAL_PATHS);
      const features = computeFeatures(bins);
      const score = scoreCandidate(metrics, stability);
      const candidate: Candidate = {
        id: nextId(), bins, regime: regimeConfig.id, generation: gen,
        metrics, features, stability, score, timestamp: Date.now(),
      };
      allCandidates.push(candidate);
    }
  }

  // Select the new population (best POPULATION_SIZE)
  allCandidates.sort((a, b) => a.score - b.score);
  const newPop = allCandidates.slice(0, POPULATION_SIZE);
  const newChampion = newPop[0];

  // Compute per-metric champions from the full candidate set
  const metricChampions = computeMetricChampions(allCandidates, population.metricChampions);

  // Check for champion replacement
  const prevChampionScore = population.champion?.score ?? Infinity;
  if (newChampion.score < prevChampionScore) {
    events.push({
      timestamp: Date.now(), regime: regimeConfig.id,
      type: "champion-replaced",
      message: `New champion in ${regimeConfig.label}: score ${newChampion.score.toFixed(3)} (prev: ${prevChampionScore === Infinity ? "none" : prevChampionScore.toFixed(3)})`,
      generation: gen,
    });
  }

  // Check for convergence plateau
  if (population.champion && Math.abs(newChampion.score - prevChampionScore) < 0.001) {
    events.push({
      timestamp: Date.now(), regime: regimeConfig.id,
      type: "convergence-plateau",
      message: `Convergence plateau in ${regimeConfig.label}: score unchanged at ${newChampion.score.toFixed(3)}`,
      generation: gen,
    });
  }

  events.push({
    timestamp: Date.now(), regime: regimeConfig.id,
    type: "generation-complete",
    message: `Generation ${gen} complete for ${regimeConfig.label}: ${allCandidates.length} candidates evaluated`,
    generation: gen,
  });

  // Only archive top 5% of candidates (by score) to save memory
  const archiveCount = Math.max(2, Math.ceil(allCandidates.length * 0.05));
  const topCandidates = allCandidates.slice(0, archiveCount);

  return {
    newPopulation: {
      regime: regimeConfig.id,
      candidates: newPop,
      champion: newChampion,
      metricChampions,
      generation: gen,
      totalEvaluated: population.totalEvaluated + allCandidates.length,
    },
    newCandidates: topCandidates,
    events,
  };
}

/** Compute per-metric champions, keeping the best across all time */
function computeMetricChampions(
  candidates: Candidate[],
  prev: Record<ChampionMetric, Candidate | null>
): Record<ChampionMetric, Candidate | null> {
  function best(
    current: Candidate | null,
    pool: Candidate[],
    key: (c: Candidate) => number,
    lower: boolean
  ): Candidate | null {
    let champ = current;
    for (const c of pool) {
      if (!champ) { champ = c; continue; }
      const val = key(c);
      const champVal = key(champ);
      if (lower ? val < champVal : val > champVal) champ = c;
    }
    return champ;
  }

  return {
    fees: best(prev.fees, candidates, c => c.metrics.totalFees, false),
    utilization: best(prev.utilization, candidates, c => c.metrics.liquidityUtilization, false),
    lpValue: best(prev.lpValue, candidates, c => c.metrics.lpValueVsHodl, false),
    lowSlippage: best(prev.lowSlippage, candidates, c => c.metrics.totalSlippage, true),
    lowArbLeak: best(prev.lowArbLeak, candidates, c => c.metrics.arbLeakage, true),
    lowDrawdown: best(prev.lowDrawdown, candidates, c => c.metrics.maxDrawdown, true),
    stability: best(prev.stability, candidates, c => c.stability, true),
  };
}

// ─── 2D Embedding (simple PCA-like projection) ─────────────────────────────

/**
 * Project candidates into 2D using their feature descriptors.
 * Uses a simple linear projection for stability and speed.
 */
export function embedCandidates(candidates: Candidate[]): { x: number; y: number; id: string }[] {
  if (candidates.length === 0) return [];

  // Extract feature matrix
  const features = candidates.map(c => [
    c.features.curvature,
    c.features.curvatureGradient,
    c.features.entropy,
    c.features.symmetry,
    c.features.tailDensityRatio,
    c.features.peakConcentration,
    c.features.concentrationWidth,
  ]);

  // Normalize each feature to [0, 1]
  const dims = features[0].length;
  const mins = new Array(dims).fill(Infinity);
  const maxs = new Array(dims).fill(-Infinity);
  for (const f of features) {
    for (let d = 0; d < dims; d++) {
      mins[d] = Math.min(mins[d], f[d]);
      maxs[d] = Math.max(maxs[d], f[d]);
    }
  }
  const normalized = features.map(f =>
    f.map((v, d) => maxs[d] > mins[d] ? (v - mins[d]) / (maxs[d] - mins[d]) : 0.5)
  );

  // Project onto two axes using fixed weights for interpretability:
  // X axis ≈ "concentration" (curvature + peakConcentration - entropy)
  // Y axis ≈ "asymmetry" (tailDensityRatio + (1-symmetry))
  return normalized.map((f, i) => ({
    x: f[0] * 0.25 + f[5] * 0.35 + f[6] * 0.2 - f[2] * 0.2,
    y: f[4] * 0.45 + (1 - f[3]) * 0.35 + f[1] * 0.2,
    id: candidates[i].id,
  }));
}

// ─── Coverage Statistics ────────────────────────────────────────────────────

/**
 * Compute coverage of the parameter space.
 * Divides the feature space into grid cells and counts occupancy.
 */
export function computeCoverage(candidates: Candidate[], gridSize: number = 10): {
  coverage: number;
  densityMap: number[][];
  totalCells: number;
  occupiedCells: number;
} {
  const density: number[][] = Array.from({ length: gridSize }, () => new Array(gridSize).fill(0));
  const embedded = embedCandidates(candidates);

  for (const pt of embedded) {
    const gx = Math.min(Math.floor(pt.x * gridSize), gridSize - 1);
    const gy = Math.min(Math.floor(pt.y * gridSize), gridSize - 1);
    if (gx >= 0 && gy >= 0) {
      density[gy][gx]++;
    }
  }

  let occupied = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (density[y][x] > 0) occupied++;
    }
  }

  return {
    coverage: occupied / (gridSize * gridSize),
    densityMap: density,
    totalCells: gridSize * gridSize,
    occupiedCells: occupied,
  };
}

// ─── Price Impact Curve Generation ──────────────────────────────────────────

export function generatePriceImpactCurve(bins: Float64Array, numPoints: number = 40): { tradeSize: number; impact: number }[] {
  const points: { tradeSize: number; impact: number }[] = [];
  for (let i = 0; i < numPoints; i++) {
    const size = TOTAL_LIQUIDITY * 0.001 * (i + 1);
    const { slippage } = priceImpact(bins, 0, size, "buy");
    points.push({ tradeSize: size, impact: slippage * 100 });
  }
  return points;
}

// ─── Initialize Engine State ────────────────────────────────────────────────

const EMPTY_METRIC_CHAMPIONS: Record<ChampionMetric, Candidate | null> = {
  fees: null, utilization: null, lpValue: null, lowSlippage: null,
  lowArbLeak: null, lowDrawdown: null, stability: null,
};

export function createInitialState(): EngineState {
  const populations: Record<RegimeId, PopulationState> = {
    "low-vol": { regime: "low-vol", candidates: [], champion: null, metricChampions: { ...EMPTY_METRIC_CHAMPIONS }, generation: 0, totalEvaluated: 0 },
    "high-vol": { regime: "high-vol", candidates: [], champion: null, metricChampions: { ...EMPTY_METRIC_CHAMPIONS }, generation: 0, totalEvaluated: 0 },
    "jump-diffusion": { regime: "jump-diffusion", candidates: [], champion: null, metricChampions: { ...EMPTY_METRIC_CHAMPIONS }, generation: 0, totalEvaluated: 0 },
  };
  return { populations, archive: [], activityLog: [], running: false, totalGenerations: 0 };
}
