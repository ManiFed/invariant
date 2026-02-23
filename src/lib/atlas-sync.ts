// Atlas Sync — Supabase Realtime broadcast for cross-client state sharing.
// No database tables needed. All clients join a WebSocket channel:
//   - On join, request state from any existing client
//   - If a client responds with higher generation count, adopt their state
//   - Every few seconds, broadcast our state so new joiners pick it up
//   - Result: all visitors see the same Atlas map and dashboard

import { supabase } from "@/integrations/supabase/client";
import type { Candidate, RegimeId, PopulationState, ChampionMetric, EngineState } from "@/lib/discovery-engine";

const CHANNEL_NAME = "invariant-atlas-live";
const BROADCAST_INTERVAL = 4000;
const MAX_SYNC_CANDIDATES = 500;
const STATE_REQUEST_TIMEOUT = 3000;

// ─── Serialization (Float64Array → number[] for JSON) ────────────────────────

interface SyncCandidate {
  id: string;
  bins: number[];
  regime: RegimeId;
  generation: number;
  metrics: Candidate["metrics"];
  features: Candidate["features"];
  stability: number;
  score: number;
  timestamp: number;
}

interface SyncSnapshot {
  totalGenerations: number;
  candidates: SyncCandidate[];
  ts: number; // sender timestamp for dedup
}

function serializeCandidate(c: Candidate): SyncCandidate {
  return {
    id: c.id,
    bins: Array.from(c.bins),
    regime: c.regime,
    generation: c.generation,
    metrics: c.metrics,
    features: c.features,
    stability: c.stability,
    score: c.score,
    timestamp: c.timestamp,
  };
}

function deserializeCandidate(s: SyncCandidate): Candidate {
  return {
    ...s,
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
): Record<RegimeId, PopulationState> {
  const regimes: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];
  const pops: Record<RegimeId, PopulationState> = {} as any;

  for (const regime of regimes) {
    const regimeCandidates = archive.filter(c => c.regime === regime);
    const sorted = [...regimeCandidates].sort((a, b) => a.score - b.score);
    const champion = sorted.length > 0 ? sorted[0] : null;

    const metricChampions: Record<ChampionMetric, Candidate | null> = { ...EMPTY_METRIC_CHAMPIONS };
    for (const c of regimeCandidates) {
      if (!metricChampions.fees || c.metrics.totalFees > metricChampions.fees.metrics.totalFees) metricChampions.fees = c;
      if (!metricChampions.utilization || c.metrics.liquidityUtilization > metricChampions.utilization.metrics.liquidityUtilization) metricChampions.utilization = c;
      if (!metricChampions.lpValue || c.metrics.lpValueVsHodl > metricChampions.lpValue.metrics.lpValueVsHodl) metricChampions.lpValue = c;
      if (!metricChampions.lowSlippage || c.metrics.totalSlippage < metricChampions.lowSlippage.metrics.totalSlippage) metricChampions.lowSlippage = c;
      if (!metricChampions.lowArbLeak || c.metrics.arbLeakage < metricChampions.lowArbLeak.metrics.arbLeakage) metricChampions.lowArbLeak = c;
      if (!metricChampions.lowDrawdown || c.metrics.maxDrawdown < metricChampions.lowDrawdown.metrics.maxDrawdown) metricChampions.lowDrawdown = c;
      if (!metricChampions.stability || c.stability < metricChampions.stability.stability) metricChampions.stability = c;
    }

    pops[regime] = {
      regime,
      candidates: sorted.slice(0, 40),
      champion,
      metricChampions,
      generation: champion?.generation || 0,
      totalEvaluated: regimeCandidates.length,
    };
  }

  return pops;
}

export { buildPopulationsFromArchive };

// ─── AtlasSync class ─────────────────────────────────────────────────────────

export class AtlasSync {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;
  private getState: () => EngineState;
  private onRemoteState: (archive: Candidate[], totalGenerations: number) => void;
  private _connected = false;
  private _peerCount = 0;

  constructor(
    getState: () => EngineState,
    onRemoteState: (archive: Candidate[], totalGenerations: number) => void,
  ) {
    this.getState = getState;
    this.onRemoteState = onRemoteState;
  }

  /** Join the channel and wait up to 3s for an existing client's state. */
  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (receivedState: boolean) => {
        if (resolved) return;
        resolved = true;
        resolve(receivedState);
      };

      const timeout = setTimeout(() => done(false), STATE_REQUEST_TIMEOUT);

      this.channel = supabase.channel(CHANNEL_NAME, {
        config: { broadcast: { self: false } },
      });

      this.channel
        .on("broadcast", { event: "need-state" }, () => {
          // Another client is asking for state — respond immediately
          this.broadcastState();
        })
        .on("broadcast", { event: "state-snapshot" }, ({ payload }: { payload: SyncSnapshot }) => {
          this.handleSnapshot(payload);
          if (!resolved) {
            clearTimeout(timeout);
            done(true);
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

  private handleSnapshot(payload: SyncSnapshot) {
    const current = this.getState();
    if (payload.totalGenerations > current.totalGenerations) {
      const archive = payload.candidates.map(deserializeCandidate);
      this.onRemoteState(archive, payload.totalGenerations);
    }
  }

  private broadcastState() {
    if (!this.channel || !this._connected) return;
    const state = this.getState();
    if (state.archive.length === 0 && state.totalGenerations === 0) return;

    // Send the most recent candidates (cap at MAX to stay under 1MB WebSocket limit)
    const candidates = state.archive
      .slice(-MAX_SYNC_CANDIDATES)
      .map(serializeCandidate);

    const snapshot: SyncSnapshot = {
      totalGenerations: state.totalGenerations,
      candidates,
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
      this.broadcastState();
    }, BROADCAST_INTERVAL);
  }

  get connected() { return this._connected; }

  cleanup() {
    if (this.broadcastTimer) clearInterval(this.broadcastTimer);
    if (this.channel) supabase.removeChannel(this.channel);
    this._connected = false;
  }
}
