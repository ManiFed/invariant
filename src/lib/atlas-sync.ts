// Atlas Sync — Supabase Realtime broadcast for cross-client state sharing.
// Implements a leader/follower model so all screens show identical data:
//   - First client (no peers) becomes the leader — runs the engine, broadcasts state
//   - Subsequent clients become followers — stop local generation, display leader's state
//   - If the leader disconnects, a follower promotes after a timeout
//   - Result: all screens show the exact same dashboard at all times

import { supabase } from "@/integrations/supabase/client";
import type { Candidate, RegimeId, PopulationState, ChampionMetric, EngineState, ActivityEntry } from "@/lib/discovery-engine";

const CHANNEL_NAME = "invariant-atlas-live";
const LEADER_BROADCAST_INTERVAL = 1000;
const MAX_SYNC_CANDIDATES = 200;
const STATE_REQUEST_TIMEOUT = 3000;
const FAILOVER_TIMEOUT = 2000;
const FAILOVER_CHECK_INTERVAL = 800; // Check frequently for fast promotion

export type SyncRole = "leader" | "follower";

// ─── Serialization (Float64Array → number[] for JSON) ────────────────────────

interface SyncCandidate {
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

interface SyncPopulationInfo {
  generation: number;
  totalEvaluated: number;
  championId: string | null;
  metricChampionIds: Record<ChampionMetric, string | null>;
}

interface SyncSnapshot {
  totalGenerations: number;
  candidates: SyncCandidate[];
  archiveSize: number;
  populations: Record<RegimeId, SyncPopulationInfo>;
  activityLog: ActivityEntry[];
  ts: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeSnapshot(payload: unknown): SyncSnapshot | null {
  if (!isObject(payload)) return null;

  const totalGenerations = typeof payload.totalGenerations === "number" ? payload.totalGenerations : null;
  const archiveSize = typeof payload.archiveSize === "number" ? payload.archiveSize : null;
  const ts = typeof payload.ts === "number" ? payload.ts : Date.now();
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : null;

  if (totalGenerations === null || archiveSize === null || !candidates) return null;

  const safeCandidates: SyncCandidate[] = candidates.filter((c): c is SyncCandidate => {
    if (!isObject(c)) return false;
    return (
      typeof c.id === "string" &&
      Array.isArray(c.bins) &&
      typeof c.regime === "string" &&
      typeof c.generation === "number" &&
      isObject(c.metrics) &&
      isObject(c.features) &&
      typeof c.stability === "number" &&
      typeof c.score === "number" &&
      typeof c.timestamp === "number"
    );
  });

  const safePopulations = isObject(payload.populations)
    ? payload.populations as Record<RegimeId, SyncPopulationInfo>
    : EMPTY_SYNC_POPULATION_INFO;

  const activityLog = Array.isArray(payload.activityLog) ? payload.activityLog as ActivityEntry[] : [];

  return {
    totalGenerations,
    archiveSize,
    ts,
    candidates: safeCandidates,
    populations: safePopulations,
    activityLog,
  };
}

const EMPTY_SYNC_POPULATION_INFO: Record<RegimeId, SyncPopulationInfo> = {
  "low-vol": {
    generation: 0,
    totalEvaluated: 0,
    championId: null,
    metricChampionIds: { fees: null, utilization: null, lpValue: null, lowSlippage: null, lowArbLeak: null, lowDrawdown: null, stability: null },
  },
  "high-vol": {
    generation: 0,
    totalEvaluated: 0,
    championId: null,
    metricChampionIds: { fees: null, utilization: null, lpValue: null, lowSlippage: null, lowArbLeak: null, lowDrawdown: null, stability: null },
  },
  "jump-diffusion": {
    generation: 0,
    totalEvaluated: 0,
    championId: null,
    metricChampionIds: { fees: null, utilization: null, lpValue: null, lowSlippage: null, lowArbLeak: null, lowDrawdown: null, stability: null },
  },
  "regime-shift": {
    generation: 0,
    totalEvaluated: 0,
    championId: null,
    metricChampionIds: { fees: null, utilization: null, lpValue: null, lowSlippage: null, lowArbLeak: null, lowDrawdown: null, stability: null },
  },
};

export interface RemoteStateExtras {
  archiveSize: number;
  populationInfo: Record<RegimeId, SyncPopulationInfo>;
  activityLog: ActivityEntry[];
}

function serializeCandidate(c: Candidate): SyncCandidate {
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

function deserializeCandidate(s: SyncCandidate): Candidate {
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

// ─── Rebuild populations from archive ────────────────────────────────────────

const EMPTY_METRIC_CHAMPIONS: Record<ChampionMetric, Candidate | null> = {
  fees: null, utilization: null, lpValue: null, lowSlippage: null,
  lowArbLeak: null, lowDrawdown: null, stability: null,
};

function buildPopulationsFromArchive(
  archive: Candidate[],
  populationInfo?: Record<RegimeId, SyncPopulationInfo>,
): Record<RegimeId, PopulationState> {
  const regimes: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];
  const pops = {} as Record<RegimeId, PopulationState>;
  const candidateMap = new Map(archive.map(c => [c.id, c]));

  for (const regime of regimes) {
    const info = populationInfo?.[regime];
    const regimeCandidates = archive.filter(c => c.regime === regime);
    const sorted = [...regimeCandidates].sort((a, b) => a.score - b.score);

    // Resolve champion: prefer synced ID, fall back to best in archive
    let champion: Candidate | null = null;
    if (info?.championId) {
      champion = candidateMap.get(info.championId) ?? null;
    }
    if (!champion && sorted.length > 0) {
      champion = sorted[0];
    }

    // Resolve metric champions: prefer synced IDs, fall back to archive derivation
    const metricChampions: Record<ChampionMetric, Candidate | null> = { ...EMPTY_METRIC_CHAMPIONS };
    let derivedFromSync = false;

    if (info?.metricChampionIds) {
      derivedFromSync = true;
      for (const [metric, id] of Object.entries(info.metricChampionIds)) {
        if (id) {
          metricChampions[metric as ChampionMetric] = candidateMap.get(id) ?? null;
        }
      }
    }

    if (!derivedFromSync) {
      // No sync info available: derive from archive
      for (const c of regimeCandidates) {
        if (!metricChampions.fees || c.metrics.totalFees > metricChampions.fees.metrics.totalFees) metricChampions.fees = c;
        if (!metricChampions.utilization || c.metrics.liquidityUtilization > metricChampions.utilization.metrics.liquidityUtilization) metricChampions.utilization = c;
        if (!metricChampions.lpValue || c.metrics.lpValueVsHodl > metricChampions.lpValue.metrics.lpValueVsHodl) metricChampions.lpValue = c;
        if (!metricChampions.lowSlippage || c.metrics.totalSlippage < metricChampions.lowSlippage.metrics.totalSlippage) metricChampions.lowSlippage = c;
        if (!metricChampions.lowArbLeak || c.metrics.arbLeakage < metricChampions.lowArbLeak.metrics.arbLeakage) metricChampions.lowArbLeak = c;
        if (!metricChampions.lowDrawdown || c.metrics.maxDrawdown < metricChampions.lowDrawdown.metrics.maxDrawdown) metricChampions.lowDrawdown = c;
        if (!metricChampions.stability || c.stability < metricChampions.stability.stability) metricChampions.stability = c;
      }
    }

    pops[regime] = {
      regime,
      candidates: sorted.slice(0, 40),
      champion,
      metricChampions,
      generation: info?.generation ?? (champion?.generation || 0),
      totalEvaluated: info?.totalEvaluated ?? regimeCandidates.length,
    };
  }

  return pops;
}

export { buildPopulationsFromArchive };

// ─── AtlasSync class ─────────────────────────────────────────────────────────

export class AtlasSync {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;
  private failoverTimer: ReturnType<typeof setInterval> | null = null;
  private getState: () => EngineState;
  private onRemoteState: (
    archive: Candidate[],
    totalGenerations: number,
    extras: RemoteStateExtras,
  ) => void;
  private onRoleChange: (role: SyncRole) => void;
  private onLeaderGoodbye?: () => void;
  private _connected = false;
  private _role: SyncRole = "leader";
  private _lastReceivedTs = 0;

  constructor(
    getState: () => EngineState,
    onRemoteState: (
      archive: Candidate[],
      totalGenerations: number,
      extras: RemoteStateExtras,
    ) => void,
    onRoleChange: (role: SyncRole) => void,
    onLeaderGoodbye?: () => void,
  ) {
    this.getState = getState;
    this.onRemoteState = onRemoteState;
    this.onRoleChange = onRoleChange;
    this.onLeaderGoodbye = onLeaderGoodbye;
  }

  /** Join the channel and wait up to 3s for an existing client's state. */
  connect(): Promise<{ receivedState: boolean; role: SyncRole }> {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (receivedState: boolean) => {
        if (resolved) return;
        resolved = true;
        this._role = receivedState ? "follower" : "leader";
        if (this._role === "follower") {
          this.startFailoverCheck();
        }
        resolve({ receivedState, role: this._role });
      };

      const timeout = setTimeout(() => done(false), STATE_REQUEST_TIMEOUT);

      this.channel = supabase.channel(CHANNEL_NAME, {
        config: { broadcast: { self: false } },
      });

      this.channel
        .on("broadcast", { event: "need-state" }, () => {
          this.broadcastState();
        })
        .on("broadcast", { event: "state-snapshot" }, ({ payload }: { payload: unknown }) => {
          this.handleSnapshot(payload);
          if (!resolved) {
            clearTimeout(timeout);
            done(true);
          }
        })
        .on("broadcast", { event: "leader-goodbye" }, ({ payload }: { payload: unknown }) => {
          // Leader is leaving — immediately promote if we're a follower
          if (this._role === "follower") {
            // Accept the final state snapshot if included
            if (isObject(payload)) {
              this.handleSnapshot(payload);
            }
            this._role = "leader";
            this.onRoleChange("leader");
            this.stopFailoverCheck();
            this.onLeaderGoodbye?.();
          }
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            this._connected = true;
            // Ask existing clients for their state
            this.channel!.send({
              type: "broadcast",
              event: "need-state",
              payload: {},
            });
            // Start periodic broadcasting
            this.startBroadcasting();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            done(false);
          }
        });
    });
  }

