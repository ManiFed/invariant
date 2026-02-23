import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Layers, Sparkles, Radar, Orbit, Beaker, Network, Target, Trophy, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const ORACLE_INTERACTIONS = ["None", "Passive reference", "Active control loop", "Latency-sensitive", "Cross-pool reference"] as const;
const REBALANCING_DYNAMICS = ["Static", "Passive", "Periodic reparameterization", "RL controlled", "Adversarial-aware"] as const;
const MICROSTRUCTURE_ASSUMPTIONS = ["GBM", "Jump diffusion", "Mean-reverting", "Regime switching", "Adversarial searchers", "Latency heterogeneity"] as const;

const MARKET_REGIME_CONTROLS = [
  { label: "Volatility", key: "volatility", min: 0.15, max: 1.3, step: 0.01 },
  { label: "Jump intensity", key: "jumpIntensity", min: 0, max: 9, step: 0.1 },
  { label: "Mean reversion", key: "meanReversion", min: 0, max: 3, step: 0.05 },
  { label: "Arbitrage latency", key: "arbLatency", min: 0.1, max: 1, step: 0.01 },
  { label: "Order flow toxicity", key: "toxicity", min: 0, max: 1, step: 0.01 },
  { label: "MEV searcher density", key: "searcherDensity", min: 0, max: 1, step: 0.01 },
  { label: "Gas variability", key: "gasVariability", min: 0, max: 1, step: 0.01 },
  { label: "Correlated shock probability", key: "correlatedShock", min: 0, max: 1, step: 0.01 },
  { label: "Liquidity migration", key: "liquidityMigration", min: 0, max: 1, step: 0.01 },
] as const;

type BranchStat = {
  id: string;
  expectedImprovement: number;
  uncertainty: number;
  novelty: number;
  robustness: number;
  posteriorMean: number;
  variance: number;
  tested: number;
};

type UniversePoint = {
  id: string;
  branchId: string;
  invariant: string;
  liquidity: string;
  fee: string;
  score: number;
  stability: number;
  leakage: number;
};

type MarketRegimeState = Record<(typeof MARKET_REGIME_CONTROLS)[number]["key"], number>;

const defaultMarketRegime: MarketRegimeState = {
  volatility: 0.45,
  jumpIntensity: 1.2,
  meanReversion: 0.7,
  arbLatency: 0.75,
  toxicity: 0.35,
  searcherDensity: 0.4,
  gasVariability: 0.3,
  correlatedShock: 0.25,
  liquidityMigration: 0.2,
};

const defaultBranches: BranchStat[] = [
  { id: "Hybrid + adaptive + vol fee", expectedImprovement: 0.64, uncertainty: 0.52, novelty: 0.44, robustness: 0.58, posteriorMean: 0.51, variance: 0.33, tested: 39 },
  { id: "Piecewise + ticks + imbalance fee", expectedImprovement: 0.52, uncertainty: 0.66, novelty: 0.72, robustness: 0.55, posteriorMean: 0.47, variance: 0.42, tested: 21 },
  { id: "Oracle anchored + active control", expectedImprovement: 0.59, uncertainty: 0.73, novelty: 0.61, robustness: 0.63, posteriorMean: 0.49, variance: 0.46, tested: 16 },
  { id: "Dynamic invariant + MEV adaptive", expectedImprovement: 0.57, uncertainty: 0.68, novelty: 0.69, robustness: 0.51, posteriorMean: 0.46, variance: 0.43, tested: 18 },
];

const scoreBranch = (branch: BranchStat) => (branch.expectedImprovement * 0.4) + (branch.uncertainty * 0.25) + (branch.novelty * 0.2) + (branch.robustness * 0.15);
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const pick = <T,>(values: readonly T[]) => values[Math.floor(Math.random() * values.length)];

