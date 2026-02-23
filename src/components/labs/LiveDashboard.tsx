import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, Crown, Zap, AlertTriangle } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from
"recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import type { EngineState, RegimeId, Candidate } from "@/lib/discovery-engine";
import { NUM_BINS, binPrice, REGIMES } from "@/lib/discovery-engine";

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
}

function ChampionCard({ regime, champion }: {regime: RegimeId;champion: Candidate | null;}) {
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
    <div className="surface-elevated rounded-xl p-4 border-l-2" style={{ borderLeftColor: REGIME_COLORS[regime] }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          
          <span className="text-[10px] font-bold text-foreground">{REGIME_LABELS[regime]} Champion</span>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground">Gen {champion.generation}</span>
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
        <span className="text-[9px] text-muted-foreground ml-1">Stability:</span>
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

function LiquidityDensityChart({ candidate, color }: {candidate: Candidate;color: string;}) {
  const data = useMemo(() => {
    return Array.from({ length: NUM_BINS }, (_, i) => ({
      price: parseFloat(binPrice(i).toFixed(3)),
      weight: candidate.bins[i]
    }));
  }, [candidate]);

  const chartColors = useChartColors();

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`liqGrad-${candidate.regime}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="price" tick={{ fontSize: 7, fill: chartColors.tick }} tickCount={5} />
          <YAxis tick={{ fontSize: 7, fill: chartColors.tick }} width={30} />
          <Tooltip
            contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 9, color: chartColors.tooltipText }}
            wrapperStyle={{ pointerEvents: "none" }} />

          <Area type="monotone" dataKey="weight" stroke={color} fill={`url(#liqGrad-${candidate.regime})`} strokeWidth={1.5} />
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
          <Radar name="Low Vol" dataKey="low-vol" stroke={REGIME_COLORS["low-vol"]} fill={REGIME_COLORS["low-vol"]} fillOpacity={0.1} strokeWidth={1.5} />
          <Radar name="High Vol" dataKey="high-vol" stroke={REGIME_COLORS["high-vol"]} fill={REGIME_COLORS["high-vol"]} fillOpacity={0.1} strokeWidth={1.5} />
          <Radar name="Jump Diff" dataKey="jump-diffusion" stroke={REGIME_COLORS["jump-diffusion"]} fill={REGIME_COLORS["jump-diffusion"]} fillOpacity={0.1} strokeWidth={1.5} />
        </RadarChart>
      </ResponsiveContainer>
    </div>);

}

export default function LiveDashboard({ state }: LiveDashboardProps) {
  const regimeIds: RegimeId[] = ["low-vol", "high-vol", "jump-diffusion"];
  const champions = regimeIds.map((r) => state.populations[r].champion);
  const totalEvaluated = regimeIds.reduce((sum, r) => sum + state.populations[r].totalEvaluated, 0);

  // Activity log (most recent first)
  const recentActivity = useMemo(() =>
  [...state.activityLog].
  filter((e) => e.type !== "generation-complete").
  reverse().
  slice(0, 20),
  [state.activityLog]
  );

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div className="surface-elevated rounded-xl p-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-1.5 mb-1">
            
            <p className="text-[9px] text-muted-foreground">Total Generations</p>
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{state.totalGenerations}</p>
        </motion.div>
        <motion.div className="surface-elevated rounded-xl p-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="flex items-center gap-1.5 mb-1">
            
            <p className="text-[9px] text-muted-foreground">Candidates Evaluated</p>
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{totalEvaluated.toLocaleString()}</p>
        </motion.div>
        <motion.div className="surface-elevated rounded-xl p-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-1.5 mb-1">
            
            <p className="text-[9px] text-muted-foreground">Archive Size</p>
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{state.archive.length.toLocaleString()}</p>
        </motion.div>
        <motion.div className="surface-elevated rounded-xl p-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center gap-1.5 mb-1">
            
            <p className="text-[9px] text-muted-foreground">Status</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${state.running ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
            <p className="text-sm font-semibold text-foreground">{state.running ? "Running" : "Stopped"}</p>
          </div>
        </motion.div>
      </div>

      {/* Champions per regime */}
      <div>
        <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5" /> Current Champions
        </h3>
        <div className="grid md:grid-cols-3 gap-3">
          {regimeIds.map((r) =>
          <ChampionCard key={r} regime={r} champion={state.populations[r].champion} />
          )}
        </div>
      </div>

      {/* Radar comparison + Liquidity density curves */}
      <div className="grid md:grid-cols-2 gap-4">
        <motion.div className="surface-elevated rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <h4 className="text-xs font-semibold text-foreground mb-1">Performance Radar</h4>
          <p className="text-[9px] text-muted-foreground mb-2">Champion metrics across regimes (normalized)</p>
          <RadarMetrics candidates={champions} />
          <div className="flex items-center justify-center gap-4 mt-2">
            {regimeIds.map((r) =>
            <div key={r} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: REGIME_COLORS[r] }} />
                <span className="text-[9px] text-muted-foreground">{REGIME_LABELS[r]}</span>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div className="surface-elevated rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <h4 className="text-xs font-semibold text-foreground mb-1">Champion Liquidity Densities</h4>
          <p className="text-[9px] text-muted-foreground mb-2">Bin weights across log-price domain</p>
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

      {/* Activity log */}
      <motion.div className="surface-elevated rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> Activity Log
        </h4>
        {recentActivity.length === 0 ?
        <p className="text-[10px] text-muted-foreground text-center py-4">No activity yet. Start the engine to begin discovery.</p> :

        <div className="space-y-1 max-h-60 overflow-y-auto">
            {recentActivity.map((entry, i) =>
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
          )}
          </div>
        }
      </motion.div>
    </div>);

}