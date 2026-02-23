import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Fingerprint, BarChart3, TrendingUp, Layers, Shield, Download } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, BarChart, Bar,
} from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import type { Candidate, RegimeId, EngineState } from "@/lib/discovery-engine";
import {
  NUM_BINS, binPrice, REGIMES, evaluateCandidate, generatePriceImpactCurve, computeFeatures,
} from "@/lib/discovery-engine";

const REGIME_COLORS: Record<RegimeId, string> = {
  "low-vol": "hsl(142, 72%, 45%)",
  "high-vol": "hsl(38, 92%, 50%)",
  "jump-diffusion": "hsl(0, 72%, 55%)",
};

const REGIME_LABELS: Record<RegimeId, string> = {
  "low-vol": "Low Vol",
  "high-vol": "High Vol",
  "jump-diffusion": "Jump Diff",
};

interface DesignDetailProps {
  candidate: Candidate;
  state: EngineState;
  onBack: () => void;
}

function downloadCandidateJson(candidate: Candidate) {
  const payload = {
    id: candidate.id,
    regime: candidate.regime,
    generation: candidate.generation,
    score: candidate.score,
    stability: candidate.stability,
    timestamp: candidate.timestamp,
    bins: Array.from(candidate.bins),
    metrics: candidate.metrics,
    features: candidate.features,
    config: {
      numBins: NUM_BINS,
      logPriceRange: [-2, 2],
      totalLiquidity: 1000,
      feeRate: 0.003,
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${candidate.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DesignDetail({ candidate, state, onBack }: DesignDetailProps) {
  const colors = useChartColors();

  // Liquidity distribution data
  const liquidityData = useMemo(() =>
    Array.from({ length: NUM_BINS }, (_, i) => ({
      price: parseFloat(binPrice(i).toFixed(3)),
      weight: candidate.bins[i],
      logPrice: parseFloat(((i / NUM_BINS) * 4 - 2).toFixed(2)),
    })),
    [candidate]
  );

  // Price impact curve
  const impactCurve = useMemo(() =>
    generatePriceImpactCurve(candidate.bins),
    [candidate]
  );

  // Equity curve (regenerated for display with variance bands)
  const equityCurves = useMemo(() => {
    const regimeConfig = REGIMES.find(r => r.id === candidate.regime)!;
    const curves: number[][] = [];
    for (let p = 0; p < 5; p++) {
      const { equityCurve } = evaluateCandidate(candidate.bins, regimeConfig, 2, 2);
      curves.push(equityCurve);
    }

    const len = curves[0]?.length || 0;
    return Array.from({ length: len }, (_, t) => {
      const vals = curves.map(c => c[t] || 1);
      vals.sort((a, b) => a - b);
      return {
        step: t,
        median: vals[Math.floor(vals.length / 2)],
        low: vals[0],
        high: vals[vals.length - 1],
        mean: vals.reduce((a, b) => a + b, 0) / vals.length,
      };
    });
  }, [candidate]);

  // Cross-regime comparison (evaluate this candidate's bins in other regimes)
  const regimeComparison = useMemo(() => {
    return REGIMES.map(regime => {
      const { metrics } = evaluateCandidate(candidate.bins, regime, 5, 5);
      return {
        regime: regime.id,
        label: REGIME_LABELS[regime.id],
        fees: metrics.totalFees,
        utilization: metrics.liquidityUtilization * 100,
        lpVsHodl: (metrics.lpValueVsHodl - 1) * 100,
        slippage: metrics.totalSlippage * 100,
        arbLeak: metrics.arbLeakage,
        maxDD: metrics.maxDrawdown * 100,
      };
    });
  }, [candidate]);

  // Feature radar data
  const featureRadar = useMemo(() => {
    const f = candidate.features;
    const maxEntropy = Math.log2(NUM_BINS);
    return [
      { axis: "Curvature", value: Math.min(f.curvature * 1000, 100) },
      { axis: "Entropy", value: (f.entropy / maxEntropy) * 100 },
      { axis: "Symmetry", value: ((f.symmetry + 1) / 2) * 100 },
      { axis: "Tail Density", value: Math.min(f.tailDensityRatio * 100, 100) },
      { axis: "Peak Conc.", value: Math.min(f.peakConcentration / 10 * 100, 100) },
    ];
  }, [candidate]);

  const m = candidate.metrics;
  const tooltipStyle = { background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 9, color: colors.tooltipText };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <Fingerprint className="w-4 h-4 text-foreground" />
          <div>
            <h3 className="text-sm font-bold text-foreground">{candidate.id}</h3>
            <p className="text-[9px] text-muted-foreground">
              Regime: {REGIME_LABELS[candidate.regime]} | Generation {candidate.generation} | Score: {candidate.score.toFixed(3)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCandidateJson(candidate)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-foreground border border-border text-[10px] font-medium hover:bg-accent transition-colors"
          >
            <Download className="w-3 h-3" /> Download .json
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: REGIME_COLORS[candidate.regime] }} />
            <span className="text-[9px] font-mono text-muted-foreground">{candidate.regime}</span>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <motion.div className="grid grid-cols-3 md:grid-cols-7 gap-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <MetricCard label="Total Fees" value={m.totalFees.toFixed(2)} positive />
        <MetricCard label="Avg Slippage" value={`${(m.totalSlippage * 100).toFixed(3)}%`} />
        <MetricCard label="Arb Leakage" value={m.arbLeakage.toFixed(2)} />
        <MetricCard label="Utilization" value={`${(m.liquidityUtilization * 100).toFixed(1)}%`} positive />
        <MetricCard label="LP/HODL" value={m.lpValueVsHodl.toFixed(4)} positive={m.lpValueVsHodl >= 1} />
        <MetricCard label="Max Drawdown" value={`${(m.maxDrawdown * 100).toFixed(1)}%`} />
        <MetricCard label="Return Vol" value={`${(m.volatilityOfReturns * 100).toFixed(2)}%`} />
      </motion.div>

      {/* Liquidity distribution + Feature radar */}
      <div className="grid md:grid-cols-3 gap-4">
        <motion.div className="md:col-span-2 surface-elevated rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-foreground" />
            <h4 className="text-xs font-semibold text-foreground">Liquidity Distribution</h4>
          </div>
          <p className="text-[9px] text-muted-foreground mb-3">Capital weight per price bin ({NUM_BINS} bins across log-price domain)</p>
          <div className="h-48" onWheel={e => e.stopPropagation()}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liquidityData}>
                <defs>
                  <linearGradient id="liqDetailGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={REGIME_COLORS[candidate.regime]} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={REGIME_COLORS[candidate.regime]} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="price" tick={{ fontSize: 8, fill: colors.tick }} tickCount={8} />
                <YAxis tick={{ fontSize: 8, fill: colors.tick }} width={35} />
                <Tooltip contentStyle={tooltipStyle} wrapperStyle={{ pointerEvents: "none" }} />
                <Area type="monotone" dataKey="weight" stroke={REGIME_COLORS[candidate.regime]} fill="url(#liqDetailGrad)" strokeWidth={1.5} name="Weight" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div className="surface-elevated rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <h4 className="text-xs font-semibold text-foreground mb-1">Feature Profile</h4>
          <p className="text-[9px] text-muted-foreground mb-2">Shape descriptors (normalized)</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={featureRadar}>
                <PolarGrid stroke={colors.grid} />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 7, fill: colors.tick }} />
                <Radar dataKey="value" stroke={REGIME_COLORS[candidate.regime]} fill={REGIME_COLORS[candidate.regime]} fillOpacity={0.15} strokeWidth={1.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-2 border-t border-border pt-2">
            <FeatureRow label="Curvature" value={candidate.features.curvature.toFixed(5)} desc="Second-derivative energy" />
            <FeatureRow label="Entropy" value={candidate.features.entropy.toFixed(3)} desc="Distribution uniformity" />
            <FeatureRow label="Symmetry" value={candidate.features.symmetry.toFixed(3)} desc="Left-right correlation" />
            <FeatureRow label="Tail Ratio" value={candidate.features.tailDensityRatio.toFixed(3)} desc="Tail vs center mass" />
            <FeatureRow label="Peak Conc." value={candidate.features.peakConcentration.toFixed(2)} desc="Max/mean bin ratio" />
          </div>
        </motion.div>
      </div>

      {/* Price impact curve */}
      <motion.div className="surface-elevated rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp className="w-3.5 h-3.5 text-foreground" />
          <h4 className="text-xs font-semibold text-foreground">Implied Price Impact Curve</h4>
        </div>
        <p className="text-[9px] text-muted-foreground mb-3">Slippage (%) vs trade size, derived from liquidity density</p>
        <div className="h-40" onWheel={e => e.stopPropagation()}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={impactCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey="tradeSize" tick={{ fontSize: 8, fill: colors.tick }} tickFormatter={v => `${v.toFixed(0)}`} />
              <YAxis tick={{ fontSize: 8, fill: colors.tick }} tickFormatter={v => `${v}%`} width={35} />
              <Tooltip contentStyle={tooltipStyle} wrapperStyle={{ pointerEvents: "none" }} />
              <Line type="monotone" dataKey="impact" stroke={colors.line} strokeWidth={1.5} dot={false} name="Impact %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Equity curve with variance bands */}
      <motion.div className="surface-elevated rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Layers className="w-3.5 h-3.5 text-foreground" />
          <h4 className="text-xs font-semibold text-foreground">Equity Curve (Out-of-Sample)</h4>
        </div>
        <p className="text-[9px] text-muted-foreground mb-3">Normalized LP value across 5 independent paths with range bands</p>
        <div className="h-48" onWheel={e => e.stopPropagation()}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityCurves}>
              <defs>
                <linearGradient id="eqBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.green} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={colors.green} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey="step" tick={{ fontSize: 8, fill: colors.tick }} />
              <YAxis tick={{ fontSize: 8, fill: colors.tick }} domain={["auto", "auto"]} width={40} />
              <Tooltip contentStyle={tooltipStyle} wrapperStyle={{ pointerEvents: "none" }} />
              <Area type="monotone" dataKey="high" stroke="none" fill="url(#eqBand)" name="High" />
              <Area type="monotone" dataKey="low" stroke="none" fill="url(#eqBand)" name="Low" />
              <Line type="monotone" dataKey="median" stroke={colors.green} strokeWidth={1.5} dot={false} name="Median" />
              <Line type="monotone" dataKey="mean" stroke={colors.line} strokeWidth={1} dot={false} strokeDasharray="4 4" name="Mean" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Cross-regime comparison */}
      <motion.div className="surface-elevated rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Shield className="w-3.5 h-3.5 text-foreground" />
          <h4 className="text-xs font-semibold text-foreground">Regime Comparison</h4>
        </div>
        <p className="text-[9px] text-muted-foreground mb-3">
          This candidate's bins evaluated across all three market regimes
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[9px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Regime</th>
                <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Fees</th>
                <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Utilization</th>
                <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">LP vs HODL</th>
                <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Avg Slippage</th>
                <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Arb Leak</th>
                <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Max DD</th>
              </tr>
            </thead>
            <tbody>
              {regimeComparison.map(rc => (
                <tr key={rc.regime} className={`border-b border-border/50 ${rc.regime === candidate.regime ? "bg-foreground/5" : ""}`}>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: REGIME_COLORS[rc.regime as RegimeId] }} />
                      <span className="font-medium text-foreground">{rc.label}</span>
                      {rc.regime === candidate.regime && <span className="text-[7px] text-muted-foreground">(native)</span>}
                    </div>
                  </td>
                  <td className="text-right py-1.5 px-2 font-mono text-foreground">{rc.fees.toFixed(2)}</td>
                  <td className="text-right py-1.5 px-2 font-mono text-foreground">{rc.utilization.toFixed(1)}%</td>
                  <td className={`text-right py-1.5 px-2 font-mono ${rc.lpVsHodl >= 0 ? "text-success" : "text-destructive"}`}>
                    {rc.lpVsHodl >= 0 ? "+" : ""}{rc.lpVsHodl.toFixed(2)}%
                  </td>
                  <td className="text-right py-1.5 px-2 font-mono text-foreground">{rc.slippage.toFixed(3)}%</td>
                  <td className="text-right py-1.5 px-2 font-mono text-foreground">{rc.arbLeak.toFixed(2)}</td>
                  <td className="text-right py-1.5 px-2 font-mono text-warning">{rc.maxDD.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Full metric definitions */}
      <motion.div className="surface-elevated rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        <h4 className="text-xs font-semibold text-foreground mb-3">Metric Definitions</h4>
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-1.5">
          <DefRow term="Total Fees" def="Cumulative fees earned by the AMM across all simulated trades and arbitrage events." />
          <DefRow term="Avg Slippage" def="Mean price impact per trade, measuring execution quality for traders." />
          <DefRow term="Arb Leakage" def="Value extracted by arbitrageurs realigning the AMM to external prices." />
          <DefRow term="Liquidity Utilization" def="Fraction of total liquidity in bins visited by the price path." />
          <DefRow term="LP/HODL Ratio" def="Final LP portfolio value divided by the passive holding value." />
          <DefRow term="Max Drawdown" def="Worst peak-to-trough decline in LP value during the simulation." />
          <DefRow term="Return Volatility" def="Standard deviation of per-step LP returns." />
          <DefRow term="Stability" def="Cross-path variance of LP/HODL ratio, measuring result consistency." />
          <DefRow term="Curvature" def="Sum of squared second-differences of the normalized bin vector." />
          <DefRow term="Entropy" def="Shannon entropy of the liquidity distribution. Higher = more uniform." />
          <DefRow term="Symmetry" def="Pearson correlation between left and right halves of the density." />
          <DefRow term="Tail Density Ratio" def="Mass in outer 25% bins relative to center 50% bins." />
          <DefRow term="Peak Concentration" def="Ratio of maximum bin weight to mean bin weight." />
        </div>
      </motion.div>
    </div>
  );
}

function MetricCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="surface-elevated rounded-lg p-2.5">
      <p className="text-[8px] text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-xs font-bold font-mono ${positive === true ? "text-success" : positive === false ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function FeatureRow({ label, value, desc }: { label: string; value: string; desc: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-[9px] font-medium text-foreground">{label}</span>
        <span className="text-[8px] text-muted-foreground ml-1.5">{desc}</span>
      </div>
      <span className="text-[9px] font-mono text-foreground">{value}</span>
    </div>
  );
}

function DefRow({ term, def }: { term: string; def: string }) {
  return (
    <div className="py-1">
      <span className="text-[9px] font-semibold text-foreground">{term}: </span>
      <span className="text-[9px] text-muted-foreground">{def}</span>
    </div>
  );
}
