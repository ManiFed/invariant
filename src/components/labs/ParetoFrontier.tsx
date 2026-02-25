import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, Cell } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import type { EngineState, Candidate, RegimeId } from "@/lib/discovery-engine";

const METRIC_OPTIONS = [
  { key: "totalFees", label: "Fees", higher: true },
  { key: "totalSlippage", label: "Slippage", higher: false },
  { key: "arbLeakage", label: "Arb Leakage", higher: false },
  { key: "liquidityUtilization", label: "Utilization", higher: true },
  { key: "lpValueVsHodl", label: "LP/HODL", higher: true },
  { key: "maxDrawdown", label: "Max Drawdown", higher: false },
  { key: "volatilityOfReturns", label: "Volatility", higher: false },
] as const;

type MetricKey = typeof METRIC_OPTIONS[number]["key"];

const REGIME_COLORS: Record<RegimeId, string> = {
  "low-vol": "hsl(142, 72%, 45%)",
  "high-vol": "hsl(38, 92%, 50%)",
  "jump-diffusion": "hsl(0, 72%, 55%)",
  "regime-shift": "hsl(270, 65%, 55%)",
};

interface ParetoFrontierProps {
  state: EngineState;
  onSelectCandidate: (id: string) => void;
}

function isDominated(c: Candidate, others: Candidate[], xKey: MetricKey, yKey: MetricKey, xHigher: boolean, yHigher: boolean): boolean {
  const cx = (c.metrics as any)[xKey];
  const cy = (c.metrics as any)[yKey];
  return others.some(o => {
    if (o.id === c.id) return false;
    const ox = (o.metrics as any)[xKey];
    const oy = (o.metrics as any)[yKey];
    const xBetter = xHigher ? ox >= cx : ox <= cx;
    const yBetter = yHigher ? oy >= cy : oy <= cy;
    const xStrictly = xHigher ? ox > cx : ox < cx;
    const yStrictly = yHigher ? oy > cy : oy < cy;
    return xBetter && yBetter && (xStrictly || yStrictly);
  });
}

