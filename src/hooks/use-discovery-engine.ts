import { useState, useCallback, useRef, useEffect } from "react";
import {
  type EngineState,
  type RegimeId,
  type Candidate,
  type InvariantFamilyId,
  REGIMES,
  INVARIANT_FAMILIES,
  createInitialState,
  runGeneration,
  learnMlRecommendation,
  normalizeBins,
  NUM_BINS,
  TOTAL_LIQUIDITY,
} from "@/lib/discovery-engine";
import {
  loadAtlasState,
  triggerGeneration,
  backupAtlasState,
} from "@/lib/atlas-cloud";
import {
  AtlasSync,
  buildPopulationsFromArchive,
  type SyncRole,
  type RemoteStateExtras,
} from "@/lib/atlas-sync";
import {
  saveAtlasState,
  loadAtlasStateFromDB,
} from "@/lib/atlas-persistence";

const LOCAL_ARCHIVE_LIMIT = 5000;
const CLOUD_ARCHIVE_LIMIT = 5000;
const TICK_INTERVAL = 35;
const PERSIST_INTERVAL = 3000;
const CLOUD_KEEPALIVE_INTERVAL = 45000;
const CLOUD_BACKUP_INTERVAL = 60000; // Backup to cloud every 60s
const CLOUD_STALE_AFTER_MS = 90000;
const REGIME_CYCLE: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion", "regime-shift"];

function clampArchive<T>(archive: T[], limit = LOCAL_ARCHIVE_LIMIT): T[] {
  if (archive.length <= limit) return archive;
  return archive.slice(-limit);
}

function normalizeLoadedState(next: EngineState): EngineState {
  return {
    ...next,
    archive: clampArchive(next.archive),
    activityLog: next.activityLog.slice(-200),
  };
}

function hasRecoverableState(next: EngineState | null | undefined): next is EngineState {
  if (!next) return false;
  if (next.totalGenerations > 0) return true;
  if (next.archive.length > 0) return true;
  const regimes: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion", "regime-shift"];
  return regimes.some((regimeId) => {
    const population = next.populations[regimeId];
    return !!population && (population.candidates.length > 0 || population.champion !== null || population.generation > 0 || population.totalEvaluated > 0);
  });
}

export type SyncMode = "live" | "persisted" | "memory" | "loading";

