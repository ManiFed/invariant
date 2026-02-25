import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from "recharts";
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
      };
    });

    const pareto = pts.filter(p => !p.dominated);
    return {
      points: pts,
      paretoCount: pareto.length,
      dominatedCount: pts.length - pareto.length,
    };
  }, [state.archive, xMetric, yMetric, regimeFilter, xOption.higher, yOption.higher]);

  const nonDominated = points.filter(p => !p.dominated);
  const dominated = points.filter(p => p.dominated);

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

      <div className="grid grid-cols-2 gap-3">
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
      </div>

      <div className="surface-elevated rounded-xl p-4">
        <div className="h-80">
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
              <ZAxis range={[20, 20]} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter
                name="Dominated"
                data={dominated}
                fill={chartColors.grid}
                fillOpacity={0.3}
                onClick={(d: any) => d?.id && onSelectCandidate(d.id)}
                cursor="pointer"
              />
              <Scatter
                name="Pareto Front"
                data={nonDominated}
                fillOpacity={0.9}
                onClick={(d: any) => d?.id && onSelectCandidate(d.id)}
                cursor="pointer"
              >
                {nonDominated.map((entry, index) => (
                  <rect key={index} fill={REGIME_COLORS[entry.regime as RegimeId] || chartColors.tick} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
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
