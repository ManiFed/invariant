import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Layers, Sparkles, Radar, Orbit, Beaker, Network, Target } from "lucide-react";
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
];

const scoreBranch = (branch: BranchStat) => (branch.expectedImprovement * 0.4) + (branch.uncertainty * 0.25) + (branch.novelty * 0.2) + (branch.robustness * 0.15);

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

  const familiesCovered = useMemo(() => {
    const activeFamilies = [invariant, liquidityGeometry, feeStructure, oracleInteraction, rebalancing, microstructure];
    const knownUniverse = INVARIANT_FAMILIES.length + LIQUIDITY_FAMILIES.length + FEE_STRUCTURES.length + ORACLE_INTERACTIONS.length + REBALANCING_DYNAMICS.length + MICROSTRUCTURE_ASSUMPTIONS.length;
    return {
      active: activeFamilies.length,
      knownUniverse,
      ratio: activeFamilies.length / knownUniverse,
    };
  }, [feeStructure, invariant, liquidityGeometry, microstructure, oracleInteraction, rebalancing]);

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

  const rankedBranches = useMemo(() => [...branches]
    .map((branch) => ({ ...branch, score: scoreBranch(branch) }))
    .sort((a, b) => b.score - a.score), [branches]);

  const runAutoBranchSelection = () => {
    setBranches((prev) => prev.map((branch) => {
      const score = scoreBranch(branch);
      const uncertaintyBoost = 0.08 * branch.uncertainty;
      const noveltyBoost = 0.05 * branch.novelty;
      return {
        ...branch,
        tested: branch.tested + 1,
        posteriorMean: Math.min(1, branch.posteriorMean + 0.02 * score),
        variance: Math.max(0.08, branch.variance * 0.97 + uncertaintyBoost * 0.03),
        expectedImprovement: Math.min(1, branch.expectedImprovement * 0.96 + uncertaintyBoost + noveltyBoost),
      };
    }));
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2"><Radar className="w-4 h-4" /> AMM Universe Observatory</p>
            <p className="text-xs text-muted-foreground">Map AMMs as coordinates in structural space, evaluate over dynamic market regime trajectories, and prioritize unexplored branches.</p>
          </div>
          <Button size="sm" onClick={runAutoBranchSelection}>Run Bayesian branch allocation</Button>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <div className="surface-elevated rounded-xl border border-border p-4 space-y-3">
          <p className="text-xs font-semibold flex items-center gap-1"><Orbit className="w-3.5 h-3.5" /> Structural coordinates (internal physics)</p>
          {[{ label: "Invariant structure", value: invariant, set: setInvariant, options: INVARIANT_FAMILIES }, { label: "Liquidity distribution", value: liquidityGeometry, set: setLiquidityGeometry, options: LIQUIDITY_FAMILIES }, { label: "Fee structure", value: feeStructure, set: setFeeStructure, options: FEE_STRUCTURES }, { label: "Oracle interaction", value: oracleInteraction, set: setOracleInteraction, options: ORACLE_INTERACTIONS }, { label: "Rebalancing dynamics", value: rebalancing, set: setRebalancing, options: REBALANCING_DYNAMICS }, { label: "Microstructure assumption", value: microstructure, set: setMicrostructure, options: MICROSTRUCTURE_ASSUMPTIONS }].map((field) => (
            <label key={field.label} className="block">
              <p className="text-[11px] text-muted-foreground mb-1">{field.label}</p>
              <select className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs" value={field.value} onChange={(event) => field.set(event.target.value as never)}>
                {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ))}
        </div>

        <div className="surface-elevated rounded-xl border border-border p-4 space-y-3">
          <p className="text-xs font-semibold flex items-center gap-1"><Beaker className="w-3.5 h-3.5" /> Market regime space (external physics)</p>
          <div className="grid md:grid-cols-2 gap-3">
            {MARKET_REGIME_CONTROLS.map((control) => (
              <label key={control.key} className="block">
                <div className="flex justify-between text-[11px] mb-1">
                  <span>{control.label}</span>
                  <span className="font-mono text-muted-foreground">{marketRegime[control.key].toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={marketRegime[control.key]}
                  onChange={(event) => setMarketRegime((prev) => ({ ...prev, [control.key]: Number(event.target.value) }))}
                  className="w-full"
                />
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Supports regime trajectories, mixtures, and transition matrices by continuously reweighting this vector through time.</p>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <div className="surface-elevated rounded-xl border border-border p-4">
          <p className="text-xs font-semibold flex items-center gap-1 mb-2"><Layers className="w-3.5 h-3.5" /> Hypergraph membership</p>
          <div className="space-y-1.5 text-[11px]">
            {hypergraphFamilies.map((family) => <p key={family} className="rounded border border-border px-2 py-1">{family}</p>)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-border p-2"><p className="text-muted-foreground">Structural coverage</p><p className="font-mono">{(familiesCovered.ratio * 100).toFixed(1)}%</p></div>
            <div className="rounded border border-border p-2"><p className="text-muted-foreground">Dark region score</p><p className="font-mono">{frontierVector.uncertainty}</p></div>
            <div className="rounded border border-border p-2"><p className="text-muted-foreground">Slippage profile</p><p className="font-mono">{behavioralCoverage.slippageClass}</p></div>
            <div className="rounded border border-border p-2"><p className="text-muted-foreground">Stability class</p><p className="font-mono">{behavioralCoverage.stabilityClass}</p></div>
          </div>
        </div>

        <div className="surface-elevated rounded-xl border border-border p-4">
          <p className="text-xs font-semibold flex items-center gap-1 mb-2"><Sparkles className="w-3.5 h-3.5" /> Frontier map snapshot</p>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between"><span>Fees</span><span className="font-mono">{frontierVector.fees}</span></div>
            <div className="flex justify-between"><span>Utilization</span><span className="font-mono">{frontierVector.utilization}</span></div>
            <div className="flex justify-between"><span>LP drawdown</span><span className="font-mono">{frontierVector.drawdown}</span></div>
            <div className="flex justify-between"><span>Arbitrage leakage</span><span className="font-mono">{frontierVector.leakage}</span></div>
            <div className="flex justify-between"><span>Stability</span><span className="font-mono">{frontierVector.stability}</span></div>
          </div>
          <div className="mt-4 rounded-md border border-border p-2 text-[11px] text-muted-foreground">
            Behavioral coverage includes slippage profile class, tail-loss estimate, liquidity collapse probability, and stability classification.
          </div>
        </div>
      </div>

      <div className="surface-elevated rounded-xl border border-border p-4">
        <p className="text-xs font-semibold flex items-center gap-1 mb-3"><Network className="w-3.5 h-3.5" /> Automatic branch selection (multi-armed bandit)</p>
        <div className="grid md:grid-cols-3 gap-3">
          {rankedBranches.map((branch) => (
            <motion.div key={branch.id} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} className="rounded-lg border border-border p-3 space-y-1.5">
              <p className="text-[11px] font-semibold">{branch.id}</p>
              <div className="text-[10px] text-muted-foreground space-y-0.5">
                <div className="flex justify-between"><span>Posterior mean</span><span className="font-mono">{branch.posteriorMean.toFixed(3)}</span></div>
                <div className="flex justify-between"><span>Variance</span><span className="font-mono">{branch.variance.toFixed(3)}</span></div>
                <div className="flex justify-between"><span>Expected improvement</span><span className="font-mono">{branch.expectedImprovement.toFixed(3)}</span></div>
                <div className="flex justify-between"><span>Priority score</span><span className="font-mono">{branch.score.toFixed(3)}</span></div>
                <div className="flex justify-between"><span>Samples</span><span className="font-mono">{branch.tested}</span></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="surface-elevated rounded-xl border border-border p-4 space-y-3">
        <p className="text-xs font-semibold flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Structural editor (live symbolic definitions)</p>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <p className="text-[11px] text-muted-foreground mb-1">Invariant expression</p>
            <textarea value={invariantExpr} onChange={(event) => setInvariantExpr(event.target.value)} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs min-h-20" />
          </label>
          <label className="block">
            <p className="text-[11px] text-muted-foreground mb-1">Liquidity density function</p>
            <textarea value={liquidityExpr} onChange={(event) => setLiquidityExpr(event.target.value)} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs min-h-20" />
          </label>
          <label className="block">
            <p className="text-[11px] text-muted-foreground mb-1">Fee function</p>
            <textarea value={feeExpr} onChange={(event) => setFeeExpr(event.target.value)} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs min-h-20" />
          </label>
          <label className="block">
            <p className="text-[11px] text-muted-foreground mb-1">Control policy definition</p>
            <textarea value={controlExpr} onChange={(event) => setControlExpr(event.target.value)} className="w-full px-2 py-2 rounded-md border border-border bg-background text-xs min-h-20" />
          </label>
        </div>
      </div>
    </section>
  );
}
