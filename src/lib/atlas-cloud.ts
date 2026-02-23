// Atlas Cloud Storage — Supabase integration for the Invariant Atlas
// Loads candidates from the database and subscribes to real-time updates.
// Falls back to IndexedDB persistence if Supabase is unavailable.

import { supabase } from "@/integrations/supabase/client";
import type { Candidate, RegimeId, MetricVector, FeatureDescriptor, EngineState, PopulationState, ChampionMetric } from "@/lib/discovery-engine";

export type CloudStatus =
  | "connected"       // Supabase tables exist and are reachable
  | "no-tables"       // Supabase reachable but tables don't exist
  | "unreachable"     // Can't reach Supabase at all
  | "loading";        // Still checking

// ─── DB Row → Candidate conversion ──────────────────────────────────────────

interface CandidateRow {
  id: number;
  candidate_id: string;
  regime: string;
  generation: number;
  bins: number[];
  metrics: MetricVector;
  features: FeatureDescriptor;
  stability: number;
  score: number;
  is_population: boolean;
  is_archived: boolean;
  created_at: string;
}

export function rowToCandidate(row: CandidateRow): Candidate {
  return {
    id: row.candidate_id,
    bins: new Float64Array(row.bins),
    regime: row.regime as RegimeId,
    generation: row.generation,
    metrics: row.metrics,
    features: row.features,
    stability: row.stability,
    score: row.score,
    timestamp: new Date(row.created_at).getTime(),
  };
}

// ─── Table bootstrap: try to create tables via edge function ─────────────────

async function tryBootstrapTables(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("atlas-engine", {
      body: { action: "bootstrap" },
    });
    if (error) return false;
    return data?.success === true;
  } catch {
    return false;
  }
}

// ─── Check if Supabase is reachable and tables exist ─────────────────────────

export async function checkCloudStatus(): Promise<CloudStatus> {
  try {
    // Try a simple query with a short timeout via AbortController
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const { error } = await supabase
      .from("atlas_state")
      .select("id")
      .limit(1)
      .abortSignal(controller.signal);

    clearTimeout(timeout);

    if (!error) return "connected";

    // Check if the error is "relation does not exist" (table missing)
    const msg = (error as any)?.message || error?.code || "";
    if (msg.includes("42P01") || msg.includes("does not exist") || msg.includes("relation")) {
      // Tables don't exist — try to bootstrap via edge function
      const bootstrapped = await tryBootstrapTables();
      if (bootstrapped) {
        // Wait a moment for tables to be available
        await new Promise(r => setTimeout(r, 1000));
        return "connected";
      }
      return "no-tables";
    }

    // Other errors: probably permission or network issues
    return "unreachable";
  } catch {
    return "unreachable";
  }
}

// ─── Load initial state from Supabase ────────────────────────────────────────

const EMPTY_METRIC_CHAMPIONS: Record<ChampionMetric, Candidate | null> = {
  fees: null, utilization: null, lpValue: null, lowSlippage: null,
  lowArbLeak: null, lowDrawdown: null, stability: null,
};

function computeMetricChampionsFromCandidates(candidates: Candidate[]): Record<ChampionMetric, Candidate | null> {
  const result: Record<ChampionMetric, Candidate | null> = { ...EMPTY_METRIC_CHAMPIONS };
  for (const c of candidates) {
    if (!result.fees || c.metrics.totalFees > result.fees.metrics.totalFees) result.fees = c;
    if (!result.utilization || c.metrics.liquidityUtilization > result.utilization.metrics.liquidityUtilization) result.utilization = c;
    if (!result.lpValue || c.metrics.lpValueVsHodl > result.lpValue.metrics.lpValueVsHodl) result.lpValue = c;
    if (!result.lowSlippage || c.metrics.totalSlippage < result.lowSlippage.metrics.totalSlippage) result.lowSlippage = c;
    if (!result.lowArbLeak || c.metrics.arbLeakage < result.lowArbLeak.metrics.arbLeakage) result.lowArbLeak = c;
    if (!result.lowDrawdown || c.metrics.maxDrawdown < result.lowDrawdown.metrics.maxDrawdown) result.lowDrawdown = c;
    if (!result.stability || c.stability < result.stability.stability) result.stability = c;
  }
  return result;
}

