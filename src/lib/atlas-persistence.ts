// Atlas Persistence — IndexedDB storage for the Invariant Atlas
// Saves/loads engine state locally so candidates survive page reloads.
// Float64Array bins are serialized as plain number arrays for storage.

import type {
  EngineState,
  Candidate,
  PopulationState,
  RegimeId,
  ChampionMetric,
  InvariantFamilyId,
} from "@/lib/discovery-engine";

const DB_NAME = "invariant-atlas";
const DB_VERSION = 1;
const STATE_STORE = "engine-state";
const STATE_KEY = "current";
const MAX_PERSISTED_ARCHIVE = 2000;
const MAX_ACTIVITY_LOG = 200;

// ─── IndexedDB setup ──────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Serialization helpers ────────────────────────────────────────────────────

interface SerializedCandidate {
  id: string;
  bins: number[];
  familyId?: InvariantFamilyId;
  familyParams?: Record<string, number>;
  regime: RegimeId;
  generation: number;
  metrics: Candidate["metrics"];
  features: Candidate["features"];
  stability: number;
  score: number;
  timestamp: number;
  source?: Candidate["source"];
  poolType?: Candidate["poolType"];
  assetCount?: number;
  adaptiveProfile?: Candidate["adaptiveProfile"];
}

function serializeCandidate(c: Candidate): SerializedCandidate {
  return {
    id: c.id,
    bins: Array.from(c.bins),
    familyId: c.familyId,
    familyParams: c.familyParams,
    regime: c.regime,
    generation: c.generation,
    metrics: c.metrics,
    features: c.features,
    stability: c.stability,
    score: c.score,
    timestamp: c.timestamp,
    source: c.source,
    poolType: c.poolType,
    assetCount: c.assetCount,
    adaptiveProfile: c.adaptiveProfile,
  };
}

function deserializeCandidate(s: SerializedCandidate): Candidate {
  return {
    ...s,
    familyId: s.familyId ?? "piecewise-bands",
    familyParams: s.familyParams ?? {},
    source: s.source ?? "global",
    poolType: s.poolType ?? "two-asset",
    assetCount: s.assetCount ?? 2,
    bins: new Float64Array(s.bins),
  };
}

interface SerializedPopulation {
  regime: RegimeId;
  candidates: SerializedCandidate[];
  champion: SerializedCandidate | null;
  metricChampions: Record<ChampionMetric, SerializedCandidate | null>;
  generation: number;
  totalEvaluated: number;
}

function serializePopulation(p: PopulationState): SerializedPopulation {
  const metricChampions: Record<ChampionMetric, SerializedCandidate | null> = {} as any;
  for (const [k, v] of Object.entries(p.metricChampions)) {
    metricChampions[k as ChampionMetric] = v ? serializeCandidate(v) : null;
  }
  return {
    regime: p.regime,
    candidates: p.candidates.map(serializeCandidate),
    champion: p.champion ? serializeCandidate(p.champion) : null,
    metricChampions,
    generation: p.generation,
    totalEvaluated: p.totalEvaluated,
  };
}

function deserializePopulation(s: SerializedPopulation): PopulationState {
  const metricChampions: Record<ChampionMetric, Candidate | null> = {} as any;
  for (const [k, v] of Object.entries(s.metricChampions)) {
    metricChampions[k as ChampionMetric] = v ? deserializeCandidate(v) : null;
  }
  return {
    regime: s.regime,
    candidates: s.candidates.map(deserializeCandidate),
    champion: s.champion ? deserializeCandidate(s.champion) : null,
    metricChampions,
    generation: s.generation,
    totalEvaluated: s.totalEvaluated,
  };
}

interface SerializedState {
  populations: Record<RegimeId, SerializedPopulation>;
  archive: SerializedCandidate[];
  activityLog: EngineState["activityLog"];
  totalGenerations: number;
  savedAt: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function saveAtlasState(state: EngineState): Promise<void> {
  try {
    const db = await openDB();
    const archive = state.archive.slice(-MAX_PERSISTED_ARCHIVE);
    const serialized: SerializedState = {
      populations: {
        "low-vol": serializePopulation(state.populations["low-vol"]),
        "high-vol": serializePopulation(state.populations["high-vol"]),
        "jump-diffusion": serializePopulation(state.populations["jump-diffusion"]),
        "regime-shift": serializePopulation(state.populations["regime-shift"]),
      },
      archive: archive.map(serializeCandidate),
      activityLog: state.activityLog.slice(-MAX_ACTIVITY_LOG),
      totalGenerations: state.totalGenerations,
      savedAt: Date.now(),
    };

    const tx = db.transaction(STATE_STORE, "readwrite");
    const store = tx.objectStore(STATE_STORE);
    store.put(serialized, STATE_KEY);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    db.close();
  } catch {
    // Silently fail — IndexedDB may not be available
  }
}

export async function loadAtlasStateFromDB(): Promise<EngineState | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STATE_STORE, "readonly");
    const store = tx.objectStore(STATE_STORE);
    const request = store.get(STATE_KEY);

    const result = await new Promise<SerializedState | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();

    if (!result || !result.populations) return null;

    const emptyPop = (regime: RegimeId): PopulationState => ({
      regime, candidates: [], champion: null,
      metricChampions: { fees: null, utilization: null, lpValue: null, lowSlippage: null, lowArbLeak: null, lowDrawdown: null, stability: null },
      generation: 0, totalEvaluated: 0,
    });
    const archive = result.archive.length > MAX_PERSISTED_ARCHIVE
      ? result.archive.slice(-MAX_PERSISTED_ARCHIVE)
      : result.archive;

    return {
      populations: {
        "low-vol": result.populations["low-vol"] ? deserializePopulation(result.populations["low-vol"]) : emptyPop("low-vol"),
        "high-vol": result.populations["high-vol"] ? deserializePopulation(result.populations["high-vol"]) : emptyPop("high-vol"),
        "jump-diffusion": result.populations["jump-diffusion"] ? deserializePopulation(result.populations["jump-diffusion"]) : emptyPop("jump-diffusion"),
        "regime-shift": result.populations["regime-shift"] ? deserializePopulation(result.populations["regime-shift"]) : emptyPop("regime-shift"),
      },
      archive: archive.map(deserializeCandidate),
      activityLog: (result.activityLog || []).slice(-MAX_ACTIVITY_LOG),
      running: true,
      totalGenerations: result.totalGenerations,
    };
  } catch {
    return null;
  }
}

export async function clearAtlasState(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STATE_STORE, "readwrite");
    tx.objectStore(STATE_STORE).delete(STATE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Silently fail
  }
}
