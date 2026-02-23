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
  subscribeToAtlas,
  type CloudStatus,
} from "@/lib/atlas-cloud";
import {
  saveAtlasState,
  loadAtlasStateFromDB,
} from "@/lib/atlas-persistence";

const LOCAL_ARCHIVE_LIMIT = 2000;
const CLOUD_ARCHIVE_LIMIT = 10000;
const TICK_INTERVAL = 50; // ms between local generation ticks
const CLOUD_GENERATION_INTERVAL = 8000; // ms between cloud generation triggers
const PERSIST_INTERVAL = 3000; // ms between IndexedDB saves
const REGIME_CYCLE: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];

export type SyncMode = "cloud" | "persisted" | "memory" | "loading";

export function useDiscoveryEngine() {
  const [state, setState] = useState<EngineState>(() => ({
    ...createInitialState(),
    running: true,
  }));
  const [syncMode, setSyncMode] = useState<SyncMode>("loading");
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("loading");
  const runningRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const persistIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const initRef = useRef(false);
  const localStartedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Use a ref for syncMode inside tick so tick never needs to be recreated
  const syncModeRef = useRef<SyncMode>(syncMode);
  syncModeRef.current = syncMode;

  // ─── Local engine tick (stable — no deps, uses refs) ───────────────────────

  const tick = useCallback(() => {
    if (!runningRef.current) return;

    setState(prev => {
      const regimeIdx = prev.totalGenerations % REGIME_CYCLE.length;
      const regimeId = REGIME_CYCLE[regimeIdx];
      const regimeConfig = REGIMES.find(r => r.id === regimeId)!;
      const population = prev.populations[regimeId];

      const { newPopulation, newCandidates, events } = runGeneration(population, regimeConfig);

      const limit = syncModeRef.current === "cloud" ? CLOUD_ARCHIVE_LIMIT : LOCAL_ARCHIVE_LIMIT;
      const newArchive = [...prev.archive, ...newCandidates];
      if (newArchive.length > limit) {
        newArchive.splice(0, newArchive.length - limit);
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
  }, []); // stable — reads syncMode from ref

  // ─── Initialization: Cloud → IndexedDB → Memory ────────────────────────────

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    (async () => {
      // 1. Try Supabase cloud
      const { state: cloudState, cloudStatus: status } = await loadAtlasState();

      if (cancelled) return;
      setCloudStatus(status);

      if (status === "connected" && cloudState) {
        setState(cloudState);
        setSyncMode("cloud");
        return;
      }

      // 2. Try IndexedDB
      const persistedState = await loadAtlasStateFromDB();

      if (cancelled) return;

      if (persistedState && persistedState.archive.length > 0) {
        setState(persistedState);
      }

      // Always use "persisted" — IndexedDB saves silently fail if unavailable
      setSyncMode("persisted");
    })();

    return () => { cancelled = true; };
  }, []);

  // ─── Real-time subscription (cloud mode only) ──────────────────────────────

  useEffect(() => {
    if (syncMode !== "cloud") return;

    const unsubscribe = subscribeToAtlas(
      (newCandidates) => {
        setState(prev => {
          const newArchive = [...prev.archive, ...newCandidates];
          if (newArchive.length > CLOUD_ARCHIVE_LIMIT) {
            newArchive.splice(0, newArchive.length - CLOUD_ARCHIVE_LIMIT);
          }

          const newPops = { ...prev.populations };
          for (const c of newCandidates) {
            const pop = newPops[c.regime];
            if (!pop.champion || c.score < pop.champion.score) {
              newPops[c.regime] = {
                ...pop,
                champion: c,
                totalEvaluated: pop.totalEvaluated + 1,
              };
            }
          }

          return {
            ...prev,
            populations: newPops,
            archive: newArchive,
          };
        });
      },
      (totalGenerations) => {
        setState(prev => ({
          ...prev,
          totalGenerations: Math.max(prev.totalGenerations, totalGenerations),
        }));
      }
    );

    return unsubscribe;
  }, [syncMode]);

  // ─── Cloud generation trigger (cloud mode only) ────────────────────────────

  useEffect(() => {
    if (syncMode !== "cloud") return;

    let genIndex = 0;
    const trigger = async () => {
      const regime = REGIME_CYCLE[genIndex % REGIME_CYCLE.length];
      genIndex++;
      const result = await triggerGeneration(regime);
      if (result.success && result.generation) {
        setState(prev => ({
          ...prev,
          totalGenerations: Math.max(prev.totalGenerations, result.generation!),
        }));
      }
    };

    trigger();
    cloudIntervalRef.current = setInterval(trigger, CLOUD_GENERATION_INTERVAL);

    return () => {
      if (cloudIntervalRef.current) clearInterval(cloudIntervalRef.current);
    };
  }, [syncMode]);

  // ─── IndexedDB periodic persistence ────────────────────────────────────────

  useEffect(() => {
    if (syncMode !== "persisted") return;

    const persist = () => {
      saveAtlasState(stateRef.current);
    };

    // Save immediately, then periodically
    persist();
    persistIntervalRef.current = setInterval(persist, PERSIST_INTERVAL);

    return () => {
      if (persistIntervalRef.current) clearInterval(persistIntervalRef.current);
      // Final save on unmount
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

    // Only clean up on unmount (localStartedRef prevents re-entry)
    return () => {
      runningRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [syncMode, tick]);

  // ─── Toggle sync mode (user-facing) ────────────────────────────────────────

  const togglePersistence = useCallback(() => {
    setSyncMode(prev => {
      if (prev === "persisted") return "memory";
      if (prev === "memory") return "persisted";
      return prev; // don't toggle cloud or loading
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
    cloudStatus,
    togglePersistence,
  };
}
