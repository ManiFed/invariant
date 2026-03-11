// Discovery Cron — Runs evolutionary AMM search server-side and publishes best candidates to the library.
// Invoked by pg_cron every 5 minutes. Self-contained engine (no imports from main codebase).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Engine Constants ───────────────────────────────────────────────────────
const NUM_BINS = 64;
const LOG_PRICE_MIN = -2;
const LOG_PRICE_MAX = 2;
const BIN_WIDTH = (LOG_PRICE_MAX - LOG_PRICE_MIN) / NUM_BINS;
const TOTAL_LIQUIDITY = 1000;
const POPULATION_SIZE = 30;
const ELITE_FRACTION = 0.25;
const FEE_RATE = 0.003;
const ARB_THRESHOLD = 0.005;
const FAST_PATH_STEPS = 96;
const DT = 1 / 365;
const GENERATIONS_PER_RUN = 20; // run 20 generations per cron invocation
const MAX_PUBLISH_PER_RUN = 3; // publish at most 3 candidates per run
const MIN_SCORE_TO_PUBLISH = 5.0; // only publish if score below this threshold

type RegimeId = "low-vol" | "high-vol" | "jump-diffusion" | "regime-shift";
type FamilyId = "piecewise-bands" | "amplified-hybrid" | "tail-shielded";

interface RegimeConfig {
  id: RegimeId;
  label: string;
  volatility: number;
  drift: number;
  jumpIntensity: number;
  jumpMean: number;
  jumpStd: number;
}

const REGIMES: RegimeConfig[] = [
  { id: "low-vol", label: "Low Volatility", volatility: 0.3, drift: 0, jumpIntensity: 0, jumpMean: 0, jumpStd: 0 },
  { id: "high-vol", label: "High Volatility", volatility: 1.0, drift: 0, jumpIntensity: 0, jumpMean: 0, jumpStd: 0 },
  { id: "jump-diffusion", label: "Jump Diffusion", volatility: 0.6, drift: 0, jumpIntensity: 5, jumpMean: -0.05, jumpStd: 0.15 },
  { id: "regime-shift", label: "Regime Shift", volatility: 0.3, drift: 0, jumpIntensity: 0, jumpMean: 0, jumpStd: 0 },
];

interface MetricVector {
  totalFees: number;
  totalSlippage: number;
  arbLeakage: number;
  liquidityUtilization: number;
  lpValueVsHodl: number;
  maxDrawdown: number;
  volatilityOfReturns: number;
}

interface FeatureDescriptor {
  curvature: number;
  curvatureGradient: number;
  entropy: number;
  symmetry: number;
  tailDensityRatio: number;
  peakConcentration: number;
  concentrationWidth: number;
}

interface Candidate {
  id: string;
  bins: Float64Array;
  familyId: FamilyId;
  familyParams: Record<string, number>;
  regime: RegimeId;
  generation: number;
  metrics: MetricVector;
  features: FeatureDescriptor;
  stability: number;
  score: number;
  timestamp: number;
}

// ─── Math Utilities ─────────────────────────────────────────────────────────
let _counter = 0;
function nextId(): string { return `cron_${++_counter}_${Date.now().toString(36)}`; }

function randn(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-15))) * Math.cos(2 * Math.PI * u2);
}

function normalizeBins(bins: Float64Array): void {
  let sum = 0;
  for (let i = 0; i < bins.length; i++) sum += bins[i];
  if (sum <= 0) {
    const val = TOTAL_LIQUIDITY / bins.length;
    for (let i = 0; i < bins.length; i++) bins[i] = val;
    return;
  }
  const scale = TOTAL_LIQUIDITY / sum;
  for (let i = 0; i < bins.length; i++) bins[i] *= scale;
}

function binCenter(i: number): number {
  return LOG_PRICE_MIN + (i + 0.5) * BIN_WIDTH;
}

