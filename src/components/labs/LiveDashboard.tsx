import { useMemo } from "react";
import { motion } from "framer-motion";
import { Crown, Zap, AlertTriangle, Trophy, Activity, Users, Archive, BarChart2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area,
  BarChart, Bar, ReferenceLine } from
"recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import type { EngineState, RegimeId, Candidate, ChampionMetric } from "@/lib/discovery-engine";
import { NUM_BINS, binPrice, CHAMPION_METRIC_LABELS, REGIMES } from "@/lib/discovery-engine";

const REGIME_CYCLE: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];

const REGIME_COLORS: Record<RegimeId, string> = {
  "low-vol": "hsl(142, 72%, 45%)",
  "high-vol": "hsl(38, 92%, 50%)",
  "jump-diffusion": "hsl(0, 72%, 55%)"
};

const REGIME_LABELS: Record<RegimeId, string> = {
  "low-vol": "Low Vol",
  "high-vol": "High Vol",
  "jump-diffusion": "Jump Diff"
};

interface LiveDashboardProps {
  state: EngineState;
  onSelectCandidate: (id: string) => void;
}

function ScoreTrend({ score }: { score: number }) {
  // Lower score = better in this system. Rough ranges:
  // < -10: excellent, -10 to 0: good, 0 to 10: average, > 10: poor
  if (score < -5) return <TrendingUp className="w-3 h-3 text-success" />;
  if (score < 5) return <Minus className="w-3 h-3 text-muted-foreground" />;
  return <TrendingDown className="w-3 h-3 text-destructive" />;
}

function ChampionCard({
  regime,
  champion,
  onSelectCandidate
}: {
  regime: RegimeId;
  champion: Candidate | null;
  onSelectCandidate: (id: string) => void;
}) {
  if (!champion) {
    return (
      <div className="surface-elevated rounded-xl p-4 border-l-2" style={{ borderLeftColor: REGIME_COLORS[regime] }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: REGIME_COLORS[regime] }} />
          <span className="text-[10px] font-bold text-foreground">{REGIME_LABELS[regime]}</span>
        </div>
        <p className="text-[10px] text-muted-foreground">Awaiting first generation...</p>
      </div>);

  }

  const m = champion.metrics;
  return (
    <div
      className="surface-elevated rounded-xl p-4 border-l-2 cursor-pointer hover:bg-secondary/30 transition-colors"
      style={{ borderLeftColor: REGIME_COLORS[regime] }}
      onClick={() => onSelectCandidate(champion.id)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="w-3 h-3" style={{ color: REGIME_COLORS[regime] }} />
          <span className="text-[10px] font-bold text-foreground">{REGIME_LABELS[regime]} Champion</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ScoreTrend score={champion.score} />
          <span className="text-[9px] font-mono text-muted-foreground">Gen {champion.generation}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <MiniStat label="Fees" value={m.totalFees.toFixed(1)} positive />
        <MiniStat label="Util" value={`${(m.liquidityUtilization * 100).toFixed(0)}%`} positive />
        <MiniStat label="LP/HODL" value={m.lpValueVsHodl.toFixed(3)} positive={m.lpValueVsHodl >= 1} />
        <MiniStat label="Slippage" value={`${(m.totalSlippage * 100).toFixed(2)}%`} />
        <MiniStat label="Arb Leak" value={m.arbLeakage.toFixed(1)} />
        <MiniStat label="Max DD" value={`${(m.maxDrawdown * 100).toFixed(1)}%`} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-muted-foreground">Score:</span>
        <span className="text-[9px] font-mono font-bold text-foreground">{champion.score.toFixed(3)}</span>
        <span className="text-[8px] text-muted-foreground/60">(↓ better)</span>
        <span className="text-[9px] text-muted-foreground ml-1">σ:</span>
        <span className="text-[9px] font-mono text-foreground">{champion.stability.toFixed(4)}</span>
      </div>
    </div>);

}

