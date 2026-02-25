import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Activity, Map, Fingerprint, Radio, Wifi, HardDrive, Loader2,
  FlaskConical, Radar, Zap, Layers, Repeat,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LiveDashboard from "@/components/labs/LiveDashboard";
import AtlasSurface from "@/components/labs/AtlasSurface";
import DesignDetail from "@/components/labs/DesignDetail";
import GeometryObservatory from "@/components/labs/GeometryObservatory";
import ExperimentsTab from "@/components/labs/ExperimentsTab";
import FamilyDirectory from "@/components/labs/FamilyDirectory";
import StudioLoopPanel from "@/components/labs/StudioLoopPanel";
import MethodologyTab from "@/components/labs/MethodologyTab";
import LabHelpLink from "@/components/labs/LabHelpLink";
import { useDiscoveryEngine, type SyncMode } from "@/hooks/use-discovery-engine";
import { type Candidate, type RegimeId, REGIMES, createInitialState, runGeneration } from "@/lib/discovery-engine";

type View = "dashboard" | "atlas" | "directory" | "studio-loop" | "observatory" | "experiments" | "methodology" | "detail";
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
  scoreHistory: number[];
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
    compositionPlan: "Explore invariant families → narrow top 3 → robust optimization → adversarial stress → fine tune liquidity",
  });
  const [atlasFilters, setAtlasFilters] = useState({ contributor: "all", experimentId: "all", objectiveType: "all", regime: "all" as RegimeId | "all", source: "all", poolType: "all" });
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
              scoreHistory: [...experiment.scoreHistory, bestScore],
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
      scoreHistory: [],
    }, ...prev]);
    runExperiment(expId, config);
    setActiveView("experiments");
  }, [config, runExperiment]);

  const handleSelectCandidate = useCallback((id: string) => {
    selectCandidate(id);
    setActiveView("detail");
  }, [selectCandidate]);

  const handleImportStudioCandidate = useCallback((candidate: Candidate) => {
    ingestExperimentCandidates([{
      ...candidate,
      source: "user-designed",
      contributor: "studio",
      experimentId: candidate.experimentId ?? "studio",
      objectiveType: candidate.objectiveType ?? "studio",
    }], `Studio import: ${candidate.id} evaluated and mapped to atlas`);
    setActiveView("atlas");
  }, [ingestExperimentCandidates]);

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
    if (atlasFilters.source !== "all" && (candidate.source ?? "global") !== atlasFilters.source) return false;
    if (atlasFilters.poolType !== "all" && (candidate.poolType ?? "two-asset") !== atlasFilters.poolType) return false;
    return true;
  }), [atlasFilters, state.archive]);

  const tabs = [
    { id: "dashboard" as const, label: "Live Dashboard", icon: Activity },
    { id: "atlas" as const, label: "Atlas Map", icon: Map },
    { id: "directory" as const, label: "Family Directory", icon: Layers },
    { id: "studio-loop" as const, label: "Studio Loop", icon: Repeat },
    { id: "observatory" as const, label: "Geometry Observatory", icon: Radar },
    { id: "experiments" as const, label: "Experiments", icon: FlaskConical },
    { id: "methodology" as const, label: "Methodology", icon: Radar },
  ];
  const tabToMethodSection: Record<Exclude<View, "detail">, string> = {
    dashboard: "method-dashboard",
    atlas: "method-atlas",
    directory: "method-directory",
    "studio-loop": "method-studio-loop",
    observatory: "method-observatory",
    experiments: "method-experiments",
    methodology: "method-overview",
  };

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
              <LabHelpLink href="#method-sync" label="Sync modes and persistence" className="ml-1" />
            </button>
          ) : (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${badge.className}`}>
              <BadgeIcon className={`w-3 h-3 ${syncMode === "loading" ? "animate-spin" : ""}`} />
              <span className="text-[9px] font-medium">{badge.label}</span>
              <LabHelpLink href="#method-sync" label="Sync modes and persistence" className="ml-1" />
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/5 border border-success/20">
            <Radio className="w-3 h-3 text-success animate-pulse" />
            <span className="text-[9px] font-medium text-success">LIVE</span>
            <LabHelpLink href="#method-overview" label="System overview" className="ml-1" />
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border">
            <span className="text-[9px] font-mono text-muted-foreground">
              Gen {state.totalGenerations} | {(state.archiveSize ?? state.archive.length).toLocaleString()} archived
            </span>
            <LabHelpLink href="#method-dashboard" label="Generation counter and archive" className="ml-1" />
          </div>
          {genRate !== null && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-secondary border border-border">
              <Zap className="w-3 h-3 text-warning" />
              <span className="text-[9px] font-mono text-muted-foreground">{genRate} gen/s</span>
              <LabHelpLink href="#method-dashboard" label="Generation-rate computation" className="ml-1" />
            </div>
          )}
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
                <LabHelpLink
                  href={`#${tabToMethodSection[tab.id]}`}
                  label={`${tab.label} methodology`}
                />
              </button>
            );
          })}
          {(selectedCandidate || detailCandidateRef.current) && (
            <button onClick={() => setActiveView("detail")} className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${activeView === "detail" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Fingerprint className="w-3.5 h-3.5" />
              Design Detail
              <LabHelpLink href="#method-detail" label="Design detail methodology" />
            </button>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
        {activeView === "atlas" && (
          <section className="mb-5 grid sm:grid-cols-6 gap-2">
            <div>
              <select className="px-2 py-2 rounded-md border border-border bg-background text-xs w-full" value={atlasFilters.contributor} onChange={(event) => setAtlasFilters((prev) => ({ ...prev, contributor: event.target.value }))}>
              {contributors.map((value) => <option key={value} value={value}>{value === "all" ? "All contributors" : value}</option>)}
            </select>
            </div>
            <div>
              <select className="px-2 py-2 rounded-md border border-border bg-background text-xs w-full" value={atlasFilters.experimentId} onChange={(event) => setAtlasFilters((prev) => ({ ...prev, experimentId: event.target.value }))}>
              {experimentIds.map((value) => <option key={value} value={value}>{value === "all" ? "All experiments" : value}</option>)}
            </select>
            </div>
            <div>
              <select className="px-2 py-2 rounded-md border border-border bg-background text-xs w-full" value={atlasFilters.objectiveType} onChange={(event) => setAtlasFilters((prev) => ({ ...prev, objectiveType: event.target.value }))}>
              {objectiveTypes.map((value) => <option key={value} value={value}>{value === "all" ? "All objectives" : value}</option>)}
            </select>
            </div>
            <div>
              <select className="px-2 py-2 rounded-md border border-border bg-background text-xs w-full" value={atlasFilters.regime} onChange={(event) => setAtlasFilters((prev) => ({ ...prev, regime: event.target.value as RegimeId | "all" }))}>
              <option value="all">All regimes</option>
              {REGIMES.map((regime) => <option key={regime.id} value={regime.id}>{regime.label}</option>)}
            </select>
            </div>
            <div>
              <select className="px-2 py-2 rounded-md border border-border bg-background text-xs w-full" value={atlasFilters.source} onChange={(event) => setAtlasFilters((prev) => ({ ...prev, source: event.target.value }))}>
              <option value="all">All sources</option>
              <option value="global">Discovered</option>
              <option value="experiment">Experimental</option>
              <option value="user-designed">User-designed</option>
            </select>
            </div>
            <div>
              <select className="px-2 py-2 rounded-md border border-border bg-background text-xs w-full" value={atlasFilters.poolType} onChange={(event) => setAtlasFilters((prev) => ({ ...prev, poolType: event.target.value }))}>
              <option value="all">All pool layers</option>
              <option value="two-asset">Two-asset layer</option>
              <option value="multi-asset">Multi-asset layer</option>
            </select>
            </div>
          </section>
        )}

        <AnimatePresence mode="wait">
          {activeView === "dashboard" && <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}><LiveDashboard state={state} onSelectCandidate={handleSelectCandidate} /></motion.div>}
          {activeView === "atlas" && <motion.div key="atlas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}><AtlasSurface state={{ ...state, archive: filteredArchive }} onSelectCandidate={handleSelectCandidate} /></motion.div>}
          {activeView === "directory" && <motion.div key="directory" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}><FamilyDirectory state={{ ...state, archive: filteredArchive }} /></motion.div>}
          {activeView === "studio-loop" && <motion.div key="studio-loop" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}><StudioLoopPanel state={state} onImportStudioCandidate={handleImportStudioCandidate} /></motion.div>}
          {activeView === "observatory" && <motion.div key="observatory" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}><GeometryObservatory state={state} onIngestCandidates={ingestExperimentCandidates} /></motion.div>}
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
          {activeView === "methodology" && <motion.div key="methodology" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}><MethodologyTab /></motion.div>}
          {activeView === "detail" && detailCandidate && <motion.div key="detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}><DesignDetail candidate={detailCandidate} state={state} onBack={handleBackFromDetail} /></motion.div>}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default DiscoveryAtlas;