// ─── Family Generators ──────────────────────────────────────────────────────
function sampleFamily(): { familyId: FamilyId; familyParams: Record<string, number>; bins: Float64Array } {
  const families: FamilyId[] = ["piecewise-bands", "amplified-hybrid", "tail-shielded"];
  const familyId = families[Math.floor(Math.random() * families.length)];
  let familyParams: Record<string, number>;
  const bins = new Float64Array(NUM_BINS);

  switch (familyId) {
    case "piecewise-bands": {
      familyParams = {
        centerMass: 0.2 + Math.random() * 0.65,
        shoulder: 0.05 + Math.random() * 0.35,
        skew: -0.45 + Math.random() * 0.9,
      };
      const center = Math.floor(NUM_BINS / 2 + familyParams.skew * NUM_BINS * 0.22);
      for (let i = 0; i < NUM_BINS; i++) {
        const distance = Math.abs(i - center) / NUM_BINS;
        const core = Math.max(0, familyParams.centerMass - distance * (1 + familyParams.shoulder * 2));
        const shoulder = familyParams.shoulder * Math.exp(-distance * 12);
        bins[i] = Math.max(0, core + shoulder * (0.8 + Math.random() * 0.4));
      }
      break;
    }
    case "amplified-hybrid": {
      familyParams = {
        amplification: 1 + Math.random() * 11,
        decay: 0.8 + Math.random() * 3.2,
        bias: -0.35 + Math.random() * 0.7,
      };
      const c = (NUM_BINS - 1) / 2 + familyParams.bias * NUM_BINS * 0.2;
      for (let i = 0; i < NUM_BINS; i++) {
        const x = Math.abs(i - c) / (NUM_BINS / 2);
        bins[i] = 1 / Math.pow(1 + familyParams.decay * x * x, familyParams.amplification / 3);
      }
      break;
    }
    case "tail-shielded": {
      familyParams = {
        tailWeight: 0.05 + Math.random() * 0.4,
        moatWidth: 0.02 + Math.random() * 0.23,
        centerBias: 0.2 + Math.random() * 0.6,
      };
      const c = (NUM_BINS - 1) / 2;
      for (let i = 0; i < NUM_BINS; i++) {
        const x = Math.abs(i - c) / (NUM_BINS / 2);
        const moatPenalty = Math.exp(-Math.pow((x - familyParams.moatWidth) * 6, 2));
        const centerMass = familyParams.centerBias * Math.exp(-x * 8);
        const tails = familyParams.tailWeight * Math.pow(x, 1.4);
        bins[i] = Math.max(0, centerMass + tails - moatPenalty * 0.15);
      }
      break;
    }
  }
  normalizeBins(bins);
  return { familyId, familyParams, bins };
}

function mutateParams(familyId: FamilyId, params: Record<string, number>): Record<string, number> {
  switch (familyId) {
    case "piecewise-bands":
      return {
        centerMass: Math.min(0.85, Math.max(0.2, params.centerMass + randn() * 0.06)),
        shoulder: Math.min(0.4, Math.max(0.05, params.shoulder + randn() * 0.04)),
        skew: Math.min(0.45, Math.max(-0.45, params.skew + randn() * 0.08)),
      };
    case "amplified-hybrid":
      return {
        amplification: Math.min(12, Math.max(1, params.amplification + randn() * 1.1)),
        decay: Math.min(4, Math.max(0.8, params.decay + randn() * 0.25)),
        bias: Math.min(0.35, Math.max(-0.35, params.bias + randn() * 0.05)),
      };
    case "tail-shielded":
      return {
        tailWeight: Math.min(0.45, Math.max(0.05, params.tailWeight + randn() * 0.05)),
        moatWidth: Math.min(0.25, Math.max(0.02, params.moatWidth + randn() * 0.04)),
        centerBias: Math.min(0.8, Math.max(0.2, params.centerBias + randn() * 0.06)),
      };
  }
}

