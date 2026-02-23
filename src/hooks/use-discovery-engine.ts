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
  AtlasSync,
  buildPopulationsFromArchive,
} from "@/lib/atlas-sync";
import {
  saveAtlasState,
  loadAtlasStateFromDB,
} from "@/lib/atlas-persistence";

const LOCAL_ARCHIVE_LIMIT = 2000;
const TICK_INTERVAL = 50;
const PERSIST_INTERVAL = 3000;
const REGIME_CYCLE: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];

export type SyncMode = "live" | "persisted" | "memory" | "loading";

export function useDiscoveryEngine() {
  const [state, setState] = useState<EngineState>(() => ({
    ...createInitialState(),
    running: true,
  }));
  const [syncMode, setSyncMode] = useState<SyncMode>("loading");
  const runningRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const initRef = useRef(false);
  const localStartedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const syncRef = useRef<AtlasSync | null>(null);

  // ─── Local engine tick (stable — no deps, uses refs) ───────────────────────

  const tick = useCallback(() => {
    if (!runningRef.current) return;

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
      };
    });

    timeoutRef.current = setTimeout(tick, TICK_INTERVAL);
  }, []);

  // ─── Initialization: Realtime channel → IndexedDB → Fresh start ────────────

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    (async () => {
      // 1. Try Supabase Realtime broadcast channel (no tables needed)
      const sync = new AtlasSync(
        () => stateRef.current,
        (archive, totalGenerations) => {
          setState(prev => {
            if (totalGenerations <= prev.totalGenerations) return prev;
            const populations = buildPopulationsFromArchive(archive);
            return {
              ...prev,
              archive,
              populations,
              totalGenerations,
            };
          });
        },
      );
      syncRef.current = sync;

      const receivedRemoteState = await sync.connect();
      if (cancelled) { sync.cleanup(); return; }

      if (sync.connected) {
        // Connected to Realtime — we're live-syncing with peers
        // If no peer responded, load from IndexedDB as starting point
        if (!receivedRemoteState) {
          const persistedState = await loadAtlasStateFromDB();
          if (!cancelled && persistedState && persistedState.archive.length > 0) {
            setState(persistedState);
          }
        }
        setSyncMode("live");
        return;
      }

      // 2. Realtime unavailable — fall back to IndexedDB
      const persistedState = await loadAtlasStateFromDB();
      if (!cancelled && persistedState && persistedState.archive.length > 0) {
        setState(persistedState);
      }
      setSyncMode("persisted");
    })();

    return () => {
      cancelled = true;
      syncRef.current?.cleanup();
    };
  }, []);

  // ─── IndexedDB periodic persistence (always active as backup) ──────────────

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

  // ─── Start local engine (runs once after init completes) ───────────────────

  useEffect(() => {
    if (syncMode === "loading") return;
    if (localStartedRef.current) return;
    localStartedRef.current = true;

    runningRef.current = true;
    tick();

    return () => {
      runningRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [syncMode, tick]);

  // ─── Toggle persistence (user-facing) ──────────────────────────────────────

  const togglePersistence = useCallback(() => {
    setSyncMode(prev => {
      if (prev === "live") return "memory";
      if (prev === "persisted") return "memory";
      if (prev === "memory") return "persisted";
      return prev;
    });
  }, []);

  // ─── Selection (snapshot-based, survives archive churn) ────────────────────

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

  const clearSelection = useCallback(() => {
    setSelectedCandidate(null);
  }, []);

  return {
    state,
    selectedCandidate,
    selectCandidate,
    clearSelection,
    syncMode,
    togglePersistence,
  };
}
