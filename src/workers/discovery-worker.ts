// Discovery Engine Web Worker
// Runs all evolutionary computation off the main thread to eliminate UI jank.

import {
  type EngineState,
  type RegimeId,
  type Candidate,
  type PopulationState,
  type ActivityEntry,
  REGIMES,
  createInitialState,
  runGeneration,
} from "@/lib/discovery-engine";

const REGIME_CYCLE: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];

let state: EngineState = { ...createInitialState(), running: true };
let running = false;
let tickTimeout: ReturnType<typeof setTimeout> | null = null;

const TICK_INTERVAL = 50;
const LOCAL_ARCHIVE_LIMIT = 2000;

function tick() {
  if (!running) return;

  const regimeIdx = state.totalGenerations % REGIME_CYCLE.length;
  const regimeId = REGIME_CYCLE[regimeIdx];
  const regimeConfig = REGIMES.find(r => r.id === regimeId)!;
  const population = state.populations[regimeId];

  const { newPopulation, newCandidates, events } = runGeneration(population, regimeConfig);

  const newArchive = [...state.archive, ...newCandidates];
  if (newArchive.length > LOCAL_ARCHIVE_LIMIT) {
    newArchive.splice(0, newArchive.length - LOCAL_ARCHIVE_LIMIT);
  }

  state = {
    ...state,
    populations: { ...state.populations, [regimeId]: newPopulation },
    archive: newArchive,
    activityLog: [...state.activityLog, ...events].slice(-200),
    totalGenerations: state.totalGenerations + 1,
  };

  // Send state update to main thread (serialize Float64Arrays)
  const serializedState = serializeState(state);
  self.postMessage({ type: "state-update", state: serializedState });

  tickTimeout = setTimeout(tick, TICK_INTERVAL);
}

function serializeState(s: EngineState): any {
  return {
    ...s,
    archive: s.archive.map(serializeCandidate),
    populations: Object.fromEntries(
      Object.entries(s.populations).map(([k, v]) => [k, serializePopulation(v)])
    ),
  };
}

function serializeCandidate(c: Candidate): any {
  return { ...c, bins: Array.from(c.bins) };
}

function serializePopulation(p: PopulationState): any {
  return {
    ...p,
    candidates: p.candidates.map(serializeCandidate),
    champion: p.champion ? serializeCandidate(p.champion) : null,
    metricChampions: Object.fromEntries(
      Object.entries(p.metricChampions).map(([k, v]) => [k, v ? serializeCandidate(v) : null])
    ),
  };
}

function deserializeCandidate(c: any): Candidate {
  return { ...c, bins: new Float64Array(c.bins) };
}

function deserializePopulation(p: any): PopulationState {
  return {
    ...p,
    candidates: p.candidates.map(deserializeCandidate),
    champion: p.champion ? deserializeCandidate(p.champion) : null,
    metricChampions: Object.fromEntries(
      Object.entries(p.metricChampions).map(([k, v]) => [k, v ? deserializeCandidate(v as any) : null])
    ),
  };
}

function deserializeState(s: any): EngineState {
  return {
    ...s,
    archive: s.archive.map(deserializeCandidate),
    populations: Object.fromEntries(
      Object.entries(s.populations).map(([k, v]) => [k, deserializePopulation(v)])
    ),
  };
}

self.onmessage = (e: MessageEvent) => {
  const { type, ...data } = e.data;

  switch (type) {
    case "start":
      running = true;
      tick();
      break;

    case "stop":
      running = false;
      if (tickTimeout) {
        clearTimeout(tickTimeout);
        tickTimeout = null;
      }
      break;

    case "set-state":
      state = deserializeState(data.state);
      break;

    case "get-state":
      self.postMessage({ type: "state-snapshot", state: serializeState(state) });
      break;
  }
};
