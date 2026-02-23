import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Area, AreaChart, Legend, Cell } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import { type BacktestResult } from "@/lib/strategy-engine";

interface Props {
  results: BacktestResult[];
}

export default function StrategyResults({ results }: Props) {
  const colors = useChartColors();

  const strategyColors = useMemo(() => {
    const base = [colors.line, colors.green, colors.red];
    return results.map((_, i) => base[i % base.length]);
  }, [results, colors]);

  // Merge equity curves
  const equityData = useMemo(() => {
    if (results.length === 0) return [];
    const days = results[0].equityCurve.length;
    return Array.from({ length: days }, (_, d) => {
      const point: any = { day: d };
      results.forEach((r, i) => {
        point[`s${i}`] = parseFloat(r.equityCurve[d]?.mean.toFixed(2) ?? "0");
        point[`s${i}_p5`] = parseFloat(r.equityCurve[d]?.p5.toFixed(2) ?? "0");
        point[`s${i}_p95`] = parseFloat(r.equityCurve[d]?.p95.toFixed(2) ?? "0");
      });
      return point;
    });
  }, [results]);

  // Rebalance events
  const rebalanceEvents = useMemo(() => {
    return results.flatMap((r, si) => {
      // Sample from first few paths
      const events: { day: number; strategy: string; equity: number; color: string }[] = [];
      const path = r.paths[0];
      if (!path) return events;
      path.snapshots.forEach(snap => {
        if (snap.rebalanced) {
          events.push({ day: snap.day, strategy: r.strategyName, equity: snap.equity, color: strategyColors[si] });
        }
      });
      return events;
    });
  }, [results, strategyColors]);

  const tooltipStyle = { background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10, color: colors.tooltipText };

  if (results.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
        <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-1">No backtest results yet</p>
        <p className="text-[10px] text-muted-foreground">Configure strategies and run a simulation first</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics table */}
      <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Performance Metrics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Metric</th>
                {results.map((r, i) => (
                  <th key={r.strategyId} className="text-right py-2 px-2 font-medium" style={{ color: strategyColors[i] }}>
                    {r.strategyName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Mean Return", key: "meanReturn", fmt: (v: number) => `${v.toFixed(1)}%`, color: true },
                { label: "Median Return", key: "medianReturn", fmt: (v: number) => `${v.toFixed(1)}%`, color: true },
                { label: "Sharpe Ratio", key: "sharpe", fmt: (v: number) => v.toFixed(2), color: false },
                { label: "Max Drawdown", key: "maxDrawdown", fmt: (v: number) => `${v.toFixed(1)}%`, color: false },
                { label: "Win Rate", key: "winRate", fmt: (v: number) => `${v.toFixed(1)}%`, color: false },
                { label: "Avg Rebalances", key: "avgRebalances", fmt: (v: number) => v.toFixed(1), color: false },
                { label: "Avg Fees Earned", key: "totalFeesAvg", fmt: (v: number) => `$${v.toFixed(0)}`, color: false },
                { label: "Avg IL", key: "totalILAvg", fmt: (v: number) => `${v.toFixed(1)}%`, color: false },
                { label: "Net PnL", key: "netPnlAvg", fmt: (v: number) => `${v.toFixed(1)}%`, color: true },
              ].map(row => (
                <tr key={row.label} className="border-b border-border/50">
                  <td className="py-1.5 px-2 text-muted-foreground">{row.label}</td>
                  {results.map((r, i) => {
                    const val = (r as any)[row.key] as number;
                    return (
                      <td key={r.strategyId} className={`text-right py-1.5 px-2 font-mono ${row.color ? (val >= 0 ? "text-success" : "text-destructive") : "text-foreground"}`}>
                        {row.fmt(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Equity curves */}
      <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h4 className="text-xs font-semibold text-foreground mb-3">Equity Curves (Mean ± 5th/95th Percentile)</h4>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityData}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey="day" tick={{ fontSize: 8, fill: colors.tick }} label={{ value: "Day", fontSize: 9, fill: colors.tick }} />
              <YAxis tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {results.map((r, i) => (
                <Area key={`band_${i}`} type="monotone" dataKey={`s${i}_p95`} fill={strategyColors[i]} fillOpacity={0.08} stroke="none" name={`${r.strategyName} 95th`} />
              ))}
              {results.map((r, i) => (
                <Line key={`line_${i}`} type="monotone" dataKey={`s${i}`} stroke={strategyColors[i]} strokeWidth={2} dot={false} name={r.strategyName} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Return distributions */}
      <div className="grid md:grid-cols-2 gap-4">
        {results.map((r, i) => (
          <motion.div key={r.strategyId} className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 + i * 0.05 }}>
            <h4 className="text-xs font-semibold mb-3" style={{ color: strategyColors[i] }}>{r.strategyName} — Return Distribution</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.returnDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                  <XAxis dataKey="bin" tick={{ fontSize: 7, fill: colors.tick }} interval={2} />
                  <YAxis tick={{ fontSize: 8, fill: colors.tick }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {r.returnDist.map((entry, j) => (
                      <Cell key={j} fill={entry.isNeg ? colors.red : strategyColors[i]} fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Rebalance timeline */}
      {rebalanceEvents.length > 0 && (
        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h4 className="text-xs font-semibold text-foreground mb-3">Rebalance Events (Path 1)</h4>
          <div className="flex flex-wrap gap-2">
            {rebalanceEvents.map((e, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary border border-border text-[9px] font-mono">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                <span className="text-foreground">Day {e.day}</span>
                <span className="text-muted-foreground">${e.equity.toFixed(0)}</span>
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