  private handleSnapshot(payload: unknown) {
    const snapshot = normalizeSnapshot(payload);
    if (!snapshot) return;

    this._lastReceivedTs = Date.now();
    const archive = snapshot.candidates.map(deserializeCandidate);
    const extras: RemoteStateExtras = {
      archiveSize: snapshot.archiveSize,
      populationInfo: snapshot.populations,
      activityLog: snapshot.activityLog,
    };

    if (this._role === "follower") {
      // Followers always adopt the latest state from the leader
      this.onRemoteState(archive, snapshot.totalGenerations, extras);
    } else {
      // Leader: demote to follower if a remote peer is strictly ahead
      const current = this.getState();
      if (snapshot.totalGenerations > current.totalGenerations) {
        this._role = "follower";
        this.onRoleChange("follower");
        this.startFailoverCheck();
        this.onRemoteState(archive, snapshot.totalGenerations, extras);
      }
    }
  }

  private broadcastState() {
    if (!this.channel || !this._connected) return;
    const state = this.getState();
    if (state.archive.length === 0 && state.totalGenerations === 0) return;

    // Collect all important candidate IDs (champions, metric champions)
    // These MUST be included in the snapshot so followers display identical data
    const importantIds = new Set<string>();
    const regimes: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];
    const populationSnapshots = {} as Record<RegimeId, SyncPopulationInfo>;