export default function ParetoFrontier({ state, onSelectCandidate }: ParetoFrontierProps) {
  const chartColors = useChartColors();
  const [xMetric, setXMetric] = useState<MetricKey>("totalFees");
  const [yMetric, setYMetric] = useState<MetricKey>("totalSlippage");
  const [regimeFilter, setRegimeFilter] = useState<RegimeId | "all">("all");
  const [showDominated, setShowDominated] = useState(true);
  const [pointScale, setPointScale] = useState<"uniform" | "score">("score");
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const xOption = METRIC_OPTIONS.find(m => m.key === xMetric)!;
  const yOption = METRIC_OPTIONS.find(m => m.key === yMetric)!;

  const { points, paretoCount, dominatedCount } = useMemo(() => {
    const filtered = regimeFilter === "all"
      ? state.archive
      : state.archive.filter(c => c.regime === regimeFilter);

    // Sample for performance
    const sampled = filtered.length > 500
      ? filtered.sort((a, b) => a.score - b.score).slice(0, 500)
      : filtered;

    const pts = sampled.map(c => {
      const dominated = isDominated(c, sampled, xMetric, yMetric, xOption.higher, yOption.higher);
      return {
        x: (c.metrics as any)[xMetric],
        y: (c.metrics as any)[yMetric],
        id: c.id,
        regime: c.regime,
        score: c.score,
        dominated,
        familyId: c.familyId,
        size: pointScale === "uniform" ? 40 : Math.max(24, 90 - c.score * 20),
      };
    });

    const pareto = pts.filter(p => !p.dominated);
    return {
      points: pts,
      paretoCount: pareto.length,
      dominatedCount: pts.length - pareto.length,
    };
  }, [state.archive, xMetric, yMetric, regimeFilter, xOption.higher, yOption.higher, pointScale]);

  const nonDominated = points.filter(p => !p.dominated);
  const dominated = points.filter(p => p.dominated);
  const topFrontier = [...nonDominated].sort((a, b) => a.score - b.score).slice(0, 6);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div className="p-2 rounded-lg border border-border bg-popover text-popover-foreground text-[10px] space-y-0.5">
        <p className="font-semibold">{d.familyId}</p>
        <p>{xOption.label}: {d.x?.toFixed(4)}</p>
        <p>{yOption.label}: {d.y?.toFixed(4)}</p>
        <p>Score: {d.score?.toFixed(3)}</p>
        <p className={d.dominated ? "text-muted-foreground" : "text-success font-bold"}>
          {d.dominated ? "Dominated" : "✦ Pareto Optimal"}
        </p>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Pareto Frontier</h3>
          <p className="text-[10px] text-muted-foreground">
            Multi-objective trade-off surface — {paretoCount} non-dominated, {dominatedCount} dominated
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={regimeFilter}
            onChange={e => setRegimeFilter(e.target.value as RegimeId | "all")}
            className="text-[10px] px-2 py-1 rounded border border-border bg-background"
          >
            <option value="all">All Regimes</option>
            <option value="low-vol">Low Vol</option>
            <option value="high-vol">High Vol</option>
            <option value="jump-diffusion">Jump Diff</option>
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <label className="text-[9px] text-muted-foreground block mb-1">X Axis</label>
          <select
            value={xMetric}
            onChange={e => setXMetric(e.target.value as MetricKey)}
            className="text-[10px] px-2 py-1.5 rounded border border-border bg-background w-full"
          >
            {METRIC_OPTIONS.map(m => (
              <option key={m.key} value={m.key}>{m.label} {m.higher ? "↑" : "↓"}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground block mb-1">Y Axis</label>
          <select
            value={yMetric}
            onChange={e => setYMetric(e.target.value as MetricKey)}
            className="text-[10px] px-2 py-1.5 rounded border border-border bg-background w-full"
          >
            {METRIC_OPTIONS.map(m => (
              <option key={m.key} value={m.key}>{m.label} {m.higher ? "↑" : "↓"}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowDominated(v => !v)}
          className="text-[10px] px-2 py-1.5 rounded border border-border bg-background mt-4 md:mt-0"
        >
          {showDominated ? "Hide" : "Show"} dominated points
        </button>
        <button
          onClick={() => setPointScale(v => v === "uniform" ? "score" : "uniform")}
          className="text-[10px] px-2 py-1.5 rounded border border-border bg-background mt-4 md:mt-0"
        >
          Point size: {pointScale === "score" ? "by quality" : "uniform"}
        </button>
      </div>

      <div className="surface-elevated rounded-xl p-4 border border-primary/20 shadow-[0_0_20px_hsl(var(--primary)/0.08)]">
        <div className="h-[26rem]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis
                type="number" dataKey="x" name={xOption.label}
                tick={{ fontSize: 8, fill: chartColors.tick }}
                label={{ value: xOption.label, position: "insideBottom", offset: -10, fontSize: 9, fill: chartColors.tick }}
              />
              <YAxis
                type="number" dataKey="y" name={yOption.label}
                tick={{ fontSize: 8, fill: chartColors.tick }}
                label={{ value: yOption.label, angle: -90, position: "insideLeft", offset: -5, fontSize: 9, fill: chartColors.tick }}
              />
              <ZAxis dataKey="size" range={[20, 140]} />
              <Tooltip content={<CustomTooltip />} />
              {showDominated && <Scatter name="Dominated" data={dominated} fill={chartColors.grid} fillOpacity={0.22} onClick={(d: any) => d?.id && onSelectCandidate(d.id)} cursor="pointer" />}
              <Scatter
                name="Pareto Front"
                data={nonDominated}
                fillOpacity={0.9}
                onClick={(d: any) => d?.id && onSelectCandidate(d.id)}
                onMouseOver={(d: any) => setHighlightId(d?.id ?? null)}
                cursor="pointer"
              >
                {nonDominated.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={REGIME_COLORS[entry.regime as RegimeId] || chartColors.tick}
                    stroke={highlightId === entry.id ? "hsl(var(--foreground))" : "transparent"}
                    strokeWidth={highlightId === entry.id ? 2 : 0}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="surface-elevated rounded-lg p-3 border border-border">
          <p className="text-[10px] text-muted-foreground mb-2">Frontier leaders (click to inspect)</p>
          <div className="space-y-1.5">
            {topFrontier.map((point) => (
              <button key={point.id} onClick={() => onSelectCandidate(point.id)} className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded border border-border hover:border-primary/40 hover:bg-primary/5">
                <span className="text-[10px] font-medium">{point.familyId}</span>
                <span className="text-[10px] text-muted-foreground">score {point.score.toFixed(3)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="surface-elevated rounded-lg p-3 border border-border text-[10px] text-muted-foreground space-y-1.5">
          <p><span className="text-foreground font-semibold">Tip:</span> switch axes to expose non-optimized pathways.</p>
          <p>Pareto points are color-coded by regime, and larger points indicate stronger aggregate performance.</p>
          <p>Click any point to jump into Design Detail for deeper inspection and replay.</p>
        </div>
      </div>

      <div className="flex gap-4 text-[9px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span>Pareto Optimal (non-dominated)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
          <span>Dominated</span>
        </div>
      </div>
    </motion.div>
  );
}
