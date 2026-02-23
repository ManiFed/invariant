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
} from "@/lib/atlas-cloud";

const ARCHIVE_LIMIT = 10000; // increased for cloud mode
const LOCAL_ARCHIVE_LIMIT = 2000;
const TICK_INTERVAL = 50; // ms between local generation ticks
const CLOUD_GENERATION_INTERVAL = 8000; // ms between cloud generation triggers
const REGIME_CYCLE: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];

export function useDiscoveryEngine() {
  const [state, setState] = useState<EngineState>(() => ({
    ...createInitialState(),
    running: true,
  }));
  const [cloudMode, setCloudMode] = useState<boolean | null>(null); // null = loading
  const runningRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Snapshot storage: selected candidates live here, immune to archive churn
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const initRef = useRef(false);
  const localStartedRef = useRef(false);

  // ─── Local engine tick ─────────────────────────────────────────────────────

  const tick = useCallback(() => {
    if (!runningRef.current) return;

    setState(prev => {
      const regimeIdx = prev.totalGenerations % REGIME_CYCLE.length;
      const regimeId = REGIME_CYCLE[regimeIdx];
      const regimeConfig = REGIMES.find(r => r.id === regimeId)!;
      const population = prev.populations[regimeId];

      const { newPopulation, newCandidates, events } = runGeneration(population, regimeConfig);

      const limit = LOCAL_ARCHIVE_LIMIT;
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
  }, []);

  // ─── Cloud initialization ──────────────────────────────────────────────────

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    (async () => {
      const { state: cloudState, cloudAvailable } = await loadAtlasState();

      if (cancelled) return;

      if (cloudAvailable && cloudState.archive.length > 0) {
        // Cloud has data — use it as initial state
        setState(cloudState);
        setCloudMode(true);
      } else if (cloudAvailable) {
        // Cloud is available but empty — mark as cloud mode
        setCloudMode(true);
      } else {
        // No cloud — pure local mode
        setCloudMode(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ─── Real-time subscription (cloud mode) ───────────────────────────────────

  useEffect(() => {
    if (cloudMode !== true) return;

    const unsubscribe = subscribeToAtlas(
      // New candidates from server
      (newCandidates) => {
        setState(prev => {
          const newArchive = [...prev.archive, ...newCandidates];
          if (newArchive.length > ARCHIVE_LIMIT) {
            newArchive.splice(0, newArchive.length - ARCHIVE_LIMIT);
          }

          // Update population champions if the new candidate is better
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
      // State update (generation count)
      (totalGenerations) => {
        setState(prev => ({
          ...prev,
          totalGenerations: Math.max(prev.totalGenerations, totalGenerations),
        }));
      }
    );

    return unsubscribe;
  }, [cloudMode]);

  // ─── Cloud generation trigger ──────────────────────────────────────────────

  useEffect(() => {
    if (cloudMode !== true) return;

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

    // Trigger first generation immediately
    trigger();

    cloudIntervalRef.current = setInterval(trigger, CLOUD_GENERATION_INTERVAL);

    return () => {
      if (cloudIntervalRef.current) clearInterval(cloudIntervalRef.current);
    };
  }, [cloudMode]);

  // ─── Start local engine (always runs for responsiveness) ───────────────────

  useEffect(() => {
    if (cloudMode === null) return; // still loading
    if (localStartedRef.current) return;
    localStartedRef.current = true;

    runningRef.current = true;
    tick();

    return () => {
      runningRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [cloudMode, tick]);

  // ─── Selection (snapshot-based, survives archive churn) ────────────────────

  const selectCandidate = useCallback((id: string) => {
    // Use setState updater to access current state without dependency
    setState(currentState => {
      // Look through archive first
      const found = currentState.archive.find(c => c.id === id);
      if (found) {
        setSelectedCandidate(found);
        return currentState;
      }
      // Also check current population candidates and metric champions
      for (const pop of Object.values(currentState.populations)) {
        if (pop.champion?.id === id) { setSelectedCandidate(pop.champion); return currentState; }
        const inPop = pop.candidates.find(c => c.id === id);
        if (inPop) { setSelectedCandidate(inPop); return currentState; }
        for (const mc of Object.values(pop.metricChampions)) {
          if (mc?.id === id) { setSelectedCandidate(mc); return currentState; }
        }
      }
      return currentState; // no mutation
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
    cloudMode,
  };
}
