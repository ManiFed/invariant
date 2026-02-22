import { useState, useCallback, useRef, useEffect } from "react";
import {
  type EngineState,
  type RegimeId,
  type Candidate,
  type ActivityEntry,
  REGIMES,
  createInitialState,
  runGeneration,
} from "@/lib/discovery-engine";

const ARCHIVE_LIMIT = 2000; // max stored candidates in archive
const TICK_INTERVAL = 50; // ms between generation ticks (allow UI breathing room)

export function useDiscoveryEngine() {
  const [state, setState] = useState<EngineState>(createInitialState);
  const runningRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setState(prev => ({ ...prev, running: true }));
    tick();
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setState(prev => ({ ...prev, running: false }));
  }, []);

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

      // Archive all evaluated candidates (cap at limit)
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    stop();
    setState(createInitialState());
  }, [stop]);

  const getCandidate = useCallback((id: string): Candidate | undefined => {
    return state.archive.find(c => c.id === id);
  }, [state.archive]);

  return {
    state,
    start,
    stop,
    reset,
    getCandidate,
    isRunning: state.running,
  };
}
