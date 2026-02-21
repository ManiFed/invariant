import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Cpu, Play, RotateCcw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";

const MonteCarloEngine = () => {
  const colors = useChartColors();
  const [volatility, setVolatility] = useState(80);
  const [drift, setDrift] = useState(0);
  const [jumpProb, setJumpProb] = useState(5);
  const [numPaths, setNumPaths] = useState(1000);
  const [timeHorizon, setTimeHorizon] = useState(30);
  const [hasRun, setHasRun] = useState(false);
  const [seed, setSeed] = useState(0);

  const runSimulation = useCallback(() => { setSeed(s => s + 1); setHasRun(true); }, []);

  // GBM: S(t+dt) = S(t) * exp((μ - σ²/2)dt + σ√dt·Z + jump)
  // Box-Muller for normal distribution from uniform RNG
  const { paths, returnDist, varMetrics } = useMemo(() => {
    const rng = (s: number) => { let x = Math.sin(s) * 10000; return x - Math.floor(x); };

    const pathsData: { day: number; [key: string]: number }[] = [];
    const finalReturns: number[] = [];
    const numDisplay = Math.min(numPaths, 20);
    const dailyVol = volatility / 100 / Math.sqrt(365);
    const dailyDrift = drift / 100 / 365;
    const jumpP = jumpProb / 100;

    for (let day = 0; day <= timeHorizon; day++) {
      const point: any = { day };
      if (day === 0) { for (let p = 0; p < numDisplay; p++) point[`p${p}`] = 100; pathsData.push(point); continue; }
      for (let p = 0; p < numDisplay; p++) {
        const prev = pathsData[day - 1][`p${p}`] as number;
        const r1 = rng(seed * 10000 + p * 1000 + day);
        const r2 = rng(seed * 20000 + p * 1000 + day);
        const normal = Math.sqrt(-2 * Math.log(r1 + 0.001)) * Math.cos(2 * Math.PI * r2);
        const jump = rng(seed * 30000 + p * 1000 + day) < jumpP ? (rng(seed * 40000 + p * 1000 + day) - 0.5) * 0.2 : 0;
        point[`p${p}`] = parseFloat((prev * Math.exp(dailyDrift - 0.5 * dailyVol * dailyVol + dailyVol * normal + jump)).toFixed(2));
      }
      pathsData.push(point);
    }

    for (let p = 0; p < numPaths; p++) {
      let val = 100;
      for (let day = 1; day <= timeHorizon; day++) {
        const r1 = rng(seed * 10000 + p * 1000 + day);
        const r2 = rng(seed * 20000 + p * 1000 + day);
        const normal = Math.sqrt(-2 * Math.log(r1 + 0.001)) * Math.cos(2 * Math.PI * r2);
        const jump = rng(seed * 30000 + p * 1000 + day) < jumpP ? (rng(seed * 40000 + p * 1000 + day) - 0.5) * 0.2 : 0;
        val = val * Math.exp(dailyDrift - 0.5 * dailyVol * dailyVol + dailyVol * normal + jump);
      }
      finalReturns.push((val - 100) / 100);
    }

    const bins = 20;
    const minR = Math.min(...finalReturns);
    const maxR = Math.max(...finalReturns);
    const binWidth = (maxR - minR) / bins || 0.01;
    const dist = Array.from({ length: bins }, (_, i) => ({ bin: `${((minR + i * binWidth) * 100).toFixed(0)}%`, count: 0 }));
    finalReturns.forEach(r => { const idx = Math.min(Math.floor((r - minR) / binWidth), bins - 1); if (idx >= 0 && idx < bins) dist[idx].count++; });

    const sorted = [...finalReturns].sort((a, b) => a - b);
    const var95 = sorted[Math.floor(numPaths * 0.05)] || 0;
    const var99 = sorted[Math.floor(numPaths * 0.01)] || 0;
    const cvar95Slice = sorted.slice(0, Math.max(1, Math.floor(numPaths * 0.05)));
    const cvar95 = cvar95Slice.reduce((a, b) => a + b, 0) / cvar95Slice.length;
    const mean = finalReturns.reduce((a, b) => a + b, 0) / numPaths;

    return {
      paths: pathsData, returnDist: dist,
      varMetrics: {
        var95: (var95 * 100).toFixed(1), var99: (var99 * 100).toFixed(1), cvar95: (cvar95 * 100).toFixed(1),
        mean: (mean * 100).toFixed(1), median: (sorted[Math.floor(numPaths * 0.5)] * 100).toFixed(1),
        winRate: ((finalReturns.filter(r => r > 0).length / numPaths) * 100).toFixed(1),
      },
    };
  }, [volatility, drift, jumpProb, numPaths, timeHorizon, seed]);

  const tooltipStyle = { background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10 };

  return (
    <div className="space-y-6">
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Simulation Parameters</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={runSimulation} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
              <Play className="w-3 h-3" /> Run {numPaths.toLocaleString()} Paths
            </button>
            <button onClick={() => { setHasRun(false); setSeed(0); }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <ParamSlider label="Volatility (%)" value={volatility} onChange={setVolatility} min={10} max={200} />
          <ParamSlider label="Drift (%)" value={drift} onChange={setDrift} min={-50} max={50} />
          <ParamSlider label="Jump Prob (%)" value={jumpProb} onChange={setJumpProb} min={0} max={30} />
          <ParamSlider label="Paths" value={numPaths} onChange={setNumPaths} min={100} max={10000} step={100} />
          <ParamSlider label="Horizon (days)" value={timeHorizon} onChange={setTimeHorizon} min={7} max={365} />
        </div>
      </div>

      {hasRun && (
        <>
          <motion.div className="grid grid-cols-3 md:grid-cols-6 gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <MetricBox label="Mean Return" value={`${varMetrics.mean}%`} color={Number(varMetrics.mean) >= 0 ? "text-success" : "text-destructive"} />
            <MetricBox label="Median Return" value={`${varMetrics.median}%`} color={Number(varMetrics.median) >= 0 ? "text-success" : "text-destructive"} />
            <MetricBox label="Win Rate" value={`${varMetrics.winRate}%`} color="text-foreground" />
            <MetricBox label="VaR (95%)" value={`${varMetrics.var95}%`} color="text-warning" />
            <MetricBox label="VaR (99%)" value={`${varMetrics.var99}%`} color="text-destructive" />
            <MetricBox label="CVaR (95%)" value={`${varMetrics.cvar95}%`} color="text-destructive" />
          </motion.div>

          <div className="grid md:grid-cols-3 gap-4">
            <motion.div className="md:col-span-2 surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <h4 className="text-xs font-semibold text-foreground mb-1">Price Paths (sample of 20)</h4>
              <p className="text-[10px] text-muted-foreground mb-3">GBM: S(t+dt) = S(t)·exp((μ−σ²/2)dt + σ√dt·Z)</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={paths}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: colors.tick }} />
                    <YAxis tick={{ fontSize: 9, fill: colors.tick }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    {Array.from({ length: Math.min(numPaths, 20) }, (_, i) => (
                      <Line key={i} type="monotone" dataKey={`p${i}`} stroke={colors.series[i % colors.series.length]} strokeWidth={1} dot={false} strokeOpacity={0.4} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <h4 className="text-xs font-semibold text-foreground mb-1">Return Distribution</h4>
              <p className="text-[10px] text-muted-foreground mb-3">P&L histogram ({numPaths} paths)</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={returnDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="bin" tick={{ fontSize: 8, fill: colors.tick }} interval={3} />
                    <YAxis tick={{ fontSize: 9, fill: colors.tick }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill={colors.line} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </>
      )}

      {!hasRun && (
        <motion.div className="surface-elevated rounded-xl p-12 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Cpu className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Configure parameters and click <span className="text-foreground font-medium">Run</span> to generate simulation</p>
        </motion.div>
      )}
    </div>
  );
};

const ParamSlider = ({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="text-[10px] text-muted-foreground">{label}</label>
      <span className="text-[10px] font-mono text-foreground">{value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-foreground h-1" />
  </div>
);

const MetricBox = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="surface-elevated rounded-lg p-3">
    <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
    <p className={`text-sm font-semibold font-mono-data ${color}`}>{value}</p>
  </div>
);

export default MonteCarloEngine;