function regenerateBins(familyId: FamilyId, params: Record<string, number>): Float64Array {
  const bins = new Float64Array(NUM_BINS);
  switch (familyId) {
    case "piecewise-bands": {
      const center = Math.floor(NUM_BINS / 2 + params.skew * NUM_BINS * 0.22);
      for (let i = 0; i < NUM_BINS; i++) {
        const d = Math.abs(i - center) / NUM_BINS;
        const core = Math.max(0, params.centerMass - d * (1 + params.shoulder * 2));
        const shoulder = params.shoulder * Math.exp(-d * 12);
        bins[i] = Math.max(0, core + shoulder * (0.8 + Math.random() * 0.4));
      }
      break;
    }
    case "amplified-hybrid": {
      const c = (NUM_BINS - 1) / 2 + params.bias * NUM_BINS * 0.2;
      for (let i = 0; i < NUM_BINS; i++) {
        const x = Math.abs(i - c) / (NUM_BINS / 2);
        bins[i] = 1 / Math.pow(1 + params.decay * x * x, params.amplification / 3);
      }
      break;
    }
    case "tail-shielded": {
      const c = (NUM_BINS - 1) / 2;
      for (let i = 0; i < NUM_BINS; i++) {
        const x = Math.abs(i - c) / (NUM_BINS / 2);
        const moatPenalty = Math.exp(-Math.pow((x - params.moatWidth) * 6, 2));
        const centerMass = params.centerBias * Math.exp(-x * 8);
        const tails = params.tailWeight * Math.pow(x, 1.4);
        bins[i] = Math.max(0, centerMass + tails - moatPenalty * 0.15);
      }
      break;
    }
  }
  normalizeBins(bins);
  return bins;
}

// ─── Mutation ───────────────────────────────────────────────────────────────
function mutateBins(parent: Float64Array, intensity = 0.1): Float64Array {
  const child = new Float64Array(parent);
  const t = Math.random();
  if (t < 0.4) {
    const n = 1 + Math.floor(Math.random() * (NUM_BINS / 4));
    for (let j = 0; j < n; j++) {
      const idx = Math.floor(Math.random() * NUM_BINS);
      child[idx] = Math.max(0, child[idx] + randn() * intensity * TOTAL_LIQUIDITY / NUM_BINS);
    }
  } else if (t < 0.7) {
    const smoothed = new Float64Array(child);
    const r = 1 + Math.floor(Math.random() * 3);
    for (let i = r; i < NUM_BINS - r; i++) {
      let s = 0;
      for (let j = -r; j <= r; j++) s += child[i + j];
      smoothed[i] = s / (2 * r + 1);
    }
    const blend = 0.2 + Math.random() * 0.3;
    for (let i = 0; i < NUM_BINS; i++) child[i] = child[i] * (1 - blend) + smoothed[i] * blend;
  } else {
    const src = Math.floor(Math.random() * (NUM_BINS - 8));
    const dst = Math.floor(Math.random() * (NUM_BINS - 8));
    const w = 4 + Math.floor(Math.random() * 8);
    const amount = intensity * TOTAL_LIQUIDITY * 0.05;
    for (let i = 0; i < w; i++) {
      const si = Math.min(src + i, NUM_BINS - 1);
      const di = Math.min(dst + i, NUM_BINS - 1);
      const transfer = Math.min(child[si] * 0.3, amount / w);
      child[si] = Math.max(0, child[si] - transfer);
      child[di] += transfer;
    }
  }
  for (let i = 0; i < NUM_BINS; i++) child[i] = Math.max(0, child[i]);
  normalizeBins(child);
  return child;
}

// ─── Price Path Generation ──────────────────────────────────────────────────
function generatePricePath(regime: RegimeConfig, steps: number): Float64Array {
  const path = new Float64Array(steps + 1);
  path[0] = 0;
  const isShift = regime.id === "regime-shift";
  const shiftPt = isShift ? Math.floor(steps * (0.3 + Math.random() * 0.4)) : steps + 1;
  let vol = isShift ? 0.3 : regime.volatility;
  let ji = isShift ? 0 : regime.jumpIntensity;
  let jm = regime.jumpMean;
  let js = regime.jumpStd;

  for (let t = 1; t <= steps; t++) {
    if (isShift && t === shiftPt) { vol = 1.0; ji = 5; jm = -0.05; js = 0.15; }
    const diff = (regime.drift - 0.5 * vol * vol) * DT + vol * Math.sqrt(DT) * randn();
    let jump = 0;
    if (ji > 0 && Math.random() < ji * DT) jump = jm + js * randn();
    path[t] = path[t - 1] + diff + jump;
  }
  return path;
}