    for (const rid of regimes) {
      const pop = state.populations[rid];
      if (pop.champion) importantIds.add(pop.champion.id);

      const metricChampionIds: Record<ChampionMetric, string | null> = {
        fees: null, utilization: null, lpValue: null,
        lowSlippage: null, lowArbLeak: null, lowDrawdown: null, stability: null,
      };
      for (const [metric, candidate] of Object.entries(pop.metricChampions)) {
        if (candidate) {
          importantIds.add(candidate.id);
          metricChampionIds[metric as ChampionMetric] = candidate.id;
        }
      }

      populationSnapshots[rid] = {
        generation: pop.generation,
        totalEvaluated: pop.totalEvaluated,
        championId: pop.champion?.id ?? null,
        metricChampionIds,
      };
    }

    // Build candidate list: important candidates first, then fill with recent archive
    const candidateMap = new Map<string, Candidate>();

    // Always include champion and metric champion candidates
    for (const id of importantIds) {
      // Check archive
      const inArchive = state.archive.find(c => c.id === id);
      if (inArchive) { candidateMap.set(id, inArchive); continue; }
      // Check population candidates directly (may not be in archive)
      for (const rid of regimes) {
        const pop = state.populations[rid];
        if (pop.champion?.id === id) { candidateMap.set(id, pop.champion); break; }
        for (const mc of Object.values(pop.metricChampions)) {
          if (mc?.id === id) { candidateMap.set(id, mc); break; }
        }
      }
    }

