// Atlas Engine — Supabase Edge Function
// Runs one generation of the evolutionary search and stores top candidates in the database.
// Called periodically by a cron job or by clients to advance the search.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

// ─── Discovery Engine (self-contained, no React) ────────────────────────────

const NUM_BINS = 64;
const LOG_PRICE_MIN = -2;
const LOG_PRICE_MAX = 2;
const BIN_WIDTH = (LOG_PRICE_MAX - LOG_PRICE_MIN) / NUM_BINS;
const TOTAL_LIQUIDITY = 1_000;
const POPULATION_SIZE = 40;
const ELITE_FRACTION = 0.25;
const EXPLORATION_RATE = 0.15;
const FEE_RATE = 0.003;
const ARB_THRESHOLD = 0.005;
const TRAINING_PATHS = 20;
const EVAL_PATHS = 10;
const PATH_STEPS = 200;
const DT = 1 / 365;

type RegimeId = "low-vol" | "high-vol" | "jump-diffusion" | "regime-shift";

interface RegimeConfig {
  id: RegimeId;
  volatility: number;
  drift: number;
  jumpIntensity: number;
  jumpMean: number;
  jumpStd: number;
}

const REGIMES: RegimeConfig[] = [
  { id: "low-vol", volatility: 0.3, drift: 0, jumpIntensity: 0, jumpMean: 0, jumpStd: 0 },
  { id: "high-vol", volatility: 1.0, drift: 0, jumpIntensity: 0, jumpMean: 0, jumpStd: 0 },
  { id: "jump-diffusion", volatility: 0.6, drift: 0, jumpIntensity: 5, jumpMean: -0.05, jumpStd: 0.15 },
  { id: "regime-shift", volatility: 0.3, drift: 0, jumpIntensity: 0, jumpMean: 0, jumpStd: 0 },
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
  entropy: number;
  symmetry: number;
  tailDensityRatio: number;
  peakConcentration: number;
}

interface CandidateRow {
  id: string;
  regime: RegimeId;
  generation: number;
  bins: number[];
  metrics: MetricVector;
  features: FeatureDescriptor;
  stability: number;
  score: number;
}

const ARCHIVE_BATCH_SIZE = 12;
const ARCHIVE_TOTAL_CAP = 5_000;

function featureFamilyKey(features: FeatureDescriptor): string {
  return [
    Math.round(features.curvature * 20) / 20,
    Math.round(features.entropy * 20) / 20,
    Math.round(features.symmetry * 20) / 20,
    Math.round(features.tailDensityRatio * 20) / 20,
    Math.round(features.peakConcentration * 20) / 20,
  ].join("|");
}

function selectDiverseArchive(candidates: CandidateRow[], count: number): CandidateRow[] {
  const sorted = [...candidates].sort((a, b) => a.score - b.score);
  const picked: CandidateRow[] = [];
  const seenFamilies = new Set<string>();

  for (const candidate of sorted) {
    const familyKey = featureFamilyKey(candidate.features);
    if (seenFamilies.has(familyKey)) continue;
    seenFamilies.add(familyKey);
    picked.push(candidate);
    if (picked.length >= count) return picked;
  }

  if (picked.length >= count) return picked;
  const pickedIds = new Set(picked.map((candidate) => candidate.id));
  for (const candidate of sorted) {
    if (pickedIds.has(candidate.id)) continue;
    picked.push(candidate);
    if (picked.length >= count) break;
  }

  return picked;
}

let counter = 0;
function nextId(): string {
  return `s${++counter}_${Date.now().toString(36)}`;
}

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

function deriveReserves(bins: Float64Array, refLogPrice: number) {
  let reserveX = 0, reserveY = 0;
  for (let i = 0; i < NUM_BINS; i++) {
    const lo = LOG_PRICE_MIN + i * BIN_WIDTH;
    const hi = lo + BIN_WIDTH;
    if (hi <= refLogPrice) reserveY += bins[i];
    else if (lo >= refLogPrice) reserveX += bins[i];
    else {
      const frac = (refLogPrice - lo) / BIN_WIDTH;
      reserveY += bins[i] * frac;
      reserveX += bins[i] * (1 - frac);
    }
  }
  return { reserveX: Math.max(reserveX, 1e-12), reserveY: Math.max(reserveY, 1e-12) };
}

function priceImpact(bins: Float64Array, refLogPrice: number, tradeSize: number, direction: "buy" | "sell") {
  let remaining = Math.abs(tradeSize);
  let output = 0;
  let currentLogPrice = refLogPrice;

  if (direction === "buy") {
    const startBin = Math.floor((currentLogPrice - LOG_PRICE_MIN) / BIN_WIDTH);
    for (let i = startBin; i >= 0 && remaining > 0; i--) {
      const consumed = Math.min(bins[i], remaining);
      output += consumed / Math.exp(binCenter(i));
      remaining -= consumed;
      currentLogPrice = binCenter(i) + BIN_WIDTH * 0.5;
    }
  } else {
    const startBin = Math.floor((currentLogPrice - LOG_PRICE_MIN) / BIN_WIDTH);
    for (let i = startBin; i < NUM_BINS && remaining > 0; i++) {
      const consumed = Math.min(bins[i], remaining);
      output += consumed * Math.exp(binCenter(i));
      remaining -= consumed;
      currentLogPrice = binCenter(i) - BIN_WIDTH * 0.5;
    }
  }

  const idealOutput = tradeSize / Math.exp(refLogPrice);
  const slippage = idealOutput > 0 ? Math.abs(1 - output / idealOutput) : 0;
  return { output, slippage: Math.min(slippage, 1), newLogPrice: currentLogPrice };
}

