import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Pause, SkipForward, RotateCcw, AlertTriangle, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
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

export default function MarketReplayLab() {
  const navigate = useNavigate();
  const colors = useChartColors();
  const [designs, setDesigns] = useState<{ id: string; name: string; bins: number[] }[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [scenario, setScenario] = useState<MarketScenario>(SCENARIOS[0]);
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playHead, setPlayHead] = useState(0);
  const [feeRate, setFeeRate] = useState(0.003);

  // Load library designs
  useEffect(() => {
    supabase.from("library_amms").select("id, name, bins").then(({ data }) => {
      if (data) {
        const parsed = data.filter(d => d.bins).map(d => ({
          id: d.id,
          name: d.name,
          bins: (Array.isArray(d.bins) ? d.bins : JSON.parse(d.bins as string)) as number[],
        }));
        setDesigns(parsed);
        if (parsed.length > 0) setSelectedDesign(parsed[0].id);
      }
    });
  }, []);

  const runReplay = useCallback(() => {
    const design = designs.find(d => d.id === selectedDesign);
    if (!design) return;
    const res = replayMarket(design.bins, scenario, feeRate);
    setResult(res);
    setPlayHead(0);
    setPlaying(false);
  }, [designs, selectedDesign, scenario, feeRate]);

  // Playback animation
  useEffect(() => {
    if (!playing || !result) return;
    const interval = setInterval(() => {
      setPlayHead(prev => {
        if (prev >= result.events.length - 1) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [playing, result]);

  const visibleEvents = result ? result.events.slice(0, playHead + 1) : [];
  const currentDesign = designs.find(d => d.id === selectedDesign);

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
        {/* Controls */}
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar */}
          <div className="space-y-4">
            {/* Design picker */}
            <div className="border border-border rounded-xl p-4 bg-card">
              <h3 className="text-xs font-bold text-foreground mb-3">AMM Design</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
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
            </div>

            {/* Scenario picker */}
            <div className="border border-border rounded-xl p-4 bg-card">
              <h3 className="text-xs font-bold text-foreground mb-3">Market Scenario</h3>
              <div className="space-y-1.5">
                {SCENARIOS.map(s => (
                  <button key={s.id} onClick={() => setScenario(s)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      scenario.id === s.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                    }`}>
                    <div className="flex items-center gap-2">
                      <span className={categoryColors[s.category]}>{categoryIcons[s.category]}</span>
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
            </div>

            <button onClick={runReplay} disabled={!selectedDesign}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
              Run Replay
            </button>
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
                    <span className="text-[10px] font-mono text-muted-foreground w-20 text-right">
                      Day {playHead} / {result.events.length - 1}
                    </span>
                  </div>

                  {/* Charts */}
                  <div className="grid lg:grid-cols-2 gap-4">
                    {/* LP vs HODL */}
                    <div className="border border-border rounded-xl p-4 bg-card">
                      <h3 className="text-xs font-bold text-foreground mb-2">LP Value vs HODL</h3>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={visibleEvents}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="day" tick={{ fontSize: 8, fill: colors.tick }} />
                            <YAxis tick={{ fontSize: 8, fill: colors.tick }} domain={["auto", "auto"]} />
                            <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                            <Legend wrapperStyle={{ fontSize: 9 }} />
                            <Line type="monotone" dataKey="lpValue" name="LP" stroke={colors.line} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="hodlValue" name="HODL" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="border border-border rounded-xl p-4 bg-card">
                      <h3 className="text-xs font-bold text-foreground mb-2">Price — {scenario.name}</h3>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={visibleEvents}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="day" tick={{ fontSize: 8, fill: colors.tick }} />
                            <YAxis tick={{ fontSize: 8, fill: colors.tick }} domain={["auto", "auto"]} />
                            <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                            <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={1.5} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Fees & IL */}
                    <div className="border border-border rounded-xl p-4 bg-card">
                      <h3 className="text-xs font-bold text-foreground mb-2">Cumulative Fees vs IL</h3>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={visibleEvents}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="day" tick={{ fontSize: 8, fill: colors.tick }} />
                            <YAxis tick={{ fontSize: 8, fill: colors.tick }} />
                            <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                            <Legend wrapperStyle={{ fontSize: 9 }} />
                            <Area type="monotone" dataKey="feesAccrued" name="Fees" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.15)" strokeWidth={1.5} />
                            <Area type="monotone" dataKey="ilCumulative" name="IL" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.1)" strokeWidth={1.5} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Volume */}
                    <div className="border border-border rounded-xl p-4 bg-card">
                      <h3 className="text-xs font-bold text-foreground mb-2">Daily Volume</h3>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={visibleEvents.filter((_, i) => i % 3 === 0)}>
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

                  {/* Summary metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {[
                      { label: "Total Return", value: `${(result.summary.totalReturn * 100).toFixed(1)}%`, good: result.summary.totalReturn > 0 },
                      { label: "HODL Return", value: `${(result.summary.hodlReturn * 100).toFixed(1)}%`, good: true },
                      { label: "Total Fees", value: `${(result.summary.totalFees * 100).toFixed(2)}%`, good: true },
                      { label: "Total IL", value: `${(result.summary.totalIL * 100).toFixed(2)}%`, good: result.summary.totalIL < 0.05 },
                      { label: "Max Drawdown", value: `${(result.summary.maxDrawdown * 100).toFixed(1)}%`, good: result.summary.maxDrawdown < 0.2 },
                      { label: "Sharpe", value: result.summary.sharpe.toFixed(2), good: result.summary.sharpe > 0.5 },
                      { label: "Win Rate", value: `${(result.summary.winRate * 100).toFixed(0)}%`, good: result.summary.winRate > 0.5 },
                      { label: "Volatility", value: `${(result.summary.volatility * 100).toFixed(1)}%`, good: result.summary.volatility < 0.5 },
                      { label: "Worst Day", value: `${(result.summary.worstDay * 100).toFixed(1)}%`, good: false },
                      { label: "Best Day", value: `${(result.summary.bestDay * 100).toFixed(1)}%`, good: true },
                      { label: "Avg Daily Fee", value: `${(result.summary.avgDailyFee * 10000).toFixed(1)} bps`, good: true },
                      { label: "Recovery Days", value: `${result.summary.recoveryDays}d`, good: result.summary.recoveryDays < 30 },
                    ].map(m => (
                      <div key={m.label} className="p-2.5 rounded-lg bg-secondary border border-border text-center">
                        <p className="text-[8px] text-muted-foreground mb-0.5">{m.label}</p>
                        <p className={`text-[11px] font-mono font-bold ${m.good ? "text-green-500" : "text-destructive"}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Crash events */}
                  {result.crashEvents.length > 0 && (
                    <div className="border border-border rounded-xl p-4 bg-card">
                      <h3 className="text-xs font-bold text-foreground mb-2">Drawdown Events</h3>
                      <div className="space-y-1.5">
                        {result.crashEvents.map((c, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary text-xs">
                            <span className="text-foreground font-medium">{c.name}</span>
                            <div className="flex gap-4 text-muted-foreground font-mono">
                              <span>Days {c.startDay}–{c.endDay}</span>
                              <span className="text-destructive">-{(c.drawdown * 100).toFixed(1)}%</span>
                              <span>{c.recovery > 0 ? `${c.recovery}d recovery` : "unrecovered"}</span>
                            </div>
                          </div>
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
