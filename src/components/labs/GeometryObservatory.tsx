import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Sparkles, Radar, Orbit, Beaker, Network, Target, Trophy,
  WandSparkles, Play, Pause, RotateCcw, TrendingUp, GitBranch,
  Zap, ChevronDown, ChevronRight, Activity, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar, Cell, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import type { EngineState, Candidate, RegimeId } from "@/lib/discovery-engine";
import {
  REGIMES, createRandomCandidate, evaluateCandidate, computeFeatures,
  scoreCandidate, mutateBins, normalizeBins, NUM_BINS, TOTAL_LIQUIDITY,
} from "@/lib/discovery-engine";

// ─── Structural Coordinate Types ────────────────────────────────────────────

const INVARIANT_FAMILIES = [
  "Constant product",
  "Constant sum",
  "Weighted geometric mean",
  "Hybrid stableswap",
  "Piecewise invariant",
  "Dynamic invariant",
  "Oracle-anchored invariant",
  "Custom symbolic invariant",
] as const;

const LIQUIDITY_FAMILIES = [
  "Uniform",
  "Concentrated (bounded)",
  "Multi-band",
  "Adaptive",
  "Discrete ticks",
  "Continuous parametric curve",
  "Learned distribution",
] as const;

const FEE_STRUCTURES = [
  "Flat",
  "Volume dependent",
  "Volatility dependent",
  "Jump-sensitive",
  "Inventory imbalance sensitive",
  "MEV-adaptive",
  "Dynamic multi-factor",
] as const;

// ─── Branch Type ────────────────────────────────────────────────────────────

type Branch = {
  id: string;
  invariant: string;
  liquidity: string;
  fee: string;
  posteriorMean: number;
  variance: number;
  expectedImprovement: number;
  novelty: number;
  robustness: number;
  tested: number;
  candidates: BranchCandidate[];
  scoreHistory: number[];
  bestScore: number;
  bestCandidate: BranchCandidate | null;
  lastExploredAt: number;
};

type BranchCandidate = {
  id: string;
  score: number;
  stability: number;
  fees: number;
  utilization: number;
  lpValue: number;
  slippage: number;
  arbLeakage: number;
  drawdown: number;
  regime: RegimeId;
  generation: number;
};

