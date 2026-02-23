// Atlas Cloud Storage — Supabase integration for the Invariant Atlas
// Loads candidates from the database and subscribes to real-time updates.
// Falls back to local-only engine if Supabase is unavailable.

import { supabase } from "@/integrations/supabase/client";
import type { Candidate, RegimeId, MetricVector, FeatureDescriptor, EngineState, PopulationState, ChampionMetric, ActivityEntry } from "@/lib/discovery-engine";
import { scoreCandidate } from "@/lib/discovery-engine";

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
  state: EngineState;
  cloudAvailable: boolean;
}> {
  try {
    // Load global state
    const { data: globalState, error: stateError } = await supabase
      .from("atlas_state")
      .select("*")
      .eq("id", "global")
      .single();

    if (stateError) throw stateError;

    // Load all archived candidates (these are the ones shown on the map)
    const { data: archivedRows, error: archiveError } = await supabase
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
      const { data: popRows } = await supabase
        .from("atlas_candidates")
        .select("*")
        .eq("regime", regime)
        .eq("is_population", true)
        .order("score", { ascending: true });

      const candidates = (popRows || []).map(rowToCandidate);
      const champion = candidates.length > 0 ? candidates[0] : null;
      const metricChampions = candidates.length > 0
        ? computeMetricChampionsFromCandidates(candidates)
        : { ...EMPTY_METRIC_CHAMPIONS };

      // Also compute metric champions from archived candidates for this regime
      const regimeArchived = (archivedRows || [])
        .filter((r: CandidateRow) => r.regime === regime)
        .map(rowToCandidate);

      const allRegimeCandidates = [...candidates, ...regimeArchived];
      const fullMetricChampions = allRegimeCandidates.length > 0
        ? computeMetricChampionsFromCandidates(allRegimeCandidates)
        : metricChampions;

      populations[regime] = {
        regime,
        candidates,
        champion,
        metricChampions: fullMetricChampions,
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
        totalGenerations: globalState?.total_generations || 0,
      },
      cloudAvailable: true,
    };
  } catch {
    // Supabase not available or tables don't exist yet
    return {
      state: {
        populations: {
          "low-vol": { regime: "low-vol", candidates: [], champion: null, metricChampions: { ...EMPTY_METRIC_CHAMPIONS }, generation: 0, totalEvaluated: 0 },
          "high-vol": { regime: "high-vol", candidates: [], champion: null, metricChampions: { ...EMPTY_METRIC_CHAMPIONS }, generation: 0, totalEvaluated: 0 },
          "jump-diffusion": { regime: "jump-diffusion", candidates: [], champion: null, metricChampions: { ...EMPTY_METRIC_CHAMPIONS }, generation: 0, totalEvaluated: 0 },
        },
        archive: [],
        activityLog: [],
        running: true,
        totalGenerations: 0,
      },
      cloudAvailable: false,
    };
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
  // Subscribe to new archived candidates
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

  // Subscribe to state updates
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
