import { useState, useCallback, useRef, useEffect } from "react";
import {
  type EngineState,
  type RegimeId,
  type Candidate,
  REGIMES,
  createInitialState,
  runGeneration,
} from "@/lib/discovery-engine";

const ARCHIVE_LIMIT = 2000; // max stored candidates in archive
const TICK_INTERVAL = 50; // ms between generation ticks (allow UI breathing room)

export function useDiscoveryEngine() {
  const [state, setState] = useState<EngineState>(() => ({
    ...createInitialState(),
    running: true, // always on
  }));
  const runningRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Snapshot storage: selected candidates live here, immune to archive churn
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const tick = useCallback(() => {
    if (!runningRef.current) return;

    setState(prev => {
      // Round-robin across regimes
      const regimeOrder: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];
      const regimeIdx = prev.totalGenerations % regimeOrder.length;
      const regimeId = regimeOrder[regimeIdx];
      const regimeConfig = REGIMES.find(r => r.id === regimeId)!;
      const population = prev.populations[regimeId];

      const { newPopulation, newCandidates, events } = runGeneration(population, regimeConfig);

      // Archive top candidates (cap at limit)
      const newArchive = [...prev.archive, ...newCandidates];
      if (newArchive.length > ARCHIVE_LIMIT) {
        newArchive.splice(0, newArchive.length - ARCHIVE_LIMIT);
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

  // Auto-start on mount, cleanup on unmount
  useEffect(() => {
    runningRef.current = true;
    tick();
    return () => {
      runningRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [tick]);

  /** Select a candidate by snapshotting it — this survives archive churn */
  const selectCandidate = useCallback((id: string) => {
    // Look through archive first
    const found = state.archive.find(c => c.id === id);
    if (found) {
      setSelectedCandidate(found);
      return;
    }
    // Also check current population candidates and metric champions
    for (const pop of Object.values(state.populations)) {
      if (pop.champion?.id === id) { setSelectedCandidate(pop.champion); return; }
      const inPop = pop.candidates.find(c => c.id === id);
      if (inPop) { setSelectedCandidate(inPop); return; }
      for (const mc of Object.values(pop.metricChampions)) {
        if (mc?.id === id) { setSelectedCandidate(mc); return; }
      }
    }
  }, [state.archive, state.populations]);

  const clearSelection = useCallback(() => {
    setSelectedCandidate(null);
  }, []);

  return {
    state,
    selectedCandidate,
    selectCandidate,
    clearSelection,
  };
}