function generatePricePath(regime: RegimeConfig, steps: number, dt: number): Float64Array {
  const path = new Float64Array(steps + 1);
  path[0] = 0;

  const isRegimeShift = regime.id === "regime-shift";
  const shiftPoint = isRegimeShift ? Math.floor(steps * (0.3 + Math.random() * 0.4)) : steps + 1;

  let volatility = isRegimeShift ? 0.3 : regime.volatility;
  let jumpIntensity = isRegimeShift ? 0 : regime.jumpIntensity;
  let jumpMean = regime.jumpMean;
  let jumpStd = regime.jumpStd;

  for (let t = 1; t <= steps; t++) {
    if (isRegimeShift && t === shiftPoint) {
      volatility = 1.0;
      jumpIntensity = 5;
      jumpMean = -0.05;
      jumpStd = 0.15;
    }

    const diffusion = (regime.drift - 0.5 * volatility * volatility) * dt +
      volatility * Math.sqrt(dt) * randn();
    let jumpComponent = 0;
    if (jumpIntensity > 0 && Math.random() < jumpIntensity * dt) {
      jumpComponent = jumpMean + jumpStd * randn();
    }
    path[t] = path[t - 1] + diffusion + jumpComponent;
  }
  return path;
}

interface SimState {
  bins: Float64Array;
  currentLogPrice: number;
  totalFees: number;
  totalSlippage: number;
  arbLeakage: number;
  tradeCount: number;
  lpValueHistory: number[];
}

function initSimState(bins: Float64Array): SimState {
  return {
    bins: new Float64Array(bins),
    currentLogPrice: 0,
    totalFees: 0, totalSlippage: 0, arbLeakage: 0,
    tradeCount: 0, lpValueHistory: [TOTAL_LIQUIDITY],
  };
}

function executeRandomTrade(state: SimState): void {
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

function executeArbitrage(state: SimState, externalLogPrice: number): void {
  const deviation = Math.abs(state.currentLogPrice - externalLogPrice);
  if (deviation < ARB_THRESHOLD) return;
  const arbSize = deviation * TOTAL_LIQUIDITY * 0.1;
  const fee = arbSize * FEE_RATE;
  const arbProfit = arbSize * deviation - fee;
  if (arbProfit > 0) {
    state.arbLeakage += arbProfit;
    state.totalFees += fee;
    state.currentLogPrice = externalLogPrice;
  }
}

function computeLpValue(state: SimState, externalLogPrice: number): number {
  const { reserveX, reserveY } = deriveReserves(state.bins, externalLogPrice);
  return reserveX * Math.exp(externalLogPrice) + reserveY + state.totalFees;
}

function simulatePath(bins: Float64Array, pricePath: Float64Array): MetricVector {
  const state = initSimState(bins);
  let hodlValue = TOTAL_LIQUIDITY;
  let peakLpValue = TOTAL_LIQUIDITY;
  let maxDrawdown = 0;
  const lpReturns: number[] = [];
  let prevLpValue = TOTAL_LIQUIDITY;

  for (let t = 1; t < pricePath.length; t++) {
    const numTrades = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < numTrades; j++) executeRandomTrade(state);
    executeArbitrage(state, pricePath[t]);
    state.currentLogPrice = pricePath[t];
    const lpVal = computeLpValue(state, pricePath[t]);
    const priceRatio = Math.exp(pricePath[t]);
    hodlValue = TOTAL_LIQUIDITY * 0.5 * (priceRatio + 1);
    state.lpValueHistory.push(lpVal);
    peakLpValue = Math.max(peakLpValue, lpVal);
    maxDrawdown = Math.max(maxDrawdown, (peakLpValue - lpVal) / peakLpValue);
    lpReturns.push(lpVal / prevLpValue - 1);
    prevLpValue = lpVal;
  }

  const finalLpValue = state.lpValueHistory[state.lpValueHistory.length - 1];
  const priceRange = pricePath.reduce((acc, v) => ({ min: Math.min(acc.min, v), max: Math.max(acc.max, v) }), { min: Infinity, max: -Infinity });
  let activeLiquidity = 0;
  for (let i = 0; i < NUM_BINS; i++) {
    const center = binCenter(i);
    if (center >= priceRange.min - BIN_WIDTH && center <= priceRange.max + BIN_WIDTH) activeLiquidity += bins[i];
  }
  const meanRet = lpReturns.reduce((a, b) => a + b, 0) / lpReturns.length;
  const varRet = lpReturns.reduce((a, r) => a + (r - meanRet) ** 2, 0) / lpReturns.length;

  return {
    totalFees: state.totalFees,
    totalSlippage: state.totalSlippage / Math.max(state.tradeCount, 1),
    arbLeakage: state.arbLeakage,
    liquidityUtilization: activeLiquidity / TOTAL_LIQUIDITY,
    lpValueVsHodl: hodlValue > 0 ? finalLpValue / hodlValue : 1,
    maxDrawdown,
    volatilityOfReturns: Math.sqrt(varRet),
  };
}