// ─── Reserve Derivation ─────────────────────────────────────────────────────
function deriveReserves(bins: Float64Array, refLogPrice: number): { reserveX: number; reserveY: number } {
  let rX = 0, rY = 0;
  for (let i = 0; i < NUM_BINS; i++) {
    const lo = LOG_PRICE_MIN + i * BIN_WIDTH;
    const hi = lo + BIN_WIDTH;
    if (hi <= refLogPrice) rY += bins[i];
    else if (lo >= refLogPrice) rX += bins[i];
    else {
      const frac = (refLogPrice - lo) / BIN_WIDTH;
      rY += bins[i] * frac;
      rX += bins[i] * (1 - frac);
    }
  }
  return { reserveX: Math.max(rX, 1e-12), reserveY: Math.max(rY, 1e-12) };
}

// ─── Simulation ─────────────────────────────────────────────────────────────
function priceImpact(bins: Float64Array, refLP: number, tradeSize: number, dir: "buy" | "sell") {
  let remaining = Math.abs(tradeSize);
  let output = 0;
  if (dir === "buy") {
    const start = Math.floor((refLP - LOG_PRICE_MIN) / BIN_WIDTH);
    for (let i = start; i >= 0 && remaining > 0; i--) {
      const consumed = Math.min(bins[i], remaining);
      output += consumed / Math.exp(binCenter(i));
      remaining -= consumed;
    }
  } else {
    const start = Math.floor((refLP - LOG_PRICE_MIN) / BIN_WIDTH);
    for (let i = start; i < NUM_BINS && remaining > 0; i++) {
      const consumed = Math.min(bins[i], remaining);
      output += consumed * Math.exp(binCenter(i));
      remaining -= consumed;
    }
  }
  const ideal = tradeSize / Math.exp(refLP);
  return { output, slippage: ideal > 0 ? Math.min(Math.abs(1 - output / ideal), 1) : 0 };
}

function simulatePath(bins: Float64Array, pricePath: Float64Array, regime: RegimeConfig): MetricVector {
  const workBins = new Float64Array(bins);
  let currentLP = 0, totalFees = 0, totalSlippage = 0, arbLeakage = 0, tradeCount = 0;
  let peakLpVal = TOTAL_LIQUIDITY, maxDD = 0;
  const lpReturns: number[] = [];
  let prevLpVal = TOTAL_LIQUIDITY;
  let hodlValue = TOTAL_LIQUIDITY;

  for (let t = 1; t < pricePath.length; t++) {
    const numTrades = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < numTrades; j++) {
      const size = TOTAL_LIQUIDITY * 0.01 * Math.exp(randn() * 0.5 - 1);
      const dir: "buy" | "sell" = Math.random() < 0.5 ? "buy" : "sell";
      const fee = size * FEE_RATE;
      const { slippage } = priceImpact(workBins, currentLP, size - fee, dir);
      totalFees += fee;
      totalSlippage += slippage * (size - fee);
      tradeCount++;
    }

    // Arb
    const dev = Math.abs(currentLP - pricePath[t]);
    if (dev >= ARB_THRESHOLD) {
      const arbSize = dev * TOTAL_LIQUIDITY * 0.1;
      const fee = arbSize * FEE_RATE;
      const profit = arbSize * dev - fee;
      if (profit > 0) { arbLeakage += profit; totalFees += fee; }
    }
    currentLP = pricePath[t];

    const { reserveX, reserveY } = deriveReserves(workBins, currentLP);
    const price = Math.exp(currentLP);
    const lpVal = reserveX * price + reserveY + totalFees;
    hodlValue = TOTAL_LIQUIDITY * 0.5 * (price + 1);

    peakLpVal = Math.max(peakLpVal, lpVal);
    maxDD = Math.max(maxDD, (peakLpVal - lpVal) / peakLpVal);
    const ret = lpVal / prevLpVal - 1;
    lpReturns.push(ret);
    prevLpVal = lpVal;
  }

  const finalLp = prevLpVal;
  const priceRange = pricePath.reduce((a, v) => ({ min: Math.min(a.min, v), max: Math.max(a.max, v) }), { min: Infinity, max: -Infinity });
  let active = 0;
  for (let i = 0; i < NUM_BINS; i++) {
    const c = binCenter(i);
    if (c >= priceRange.min - BIN_WIDTH && c <= priceRange.max + BIN_WIDTH) active += bins[i];
  }
  const meanRet = lpReturns.reduce((a, b) => a + b, 0) / lpReturns.length;
  const varRet = lpReturns.reduce((a, r) => a + (r - meanRet) ** 2, 0) / lpReturns.length;

  return {
    totalFees,
    totalSlippage: totalSlippage / Math.max(tradeCount, 1),
    arbLeakage,
    liquidityUtilization: active / TOTAL_LIQUIDITY,
    lpValueVsHodl: hodlValue > 0 ? finalLp / hodlValue : 1,
    maxDrawdown: maxDD,
    volatilityOfReturns: Math.sqrt(varRet),
  };
}

