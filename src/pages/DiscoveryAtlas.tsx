import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, Map, Fingerprint, Radio, Wifi, HardDrive, Loader2, FlaskConical } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LiveDashboard from "@/components/labs/LiveDashboard";
import AtlasSurface from "@/components/labs/AtlasSurface";
import DesignDetail from "@/components/labs/DesignDetail";
import { useDiscoveryEngine, type SyncMode } from "@/hooks/use-discovery-engine";
import { type Candidate, type RegimeId, REGIMES, createInitialState, runGeneration } from "@/lib/discovery-engine";

type View = "dashboard" | "atlas" | "experiments" | "detail";
type ObjectiveType = "lp-value" | "slippage" | "balanced";

type ExperimentConfig = {
  contributor: string;
  regime: RegimeId;
  objective: ObjectiveType;
  generations: number;
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
  const { state, selectedCandidate, selectCandidate, clearSelection, syncMode, togglePersistence, ingestExperimentCandidates } = useDiscoveryEngine();
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [config, setConfig] = useState<ExperimentConfig>({ contributor: "guest", regime: "low-vol", objective: "balanced", generations: 8 });
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
            <button onClick={togglePersistence} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border cursor-pointer hover:opacity-80 transition-opacity ${badge.className}`}>
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
            <span className="text-[9px] font-mono text-muted-foreground">Gen {state.totalGenerations} | {state.archive.length.toLocaleString()} archived</span>
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
        <section className="mb-6 surface-elevated rounded-xl border border-border p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-chart-3/30 text-chart-3">PHASE TWO</span>
            <h1 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">Build, run, and analyze isolated Atlas experiments.</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">Use the Experiment Builder to define contributor, regime, and optimization objective. Submitted runs execute separate evolutionary loops and auto-ingest resulting candidates into the global Atlas archive with full experiment metadata.</p>
        </section>

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
          {activeView === "experiments" && (
            <motion.div key="experiments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
              <section className="surface-elevated rounded-xl border border-border p-4 grid sm:grid-cols-5 gap-2 items-end">
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
                  <p className="text-[11px] text-muted-foreground mb-1">Objective</p>
                  <select className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.objective} onChange={(event) => setConfig((prev) => ({ ...prev, objective: event.target.value as ObjectiveType }))}>
                    <option value="balanced">Balanced metric vector</option>
                    <option value="lp-value">Max LP/HODL</option>
                    <option value="slippage">Min slippage & leakage</option>
                  </select>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Generations</p>
                  <input type="number" min={3} max={20} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={config.generations} onChange={(event) => setConfig((prev) => ({ ...prev, generations: Number(event.target.value) || 8 }))} />
                </div>
                <button onClick={handleSubmitExperiment} className="px-3 py-2 rounded-md bg-foreground text-background text-xs font-semibold">Submit experiment</button>
              </section>

              {experiments.map((experiment) => (
                <section key={experiment.id} className="surface-elevated rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold">{experiment.id} · {experiment.config.contributor}</p>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${experiment.status === "completed" ? "border-success/30 text-success" : "border-warning/30 text-warning"}`}>{experiment.status.toUpperCase()}</span>
                  </div>
                  <div className="grid sm:grid-cols-6 gap-2 text-[11px] text-muted-foreground">
                    <div>Gen {experiment.currentGeneration}/{experiment.config.generations}</div>
                    <div>Objective: {experiment.config.objective}</div>
                    <div>Pareto: {experiment.paretoCount}</div>
                    <div>Δ score: {experiment.convergenceRate.toFixed(4)}</div>
                    <div>Dispersion: {experiment.parameterDispersion.toFixed(2)}</div>
                    <div>Variance: {experiment.performanceVariance.toFixed(5)}</div>
                  </div>
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