function evaluateCandidate(bins: Float64Array, regime: RegimeConfig) {
  const allMetrics: MetricVector[] = [];
  for (let p = 0; p < TRAINING_PATHS; p++) allMetrics.push(simulatePath(bins, generatePricePath(regime, PATH_STEPS, DT)));
  const evalMetrics: MetricVector[] = [];
  for (let p = 0; p < EVAL_PATHS; p++) {
    const m = simulatePath(bins, generatePricePath(regime, PATH_STEPS, DT));
    allMetrics.push(m);
    evalMetrics.push(m);
  }

  const avg: MetricVector = { totalFees: 0, totalSlippage: 0, arbLeakage: 0, liquidityUtilization: 0, lpValueVsHodl: 0, maxDrawdown: 0, volatilityOfReturns: 0 };
  for (const m of evalMetrics) {
    avg.totalFees += m.totalFees; avg.totalSlippage += m.totalSlippage; avg.arbLeakage += m.arbLeakage;
    avg.liquidityUtilization += m.liquidityUtilization; avg.lpValueVsHodl += m.lpValueVsHodl;
    avg.maxDrawdown += m.maxDrawdown; avg.volatilityOfReturns += m.volatilityOfReturns;
  }
  const n = evalMetrics.length;
  avg.totalFees /= n; avg.totalSlippage /= n; avg.arbLeakage /= n;
  avg.liquidityUtilization /= n; avg.lpValueVsHodl /= n; avg.maxDrawdown /= n; avg.volatilityOfReturns /= n;

  const allLpvh = allMetrics.map(m => m.lpValueVsHodl);
  const meanLpvh = allLpvh.reduce((a, b) => a + b, 0) / allLpvh.length;
  const varLpvh = allLpvh.reduce((a, v) => a + (v - meanLpvh) ** 2, 0) / allLpvh.length;

  return { metrics: avg, stability: Math.sqrt(varLpvh) };
}

function computeFeatures(bins: Float64Array): FeatureDescriptor {
  const n = bins.length;
  const total = bins.reduce((a: number, b: number) => a + b, 0);
  const norm = Array.from(bins).map(b => b / total);

  let curvature = 0;
  for (let i = 1; i < n - 1; i++) { const d2 = norm[i - 1] - 2 * norm[i] + norm[i + 1]; curvature += d2 * d2; }

  let entropy = 0;
  for (let i = 0; i < n; i++) { if (norm[i] > 1e-15) entropy -= norm[i] * Math.log2(norm[i]); }

  const half = Math.floor(n / 2);
  const left = norm.slice(0, half);
  const right = norm.slice(n - half).reverse();
  const meanL = left.reduce((a, b) => a + b, 0) / half;
  const meanR = right.reduce((a, b) => a + b, 0) / half;
  let covLR = 0, varL = 0, varR = 0;
  for (let i = 0; i < half; i++) { covLR += (left[i] - meanL) * (right[i] - meanR); varL += (left[i] - meanL) ** 2; varR += (right[i] - meanR) ** 2; }
  const symmetry = (varL > 0 && varR > 0) ? covLR / (Math.sqrt(varL) * Math.sqrt(varR)) : 0;

  const q1 = Math.floor(n * 0.25), q3 = Math.floor(n * 0.75);
  let tailMass = 0, centerMass = 0;
  for (let i = 0; i < n; i++) { if (i < q1 || i >= q3) tailMass += norm[i]; else centerMass += norm[i]; }
  const tailDensityRatio = centerMass > 0 ? tailMass / centerMass : 0;

  const maxBin = Math.max(...norm);
  const peakConcentration = maxBin / (1 / n);

  return { curvature, entropy, symmetry, tailDensityRatio, peakConcentration };
}

function scoreCandidate(metrics: MetricVector, stability: number): number {
  return -metrics.totalFees * 2 + metrics.totalSlippage * 1 + metrics.arbLeakage * 1.5 +
    -metrics.liquidityUtilization * 3 + -(metrics.lpValueVsHodl - 1) * 5 +
    metrics.maxDrawdown * 2 + metrics.volatilityOfReturns * 1 + stability * 2;
}