function MiniStat({ label, value, positive }: {label: string;value: string;positive?: boolean;}) {
  return (
    <div>
      <p className="text-[8px] text-muted-foreground">{label}</p>
      <p className={`text-[10px] font-mono font-semibold ${positive === true ? "text-success" : positive === false ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>);

}

function MetricChampionValue(c: Candidate, metric: ChampionMetric): string {
  switch (metric) {
    case "fees": return c.metrics.totalFees.toFixed(2);
    case "utilization": return `${(c.metrics.liquidityUtilization * 100).toFixed(1)}%`;
    case "lpValue": return c.metrics.lpValueVsHodl.toFixed(4);
    case "lowSlippage": return `${(c.metrics.totalSlippage * 100).toFixed(3)}%`;
    case "lowArbLeak": return c.metrics.arbLeakage.toFixed(2);
    case "lowDrawdown": return `${(c.metrics.maxDrawdown * 100).toFixed(1)}%`;
    case "stability": return c.stability.toFixed(4);
  }
}

function LiquidityDensityChart({ candidate, color }: { candidate: Candidate; color: string }) {
  const data = useMemo(() => {
    return Array.from({ length: NUM_BINS }, (_, i) => ({
      price: parseFloat(binPrice(i).toFixed(3)),
      weight: parseFloat(candidate.bins[i].toFixed(4)),
    }));
  }, [candidate]);

  const chartColors = useChartColors();

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`liqGrad-${candidate.regime}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <XAxis dataKey="price" tick={{ fontSize: 7, fill: chartColors.tick }} tickCount={5} tickFormatter={v => v.toFixed(2)} />
          <YAxis tick={{ fontSize: 7, fill: chartColors.tick }} width={30} />
          <Tooltip
            contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 9, color: chartColors.tooltipText }}
            wrapperStyle={{ pointerEvents: "none" }}
            formatter={(value: number) => [value.toFixed(3), "Weight"]}
            labelFormatter={(label: number) => `Price: ${Number(label).toFixed(3)}`}
          />
          <ReferenceLine x={1} stroke={color} strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: "P=1", position: "top", fontSize: 7, fill: color }} />
          <Area type="monotone" dataKey="weight" stroke={color} fill={`url(#liqGrad-${candidate.regime})`} strokeWidth={1.5} name="Liquidity Weight" />
        </AreaChart>
      </ResponsiveContainer>
    </div>);

}

function RadarMetrics({ candidates }: {candidates: (Candidate | null)[];}) {
  const chartColors = useChartColors();
  const data = useMemo(() => {
    const axes = [
    { key: "fees", label: "Fees" },
    { key: "utilization", label: "Utilization" },
    { key: "lpValue", label: "LP Value" },
    { key: "lowSlippage", label: "Low Slippage" },
    { key: "lowArb", label: "Low Arb Leak" },
    { key: "stability", label: "Stability" }];


    return axes.map((axis) => {
      const point: Record<string, string | number> = { axis: axis.label };
      const regimes: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];
      regimes.forEach((r, i) => {
        const c = candidates[i];
        if (!c) {point[r] = 0;return;}
        const m = c.metrics;
        switch (axis.key) {
          case "fees":point[r] = Math.min(m.totalFees / 50, 1) * 100;break;
          case "utilization":point[r] = m.liquidityUtilization * 100;break;
          case "lpValue":point[r] = Math.min(m.lpValueVsHodl, 1.2) / 1.2 * 100;break;
          case "lowSlippage":point[r] = Math.max(0, 1 - m.totalSlippage * 10) * 100;break;
          case "lowArb":point[r] = Math.max(0, 1 - m.arbLeakage / 50) * 100;break;
          case "stability":point[r] = Math.max(0, 1 - c.stability * 5) * 100;break;
        }
      });
      return point;
    });
  }, [candidates]);

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke={chartColors.grid} />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 8, fill: chartColors.tick }} />
          <Tooltip
            contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 9, color: chartColors.tooltipText }}
            wrapperStyle={{ pointerEvents: "none" }}
            formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
          />
          <Radar name="Low Vol" dataKey="low-vol" stroke={REGIME_COLORS["low-vol"]} fill={REGIME_COLORS["low-vol"]} fillOpacity={0.1} strokeWidth={1.5} />
          <Radar name="High Vol" dataKey="high-vol" stroke={REGIME_COLORS["high-vol"]} fill={REGIME_COLORS["high-vol"]} fillOpacity={0.1} strokeWidth={1.5} />
          <Radar name="Jump Diff" dataKey="jump-diffusion" stroke={REGIME_COLORS["jump-diffusion"]} fill={REGIME_COLORS["jump-diffusion"]} fillOpacity={0.1} strokeWidth={1.5} />
        </RadarChart>
      </ResponsiveContainer>
    </div>);

}

