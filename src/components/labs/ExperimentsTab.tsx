import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Send, Sparkles, TrendingUp, Beaker,
  ChevronDown, ChevronRight, Lightbulb, BarChart3, MessageSquare,
  Target, Layers, Zap,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  RadarChart, Radar as RadarChartElement, PolarGrid, PolarAngleAxis,
} from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import type { Candidate, RegimeId, EngineState } from "@/lib/discovery-engine";
import { REGIMES } from "@/lib/discovery-engine";

// ─── Types ──────────────────────────────────────────────────────────────────

type ObjectiveType = "lp-value" | "slippage" | "balanced";
type SearchStrategy = "genetic" | "cma-es" | "rl" | "bayesian" | "map-elites" | "random";
type ObjectiveComposer = "weighted-sum" | "lexicographic" | "pareto" | "risk-adjusted" | "worst-case";

export type ExperimentConfig = {
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

export type Experiment = {
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

const RESEARCH_OBJECTIVES = [
  "fee_revenue",
  "slippage",
  "arb_leakage",
  "tail_drawdown",
  "utilization",
  "regime_robustness",
  "parameter_sensitivity",
] as const;

const scoreBar = (value: number) => `${Math.max(4, Math.min(100, value * 100))}%`;
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/amm-chat`;

// ─── AI Assistant Messages ──────────────────────────────────────────────────

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

const AI_SUGGESTIONS: Record<string, string> = {
  "How should I configure my first experiment?": "Start with a **balanced** objective using **MAP-Elites** search strategy. This gives you the broadest coverage of the design space. Use `regime-path` stress mode to test across changing market conditions. Set population size to 96 and mutation strength to 0.35 for good exploration/exploitation balance. Enable all structural toggles for the first run.",
  "What search strategy works best for finding robust AMMs?": "For robustness, use **Bayesian optimization** with a **risk-adjusted** objective composer. This explicitly accounts for downside risk. Pair it with **adversarial** stress mode to test against worst-case scenarios. Include `regime_robustness` and `tail_drawdown` in your objective vector. Keep mutation strength moderate (0.2-0.4) to avoid destroying good solutions.",
  "How do I minimize impermanent loss?": "Focus on the **lp-value** objective with **lexicographic** composition (LP value first, then fees). Use a concentrated liquidity geometry with adaptive rebalancing. The **CMA-ES** strategy works well here as it efficiently optimizes continuous parameters. Set `arb_leakage` and `tail_drawdown` as secondary objectives.",
  "What's the difference between Pareto and weighted-sum?": "**Pareto** finds the entire frontier of non-dominated solutions — no single metric can improve without worsening another. Great for exploration. **Weighted-sum** collapses everything to one number, which is faster but may miss solutions in concave regions of the frontier. Use Pareto when you don't know your preferences; weighted-sum when you have clear priorities.",
  "How many generations do I need?": "For initial exploration: **5-8 generations** with a large population (128+). For refinement: **15-25 generations** with a smaller population (64). Watch the convergence rate — if Δ score drops below 0.001 for 3+ generations, you've likely converged. The adversarial stress mode needs more generations (2x) since the landscape is harder.",
};

function generateAssistantResponse(userInput: string): string {
  const lower = userInput.toLowerCase();

  if (lower.includes("first") || lower.includes("start") || lower.includes("begin") || lower.includes("configure"))
    return AI_SUGGESTIONS["How should I configure my first experiment?"];
  if (lower.includes("robust") || lower.includes("stable") || lower.includes("safe"))
    return AI_SUGGESTIONS["What search strategy works best for finding robust AMMs?"];
  if (lower.includes("impermanent") || lower.includes("il") || lower.includes("lp value") || lower.includes("hodl"))
    return AI_SUGGESTIONS["How do I minimize impermanent loss?"];
  if (lower.includes("pareto") || lower.includes("weighted") || lower.includes("difference"))
    return AI_SUGGESTIONS["What's the difference between Pareto and weighted-sum?"];
  if (lower.includes("generation") || lower.includes("how many") || lower.includes("converge"))
    return AI_SUGGESTIONS["How many generations do I need?"];
  if (lower.includes("fee") || lower.includes("revenue"))
    return "To maximize fee revenue, use **genetic algorithm** with a **weighted-sum** composer heavily favoring `fee_revenue` (weight 0.6). Enable **fee policy search** to let the engine explore dynamic fee structures. Use **high-vol** regime since that's where fee opportunities are richest. Consider adding `utilization` as a secondary objective to ensure liquidity is actually being used.";
  if (lower.includes("mev") || lower.includes("sandwich") || lower.includes("frontrun"))
    return "MEV resistance requires special attention. Use **adversarial** stress mode with `arb_leakage` as a primary objective. Enable **structural evolution** to discover invariant families that are inherently MEV-resistant. Oracle-anchored invariants with MEV-adaptive fees tend to perform well. Run at least 15 generations with high mutation strength (0.4+) to explore the full space.";
  if (lower.includes("population") || lower.includes("size"))
    return "Population size is a tradeoff: **larger** (128-256) gives better diversity and reduces premature convergence, but each generation takes longer. **Smaller** (32-64) converges faster but may miss good regions. For MAP-Elites, use 128+ since it needs to fill many behavioral niches. For Bayesian optimization, 48-64 is sufficient since it's more sample-efficient.";

  return `Based on your question about "${userInput.slice(0, 50)}...", I'd recommend:\n\n1. **Start with balanced objectives** to understand the tradeoff landscape\n2. Use **regime-path** stress mode for realistic testing\n3. Enable **structural evolution** to discover novel invariant designs\n4. Monitor the convergence rate — if it plateaus, increase mutation strength or switch strategies\n\nWould you like me to suggest specific parameter values for your use case?`;
}

// ─── Strategy Descriptions ──────────────────────────────────────────────────

const STRATEGY_INFO: Record<SearchStrategy, { description: string; strengths: string; bestFor: string }> = {
  genetic: { description: "Tournament selection with crossover and mutation", strengths: "Good general-purpose optimizer", bestFor: "Broad exploration of the design space" },
  "cma-es": { description: "Covariance Matrix Adaptation Evolution Strategy", strengths: "Efficient continuous optimization", bestFor: "Fine-tuning liquidity distributions" },
  rl: { description: "Policy gradient reinforcement learning", strengths: "Adapts to sequential decision problems", bestFor: "Dynamic fee and rebalancing policies" },
  bayesian: { description: "Gaussian process surrogate with acquisition functions", strengths: "Sample-efficient, handles noise well", bestFor: "Expensive evaluations, robustness optimization" },
  "map-elites": { description: "Quality-diversity with behavioral descriptors", strengths: "Finds diverse high-quality solutions", bestFor: "Filling the structural coverage map" },
  random: { description: "Pure random sampling baseline", strengths: "Unbiased coverage, no convergence bias", bestFor: "Baseline comparison and initial exploration" },
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface ExperimentsTabProps {
  config: ExperimentConfig;
  setConfig: React.Dispatch<React.SetStateAction<ExperimentConfig>>;
  experiments: Experiment[];
  handleSubmitExperiment: () => void;
  handleSelectCandidate: (id: string) => void;
  state: EngineState;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ExperimentsTab({
  config,
  setConfig,
  experiments,
  handleSubmitExperiment,
  handleSelectCandidate,
  state,
}: ExperimentsTabProps) {
  const colors = useChartColors();
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content: "Welcome to the Experiment Designer. I can help you configure your AMM search experiments. Try asking me about search strategies, objective functions, or how to find robust AMM designs.",
      timestamp: Date.now(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [showAssistant, setShowAssistant] = useState(true);
  const [expandedExperiment, setExpandedExperiment] = useState<string | null>(null);
  const [designMode, setDesignMode] = useState<"simple" | "advanced">("simple");
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);

  const fetchAssistantResponse = useCallback(async (userInput: string, conversation: AssistantMessage[]) => {
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          context: "You are assisting with AMM experiment design in the Experiments tab.",
          messages: conversation.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Assistant endpoint unavailable");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantSoFar = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;

          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          try {
            const parsed = JSON.parse(payload);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) assistantSoFar += content;
          } catch {
            // Wait for the next chunk when partial JSON arrives.
          }
        }
      }

      if (assistantSoFar.trim()) return assistantSoFar;
      throw new Error("Empty assistant response");
    } catch {
      return generateAssistantResponse(userInput);
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isAssistantLoading) return;
    const userMsg: AssistantMessage = { role: "user", content: text.trim(), timestamp: Date.now() };
    const conversation = [...assistantMessages, userMsg];
    setAssistantMessages(conversation);
    setIsAssistantLoading(true);

    const response = await fetchAssistantResponse(text.trim(), conversation);
    const assistantMsg: AssistantMessage = { role: "assistant", content: response, timestamp: Date.now() + 1 };
    setAssistantMessages((prev) => [...prev, assistantMsg]);
    setIsAssistantLoading(false);
  }, [assistantMessages, fetchAssistantResponse, isAssistantLoading]);

  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim()) return;
    const nextInput = chatInput;
    setChatInput("");
    await sendMessage(nextInput);
  }, [chatInput, sendMessage]);

  const quickQuestions = Object.keys(AI_SUGGESTIONS);

  const strategyInfo = STRATEGY_INFO[config.searchStrategy];

  // Experiment summary stats
  const experimentStats = useMemo(() => {
    if (experiments.length === 0) return null;
    const completed = experiments.filter(e => e.status === "completed").length;
    const totalCandidates = experiments.reduce((a, e) => a + e.currentGeneration * 40, 0);
    const bestOverall = experiments.reduce((best, e) => {
      if (!e.bestCandidate) return best;
      if (!best || e.bestScore < best.bestScore) return e;
      return best;
    }, null as Experiment | null);
    return { completed, running: experiments.length - completed, totalCandidates, bestOverall };
  }, [experiments]);

  return (
    <motion.div
      key="experiments"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Summary Stats Bar */}
      {experimentStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="surface-elevated rounded-xl border border-border p-3"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <FlaskConical className="w-3 h-3 text-chart-2" />
              <p className="text-[9px] text-muted-foreground">Experiments</p>
            </div>
            <p className="text-lg font-bold font-mono">{experiments.length}</p>
            <p className="text-[8px] text-muted-foreground">{experimentStats.completed} done, {experimentStats.running} running</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 }}
            className="surface-elevated rounded-xl border border-border p-3"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Layers className="w-3 h-3 text-chart-3" />
              <p className="text-[9px] text-muted-foreground">Candidates Generated</p>
            </div>
            <p className="text-lg font-bold font-mono">{experimentStats.totalCandidates}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="surface-elevated rounded-xl border border-border p-3"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3 h-3 text-chart-1" />
              <p className="text-[9px] text-muted-foreground">Best Score</p>
            </div>
            <p className="text-lg font-bold font-mono text-chart-1">
              {experimentStats.bestOverall?.bestScore !== undefined && experimentStats.bestOverall.bestScore < Infinity
                ? experimentStats.bestOverall.bestScore.toFixed(3)
                : "---"}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="surface-elevated rounded-xl border border-border p-3"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3 h-3 text-chart-4" />
              <p className="text-[9px] text-muted-foreground">Archive Size</p>
            </div>
            <p className="text-lg font-bold font-mono">{state.archive.length}</p>
          </motion.div>
        </div>
      )}

      {/* Main Layout: Experiment Builder + AI Assistant */}
      <div className="grid xl:grid-cols-3 gap-4">
        {/* Experiment Builder */}
        <div className="xl:col-span-2 space-y-4">
          <section className="surface-elevated rounded-xl border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Beaker className="w-4 h-4" />
                <h3 className="text-sm font-semibold">Experiment Designer</h3>
              </div>
              <div className="flex items-center gap-1">
                {(["simple", "advanced"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setDesignMode(mode)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                      designMode === mode
                        ? "bg-foreground/10 text-foreground border border-foreground/20"
                        : "text-muted-foreground border border-transparent hover:text-foreground"
                    }`}
                  >
                    {mode === "simple" ? "Simple" : "Advanced"}
                  </button>
                ))}
              </div>
            </div>

            {/* Core Config */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Contributor</p>
                <input
                  className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs"
                  value={config.contributor}
                  onChange={(e) => setConfig(prev => ({ ...prev, contributor: e.target.value || "guest" }))}
                />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Regime</p>
                <select
                  className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs"
                  value={config.regime}
                  onChange={(e) => setConfig(prev => ({ ...prev, regime: e.target.value as RegimeId }))}
                >
                  {REGIMES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Search Strategy</p>
                <select
                  className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs"
                  value={config.searchStrategy}
                  onChange={(e) => setConfig(prev => ({ ...prev, searchStrategy: e.target.value as SearchStrategy }))}
                >
                  <option value="genetic">Genetic algorithm</option>
                  <option value="cma-es">CMA-ES</option>
                  <option value="rl">Reinforcement learning</option>
                  <option value="bayesian">Bayesian optimization</option>
                  <option value="map-elites">MAP-Elites</option>
                  <option value="random">Pure random baseline</option>
                </select>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Objective Composer</p>
                <select
                  className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs"
                  value={config.objectiveComposer}
                  onChange={(e) => setConfig(prev => ({ ...prev, objectiveComposer: e.target.value as ObjectiveComposer }))}
                >
                  <option value="weighted-sum">Weighted sum</option>
                  <option value="lexicographic">Lexicographic</option>
                  <option value="pareto">Pareto frontier</option>
                  <option value="risk-adjusted">Risk-adjusted</option>
                  <option value="worst-case">Worst-case</option>
                </select>
              </div>
            </div>

            {/* Strategy Info Card */}
            <motion.div
              key={config.searchStrategy}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-chart-2/20 bg-chart-2/5 p-3"
            >
              <div className="flex items-start gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-chart-2 mt-0.5 shrink-0" />
                <div className="text-[10px]">
                  <p className="font-semibold text-foreground">{strategyInfo.description}</p>
                  <p className="text-muted-foreground mt-0.5">
                    <span className="text-chart-2">Strengths:</span> {strategyInfo.strengths} |{" "}
                    <span className="text-chart-2">Best for:</span> {strategyInfo.bestFor}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Objective Vector - Interactive Tags */}
            <div>
              <p className="text-[11px] text-muted-foreground mb-2">Objective Vector (click to toggle)</p>
              <div className="flex flex-wrap gap-1.5">
                {RESEARCH_OBJECTIVES.map(obj => {
                  const active = config.objectiveVector.includes(obj);
                  return (
                    <motion.button
                      key={obj}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${
                        active
                          ? "bg-chart-2/10 border-chart-2/40 text-foreground shadow-sm"
                          : "bg-background border-border text-muted-foreground hover:border-foreground/20"
                      }`}
                      onClick={() =>
                        setConfig(prev => ({
                          ...prev,
                          objectiveVector: active
                            ? prev.objectiveVector.filter(e => e !== obj)
                            : [...prev.objectiveVector, obj],
                        }))
                      }
                    >
                      {active && <span className="mr-1">&#10003;</span>}
                      {obj}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Numeric Parameters with Interactive Sliders */}
            <div className="grid sm:grid-cols-3 gap-3 text-[11px]">
              <label className="block">
                <div className="flex justify-between text-muted-foreground mb-1">
                  <span>Generations</span>
                  <span className="font-mono">{config.generations}</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={40}
                  value={config.generations}
                  onChange={(e) => setConfig(prev => ({ ...prev, generations: Number(e.target.value) }))}
                  className="w-full"
                />
              </label>
              <label className="block">
                <div className="flex justify-between text-muted-foreground mb-1">
                  <span>Population size</span>
                  <span className="font-mono">{config.populationSize}</span>
                </div>
                <input
                  type="range"
                  min={32}
                  max={256}
                  step={8}
                  value={config.populationSize}
                  onChange={(e) => setConfig(prev => ({ ...prev, populationSize: Number(e.target.value) }))}
                  className="w-full"
                />
              </label>
              <label className="block">
                <div className="flex justify-between text-muted-foreground mb-1">
                  <span>Mutation strength</span>
                  <span className="font-mono">{config.mutationStrength.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.01}
                  value={config.mutationStrength}
                  onChange={(e) => setConfig(prev => ({ ...prev, mutationStrength: Number(e.target.value) }))}
                  className="w-full"
                />
              </label>
            </div>

            {/* Advanced Options */}
            <AnimatePresence>
              {designMode === "advanced" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  <div className="grid sm:grid-cols-3 gap-3 text-[11px]">
                    <label className="block">
                      <div className="flex justify-between text-muted-foreground mb-1">
                        <span>Structural mutation</span>
                        <span className="font-mono">{config.structuralMutationProbability.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={0.5}
                        step={0.01}
                        value={config.structuralMutationProbability}
                        onChange={(e) => setConfig(prev => ({ ...prev, structuralMutationProbability: Number(e.target.value) }))}
                        className="w-full"
                      />
                    </label>
                    <label className="block">
                      <div className="flex justify-between text-muted-foreground mb-1">
                        <span>Invariant mutation</span>
                        <span className="font-mono">{config.invariantMutationProbability.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={0.5}
                        step={0.01}
                        value={config.invariantMutationProbability}
                        onChange={(e) => setConfig(prev => ({ ...prev, invariantMutationProbability: Number(e.target.value) }))}
                        className="w-full"
                      />
                    </label>
                    <label className="block">
                      <div className="flex justify-between text-muted-foreground mb-1">
                        <span>Topology mutation</span>
                        <span className="font-mono">{config.topologyMutationProbability.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={0.3}
                        step={0.01}
                        value={config.topologyMutationProbability}
                        onChange={(e) => setConfig(prev => ({ ...prev, topologyMutationProbability: Number(e.target.value) }))}
                        className="w-full"
                      />
                    </label>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-3 text-[11px]">
                    <label className="block">
                      <p className="text-muted-foreground mb-1">Regime sampling mode</p>
                      <select
                        className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs"
                        value={config.stressMode}
                        onChange={(e) => setConfig(prev => ({ ...prev, stressMode: e.target.value as ExperimentConfig["stressMode"] }))}
                      >
                        <option value="baseline">Preset baseline regime</option>
                        <option value="regime-path">Regime path simulation</option>
                        <option value="adversarial">Adversarial regime generation</option>
                        <option value="distribution-weighted">Distribution-weighted Monte Carlo</option>
                      </select>
                    </label>
                    <label className="block">
                      <p className="text-muted-foreground mb-1">Composition plan</p>
                      <input
                        className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs"
                        value={config.compositionPlan}
                        onChange={(e) => setConfig(prev => ({ ...prev, compositionPlan: e.target.value }))}
                      />
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Feature Toggles */}
            <div className="grid sm:grid-cols-4 gap-2 text-[11px]">
              {[
                { label: "Structural evolution", key: "structuralEvolution", icon: "🧬" },
                { label: "Parameter tuning", key: "parameterTuning", icon: "🎛" },
                { label: "Liquidity mutation", key: "liquidityMutation", icon: "💧" },
                { label: "Fee policy search", key: "feePolicySearch", icon: "💰" },
              ].map(toggle => {
                const checked = config[toggle.key as keyof Pick<ExperimentConfig, "structuralEvolution" | "parameterTuning" | "liquidityMutation" | "feePolicySearch">] as boolean;
                return (
                  <motion.button
                    key={toggle.key}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setConfig(prev => ({ ...prev, [toggle.key]: !checked }))}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 transition-all text-left ${
                      checked
                        ? "border-chart-2/30 bg-chart-2/5"
                        : "border-border hover:border-foreground/20"
                    }`}
                  >
                    <span className="text-sm">{toggle.icon}</span>
                    <span className={checked ? "text-foreground" : "text-muted-foreground"}>
                      {toggle.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* Launch Button */}
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmitExperiment}
                className="px-4 py-2.5 rounded-lg bg-foreground text-background text-xs font-semibold flex items-center gap-2 shadow-sm"
              >
                <Zap className="w-3.5 h-3.5" />
                Compile & Launch Experiment
              </motion.button>
              <p className="text-[10px] text-muted-foreground">
                Will generate ~{config.generations * config.populationSize} candidates across {config.generations} generations
              </p>
            </div>
          </section>
        </div>

        {/* AI Research Assistant */}
        <div className="surface-elevated rounded-xl border border-border flex flex-col" style={{ maxHeight: 680 }}>
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-chart-3" />
              <h3 className="text-xs font-semibold">Research Assistant</h3>
            </div>
            <button
              onClick={() => setShowAssistant(!showAssistant)}
              className="text-[9px] text-muted-foreground hover:text-foreground"
            >
              {showAssistant ? "Collapse" : "Expand"}
            </button>
          </div>

          <AnimatePresence>
            {showAssistant && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="flex flex-col flex-1 overflow-hidden"
              >
                {/* Quick Questions */}
                <div className="p-2 border-b border-border">
                  <p className="text-[9px] text-muted-foreground mb-1.5">Quick questions:</p>
                  <div className="flex flex-wrap gap-1">
                    {quickQuestions.slice(0, 3).map(q => (
                      <button
                        key={q}
                        onClick={() => {
                          void sendMessage(q);
                        }}
                        className="text-[9px] px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all truncate max-w-[200px]"
                      >
                        {q.length > 35 ? q.slice(0, 35) + "..." : q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: 400 }}>
                  {assistantMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-lg p-2.5 text-[10px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-foreground/5 border border-foreground/10 ml-4"
                          : "bg-chart-3/5 border border-chart-3/15 mr-2"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1 mb-1">
                          <Sparkles className="w-2.5 h-2.5 text-chart-3" />
                          <span className="text-[8px] font-medium text-chart-3">ASSISTANT</span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">
                        {msg.content.split("**").map((part, j) =>
                          j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isAssistantLoading && (
                    <div className="rounded-lg p-2.5 text-[10px] leading-relaxed bg-chart-3/5 border border-chart-3/15 mr-2 text-muted-foreground">
                      Ammy is thinking...
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-2 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <input
                      className="flex-1 px-2.5 py-2 rounded-md border border-border bg-background text-[10px]"
                      placeholder="Ask about experiment design..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleSendMessage(); }}
                    />
                    <button
                      onClick={() => { void handleSendMessage(); }}
                      disabled={isAssistantLoading || !chatInput.trim()}
                      className="p-2 rounded-md bg-chart-3/10 border border-chart-3/20 text-chart-3 hover:bg-chart-3/20 transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Experiment Results */}
      {experiments.map(experiment => {
        const progress = experiment.currentGeneration / Math.max(1, experiment.config.generations);
        const isExpanded = expandedExperiment === experiment.id;
        const stabilityVisual = Math.max(0.05, experiment.robustnessScore);
        const fragilityVisual = Math.max(0.05, experiment.structuralFragility);
        const varianceVisual = Math.max(0.05, experiment.performanceVariance * 8);

        // Build radar data for the champion
        const radarData = experiment.bestCandidate
          ? [
              { axis: "Fees", value: Math.min(experiment.bestCandidate.metrics.totalFees / 50, 1) * 100 },
              { axis: "Utilization", value: experiment.bestCandidate.metrics.liquidityUtilization * 100 },
              { axis: "LP Value", value: Math.min(experiment.bestCandidate.metrics.lpValueVsHodl, 1.2) / 1.2 * 100 },
              { axis: "Low Slip", value: Math.max(0, (1 - experiment.bestCandidate.metrics.totalSlippage * 10)) * 100 },
              { axis: "Low Arb", value: Math.max(0, (1 - experiment.bestCandidate.metrics.arbLeakage / 50)) * 100 },
              { axis: "Stability", value: Math.max(0, (1 - experiment.bestCandidate.stability * 5)) * 100 },
            ]
          : [];

        return (
          <motion.section
            key={experiment.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface-elevated rounded-xl border border-border overflow-hidden"
          >
            {/* Header */}
            <button
              className="w-full p-4 text-left flex items-center justify-between hover:bg-accent/30 transition-colors"
              onClick={() => setExpandedExperiment(isExpanded ? null : experiment.id)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <div>
                  <p className="text-sm font-semibold">{experiment.id} · {experiment.config.contributor}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {experiment.config.searchStrategy} | {experiment.config.objectiveComposer} | {experiment.config.regime}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {experiment.bestCandidate && (
                  <span className="text-[10px] font-mono text-chart-1">
                    best: {experiment.bestScore.toFixed(3)}
                  </span>
                )}
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    experiment.status === "completed"
                      ? "border-success/30 text-success bg-success/5"
                      : "border-warning/30 text-warning bg-warning/5"
                  }`}
                >
                  {experiment.status === "running" ? `GEN ${experiment.currentGeneration}/${experiment.config.generations}` : "DONE"}
                </span>
              </div>
            </button>

            {/* Progress Bar */}
            <div className="px-4">
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${experiment.status === "completed" ? "bg-success" : "bg-chart-2"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, progress * 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Expanded Detail */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 space-y-4">
                    <div className="grid lg:grid-cols-3 gap-4">
                      {/* Search Diagnostics */}
                      <div className="rounded-lg border border-border p-3 space-y-2">
                        <p className="text-[10px] font-semibold flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Search Diagnostics
                        </p>
                        <div className="space-y-1.5 text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Strategy</span>
                            <span className="font-mono">{experiment.config.searchStrategy}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pareto set</span>
                            <span className="font-mono">{experiment.paretoCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Delta score</span>
                            <span className="font-mono">{experiment.convergenceRate.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Dispersion</span>
                            <span className="font-mono">{experiment.parameterDispersion}</span>
                          </div>
                        </div>
                      </div>

                      {/* Risk Profile */}
                      <div className="rounded-lg border border-border p-3 space-y-2">
                        <p className="text-[10px] font-semibold">Risk Profile</p>
                        <div className="space-y-2 text-[10px]">
                          <div>
                            <div className="flex justify-between mb-0.5">
                              <span className="text-muted-foreground">Robustness</span>
                              <span className="font-mono">{experiment.robustnessScore.toFixed(3)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-secondary overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-success"
                                animate={{ width: scoreBar(stabilityVisual) }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between mb-0.5">
                              <span className="text-muted-foreground">Fragility</span>
                              <span className="font-mono">{experiment.structuralFragility.toFixed(3)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-secondary overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-warning"
                                animate={{ width: scoreBar(fragilityVisual) }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between mb-0.5">
                              <span className="text-muted-foreground">Variance</span>
                              <span className="font-mono">{experiment.performanceVariance.toFixed(5)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-secondary overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-chart-4"
                                animate={{ width: scoreBar(varianceVisual) }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Champion Radar */}
                      {experiment.bestCandidate && radarData.length > 0 ? (
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-[10px] font-semibold mb-1">Champion Profile</p>
                          <div className="h-36">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart data={radarData}>
                                <PolarGrid stroke={colors.grid} />
                                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 7, fill: colors.tick }} />
                                <RadarChartElement
                                  dataKey="value"
                                  stroke="hsl(var(--chart-1))"
                                  fill="hsl(var(--chart-1))"
                                  fillOpacity={0.15}
                                  strokeWidth={2}
                                />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border p-3 flex items-center justify-center">
                          <p className="text-[10px] text-muted-foreground">Waiting for champion...</p>
                        </div>
                      )}
                    </div>

                    {/* Score convergence chart */}
                    {experiment.scoreHistory.length > 1 && (
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-[10px] font-semibold mb-2 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Score Convergence
                          <span className="text-[8px] font-normal text-muted-foreground ml-1">— lower is better</span>
                        </p>
                        <div className="h-28">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={experiment.scoreHistory.map((s, i) => ({ gen: i + 1, score: parseFloat(s.toFixed(4)) }))}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
                              <XAxis dataKey="gen" tick={{ fontSize: 7, fill: colors.tick }} label={{ value: "Generation", position: "insideBottomRight", offset: -4, fontSize: 7, fill: colors.tick }} />
                              <YAxis tick={{ fontSize: 7, fill: colors.tick }} width={40} tickFormatter={v => v.toFixed(1)} domain={["auto", "auto"]} />
                              <Tooltip
                                contentStyle={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 6, fontSize: 9, color: colors.tooltipText }}
                                wrapperStyle={{ pointerEvents: "none" }}
                                formatter={(value: number) => [value.toFixed(4), "Best score"]}
                                labelFormatter={(label: number) => `Generation ${label}`}
                              />
                              <Line
                                type="monotone"
                                dataKey="score"
                                stroke="hsl(var(--chart-1))"
                                strokeWidth={2}
                                dot={experiment.scoreHistory.length < 20}
                                name="Best score"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Objective Tags + Plan */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] text-muted-foreground">Objectives:</span>
                      {experiment.config.objectiveVector.map(obj => (
                        <span key={obj} className="px-2 py-0.5 rounded-full bg-chart-2/10 border border-chart-2/20 text-[9px] text-foreground">
                          {obj}
                        </span>
                      ))}
                    </div>

                    <p className="text-[10px] text-muted-foreground">
                      <span className="font-medium text-foreground">Plan:</span> {experiment.config.compositionPlan}
                    </p>

                    {/* Open Champion Button */}
                    {experiment.bestCandidate && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-chart-1/10 border border-chart-1/20 text-chart-1 font-medium"
                        onClick={() => handleSelectCandidate(experiment.bestCandidate!.id)}
                      >
                        Open champion · LP/HODL {experiment.bestCandidate.metrics.lpValueVsHodl.toFixed(3)} · Slippage {(experiment.bestCandidate.metrics.totalSlippage * 100).toFixed(2)}%
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        );
      })}

      {/* Empty State */}
      {experiments.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="surface-elevated rounded-xl border border-border p-8 text-center"
        >
          <FlaskConical className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground mb-1">No experiments yet</p>
          <p className="text-[10px] text-muted-foreground max-w-md mx-auto">
            Configure your search parameters above and click "Compile & Launch" to start evolving AMM designs.
            The AI assistant can help you choose the right strategy for your goals.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
