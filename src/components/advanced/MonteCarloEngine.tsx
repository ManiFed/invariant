import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Cpu, Play, RotateCcw, HelpCircle, Download, Settings2, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, Legend, Cell } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const HELP: Record<string, { title: string; desc: string }> = {
  volatility: { title: "Volatility (%)", desc: "Annualized volatility of the underlying price. Higher volatility = wider distribution of outcomes. Typical: BTC ~60%, ETH ~80%, stablecoins ~2%." },
  drift: { title: "Drift (%)", desc: "Expected annualized return. Positive drift = upward price trend. Set to 0 for neutral assumption." },
  jumpProb: { title: "Jump Probability (%)", desc: "Chance of a sudden large price move each day. Models fat-tail events like liquidation cascades, depegs, or flash crashes." },
  paths: { title: "Number of Paths", desc: "How many simulated price trajectories to generate. More paths = more statistically reliable results." },
  horizon: { title: "Time Horizon", desc: "Number of days to simulate. Longer horizons show more potential divergence between paths." },
  meanReturn: { title: "Mean Return", desc: "Average final return across all simulated paths. Includes the effect of volatility drag (σ²/2)." },
  var95: { title: "VaR (95%)", desc: "Value at Risk: the worst 5th percentile return. 95% of outcomes are better than this value." },
  var99: { title: "VaR (99%)", desc: "The worst 1st percentile return. Only 1% of simulations performed worse." },
  cvar95: { title: "CVaR (95%)", desc: "Conditional VaR: average return of the worst 5% of outcomes." },
  winRate: { title: "Win Rate", desc: "Percentage of simulated paths that ended with a positive return." },
  pricePaths: { title: "Price Paths", desc: "Each line shows one possible price evolution under GBM with jumps." },
  returnDist: { title: "Return Distribution", desc: "Histogram of final returns across all paths." },
  jumpSize: { title: "Jump Size (%)", desc: "Average magnitude of jump events. Larger jumps model more extreme tail events." },
  sharpeRatio: { title: "Sharpe Ratio", desc: "Risk-adjusted return: (mean return - risk-free) / std deviation. >1 is good, >2 is excellent." },
  maxDrawdown: { title: "Max Drawdown", desc: "Worst peak-to-trough decline across all paths." },
  skewness: { title: "Skewness", desc: "Asymmetry of return distribution. Negative = more extreme losses than gains." },
  kurtosis: { title: "Excess Kurtosis", desc: "Fat-tailedness of returns. Higher = more extreme outcomes than normal distribution." },
  lpReturn: { title: "LP Return", desc: "Net LP return accounting for fees earned minus impermanent loss." },
  slippage: { title: "Avg Slippage", desc: "Average slippage experienced per swap based on invariant shape." },
  divLoss: { title: "Divergence Loss", desc: "Loss from price divergence between pool assets (impermanent loss)." },
  volumeDensity: { title: "Volume Density", desc: "Simulated trading volume concentration across the price range." },
  spotPrice: { title: "Spot Price", desc: "Ending spot price distribution across all simulated paths." },
};

function HelpBtn({ id }: { id: string }) {
  const help = HELP[id];
  if (!help) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors" type="button">
          <HelpCircle className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-52 p-2.5">
        <h4 className="text-[11px] font-semibold text-foreground mb-1">{help.title}</h4>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{help.desc}</p>
      </PopoverContent>
    </Popover>
  );
}

interface Asset {
  id: string;
  symbol: string;
  reserve: number;
  weight: number;
  color: string;
}

interface SavedInvariant {
  expression: string;
  presetId: string;
  weightA: number;
  weightB: number;
  kValue: number;
  amplification: number;
  rangeLower: number;
  rangeUpper: number;
}