export default function GeometryObservatory() {
  const [marketRegime, setMarketRegime] = useState<MarketRegimeState>(defaultMarketRegime);
  const [invariant, setInvariant] = useState<(typeof INVARIANT_FAMILIES)[number]>("Hybrid stableswap");
  const [liquidityGeometry, setLiquidityGeometry] = useState<(typeof LIQUIDITY_FAMILIES)[number]>("Adaptive");
  const [feeStructure, setFeeStructure] = useState<(typeof FEE_STRUCTURES)[number]>("Volatility dependent");
  const [oracleInteraction, setOracleInteraction] = useState<(typeof ORACLE_INTERACTIONS)[number]>("Active control loop");
  const [rebalancing, setRebalancing] = useState<(typeof REBALANCING_DYNAMICS)[number]>("RL controlled");
  const [microstructure, setMicrostructure] = useState<(typeof MICROSTRUCTURE_ASSUMPTIONS)[number]>("Regime switching");
  const [invariantExpr, setInvariantExpr] = useState("F(reserves, state, time, oracle_inputs) = k");
  const [liquidityExpr, setLiquidityExpr] = useState("rho(price) = exp(-alpha * |price-mid|) + beta");
  const [feeExpr, setFeeExpr] = useState("fee = base + a*vol + b*jump + c*inventory_imbalance");
  const [controlExpr, setControlExpr] = useState("policy_t = argmax(reward_t - lambda * instability)");
  const [branches, setBranches] = useState(defaultBranches);
  const [universe, setUniverse] = useState<UniversePoint[]>([]);
  const [lastAllocatedBranch, setLastAllocatedBranch] = useState<string | null>(null);

  const familiesCovered = useMemo(() => {
    const knownUniverse = INVARIANT_FAMILIES.length + LIQUIDITY_FAMILIES.length + FEE_STRUCTURES.length + ORACLE_INTERACTIONS.length + REBALANCING_DYNAMICS.length + MICROSTRUCTURE_ASSUMPTIONS.length;
    const distinctFound = new Set(universe.flatMap((point) => [point.invariant, point.liquidity, point.fee])).size;
    return {
      distinctFound,
      knownUniverse,
      ratio: distinctFound / knownUniverse,
    };
  }, [universe]);

  const behavioralCoverage = useMemo(() => {
    const slippageClass = marketRegime.volatility > 0.8 ? "Convex high-impact" : marketRegime.volatility > 0.45 ? "Moderate" : "Near-linear";
    const collapseRisk = (marketRegime.toxicity + marketRegime.correlatedShock + marketRegime.liquidityMigration) / 3;
    return {
      slippageClass,
      tailLoss: Math.min(0.95, marketRegime.jumpIntensity / 10 + marketRegime.correlatedShock * 0.4),
      collapseRisk,
      stabilityClass: collapseRisk > 0.55 ? "Fragile" : collapseRisk > 0.35 ? "Contingent" : "Stable",
    };
  }, [marketRegime]);

  const frontierVector = useMemo(() => {
    const utilization = 1 - Math.max(0.1, marketRegime.arbLatency * 0.6 + marketRegime.gasVariability * 0.3);
    const leakage = marketRegime.searcherDensity * 0.6 + marketRegime.toxicity * 0.3;
    return {
      fees: (0.4 + marketRegime.volatility * 0.2 + marketRegime.jumpIntensity * 0.03).toFixed(3),
      utilization: utilization.toFixed(3),
      drawdown: (behavioralCoverage.tailLoss * 0.7).toFixed(3),
      leakage: leakage.toFixed(3),
      stability: (1 - behavioralCoverage.collapseRisk * 0.8).toFixed(3),
      uncertainty: ((marketRegime.searcherDensity + marketRegime.correlatedShock + marketRegime.gasVariability) / 3).toFixed(3),
    };
  }, [behavioralCoverage, marketRegime]);

  const rankedBranches = useMemo(() => [...branches].map((branch) => ({ ...branch, score: scoreBranch(branch) })).sort((a, b) => b.score - a.score), [branches]);

  const bestDesign = useMemo(() => {
    if (universe.length === 0) return null;
    return [...universe].sort((a, b) => b.score - a.score)[0];
  }, [universe]);

  const coverageGrid = useMemo(() => {
    const map = new Map<string, number>();
    universe.forEach((point) => {
      const key = `${point.invariant}|${point.liquidity}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return INVARIANT_FAMILIES.map((inv) => LIQUIDITY_FAMILIES.map((liq) => map.get(`${inv}|${liq}`) ?? 0));
  }, [universe]);

  const thompsonSample = (branch: BranchStat) => {
    const noise = (Math.random() - 0.5) * Math.sqrt(branch.variance) * 1.6;
    return branch.posteriorMean + noise;
  };

  const synthesizePoint = (branchId: string): UniversePoint => {
    const inv = pick(INVARIANT_FAMILIES);
    const liq = pick(LIQUIDITY_FAMILIES);
    const fee = pick(FEE_STRUCTURES);
    const marketPenalty = marketRegime.toxicity * 0.14 + marketRegime.searcherDensity * 0.1 + marketRegime.arbLatency * 0.08;
    const edge = inv.includes("Dynamic") || fee.includes("adaptive") ? 0.07 : 0.03;
    const stability = clamp(0.68 + (Math.random() - 0.5) * 0.25 - marketRegime.correlatedShock * 0.15 + marketRegime.meanReversion * 0.05);
    const leakage = clamp(0.2 + marketRegime.searcherDensity * 0.28 + (Math.random() - 0.5) * 0.1);
    const score = clamp(0.55 + edge + stability * 0.34 - leakage * 0.2 - marketPenalty + (Math.random() - 0.5) * 0.12);

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      branchId,
      invariant: inv,
      liquidity: liq,
      fee,
      score,
      stability,
      leakage,
    };
  };

  const runAutoBranchSelection = () => {
    const selected = [...branches]
      .map((branch) => ({ branch, draw: thompsonSample(branch) + scoreBranch(branch) * 0.25 }))
      .sort((a, b) => b.draw - a.draw)[0]?.branch;

    if (!selected) return;
    setLastAllocatedBranch(selected.id);

    const newPoints = Array.from({ length: 6 }, () => synthesizePoint(selected.id));
    const avgScore = newPoints.reduce((acc, point) => acc + point.score, 0) / newPoints.length;
    const variance = newPoints.reduce((acc, point) => acc + (point.score - avgScore) ** 2, 0) / newPoints.length;

    setUniverse((prev) => [...newPoints, ...prev].slice(0, 220));
    setBranches((prev) => prev.map((branch) => {
      if (branch.id !== selected.id) {
        return { ...branch, uncertainty: clamp(branch.uncertainty * 0.995 + 0.003) };
      }
      const improvement = clamp(avgScore - branch.posteriorMean, -0.08, 0.18);
      return {
        ...branch,
        tested: branch.tested + newPoints.length,
        posteriorMean: clamp(branch.posteriorMean + improvement * 0.35),
        variance: clamp(branch.variance * 0.82 + variance * 0.6, 0.05, 0.8),
        expectedImprovement: clamp(branch.expectedImprovement * 0.8 + Math.max(0, improvement) * 0.6 + Math.sqrt(variance) * 0.1),
        uncertainty: clamp(Math.sqrt(variance) + branch.uncertainty * 0.25),
        novelty: clamp(branch.novelty * 0.985 + (Math.random() * 0.04)),
        robustness: clamp(branch.robustness * 0.9 + newPoints.reduce((acc, p) => acc + p.stability, 0) / newPoints.length * 0.1),
      };
    }));
  };

  const runExplorationSprint = () => {
    Array.from({ length: 8 }).forEach(() => runAutoBranchSelection());
  };

  const hypergraphFamilies = [
    `Invariant family: ${invariant}`,
    `Liquidity geometry family: ${liquidityGeometry}`,
    `Adaptivity family: ${rebalancing}`,
    `Information sensitivity: ${oracleInteraction}`,
    `Control complexity class: ${rebalancing}`,
    `Microstructure class: ${microstructure}`,
  ];

  return (
    <section className="space-y-4">
      <div className="surface-elevated rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2"><Radar className="w-4 h-4" /> AMM Universe Observatory</p>
            <p className="text-xs text-muted-foreground">Bayesian branch allocation now actively maps the AMM manifold and updates the best discovered design.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={runAutoBranchSelection} className="gap-1"><WandSparkles className="w-3.5 h-3.5" /> Allocate next generation</Button>
            <Button size="sm" variant="outline" onClick={runExplorationSprint}>Run exploration sprint</Button>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <div className="surface-elevated rounded-xl border border-border p-4 xl:col-span-2 space-y-3">
          <p className="text-xs font-semibold flex items-center gap-1"><Orbit className="w-3.5 h-3.5" /> Structural coordinates + regime controls</p>
          <div className="grid md:grid-cols-2 gap-3">
            {[{ label: "Invariant", value: invariant, set: setInvariant, options: INVARIANT_FAMILIES }, { label: "Liquidity", value: liquidityGeometry, set: setLiquidityGeometry, options: LIQUIDITY_FAMILIES }, { label: "Fee", value: feeStructure, set: setFeeStructure, options: FEE_STRUCTURES }, { label: "Oracle", value: oracleInteraction, set: setOracleInteraction, options: ORACLE_INTERACTIONS }, { label: "Rebalancing", value: rebalancing, set: setRebalancing, options: REBALANCING_DYNAMICS }, { label: "Microstructure", value: microstructure, set: setMicrostructure, options: MICROSTRUCTURE_ASSUMPTIONS }].map((field) => (
              <label key={field.label} className="block">
                <p className="text-[11px] text-muted-foreground mb-1">{field.label}</p>
                <select className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={field.value} onChange={(event) => field.set(event.target.value as never)}>
                  {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {MARKET_REGIME_CONTROLS.map((control) => (
              <label key={control.key} className="block">
                <div className="flex justify-between text-[11px] mb-1"><span>{control.label}</span><span className="font-mono">{marketRegime[control.key].toFixed(2)}</span></div>
                <input type="range" min={control.min} max={control.max} step={control.step} value={marketRegime[control.key]} onChange={(event) => setMarketRegime((prev) => ({ ...prev, [control.key]: Number(event.target.value) }))} className="w-full" />
              </label>
            ))}
          </div>
        </div>

        <div className="surface-elevated rounded-xl border border-border p-4 space-y-2">
          <p className="text-xs font-semibold flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Best discovered AMM</p>
          {bestDesign ? (
            <>
              <p className="text-[11px]">{bestDesign.branchId}</p>
              <p className="text-[11px] text-muted-foreground">{bestDesign.invariant} · {bestDesign.liquidity} · {bestDesign.fee}</p>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span>Composite score</span><span className="font-mono">{bestDesign.score.toFixed(3)}</span></div>
                <div className="flex justify-between"><span>Stability</span><span className="font-mono">{bestDesign.stability.toFixed(3)}</span></div>
                <div className="flex justify-between"><span>Leakage</span><span className="font-mono">{bestDesign.leakage.toFixed(3)}</span></div>
                <div className="flex justify-between"><span>Universe mapped</span><span className="font-mono">{universe.length}</span></div>
              </div>
            </>
          ) : <p className="text-[11px] text-muted-foreground">Run branch allocation to start mapping the design universe.</p>}
          {lastAllocatedBranch && <p className="text-[11px] text-chart-3">Last allocated: {lastAllocatedBranch}</p>}
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <div className="surface-elevated rounded-xl border border-border p-4">
          <p className="text-xs font-semibold flex items-center gap-1 mb-2"><Network className="w-3.5 h-3.5" /> Branch priority engine (live)</p>
          <div className="space-y-2">
            {rankedBranches.map((branch) => (
              <motion.div key={branch.id} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} className="rounded-lg border border-border p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold">{branch.id}</p>
                  <span className="text-[10px] font-mono">priority {branch.score.toFixed(3)}</span>
                </div>
                <div className="h-1.5 rounded bg-secondary mt-1">
                  <div className="h-full rounded bg-chart-2" style={{ width: `${Math.min(100, branch.score * 100)}%` }} />
                </div>
                <div className="grid grid-cols-5 gap-2 text-[10px] text-muted-foreground mt-1">
                  <span>μ {branch.posteriorMean.toFixed(2)}</span>
                  <span>σ² {branch.variance.toFixed(2)}</span>
                  <span>EΔ {branch.expectedImprovement.toFixed(2)}</span>
                  <span>N {branch.novelty.toFixed(2)}</span>
                  <span>n {branch.tested}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="surface-elevated rounded-xl border border-border p-4">
          <p className="text-xs font-semibold flex items-center gap-1 mb-2"><Layers className="w-3.5 h-3.5" /> Coverage heatmap (Invariant × Liquidity)</p>
          <div className="overflow-auto">
            <div className="grid" style={{ gridTemplateColumns: `120px repeat(${LIQUIDITY_FAMILIES.length}, minmax(78px, 1fr))` }}>
              <div />
              {LIQUIDITY_FAMILIES.map((liq) => <div key={liq} className="text-[10px] text-muted-foreground p-1 text-center">{liq.split(" ")[0]}</div>)}
              {INVARIANT_FAMILIES.map((inv, row) => (
                <div key={inv} className="contents">
                  <div key={`${inv}-label`} className="text-[10px] text-muted-foreground p-1">{inv.split(" ")[0]}</div>
                  {LIQUIDITY_FAMILIES.map((liq, col) => {
                    const count = coverageGrid[row][col];
                    const alpha = Math.min(0.9, count / 8);
                    return <div key={`${inv}-${liq}`} className="m-0.5 rounded border border-border h-7" style={{ backgroundColor: `hsl(var(--chart-3) / ${alpha})` }} title={`${inv} × ${liq}: ${count}`} />;
                  })}
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Dark cells represent under-sampled structural quadrants where uncertainty remains high.</p>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <div className="surface-elevated rounded-xl border border-border p-4">
          <p className="text-xs font-semibold flex items-center gap-1 mb-2"><Sparkles className="w-3.5 h-3.5" /> Behavioral + frontier coverage</p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-border p-2"><p className="text-muted-foreground">Structural coverage</p><p className="font-mono">{(familiesCovered.ratio * 100).toFixed(1)}%</p></div>
            <div className="rounded border border-border p-2"><p className="text-muted-foreground">Dark region score</p><p className="font-mono">{frontierVector.uncertainty}</p></div>
            <div className="rounded border border-border p-2"><p className="text-muted-foreground">Slippage profile</p><p className="font-mono">{behavioralCoverage.slippageClass}</p></div>
            <div className="rounded border border-border p-2"><p className="text-muted-foreground">Stability class</p><p className="font-mono">{behavioralCoverage.stabilityClass}</p></div>
            <div className="rounded border border-border p-2"><p className="text-muted-foreground">Tail loss</p><p className="font-mono">{behavioralCoverage.tailLoss.toFixed(3)}</p></div>
            <div className="rounded border border-border p-2"><p className="text-muted-foreground">Collapse risk</p><p className="font-mono">{behavioralCoverage.collapseRisk.toFixed(3)}</p></div>
          </div>
          <div className="mt-3 text-[11px] space-y-1">
            <div className="flex justify-between"><span>Fees</span><span className="font-mono">{frontierVector.fees}</span></div>
            <div className="flex justify-between"><span>Utilization</span><span className="font-mono">{frontierVector.utilization}</span></div>
            <div className="flex justify-between"><span>LP drawdown</span><span className="font-mono">{frontierVector.drawdown}</span></div>
            <div className="flex justify-between"><span>Arb leakage</span><span className="font-mono">{frontierVector.leakage}</span></div>
            <div className="flex justify-between"><span>Stability</span><span className="font-mono">{frontierVector.stability}</span></div>
          </div>
        </div>

        <div className="surface-elevated rounded-xl border border-border p-4 space-y-3">
          <p className="text-xs font-semibold flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Structural editor (live symbolic definitions)</p>
          <div className="space-y-2">
            {hypergraphFamilies.map((family) => <p key={family} className="rounded border border-border px-2 py-1 text-[11px]">{family}</p>)}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block"><p className="text-[11px] text-muted-foreground mb-1">Invariant expression</p><textarea value={invariantExpr} onChange={(event) => setInvariantExpr(event.target.value)} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs min-h-20" /></label>
            <label className="block"><p className="text-[11px] text-muted-foreground mb-1">Liquidity density function</p><textarea value={liquidityExpr} onChange={(event) => setLiquidityExpr(event.target.value)} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs min-h-20" /></label>
            <label className="block"><p className="text-[11px] text-muted-foreground mb-1">Fee function</p><textarea value={feeExpr} onChange={(event) => setFeeExpr(event.target.value)} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs min-h-20" /></label>
            <label className="block"><p className="text-[11px] text-muted-foreground mb-1">Control policy definition</p><textarea value={controlExpr} onChange={(event) => setControlExpr(event.target.value)} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs min-h-20" /></label>
          </div>
        </div>
      </div>
    </section>
  );
}