// ─── Score History & Pareto Stats ────────────────────────────────────────────

function ScoreHistorySection({ state, regimeIds }: { state: EngineState; regimeIds: RegimeId[] }) {
  const chartColors = useChartColors();

  // Compute score distribution histogram across archive
  const histogram = useMemo(() => {
    if (state.archive.length === 0) return [];
    const scores = state.archive.map(c => c.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore;
    if (range <= 0) return [{ bucket: minScore.toFixed(1), count: scores.length }];

    const NUM_BUCKETS = 12;
    const bucketWidth = range / NUM_BUCKETS;
    const buckets = Array.from({ length: NUM_BUCKETS }, (_, i) => ({
      bucket: (minScore + (i + 0.5) * bucketWidth).toFixed(1),
      count: 0,
      low_vol: 0,
      high_vol: 0,
      jump_diffusion: 0,
    }));

    for (const c of state.archive) {
      const idx = Math.min(Math.floor((c.score - minScore) / bucketWidth), NUM_BUCKETS - 1);
      buckets[idx].count++;
      if (c.regime === "low-vol") buckets[idx].low_vol++;
      else if (c.regime === "high-vol") buckets[idx].high_vol++;
      else buckets[idx].jump_diffusion++;
    }

    return buckets;
  }, [state.archive]);

  // Compute a simple Pareto-like metric: how many candidates beat the mean on all 3 key metrics?
  const paretoStats = useMemo(() => {
    if (state.archive.length === 0) return { total: 0, perRegime: {} as Record<RegimeId, number> };

    const perRegime: Record<RegimeId, number> = { "low-vol": 0, "high-vol": 0, "jump-diffusion": 0 };

    for (const rid of regimeIds) {
      const regCandidates = state.archive.filter(c => c.regime === rid);
      if (regCandidates.length < 2) continue;

      const meanFees = regCandidates.reduce((s, c) => s + c.metrics.totalFees, 0) / regCandidates.length;
      const meanSlip = regCandidates.reduce((s, c) => s + c.metrics.totalSlippage, 0) / regCandidates.length;
      const meanLPvH = regCandidates.reduce((s, c) => s + c.metrics.lpValueVsHodl, 0) / regCandidates.length;

      perRegime[rid] = regCandidates.filter(c =>
        c.metrics.totalFees >= meanFees &&
        c.metrics.totalSlippage <= meanSlip &&
        c.metrics.lpValueVsHodl >= meanLPvH
      ).length;
    }

    return {
      total: Object.values(perRegime).reduce((a, b) => a + b, 0),
      perRegime,
    };
  }, [state.archive, regimeIds]);

  return (
    <motion.div className="grid md:grid-cols-3 gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}>
      {/* Score Distribution Histogram */}
      <div className="md:col-span-2 surface-elevated rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs font-semibold text-foreground">Score Distribution</h4>
          <span className="text-[8px] text-muted-foreground">lower score = better AMM design</span>
        </div>
        <p className="text-[9px] text-muted-foreground mb-3">
          Histogram of all {state.archive.length} archived candidates — colored by regime
        </p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogram} barCategoryGap="2%">
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 7, fill: chartColors.tick }} interval={1} />
              <YAxis tick={{ fontSize: 7, fill: chartColors.tick }} width={25} />
              <Tooltip
                contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 9, color: chartColors.tooltipText }}
                wrapperStyle={{ pointerEvents: "none" }}
                formatter={(value: number, name: string) => [value, name.replace("_", " ")]}
                labelFormatter={label => `Score bucket: ${label}`}
              />
              <Bar dataKey="low_vol" stackId="a" fill={REGIME_COLORS["low-vol"]} fillOpacity={0.7} name="Low Vol" />
              <Bar dataKey="high_vol" stackId="a" fill={REGIME_COLORS["high-vol"]} fillOpacity={0.7} name="High Vol" />
              <Bar dataKey="jump_diffusion" stackId="a" fill={REGIME_COLORS["jump-diffusion"]} fillOpacity={0.7} name="Jump Diff" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pareto-like stats */}
      <div className="surface-elevated rounded-xl p-4">
        <h4 className="text-xs font-semibold text-foreground mb-1">Multi-Objective Elite</h4>
        <p className="text-[9px] text-muted-foreground mb-3">
          Candidates beating the mean on fees, slippage, and LP/HODL simultaneously
        </p>
        <div className="space-y-3">
          {regimeIds.map(r => {
            const count = paretoStats.perRegime[r] ?? 0;
            const total = state.archive.filter(c => c.regime === r).length;
            const pct = total > 0 ? count / total : 0;
            return (
              <div key={r}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: REGIME_COLORS[r] }} />
                    <span className="text-[9px] text-foreground">{REGIME_LABELS[r]}</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-foreground">
                    {count} / {total}
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct * 100}%`, backgroundColor: REGIME_COLORS[r] }}
                  />
                </div>
                <p className="text-[7px] text-muted-foreground mt-0.5">{(pct * 100).toFixed(1)}% of {r} archive</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-center">
            <p className="text-lg font-bold font-mono text-foreground">{paretoStats.total}</p>
            <p className="text-[8px] text-muted-foreground">total multi-objective elite candidates</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function LiveDashboard({ state, onSelectCandidate }: LiveDashboardProps) {
  const regimeIds: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];
  const champions = regimeIds.map((r) => state.populations[r]?.champion ?? null);
  const totalEvaluated = regimeIds.reduce((sum, r) => sum + (state.populations[r]?.totalEvaluated ?? 0), 0);

  // Which regime is currently being evolved
  const currentRegimeId = REGIME_CYCLE[state.totalGenerations % REGIME_CYCLE.length];
  const currentRegimeConfig = REGIMES.find(r => r.id === currentRegimeId)!;

  // Activity log (most recent first)
  const recentActivity = useMemo(() =>
  [...state.activityLog].
  filter((e) => e.type !== "generation-complete").
  reverse().
  slice(0, 20),
  [state.activityLog]
  );

  // Score history: champion scores per generation from recent champion-replaced events
  const scoreHistory = useMemo(() => {
    const events = [...state.activityLog]
      .filter(e => e.type === "champion-replaced")
      .slice(-30);
    return events.map((e, i) => ({
      gen: e.generation,
      regime: e.regime,
      color: REGIME_COLORS[e.regime],
      idx: i,
    }));
  }, [state.activityLog]);

  // Per-regime best scores for the mini bar chart
  const regimeScores = useMemo(() => {
    return regimeIds.map(r => {
      const champ = state.populations[r]?.champion;
      return {
        regime: r,
        label: REGIME_LABELS[r],
        score: champ ? champ.score : null,
        color: REGIME_COLORS[r],
      };
    });
  }, [state.populations]);

  // Collect all metric champions across regimes (deduplicated)
  const allMetricChampions = useMemo(() => {
    const metrics: ChampionMetric[] = ["fees", "utilization", "lpValue", "lowSlippage", "lowArbLeak", "lowDrawdown", "stability"];
    const results: { metric: ChampionMetric; candidate: Candidate; regime: RegimeId }[] = [];
    const seen = new Set<string>();

    for (const metric of metrics) {
      // Find the best across all regimes for this metric
      let best: { candidate: Candidate; regime: RegimeId } | null = null;
      for (const rid of regimeIds) {
        const mc = state.populations[rid].metricChampions[metric];
        if (!mc) continue;
        if (!best) { best = { candidate: mc, regime: rid }; continue; }
        // Compare
        const isBetter = (() => {
          switch (metric) {
            case "fees": return mc.metrics.totalFees > best.candidate.metrics.totalFees;
            case "utilization": return mc.metrics.liquidityUtilization > best.candidate.metrics.liquidityUtilization;
            case "lpValue": return mc.metrics.lpValueVsHodl > best.candidate.metrics.lpValueVsHodl;
            case "lowSlippage": return mc.metrics.totalSlippage < best.candidate.metrics.totalSlippage;
            case "lowArbLeak": return mc.metrics.arbLeakage < best.candidate.metrics.arbLeakage;
            case "lowDrawdown": return mc.metrics.maxDrawdown < best.candidate.metrics.maxDrawdown;
            case "stability": return mc.stability < best.candidate.stability;
          }
        })();
        if (isBetter) best = { candidate: mc, regime: rid };
      }
      if (best && !seen.has(best.candidate.id)) {
        results.push({ metric, ...best });
        seen.add(best.candidate.id);
      }
    }
    return results;
  }, [state.populations]);

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div className="surface-elevated rounded-xl p-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3 h-3 text-muted-foreground" />
            <p className="text-[9px] text-muted-foreground">Total Generations</p>
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{state.totalGenerations}</p>
          <p className="text-[8px] text-muted-foreground mt-0.5">
            Evolving: <span style={{ color: REGIME_COLORS[currentRegimeId] }}>{currentRegimeConfig.label.split(" ")[0]} {currentRegimeConfig.label.split(" ")[1]}</span>
          </p>
        </motion.div>
        <motion.div className="surface-elevated rounded-xl p-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3 h-3 text-muted-foreground" />
            <p className="text-[9px] text-muted-foreground">Candidates Evaluated</p>
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{totalEvaluated.toLocaleString()}</p>
          <p className="text-[8px] text-muted-foreground mt-0.5">across {regimeIds.length} regimes</p>
        </motion.div>
        <motion.div className="surface-elevated rounded-xl p-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Archive className="w-3 h-3 text-muted-foreground" />
            <p className="text-[9px] text-muted-foreground">Archive Size</p>
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{(state.archiveSize ?? state.archive.length).toLocaleString()}</p>
          <p className="text-[8px] text-muted-foreground mt-0.5">top-5% per generation</p>
        </motion.div>
        <motion.div className="surface-elevated rounded-xl p-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart2 className="w-3 h-3 text-muted-foreground" />
            <p className="text-[9px] text-muted-foreground">Best Scores</p>
          </div>
          <div className="flex items-end gap-1.5 mt-1">
            {regimeScores.map(rs => (
              <div key={rs.regime} className="flex flex-col items-center gap-0.5 flex-1">
                <div className="text-[8px] font-mono font-bold" style={{ color: rs.color }}>
                  {rs.score !== null ? rs.score.toFixed(1) : "—"}
                </div>
                <div className="w-full h-1 rounded-full" style={{ backgroundColor: rs.color, opacity: 0.6 }} />
                <div className="text-[7px] text-muted-foreground truncate w-full text-center">{rs.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Overall champions per regime */}
      <div>
        <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5 text-warning" /> Current Champions
          <span className="text-[8px] font-normal text-muted-foreground ml-1">— click to inspect</span>
        </h3>
        <div className="grid md:grid-cols-3 gap-3">
          {regimeIds.map((r) =>
          <ChampionCard
              key={r}
              regime={r}
              champion={state.populations[r].champion}
              onSelectCandidate={onSelectCandidate}
            />
          )}
        </div>
      </div>

      {/* Per-metric champions */}
      {allMetricChampions.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Metric Champions
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {allMetricChampions.map(({ metric, candidate, regime }) => (
              <div
                key={metric}
                className="surface-elevated rounded-xl p-3 cursor-pointer hover:bg-secondary/30 transition-colors border-t-2"
                style={{ borderTopColor: REGIME_COLORS[regime] }}
                onClick={() => onSelectCandidate(candidate.id)}
              >
                <p className="text-[8px] text-muted-foreground mb-1">{CHAMPION_METRIC_LABELS[metric]}</p>
                <p className="text-xs font-bold font-mono text-foreground mb-1">{MetricChampionValue(candidate, metric)}</p>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: REGIME_COLORS[regime] }} />
                  <span className="text-[7px] font-mono text-muted-foreground">{candidate.id.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Radar comparison + Liquidity density curves */}
      <div className="grid md:grid-cols-2 gap-4">
        <motion.div className="surface-elevated rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <h4 className="text-xs font-semibold text-foreground mb-1">Performance Radar</h4>
          <p className="text-[9px] text-muted-foreground mb-2">
            Champion metrics across regimes — all axes: <span className="text-success font-medium">higher = better</span>
          </p>
          <RadarMetrics candidates={champions} />
          <div className="flex items-center justify-center gap-4 mt-2">
            {regimeIds.map((r) =>
            <div key={r} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: REGIME_COLORS[r] }} />
                <span className="text-[9px] text-muted-foreground">{REGIME_LABELS[r]}</span>
              </div>
            )}
          </div>
          <p className="text-[8px] text-muted-foreground/60 text-center mt-2">
            Low Slippage / Low Arb Leak / Stability are inverted so higher = better
          </p>
        </motion.div>

        <motion.div className="surface-elevated rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <h4 className="text-xs font-semibold text-foreground mb-1">Champion Liquidity Densities</h4>
          <p className="text-[9px] text-muted-foreground mb-2">
            Capital weight per price bin — dashed line marks P=1.0 (current price)
          </p>
          <div className="space-y-3">
            {regimeIds.map((r) => {
              const champ = state.populations[r].champion;
              if (!champ) return (
                <div key={r} className="h-10 flex items-center justify-center">
                  <span className="text-[9px] text-muted-foreground">No champion yet — {REGIME_LABELS[r]}</span>
                </div>);

              return (
                <div key={r}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: REGIME_COLORS[r] }} />
                    <span className="text-[8px] text-muted-foreground">{REGIME_LABELS[r]}</span>
                  </div>
                  <LiquidityDensityChart candidate={champ} color={REGIME_COLORS[r]} />
                </div>);

            })}
          </div>
        </motion.div>
      </div>

      {/* Score history + Pareto stats */}
      {state.archive.length > 0 && (
        <ScoreHistorySection state={state} regimeIds={regimeIds} />
      )}

      {/* Activity log */}
      <motion.div className="surface-elevated rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> Activity Log
          <span className="text-[8px] font-normal text-muted-foreground ml-1">— champion replacements & plateaus</span>
        </h4>
        {recentActivity.length === 0 ? (
          <p className="text-[10px] text-muted-foreground text-center py-4">No activity yet. Engine is initializing...</p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {recentActivity.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-secondary/50 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: REGIME_COLORS[entry.regime] }} />
                {entry.type === "champion-replaced" && <Crown className="w-3 h-3 text-success shrink-0" />}
                {entry.type === "convergence-plateau" && <AlertTriangle className="w-3 h-3 text-warning shrink-0" />}
                {entry.type === "exploration-spike" && <Zap className="w-3 h-3 text-chart-1 shrink-0" />}
                <span className="text-[9px] text-foreground flex-1">{entry.message}</span>
                <span className="text-[8px] font-mono text-muted-foreground shrink-0">
                  Gen {entry.generation}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>);

}