type ExplorationEvent = {
  timestamp: number;
  branchId: string;
  candidatesGenerated: number;
  bestScore: number;
  improvement: number;
  regime: RegimeId;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

const scoreBranch = (b: Branch) =>
  b.expectedImprovement * 0.35 +
  (b.variance > 0 ? Math.sqrt(b.variance) : 0) * 0.25 +
  b.novelty * 0.2 +
  b.robustness * 0.15 +
  (b.tested === 0 ? 0.3 : 0); // Bonus for unexplored

const thompsonSample = (b: Branch) => {
  const noise = (Math.random() - 0.5) * Math.sqrt(Math.max(b.variance, 0.01)) * 2;
  return b.posteriorMean + noise;
};

// Generate candidate bins shaped by the structural coordinates
function generateStructuredBins(
  invariant: string,
  liquidity: string,
): Float64Array {
  const bins = new Float64Array(NUM_BINS);
  const center = NUM_BINS / 2;

  // Base shape from liquidity family
  if (liquidity.includes("Uniform")) {
    for (let i = 0; i < NUM_BINS; i++) bins[i] = 1 + Math.random() * 0.3;
  } else if (liquidity.includes("Concentrated")) {
    const width = 4 + Math.floor(Math.random() * 8);
    for (let i = 0; i < NUM_BINS; i++) {
      const dist = Math.abs(i - center);
      bins[i] = dist < width ? (3 + Math.random()) : (0.1 + Math.random() * 0.2);
    }
  } else if (liquidity.includes("Multi-band")) {
    const bands = 2 + Math.floor(Math.random() * 3);
    const spacing = Math.floor(NUM_BINS / (bands + 1));
    for (let i = 0; i < NUM_BINS; i++) {
      let inBand = false;
      for (let b = 1; b <= bands; b++) {
        if (Math.abs(i - b * spacing) < 3) inBand = true;
      }
      bins[i] = inBand ? (2 + Math.random()) : (0.15 + Math.random() * 0.15);
    }
  } else if (liquidity.includes("Adaptive")) {
    for (let i = 0; i < NUM_BINS; i++) {
      const dist = Math.abs(i - center) / center;
      bins[i] = Math.exp(-dist * 2) * (1.5 + Math.random()) + 0.2;
    }
  } else if (liquidity.includes("Discrete")) {
    const ticks = 6 + Math.floor(Math.random() * 10);
    const tickPositions = Array.from({ length: ticks }, () => Math.floor(Math.random() * NUM_BINS));
    for (let i = 0; i < NUM_BINS; i++) {
      bins[i] = tickPositions.some(t => Math.abs(t - i) < 1) ? (2 + Math.random() * 2) : 0.05;
    }
  } else if (liquidity.includes("Continuous")) {
    const alpha = 0.5 + Math.random() * 2;
    for (let i = 0; i < NUM_BINS; i++) {
      bins[i] = Math.exp(-alpha * Math.abs(i - center) / center) + 0.1;
    }
  } else {
    // Learned - random with structure
    for (let i = 0; i < NUM_BINS; i++) bins[i] = Math.random() * Math.random() * 2 + 0.1;
  }

  // Modify based on invariant family
  if (invariant.includes("stableswap") || invariant.includes("Constant sum")) {
    // Flatten the distribution (stableswap-like)
    const mean = bins.reduce((a, b) => a + b, 0) / NUM_BINS;
    for (let i = 0; i < NUM_BINS; i++) bins[i] = bins[i] * 0.4 + mean * 0.6;
  } else if (invariant.includes("Weighted")) {
    // Asymmetric
    for (let i = 0; i < NUM_BINS; i++) {
      const weight = i < center ? 0.7 : 1.3;
      bins[i] *= weight;
    }
  } else if (invariant.includes("Piecewise")) {
    // Add discontinuities
    const breakpoints = [Math.floor(NUM_BINS * 0.33), Math.floor(NUM_BINS * 0.66)];
    for (const bp of breakpoints) {
      if (bp < NUM_BINS) bins[bp] *= 0.3;
    }
  } else if (invariant.includes("Dynamic") || invariant.includes("Oracle")) {
    // Add noise to simulate adaptive behavior
    for (let i = 0; i < NUM_BINS; i++) bins[i] *= (0.8 + Math.random() * 0.4);
  }

  // Add random perturbation
  for (let i = 0; i < NUM_BINS; i++) bins[i] = Math.max(0, bins[i] + (Math.random() - 0.5) * 0.3);
  normalizeBins(bins);
  return bins;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface GeometryObservatoryProps {
  state: EngineState;
  onIngestCandidates: (candidates: Candidate[], note?: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function GeometryObservatory({ state, onIngestCandidates }: GeometryObservatoryProps) {
  const colors = useChartColors();

  // ─── State ──────────────────────────────────────────────────────────────
  const [branches, setBranches] = useState<Branch[]>([]);
  const [explorationLog, setExplorationLog] = useState<ExplorationEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [totalAllocations, setTotalAllocations] = useState(0);
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [convergenceData, setConvergenceData] = useState<{ step: number; best: number; avg: number; explored: number }[]>([]);
  const [explorationSpeed, setExplorationSpeed] = useState<"fast" | "normal" | "thorough">("normal");
  const runningRef = useRef(false);
  const autoRunRef = useRef(false);
  autoRunRef.current = autoRun;

  // Initialize branches from structural combinations
  useEffect(() => {
    if (branches.length > 0) return;

    // Create branches for a curated set of promising structural combinations
    const combos: { inv: string; liq: string; fee: string }[] = [];
    // Full cross product would be huge - pick representative combos
    const keyInvariants = ["Hybrid stableswap", "Dynamic invariant", "Oracle-anchored invariant", "Piecewise invariant", "Constant product", "Weighted geometric mean"];
    const keyLiquidity = ["Concentrated (bounded)", "Adaptive", "Multi-band", "Continuous parametric curve", "Uniform", "Learned distribution"];
    const keyFees = ["Volatility dependent", "Dynamic multi-factor", "MEV-adaptive", "Flat", "Jump-sensitive"];

    for (const inv of keyInvariants) {
      for (const liq of keyLiquidity) {
        // Pair each with 1-2 fee structures for manageability
        const fees = keyFees.slice(0, 2 + Math.floor(Math.random() * 2));
        for (const fee of fees) {
          combos.push({ inv, liq, fee });
        }
      }
    }

    // Shuffle and take a manageable number
    const shuffled = combos.sort(() => Math.random() - 0.5).slice(0, 80);

    const initial: Branch[] = shuffled.map((combo, i) => ({
      id: `${combo.inv.split(" ")[0]}-${combo.liq.split(" ")[0]}-${combo.fee.split(" ")[0]}-${i}`,
      invariant: combo.inv,
      liquidity: combo.liq,
      fee: combo.fee,
      posteriorMean: 0.5,
      variance: 0.5,
      expectedImprovement: 0.5,
      novelty: 1.0,
      robustness: 0.5,
      tested: 0,
      candidates: [],
      scoreHistory: [],
      bestScore: Infinity,
      bestCandidate: null,
      lastExploredAt: 0,
    }));

    setBranches(initial);
  }, [branches.length]);

  // ─── Core: Run one Bayesian allocation step ────────────────────────────

  const runAllocationStep = useCallback(async () => {
    if (branches.length === 0) return;

    setIsRunning(true);

    // Thompson sampling + priority scoring to select branch
    const scored = branches.map(b => ({
      branch: b,
      draw: thompsonSample(b) + scoreBranch(b) * 0.3,
    }));
    scored.sort((a, b) => b.draw - a.draw);
    const selected = scored[0].branch;

    // Cycle through regimes
    const regimeIdx = totalAllocations % REGIMES.length;
    const regime = REGIMES[regimeIdx];

    // Generate and evaluate candidates for this branch
    const candidatesPerStep = explorationSpeed === "fast" ? 4 : explorationSpeed === "thorough" ? 12 : 6;
    const newCandidates: BranchCandidate[] = [];
    const realCandidates: Candidate[] = [];

    for (let i = 0; i < candidatesPerStep; i++) {
      let bins: Float64Array;

      if (selected.bestCandidate && selected.candidates.length > 0 && Math.random() > 0.3) {
        // Mutate from best known candidate in this branch
        // We need to regenerate bins since we don't store them in BranchCandidate
        const base = generateStructuredBins(selected.invariant, selected.liquidity);
        bins = mutateBins(base, 0.15 + Math.random() * 0.1);
      } else {
        // Fresh candidate from structural template
        bins = generateStructuredBins(selected.invariant, selected.liquidity);
      }

      const pathCount = explorationSpeed === "fast" ? 8 : explorationSpeed === "thorough" ? 20 : 12;
      const evalPathCount = explorationSpeed === "fast" ? 4 : explorationSpeed === "thorough" ? 10 : 6;
      const { metrics, stability } = evaluateCandidate(bins, regime, pathCount, evalPathCount);
      const features = computeFeatures(bins);
      const score = scoreCandidate(metrics, stability);

      const bc: BranchCandidate = {
        id: `ba-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        score,
        stability,
        fees: metrics.totalFees,
        utilization: metrics.liquidityUtilization,
        lpValue: metrics.lpValueVsHodl,
        slippage: metrics.totalSlippage,
        arbLeakage: metrics.arbLeakage,
        drawdown: metrics.maxDrawdown,
        regime: regime.id,
        generation: totalAllocations + 1,
      };
      newCandidates.push(bc);

      // Also create a full Candidate for the archive
      realCandidates.push({
        id: bc.id,
        bins,
        regime: regime.id,
        generation: totalAllocations + 1,
        metrics,
        features,
        stability,
        score,
        timestamp: Date.now(),
        source: "experiment",
        contributor: "bayesian-allocator",
        experimentId: `branch-${selected.id}`,
        objectiveType: "balanced",
      });
    }

    // Update branch posterior
    const avgScore = newCandidates.reduce((a, c) => a + c.score, 0) / newCandidates.length;
    const variance = newCandidates.reduce((a, c) => a + (c.score - avgScore) ** 2, 0) / newCandidates.length;
    const bestNew = newCandidates.reduce((best, c) => c.score < best.score ? c : best, newCandidates[0]);

    setBranches(prev => prev.map(b => {
      if (b.id !== selected.id) {
        // Decay unexplored branches' novelty slightly, increase uncertainty
        return {
          ...b,
          novelty: clamp(b.novelty * 0.998 + 0.001),
          variance: clamp(b.variance * 1.001, 0.01, 0.95),
        };
      }

      const improvement = b.bestScore === Infinity ? 0.5 : clamp(b.bestScore - bestNew.score, -0.1, 0.5);
      const allCandidates = [...b.candidates, ...newCandidates].slice(-50); // Keep last 50
      const newBestCandidate = bestNew.score < (b.bestCandidate?.score ?? Infinity) ? bestNew : b.bestCandidate;

      return {
        ...b,
        tested: b.tested + newCandidates.length,
        candidates: allCandidates,
        scoreHistory: [...b.scoreHistory, avgScore].slice(-30),
        bestScore: Math.min(b.bestScore, bestNew.score),
        bestCandidate: newBestCandidate,
        posteriorMean: clamp(b.posteriorMean * 0.7 + (1 - avgScore / 10) * 0.3, 0.05, 0.95),
        variance: clamp(b.variance * 0.6 + variance * 0.4, 0.01, 0.9),
        expectedImprovement: clamp(improvement * 0.5 + b.expectedImprovement * 0.5),
        novelty: clamp(b.novelty * 0.9 + (newCandidates.filter(c => c.score < (b.bestScore * 0.95)).length / newCandidates.length) * 0.1),
        robustness: clamp(b.robustness * 0.8 + (1 - Math.sqrt(variance)) * 0.2),
        lastExploredAt: Date.now(),
      };
    }));

    // Record exploration event
    const event: ExplorationEvent = {
      timestamp: Date.now(),
      branchId: selected.id,
      candidatesGenerated: newCandidates.length,
      bestScore: bestNew.score,
      improvement: selected.bestScore === Infinity ? 0 : selected.bestScore - bestNew.score,
      regime: regime.id,
    };
    setExplorationLog(prev => [event, ...prev].slice(0, 200));

    // Update convergence tracking
    setConvergenceData(prev => {
      const step = prev.length + 1;
      const allBest = branches.reduce((min, b) => Math.min(min, b.bestScore), Infinity);
      const testedBranches = branches.filter(b => b.tested > 0);
      const avg = testedBranches.length > 0
        ? testedBranches.reduce((a, b) => a + b.bestScore, 0) / testedBranches.length
        : 0;
      return [...prev, { step, best: Math.min(allBest, bestNew.score), avg, explored: testedBranches.length + 1 }].slice(-100);
    });

    setTotalAllocations(prev => prev + 1);

    // Ingest into the main engine archive
    onIngestCandidates(realCandidates, `Bayesian allocation step ${totalAllocations + 1}: explored ${selected.invariant} + ${selected.liquidity} (${regime.label})`);

    setIsRunning(false);
  }, [branches, totalAllocations, explorationSpeed, onIngestCandidates]);

  // ─── Auto-run loop ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!autoRun) return;

    let cancelled = false;
    const loop = async () => {
      if (cancelled || !autoRunRef.current) return;
      await runAllocationStep();
      if (!cancelled && autoRunRef.current) {
        const delay = explorationSpeed === "fast" ? 100 : explorationSpeed === "thorough" ? 500 : 250;
        setTimeout(loop, delay);
      }
    };
    loop();

    return () => { cancelled = true; };
  }, [autoRun, runAllocationStep, explorationSpeed]);

  // ─── Derived data ──────────────────────────────────────────────────────

  const rankedBranches = useMemo(() =>
    [...branches]
      .map(b => ({ ...b, priority: scoreBranch(b) }))
      .sort((a, b) => b.priority - a.priority),
    [branches]
  );

  const topBranches = useMemo(() => rankedBranches.slice(0, 12), [rankedBranches]);

  const bestOverall = useMemo(() => {
    const tested = branches.filter(b => b.bestCandidate !== null);
    if (tested.length === 0) return null;
    return tested.reduce((best, b) => {
      if (!best.bestCandidate) return b;
      if (!b.bestCandidate) return best;
      return b.bestCandidate.score < best.bestCandidate!.score ? b : best;
    });
  }, [branches]);

  const explorationStats = useMemo(() => {
    const explored = branches.filter(b => b.tested > 0).length;
    const totalCandidates = branches.reduce((a, b) => a + b.tested, 0);
    const coverageRatio = explored / Math.max(1, branches.length);
    return { explored, total: branches.length, totalCandidates, coverageRatio };
  }, [branches]);

  const coverageGrid = useMemo(() => {
    const map = new Map<string, { count: number; bestScore: number }>();
    for (const b of branches) {
      if (b.tested === 0) continue;
      const key = `${b.invariant}|${b.liquidity}`;
      const existing = map.get(key);
      if (!existing || b.bestScore < existing.bestScore) {
        map.set(key, { count: (existing?.count ?? 0) + b.tested, bestScore: b.bestScore });
      } else {
        map.set(key, { ...existing, count: existing.count + b.tested });
      }
    }

    const invFamilies = [...new Set(branches.map(b => b.invariant))].sort();
    const liqFamilies = [...new Set(branches.map(b => b.liquidity))].sort();

    return {
      invFamilies,
      liqFamilies,
      data: invFamilies.map(inv =>
        liqFamilies.map(liq => map.get(`${inv}|${liq}`) ?? { count: 0, bestScore: Infinity })
      ),
    };
  }, [branches]);

  const branchScatterData = useMemo(() =>
    branches
      .filter(b => b.tested > 0)
      .map(b => ({
        x: b.posteriorMean,
        y: Math.sqrt(b.variance),
        z: b.tested,
        name: `${b.invariant.split(" ")[0]}+${b.liquidity.split(" ")[0]}`,
        score: b.bestScore,
      })),
    [branches]
  );

  const recentEvents = explorationLog.slice(0, 8);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4">
      {/* Header + Controls */}
      <div className="surface-elevated rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              <Radar className="w-4 h-4" /> AMM Universe Observatory
            </p>
            <p className="text-xs text-muted-foreground">
              Bayesian branch allocation maps {branches.length} structural AMM combinations across {REGIMES.length} market regimes.
              {explorationStats.totalCandidates > 0 && (
                <span className="ml-1 font-mono">
                  {explorationStats.explored}/{explorationStats.total} explored | {explorationStats.totalCandidates} candidates evaluated
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Speed selector */}
            <div className="flex items-center gap-1 text-[10px]">
              {(["fast", "normal", "thorough"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setExplorationSpeed(s)}
                  className={`px-2 py-1 rounded border text-[10px] transition-all ${
                    explorationSpeed === s
                      ? "bg-foreground/10 border-foreground/20 text-foreground font-medium"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              onClick={runAllocationStep}
              disabled={isRunning || autoRun}
              className="gap-1"
            >
              <WandSparkles className="w-3.5 h-3.5" />
              Allocate next branch
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                for (let i = 0; i < 8; i++) {
                  await runAllocationStep();
                }
              }}
              disabled={isRunning || autoRun}
            >
              <Zap className="w-3.5 h-3.5 mr-1" />
              Sprint (8 steps)
            </Button>

            <Button
              size="sm"
              variant={autoRun ? "destructive" : "default"}
              onClick={() => setAutoRun(!autoRun)}
            >
              {autoRun ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
              {autoRun ? "Stop auto-explore" : "Auto-explore"}
            </Button>
          </div>
        </div>

        {/* Live stats bar */}
        {explorationStats.totalCandidates > 0 && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-[9px] text-muted-foreground">Allocations</p>
              <p className="text-sm font-bold font-mono">{totalAllocations}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-[9px] text-muted-foreground">Branches Explored</p>
              <p className="text-sm font-bold font-mono">{explorationStats.explored}/{explorationStats.total}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-[9px] text-muted-foreground">Total Candidates</p>
              <p className="text-sm font-bold font-mono">{explorationStats.totalCandidates}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-[9px] text-muted-foreground">Coverage</p>
              <p className="text-sm font-bold font-mono">{(explorationStats.coverageRatio * 100).toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-[9px] text-muted-foreground">Best Score</p>
              <p className="text-sm font-bold font-mono text-chart-1">
                {bestOverall?.bestCandidate ? bestOverall.bestCandidate.score.toFixed(3) : "---"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Best Discovered AMM + Convergence */}
      <div className="grid xl:grid-cols-3 gap-4">
        {/* Best AMM Card */}
        <div className="surface-elevated rounded-xl border border-border p-4 space-y-3">
          <p className="text-xs font-semibold flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-yellow-500" /> Best Discovered AMM
          </p>
          {bestOverall?.bestCandidate ? (
            <div className="space-y-2">
              <div className="rounded-lg bg-chart-1/5 border border-chart-1/20 p-3">
                <p className="text-[11px] font-semibold text-chart-1">
                  {bestOverall.invariant}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {bestOverall.liquidity} + {bestOverall.fee}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <StatCell label="Composite" value={bestOverall.bestCandidate.score.toFixed(3)} highlight />
                <StatCell label="LP/HODL" value={bestOverall.bestCandidate.lpValue.toFixed(3)} />
                <StatCell label="Fees" value={bestOverall.bestCandidate.fees.toFixed(1)} />
                <StatCell label="Utilization" value={`${(bestOverall.bestCandidate.utilization * 100).toFixed(1)}%`} />
                <StatCell label="Slippage" value={bestOverall.bestCandidate.slippage.toFixed(4)} />
                <StatCell label="Arb Leak" value={bestOverall.bestCandidate.arbLeakage.toFixed(2)} />
                <StatCell label="Drawdown" value={`${(bestOverall.bestCandidate.drawdown * 100).toFixed(1)}%`} />
                <StatCell label="Stability" value={bestOverall.bestCandidate.stability.toFixed(3)} />
              </div>
              <p className="text-[9px] text-muted-foreground">
                Branch tested {bestOverall.tested} times across {bestOverall.scoreHistory.length} allocations
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <WandSparkles className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-[11px] text-muted-foreground">
                Click "Allocate next branch" or "Auto-explore" to begin mapping the AMM universe.
              </p>
            </div>
          )}
        </div>

        {/* Convergence Chart */}
        <div className="surface-elevated rounded-xl border border-border p-4 xl:col-span-2">
          <p className="text-xs font-semibold flex items-center gap-1 mb-2">
            <TrendingUp className="w-3.5 h-3.5" /> Convergence + Coverage Over Time
          </p>
          {convergenceData.length > 1 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={convergenceData}>
                  <XAxis dataKey="step" tick={{ fontSize: 8, fill: colors.tick }} />
                  <YAxis tick={{ fontSize: 8, fill: colors.tick }} />
                  <Tooltip
                    contentStyle={{
                      background: colors.tooltipBg,
                      border: `1px solid ${colors.tooltipBorder}`,
                      borderRadius: 8,
                      fontSize: 9,
                      color: colors.tooltipText,
                    }}
                  />
                  <Line type="monotone" dataKey="best" stroke="hsl(142, 72%, 45%)" strokeWidth={2} dot={false} name="Best Score" />
                  <Line type="monotone" dataKey="avg" stroke="hsl(38, 92%, 50%)" strokeWidth={1.5} dot={false} name="Avg Explored" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="explored" stroke="hsl(220, 70%, 55%)" strokeWidth={1} dot={false} name="Branches Explored" yAxisId="right" hide />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-[10px] text-muted-foreground">Run at least 2 allocations to see convergence...</p>
            </div>
          )}
        </div>
      </div>

      {/* Branch Priority Engine + Exploration Map */}
      <div className="grid xl:grid-cols-2 gap-4">
        {/* Top Branches by Priority */}
        <div className="surface-elevated rounded-xl border border-border p-4">
          <p className="text-xs font-semibold flex items-center gap-1 mb-3">
            <Network className="w-3.5 h-3.5" /> Branch Priority Engine (Thompson Sampling)
          </p>
          <div className="space-y-1.5">
            {topBranches.map((branch, idx) => {
              const isExpanded = expandedBranch === branch.id;
              const isRecent = Date.now() - branch.lastExploredAt < 3000;

              return (
                <motion.div
                  key={branch.id}
                  initial={{ opacity: 0.5 }}
                  animate={{
                    opacity: 1,
                    backgroundColor: isRecent ? "hsl(var(--chart-1) / 0.05)" : "transparent",
                  }}
                  className="rounded-lg border border-border overflow-hidden"
                >
                  <button
                    className="w-full p-2 text-left flex items-center justify-between hover:bg-accent/50 transition-colors"
                    onClick={() => setExpandedBranch(isExpanded ? null : branch.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">
                        #{idx + 1}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold truncate">
                          {branch.invariant.split(" ")[0]} + {branch.liquidity.split("(")[0].trim()}
                        </p>
                        <p className="text-[9px] text-muted-foreground truncate">{branch.fee}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[9px] font-mono">n={branch.tested}</span>
                      <div className="w-16">
                        <div className="h-1.5 rounded bg-secondary">
                          <div
                            className="h-full rounded bg-chart-2 transition-all"
                            style={{ width: `${Math.min(100, branch.priority * 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[9px] font-mono w-10 text-right">
                        {branch.priority.toFixed(2)}
                      </span>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border"
                      >
                        <div className="p-3 space-y-2">
                          <div className="grid grid-cols-5 gap-1.5 text-[9px]">
                            <StatCell label="Posterior" value={branch.posteriorMean.toFixed(3)} />
                            <StatCell label="Variance" value={branch.variance.toFixed(3)} />
                            <StatCell label="E[I]" value={branch.expectedImprovement.toFixed(3)} />
                            <StatCell label="Novelty" value={branch.novelty.toFixed(3)} />
                            <StatCell label="Robust" value={branch.robustness.toFixed(3)} />
                          </div>
                          {branch.bestCandidate && (
                            <div className="rounded bg-chart-1/5 border border-chart-1/15 p-2 text-[9px]">
                              <p className="font-semibold text-chart-1">Best: score {branch.bestCandidate.score.toFixed(3)}</p>
                              <p className="text-muted-foreground">
                                LP/HODL {branch.bestCandidate.lpValue.toFixed(3)} |
                                Fees {branch.bestCandidate.fees.toFixed(1)} |
                                Util {(branch.bestCandidate.utilization * 100).toFixed(0)}%
                              </p>
                            </div>
                          )}
                          {branch.scoreHistory.length > 1 && (
                            <div className="h-16">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={branch.scoreHistory.map((s, i) => ({ step: i, score: s }))}>
                                  <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke="hsl(var(--chart-2))"
                                    strokeWidth={1.5}
                                    dot={false}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Exploration Scatter: Mean vs Uncertainty */}
        <div className="surface-elevated rounded-xl border border-border p-4">
          <p className="text-xs font-semibold flex items-center gap-1 mb-2">
            <GitBranch className="w-3.5 h-3.5" /> Exploration Map (Mean vs Uncertainty)
          </p>
          <p className="text-[9px] text-muted-foreground mb-2">
            Each point is an explored branch. Size = samples. Higher uncertainty = more potential.
          </p>
          {branchScatterData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Posterior Mean"
                    tick={{ fontSize: 8, fill: colors.tick }}
                    label={{ value: "Posterior Mean", position: "bottom", fontSize: 9, fill: colors.tick }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Uncertainty"
                    tick={{ fontSize: 8, fill: colors.tick }}
                    label={{ value: "Uncertainty (sqrt var)", angle: -90, position: "left", fontSize: 9, fill: colors.tick }}
                  />
                  <ZAxis type="number" dataKey="z" range={[20, 200]} />
                  <Tooltip
                    contentStyle={{
                      background: colors.tooltipBg,
                      border: `1px solid ${colors.tooltipBorder}`,
                      borderRadius: 8,
                      fontSize: 9,
                      color: colors.tooltipText,
                    }}
                    formatter={(value: number, name: string) => [
                      name === "x" ? value.toFixed(3) : name === "y" ? value.toFixed(3) : value,
                      name === "x" ? "Mean" : name === "y" ? "Uncertainty" : "Samples",
                    ]}
                  />
                  <Scatter data={branchScatterData} fill="hsl(var(--chart-2))" fillOpacity={0.6} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <p className="text-[10px] text-muted-foreground">No branches explored yet...</p>
            </div>
          )}
        </div>
      </div>

      {/* Coverage Heatmap */}
      <div className="surface-elevated rounded-xl border border-border p-4">
        <p className="text-xs font-semibold flex items-center gap-1 mb-3">
          <Layers className="w-3.5 h-3.5" /> Coverage Heatmap (Invariant x Liquidity)
        </p>
        <div className="overflow-x-auto">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `140px repeat(${coverageGrid.liqFamilies.length}, minmax(80px, 1fr))`,
            }}
          >
            <div />
            {coverageGrid.liqFamilies.map(liq => (
              <div key={liq} className="text-[9px] text-muted-foreground p-1 text-center truncate">
                {liq.split(" ")[0]}
              </div>
            ))}
            {coverageGrid.invFamilies.map((inv, row) => (
              <div key={inv} className="contents">
                <div className="text-[9px] text-muted-foreground p-1 truncate">{inv.split(" ").slice(0, 2).join(" ")}</div>
                {coverageGrid.liqFamilies.map((liq, col) => {
                  const cell = coverageGrid.data[row][col];
                  const maxCount = Math.max(1, ...coverageGrid.data.flat().map(c => c.count));
                  const intensity = cell.count / maxCount;
                  const hasData = cell.count > 0;
                  return (
                    <div
                      key={`${inv}-${liq}`}
                      className={`m-0.5 rounded border h-9 flex items-center justify-center transition-all ${
                        hasData ? "border-chart-2/30" : "border-border"
                      }`}
                      style={{
                        backgroundColor: hasData
                          ? `hsl(var(--chart-2) / ${0.1 + intensity * 0.5})`
                          : "transparent",
                      }}
                      title={`${inv} x ${liq}: ${cell.count} candidates, best: ${cell.bestScore === Infinity ? "N/A" : cell.bestScore.toFixed(3)}`}
                    >
                      {hasData && (
                        <span className="text-[8px] font-mono text-foreground/80">{cell.count}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground mt-2">
          Empty cells are under-explored structural regions with high discovery potential. The allocator prioritizes these.
        </p>
      </div>

      {/* Live Activity Feed */}
      <div className="grid xl:grid-cols-2 gap-4">
        <div className="surface-elevated rounded-xl border border-border p-4">
          <p className="text-xs font-semibold flex items-center gap-1 mb-3">
            <Activity className="w-3.5 h-3.5" /> Exploration Activity
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {recentEvents.length > 0 ? recentEvents.map((event, i) => (
              <motion.div
                key={`${event.timestamp}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 rounded border border-border p-2 text-[10px]"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      event.regime === "low-vol"
                        ? "hsl(142, 72%, 45%)"
                        : event.regime === "high-vol"
                        ? "hsl(38, 92%, 50%)"
                        : "hsl(0, 72%, 55%)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{event.branchId.split("-").slice(0, 3).join(" + ")}</p>
                  <p className="text-muted-foreground">
                    {event.candidatesGenerated} candidates | best: {event.bestScore.toFixed(3)}
                    {event.improvement > 0 && (
                      <span className="text-chart-1 ml-1">+{event.improvement.toFixed(3)}</span>
                    )}
                  </p>
                </div>
                <span className="text-[9px] text-muted-foreground shrink-0">
                  {event.regime}
                </span>
              </motion.div>
            )) : (
              <p className="text-[10px] text-muted-foreground text-center py-4">No exploration events yet.</p>
            )}
          </div>
        </div>

        {/* Performance by Structural Family */}
        <div className="surface-elevated rounded-xl border border-border p-4">
          <p className="text-xs font-semibold flex items-center gap-1 mb-3">
            <Eye className="w-3.5 h-3.5" /> Performance by Invariant Family
          </p>
          {(() => {
            const familyPerf = new Map<string, { total: number; bestScore: number; avgScore: number; count: number }>();
            for (const b of branches) {
              if (b.tested === 0) continue;
              const key = b.invariant;
              const existing = familyPerf.get(key) ?? { total: 0, bestScore: Infinity, avgScore: 0, count: 0 };
              familyPerf.set(key, {
                total: existing.total + b.tested,
                bestScore: Math.min(existing.bestScore, b.bestScore),
                avgScore: (existing.avgScore * existing.count + b.posteriorMean * b.tested) / (existing.count + b.tested),
                count: existing.count + b.tested,
              });
            }

            const data = [...familyPerf.entries()]
              .map(([name, perf]) => ({
                name: name.split(" ").slice(0, 2).join(" "),
                best: perf.bestScore === Infinity ? 0 : -perf.bestScore,
                samples: perf.total,
              }))
              .sort((a, b) => b.best - a.best);

            if (data.length === 0) {
              return (
                <div className="h-48 flex items-center justify-center">
                  <p className="text-[10px] text-muted-foreground">Run allocations to see family performance...</p>
                </div>
              );
            }

            return (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 8, fill: colors.tick }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: colors.tick }} width={80} />
                    <Tooltip
                      contentStyle={{
                        background: colors.tooltipBg,
                        border: `1px solid ${colors.tooltipBorder}`,
                        borderRadius: 8,
                        fontSize: 9,
                        color: colors.tooltipText,
                      }}
                    />
                    <Bar dataKey="best" name="Best Score (negated)" radius={[0, 4, 4, 0]}>
                      {data.map((_, i) => (
                        <Cell key={i} fill={`hsl(${142 + i * 30}, 60%, 50%)`} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      </div>
    </section>
  );
}

// ─── Shared tiny component ──────────────────────────────────────────────────

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded border px-2 py-1 ${highlight ? "border-chart-1/30 bg-chart-1/5" : "border-border"}`}>
      <p className="text-[8px] text-muted-foreground">{label}</p>
      <p className={`text-[10px] font-mono font-semibold ${highlight ? "text-chart-1" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
