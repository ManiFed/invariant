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
  subscribeToAtlas,
} from "@/lib/atlas-cloud";
import {
  buildPopulationsFromArchive,
} from "@/lib/atlas-sync";
import {
  saveAtlasState,
  loadAtlasStateFromDB,
} from "@/lib/atlas-persistence";

const LOCAL_ARCHIVE_LIMIT = 2000;
const CLOUD_ARCHIVE_LIMIT = 10000;
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
  const unsubscribeCloudRef = useRef<(() => void) | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const initRef = useRef(false);
  const localStartedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

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
      const { state: cloudState, cloudStatus } = await loadAtlasState();
      if (cancelled) return;

      if (cloudStatus === "connected" && cloudState) {
        setState(cloudState);
        setSyncMode("live");

        unsubscribeCloudRef.current = subscribeToAtlas(
          (newCandidates) => {
            setState(prev => {
              const known = new Set(prev.archive.map(c => c.id));
              const deduped = newCandidates.filter(c => !known.has(c.id));
              if (deduped.length === 0) return prev;

              const archive = [...prev.archive, ...deduped];
              archive.sort((a, b) => a.timestamp - b.timestamp);
              if (archive.length > CLOUD_ARCHIVE_LIMIT) {
                archive.splice(0, archive.length - CLOUD_ARCHIVE_LIMIT);
              }

              return {
                ...prev,
                archive,
                populations: buildPopulationsFromArchive(archive),
              };
            });
          },
          (totalGenerations) => {
            setState(prev => ({
              ...prev,
              totalGenerations: Math.max(prev.totalGenerations, totalGenerations),
            }));
            refreshFromCloud();
          },
        );
        return;
      }

      const persistedState = await loadAtlasStateFromDB();
      if (!cancelled && persistedState && persistedState.archive.length > 0) {
        setState(persistedState);
      }
      setSyncMode("persisted");
    })();

    return () => {
      cancelled = true;
      unsubscribeCloudRef.current?.();
    };
  }, []);

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

  useEffect(() => {
    if (syncMode === "loading" || syncMode === "live") return;
    if (localStartedRef.current) return;
    localStartedRef.current = true;

    runningRef.current = true;
    tick();

    return () => {
      runningRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [syncMode, tick]);

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