export async function loadAtlasState(): Promise<{
  state: EngineState | null;
  cloudStatus: CloudStatus;
}> {
  const status = await checkCloudStatus();

  if (status !== "connected") {
    return { state: null, cloudStatus: status };
  }

  try {
    // Load global state
    const { data: globalState, error: stateError } = await (supabase as any)
      .from("atlas_state")
      .select("*")
      .eq("id", "global")
      .single();

    if (stateError) throw stateError;

    // Load all archived candidates (these are the ones shown on the map)
    const { data: archivedRows, error: archiveError } = await (supabase as any)
      .from("atlas_candidates")
      .select("*")
      .eq("is_archived", true)
      .order("created_at", { ascending: false })
      .limit(10000);

    if (archiveError) throw archiveError;

    // Load current population for each regime
    const regimes: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];
    const populations: Record<RegimeId, PopulationState> = {} as Record<RegimeId, PopulationState>;

    for (const regime of regimes) {
      const { data: popRows } = await (supabase as any)
        .from("atlas_candidates")
        .select("*")
        .eq("regime", regime)
        .eq("is_population", true)
        .order("score", { ascending: true });

      const candidates = (popRows || []).map(rowToCandidate);
      const champion = candidates.length > 0 ? candidates[0] : null;

      const regimeArchived = (archivedRows || [])
        .filter((r: CandidateRow) => r.regime === regime)
        .map(rowToCandidate);

      const allRegimeCandidates = [...candidates, ...regimeArchived];
      const metricChampions = allRegimeCandidates.length > 0
        ? computeMetricChampionsFromCandidates(allRegimeCandidates)
        : { ...EMPTY_METRIC_CHAMPIONS };

      populations[regime] = {
        regime,
        candidates,
        champion,
        metricChampions,
        generation: champion?.generation || 0,
        totalEvaluated: (popRows?.length || 0) + regimeArchived.length,
      };
    }

    const archive = (archivedRows || []).map(rowToCandidate);

    return {
      state: {
        populations,
        archive,
        activityLog: [],
        running: true,
        totalGenerations: (globalState as any)?.total_generations || 0,
      },
      cloudStatus: "connected",
    };
  } catch {
    return { state: null, cloudStatus: "unreachable" };
  }
}

// ─── Trigger server-side generation ──────────────────────────────────────────

export async function triggerGeneration(regime?: RegimeId): Promise<{
  success: boolean;
  generation?: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke("atlas-engine", {
      body: { action: "generate", regime },
    });

    if (error) throw error;
    return { success: true, generation: data.generation };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ─── Subscribe to real-time updates ──────────────────────────────────────────

export function subscribeToAtlas(
  onNewCandidates: (candidates: Candidate[]) => void,
  onStateUpdate: (totalGenerations: number) => void,
) {
  const candidateChannel = supabase
    .channel("atlas-candidates-realtime")
    .on(
      "postgres_changes" as any,
      {
        event: "INSERT",
        schema: "public",
        table: "atlas_candidates",
        filter: "is_archived=eq.true",
      },
      (payload: any) => {
        if (payload.new) {
          const candidate = rowToCandidate(payload.new as CandidateRow);
          onNewCandidates([candidate]);
        }
      }
    )
    .subscribe();

  const stateChannel = supabase
    .channel("atlas-state-realtime")
    .on(
      "postgres_changes" as any,
      {
        event: "*",
        schema: "public",
        table: "atlas_state",
      },
      (payload: any) => {
        if (payload.new?.total_generations) {
          onStateUpdate(payload.new.total_generations);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(candidateChannel);
    supabase.removeChannel(stateChannel);
  };
}
