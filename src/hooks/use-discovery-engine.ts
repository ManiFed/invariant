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
} from "@/lib/discovery-engine";

const LOCAL_ARCHIVE_LIMIT = 20000;
const DEFAULT_CUSTOM_ARCHIVE_LIMIT = 12000;
const TICK_INTERVAL = 35;
const PERSIST_INTERVAL = 1500;
const REGIME_CYCLE: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion", "regime-shift"];
const LOCAL_STATE_KEY = "atlas-discovery-local-state-v1";
const LOCAL_SETTINGS_KEY = "atlas-discovery-local-settings-v1";

type LocalDiscoverySettings = {
  archiveLimit: number;
  autoRun: boolean;
  tickIntervalMs: number;
  regimeMode: "cycle" | "focus";
  focusRegime: RegimeId;
  mlMode: "off" | "balanced" | "aggressive";
};

const DEFAULT_SETTINGS: LocalDiscoverySettings = {
  archiveLimit: DEFAULT_CUSTOM_ARCHIVE_LIMIT,
  autoRun: true,
  tickIntervalMs: TICK_INTERVAL,
  regimeMode: "cycle",
  focusRegime: "low-vol",
  mlMode: "balanced",
};

function clampArchive<T>(archive: T[], limit: number): T[] {
  if (archive.length <= limit) return archive;
  return archive.slice(-limit);
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

function loadSettings(): LocalDiscoverySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<LocalDiscoverySettings>;
    const archiveLimit = Math.min(LOCAL_ARCHIVE_LIMIT, Math.max(500, Number(parsed.archiveLimit ?? DEFAULT_CUSTOM_ARCHIVE_LIMIT)));
    return {
      archiveLimit,
      autoRun: parsed.autoRun ?? true,
      tickIntervalMs: Math.min(300, Math.max(15, Number(parsed.tickIntervalMs ?? TICK_INTERVAL))),
      regimeMode: parsed.regimeMode === "focus" ? "focus" : "cycle",
      focusRegime: REGIME_CYCLE.includes(parsed.focusRegime as RegimeId) ? (parsed.focusRegime as RegimeId) : "low-vol",
      mlMode: parsed.mlMode === "off" || parsed.mlMode === "aggressive" ? parsed.mlMode : "balanced",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: LocalDiscoverySettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
}

function serializeState(state: EngineState, archiveLimit: number) {
  return JSON.stringify({
    ...state,
    archive: clampArchive(state.archive, archiveLimit).map((candidate) => ({
      ...candidate,
      bins: Array.from(candidate.bins),
    })),
    populations: {
      "low-vol": {
        ...state.populations["low-vol"],
        candidates: state.populations["low-vol"].candidates.map((candidate) => ({ ...candidate, bins: Array.from(candidate.bins) })),
        champion: state.populations["low-vol"].champion ? { ...state.populations["low-vol"].champion, bins: Array.from(state.populations["low-vol"].champion.bins) } : null,
        metricChampions: Object.fromEntries(Object.entries(state.populations["low-vol"].metricChampions).map(([key, value]) => [key, value ? { ...value, bins: Array.from(value.bins) } : null])),
      },
      "high-vol": {
        ...state.populations["high-vol"],
        candidates: state.populations["high-vol"].candidates.map((candidate) => ({ ...candidate, bins: Array.from(candidate.bins) })),
        champion: state.populations["high-vol"].champion ? { ...state.populations["high-vol"].champion, bins: Array.from(state.populations["high-vol"].champion.bins) } : null,
        metricChampions: Object.fromEntries(Object.entries(state.populations["high-vol"].metricChampions).map(([key, value]) => [key, value ? { ...value, bins: Array.from(value.bins) } : null])),
      },
      "jump-diffusion": {
        ...state.populations["jump-diffusion"],
        candidates: state.populations["jump-diffusion"].candidates.map((candidate) => ({ ...candidate, bins: Array.from(candidate.bins) })),
        champion: state.populations["jump-diffusion"].champion ? { ...state.populations["jump-diffusion"].champion, bins: Array.from(state.populations["jump-diffusion"].champion.bins) } : null,
        metricChampions: Object.fromEntries(Object.entries(state.populations["jump-diffusion"].metricChampions).map(([key, value]) => [key, value ? { ...value, bins: Array.from(value.bins) } : null])),
      },
      "regime-shift": {
        ...state.populations["regime-shift"],
        candidates: state.populations["regime-shift"].candidates.map((candidate) => ({ ...candidate, bins: Array.from(candidate.bins) })),
        champion: state.populations["regime-shift"].champion ? { ...state.populations["regime-shift"].champion, bins: Array.from(state.populations["regime-shift"].champion.bins) } : null,
        metricChampions: Object.fromEntries(Object.entries(state.populations["regime-shift"].metricChampions).map(([key, value]) => [key, value ? { ...value, bins: Array.from(value.bins) } : null])),
      },
    },
  });
}

function deserializeCandidate(candidate: any): Candidate {
  return {
    ...candidate,
    bins: new Float64Array(candidate.bins ?? []),
  };
}

function deserializeState(raw: string, archiveLimit: number): EngineState | null {
  try {
    const parsed = JSON.parse(raw);
    const regimes: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion", "regime-shift"];
    const populations = Object.fromEntries(
      regimes.map((regimeId) => {
        const pop = parsed.populations?.[regimeId];
        if (!pop) {
          return [regimeId, createInitialState().populations[regimeId]];
        }
        const metricChampions = Object.fromEntries(
          Object.entries(pop.metricChampions ?? {}).map(([key, value]) => [key, value ? deserializeCandidate(value) : null]),
        );
        return [
          regimeId,
          {
            ...pop,
            candidates: (pop.candidates ?? []).map(deserializeCandidate),
            champion: pop.champion ? deserializeCandidate(pop.champion) : null,
            metricChampions,
          },
        ];
      }),
    ) as EngineState["populations"];

    return {
      populations,
      archive: clampArchive((parsed.archive ?? []).map(deserializeCandidate), archiveLimit),
      activityLog: (parsed.activityLog ?? []).slice(-200),
      running: true,
      totalGenerations: parsed.totalGenerations ?? 0,
      archiveSize: undefined,
    };
  } catch {
    return null;
  }
}

export type SyncMode = "local" | "local-paused" | "loading";

export function useDiscoveryEngine() {
  const [state, setState] = useState<EngineState>(() => ({
    ...createInitialState(),
    running: true,
  }));
  const [syncMode, setSyncMode] = useState<SyncMode>("loading");
  const [settings, setSettings] = useState<LocalDiscoverySettings>(() => loadSettings());
  const runningRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const initRef = useRef(false);
  const tickActiveRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const tick = useCallback(() => {
    if (!runningRef.current) return;

    setState(prev => {
      const regimeIdx = prev.totalGenerations % REGIME_CYCLE.length;
      const regimeId = settings.regimeMode === "focus" ? settings.focusRegime : REGIME_CYCLE[regimeIdx];
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
      const recommendation = settings.mlMode === "off" ? null : learnMlRecommendation(recommendationPool);
      const adjustedRecommendation =
        settings.mlMode === "aggressive" && recommendation
          ? { ...recommendation, confidence: Math.min(1, recommendation.confidence + 0.25) }
          : recommendation;

      const { newPopulation, newCandidates, events } = runGeneration(population, regimeConfig, {
        recommendation: adjustedRecommendation,
        guidanceProbabilityMultiplier: settings.mlMode === "aggressive" ? 1.35 : 1,
        familySwitchProbabilityMultiplier: settings.mlMode === "aggressive" ? 1.25 : 1,
      });

      const newArchive = clampArchive([...prev.archive, ...newCandidates], settings.archiveLimit);

      return {
        ...prev,
        populations: { ...prev.populations, [regimeId]: newPopulation },
        archive: newArchive,
        activityLog: [...prev.activityLog, ...events].slice(-200),
        totalGenerations: prev.totalGenerations + 1,
        archiveSize: undefined,
      };
    });

    timeoutRef.current = setTimeout(tick, settings.tickIntervalMs);
  }, [settings.archiveLimit, settings.focusRegime, settings.mlMode, settings.regimeMode, settings.tickIntervalMs]);

  const startTick = useCallback(() => {
    if (tickActiveRef.current || !settings.autoRun) return;
    tickActiveRef.current = true;
    runningRef.current = true;
    tick();
  }, [settings.autoRun, tick]);

  const stopTick = useCallback(() => {
    tickActiveRef.current = false;
    runningRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
    if (raw) {
      const recovered = deserializeState(raw, settings.archiveLimit);
      if (hasRecoverableState(recovered)) {
        setState(recovered);
      }
    }

    setSyncMode(settings.autoRun ? "local" : "local-paused");

    const flushNow = () => {
      try {
        window.localStorage.setItem(LOCAL_STATE_KEY, serializeState(stateRef.current, settings.archiveLimit));
      } catch (error) {
        console.warn("Failed to save local discovery state", error);
      }
    };

    const onBeforeUnload = () => {
      flushNow();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushNow();
    };

    window.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      flushNow();
    };
  }, [settings.archiveLimit, settings.autoRun]);

  useEffect(() => {
    const persist = () => {
      try {
        window.localStorage.setItem(LOCAL_STATE_KEY, serializeState(stateRef.current, settings.archiveLimit));
      } catch (error) {
        console.warn("Failed to save local discovery state", error);
      }
    };

    persist();
    persistIntervalRef.current = setInterval(persist, PERSIST_INTERVAL);

    return () => {
      if (persistIntervalRef.current) clearInterval(persistIntervalRef.current);
      persist();
    };
  }, [settings.archiveLimit]);

  useEffect(() => {
    if (syncMode === "loading") return;
    if (settings.autoRun) {
      setSyncMode("local");
      startTick();
    } else {
      setSyncMode("local-paused");
      stopTick();
    }

    return () => {
      stopTick();
    };
  }, [settings.autoRun, startTick, stopTick, syncMode]);

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

  const updateLocalSettings = useCallback((next: Partial<LocalDiscoverySettings>) => {
    setSettings(prev => {
      const merged = {
        ...prev,
        ...next,
      };
      const normalized = {
        archiveLimit: Math.min(LOCAL_ARCHIVE_LIMIT, Math.max(500, merged.archiveLimit)),
        autoRun: merged.autoRun,
        tickIntervalMs: Math.min(300, Math.max(15, merged.tickIntervalMs)),
        regimeMode: merged.regimeMode,
        focusRegime: merged.focusRegime,
        mlMode: merged.mlMode,
      };
      saveSettings(normalized);
      return normalized;
    });
  }, []);

  const togglePersistence = useCallback(() => {
    updateLocalSettings({ autoRun: !settings.autoRun });
  }, [settings.autoRun, updateLocalSettings]);

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
      const archive = clampArchive([...prev.archive, ...candidates], settings.archiveLimit);

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
  }, [settings.archiveLimit]);

  const clearSelection = useCallback(() => {
    setSelectedCandidate(null);
  }, []);

  return {
    state,
    selectedCandidate,
    selectCandidate,
    clearSelection,
    syncMode,
    role: "solo" as const,
    togglePersistence,
    ingestExperimentCandidates,
    settings,
    updateLocalSettings,
    maxArchiveLimit: LOCAL_ARCHIVE_LIMIT,
  };
}