function mutateBins(parent: Float64Array, intensity: number = 0.1): Float64Array {
  const child = new Float64Array(parent);
  const mutationType = Math.random();

  if (mutationType < 0.4) {
    const numMutated = 1 + Math.floor(Math.random() * (NUM_BINS / 4));
    for (let j = 0; j < numMutated; j++) {
      const idx = Math.floor(Math.random() * NUM_BINS);
      child[idx] = Math.max(0, child[idx] + randn() * intensity * TOTAL_LIQUIDITY / NUM_BINS);
    }
  } else if (mutationType < 0.7) {
    const smoothed = new Float64Array(child);
    const radius = 1 + Math.floor(Math.random() * 3);
    for (let i = radius; i < NUM_BINS - radius; i++) {
      let sum = 0;
      for (let j = -radius; j <= radius; j++) sum += child[i + j];
      smoothed[i] = sum / (2 * radius + 1);
    }
    const blend = 0.2 + Math.random() * 0.3;
    for (let i = 0; i < NUM_BINS; i++) child[i] = child[i] * (1 - blend) + smoothed[i] * blend;
  } else {
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

  for (let i = 0; i < NUM_BINS; i++) child[i] = Math.max(0, child[i]);
  normalizeBins(child);
  return child;
}

/** Crossover: uniform per-bin swap between two parents */
function crossoverBins(parentA: Float64Array, parentB: Float64Array): Float64Array {
  const child = new Float64Array(NUM_BINS);
  for (let i = 0; i < NUM_BINS; i++) {
    child[i] = Math.random() < 0.5 ? parentA[i] : parentB[i];
  }
  normalizeBins(child);
  return child;
}

/** Early rejection: run a short 32-step screen before full evaluation */
function screenCandidate(bins: Float64Array, regime: RegimeConfig, championScore: number): boolean {
  const path = generatePricePath(regime, 32, DT);
  const metrics = simulatePath(bins, path);
  const quickScore = scoreCandidate(metrics, 0);
  return quickScore < championScore * 2.5; // must be within 2.5x of champion
}

/** Adaptive exploration rate based on population score diversity */
function adaptiveExplorationRate(scores: number[]): number {
  if (scores.length < 3) return EXPLORATION_RATE;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;
  if (range < 1e-6) return 0.35;
  const buckets = new Array(8).fill(0);
  for (const s of scores) {
    const idx = Math.min(Math.floor(((s - min) / range) * 8), 7);
    buckets[idx]++;
  }
  let entropy = 0;
  for (const c of buckets) {
    if (c > 0) { const p = c / scores.length; entropy -= p * Math.log2(p); }
  }
  const normalizedEntropy = entropy / Math.log2(8);
  return 0.05 + 0.25 * (1 - normalizedEntropy);
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "generate";

    if (action === "generate") {
      // Determine which regime to run next
      const regimeId: RegimeId = body.regime || REGIMES[Math.floor(Math.random() * REGIMES.length)].id;
      const regimeConfig = REGIMES.find(r => r.id === regimeId)!;

      // Fetch current population for this regime (most recent POPULATION_SIZE candidates)
      const { data: existingPop } = await supabase
        .from("atlas_candidates")
        .select("*")
        .eq("regime", regimeId)
        .eq("is_population", true)
        .order("score", { ascending: true })
        .limit(POPULATION_SIZE);

      const parentBins: Float64Array[] = (existingPop || []).map((row: any) =>
        new Float64Array(row.bins)
      );

      // Get current generation number
      const { data: genData } = await supabase
        .from("atlas_state")
        .select("total_generations")
        .eq("id", "global")
        .single();

      const totalGenerations = genData?.total_generations || 0;
      const gen = totalGenerations + 1;

      const allCandidates: CandidateRow[] = [];

      if (parentBins.length === 0) {
        // First generation: create random population
        for (let i = 0; i < POPULATION_SIZE; i++) {
          const bins = new Float64Array(NUM_BINS);
          for (let j = 0; j < NUM_BINS; j++) bins[j] = Math.random() * Math.random();
          normalizeBins(bins);
          const { metrics, stability } = evaluateCandidate(bins, regimeConfig);
          const features = computeFeatures(bins);
          const score = scoreCandidate(metrics, stability);
          allCandidates.push({
            id: nextId(), regime: regimeId, generation: gen,
            bins: Array.from(bins), metrics, features, stability, score,
          });
        }
      } else {
        // Evolve from existing population
        const sorted = parentBins.length > 0
          ? [...(existingPop || [])].sort((a: any, b: any) => a.score - b.score)
          : [];
        const eliteCount = Math.max(2, Math.floor(POPULATION_SIZE * ELITE_FRACTION));
        const elites = sorted.slice(0, eliteCount);

        const numChildren = POPULATION_SIZE - Math.floor(POPULATION_SIZE * EXPLORATION_RATE);
        for (let i = 0; i < numChildren; i++) {
          const parent = elites[i % eliteCount];
          const childBins = mutateBins(new Float64Array(parent.bins), 0.1 + 0.05 * Math.random());
          const { metrics, stability } = evaluateCandidate(childBins, regimeConfig);
          const features = computeFeatures(childBins);
          const score = scoreCandidate(metrics, stability);
          allCandidates.push({
            id: nextId(), regime: regimeId, generation: gen,
            bins: Array.from(childBins), metrics, features, stability, score,
          });
        }

        const numExplore = POPULATION_SIZE - numChildren;
        for (let i = 0; i < numExplore; i++) {
          const bins = new Float64Array(NUM_BINS);
          for (let j = 0; j < NUM_BINS; j++) bins[j] = Math.random() * Math.random();
          normalizeBins(bins);
          const { metrics, stability } = evaluateCandidate(bins, regimeConfig);
          const features = computeFeatures(bins);
          const score = scoreCandidate(metrics, stability);
          allCandidates.push({
            id: nextId(), regime: regimeId, generation: gen,
            bins: Array.from(bins), metrics, features, stability, score,
          });
        }
      }

      // Sort all candidates by score
      allCandidates.sort((a, b) => a.score - b.score);

      // Archive a larger, more diverse set each generation.
      const archiveCount = Math.max(ARCHIVE_BATCH_SIZE, Math.ceil(allCandidates.length * 0.3));
      const archiveCandidates = selectDiverseArchive(allCandidates, archiveCount);

      // Top POPULATION_SIZE are the new population
      const newPopulation = allCandidates.slice(0, POPULATION_SIZE);

      // Clear old population for this regime
      await supabase
        .from("atlas_candidates")
        .delete()
        .eq("regime", regimeId)
        .eq("is_population", true);

      // Insert new population
      const popRows = newPopulation.map(c => ({
        candidate_id: c.id,
        regime: c.regime,
        generation: c.generation,
        bins: c.bins,
        metrics: c.metrics,
        features: c.features,
        stability: c.stability,
        score: c.score,
        is_population: true,
        is_archived: false,
      }));

      await supabase.from("atlas_candidates").insert(popRows);

      // Insert archived candidates (diversified frontier set)
      const archiveRows = archiveCandidates.map(c => ({
        candidate_id: c.id,
        regime: c.regime,
        generation: c.generation,
        bins: c.bins,
        metrics: c.metrics,
        features: c.features,
        stability: c.stability,
        score: c.score,
        is_population: false,
        is_archived: true,
      }));

      await supabase.from("atlas_candidates").insert(archiveRows);

      // Update global state
      await supabase
        .from("atlas_state")
        .upsert({
          id: "global",
          total_generations: gen,
          last_regime: regimeId,
          updated_at: new Date().toISOString(),
        });

      // Cap total archived candidates to prevent unbounded growth (keep most recent 5,000)
      const { count: totalArchived } = await supabase
        .from("atlas_candidates")
        .select("*", { count: "exact", head: true })
        .eq("is_archived", true);

      if (totalArchived && totalArchived > ARCHIVE_TOTAL_CAP) {
        // Delete oldest archived beyond limit
        const { data: oldest } = await supabase
          .from("atlas_candidates")
          .select("id")
          .eq("is_archived", true)
          .order("created_at", { ascending: true })
          .limit(totalArchived - ARCHIVE_TOTAL_CAP);

        if (oldest && oldest.length > 0) {
          const idsToDelete = oldest.map((r: any) => r.id);
          await supabase
            .from("atlas_candidates")
            .delete()
            .in("id", idsToDelete);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          generation: gen,
          regime: regimeId,
          candidatesGenerated: allCandidates.length,
          archived: archiveCandidates.length,
          champion: allCandidates[0],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "backup-state") {
      const archive = Array.isArray(body.archive) ? body.archive : [];
      const populations = body.populations && typeof body.populations === "object" ? body.populations : {};
      const incomingGenerations = Number(body.totalGenerations || 0);

      if (archive.length === 0 && incomingGenerations === 0) {
        return new Response(
          JSON.stringify({ success: true, skipped: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const safeArchive = archive.filter((row: any) => (
        row && typeof row.id === "string" && Array.isArray(row.bins) && typeof row.regime === "string"
      ));

      const regimes: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];
      const safePopulationRows: any[] = [];
      for (const regime of regimes) {
        const rows = Array.isArray(populations[regime]) ? populations[regime] : [];
        for (const row of rows) {
          if (!row || typeof row.id !== "string" || !Array.isArray(row.bins)) continue;
          safePopulationRows.push({
            candidate_id: row.id,
            regime,
            generation: row.generation || 0,
            bins: row.bins,
            metrics: row.metrics || {},
            features: row.features || {},
            stability: row.stability || 0,
            score: row.score || 0,
            is_population: true,
            is_archived: false,
          });
        }
      }

      const archiveRows = safeArchive.map((row: any) => ({
        candidate_id: row.id,
        regime: row.regime,
        generation: row.generation || 0,
        bins: row.bins,
        metrics: row.metrics || {},
        features: row.features || {},
        stability: row.stability || 0,
        score: row.score || 0,
        is_population: false,
        is_archived: true,
      }));

      await supabase.from("atlas_candidates").delete().eq("is_population", true);
      await supabase.from("atlas_candidates").delete().eq("is_archived", true);

      if (safePopulationRows.length > 0) {
        await supabase.from("atlas_candidates").insert(safePopulationRows);
      }
      if (archiveRows.length > 0) {
        await supabase.from("atlas_candidates").insert(archiveRows);
      }

      const { data: currentState } = await supabase
        .from("atlas_state")
        .select("total_generations")
        .eq("id", "global")
        .single();

      const existingGenerations = (currentState as any)?.total_generations || 0;
      const totalGenerations = Math.max(existingGenerations, incomingGenerations);

      await supabase.from("atlas_state").upsert({
        id: "global",
        total_generations: totalGenerations,
        updated_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ success: true, archived: archiveRows.length, population: safePopulationRows.length, totalGenerations }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "bootstrap") {
      // Auto-create tables if they don't exist (uses service role key)
      const bootstrapSQL = `
        CREATE TABLE IF NOT EXISTS atlas_candidates (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          candidate_id TEXT NOT NULL,
          regime TEXT NOT NULL CHECK (regime IN ('low-vol', 'high-vol', 'jump-diffusion')),
          generation INTEGER NOT NULL,
          bins DOUBLE PRECISION[] NOT NULL,
          metrics JSONB NOT NULL,
          features JSONB NOT NULL,
          stability DOUBLE PRECISION NOT NULL,
          score DOUBLE PRECISION NOT NULL,
          is_population BOOLEAN NOT NULL DEFAULT FALSE,
          is_archived BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_atlas_candidates_regime ON atlas_candidates(regime);
        CREATE INDEX IF NOT EXISTS idx_atlas_candidates_archived ON atlas_candidates(is_archived);
        CREATE INDEX IF NOT EXISTS idx_atlas_candidates_population ON atlas_candidates(is_population);
        CREATE INDEX IF NOT EXISTS idx_atlas_candidates_score ON atlas_candidates(score);
        CREATE INDEX IF NOT EXISTS idx_atlas_candidates_created ON atlas_candidates(created_at);
        CREATE TABLE IF NOT EXISTS atlas_state (
          id TEXT PRIMARY KEY DEFAULT 'global',
          total_generations INTEGER NOT NULL DEFAULT 0,
          last_regime TEXT,
          branch_data JSONB,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        INSERT INTO atlas_state (id, total_generations) VALUES ('global', 0) ON CONFLICT DO NOTHING;
        ALTER TABLE atlas_candidates ENABLE ROW LEVEL SECURITY;
        ALTER TABLE atlas_state ENABLE ROW LEVEL SECURITY;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'atlas_candidates' AND policyname = 'Allow public read access on atlas_candidates') THEN
            CREATE POLICY "Allow public read access on atlas_candidates" ON atlas_candidates FOR SELECT TO anon, authenticated USING (true);
          END IF;
        END $$;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'atlas_state' AND policyname = 'Allow public read access on atlas_state') THEN
            CREATE POLICY "Allow public read access on atlas_state" ON atlas_state FOR SELECT TO anon, authenticated USING (true);
          END IF;
        END $$;
      `;

      // Use the Supabase management SQL endpoint (service role has full access)
      const dbUrl = Deno.env.get("SUPABASE_DB_URL");
      if (dbUrl) {
        // Direct postgres connection if available
        // Fall through to REST-based approach if not
      }

      // Use supabase-js rpc or raw SQL via postgrest
      const { error: sqlError } = await supabase.rpc("exec_sql", { query: bootstrapSQL }).single();

      if (sqlError) {
        // rpc function doesn't exist; try creating tables via individual operations
        // This is a best-effort approach
        const { error: stateErr } = await supabase
          .from("atlas_state")
          .upsert({ id: "global", total_generations: 0, updated_at: new Date().toISOString() });

        if (!stateErr) {
          return new Response(
            JSON.stringify({ success: true, message: "Tables already exist" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: "Could not bootstrap tables. Run the migration SQL manually in the Supabase dashboard." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Tables created successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "bayesian-allocate") {
      // ─── Autonomous Bayesian Branch Allocation with Learning ────────
      // Runs multiple generations using UCB + Thompson sampling.
      // Tracks failure streaks, stagnation, and adaptive mutation to learn
      // from mistakes and focus search on the most promising regions.
      const steps = Math.min(body.steps || 5, 20);
      const results: { step: number; regime: string; score: number; archived: number; phase: string }[] = [];

      const { data: branchStateRow } = await supabase
        .from("atlas_state")
        .select("*")
        .eq("id", "bayesian-branches")
        .single();

      type BranchState = {
        posteriorMean: number;
        variance: number;
        tested: number;
        bestScore: number;
        failureStreak: number;
        stagnationPenalty: number;
        mutationIntensity: number;
        improvementVelocity: number;
        recentScores: number[];
        phase: "explore" | "exploit" | "intensify";
      };

      let branchMap: Record<string, BranchState> = {};
      if (branchStateRow && (branchStateRow as any).branch_data) {
        branchMap = (branchStateRow as any).branch_data;
      }

      // Ensure all regimes have state with new fields
      for (const r of REGIMES) {
        if (!branchMap[r.id]) {
          branchMap[r.id] = {
            posteriorMean: 0.5, variance: 0.5, tested: 0, bestScore: Infinity,
            failureStreak: 0, stagnationPenalty: 0, mutationIntensity: 0.15,
            improvementVelocity: 0, recentScores: [], phase: "explore",
          };
        }
        // Migrate older state objects that lack new fields
        const s = branchMap[r.id];
        if (s.failureStreak === undefined) s.failureStreak = 0;
        if (s.stagnationPenalty === undefined) s.stagnationPenalty = 0;
        if (s.mutationIntensity === undefined) s.mutationIntensity = 0.15;
        if (s.improvementVelocity === undefined) s.improvementVelocity = 0;
        if (!s.recentScores) s.recentScores = [];
        if (!s.phase) s.phase = "explore";
      }

      for (let step = 0; step < steps; step++) {
        // UCB + Thompson sampling with stagnation awareness
        const totalSteps = Object.values(branchMap).reduce((a, s) => a + s.tested, 0) + 1;
        const regimeSamples = REGIMES.map(r => {
          const state = branchMap[r.id];
          // UCB exploration bonus
          const ucb = Math.sqrt(2 * Math.log(totalSteps) / Math.max(state.tested, 1)) * 0.2;
          // Thompson noise scaled by phase
          const phaseScale = state.phase === "explore" ? 2.5 : state.phase === "intensify" ? 0.5 : 1.5;
          const noise = (Math.random() - 0.5) * Math.sqrt(Math.max(state.variance, 0.01)) * phaseScale;
          // Improvement velocity bonus
          const velocityBonus = state.improvementVelocity > 0 ? state.improvementVelocity * 0.2 : 0;
          // Stagnation discount
          const stagnationDiscount = 1 - state.stagnationPenalty * 0.4;
          // Unexplored bonus
          const explorationBonus = state.tested === 0 ? 0.5 : 0;
          return {
            regime: r,
            sample: (state.posteriorMean + noise + ucb + velocityBonus + explorationBonus) * stagnationDiscount,
          };
        });
        regimeSamples.sort((a, b) => b.sample - a.sample);
        const selectedRegime = regimeSamples[0].regime;
        const branchState = branchMap[selectedRegime.id];

        const { data: existingPop } = await supabase
          .from("atlas_candidates")
          .select("*")
          .eq("regime", selectedRegime.id)
          .eq("is_population", true)
          .order("score", { ascending: true })
          .limit(POPULATION_SIZE);

        const { data: genRow } = await supabase
          .from("atlas_state")
          .select("total_generations")
          .eq("id", "global")
          .single();

        const gen = ((genRow as any)?.total_generations || 0) + 1;
        const allCandidates: CandidateRow[] = [];
        const parentBins = (existingPop || []).map((row: any) => new Float64Array(row.bins));

        // Adaptive mutation intensity from branch state
        const mutIntensity = branchState.mutationIntensity;

        if (parentBins.length === 0) {
          for (let i = 0; i < POPULATION_SIZE; i++) {
            const bins = new Float64Array(NUM_BINS);
            for (let j = 0; j < NUM_BINS; j++) bins[j] = Math.random() * Math.random();
            normalizeBins(bins);
            const { metrics, stability } = evaluateCandidate(bins, selectedRegime);
            const features = computeFeatures(bins);
            const score = scoreCandidate(metrics, stability);
            allCandidates.push({ id: nextId(), regime: selectedRegime.id, generation: gen, bins: Array.from(bins), metrics, features, stability, score });
          }
        } else {
          const sorted = [...(existingPop || [])].sort((a: any, b: any) => a.score - b.score);
          const eliteCount = Math.max(2, Math.floor(POPULATION_SIZE * ELITE_FRACTION));
          const elites = sorted.slice(0, eliteCount);

          // Adaptive child count: intensify phase generates more children
          const baseChildren = POPULATION_SIZE - Math.floor(POPULATION_SIZE * EXPLORATION_RATE);
          const numChildren = branchState.phase === "intensify"
            ? Math.min(POPULATION_SIZE - 2, Math.ceil(baseChildren * 1.2))
            : baseChildren;

          for (let i = 0; i < numChildren; i++) {
            const parent = elites[i % eliteCount];
            const childBins = mutateBins(new Float64Array(parent.bins), mutIntensity + 0.05 * Math.random());
            const { metrics, stability } = evaluateCandidate(childBins, selectedRegime);
            const features = computeFeatures(childBins);
            const score = scoreCandidate(metrics, stability);
            allCandidates.push({ id: nextId(), regime: selectedRegime.id, generation: gen, bins: Array.from(childBins), metrics, features, stability, score });
          }
          for (let i = 0; i < POPULATION_SIZE - numChildren; i++) {
            const bins = new Float64Array(NUM_BINS);
            for (let j = 0; j < NUM_BINS; j++) bins[j] = Math.random() * Math.random();
            normalizeBins(bins);
            const { metrics, stability } = evaluateCandidate(bins, selectedRegime);
            const features = computeFeatures(bins);
            const score = scoreCandidate(metrics, stability);
            allCandidates.push({ id: nextId(), regime: selectedRegime.id, generation: gen, bins: Array.from(bins), metrics, features, stability, score });
          }
        }

        allCandidates.sort((a, b) => a.score - b.score);
        const archiveCount = Math.max(ARCHIVE_BATCH_SIZE, Math.ceil(allCandidates.length * 0.3));
        const archiveCandidates = selectDiverseArchive(allCandidates, archiveCount);
        const newPopulation = allCandidates.slice(0, POPULATION_SIZE);

        await supabase.from("atlas_candidates").delete().eq("regime", selectedRegime.id).eq("is_population", true);
        await supabase.from("atlas_candidates").insert(
          newPopulation.map(c => ({ candidate_id: c.id, regime: c.regime, generation: c.generation, bins: c.bins, metrics: c.metrics, features: c.features, stability: c.stability, score: c.score, is_population: true, is_archived: false }))
        );
        await supabase.from("atlas_candidates").insert(
          archiveCandidates.map(c => ({ candidate_id: c.id, regime: c.regime, generation: c.generation, bins: c.bins, metrics: c.metrics, features: c.features, stability: c.stability, score: c.score, is_population: false, is_archived: true }))
        );
        await supabase.from("atlas_state").upsert({ id: "global", total_generations: gen, last_regime: selectedRegime.id, updated_at: new Date().toISOString() });

        // ─── Enhanced posterior update with learning ───────────────────
        const bestScore = allCandidates[0].score;
        const avgScore = allCandidates.reduce((a, c) => a + c.score, 0) / allCandidates.length;
        const improved = bestScore < branchState.bestScore;

        // Update recent scores for trend detection
        const updatedScores = [...branchState.recentScores, avgScore].slice(-10);

        // Detect trend from recent scores
        let trend: "improving" | "plateau" | "degrading" = "improving";
        if (updatedScores.length >= 3) {
          const half = Math.ceil(updatedScores.length / 2);
          const avgFirst = updatedScores.slice(0, half).reduce((a, b) => a + b, 0) / half;
          const avgSecond = updatedScores.slice(half).reduce((a, b) => a + b, 0) / (updatedScores.length - half);
          const delta = avgFirst - avgSecond;
          if (delta > 0.01) trend = "improving";
          else if (delta < -0.01) trend = "degrading";
          else trend = "plateau";
        }

        // Update failure streak
        const newFailureStreak = improved ? 0 : branchState.failureStreak + 1;

        // Stagnation penalty: accumulates when stuck, decays on improvement
        const newStagnationPenalty = improved
          ? Math.max(0, branchState.stagnationPenalty * 0.5)
          : Math.min(1, branchState.stagnationPenalty + 0.05 * Math.min(newFailureStreak, 10));

        // Adaptive mutation: widen when stagnating, tighten when improving
        let newMutIntensity = branchState.mutationIntensity;
        if (trend === "improving") {
          newMutIntensity = Math.max(0.05, branchState.mutationIntensity * 0.9);
        } else if (trend === "plateau") {
          newMutIntensity = Math.min(0.5, branchState.mutationIntensity * 1.15);
        } else {
          newMutIntensity = Math.min(0.5, branchState.mutationIntensity * 1.3);
        }

        // Improvement velocity (EMA)
        const improvement = branchState.bestScore === Infinity ? 0.5 : Math.max(0, branchState.bestScore - bestScore);
        const newVelocity = branchState.improvementVelocity * 0.7 + improvement * 0.3;

        // Determine phase
        let newPhase: BranchState["phase"] = branchState.phase;
        if (branchState.tested < 200) {
          newPhase = "explore";
        } else if (trend === "improving" && newFailureStreak === 0) {
          newPhase = "intensify";
        } else if (newFailureStreak > 5 || trend === "degrading") {
          newPhase = "explore";
        } else {
          newPhase = "exploit";
        }

        branchMap[selectedRegime.id] = {
          posteriorMean: branchState.posteriorMean * 0.7 + (1 - avgScore / 10) * 0.3,
          variance: Math.max(0.01, branchState.variance * 0.6 + 0.4 * allCandidates.reduce((a, c) => a + (c.score - avgScore) ** 2, 0) / allCandidates.length),
          tested: branchState.tested + allCandidates.length,
          bestScore: Math.min(branchState.bestScore, bestScore),
          failureStreak: newFailureStreak,
          stagnationPenalty: newStagnationPenalty,
          mutationIntensity: newMutIntensity,
          improvementVelocity: newVelocity,
          recentScores: updatedScores,
          phase: newPhase,
        };

        results.push({ step: step + 1, regime: selectedRegime.id, score: bestScore, archived: archiveCount, phase: newPhase });
      }

      await supabase.from("atlas_state").upsert({
        id: "bayesian-branches",
        total_generations: 0,
        last_regime: null,
        updated_at: new Date().toISOString(),
        branch_data: branchMap,
      } as any);

      return new Response(
        JSON.stringify({ success: true, steps: results, branchState: branchMap }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "run-loop") {
      // ─── Autonomous Run Loop ──────────────────────────────────────
      // Runs N generations cycling through all regimes.
      // Designed to be called by a cron job or external scheduler.
      // No browser tab required.
      const totalSteps = Math.min(body.steps || 9, 30); // max 30 per invocation
      const results: { step: number; regime: string; generation: number; bestScore: number }[] = [];

      for (let step = 0; step < totalSteps; step++) {
        // Cycle through regimes round-robin
        const regimeConfig = REGIMES[step % REGIMES.length];

        const { data: existingPop } = await supabase
          .from("atlas_candidates")
          .select("*")
          .eq("regime", regimeConfig.id)
          .eq("is_population", true)
          .order("score", { ascending: true })
          .limit(POPULATION_SIZE);

        const { data: genRow } = await supabase
          .from("atlas_state")
          .select("total_generations")
          .eq("id", "global")
          .single();

        const gen = ((genRow as any)?.total_generations || 0) + 1;
        const allCandidates: CandidateRow[] = [];
        const parentBins = (existingPop || []).map((row: any) => new Float64Array(row.bins));

        if (parentBins.length === 0) {
          for (let i = 0; i < POPULATION_SIZE; i++) {
            const bins = new Float64Array(NUM_BINS);
            for (let j = 0; j < NUM_BINS; j++) bins[j] = Math.random() * Math.random();
            normalizeBins(bins);
            const { metrics, stability } = evaluateCandidate(bins, regimeConfig);
            const features = computeFeatures(bins);
            const score = scoreCandidate(metrics, stability);
            allCandidates.push({ id: nextId(), regime: regimeConfig.id, generation: gen, bins: Array.from(bins), metrics, features, stability, score });
          }
        } else {
          const sorted = [...(existingPop || [])].sort((a: any, b: any) => a.score - b.score);
          const eliteCount = Math.max(2, Math.floor(POPULATION_SIZE * ELITE_FRACTION));
          const elites = sorted.slice(0, eliteCount);
          const numChildren = POPULATION_SIZE - Math.floor(POPULATION_SIZE * EXPLORATION_RATE);
          for (let i = 0; i < numChildren; i++) {
            const parent = elites[i % eliteCount];
            const childBins = mutateBins(new Float64Array(parent.bins), 0.1 + 0.05 * Math.random());
            const { metrics, stability } = evaluateCandidate(childBins, regimeConfig);
            const features = computeFeatures(childBins);
            const score = scoreCandidate(metrics, stability);
            allCandidates.push({ id: nextId(), regime: regimeConfig.id, generation: gen, bins: Array.from(childBins), metrics, features, stability, score });
          }
          for (let i = 0; i < POPULATION_SIZE - numChildren; i++) {
            const bins = new Float64Array(NUM_BINS);
            for (let j = 0; j < NUM_BINS; j++) bins[j] = Math.random() * Math.random();
            normalizeBins(bins);
            const { metrics, stability } = evaluateCandidate(bins, regimeConfig);
            const features = computeFeatures(bins);
            const score = scoreCandidate(metrics, stability);
            allCandidates.push({ id: nextId(), regime: regimeConfig.id, generation: gen, bins: Array.from(bins), metrics, features, stability, score });
          }
        }

        allCandidates.sort((a, b) => a.score - b.score);
        const archiveCount = Math.max(ARCHIVE_BATCH_SIZE, Math.ceil(allCandidates.length * 0.3));
        const archiveCandidates = selectDiverseArchive(allCandidates, archiveCount);
        const newPopulation = allCandidates.slice(0, POPULATION_SIZE);

        await supabase.from("atlas_candidates").delete().eq("regime", regimeConfig.id).eq("is_population", true);
        await supabase.from("atlas_candidates").insert(
          newPopulation.map(c => ({ candidate_id: c.id, regime: c.regime, generation: c.generation, bins: c.bins, metrics: c.metrics, features: c.features, stability: c.stability, score: c.score, is_population: true, is_archived: false }))
        );
        await supabase.from("atlas_candidates").insert(
          archiveCandidates.map(c => ({ candidate_id: c.id, regime: c.regime, generation: c.generation, bins: c.bins, metrics: c.metrics, features: c.features, stability: c.stability, score: c.score, is_population: false, is_archived: true }))
        );
        await supabase.from("atlas_state").upsert({ id: "global", total_generations: gen, last_regime: regimeConfig.id, updated_at: new Date().toISOString() });

        results.push({ step: step + 1, regime: regimeConfig.id, generation: gen, bestScore: allCandidates[0].score });
      }

      return new Response(
        JSON.stringify({ success: true, stepsCompleted: results.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      const { data: stateData } = await supabase
        .from("atlas_state")
        .select("*")
        .eq("id", "global")
        .single();

      const { count: archivedCount } = await supabase
        .from("atlas_candidates")
        .select("*", { count: "exact", head: true })
        .eq("is_archived", true);

      return new Response(
        JSON.stringify({
          success: true,
          state: stateData,
          archivedCount: archivedCount || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