export function useDiscoveryEngine() {
  const [state, setState] = useState<EngineState>(() => ({
    ...createInitialState(),
    running: true,
  }));
  const [syncMode, setSyncMode] = useState<SyncMode>("loading");
  const [role, setRole] = useState<SyncRole>("leader");
  const runningRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubscribeCloudRef = useRef<(() => void) | null>(null);
  const keepaliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cloudBackupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generationPulseRef = useRef<number>(Date.now());
  const generationInFlightRef = useRef(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const initRef = useRef(false);
  const tickActiveRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const syncRef = useRef<AtlasSync | null>(null);
  const roleRef = useRef(role);
  roleRef.current = role;

  // ─── Local engine tick (only runs when role === "leader") ─────────────────

  const tick = useCallback(() => {
    if (!runningRef.current || roleRef.current !== "leader") return;

    setState(prev => {
      const regimeIdx = prev.totalGenerations % REGIME_CYCLE.length;
      const regimeId = REGIME_CYCLE[regimeIdx];
      const regimeConfig = REGIMES.find(r => r.id === regimeId)!;
      const population = prev.populations[regimeId] ?? {
        regime: regimeId, candidates: [], champion: null,
        metricChampions: { fees: null, utilization: null, lpValue: null, lowSlippage: null, lowArbLeak: null, lowDrawdown: null, stability: null },
        generation: 0, totalEvaluated: 0,
      };

      const recommendationPool = [
        ...population.candidates,
        ...prev.archive.filter((candidate) => candidate.regime === regimeId).slice(-120),
      ];
      const recommendation = learnMlRecommendation(recommendationPool);

      const { newPopulation, newCandidates, events } = runGeneration(population, regimeConfig, { recommendation });

      const newArchive = clampArchive([...prev.archive, ...newCandidates]);

      return {
        ...prev,
        populations: { ...prev.populations, [regimeId]: newPopulation },
        archive: newArchive,
        activityLog: [...prev.activityLog, ...events].slice(-200),
        totalGenerations: prev.totalGenerations + 1,
        // Leader always shows own archive.length
        archiveSize: undefined,
      };
    });

    timeoutRef.current = setTimeout(tick, TICK_INTERVAL);
  }, []);

  // ─── Tick start/stop helpers ──────────────────────────────────────────────

  const startTick = useCallback(() => {
    if (tickActiveRef.current) return;
    tickActiveRef.current = true;
    runningRef.current = true;
    tick();
  }, [tick]);

  const stopTick = useCallback(() => {
    tickActiveRef.current = false;
    runningRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // ─── Initialization: Realtime channel → IndexedDB → Fresh start ────────────

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    const refreshFromCloud = async () => {
      const { state: cloudState } = await loadAtlasState();
      if (cancelled || !cloudState) return;
      setState(normalizeLoadedState(cloudState));
    };

    (async () => {
      // 1. Try cross-tab BroadcastChannel sync
      const sync = new AtlasSync(
        () => stateRef.current,
        // onRemoteState: adopt the leader's state
        (archive, totalGenerations, extras: RemoteStateExtras) => {
          setState(prev => {
            // Filter out any malformed candidates before processing
            const safeArchive = archive.filter(c => c != null && typeof c.score === "number" && Number.isFinite(c.score));
            const trimmedArchive = clampArchive(safeArchive);
            const populations = buildPopulationsFromArchive(trimmedArchive, extras.populationInfo);
            return {
              ...prev,
              archive: trimmedArchive,
              populations,
              totalGenerations,
              activityLog: extras.activityLog.slice(-200),
              archiveSize: extras.archiveSize,
            };
          });
        },
        // onRoleChange: sync layer detected a role transition
        (newRole: SyncRole) => {
          setRole(newRole);
        },
        // onLeaderGoodbye: new leader should immediately save state
        () => {
          // Immediately persist when we get promoted from a goodbye
          void saveAtlasState(stateRef.current);
          void backupAtlasState(stateRef.current);
        },
      );
      syncRef.current = sync;

      const { receivedState, role: initialRole } = await sync.connect();
      if (cancelled) { sync.cleanup(); return; }

      if (sync.connected) {
        setRole(initialRole);
        setSyncMode("live");

        // If no peer responded, recover from cloud first, then IndexedDB.
        if (!receivedState) {
          const { state: cloudState } = await loadAtlasState();
          const persistedState = await loadAtlasStateFromDB();
          if (!cancelled) {
            const pickedState = (() => {
              if (cloudState && persistedState) {
                return cloudState.totalGenerations >= persistedState.totalGenerations ? cloudState : persistedState;
              }
              return cloudState || persistedState;
            })();

            if (hasRecoverableState(pickedState)) {
              setState(normalizeLoadedState(pickedState));
            }
          }
        }

        keepaliveIntervalRef.current = setInterval(() => {
          if (cancelled || roleRef.current !== "leader") return;

          const staleFor = Date.now() - generationPulseRef.current;
          if (staleFor > CLOUD_STALE_AFTER_MS) {
            void refreshFromCloud();
            void triggerGeneration();
          }
        }, CLOUD_KEEPALIVE_INTERVAL);

        return;
      }

      // 2. Realtime unavailable — fall back to IndexedDB (always leader locally)
      setRole("leader");
      const persistedState = await loadAtlasStateFromDB();
      if (!cancelled && persistedState && persistedState.archive.length > 0) {
        setState(normalizeLoadedState(persistedState));
      }
      setSyncMode("persisted");
    })();

    return () => {
      cancelled = true;
      // Send goodbye so followers promote instantly
      syncRef.current?.sendGoodbye();
      unsubscribeCloudRef.current?.();
      if (keepaliveIntervalRef.current) clearInterval(keepaliveIntervalRef.current);
      if (cloudBackupIntervalRef.current) clearInterval(cloudBackupIntervalRef.current);
      // Final backup on teardown
      void saveAtlasState(stateRef.current);
      void backupAtlasState(stateRef.current);
      syncRef.current?.cleanup();
      syncRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (syncMode !== "live") return;

    const backupNow = () => {
      if (roleRef.current !== "leader") return;
      void backupAtlasState(stateRef.current);
    };

    // Initial backup right away
    backupNow();
    cloudBackupIntervalRef.current = setInterval(backupNow, CLOUD_BACKUP_INTERVAL);

    const onBeforeUnload = () => {
      // Send goodbye broadcast for instant follower promotion
      syncRef.current?.sendGoodbye();
      // Final backup
      backupNow();
      void saveAtlasState(stateRef.current);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        backupNow();
        void saveAtlasState(stateRef.current);
      }
    };

    window.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      if (cloudBackupIntervalRef.current) clearInterval(cloudBackupIntervalRef.current);
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      backupNow();
    };
  }, [syncMode, role]);

  useEffect(() => {
    if (syncMode === "loading" || syncMode === "memory") return;

    const persist = () => {
      saveAtlasState(stateRef.current);
    };

    persist();
    persistIntervalRef.current = setInterval(persist, PERSIST_INTERVAL);

    return () => {
      if (persistIntervalRef.current) clearInterval(persistIntervalRef.current);
      saveAtlasState(stateRef.current);
    };
  }, [syncMode]);

  // ─── Fork seed injection from Library ─────────────────────────────────────

  useEffect(() => {
    if (syncMode === "loading") return;
    const raw = localStorage.getItem("atlas-fork-seed");
    if (!raw) return;
    localStorage.removeItem("atlas-fork-seed");

    try {
      const seed = JSON.parse(raw);
      const regime: RegimeId = seed.regime || "low-vol";
      const familyId: InvariantFamilyId = seed.familyId || "piecewise-bands";

      let bins: Float64Array;
      if (seed.bins && Array.isArray(seed.bins) && seed.bins.length > 0) {
        bins = new Float64Array(seed.bins);
      } else {
        const family = INVARIANT_FAMILIES.find(f => f.id === familyId) || INVARIANT_FAMILIES[0];
        bins = family.generateBins(seed.familyParams || family.sampleParams());
      }
      normalizeBins(bins);

      const forkCandidate: Candidate = {
        id: `fork_${Date.now().toString(36)}`,
        bins,
        familyId,
        familyParams: seed.familyParams || {},
        regime,
        generation: 0,
        metrics: { totalFees: 0, totalSlippage: 0, arbLeakage: 0, liquidityUtilization: 0, lpValueVsHodl: 1, maxDrawdown: 0, volatilityOfReturns: 0 },
        features: { curvature: 0, curvatureGradient: 0, entropy: 0, symmetry: 0, tailDensityRatio: 0, peakConcentration: 0, concentrationWidth: 0 },
        stability: 0,
        score: 0,
        timestamp: Date.now(),
        source: "user-designed",
        contributor: seed.name || "Library Fork",
      };

      setState(prev => {
        const pop = prev.populations[regime];
        const newCandidates = [forkCandidate, ...pop.candidates.slice(0, pop.candidates.length - 1)];
        return {
          ...prev,
          populations: {
            ...prev.populations,
            [regime]: { ...pop, candidates: newCandidates },
          },
          activityLog: [...prev.activityLog, {
            timestamp: Date.now(),
            regime,
            type: "generation-complete" as const,
            message: `Forked "${seed.name || "Library AMM"}" into ${regime} population`,
            generation: pop.generation,
          }].slice(-200),
        };
      });
    } catch (e) {
      console.warn("Failed to inject fork seed:", e);
    }
  }, [syncMode]);

  // ─── Start/stop engine based on sync mode and role ────────────────────────

  useEffect(() => {
    if (syncMode === "loading") return;

    if (role === "leader") {
      startTick();
    } else {
      stopTick();
    }

    return () => {
      stopTick();
    };
  }, [syncMode, role, startTick, stopTick]);

  const togglePersistence = useCallback(() => {
    if (syncMode === "live") return;
    setSyncMode(prev => {
      if (prev === "persisted") return "memory";
      if (prev === "memory") return "persisted";
      return prev;
    });
  }, [syncMode]);

  const selectCandidate = useCallback((id: string) => {
    setState(currentState => {
      const found = currentState.archive.find(c => c.id === id);
      if (found) {
        setSelectedCandidate(found);
        return currentState;
      }
      for (const pop of Object.values(currentState.populations)) {
        if (pop.champion?.id === id) { setSelectedCandidate(pop.champion); return currentState; }
        const inPop = pop.candidates.find(c => c.id === id);
        if (inPop) { setSelectedCandidate(inPop); return currentState; }
        for (const mc of Object.values(pop.metricChampions)) {
          if (mc?.id === id) { setSelectedCandidate(mc); return currentState; }
        }
      }
      return currentState;
    });
  }, []);


  const ingestExperimentCandidates = useCallback((candidates: Candidate[], note?: string) => {
    if (candidates.length === 0) return;

    setState(prev => {
      const archive = clampArchive([...prev.archive, ...candidates]);

      const activityLog = [
        ...prev.activityLog,
        {
          timestamp: Date.now(),
          regime: candidates[0].regime,
          type: "generation-complete" as const,
          message: note ?? `Imported ${candidates.length} experiment candidates into archive`,
          generation: candidates[0].generation,
        },
      ].slice(-200);

      return {
        ...prev,
        archive,
        activityLog,
      };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCandidate(null);
  }, []);

  return {
    state,
    selectedCandidate,
    selectCandidate,
    clearSelection,
    syncMode,
    role,
    togglePersistence,
    ingestExperimentCandidates,
  };
}
