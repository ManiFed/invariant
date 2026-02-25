import { useState, useCallback, useRef, useEffect } from "react";
import {
  type EngineState,
  type RegimeId,
  type Candidate,
  REGIMES,
  createInitialState,
  runGeneration,
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

const LOCAL_ARCHIVE_LIMIT = 2000;
const CLOUD_ARCHIVE_LIMIT = 10000;
const TICK_INTERVAL = 50;
const PERSIST_INTERVAL = 3000;
const CLOUD_KEEPALIVE_INTERVAL = 45000;
const CLOUD_BACKUP_INTERVAL = 15000;
const CLOUD_STALE_AFTER_MS = 90000;
const REGIME_CYCLE: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion", "regime-shift"];

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
      const population = prev.populations[regimeId];

      const { newPopulation, newCandidates, events } = runGeneration(population, regimeConfig);

      const newArchive = [...prev.archive, ...newCandidates];
      if (newArchive.length > LOCAL_ARCHIVE_LIMIT) {
        newArchive.splice(0, newArchive.length - LOCAL_ARCHIVE_LIMIT);
      }

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
      setState(cloudState);
    };

    (async () => {
      // 1. Try Supabase Realtime broadcast channel
      const sync = new AtlasSync(
        () => stateRef.current,
        // onRemoteState: adopt the leader's state
        (archive, totalGenerations, extras: RemoteStateExtras) => {
          setState(prev => {
            const populations = buildPopulationsFromArchive(archive, extras.populationInfo);
            return {
              ...prev,
              archive,
              populations,
              totalGenerations,
              activityLog: extras.activityLog,
              archiveSize: extras.archiveSize,
            };
          });
        },
        // onRoleChange: sync layer detected a role transition
        (newRole: SyncRole) => {
          setRole(newRole);
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

            if (pickedState && pickedState.archive.length > 0) {
              setState(pickedState);
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
        setState(persistedState);
      }
      setSyncMode("persisted");
    })();

    return () => {
      cancelled = true;
      unsubscribeCloudRef.current?.();
      if (keepaliveIntervalRef.current) clearInterval(keepaliveIntervalRef.current);
      if (cloudBackupIntervalRef.current) clearInterval(cloudBackupIntervalRef.current);
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

    backupNow();
    cloudBackupIntervalRef.current = setInterval(backupNow, CLOUD_BACKUP_INTERVAL);

    const onVisibilityOrUnload = () => {
      if (document.visibilityState === "hidden") {
        backupNow();
      }
    };

    window.addEventListener("visibilitychange", onVisibilityOrUnload);
    window.addEventListener("beforeunload", backupNow);

    return () => {
      if (cloudBackupIntervalRef.current) clearInterval(cloudBackupIntervalRef.current);
      window.removeEventListener("visibilitychange", onVisibilityOrUnload);
      window.removeEventListener("beforeunload", backupNow);
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
      const archive = [...prev.archive, ...candidates];
      if (archive.length > LOCAL_ARCHIVE_LIMIT) {
        archive.splice(0, archive.length - LOCAL_ARCHIVE_LIMIT);
      }

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