function evaluate(bins: Float64Array, regime: RegimeConfig): { metrics: MetricVector; stability: number } {
  const all: MetricVector[] = [];
  for (let p = 0; p < 4; p++) {
    const pp = generatePricePath(regime, FAST_PATH_STEPS);
    all.push(simulatePath(bins, pp, regime));
  }
  const avg: MetricVector = { totalFees: 0, totalSlippage: 0, arbLeakage: 0, liquidityUtilization: 0, lpValueVsHodl: 0, maxDrawdown: 0, volatilityOfReturns: 0 };
  for (const m of all) {
    avg.totalFees += m.totalFees; avg.totalSlippage += m.totalSlippage; avg.arbLeakage += m.arbLeakage;
    avg.liquidityUtilization += m.liquidityUtilization; avg.lpValueVsHodl += m.lpValueVsHodl;
    avg.maxDrawdown += m.maxDrawdown; avg.volatilityOfReturns += m.volatilityOfReturns;
  }
  const n = all.length;
  avg.totalFees /= n; avg.totalSlippage /= n; avg.arbLeakage /= n;
  avg.liquidityUtilization /= n; avg.lpValueVsHodl /= n; avg.maxDrawdown /= n; avg.volatilityOfReturns /= n;
  const lpvh = all.map(m => m.lpValueVsHodl);
  const mean = lpvh.reduce((a, b) => a + b, 0) / n;
  const variance = lpvh.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  return { metrics: avg, stability: Math.sqrt(variance) };
}

