import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Pause, SkipForward, RotateCcw, AlertTriangle, TrendingDown, TrendingUp, Minus, Info, Gauge, BarChart3, GitCompare } from "lucide-react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine, ComposedChart } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { SCENARIOS, replayMarket, type MarketScenario, type ReplayResult } from "@/lib/market-replay-engine";

const categoryColors: Record<string, string> = {
  crash: "text-destructive",
  rally: "text-green-500",
  crab: "text-muted-foreground",
  volatile: "text-warning",
};

const categoryIcons: Record<string, React.ReactNode> = {
  crash: <TrendingDown className="w-3.5 h-3.5" />,
  rally: <TrendingUp className="w-3.5 h-3.5" />,
  crab: <Minus className="w-3.5 h-3.5" />,
  volatile: <AlertTriangle className="w-3.5 h-3.5" />,
};

const SPEEDS = [
  { label: "0.5×", ms: 60 },
  { label: "1×", ms: 30 },
  { label: "2×", ms: 15 },
  { label: "5×", ms: 6 },
  { label: "Max", ms: 1 },
];

export default function MarketReplayLab() {
  const navigate = useNavigate();
  const colors = useChartColors();
  const [designs, setDesigns] = useState<{ id: string; name: string; bins: number[] }[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [compareDesign, setCompareDesign] = useState<string | null>(null);
  const [scenario, setScenario] = useState<MarketScenario>(SCENARIOS[0]);
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [resultB, setResultB] = useState<ReplayResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playHead, setPlayHead] = useState(0);
  const [feeRate, setFeeRate] = useState(0.003);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [compareMode, setCompareMode] = useState(false);
  const [activeView, setActiveView] = useState<"charts" | "risk" | "reserves">("charts");

  useEffect(() => {
    supabase.from("library_amms").select("id, name, bins").then(({ data }) => {
      if (data) {
        const parsed = data.filter(d => d.bins).map(d => ({
          id: d.id, name: d.name,
          bins: (Array.isArray(d.bins) ? d.bins : JSON.parse(d.bins as string)) as number[],
        }));
        setDesigns(parsed);
        if (parsed.length > 0) setSelectedDesign(parsed[0].id);
        if (parsed.length > 1) setCompareDesign(parsed[1].id);
      }
    });
  }, []);

  const runReplay = useCallback(() => {
    const design = designs.find(d => d.id === selectedDesign);
    if (!design) return;
    const res = replayMarket(design.bins, scenario, feeRate);
    setResult(res);
    setPlayHead(res.events.length - 1);
    setPlaying(false);

    if (compareMode && compareDesign) {
      const designB = designs.find(d => d.id === compareDesign);
      if (designB) {
        const resB = replayMarket(designB.bins, scenario, feeRate);
        setResultB(resB);
      }
    } else {
      setResultB(null);
    }
  }, [designs, selectedDesign, compareDesign, scenario, feeRate, compareMode]);

  useEffect(() => {
    if (!playing || !result) return;
    const interval = setInterval(() => {
      setPlayHead(prev => {
        if (prev >= result.events.length - 1) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, SPEEDS[speedIdx].ms);
    return () => clearInterval(interval);
  }, [playing, result, speedIdx]);

  const visibleEvents = result ? result.events.slice(0, playHead + 1) : [];
  const visibleEventsB = resultB ? resultB.events.slice(0, playHead + 1) : [];
  const currentDesign = designs.find(d => d.id === selectedDesign);
  const currentCompare = designs.find(d => d.id === compareDesign);

  // Merged data for comparison charts
  const mergedData = useMemo(() => {
    if (!visibleEvents.length) return [];
    return visibleEvents.map((e, i) => ({
      ...e,
      lpValueB: visibleEventsB[i]?.lpValue,
      feesAccruedB: visibleEventsB[i]?.feesAccrued,
      ilCumulativeB: visibleEventsB[i]?.ilCumulative,
    }));
  }, [visibleEvents, visibleEventsB]);

  // Risk heatmap: rolling 7-day drawdown
  const riskData = useMemo(() => {
    if (!result) return [];
    const window = 7;
    return result.events.map((e, i) => {
      const start = Math.max(0, i - window);
      const windowSlice = result.events.slice(start, i + 1);
      const peak = Math.max(...windowSlice.map(w => w.lpValue));
      const dd = (peak - e.lpValue) / peak;
      const ddB = resultB ? (() => {
        const sliceB = resultB.events.slice(start, i + 1);
        const peakB = Math.max(...sliceB.map(w => w.lpValue));
        return (peakB - resultB.events[i].lpValue) / peakB;
      })() : 0;
      return { day: e.day, drawdown: dd, drawdownB: ddB, price: e.price };
    });
  }, [result, resultB]);

  // Reserves chart data
  const reservesData = useMemo(() => {
    return visibleEvents.map(e => ({
      day: e.day,
      reserveX: e.reserveX,
      reserveY: e.reserveY,
      ratio: e.reserveY / e.reserveX,
    }));
  }, [visibleEvents]);

  const VIEWS = [
    { id: "charts" as const, label: "Performance", icon: BarChart3 },
    { id: "risk" as const, label: "Risk Analysis", icon: Gauge },
    { id: "reserves" as const, label: "Reserves", icon: GitCompare },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/labs")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">MARKET REPLAY</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-warning/30 text-warning">EXPERIMENTAL</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          {/* Sidebar */}
          <div className="space-y-4">
            {/* Design picker */}
            <div className="border border-border rounded-xl p-4 bg-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-foreground">AMM Design</h3>
                <button onClick={() => { setCompareMode(!compareMode); if (compareMode) setResultB(null); }}
                  className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${compareMode ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  <GitCompare className="w-3 h-3 inline mr-1" />Compare
                </button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {designs.map(d => (
                  <button key={d.id} onClick={() => setSelectedDesign(d.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedDesign === d.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}>
                    {d.name}
                  </button>
                ))}
                {designs.length === 0 && <p className="text-[10px] text-muted-foreground">No designs in library</p>}
              </div>
              {compareMode && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] text-muted-foreground mb-1.5">Compare against:</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {designs.filter(d => d.id !== selectedDesign).map(d => (
                      <button key={d.id} onClick={() => setCompareDesign(d.id)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          compareDesign === d.id ? "bg-chart-2 text-white" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}>
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Scenario picker */}
            <div className="border border-border rounded-xl p-4 bg-card">
              <h3 className="text-xs font-bold text-foreground mb-3">Market Scenario</h3>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {SCENARIOS.map(s => (
                  <button key={s.id} onClick={() => setScenario(s)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      scenario.id === s.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                    }`}>
                    <div className="flex items-center gap-2">
                      <span className={scenario.id === s.id ? "" : categoryColors[s.category]}>{categoryIcons[s.category]}</span>
                      <span className="text-xs font-medium">{s.name}</span>
                    </div>
                    <p className="text-[10px] opacity-70 mt-0.5 ml-5">{s.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Fee rate */}
            <div className="border border-border rounded-xl p-4 bg-card">
              <label className="text-xs font-bold text-foreground mb-2 block">Fee Rate: {(feeRate * 100).toFixed(1)}%</label>
              <input type="range" min={0.001} max={0.01} step={0.001} value={feeRate}
                onChange={e => setFeeRate(Number(e.target.value))}
                className="w-full accent-primary" />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>0.1%</span><span>0.5%</span><span>1.0%</span>
              </div>
            </div>

            <button onClick={runReplay} disabled={!selectedDesign}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {compareMode ? "Run Comparison" : "Run Replay"}
            </button>

            {/* Educational tooltips */}
            <div className="border border-border rounded-xl p-3 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-bold text-foreground">How it works</span>
              </div>
              <ul className="text-[9px] text-muted-foreground space-y-1 leading-relaxed">
                <li>• Synthetic prices follow historical regime patterns</li>
                <li>• Bin distribution modulates fee multipliers at each price level</li>
                <li>• IL is calculated vs. a 50/50 HODL baseline</li>
                <li>• Sharpe ratio uses annualized daily returns</li>
                {compareMode && <li>• Comparison runs the same price path through both designs</li>}
              </ul>
            </div>
          </div>

          {/* Main content */}
          <div className="space-y-4">
            {result ? (
              <AnimatePresence mode="wait">
                <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* Playback controls */}
                  <div className="flex items-center gap-3 border border-border rounded-xl p-3 bg-card">
                    <button onClick={() => setPlaying(!playing)} className="p-2 rounded-lg bg-primary text-primary-foreground">
                      {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setPlayHead(Math.min(result.events.length - 1, playHead + 10))} className="p-2 rounded-lg bg-secondary text-foreground">
                      <SkipForward className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setPlayHead(0); setPlaying(false); }} className="p-2 rounded-lg bg-secondary text-foreground">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <input type="range" min={0} max={result.events.length - 1} value={playHead}
                      onChange={e => { setPlayHead(Number(e.target.value)); setPlaying(false); }}
                      className="flex-1 accent-primary" />
                    <div className="flex gap-1">
                      {SPEEDS.map((s, i) => (
                        <button key={s.label} onClick={() => setSpeedIdx(i)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                            speedIdx === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                          }`}>{s.label}</button>
                      ))}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground w-24 text-right">
                      Day {playHead} / {result.events.length - 1}
                    </span>
                  </div>

                  {/* View tabs */}
                  <div className="flex gap-1">
                    {VIEWS.map(v => {
                      const Icon = v.icon;
                      return (
                        <button key={v.id} onClick={() => setActiveView(v.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            activeView === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          }`}>
                          <Icon className="w-3 h-3" />{v.label}
                        </button>
                      );
                    })}
                    {compareMode && resultB && (
                      <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: colors.line }} />{currentDesign?.name}
                        <span className="w-2 h-2 rounded-full bg-chart-2" />{currentCompare?.name}
                      </span>
                    )}
                  </div>

                  {/* Performance Charts */}
                  {activeView === "charts" && (
                    <div className="grid lg:grid-cols-2 gap-4">
                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-2">LP Value vs HODL</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={mergedData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="day" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis tick={{ fontSize: 8, fill: colors.tick }} domain={["auto", "auto"]} />
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                              <Legend wrapperStyle={{ fontSize: 9 }} />
                              <Line type="monotone" dataKey="lpValue" name={compareMode ? `LP (${currentDesign?.name?.slice(0,12)})` : "LP"} stroke={colors.line} strokeWidth={2} dot={false} />
                              {compareMode && resultB && (
                                <Line type="monotone" dataKey="lpValueB" name={`LP (${currentCompare?.name?.slice(0,12)})`} stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                              )}
                              <Line type="monotone" dataKey="hodlValue" name="HODL" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-2">Price — {scenario.name}</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={mergedData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="day" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis tick={{ fontSize: 8, fill: colors.tick }} domain={["auto", "auto"]} />
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                              <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={1.5} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-2">Cumulative Fees vs IL</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={mergedData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="day" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis tick={{ fontSize: 8, fill: colors.tick }} />
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                              <Legend wrapperStyle={{ fontSize: 9 }} />
                              <Area type="monotone" dataKey="feesAccrued" name="Fees (A)" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3) / 0.15)" strokeWidth={1.5} />
                              <Area type="monotone" dataKey="ilCumulative" name="IL (A)" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.1)" strokeWidth={1.5} />
                              {compareMode && resultB && (
                                <>
                                  <Area type="monotone" dataKey="feesAccruedB" name="Fees (B)" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2) / 0.1)" strokeWidth={1.5} strokeDasharray="4 4" />
                                  <Area type="monotone" dataKey="ilCumulativeB" name="IL (B)" stroke="hsl(var(--warning))" fill="hsl(var(--warning) / 0.1)" strokeWidth={1.5} strokeDasharray="4 4" />
                                </>
                              )}
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-2">Daily Volume</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mergedData.filter((_, i) => i % 3 === 0)}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="day" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis tick={{ fontSize: 8, fill: colors.tick }} />
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                              <Bar dataKey="volume" fill="hsl(var(--primary) / 0.6)" radius={[2, 2, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Risk Analysis View */}
                  {activeView === "risk" && (
                    <div className="grid lg:grid-cols-2 gap-4">
                      <div className="border border-border rounded-xl p-4 bg-card lg:col-span-2">
                        <h3 className="text-xs font-bold text-foreground mb-2">Rolling 7-Day Drawdown</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={riskData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="day" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis tick={{ fontSize: 8, fill: colors.tick }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                                formatter={(v: number) => `${(v * 100).toFixed(2)}%`} />
                              <Legend wrapperStyle={{ fontSize: 9 }} />
                              <ReferenceLine y={0.05} stroke="hsl(var(--warning))" strokeDasharray="3 3" label={{ value: "5%", fontSize: 8, fill: "hsl(var(--warning))" }} />
                              <ReferenceLine y={0.2} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ value: "20%", fontSize: 8, fill: "hsl(var(--destructive))" }} />
                              <Area type="monotone" dataKey="drawdown" name={compareMode ? `DD (${currentDesign?.name?.slice(0,10)})` : "Drawdown"} stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.2)" strokeWidth={1.5} />
                              {compareMode && resultB && (
                                <Area type="monotone" dataKey="drawdownB" name={`DD (${currentCompare?.name?.slice(0,10)})`} stroke="hsl(var(--warning))" fill="hsl(var(--warning) / 0.15)" strokeWidth={1.5} />
                              )}
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-3">Risk Metrics</h3>
                        <div className="space-y-2">
                          {[
                            { label: "Max Drawdown", a: result.summary.maxDrawdown, b: resultB?.summary.maxDrawdown, fmt: (v: number) => `${(v * 100).toFixed(1)}%`, bad: (v: number) => v > 0.2 },
                            { label: "Volatility (ann.)", a: result.summary.volatility, b: resultB?.summary.volatility, fmt: (v: number) => `${(v * 100).toFixed(1)}%`, bad: (v: number) => v > 0.5 },
                            { label: "Worst Day", a: result.summary.worstDay, b: resultB?.summary.worstDay, fmt: (v: number) => `${(v * 100).toFixed(1)}%`, bad: () => true },
                            { label: "Sharpe Ratio", a: result.summary.sharpe, b: resultB?.summary.sharpe, fmt: (v: number) => v.toFixed(2), bad: (v: number) => v < 0 },
                            { label: "Recovery Days", a: result.summary.recoveryDays, b: resultB?.summary.recoveryDays, fmt: (v: number) => `${v}d`, bad: (v: number) => v > 30 },
                          ].map(m => (
                            <div key={m.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary text-xs">
                              <span className="text-muted-foreground">{m.label}</span>
                              <div className="flex gap-3">
                                <span className={`font-mono font-bold ${m.bad(m.a) ? "text-destructive" : "text-green-500"}`}>{m.fmt(m.a)}</span>
                                {compareMode && m.b !== undefined && (
                                  <span className={`font-mono font-bold ${m.bad(m.b) ? "text-destructive" : "text-green-500"}`}>{m.fmt(m.b)}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-3">Drawdown Events</h3>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {result.crashEvents.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-4">No significant drawdown events detected</p>}
                          {result.crashEvents.map((c, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary text-xs">
                              <span className="text-foreground font-medium text-[10px]">{c.name}</span>
                              <div className="flex gap-3 text-muted-foreground font-mono text-[10px]">
                                <span>Days {c.startDay}–{c.endDay}</span>
                                <span className="text-destructive">-{(c.drawdown * 100).toFixed(1)}%</span>
                                <span>{c.recovery > 0 ? `${c.recovery}d rec.` : "unrecovered"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reserves View */}
                  {activeView === "reserves" && (
                    <div className="grid lg:grid-cols-2 gap-4">
                      <div className="border border-border rounded-xl p-4 bg-card lg:col-span-2">
                        <h3 className="text-xs font-bold text-foreground mb-2">Reserve Balances Over Time</h3>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={reservesData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="day" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis yAxisId="left" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 8, fill: colors.tick }} />
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                              <Legend wrapperStyle={{ fontSize: 9 }} />
                              <Area yAxisId="left" type="monotone" dataKey="reserveX" name="Reserve X" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3) / 0.15)" strokeWidth={1.5} />
                              <Line yAxisId="right" type="monotone" dataKey="reserveY" name="Reserve Y" stroke="hsl(var(--chart-4))" strokeWidth={1.5} dot={false} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-2">Reserve Ratio (Y/X)</h3>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={reservesData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="day" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis tick={{ fontSize: 8, fill: colors.tick }} domain={["auto", "auto"]} />
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                              <Line type="monotone" dataKey="ratio" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-3">Current State</h3>
                        {visibleEvents.length > 0 && (() => {
                          const last = visibleEvents[visibleEvents.length - 1];
                          return (
                            <div className="space-y-2">
                              {[
                                { label: "Reserve X", value: last.reserveX.toFixed(4) },
                                { label: "Reserve Y", value: last.reserveY.toFixed(2) },
                                { label: "Spot Price", value: `$${last.price.toFixed(2)}` },
                                { label: "LP Value", value: `$${last.lpValue.toFixed(2)}` },
                                { label: "HODL Value", value: `$${last.hodlValue.toFixed(2)}` },
                                { label: "Fees Accrued", value: `$${last.feesAccrued.toFixed(4)}` },
                              ].map(m => (
                                <div key={m.label} className="flex justify-between px-3 py-1.5 rounded-lg bg-secondary text-xs">
                                  <span className="text-muted-foreground">{m.label}</span>
                                  <span className="text-foreground font-mono font-bold">{m.value}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Summary metrics bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {[
                      { label: "Total Return", value: `${(result.summary.totalReturn * 100).toFixed(1)}%`, good: result.summary.totalReturn > 0 },
                      { label: "HODL Return", value: `${(result.summary.hodlReturn * 100).toFixed(1)}%`, good: true },
                      { label: "Total Fees", value: `${(result.summary.totalFees * 100).toFixed(2)}%`, good: true },
                      { label: "Total IL", value: `${(result.summary.totalIL * 100).toFixed(2)}%`, good: result.summary.totalIL < 0.05 },
                      { label: "Win Rate", value: `${(result.summary.winRate * 100).toFixed(0)}%`, good: result.summary.winRate > 0.5 },
                      { label: "Avg Daily Fee", value: `${(result.summary.avgDailyFee * 10000).toFixed(1)} bps`, good: true },
                    ].map(m => (
                      <div key={m.label} className="p-2.5 rounded-lg bg-secondary border border-border text-center">
                        <p className="text-[8px] text-muted-foreground mb-0.5">{m.label}</p>
                        <p className={`text-[11px] font-mono font-bold ${m.good ? "text-green-500" : "text-destructive"}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Comparison summary */}
                  {compareMode && resultB && (
                    <div className="border border-border rounded-xl p-4 bg-card">
                      <h3 className="text-xs font-bold text-foreground mb-3">Head-to-Head Comparison</h3>
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div className="text-muted-foreground font-bold">Metric</div>
                        <div className="font-bold" style={{ color: colors.line }}>{currentDesign?.name?.slice(0,15)}</div>
                        <div className="font-bold text-chart-2">{currentCompare?.name?.slice(0,15)}</div>
                        {[
                          { label: "Return", a: result.summary.totalReturn, b: resultB.summary.totalReturn, fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
                          { label: "Fees", a: result.summary.totalFees, b: resultB.summary.totalFees, fmt: (v: number) => `${(v * 100).toFixed(2)}%` },
                          { label: "Max DD", a: result.summary.maxDrawdown, b: resultB.summary.maxDrawdown, fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
                          { label: "Sharpe", a: result.summary.sharpe, b: resultB.summary.sharpe, fmt: (v: number) => v.toFixed(2) },
                          { label: "Win Rate", a: result.summary.winRate, b: resultB.summary.winRate, fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
                        ].map(row => (
                          <React.Fragment key={row.label}>
                            <div className="text-muted-foreground py-1">{row.label}</div>
                            <div className={`font-mono font-bold py-1 ${row.a >= row.b ? "text-green-500" : "text-muted-foreground"}`}>{row.fmt(row.a)}</div>
                            <div className={`font-mono font-bold py-1 ${row.b >= row.a ? "text-green-500" : "text-muted-foreground"}`}>{row.fmt(row.b)}</div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="border border-border rounded-xl p-12 bg-card text-center">
                <p className="text-sm text-muted-foreground">Select an AMM design and market scenario, then click <strong>Run Replay</strong> to see how your invariant would have performed.</p>
                <p className="text-xs text-muted-foreground/60 mt-2">Simulated prices based on historical market regime characteristics.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