    // Fill remaining slots with most recent archive candidates
    const remaining = MAX_SYNC_CANDIDATES - candidateMap.size;
    if (remaining > 0) {
      const recentArchive = state.archive.slice(-remaining);
      for (const c of recentArchive) {
        if (!candidateMap.has(c.id)) {
          candidateMap.set(c.id, c);
        }
      }
    }

    const candidates = Array.from(candidateMap.values()).map(serializeCandidate);

    const snapshot: SyncSnapshot = {
      totalGenerations: state.totalGenerations,
      candidates,
      archiveSize: state.archive.length,
      populations: populationSnapshots,
      activityLog: state.activityLog.slice(-50),
      ts: Date.now(),
    };

    this.channel.send({
      type: "broadcast",
      event: "state-snapshot",
      payload: snapshot,
    });
  }

  private startBroadcasting() {
    this.broadcastTimer = setInterval(() => {
      // Only leaders broadcast regularly; followers just listen
      if (this._role === "leader") {
        this.broadcastState();
      }
    }, LEADER_BROADCAST_INTERVAL);
  }

  private startFailoverCheck() {
    this.stopFailoverCheck();
    this._lastReceivedTs = Date.now();
    this.failoverTimer = setInterval(() => {
      if (this._role === "follower" && Date.now() - this._lastReceivedTs > FAILOVER_TIMEOUT) {
        // Leader appears to have disconnected — promote this client
        this._role = "leader";
        this.onRoleChange("leader");
        this.stopFailoverCheck();
      }
    }, FAILOVER_CHECK_INTERVAL);
  }

  private stopFailoverCheck() {
    if (this.failoverTimer) {
      clearInterval(this.failoverTimer);
      this.failoverTimer = null;
    }
  }

  get connected() { return this._connected; }
  get role() { return this._role; }

  /** Send a goodbye broadcast so followers promote instantly, then clean up. */
  sendGoodbye() {
    if (!this.channel || !this._connected || this._role !== "leader") return;
    // Build a final snapshot so the new leader has the freshest state
    const state = this.getState();
    if (state.archive.length > 0 || state.totalGenerations > 0) {
      const regimes: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion", "regime-shift"];
      const populationSnapshots = {} as Record<RegimeId, SyncPopulationInfo>;
      const candidateMap = new Map<string, Candidate>();
      const importantIds = new Set<string>();

      for (const rid of regimes) {
        const pop = state.populations[rid];
        if (!pop) continue;
        if (pop.champion) importantIds.add(pop.champion.id);
        const metricChampionIds: Record<ChampionMetric, string | null> = {
          fees: null, utilization: null, lpValue: null,
          lowSlippage: null, lowArbLeak: null, lowDrawdown: null, stability: null,
        };
        for (const [metric, candidate] of Object.entries(pop.metricChampions)) {
          if (candidate) {
            importantIds.add(candidate.id);
            metricChampionIds[metric as ChampionMetric] = candidate.id;
          }
        }
        populationSnapshots[rid] = {
          generation: pop.generation,
          totalEvaluated: pop.totalEvaluated,
          championId: pop.champion?.id ?? null,
          metricChampionIds,
        };
      }

      for (const id of importantIds) {
        const c = state.archive.find(c => c.id === id);
        if (c) candidateMap.set(id, c);
      }
      const remaining = MAX_SYNC_CANDIDATES - candidateMap.size;
      if (remaining > 0) {
        for (const c of state.archive.slice(-remaining)) {
          if (!candidateMap.has(c.id)) candidateMap.set(c.id, c);
        }
      }

      const snapshot: SyncSnapshot = {
        totalGenerations: state.totalGenerations,
        candidates: Array.from(candidateMap.values()).map(serializeCandidate),
        archiveSize: state.archive.length,
        populations: populationSnapshots,
        activityLog: state.activityLog.slice(-50),
        ts: Date.now(),
      };

      this.channel.send({
        type: "broadcast",
        event: "leader-goodbye",
        payload: snapshot,
      });
    }
  }

  cleanup() {
    if (this.broadcastTimer) clearInterval(this.broadcastTimer);
    this.stopFailoverCheck();
    if (this.channel) supabase.removeChannel(this.channel);
    this._connected = false;
  }
}