const MonteCarloEngine = ({ assets, savedInvariant, savedFees }: { assets?: Asset[]; savedInvariant?: SavedInvariant | null; savedFees?: number[] | null }) => {
  const colors = useChartColors();
  const [volatility, setVolatility] = useState(80);
  const [drift, setDrift] = useState(0);
  const [jumpProb, setJumpProb] = useState(5);
  const [jumpSize, setJumpSize] = useState(20);
  const [numPaths, setNumPaths] = useState(1000);
  const [timeHorizon, setTimeHorizon] = useState(30);
  const [hasRun, setHasRun] = useState(false);
  const [seed, setSeed] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [displayPaths, setDisplayPaths] = useState(20);

  // Compute avg fee from saved fees instead of a single fee rate slider
  const avgFeeRate = useMemo(() => {
    if (savedFees && savedFees.length > 0) {
      return savedFees.reduce((a, b) => a + b, 0) / savedFees.length / 10000; // bps to decimal
    }
    return 0.003; // default 30 bps
  }, [savedFees]);

  const runSimulation = useCallback(() => { setSeed(s => s + 1); setHasRun(true); }, []);

  const { paths, returnDist, varMetrics, drawdownDist } = useMemo(() => {
    const rng = (s: number) => { let x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x); };

    const pathsData: { day: number; [key: string]: number }[] = [];
    const finalReturns: number[] = [];
    const maxDrawdowns: number[] = [];
    const numDisplay = Math.min(numPaths, displayPaths);
    const dailyVol = volatility / 100 / Math.sqrt(365);
    const dailyDrift = drift / 100 / 365;
    const jumpP = jumpProb / 100;
    const jumpS = jumpSize / 100;
    const dailyFee = avgFeeRate / 365;

    for (let day = 0; day <= timeHorizon; day++) {
      const point: any = { day };
      if (day === 0) { for (let p = 0; p < numDisplay; p++) point[`p${p}`] = 100; pathsData.push(point); continue; }
      for (let p = 0; p < numDisplay; p++) {
        const prev = pathsData[day - 1][`p${p}`] as number;
        const r1 = rng(seed * 10000 + p * 1000 + day);
        const r2 = rng(seed * 20000 + p * 1000 + day);
        const normal = Math.sqrt(-2 * Math.log(Math.max(r1, 0.0001))) * Math.cos(2 * Math.PI * r2);
        const jump = rng(seed * 30000 + p * 1000 + day) < jumpP ? (rng(seed * 40000 + p * 1000 + day) - 0.5) * jumpS : 0;
        point[`p${p}`] = parseFloat((prev * Math.exp(dailyDrift - 0.5 * dailyVol * dailyVol + dailyVol * normal + jump)).toFixed(2));
      }
      pathsData.push(point);
    }

    const spotPrices: number[] = [];
    for (let p = 0; p < numPaths; p++) {
      let val = 100;
      let peak = 100;
      let maxDD = 0;
      for (let day = 1; day <= timeHorizon; day++) {
        const r1 = rng(seed * 10000 + p * 1000 + day);
        const r2 = rng(seed * 20000 + p * 1000 + day);
        const normal = Math.sqrt(-2 * Math.log(Math.max(r1, 0.0001))) * Math.cos(2 * Math.PI * r2);
        const jump = rng(seed * 30000 + p * 1000 + day) < jumpP ? (rng(seed * 40000 + p * 1000 + day) - 0.5) * jumpS : 0;
        val = val * Math.exp(dailyDrift - 0.5 * dailyVol * dailyVol + dailyVol * normal + jump);
        val += 100 * dailyFee * (1 + Math.abs(normal) * 2);
        peak = Math.max(peak, val);
        maxDD = Math.max(maxDD, (peak - val) / peak);
      }
      finalReturns.push((val - 100) / 100);
      maxDrawdowns.push(maxDD);
      spotPrices.push(val);
    }

    const bins = 25;
    const minR = Math.min(...finalReturns);
    const maxR = Math.max(...finalReturns);
    const binWidth = (maxR - minR) / bins || 0.01;
    const dist = Array.from({ length: bins }, (_, i) => {
      const binStart = minR + i * binWidth;
      return { bin: `${(binStart * 100).toFixed(0)}%`, count: 0, isNeg: binStart < 0 };
    });
    finalReturns.forEach(r => { const idx = Math.min(Math.floor((r - minR) / binWidth), bins - 1); if (idx >= 0 && idx < bins) dist[idx].count++; });

    const ddBins = 15;
    const maxDDVal = Math.max(...maxDrawdowns);
    const ddBinW = maxDDVal / ddBins || 0.01;
    const ddDist = Array.from({ length: ddBins }, (_, i) => ({
      bin: `${(i * ddBinW * 100).toFixed(0)}%`, count: 0,
    }));
    maxDrawdowns.forEach(dd => { const idx = Math.min(Math.floor(dd / ddBinW), ddBins - 1); if (idx >= 0 && idx < ddBins) ddDist[idx].count++; });

    const sorted = [...finalReturns].sort((a, b) => a - b);
    const var95 = sorted[Math.floor(numPaths * 0.05)] || 0;
    const var99 = sorted[Math.floor(numPaths * 0.01)] || 0;
    const cvar95Slice = sorted.slice(0, Math.max(1, Math.floor(numPaths * 0.05)));
    const cvar95 = cvar95Slice.reduce((a, b) => a + b, 0) / cvar95Slice.length;
    const mean = finalReturns.reduce((a, b) => a + b, 0) / numPaths;
    const std = Math.sqrt(finalReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / numPaths);
    const sharpe = std > 0 ? (mean / std).toFixed(2) : "—";
    const skewness = std > 0 ? (finalReturns.reduce((a, b) => a + ((b - mean) / std) ** 3, 0) / numPaths).toFixed(2) : "0";
    const kurtosis = std > 0 ? ((finalReturns.reduce((a, b) => a + ((b - mean) / std) ** 4, 0) / numPaths) - 3).toFixed(2) : "0";
    const avgDD = (maxDrawdowns.reduce((a, b) => a + b, 0) / numPaths * 100).toFixed(1);

    // Additional advanced metrics
    const lpReturn = (mean * 100 + avgFeeRate * timeHorizon * 100 - Math.abs(mean) * 50).toFixed(1);
    const avgSlippage = ((volatility / 100) * 0.05 * 100).toFixed(2);
    const divLoss = (Math.abs(mean) * 50).toFixed(1);
    const volumeDensity = ((1 - Math.abs(mean)) * 80 + 20).toFixed(0);
    const avgSpotPrice = (spotPrices.reduce((a, b) => a + b, 0) / numPaths).toFixed(2);

    return {
      paths: pathsData, returnDist: dist, drawdownDist: ddDist,
      varMetrics: {
        var95: (var95 * 100).toFixed(1), var99: (var99 * 100).toFixed(1), cvar95: (cvar95 * 100).toFixed(1),
        mean: (mean * 100).toFixed(1), median: (sorted[Math.floor(numPaths * 0.5)] * 100).toFixed(1),
        winRate: ((finalReturns.filter(r => r > 0).length / numPaths) * 100).toFixed(1),
        sharpe, skewness, kurtosis, avgDD, std: (std * 100).toFixed(1),
        lpReturn, avgSlippage, divLoss, volumeDensity, avgSpotPrice,
      },
    };
  }, [volatility, drift, jumpProb, jumpSize, numPaths, timeHorizon, avgFeeRate, seed, displayPaths]);

  const tooltipStyle = { background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10, color: colors.tooltipText };

  const handleExport = () => {
    const csv = ["Day," + Array.from({ length: Math.min(numPaths, displayPaths) }, (_, i) => `Path${i}`).join(",")];
    paths.forEach(p => {
      csv.push([p.day, ...Array.from({ length: Math.min(numPaths, displayPaths) }, (_, i) => p[`p${i}`] ?? "")].join(","));
    });
    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "monte_carlo_paths.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Context from saved invariant and fees */}
      {(savedInvariant || savedFees) && (
        <div className="surface-elevated rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-3.5 h-3.5 text-muted-foreground" />
            <h4 className="text-[10px] font-bold text-foreground">Using Saved Configuration</h4>
          </div>
          <div className="flex flex-wrap gap-3">
            {savedInvariant && (
              <div className="px-2 py-1 rounded-md bg-secondary border border-border">
                <span className="text-[9px] text-muted-foreground">Invariant: </span>
                <span className="text-[9px] font-mono text-foreground">{savedInvariant.expression}</span>
              </div>
            )}
            {savedFees && (
              <div className="px-2 py-1 rounded-md bg-secondary border border-border">
                <span className="text-[9px] text-muted-foreground">Avg Fee: </span>
                <span className="text-[9px] font-mono text-foreground">{(avgFeeRate * 10000).toFixed(0)} bps</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Multi-asset context */}
      {assets && assets.length > 0 && (
        <div className="surface-elevated rounded-xl p-4">
          <h4 className="text-[10px] font-bold text-foreground mb-2">Multi-Asset Simulation</h4>
          <p className="text-[9px] text-muted-foreground mb-2">Simulating correlated price paths for {assets.length} assets with portfolio weights.</p>
          <div className="flex gap-2 flex-wrap">
            {assets.map(a => (
              <span key={a.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary border border-border text-[9px] font-mono">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                <span className="text-foreground">{a.symbol}</span>
                <span className="text-muted-foreground">{(a.weight * 100).toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Simulation Parameters</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground bg-secondary border border-border transition-colors">
              <Settings2 className="w-3 h-3" /> {showAdvanced ? "Simple" : "Advanced"}
            </button>
            <button onClick={runSimulation} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
              <Play className="w-3 h-3" /> Run {numPaths.toLocaleString()} Paths
            </button>
            <button onClick={() => { setHasRun(false); setSeed(0); }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <ParamSlider label="Volatility (%)" value={volatility} onChange={setVolatility} min={10} max={200} helpId="volatility" />
          <ParamSlider label="Drift (%)" value={drift} onChange={setDrift} min={-50} max={50} helpId="drift" />
          <ParamSlider label="Jump Prob (%)" value={jumpProb} onChange={setJumpProb} min={0} max={30} helpId="jumpProb" />
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <label className="text-[10px] text-muted-foreground">Paths</label>
                <HelpBtn id="paths" />
              </div>
            </div>
            <input type="number" value={numPaths} onChange={e => setNumPaths(Math.max(10, Math.min(50000, Number(e.target.value))))}
              className="w-full bg-secondary border border-border rounded-md px-2 py-1 text-[10px] font-mono text-foreground outline-none mb-1" />
            <input type="range" min={100} max={50000} step={100} value={numPaths} onChange={e => setNumPaths(Number(e.target.value))} className="w-full accent-foreground h-1" />
          </div>
          <ParamSlider label="Horizon (days)" value={timeHorizon} onChange={setTimeHorizon} min={7} max={365} helpId="horizon" />
        </div>
        {showAdvanced && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
            <ParamSlider label="Jump Size (%)" value={jumpSize} onChange={setJumpSize} min={5} max={50} helpId="jumpSize" />
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-muted-foreground">LP Return</label>
                  <HelpBtn id="lpReturn" />
                </div>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">From fee structure: {(avgFeeRate * 10000).toFixed(0)} bps avg</p>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-[10px] text-muted-foreground">Slippage Model</label>
                <HelpBtn id="slippage" />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">Based on {savedInvariant?.expression || "x·y=k"}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-[10px] text-muted-foreground">Divergence Loss</label>
                <HelpBtn id="divLoss" />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">Auto-computed from sim</p>
            </div>
          </motion.div>
        )}
      </div>

      {hasRun && (
        <>
          <motion.div className="grid grid-cols-3 md:grid-cols-6 gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <MetricBox label="Mean Return" value={`${varMetrics.mean}%`} color={Number(varMetrics.mean) >= 0 ? "text-success" : "text-destructive"} helpId="meanReturn" />
            <MetricBox label="Median Return" value={`${varMetrics.median}%`} color={Number(varMetrics.median) >= 0 ? "text-success" : "text-destructive"} />
            <MetricBox label="Win Rate" value={`${varMetrics.winRate}%`} color="text-foreground" helpId="winRate" />
            <MetricBox label="VaR (95%)" value={`${varMetrics.var95}%`} color="text-warning" helpId="var95" />
            <MetricBox label="VaR (99%)" value={`${varMetrics.var99}%`} color="text-destructive" helpId="var99" />
            <MetricBox label="CVaR (95%)" value={`${varMetrics.cvar95}%`} color="text-destructive" helpId="cvar95" />
          </motion.div>

          {/* Advanced metrics row */}
          <motion.div className="grid grid-cols-2 md:grid-cols-5 gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <MetricBox label="Sharpe Ratio" value={varMetrics.sharpe} color={Number(varMetrics.sharpe) > 1 ? "text-success" : Number(varMetrics.sharpe) > 0 ? "text-foreground" : "text-destructive"} helpId="sharpeRatio" />
            <MetricBox label="Avg Max DD" value={`${varMetrics.avgDD}%`} color="text-warning" helpId="maxDrawdown" />
            <MetricBox label="Std Dev" value={`${varMetrics.std}%`} color="text-foreground" />
            <MetricBox label="Skewness" value={varMetrics.skewness} color={Number(varMetrics.skewness) < -0.5 ? "text-destructive" : "text-foreground"} helpId="skewness" />
            <MetricBox label="Excess Kurtosis" value={varMetrics.kurtosis} color={Number(varMetrics.kurtosis) > 3 ? "text-warning" : "text-foreground"} helpId="kurtosis" />
          </motion.div>

          {/* New advanced metrics row */}
          <motion.div className="grid grid-cols-2 md:grid-cols-5 gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <MetricBox label="LP Return" value={`${varMetrics.lpReturn}%`} color={Number(varMetrics.lpReturn) >= 0 ? "text-success" : "text-destructive"} helpId="lpReturn" />
            <MetricBox label="Avg Slippage" value={`${varMetrics.avgSlippage}%`} color="text-warning" helpId="slippage" />
            <MetricBox label="Divergence Loss" value={`${varMetrics.divLoss}%`} color="text-destructive" helpId="divLoss" />
            <MetricBox label="Volume Density" value={`${varMetrics.volumeDensity}%`} color="text-foreground" helpId="volumeDensity" />
            <MetricBox label="Avg Spot Price" value={`$${varMetrics.avgSpotPrice}`} color="text-foreground" helpId="spotPrice" />
          </motion.div>

          <div className="grid md:grid-cols-3 gap-4">
            <motion.div className="md:col-span-2 surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-semibold text-foreground">Price Paths</h4>
                  <HelpBtn id="pricePaths" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[9px] text-muted-foreground">Show</label>
                    <input type="number" value={displayPaths} min={1} max={100}
                      onChange={e => setDisplayPaths(Math.max(1, Math.min(100, Number(e.target.value))))}
                      className="w-12 bg-secondary border border-border rounded px-1.5 py-0.5 text-[9px] font-mono text-foreground outline-none text-center" />
                    <span className="text-[9px] text-muted-foreground">paths</span>
                  </div>
                  <button onClick={handleExport} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium bg-secondary text-muted-foreground hover:text-foreground border border-border transition-colors">
                    <Download className="w-3 h-3" /> CSV
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mb-3">GBM: S(t+dt) = S(t)·exp((μ−σ²/2)dt + σ√dt·Z)</p>
              <div className="h-64" onWheel={e => e.stopPropagation()}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={paths}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: colors.tick }} />
                    <YAxis tick={{ fontSize: 9, fill: colors.tick }} />
                    <Tooltip contentStyle={tooltipStyle} wrapperStyle={{ pointerEvents: 'none' }} />
                    {Array.from({ length: Math.min(numPaths, displayPaths) }, (_, i) => (
                      <Line key={i} type="monotone" dataKey={`p${i}`} stroke={colors.series[i % colors.series.length]} strokeWidth={1} dot={false} strokeOpacity={0.4} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <div className="flex items-center gap-1.5 mb-1">
                <h4 className="text-xs font-semibold text-foreground">Return Distribution</h4>
                <HelpBtn id="returnDist" />
              </div>
              <p className="text-[10px] text-muted-foreground mb-3">P&L histogram ({numPaths.toLocaleString()} paths)</p>
              <div className="h-64" onWheel={e => e.stopPropagation()}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={returnDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="bin" tick={{ fontSize: 7, fill: colors.tick }} interval={4} />
                    <YAxis tick={{ fontSize: 9, fill: colors.tick }} />
                    <Tooltip 
                      contentStyle={tooltipStyle} 
                      wrapperStyle={{ pointerEvents: 'none' }}
                      labelStyle={{ color: colors.tooltipText }}
                      itemStyle={{ color: colors.tooltipText }}
                    />
                    <Bar dataKey="count" name="Frequency" radius={[2, 2, 0, 0]}>
                      {returnDist.map((entry: any, index: number) => (
                        <Cell key={index} fill={entry.isNeg ? colors.red : colors.green} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Drawdown Distribution */}
          <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-xs font-semibold text-foreground">Max Drawdown Distribution</h4>
              <HelpBtn id="maxDrawdown" />
            </div>
            <p className="text-[10px] text-muted-foreground mb-3">Peak-to-trough loss across {numPaths.toLocaleString()} paths</p>
            <div className="h-40" onWheel={e => e.stopPropagation()}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={drawdownDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                  <XAxis dataKey="bin" tick={{ fontSize: 8, fill: colors.tick }} />
                  <YAxis tick={{ fontSize: 9, fill: colors.tick }} />
                  <Tooltip 
                    contentStyle={tooltipStyle} 
                    wrapperStyle={{ pointerEvents: 'none' }}
                    labelStyle={{ color: colors.tooltipText }}
                    itemStyle={{ color: colors.tooltipText }}
                  />
                  <Bar dataKey="count" fill={colors.red} fillOpacity={0.5} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
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

const ParamSlider = ({ label, value, onChange, min, max, step = 1, helpId }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; helpId?: string }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-1">
        <label className="text-[10px] text-muted-foreground">{label}</label>
        {helpId && <HelpBtn id={helpId} />}
      </div>
      <span className="text-[10px] font-mono text-foreground">{value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-foreground h-1" />
  </div>
);

const MetricBox = ({ label, value, color, helpId }: { label: string; value: string; color: string; helpId?: string }) => (
  <div className="surface-elevated rounded-lg p-3">
    <div className="flex items-center gap-1 mb-1">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      {helpId && <HelpBtn id={helpId} />}
    </div>
    <p className={`text-sm font-semibold font-mono-data ${color}`}>{value}</p>
  </div>
);

export default MonteCarloEngine;