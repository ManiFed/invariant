// Atlas Cloud Storage — PostgreSQL-backed Atlas API integration.
// Falls back to IndexedDB persistence if API is unavailable.

import type { Candidate, RegimeId, MetricVector, FeatureDescriptor, EngineState, PopulationState, ChampionMetric } from "@/lib/discovery-engine";

export type CloudStatus = "connected" | "no-tables" | "unreachable" | "loading";

const MAX_CLOUD_ARCHIVE = 5000;
const ATLAS_API_BASE = (import.meta.env.VITE_ATLAS_API_BASE as string | undefined) ?? "/api/atlas";

interface CandidateRow {
  id: number;
  candidate_id: string;
  regime: string;
  generation: number;
  bins: number[];
  family_id?: string;
  family_params?: Record<string, number>;
  source?: Candidate["source"];
  pool_type?: Candidate["poolType"];
  asset_count?: number;
  adaptive_profile?: Candidate["adaptiveProfile"];
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
    familyId: (row.family_id as Candidate["familyId"]) ?? "piecewise-bands",
    familyParams: row.family_params ?? {},
    regime: row.regime as RegimeId,
    generation: row.generation,
    metrics: row.metrics,
    features: row.features,
    stability: row.stability,
    score: row.score,
    timestamp: new Date(row.created_at).getTime(),
    source: row.source ?? "global",
    poolType: row.pool_type ?? "two-asset",
    assetCount: row.asset_count ?? 2,
    adaptiveProfile: row.adaptive_profile,
  };
}

async function atlasApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ATLAS_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export async function checkCloudStatus(): Promise<CloudStatus> {
  try {
    const data = await atlasApi<{ status: CloudStatus }>("/status");
    return data.status;
  } catch {
    return "unreachable";
  }
}

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

export async function loadAtlasState(): Promise<{ state: EngineState | null; cloudStatus: CloudStatus }> {
  const status = await checkCloudStatus();
  if (status !== "connected") return { state: null, cloudStatus: status };

  try {
    const data = await atlasApi<{ state: { globalState: { total_generations: number } | null; archivedRows: CandidateRow[]; populations: Record<string, CandidateRow[]> } }>("/state");
    const { globalState, archivedRows, populations: cloudPopulations } = data.state;

    const regimes: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];
    const populations: Record<RegimeId, PopulationState> = {} as Record<RegimeId, PopulationState>;

    for (const regime of regimes) {
      const popRows = cloudPopulations[regime] ?? [];
      const candidates = popRows.map(rowToCandidate);
      const champion = candidates.length > 0 ? candidates[0] : null;

      const regimeArchived = archivedRows.filter((r) => r.regime === regime).map(rowToCandidate);
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
        totalEvaluated: popRows.length + regimeArchived.length,
      };
    }

    const archive = archivedRows.slice(-MAX_CLOUD_ARCHIVE).map(rowToCandidate);

    return {
      state: {
        populations,
        archive,
        activityLog: [],
        running: true,
        totalGenerations: globalState?.total_generations || 0,
      },
      cloudStatus: "connected",
    };
  } catch {
    return { state: null, cloudStatus: "unreachable" };
  }
}

export async function triggerGeneration(regime?: RegimeId): Promise<{ success: boolean; generation?: number; error?: string }> {
  try {
    const data = await atlasApi<{ success: boolean; generation: number }>("/generate", {
      method: "POST",
      body: JSON.stringify({ regime }),
    });
    return { success: data.success, generation: data.generation };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

interface CloudBackupCandidate {
  id: string;
  bins: number[];
  familyId?: Candidate["familyId"];
  familyParams?: Candidate["familyParams"];
  regime: RegimeId;
  generation: number;
  metrics: Candidate["metrics"];
  features: Candidate["features"];
  stability: number;
  score: number;
  timestamp: number;
  source?: Candidate["source"];
  poolType?: Candidate["poolType"];
  assetCount?: Candidate["assetCount"];
  adaptiveProfile?: Candidate["adaptiveProfile"];
}

function serializeCandidateForBackup(candidate: Candidate): CloudBackupCandidate {
  return {
    id: candidate.id,
    bins: Array.from(candidate.bins),
    familyId: candidate.familyId,
    familyParams: candidate.familyParams,
    regime: candidate.regime,
    generation: candidate.generation,
    metrics: candidate.metrics,
    features: candidate.features,
    stability: candidate.stability,
    score: candidate.score,
    timestamp: candidate.timestamp,
    source: candidate.source,
    poolType: candidate.poolType,
    assetCount: candidate.assetCount,
    adaptiveProfile: candidate.adaptiveProfile,
  };
}

export async function backupAtlasState(state: EngineState): Promise<{ success: boolean; error?: string }> {
  if (state.archive.length === 0 && state.totalGenerations === 0) return { success: true };

  const archive = state.archive.slice(-MAX_CLOUD_ARCHIVE).map(serializeCandidateForBackup);
  const populations: Record<RegimeId, CloudBackupCandidate[]> = {
    "low-vol": state.populations["low-vol"].candidates.map(serializeCandidateForBackup),
    "high-vol": state.populations["high-vol"].candidates.map(serializeCandidateForBackup),
    "jump-diffusion": state.populations["jump-diffusion"].candidates.map(serializeCandidateForBackup),
    "regime-shift": (state.populations["regime-shift"]?.candidates ?? []).map(serializeCandidateForBackup),
  };

  try {
    const data = await atlasApi<{ success: boolean; error?: string }>("/backup", {
      method: "POST",
      body: JSON.stringify({ totalGenerations: state.totalGenerations, archive, populations }),
    });
    return data.success ? { success: true } : { success: false, error: data.error ?? "unknown backup failure" };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export function subscribeToAtlas() {
  return () => {
    // Realtime sync is handled by AtlasSync (BroadcastChannel + localStorage).
  };
}
