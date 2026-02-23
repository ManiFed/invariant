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

type RegimeId = "low-vol" | "high-vol" | "jump-diffusion";

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
  for (let t = 1; t <= steps; t++) {
    const diffusion = (regime.drift - 0.5 * regime.volatility * regime.volatility) * dt +
      regime.volatility * Math.sqrt(dt) * randn();
    let jumpComponent = 0;
    if (regime.jumpIntensity > 0 && Math.random() < regime.jumpIntensity * dt) {
      jumpComponent = regime.jumpMean + regime.jumpStd * randn();
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

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

      // Top 5% go to archive (permanent storage for the atlas)
      const archiveCount = Math.max(2, Math.ceil(allCandidates.length * 0.05));
      const archiveCandidates = allCandidates.slice(0, archiveCount);

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

      // Insert archived candidates (top 5%)
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

      // Cap total archived candidates to prevent unbounded growth (keep most recent 50,000)
      const { count: totalArchived } = await supabase
        .from("atlas_candidates")
        .select("*", { count: "exact", head: true })
        .eq("is_archived", true);

      if (totalArchived && totalArchived > 50000) {
        // Delete oldest archived beyond limit
        const { data: oldest } = await supabase
          .from("atlas_candidates")
          .select("id")
          .eq("is_archived", true)
          .order("created_at", { ascending: true })
          .limit(totalArchived - 50000);

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
