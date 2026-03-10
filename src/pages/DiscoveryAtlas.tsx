import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Activity,
  Map,
  Fingerprint,
  Radio,
  User,
  Settings2,
  Loader2,
  FlaskConical,
  Radar,
  Zap,
  Layers,
  Swords,
  History,
  Target,
  Blend,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LiveDashboard from "@/components/labs/LiveDashboard";
import AtlasSurface from "@/components/labs/AtlasSurface";
import DesignDetail from "@/components/labs/DesignDetail";
import GeometryObservatory from "@/components/labs/GeometryObservatory";
import ExperimentsTab from "@/components/labs/ExperimentsTab";
import FamilyDirectory from "@/components/labs/FamilyDirectory";
import MethodologyTab from "@/components/labs/MethodologyTab";
import ParetoFrontier from "@/components/labs/ParetoFrontier";
import ArenaView from "@/components/labs/ArenaView";
import EvolutionReplay from "@/components/labs/EvolutionReplay";
import AMMFinderTab from "@/components/labs/AMMFinderTab";
import { useDiscoveryEngine, type SyncMode } from "@/hooks/use-discovery-engine";
import { type Candidate, type RegimeId, REGIMES, createInitialState, runGeneration } from "@/lib/discovery-engine";

type View = "dashboard" | "atlas" | "geometry" | "competition" | "experiments" | "methodology" | "finder" | "detail";
type GeometrySubview = "directory" | "observatory";
type CompetitionSubview = "pareto" | "arena" | "replay";
type ObjectiveType = "lp-value" | "slippage" | "balanced";
type SearchStrategy = "genetic" | "cma-es" | "rl" | "bayesian" | "map-elites" | "random";
type ObjectiveComposer = "weighted-sum" | "lexicographic" | "pareto" | "risk-adjusted" | "worst-case";
type DiscoverTabId = Exclude<View, "detail">;

type TabConfig = {
  id: DiscoverTabId;
  label: string;
  icon?: typeof Map;
  visible: boolean;
};

type ExperimentConfig = {
  contributor: string;
  regime: RegimeId;
  objective: ObjectiveType;
  generations: number;
  searchStrategy: SearchStrategy;
  objectiveComposer: ObjectiveComposer;
  objectiveVector: string[];
  structuralEvolution: boolean;
  parameterTuning: boolean;
  liquidityMutation: boolean;
  feePolicySearch: boolean;
  populationSize: number;
  mutationStrength: number;
  structuralMutationProbability: number;
  invariantMutationProbability: number;
  topologyMutationProbability: number;
  stressMode: "baseline" | "regime-path" | "adversarial" | "distribution-weighted";
  compositionPlan: string;
};

type Experiment = {
  id: string;
  config: ExperimentConfig;
  status: "running" | "completed";
  startedAt: number;
  currentGeneration: number;
  bestScore: number;
  bestCandidate: Candidate | null;
  paretoCount: number;
  convergenceRate: number;
  parameterDispersion: number;
  performanceVariance: number;
  structuralFragility: number;
  robustnessScore: number;
  scoreHistory: number[];
};

const SYNC_BADGE: Record<SyncMode, { icon: typeof User; label: string; className: string }> = {
  local: { icon: User, label: "PERSONAL RUNNING", className: "bg-chart-4/5 border-chart-4/20 text-chart-4" },
  "local-paused": { icon: User, label: "PERSONAL PAUSED", className: "bg-secondary border-border text-muted-foreground" },
  loading: { icon: Loader2, label: "RESTORING", className: "bg-secondary border-border text-muted-foreground" },
};

const scoreForObjective = (candidate: Candidate, objective: ObjectiveType): number => {
  const m = candidate.metrics;
  if (objective === "lp-value") return 1 / Math.max(m.lpValueVsHodl, 1e-6) + candidate.stability * 0.2;
  if (objective === "slippage") return m.totalSlippage * 10 + m.arbLeakage * 0.02 + candidate.stability * 0.1;
  return candidate.score;
};

const paretoFront = (candidates: Candidate[]): Candidate[] => {
  return candidates.filter((candidate, i) => {
    const c = candidate.metrics;
    return !candidates.some((other, j) => {
      if (i === j) return false;
      const o = other.metrics;
      const noWorse =
        o.lpValueVsHodl >= c.lpValueVsHodl && o.totalSlippage <= c.totalSlippage && o.maxDrawdown <= c.maxDrawdown;
      const strictlyBetter =
        o.lpValueVsHodl > c.lpValueVsHodl || o.totalSlippage < c.totalSlippage || o.maxDrawdown < c.maxDrawdown;
      return noWorse && strictlyBetter;
    });
  });
};