function computeFeatures(bins: Float64Array): FeatureDescriptor {
  const n = bins.length;
  const total = bins.reduce((a, b) => a + b, 0);
  const norm = bins.map(b => b / total);
  let curvature = 0;
  const localCurv: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    const d2 = norm[i - 1] - 2 * norm[i] + norm[i + 1];
    curvature += d2 * d2;
    localCurv.push(Math.abs(d2));
  }
  let curvGrad = 0;
  for (let i = 1; i < localCurv.length; i++) curvGrad += Math.abs(localCurv[i] - localCurv[i - 1]);
  let entropy = 0;
  for (let i = 0; i < n; i++) if (norm[i] > 1e-15) entropy -= norm[i] * Math.log2(norm[i]);
  const half = Math.floor(n / 2);
  const left = Array.from(norm.slice(0, half));
  const right = Array.from(norm.slice(n - half)).reverse();
  const mL = left.reduce((a, b) => a + b, 0) / half;
  const mR = right.reduce((a, b) => a + b, 0) / half;
  let cov = 0, vL = 0, vR = 0;
  for (let i = 0; i < half; i++) { cov += (left[i] - mL) * (right[i] - mR); vL += (left[i] - mL) ** 2; vR += (right[i] - mR) ** 2; }
  const symmetry = (vL > 0 && vR > 0) ? cov / (Math.sqrt(vL) * Math.sqrt(vR)) : 0;
  const q1 = Math.floor(n * 0.25), q3 = Math.floor(n * 0.75);
  let tailM = 0, centerM = 0;
  for (let i = 0; i < n; i++) { if (i < q1 || i >= q3) tailM += norm[i]; else centerM += norm[i]; }
  const maxBin = Math.max(...norm);
  const center = (n - 1) / 2;
  let wVar = 0;
  for (let i = 0; i < n; i++) wVar += norm[i] * (i - center) ** 2;
  return {
    curvature, curvatureGradient: curvGrad, entropy, symmetry,
    tailDensityRatio: centerM > 0 ? tailM / centerM : 0,
    peakConcentration: maxBin / (1 / n),
    concentrationWidth: Math.sqrt(wVar) / n,
  };
}

function scoreCandidate(m: MetricVector, stability: number): number {
  return (
    -m.totalFees * 1.6 + m.totalSlippage * 1.0 + m.arbLeakage * 1.3 +
    -m.liquidityUtilization * 2.2 + -(m.lpValueVsHodl - 1) * 4.2 +
    m.maxDrawdown * 1.9 + m.volatilityOfReturns * 0.9 + stability * 1.6
  );
}

// ─── Main Evolution Loop ────────────────────────────────────────────────────
function runEvolution(regime: RegimeConfig, generations: number): Candidate[] {
  let population: Candidate[] = [];

  // Initialize
  for (let i = 0; i < POPULATION_SIZE; i++) {
    const { familyId, familyParams, bins } = sampleFamily();
    const { metrics, stability } = evaluate(bins, regime);
    const features = computeFeatures(bins);
    const score = scoreCandidate(metrics, stability);
    population.push({
      id: nextId(), bins, familyId, familyParams, regime: regime.id,
      generation: 0, metrics, features, stability, score, timestamp: Date.now(),
    });
  }
  population.sort((a, b) => a.score - b.score);

  // Evolve
  for (let g = 1; g <= generations; g++) {
    const eliteCount = Math.max(2, Math.floor(POPULATION_SIZE * ELITE_FRACTION));
    const elites = population.slice(0, eliteCount);
    const children: Candidate[] = [];

    // Mutate from elites
    const numChildren = POPULATION_SIZE - Math.floor(POPULATION_SIZE * 0.2);
    for (let i = 0; i < numChildren; i++) {
      const parent = elites[i % elites.length];
      const childParams = mutateParams(parent.familyId, parent.familyParams);
      const childBins = mutateBins(regenerateBins(parent.familyId, childParams), 0.1);
      const { metrics, stability } = evaluate(childBins, regime);
      const features = computeFeatures(childBins);
      const score = scoreCandidate(metrics, stability);
      children.push({
        id: nextId(), bins: childBins, familyId: parent.familyId, familyParams: childParams,
        regime: regime.id, generation: g, metrics, features, stability, score, timestamp: Date.now(),
      });
    }

    // Random explorers
    const numExplore = POPULATION_SIZE - numChildren;
    for (let i = 0; i < numExplore; i++) {
      const { familyId, familyParams, bins } = sampleFamily();
      const { metrics, stability } = evaluate(bins, regime);
      const features = computeFeatures(bins);
      const score = scoreCandidate(metrics, stability);
      children.push({
        id: nextId(), bins, familyId, familyParams, regime: regime.id,
        generation: g, metrics, features, stability, score, timestamp: Date.now(),
      });
    }

    children.sort((a, b) => a.score - b.score);
    population = children.slice(0, POPULATION_SIZE);
  }

  return population;
}

