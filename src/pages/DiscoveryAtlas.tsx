import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, Map, Fingerprint, Radio, Wifi, HardDrive, Loader2, FlaskConical } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LiveDashboard from "@/components/labs/LiveDashboard";
import AtlasSurface from "@/components/labs/AtlasSurface";
import DesignDetail from "@/components/labs/DesignDetail";
import GeometryObservatory from "@/components/labs/GeometryObservatory";
import { useDiscoveryEngine, type SyncMode } from "@/hooks/use-discovery-engine";
import { type Candidate, type RegimeId, REGIMES, createInitialState, runGeneration } from "@/lib/discovery-engine";

type View = "dashboard" | "atlas" | "observatory" | "experiments" | "detail";
type ObjectiveType = "lp-value" | "slippage" | "balanced";
type SearchStrategy = "genetic" | "cma-es" | "rl" | "bayesian" | "map-elites" | "random";
type ObjectiveComposer = "weighted-sum" | "lexicographic" | "pareto" | "risk-adjusted" | "worst-case";

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
};

const SYNC_BADGE: Record<SyncMode, { icon: typeof Wifi; label: string; className: string }> = {
  live: { icon: Wifi, label: "LIVE SYNC", className: "bg-chart-1/5 border-chart-1/20 text-chart-1" },
  persisted: { icon: HardDrive, label: "PERSISTENT", className: "bg-chart-4/5 border-chart-4/20 text-chart-4" },
  memory: { icon: HardDrive, label: "LOCAL", className: "bg-secondary border-border text-muted-foreground" },
  loading: { icon: Loader2, label: "CONNECTING", className: "bg-secondary border-border text-muted-foreground" },
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
      const noWorse = o.lpValueVsHodl >= c.lpValueVsHodl && o.totalSlippage <= c.totalSlippage && o.maxDrawdown <= c.maxDrawdown;
      const strictlyBetter = o.lpValueVsHodl > c.lpValueVsHodl || o.totalSlippage < c.totalSlippage || o.maxDrawdown < c.maxDrawdown;
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
  const { state, selectedCandidate, selectCandidate, clearSelection, syncMode, role, togglePersistence, ingestExperimentCandidates } = useDiscoveryEngine();
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [experiments, setExperiments] = useState<Experiment[]>([]);
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
    compositionPlan: "Explore invariant families → narrow top 3 → robust optimization → adversarial stress → fine tune liquidity",
  });
  const [atlasFilters, setAtlasFilters] = useState({ contributor: "all", experimentId: "all", objectiveType: "all", regime: "all" as RegimeId | "all" });
  const detailCandidateRef = useRef(selectedCandidate);

  if (selectedCandidate) detailCandidateRef.current = selectedCandidate;

  const runExperiment = useCallback((expId: string, expConfig: ExperimentConfig) => {
    const regimeConfig = REGIMES.find((regime) => regime.id === expConfig.regime);
    if (!regimeConfig) return;

    let population = createInitialState().populations[expConfig.regime];
    let prevBest = Infinity;

    const iterate = (generation: number) => {
      const { newPopulation, newCandidates } = runGeneration(population, regimeConfig);
      population = newPopulation;

      const ranked = [...newPopulation.candidates].sort((a, b) => scoreForObjective(a, expConfig.objective) - scoreForObjective(b, expConfig.objective));
      const champion = ranked[0] ?? null;
      const front = paretoFront(newPopulation.candidates);
      const bestScore = champion ? scoreForObjective(champion, expConfig.objective) : Infinity;
      const convergenceRate = Number((prevBest - bestScore).toFixed(4));
      prevBest = bestScore;
      const performanceVariance = champion ? Number((champion.stability * champion.stability).toFixed(5)) : 0;
      const structuralFragility = champion ? Number((Math.max(0, 1 - champion.stability) * (1 + expConfig.topologyMutationProbability)).toFixed(4)) : 0;
      const robustnessScore = champion
        ? Number((champion.stability * (1 - expConfig.mutationStrength * 0.2) * (expConfig.stressMode === "adversarial" ? 0.9 : 1)).toFixed(4))
        : 0;

      setExperiments((prev) => prev.map((experiment) => (
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
            }
          : experiment
      )));

      const tagged = newCandidates.map((candidate) => ({
        ...candidate,
        source: "experiment" as const,
        contributor: expConfig.contributor,
        experimentId: expId,
        objectiveType: expConfig.objective,
      }));
      ingestExperimentCandidates(tagged, `Experiment ${expId} generation ${generation}: archived ${tagged.length} candidates`);

      if (generation < expConfig.generations) {
        setTimeout(() => iterate(generation + 1), 200);
      }
    };

    iterate(1);
  }, [ingestExperimentCandidates]);

  const handleSubmitExperiment = useCallback(() => {
    const expId = `exp-${Date.now().toString(36)}`;
    setExperiments((prev) => [{
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
    }, ...prev]);
    runExperiment(expId, config);
    setActiveView("experiments");
  }, [config, runExperiment]);

  const handleSelectCandidate = useCallback((id: string) => {
    selectCandidate(id);
    setActiveView("detail");
  }, [selectCandidate]);

  const handleBackFromDetail = useCallback(() => {
    clearSelection();
    detailCandidateRef.current = null;
    setActiveView("atlas");
  }, [clearSelection]);

  const detailCandidate = activeView === "detail" ? (selectedCandidate || detailCandidateRef.current) : selectedCandidate;
  const badge = SYNC_BADGE[syncMode];
  const BadgeIcon = badge.icon;
  const canToggle = syncMode === "persisted" || syncMode === "memory" || syncMode === "live";

  const contributors = useMemo(() => ["all", ...new Set(state.archive.map((candidate) => candidate.contributor).filter(Boolean) as string[])], [state.archive]);
  const experimentIds = useMemo(() => ["all", ...new Set(state.archive.map((candidate) => candidate.experimentId).filter(Boolean) as string[])], [state.archive]);
  const objectiveTypes = useMemo(() => ["all", ...new Set(state.archive.map((candidate) => candidate.objectiveType).filter(Boolean) as string[])], [state.archive]);

  const filteredArchive = useMemo(() => state.archive.filter((candidate) => {
    if (atlasFilters.contributor !== "all" && candidate.contributor !== atlasFilters.contributor) return false;
    if (atlasFilters.experimentId !== "all" && candidate.experimentId !== atlasFilters.experimentId) return false;
    if (atlasFilters.objectiveType !== "all" && candidate.objectiveType !== atlasFilters.objectiveType) return false;
    if (atlasFilters.regime !== "all" && candidate.regime !== atlasFilters.regime) return false;
    return true;
  }), [atlasFilters, state.archive]);

  const tabs = [
    { id: "dashboard" as const, label: "Live Dashboard", icon: Activity },
    { id: "atlas" as const, label: "Atlas Map", icon: Map },
    { id: "observatory" as const, label: "Geometry Observatory", icon: FlaskConical },
    { id: "experiments" as const, label: "Experiments", icon: FlaskConical },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/labs")} className="text-muted-foreground hover:text-foreground transition-colors">
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
                syncMode === "live"
                  ? "Cloud stream is shared globally and updates in real time."
                  : syncMode === "persisted"
                  ? "Saving to IndexedDB. Click to switch to in-memory."
                  : "In-memory only. Click to enable persistence."
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
            <span className="text-[9px] font-medium text-success">LIVE</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border">
            <span className="text-[9px] font-mono text-muted-foreground">
              Gen {state.totalGenerations} | {(state.archiveSize ?? state.archive.length).toLocaleString()} archived
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="border-b border-border px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveView(tab.id)} className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${isActive ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
          {(selectedCandidate || detailCandidateRef.current) && (
            <button onClick={() => setActiveView("detail")} className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${activeView === "detail" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Fingerprint className="w-3.5 h-3.5" />
              Design Detail
            </button>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
        {activeView === "atlas" && (
          <section className="mb-5 grid sm:grid-cols-4 gap-2">
            <select className="px-2 py-2 rounded-md border border-border bg-background text-xs" value={atlasFilters.contributor} onChange={(event) => setAtlasFilters((prev) => ({ ...prev, contributor: event.target.value }))}>
              {contributors.map((value) => <option key={value} value={value}>{value === "all" ? "All contributors" : value}</option>)}
            </select>
            <select className="px-2 py-2 rounded-md border border-border bg-background text-xs" value={atlasFilters.experimentId} onChange={(event) => setAtlasFilters((prev) => ({ ...prev, experimentId: event.target.value }))}>
              {experimentIds.map((value) => <option key={value} value={value}>{value === "all" ? "All experiments" : value}</option>)}
            </select>
            <select className="px-2 py-2 rounded-md border border-border bg-background text-xs" value={atlasFilters.objectiveType} onChange={(event) => setAtlasFilters((prev) => ({ ...prev, objectiveType: event.target.value }))}>
              {objectiveTypes.map((value) => <option key={value} value={value}>{value === "all" ? "All objectives" : value}</option>)}
            </select>
            <select className="px-2 py-2 rounded-md border border-border bg-background text-xs" value={atlasFilters.regime} onChange={(event) => setAtlasFilters((prev) => ({ ...prev, regime: event.target.value as RegimeId | "all" }))}>
              <option value="all">All regimes</option>
              {REGIMES.map((regime) => <option key={regime.id} value={regime.id}>{regime.label}</option>)}
            </select>
          </section>
        )}

        <AnimatePresence mode="wait">
          {activeView === "dashboard" && <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}><LiveDashboard state={state} onSelectCandidate={handleSelectCandidate} /></motion.div>}
          {activeView === "atlas" && <motion.div key="atlas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}><AtlasSurface state={{ ...state, archive: filteredArchive }} onSelectCandidate={handleSelectCandidate} /></motion.div>}
          {activeView === "observatory" && <motion.div key="observatory" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}><GeometryObservatory /></motion.div>}
          {activeView === "experiments" && (
            <motion.div key="experiments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
              <section className="surface-elevated rounded-xl border border-border p-4 space-y-4">
                <div className="grid sm:grid-cols-5 gap-2 items-end">
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Contributor</p>
                    <input className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.contributor} onChange={(event) => setConfig((prev) => ({ ...prev, contributor: event.target.value || "guest" }))} />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Regime</p>
                    <select className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.regime} onChange={(event) => setConfig((prev) => ({ ...prev, regime: event.target.value as RegimeId }))}>
                      {REGIMES.map((regime) => <option key={regime.id} value={regime.id}>{regime.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Search strategy</p>
                    <select className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.searchStrategy} onChange={(event) => setConfig((prev) => ({ ...prev, searchStrategy: event.target.value as SearchStrategy }))}>
                      <option value="genetic">Genetic algorithm</option>
                      <option value="cma-es">CMA-ES</option>
                      <option value="rl">Reinforcement learning</option>
                      <option value="bayesian">Bayesian optimization</option>
                      <option value="map-elites">MAP-Elites</option>
                      <option value="random">Pure random baseline</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Objective aggregation</p>
                    <select className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.objectiveComposer} onChange={(event) => setConfig((prev) => ({ ...prev, objectiveComposer: event.target.value as ObjectiveComposer }))}>
                      <option value="weighted-sum">Weighted sum</option>
                      <option value="lexicographic">Lexicographic</option>
                      <option value="pareto">Pareto frontier only</option>
                      <option value="risk-adjusted">Risk-adjusted composite</option>
                      <option value="worst-case">Worst-case across regimes</option>
                    </select>
                  </div>
                  <button onClick={handleSubmitExperiment} className="px-3 py-2 rounded-md bg-foreground text-background text-xs font-semibold">Compile experiment</button>
                </div>

                <div className="grid lg:grid-cols-3 gap-3 text-[11px]">
                  <label className="block">
                    <p className="text-muted-foreground mb-1">Generations</p>
                    <input type="number" min={3} max={40} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.generations} onChange={(event) => setConfig((prev) => ({ ...prev, generations: Number(event.target.value) || 8 }))} />
                  </label>
                  <label className="block">
                    <p className="text-muted-foreground mb-1">Population size</p>
                    <input type="number" min={32} max={512} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.populationSize} onChange={(event) => setConfig((prev) => ({ ...prev, populationSize: Number(event.target.value) || 96 }))} />
                  </label>
                  <label className="block">
                    <p className="text-muted-foreground mb-1">Mutation strength</p>
                    <input type="number" min={0.01} max={1} step={0.01} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.mutationStrength} onChange={(event) => setConfig((prev) => ({ ...prev, mutationStrength: Number(event.target.value) || 0.35 }))} />
                  </label>
                  <label className="block">
                    <p className="text-muted-foreground mb-1">Structural mutation probability</p>
                    <input type="number" min={0} max={1} step={0.01} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.structuralMutationProbability} onChange={(event) => setConfig((prev) => ({ ...prev, structuralMutationProbability: Number(event.target.value) || 0.24 }))} />
                  </label>
                  <label className="block">
                    <p className="text-muted-foreground mb-1">Invariant mutation probability</p>
                    <input type="number" min={0} max={1} step={0.01} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.invariantMutationProbability} onChange={(event) => setConfig((prev) => ({ ...prev, invariantMutationProbability: Number(event.target.value) || 0.18 }))} />
                  </label>
                  <label className="block">
                    <p className="text-muted-foreground mb-1">Topology mutation probability</p>
                    <input type="number" min={0} max={1} step={0.01} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.topologyMutationProbability} onChange={(event) => setConfig((prev) => ({ ...prev, topologyMutationProbability: Number(event.target.value) || 0.1 }))} />
                  </label>
                </div>

                <div className="grid lg:grid-cols-2 gap-3 text-[11px]">
                  <label className="block">
                    <p className="text-muted-foreground mb-1">Regime sampling mode</p>
                    <select className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.stressMode} onChange={(event) => setConfig((prev) => ({ ...prev, stressMode: event.target.value as ExperimentConfig["stressMode"] }))}>
                      <option value="baseline">Preset baseline regime</option>
                      <option value="regime-path">Regime path simulation</option>
                      <option value="adversarial">Adversarial regime generation</option>
                      <option value="distribution-weighted">Distribution-weighted Monte Carlo</option>
                    </select>
                  </label>
                  <label className="block">
                    <p className="text-muted-foreground mb-1">Objective vector</p>
                    <input className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.objectiveVector.join(", ")} onChange={(event) => setConfig((prev) => ({ ...prev, objectiveVector: event.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))} />
                  </label>
                </div>

                <div className="grid sm:grid-cols-4 gap-2 text-[11px]">
                  {[{ label: "Structural evolution", key: "structuralEvolution" }, { label: "Parameter tuning", key: "parameterTuning" }, { label: "Liquidity geometry mutation", key: "liquidityMutation" }, { label: "Fee policy search", key: "feePolicySearch" }].map((toggle) => (
                    <label key={toggle.key} className="flex items-center gap-2 rounded border border-border p-2">
                      <input type="checkbox" checked={config[toggle.key as keyof Pick<ExperimentConfig, "structuralEvolution" | "parameterTuning" | "liquidityMutation" | "feePolicySearch">] as boolean} onChange={(event) => setConfig((prev) => ({ ...prev, [toggle.key]: event.target.checked }))} />
                      <span>{toggle.label}</span>
                    </label>
                  ))}
                </div>

                <label className="block text-[11px]">
                  <p className="text-muted-foreground mb-1">Hierarchical composition plan</p>
                  <textarea className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs min-h-16" value={config.compositionPlan} onChange={(event) => setConfig((prev) => ({ ...prev, compositionPlan: event.target.value }))} />
                </label>
              </section>

              {experiments.map((experiment) => (
                <section key={experiment.id} className="surface-elevated rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold">{experiment.id} · {experiment.config.contributor}</p>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${experiment.status === "completed" ? "border-success/30 text-success" : "border-warning/30 text-warning"}`}>{experiment.status.toUpperCase()}</span>
                  </div>
                  <div className="grid sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
                    <div>Gen {experiment.currentGeneration}/{experiment.config.generations}</div>
                    <div>Strategy: {experiment.config.searchStrategy}</div>
                    <div>Objective: {experiment.config.objectiveComposer}</div>
                    <div>Pareto set: {experiment.paretoCount}</div>
                    <div>Δ score: {experiment.convergenceRate.toFixed(4)}</div>
                    <div>Dispersion: {experiment.parameterDispersion.toFixed(2)}</div>
                    <div>Variance: {experiment.performanceVariance.toFixed(5)}</div>
                    <div>Fragility: {experiment.structuralFragility.toFixed(4)}</div>
                    <div>Robustness: {experiment.robustnessScore.toFixed(4)}</div>
                    <div>Stress mode: {experiment.config.stressMode}</div>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">Plan: {experiment.config.compositionPlan}</p>
                  {experiment.bestCandidate && (
                    <button className="mt-3 text-xs text-chart-3 underline" onClick={() => handleSelectCandidate(experiment.bestCandidate!.id)}>
                      Open champion · LP/HODL {experiment.bestCandidate.metrics.lpValueVsHodl.toFixed(3)} · Slippage {(experiment.bestCandidate.metrics.totalSlippage * 100).toFixed(2)}%
                    </button>
                  )}
                </section>
              ))}
            </motion.div>
          )}
          {activeView === "detail" && detailCandidate && <motion.div key="detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}><DesignDetail candidate={detailCandidate} state={state} onBack={handleBackFromDetail} /></motion.div>}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default DiscoveryAtlas;