const binDispersion = (candidate: Candidate): number => {
  const mean = candidate.bins.reduce((acc, b) => acc + b, 0) / candidate.bins.length;
  let variance = 0;
  for (const value of candidate.bins) variance += (value - mean) ** 2;
  return Math.sqrt(variance / candidate.bins.length);
};

const DiscoveryAtlas = () => {
  const navigate = useNavigate();
  const {
    state,
    selectedCandidate,
    selectCandidate,
    clearSelection,
    syncMode,
    togglePersistence,
    ingestExperimentCandidates,
    settings,
    updateLocalSettings,
    maxArchiveLimit,
  } = useDiscoveryEngine();
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [geometrySubview, setGeometrySubview] = useState<GeometrySubview>("observatory");
  const [competitionSubview, setCompetitionSubview] = useState<CompetitionSubview>("pareto");
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [genRate, setGenRate] = useState<number | null>(null);
  const genRateRef = useRef({ lastGen: 0, lastTime: Date.now(), samples: [] as number[] });

  // Track generation rate (gens/sec)
  useEffect(() => {
    const { lastGen, lastTime, samples } = genRateRef.current;
    if (state.totalGenerations !== lastGen) {
      const now = Date.now();
      const elapsed = (now - lastTime) / 1000;
      if (elapsed > 0 && elapsed < 10) {
        samples.push(1 / elapsed);
        if (samples.length > 10) samples.shift();
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        setGenRate(parseFloat(avg.toFixed(1)));
      }
      genRateRef.current = { lastGen: state.totalGenerations, lastTime: now, samples };
    }
  }, [state.totalGenerations]);

  const [config, setConfig] = useState<ExperimentConfig>({
    contributor: "guest",
    regime: "low-vol",
    objective: "balanced",
    generations: 8,
    searchStrategy: "map-elites",
    objectiveComposer: "pareto",
    objectiveVector: ["fee_revenue", "slippage", "arb_leakage", "tail_drawdown", "utilization", "regime_robustness"],
    structuralEvolution: true,
    parameterTuning: true,
    liquidityMutation: true,
    feePolicySearch: true,
    populationSize: 96,
    mutationStrength: 0.35,
    structuralMutationProbability: 0.24,
    invariantMutationProbability: 0.18,
    topologyMutationProbability: 0.1,
    stressMode: "regime-path",
    compositionPlan:
      "Explore invariant families → narrow top 3 → robust optimization → adversarial stress → fine tune liquidity",
  });
  const [atlasFilters, setAtlasFilters] = useState({
    contributor: "all",
    experimentId: "all",
    objectiveType: "all",
    regime: "all" as RegimeId | "all",
    source: "all",
    poolType: "all",
  });
  const [layoutMode, setLayoutMode] = useState<"cozy" | "compact">("cozy");
  const [tabLayout, setTabLayout] = useState<"top" | "left">("top");
  const [showCustomization, setShowCustomization] = useState(false);
  const [tabConfig, setTabConfig] = useState<TabConfig[]>([
    { id: "dashboard", label: "Live Dashboard", visible: true },
    { id: "competition", label: "Evolution", visible: true },
    { id: "atlas", label: "Atlas Map", icon: Map, visible: true },
    { id: "geometry", label: "Geometry & Families", visible: true },
    { id: "experiments", label: "Experiments", visible: true },
    { id: "finder", label: "Find My AMM", icon: Blend, visible: true },
    { id: "methodology", label: "Methodology", visible: true },
  ]);
  const detailCandidateRef = useRef(selectedCandidate);

  if (selectedCandidate) detailCandidateRef.current = selectedCandidate;

  const runExperiment = useCallback(
    (expId: string, expConfig: ExperimentConfig) => {
      const regimeConfig = REGIMES.find((regime) => regime.id === expConfig.regime);
      if (!regimeConfig) return;

      let population = createInitialState().populations[expConfig.regime];
      let prevBest = Infinity;

      const iterate = (generation: number) => {
        const { newPopulation, newCandidates } = runGeneration(population, regimeConfig);
        population = newPopulation;

        const ranked = [...newPopulation.candidates].sort(
          (a, b) => scoreForObjective(a, expConfig.objective) - scoreForObjective(b, expConfig.objective),
        );
        const champion = ranked[0] ?? null;
        const front = paretoFront(newPopulation.candidates);
        const bestScore = champion ? scoreForObjective(champion, expConfig.objective) : Infinity;
        const convergenceRate = Number((prevBest - bestScore).toFixed(4));
        prevBest = bestScore;
        const performanceVariance = champion ? Number((champion.stability * champion.stability).toFixed(5)) : 0;
        const structuralFragility = champion
          ? Number((Math.max(0, 1 - champion.stability) * (1 + expConfig.topologyMutationProbability)).toFixed(4))
          : 0;
        const robustnessScore = champion
          ? Number(
              (
                champion.stability *
                (1 - expConfig.mutationStrength * 0.2) *
                (expConfig.stressMode === "adversarial" ? 0.9 : 1)
              ).toFixed(4),
            )
          : 0;

        setExperiments((prev) =>
          prev.map((experiment) =>
            experiment.id === expId
              ? {
                  ...experiment,
                  currentGeneration: generation,
                  bestScore,
                  bestCandidate: champion,
                  paretoCount: front.length,
                  convergenceRate,
                  parameterDispersion: champion ? Number(binDispersion(champion).toFixed(3)) : 0,
                  performanceVariance,
                  structuralFragility,
                  robustnessScore,
                  status: generation >= expConfig.generations ? "completed" : "running",
                  scoreHistory: [...experiment.scoreHistory, bestScore],
                }
              : experiment,
          ),
        );

        const tagged = newCandidates.map((candidate) => ({
          ...candidate,
          source: "experiment" as const,
          contributor: expConfig.contributor,
          experimentId: expId,
          objectiveType: expConfig.objective,
        }));
        ingestExperimentCandidates(
          tagged,
          `Experiment ${expId} generation ${generation}: archived ${tagged.length} candidates`,
        );

        if (generation < expConfig.generations) {
          setTimeout(() => iterate(generation + 1), 90);
        }
      };

      iterate(1);
    },
    [ingestExperimentCandidates],
  );

  const handleSubmitExperiment = useCallback(() => {
    const expId = `exp-${Date.now().toString(36)}`;
    setExperiments((prev) => [
      {
        id: expId,
        config,
        status: "running",
        startedAt: Date.now(),
        currentGeneration: 0,
        bestScore: Infinity,
        bestCandidate: null,
        paretoCount: 0,
        convergenceRate: 0,
        parameterDispersion: 0,
        performanceVariance: 0,
        structuralFragility: 0,
        robustnessScore: 0,
        scoreHistory: [],
      },
      ...prev,
    ]);
    runExperiment(expId, config);
    setActiveView("experiments");
  }, [config, runExperiment]);

  const handleSelectCandidate = useCallback(
    (id: string) => {
      selectCandidate(id);
      setActiveView("detail");
    },
    [selectCandidate],
  );

  const handleBackFromDetail = useCallback(() => {
    clearSelection();
    detailCandidateRef.current = null;
    setActiveView("atlas");
  }, [clearSelection]);

  const detailCandidate = activeView === "detail" ? selectedCandidate || detailCandidateRef.current : selectedCandidate;
  const badge = SYNC_BADGE[syncMode];
  const BadgeIcon = badge.icon;
  const canToggle = syncMode !== "loading";

  const contributors = useMemo(
    () => ["all", ...new Set(state.archive.map((candidate) => candidate.contributor).filter(Boolean) as string[])],
    [state.archive],
  );
  const experimentIds = useMemo(
    () => ["all", ...new Set(state.archive.map((candidate) => candidate.experimentId).filter(Boolean) as string[])],
    [state.archive],
  );
  const objectiveTypes = useMemo(
    () => ["all", ...new Set(state.archive.map((candidate) => candidate.objectiveType).filter(Boolean) as string[])],
    [state.archive],
  );

  const filteredArchive = useMemo(
    () =>
      state.archive.filter((candidate) => {
        if (atlasFilters.contributor !== "all" && candidate.contributor !== atlasFilters.contributor) return false;
        if (atlasFilters.experimentId !== "all" && candidate.experimentId !== atlasFilters.experimentId) return false;
        if (atlasFilters.objectiveType !== "all" && candidate.objectiveType !== atlasFilters.objectiveType)
          return false;
        if (atlasFilters.regime !== "all" && candidate.regime !== atlasFilters.regime) return false;
        if (atlasFilters.source !== "all" && (candidate.source ?? "global") !== atlasFilters.source) return false;
        if (atlasFilters.poolType !== "all" && (candidate.poolType ?? "two-asset") !== atlasFilters.poolType)
          return false;
        return true;
      }),
    [atlasFilters, state.archive],
  );

  const tabs = tabConfig.filter((tab) => tab.visible);

  useEffect(() => {
    const currentVisible = tabs.some((tab) => tab.id === activeView);
    if (!currentVisible && activeView !== "detail") {
      setActiveView(tabs[0]?.id ?? "dashboard");
    }
  }, [activeView, tabs]);

  const moveTab = (index: number, direction: -1 | 1) => {
    setTabConfig((prev) => {
      const next = [...prev];
      const swapIndex = index + direction;
      if (swapIndex < 0 || swapIndex >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(swapIndex, 0, item);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/labs")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">INVARIANT ATLAS</span>
        </div>
        <div className="flex items-center gap-2">
          {canToggle ? (
            <button
              onClick={togglePersistence}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border cursor-pointer hover:opacity-80 transition-opacity ${badge.className}`}
              title={
                syncMode === "local"
                  ? "Your private discovery engine is running and auto-saving to localStorage."
                  : "Your local archive is paused. Click to resume discovery."
              }
            >
              <BadgeIcon className="w-3 h-3" />
              <span className="text-[9px] font-medium">{badge.label}</span>
            </button>
          ) : (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${badge.className}`}>
              <BadgeIcon className={`w-3 h-3 ${syncMode === "loading" ? "animate-spin" : ""}`} />
              <span className="text-[9px] font-medium">{badge.label}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/5 border border-success/20">
            <Radio className="w-3 h-3 text-success animate-pulse" />
            <span className="text-[9px] font-medium text-success">LOCAL ONLY</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border">
            <span className="text-[9px] font-mono text-muted-foreground">
              Gen {state.totalGenerations} | {(state.archiveSize ?? state.archive.length).toLocaleString()} archived
            </span>
          </div>
          {genRate !== null && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-secondary border border-border">
              <Zap className="w-3 h-3 text-warning" />
              <span className="text-[9px] font-mono text-muted-foreground">{genRate} gen/s</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border">
            <Settings2 className="w-3 h-3 text-muted-foreground" />
            <label className="text-[9px] font-mono text-muted-foreground">Archive cap</label>
            <input
              type="number"
              min={500}
              max={maxArchiveLimit}
              step={100}
              value={settings.archiveLimit}
              onChange={(event) => {
                const nextLimit = Number(event.target.value);
                if (Number.isFinite(nextLimit)) {
                  updateLocalSettings({ archiveLimit: nextLimit });
                }
              }}
              className="w-20 px-1 py-0.5 text-[9px] rounded border border-border bg-background"
            />
          </div>
          <button
            onClick={() => setShowCustomization((prev) => !prev)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border text-[9px] font-medium"
          >
            <FlaskConical className="w-3 h-3" />
            CUSTOMIZE
          </button>
          <ThemeToggle />
        </div>
      </header>

      {showCustomization && (
        <section className="border-b border-border px-6 py-4 grid lg:grid-cols-3 gap-4 bg-muted/20">
          <div className="space-y-2">
            <p className="text-xs font-semibold">Layout control</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button onClick={() => setLayoutMode("cozy")} className={`px-2 py-1.5 rounded border ${layoutMode === "cozy" ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`}>Cozy spacing</button>
              <button onClick={() => setLayoutMode("compact")} className={`px-2 py-1.5 rounded border ${layoutMode === "compact" ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`}>Compact spacing</button>
              <button onClick={() => setTabLayout("top")} className={`px-2 py-1.5 rounded border ${tabLayout === "top" ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`}>Top tabs</button>
              <button onClick={() => setTabLayout("left")} className={`px-2 py-1.5 rounded border ${tabLayout === "left" ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`}>Left rail</button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold">Tab visibility + order</p>
            <div className="space-y-1.5">
              {tabConfig.map((tab, index) => (
                <div key={tab.id} className="flex items-center justify-between gap-2 text-xs border border-border rounded-md px-2 py-1.5 bg-background">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={tab.visible} onChange={() => setTabConfig((prev) => prev.map((entry) => entry.id === tab.id ? { ...entry, visible: !entry.visible } : entry))} />
                    {tab.label}
                  </label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveTab(index, -1)} className="p-1 rounded border border-border"><ChevronUp className="w-3 h-3" /></button>
                    <button onClick={() => moveTab(index, 1)} className="p-1 rounded border border-border"><ChevronDown className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold">Engine + ML control</p>
            <div className="space-y-2 text-xs">
              <label className="flex flex-col gap-1">
                Engine tick (ms)
                <input
                  type="number"
                  min={15}
                  max={300}
                  value={settings.tickIntervalMs}
                  onChange={(event) => updateLocalSettings({ tickIntervalMs: Number(event.target.value) })}
                  className="px-2 py-1 rounded border border-border bg-background"
                />
              </label>
              <label className="flex flex-col gap-1">
                Regime scheduler
                <select className="px-2 py-1 rounded border border-border bg-background" value={settings.regimeMode} onChange={(event) => updateLocalSettings({ regimeMode: event.target.value as "cycle" | "focus" })}>
                  <option value="cycle">Cycle all regimes</option>
                  <option value="focus">Focus one regime</option>
                </select>
              </label>
              {settings.regimeMode === "focus" && (
                <select className="px-2 py-1 rounded border border-border bg-background" value={settings.focusRegime} onChange={(event) => updateLocalSettings({ focusRegime: event.target.value as RegimeId })}>
                  {REGIMES.map((regime) => <option key={regime.id} value={regime.id}>{regime.label}</option>)}
                </select>
              )}
              <label className="flex flex-col gap-1">
                ML influence
                <select className="px-2 py-1 rounded border border-border bg-background" value={settings.mlMode} onChange={(event) => updateLocalSettings({ mlMode: event.target.value as "off" | "balanced" | "aggressive" })}>
                  <option value="off">Off (pure evolution)</option>
                  <option value="balanced">Balanced</option>
                  <option value="aggressive">Aggressive guidance</option>
                </select>
              </label>
            </div>
          </div>
        </section>
      )}

      <div className={`border-b border-border px-6 ${tabLayout === "left" ? "py-3" : ""}`}>
        <div className={`flex gap-1 ${tabLayout === "left" ? "flex-wrap" : ""}`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${isActive ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {tab.label}
              </button>
            );
          })}
          {(selectedCandidate || detailCandidateRef.current) && (
            <button
              onClick={() => setActiveView("detail")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${activeView === "detail" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Fingerprint className="w-3.5 h-3.5" />
              Design Detail
            </button>
          )}
        </div>
      </div>

      <main className={`flex-1 overflow-y-auto ${layoutMode === "compact" ? "p-4 max-w-full" : "p-6 max-w-7xl"} mx-auto w-full`}>
        {activeView === "atlas" && (
          <section className="mb-5 grid sm:grid-cols-6 gap-2">
            <div>
              <select
                className="px-2 py-2 rounded-md border border-border bg-background text-xs w-full"
                value={atlasFilters.contributor}
                onChange={(event) => setAtlasFilters((prev) => ({ ...prev, contributor: event.target.value }))}
              >
                {contributors.map((value) => (
                  <option key={value} value={value}>
                    {value === "all" ? "All contributors" : value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="px-2 py-2 rounded-md border border-border bg-background text-xs w-full"
                value={atlasFilters.experimentId}
                onChange={(event) => setAtlasFilters((prev) => ({ ...prev, experimentId: event.target.value }))}
              >
                {experimentIds.map((value) => (
                  <option key={value} value={value}>
                    {value === "all" ? "All experiments" : value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="px-2 py-2 rounded-md border border-border bg-background text-xs w-full"
                value={atlasFilters.objectiveType}
                onChange={(event) => setAtlasFilters((prev) => ({ ...prev, objectiveType: event.target.value }))}
              >
                {objectiveTypes.map((value) => (
                  <option key={value} value={value}>
                    {value === "all" ? "All objectives" : value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="px-2 py-2 rounded-md border border-border bg-background text-xs w-full"
                value={atlasFilters.regime}
                onChange={(event) =>
                  setAtlasFilters((prev) => ({ ...prev, regime: event.target.value as RegimeId | "all" }))
                }
              >
                <option value="all">All regimes</option>
                {REGIMES.map((regime) => (
                  <option key={regime.id} value={regime.id}>
                    {regime.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="px-2 py-2 rounded-md border border-border bg-background text-xs w-full"
                value={atlasFilters.source}
                onChange={(event) => setAtlasFilters((prev) => ({ ...prev, source: event.target.value }))}
              >
                <option value="all">All sources</option>
                <option value="global">Discovered</option>
                <option value="experiment">Experimental</option>
                <option value="user-designed">User-designed</option>
              </select>
            </div>
            <div>
              <select
                className="px-2 py-2 rounded-md border border-border bg-background text-xs w-full"
                value={atlasFilters.poolType}
                onChange={(event) => setAtlasFilters((prev) => ({ ...prev, poolType: event.target.value }))}
              >
                <option value="all">All pool layers</option>
                <option value="two-asset">Two-asset layer</option>
                <option value="multi-asset">Multi-asset layer</option>
              </select>
            </div>
          </section>
        )}

        <AnimatePresence mode="wait">
          {activeView === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <LiveDashboard state={state} onSelectCandidate={handleSelectCandidate} />
            </motion.div>
          )}
          {activeView === "atlas" && (
            <motion.div
              key="atlas"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <AtlasSurface state={{ ...state, archive: filteredArchive }} onSelectCandidate={handleSelectCandidate} />
            </motion.div>
          )}
          {activeView === "competition" && (
            <motion.div
              key="competition"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-border bg-muted/40">
                <button
                  onClick={() => setCompetitionSubview("pareto")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${competitionSubview === "pareto" ? "bg-background border border-border text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Target className="w-3 h-3 inline mr-1" />
                  Pareto Frontier
                </button>
                <button
                  onClick={() => setCompetitionSubview("arena")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${competitionSubview === "arena" ? "bg-background border border-border text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Swords className="w-3 h-3 inline mr-1" />
                  Arena
                </button>
                <button
                  onClick={() => setCompetitionSubview("replay")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${competitionSubview === "replay" ? "bg-background border border-border text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <History className="w-3 h-3 inline mr-1" />
                  Evolution Replay
                </button>
              </div>
              {competitionSubview === "pareto" && (
                <ParetoFrontier state={state} onSelectCandidate={handleSelectCandidate} />
              )}
              {competitionSubview === "arena" && <ArenaView state={state} onSelectCandidate={handleSelectCandidate} />}
              {competitionSubview === "replay" && <EvolutionReplay state={state} />}
            </motion.div>
          )}
          {activeView === "geometry" && (
            <motion.div
              key="geometry"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-border bg-muted/40">
                <button
                  onClick={() => setGeometrySubview("observatory")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${geometrySubview === "observatory" ? "bg-background border border-border text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Radar className="w-3 h-3 inline mr-1" />
                  Geometry Observatory
                </button>
                <button
                  onClick={() => setGeometrySubview("directory")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${geometrySubview === "directory" ? "bg-background border border-border text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Layers className="w-3 h-3 inline mr-1" />
                  Family Directory
                </button>
              </div>
              {geometrySubview === "observatory" && (
                <GeometryObservatory state={state} onIngestCandidates={ingestExperimentCandidates} />
              )}
              {geometrySubview === "directory" && <FamilyDirectory state={{ ...state, archive: filteredArchive }} />}
            </motion.div>
          )}
          {activeView === "experiments" && (
            <ExperimentsTab
              config={config}
              setConfig={setConfig}
              experiments={experiments}
              handleSubmitExperiment={handleSubmitExperiment}
              handleSelectCandidate={handleSelectCandidate}
              state={state}
            />
          )}
          {activeView === "methodology" && (
            <motion.div
              key="methodology"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <MethodologyTab archive={state.archive} onSelectCandidate={handleSelectCandidate} />
            </motion.div>
          )}
          {activeView === "finder" && (
            <motion.div
              key="finder"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <AMMFinderTab state={state} onSelectCandidate={handleSelectCandidate} />
            </motion.div>
          )}
          {activeView === "detail" && detailCandidate && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <DesignDetail candidate={detailCandidate} state={state} onBack={handleBackFromDetail} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default DiscoveryAtlas;