// ─── Edge Function Handler ──────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Create a run record
  const { data: runData, error: runError } = await supabase
    .from("discovery_cron_runs")
    .insert({ status: "running", generations_run: 0, candidates_evaluated: 0, candidates_published: 0 })
    .select("id")
    .single();

  if (runError) {
    return new Response(JSON.stringify({ error: runError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const runId = runData.id;
  let totalEvaluated = 0;
  let totalPublished = 0;
  let bestScore = Infinity;

  try {
    // Load existing library candidate_ids to avoid duplicates
    const { data: existingLib } = await supabase
      .from("library_amms")
      .select("candidate_id, score")
      .eq("category", "community")
      .order("score", { ascending: true })
      .limit(100);

    const existingScores = new Map<string, number>();
    const existingBestScore = (existingLib ?? []).reduce((best, row) => {
      if (row.candidate_id) existingScores.set(row.candidate_id, row.score ?? Infinity);
      return Math.min(best, row.score ?? Infinity);
    }, Infinity);

    // Run evolution across all regimes
    const allBest: Candidate[] = [];
    const regimeCycle: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion", "regime-shift"];

    for (const regimeId of regimeCycle) {
      const regime = REGIMES.find(r => r.id === regimeId)!;
      const population = runEvolution(regime, GENERATIONS_PER_RUN);
      totalEvaluated += POPULATION_SIZE * (GENERATIONS_PER_RUN + 1);

      // Take top 3 from each regime
      allBest.push(...population.slice(0, 3));
    }

    // Sort all candidates globally by score
    allBest.sort((a, b) => a.score - b.score);
    bestScore = allBest[0]?.score ?? Infinity;

    // Publish the best candidates that beat current library entries
    const toPublish = allBest
      .filter(c => c.score < MIN_SCORE_TO_PUBLISH)
      .filter(c => c.score < existingBestScore * 1.1) // within 10% of best existing or better
      .slice(0, MAX_PUBLISH_PER_RUN);

    for (const candidate of toPublish) {
      // Check if already published
      if (existingScores.has(candidate.id)) continue;

      const regimeLabel = REGIMES.find(r => r.id === candidate.regime)?.label ?? candidate.regime;
      const { error: insertError } = await supabase.from("library_amms").insert({
        name: `Auto-discovered ${candidate.familyId} (${regimeLabel})`,
        description: `Automatically discovered by the Discovery Engine cron job. Score: ${candidate.score.toFixed(4)}, Stability: ${candidate.stability.toFixed(4)}, Generation: ${candidate.generation}. Regime: ${regimeLabel}.`,
        formula: `${candidate.familyId} (gen ${candidate.generation})`,
        author: "Discovery Engine (Auto)",
        category: "community",
        candidate_id: candidate.id,
        regime: candidate.regime,
        generation: candidate.generation,
        family_id: candidate.familyId,
        family_params: candidate.familyParams,
        bins: Array.from(candidate.bins),
        score: candidate.score,
        stability: candidate.stability,
        metrics: candidate.metrics as any,
        features: candidate.features as any,
        params: { wA: 0.5, wB: 0.5, k: 10000 },
        upvotes: 0,
      });

      if (!insertError) totalPublished++;
    }

    // Update run record
    await supabase
      .from("discovery_cron_runs")
      .update({
        finished_at: new Date().toISOString(),
        generations_run: GENERATIONS_PER_RUN * regimeCycle.length,
        candidates_evaluated: totalEvaluated,
        candidates_published: totalPublished,
        best_score: bestScore,
        status: "completed",
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        success: true,
        runId,
        generationsRun: GENERATIONS_PER_RUN * regimeCycle.length,
        candidatesEvaluated: totalEvaluated,
        candidatesPublished: totalPublished,
        bestScore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("discovery_cron_runs")
      .update({ finished_at: new Date().toISOString(), status: "failed", error: errorMsg })
      .eq("id", runId);

    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
