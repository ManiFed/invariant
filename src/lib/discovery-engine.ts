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
  familyId: InvariantFamilyId;
  familyParams: Record<string, number>;
  regime: RegimeId;
  generation: number;
  metrics: MetricVector;
  features: FeatureDescriptor;
  stability: number;        // cross-path variance of lpValueVsHodl
  score: number;            // composite ranking score (lower is better rank)
  timestamp: number;
  source?: "global" | "experiment" | "user-designed";
  poolType?: "two-asset" | "multi-asset";
  assetCount?: number;
  adaptiveProfile?: {
    liquidityResponsiveness: number;
    feeResponsiveness: number;
    shockRecovery: number;
  };
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
  type: "champion-replaced" | "generation-complete" | "convergence-plateau" | "exploration-spike" | "family-frontier-entry" | "family-regime-dominance";
  message: string;
  generation: number;
}

export type InvariantFamilyId = "piecewise-bands" | "amplified-hybrid" | "tail-shielded";

export interface InvariantFamilyDefinition {
  id: InvariantFamilyId;
  label: string;
  parameterRanges: Record<string, { min: number; max: number }>;
  sampleParams: () => Record<string, number>;
  mutateParams: (params: Record<string, number>) => Record<string, number>;
  generateBins: (params: Record<string, number>) => Float64Array;
}

export const INVARIANT_FAMILIES: InvariantFamilyDefinition[] = [
  {
    id: "piecewise-bands",
    label: "Piecewise Bands",
    parameterRanges: { centerMass: { min: 0.2, max: 0.85 }, shoulder: { min: 0.05, max: 0.4 }, skew: { min: -0.45, max: 0.45 } },
    sampleParams: () => ({ centerMass: 0.2 + Math.random() * 0.65, shoulder: 0.05 + Math.random() * 0.35, skew: -0.45 + Math.random() * 0.9 }),
    mutateParams: (params) => ({
      centerMass: Math.min(0.85, Math.max(0.2, params.centerMass + randn() * 0.06)),
      shoulder: Math.min(0.4, Math.max(0.05, params.shoulder + randn() * 0.04)),
      skew: Math.min(0.45, Math.max(-0.45, params.skew + randn() * 0.08)),
    }),
    generateBins: (params) => {
      const bins = new Float64Array(NUM_BINS);
      const center = Math.floor(NUM_BINS / 2 + params.skew * NUM_BINS * 0.22);
      for (let i = 0; i < NUM_BINS; i++) {
        const distance = Math.abs(i - center) / NUM_BINS;
        const core = Math.max(0, params.centerMass - distance * (1 + params.shoulder * 2));
        const shoulder = params.shoulder * Math.exp(-distance * 12);
        bins[i] = Math.max(0, core + shoulder * (0.8 + Math.random() * 0.4));
      }
      normalizeBins(bins);
      return bins;
    }
  },
  {
    id: "amplified-hybrid",
    label: "Amplified Hybrid",
    parameterRanges: { amplification: { min: 1, max: 12 }, decay: { min: 0.8, max: 4 }, bias: { min: -0.35, max: 0.35 } },
    sampleParams: () => ({ amplification: 1 + Math.random() * 11, decay: 0.8 + Math.random() * 3.2, bias: -0.35 + Math.random() * 0.7 }),
    mutateParams: (params) => ({
      amplification: Math.min(12, Math.max(1, params.amplification + randn() * 1.1)),
      decay: Math.min(4, Math.max(0.8, params.decay + randn() * 0.25)),
      bias: Math.min(0.35, Math.max(-0.35, params.bias + randn() * 0.05)),
    }),
    generateBins: (params) => {
      const bins = new Float64Array(NUM_BINS);
      const center = (NUM_BINS - 1) / 2 + params.bias * NUM_BINS * 0.2;
      for (let i = 0; i < NUM_BINS; i++) {
        const x = Math.abs(i - center) / (NUM_BINS / 2);
        bins[i] = 1 / Math.pow(1 + params.decay * x * x, params.amplification / 3);
      }
      normalizeBins(bins);
      return bins;
    }
  },
  {
    id: "tail-shielded",
    label: "Tail Shielded",
    parameterRanges: { tailWeight: { min: 0.05, max: 0.45 }, moatWidth: { min: 0.02, max: 0.25 }, centerBias: { min: 0.2, max: 0.8 } },
    sampleParams: () => ({ tailWeight: 0.05 + Math.random() * 0.4, moatWidth: 0.02 + Math.random() * 0.23, centerBias: 0.2 + Math.random() * 0.6 }),
    mutateParams: (params) => ({
      tailWeight: Math.min(0.45, Math.max(0.05, params.tailWeight + randn() * 0.05)),
      moatWidth: Math.min(0.25, Math.max(0.02, params.moatWidth + randn() * 0.04)),
      centerBias: Math.min(0.8, Math.max(0.2, params.centerBias + randn() * 0.06)),
    }),
    generateBins: (params) => {
      const bins = new Float64Array(NUM_BINS);
      const center = (NUM_BINS - 1) / 2;
      for (let i = 0; i < NUM_BINS; i++) {
        const x = Math.abs(i - center) / (NUM_BINS / 2);
        const moatPenalty = Math.exp(-Math.pow((x - params.moatWidth) * 6, 2));
        const centerMass = params.centerBias * Math.exp(-x * 8);
        const tails = params.tailWeight * Math.pow(x, 1.4);
        bins[i] = Math.max(0, centerMass + tails - moatPenalty * 0.15);
      }
      normalizeBins(bins);
      return bins;
    }
  }
];

/** Full engine state */


export interface MechanismObject {
  id: string;
  label: string;
  origin: "atlas-global" | "atlas-experiment" | "studio";
  familyId: InvariantFamilyId;
  familyParams: Record<string, number>;
  bins: number[];
  poolType: "two-asset" | "multi-asset";
  assetSymbols: string[];
  adaptiveConfig?: {
    volatilitySensitivity: number;
    deviationSensitivity: number;
  };
}

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
export function createRandomCandidate(
  regime: RegimeId,
  generation: number,
  familyId?: InvariantFamilyId
): { bins: Float64Array; familyId: InvariantFamilyId; familyParams: Record<string, number> } {
  const family = familyId
    ? INVARIANT_FAMILIES.find((f) => f.id === familyId) ?? INVARIANT_FAMILIES[0]
    : INVARIANT_FAMILIES[Math.floor(Math.random() * INVARIANT_FAMILIES.length)];
  const familyParams = family.sampleParams();
  const bins = family.generateBins(familyParams);
  return { bins, familyId: family.id, familyParams };
}

export function validateInvariantFamily(candidate: { familyId: InvariantFamilyId; familyParams: Record<string, number>; bins: Float64Array }): boolean {
  const family = INVARIANT_FAMILIES.find((f) => f.id === candidate.familyId);
  if (!family) return false;

  for (const [key, range] of Object.entries(family.parameterRanges)) {
    const value = candidate.familyParams[key];
    if (!Number.isFinite(value) || value < range.min || value > range.max) return false;
  }

  const total = candidate.bins.reduce((acc, value) => acc + value, 0);
  if (total <= 0) return false;

  const left = candidate.bins.slice(0, Math.floor(NUM_BINS / 2)).reduce((acc, value) => acc + value, 0);
  const right = candidate.bins.slice(Math.floor(NUM_BINS / 2)).reduce((acc, value) => acc + value, 0);
  if (Math.abs(left - right) / total > 0.9) return false;

  return true;
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


function computeAdaptiveProfile(bins: Float64Array, params: Record<string, number>): Candidate["adaptiveProfile"] {
  const avg = bins.reduce((acc, v) => acc + v, 0) / bins.length;
  const variance = bins.reduce((acc, v) => acc + (v - avg) ** 2, 0) / bins.length;
  const paramValues = Object.values(params);
  const paramSignal = paramValues.length > 0 ? paramValues.reduce((a, b) => a + Math.abs(b), 0) / paramValues.length : 0;
  return {
    liquidityResponsiveness: Math.min(1, Math.sqrt(variance) / 20),
    feeResponsiveness: Math.min(1, paramSignal / 5),
    shockRecovery: Math.max(0, 1 - Math.min(1, variance / 2000)),
  };
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
      const { bins, familyId, familyParams } = createRandomCandidate(regimeConfig.id, gen);
      if (!validateInvariantFamily({ familyId, familyParams, bins })) continue;
      const { metrics, stability, equityCurve } = evaluateCandidate(bins, regimeConfig, TRAINING_PATHS, EVAL_PATHS);
      const features = computeFeatures(bins);
      const score = scoreCandidate(metrics, stability);
      const candidate: Candidate = {
        id: nextId(), bins, regime: regimeConfig.id, generation: gen,
        familyId,
        familyParams,
        metrics, features, stability, score, timestamp: Date.now(),
        source: "global",
        poolType: "two-asset",
        assetCount: 2,
        adaptiveProfile: computeAdaptiveProfile(bins, familyParams),
      };
      allCandidates.push(candidate);
    }
  } else {
    // Sort current population by score (lower is better)
    const sorted = [...population.candidates].sort((a, b) => a.score - b.score);
    const targetEliteCount = Math.max(2, Math.floor(POPULATION_SIZE * ELITE_FRACTION));
    const elites = sorted.slice(0, targetEliteCount);

    // Safety: if persisted/synced state has too few candidates, bootstrap with randoms
    if (elites.length === 0) {
      for (let i = 0; i < POPULATION_SIZE; i++) {
        const { bins, familyId, familyParams } = createRandomCandidate(regimeConfig.id, gen);
        const { metrics, stability } = evaluateCandidate(bins, regimeConfig, TRAINING_PATHS, EVAL_PATHS);
        const features = computeFeatures(bins);
        const score = scoreCandidate(metrics, stability);
        const candidate: Candidate = {
          id: nextId(), bins, regime: regimeConfig.id, generation: gen,
          familyId,
          familyParams,
          metrics, features, stability, score, timestamp: Date.now(),
          source: "global",
          poolType: "two-asset",
          assetCount: 2,
          adaptiveProfile: computeAdaptiveProfile(bins, familyParams),
        };
        if (validateInvariantFamily(candidate)) allCandidates.push(candidate);
      }
    } else {
      // Generate children from elite parents via mutation
      const numChildren = POPULATION_SIZE - Math.floor(POPULATION_SIZE * EXPLORATION_RATE);
      for (let i = 0; i < numChildren; i++) {
        const parent = elites[i % elites.length];
        const childFamily = INVARIANT_FAMILIES.find((family) => family.id === parent.familyId) ?? INVARIANT_FAMILIES[0];
        const childParams = childFamily.mutateParams(parent.familyParams);
        const childBins = childFamily.generateBins(childParams);
        const { metrics, stability } = evaluateCandidate(childBins, regimeConfig, TRAINING_PATHS, EVAL_PATHS);
        const features = computeFeatures(childBins);
        const score = scoreCandidate(metrics, stability);
        const candidate: Candidate = {
          id: nextId(), bins: childBins, regime: regimeConfig.id, generation: gen,
          familyId: childFamily.id,
          familyParams: childParams,
          metrics, features, stability, score, timestamp: Date.now(),
          source: "global",
          poolType: "two-asset",
          assetCount: 2,
          adaptiveProfile: computeAdaptiveProfile(childBins, childParams),
        };
        if (validateInvariantFamily(candidate)) allCandidates.push(candidate);
      }

      // Inject random exploratory candidates
      const numExplore = POPULATION_SIZE - numChildren;
      for (let i = 0; i < numExplore; i++) {
        const { bins, familyId, familyParams } = createRandomCandidate(regimeConfig.id, gen);
        const { metrics, stability } = evaluateCandidate(bins, regimeConfig, TRAINING_PATHS, EVAL_PATHS);
        const features = computeFeatures(bins);
        const score = scoreCandidate(metrics, stability);
        const candidate: Candidate = {
          id: nextId(), bins, regime: regimeConfig.id, generation: gen,
          familyId,
          familyParams,
          metrics, features, stability, score, timestamp: Date.now(),
          source: "global",
          poolType: "two-asset",
          assetCount: 2,
          adaptiveProfile: computeAdaptiveProfile(bins, familyParams),
        };
        if (validateInvariantFamily(candidate)) allCandidates.push(candidate);
      }
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
    if (population.champion?.familyId && population.champion.familyId !== newChampion.familyId) {
      events.push({
        timestamp: Date.now(), regime: regimeConfig.id,
        type: "family-frontier-entry",
        message: `Family ${newChampion.familyId} entered the top frontier in ${regimeConfig.label}`,
        generation: gen,
      });
    }
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

  const familyWinners = Object.values(newPop.reduce((acc, candidate) => {
    const previous = acc[candidate.familyId];
    if (!previous || candidate.score < previous.score) acc[candidate.familyId] = candidate;
    return acc;
  }, {} as Record<string, Candidate>));
  if (familyWinners.length > 0) {
    const bestFamily = familyWinners.sort((a, b) => a.score - b.score)[0];
    events.push({
      timestamp: Date.now(), regime: regimeConfig.id,
      type: "family-regime-dominance",
      message: `Family ${bestFamily.familyId} currently dominates ${regimeConfig.label}`,
      generation: gen,
    });
  }

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

// ─── Spider Coverage Analysis ────────────────────────────────────────────────

/** Normalized metric values (all in [0,1] where 1 = best) for spider graph */
export interface NormalizedMetrics {
  fees: number;
  utilization: number;
  lpValue: number;
  lowSlippage: number;
  lowArbLeak: number;
  stability: number;
  lowDrawdown: number;
}

export const NORMALIZED_METRIC_LABELS: Record<keyof NormalizedMetrics, string> = {
  fees: "Fee Revenue",
  utilization: "Utilization",
  lpValue: "LP Value",
  lowSlippage: "Low Slippage",
  lowArbLeak: "Low Arb Leak",
  stability: "Stability",
  lowDrawdown: "Low Drawdown",
};

/** Analysis of what worked and what didn't for a candidate */
export interface MetricAnalysis {
  normalized: NormalizedMetrics;
  spiderCoverage: number;     // 0-1, how much of the spider graph is "filled"
  strengths: (keyof NormalizedMetrics)[];
  weaknesses: (keyof NormalizedMetrics)[];
  dominantMetric: keyof NormalizedMetrics;
  weakestMetric: keyof NormalizedMetrics;
}

/** Normalize raw metrics to [0,1] where 1 = best for spider graph display */
export function normalizeMetrics(metrics: MetricVector, stability: number): NormalizedMetrics {
  return {
    fees: Math.min(metrics.totalFees / 50, 1),
    utilization: metrics.liquidityUtilization,
    lpValue: Math.min(metrics.lpValueVsHodl, 1.2) / 1.2,
    lowSlippage: Math.max(0, 1 - metrics.totalSlippage * 10),
    lowArbLeak: Math.max(0, 1 - metrics.arbLeakage / 50),
    stability: Math.max(0, 1 - stability * 5),
    lowDrawdown: Math.max(0, 1 - metrics.maxDrawdown * 5),
  };
}

/** Analyze a candidate's metric profile to identify strengths and weaknesses */
export function analyzeMetricProfile(
  metrics: MetricVector,
  stability: number,
  strengthThreshold = 0.6,
  weaknessThreshold = 0.4,
): MetricAnalysis {
  const normalized = normalizeMetrics(metrics, stability);

  const entries = Object.entries(normalized) as [keyof NormalizedMetrics, number][];
  const strengths = entries.filter(([, v]) => v >= strengthThreshold).map(([k]) => k);
  const weaknesses = entries.filter(([, v]) => v < weaknessThreshold).map(([k]) => k);

  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const dominantMetric = sorted[0][0];
  const weakestMetric = sorted[sorted.length - 1][0];

  // Spider coverage uses geometric mean (penalizes low outliers) blended with minimum
  const values = Object.values(normalized);
  const geoMean = Math.pow(
    values.reduce((p, v) => p * Math.max(v, 0.01), 1),
    1 / values.length,
  );
  const minVal = Math.min(...values);
  const spiderCoverage = geoMean * 0.7 + minVal * 0.3;

  return { normalized, spiderCoverage, strengths, weaknesses, dominantMetric, weakestMetric };
}

/**
 * Targeted mutation that amplifies a candidate's strengths.
 * Preserves the bin patterns responsible for high-scoring metrics while
 * adding small perturbations that keep those metrics strong.
 */
export function mutateAmplifyStrengths(
  parent: Float64Array,
  strengths: (keyof NormalizedMetrics)[],
  intensity: number = 0.08,
): Float64Array {
  const child = new Float64Array(parent);

  for (const strength of strengths) {
    switch (strength) {
      case "utilization": {
        // Sharpen existing concentration peaks (more liquidity where it already is)
        const mean = child.reduce((a, b) => a + b, 0) / NUM_BINS;
        for (let i = 0; i < NUM_BINS; i++) {
          if (child[i] > mean * 1.2) {
            child[i] += intensity * TOTAL_LIQUIDITY / NUM_BINS * 0.5;
          }
        }
        break;
      }
      case "fees": {
        // Slightly broaden high-liquidity regions to catch more trades
        const smoothed = new Float64Array(child);
        for (let i = 1; i < NUM_BINS - 1; i++) {
          smoothed[i] = Math.max(child[i], (child[i - 1] + child[i + 1]) * 0.35);
        }
        for (let i = 0; i < NUM_BINS; i++) {
          child[i] = child[i] * (1 - intensity) + smoothed[i] * intensity;
        }
        break;
      }
      case "lowSlippage": {
        // Further smooth the curve to maintain low slippage
        const s = new Float64Array(child);
        for (let i = 2; i < NUM_BINS - 2; i++) {
          s[i] = (child[i - 2] + child[i - 1] * 2 + child[i] * 4 + child[i + 1] * 2 + child[i + 2]) / 10;
        }
        for (let i = 0; i < NUM_BINS; i++) {
          child[i] = child[i] * (1 - intensity * 0.5) + s[i] * intensity * 0.5;
        }
        break;
      }
      default:
        // Small random perturbation that doesn't disrupt the shape
        for (let i = 0; i < NUM_BINS; i++) {
          child[i] += (Math.random() - 0.5) * intensity * TOTAL_LIQUIDITY / NUM_BINS * 0.1;
          child[i] = Math.max(0, child[i]);
        }
        break;
    }
  }

  for (let i = 0; i < NUM_BINS; i++) child[i] = Math.max(0, child[i]);
  normalizeBins(child);
  return child;
}

/**
 * Targeted mutation to remediate specific weak metrics.
 * Applies structural changes to the bin distribution that directly address
 * the weakest scoring dimensions.
 */
export function mutateRemediateWeaknesses(
  parent: Float64Array,
  weaknesses: (keyof NormalizedMetrics)[],
  intensity: number = 0.15,
): Float64Array {
  const child = new Float64Array(parent);

  for (const weakness of weaknesses) {
    switch (weakness) {
      case "utilization": {
        // Concentrate more liquidity in the active range (center bins)
        const center = NUM_BINS / 2;
        const width = 6 + Math.floor(Math.random() * 10);
        for (let i = 0; i < NUM_BINS; i++) {
          const dist = Math.abs(i - center);
          if (dist < width) {
            child[i] += intensity * TOTAL_LIQUIDITY / NUM_BINS * (1 - dist / width);
          }
        }
        break;
      }
      case "lowSlippage": {
        // Smooth the curve to reduce slippage (abrupt transitions cause slippage)
        const smoothed = new Float64Array(child);
        for (let i = 1; i < NUM_BINS - 1; i++) {
          smoothed[i] = child[i - 1] * 0.25 + child[i] * 0.5 + child[i + 1] * 0.25;
        }
        const blend = 0.3 + Math.random() * 0.2;
        for (let i = 0; i < NUM_BINS; i++) {
          child[i] = child[i] * (1 - blend) + smoothed[i] * blend;
        }
        break;
      }
      case "fees": {
        // Ensure minimum liquidity everywhere so fees can be captured across range
        const minFloor = TOTAL_LIQUIDITY / NUM_BINS * 0.3;
        for (let i = 0; i < NUM_BINS; i++) {
          child[i] = Math.max(child[i], minFloor);
        }
        break;
      }
      case "lowArbLeak": {
        // Tighter concentration around current price reduces arb opportunity
        const mid = NUM_BINS / 2;
        for (let i = 0; i < NUM_BINS; i++) {
          const d = Math.abs(i - mid) / (NUM_BINS / 2);
          child[i] *= 1 - d * 0.3 * intensity;
        }
        break;
      }
      case "stability":
      case "lowDrawdown": {
        // More even distribution reduces drawdown / instability
        const mean = child.reduce((a, b) => a + b, 0) / NUM_BINS;
        for (let i = 0; i < NUM_BINS; i++) {
          child[i] = child[i] * (1 - intensity * 0.3) + mean * intensity * 0.3;
        }
        break;
      }
      case "lpValue": {
        // Concentrate liquidity slightly above center to track upward price moves
        for (let i = 0; i < NUM_BINS; i++) {
          const relPos = i / NUM_BINS;
          const boost = Math.exp(-Math.pow((relPos - 0.55) * 4, 2));
          child[i] += intensity * TOTAL_LIQUIDITY / NUM_BINS * boost;
        }
        break;
      }
    }
  }

  for (let i = 0; i < NUM_BINS; i++) child[i] = Math.max(0, child[i]);
  normalizeBins(child);
  return child;
}

/**
 * Blend the bin patterns from two candidates.
 * Used for cross-branch metric learning: borrow strengths from a metric champion.
 */
export function blendBins(
  base: Float64Array,
  donor: Float64Array,
  ratio: number = 0.3,
): Float64Array {
  const child = new Float64Array(NUM_BINS);
  for (let i = 0; i < NUM_BINS; i++) {
    child[i] = base[i] * (1 - ratio) + donor[i] * ratio;
  }
  normalizeBins(child);
  return child;
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

export interface FamilySummary {
  familyId: InvariantFamilyId;
  count: number;
  avgScore: number;
  avgStability: number;
  avgCurvature: number;
  regimeCoverage: number;
  dominanceFrequency: number;
}

export function computeFamilySummaries(candidates: Candidate[]): FamilySummary[] {
  const grouped = new Map<InvariantFamilyId, Candidate[]>();
  for (const family of INVARIANT_FAMILIES) grouped.set(family.id, []);
  for (const candidate of candidates) grouped.get(candidate.familyId)?.push(candidate);

  const bestByRegime = new Map<RegimeId, Candidate>();
  for (const regime of REGIMES) {
    const top = candidates.filter((candidate) => candidate.regime === regime.id).sort((a, b) => a.score - b.score)[0];
    if (top) bestByRegime.set(regime.id, top);
  }

  return INVARIANT_FAMILIES.map((family) => {
    const items = grouped.get(family.id) ?? [];
    const regimes = new Set(items.map((candidate) => candidate.regime));
    const dominance = Array.from(bestByRegime.values()).filter((candidate) => candidate.familyId === family.id).length;
    return {
      familyId: family.id,
      count: items.length,
      avgScore: items.length ? items.reduce((acc, candidate) => acc + candidate.score, 0) / items.length : Infinity,
      avgStability: items.length ? items.reduce((acc, candidate) => acc + candidate.stability, 0) / items.length : 0,
      avgCurvature: items.length ? items.reduce((acc, candidate) => acc + candidate.features.curvature, 0) / items.length : 0,
      regimeCoverage: items.length ? regimes.size / REGIMES.length : 0,
      dominanceFrequency: REGIMES.length ? dominance / REGIMES.length : 0,
    };
  });
}


export function candidateToMechanism(candidate: Candidate): MechanismObject {
  return {
    id: candidate.id,
    label: `${candidate.familyId} · ${candidate.id}`,
    origin: candidate.source === "experiment" ? "atlas-experiment" : candidate.source === "user-designed" ? "studio" : "atlas-global",
    familyId: candidate.familyId,
    familyParams: candidate.familyParams,
    bins: Array.from(candidate.bins),
    poolType: candidate.poolType ?? "two-asset",
    assetSymbols: (candidate.assetCount ?? 2) > 2 ? ["USDC", "ETH", "BTC"] : ["USDC", "ETH"],
    adaptiveConfig: candidate.adaptiveProfile
      ? {
          volatilitySensitivity: candidate.adaptiveProfile.liquidityResponsiveness,
          deviationSensitivity: candidate.adaptiveProfile.feeResponsiveness,
        }
      : undefined,
  };
}

export function mechanismToCandidate(mechanism: MechanismObject, regime: RegimeId, generation: number): Candidate {
  const bins = new Float64Array(mechanism.bins);
  normalizeBins(bins);
  const regimeConfig = REGIMES.find((value) => value.id === regime) ?? REGIMES[0];
  const { metrics, stability } = evaluateCandidate(bins, regimeConfig, TRAINING_PATHS, EVAL_PATHS);
  const features = computeFeatures(bins);
  return {
    id: mechanism.id,
    bins,
    familyId: mechanism.familyId,
    familyParams: mechanism.familyParams,
    regime,
    generation,
    metrics,
    features,
    stability,
    score: scoreCandidate(metrics, stability),
    timestamp: Date.now(),
    source: mechanism.origin === "studio" ? "user-designed" : mechanism.origin === "atlas-experiment" ? "experiment" : "global",
    poolType: mechanism.poolType,
    assetCount: mechanism.assetSymbols.length,
    adaptiveProfile: mechanism.adaptiveConfig
      ? {
          liquidityResponsiveness: mechanism.adaptiveConfig.volatilitySensitivity,
          feeResponsiveness: mechanism.adaptiveConfig.deviationSensitivity,
          shockRecovery: Math.max(0, 1 - mechanism.adaptiveConfig.deviationSensitivity * 0.6),
        }
      : undefined,
  };
}
