import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Download, Settings, Activity, TrendingUp, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import ThemeToggle from "@/components/ThemeToggle";
import BotBlockEditor from "@/components/apps/BotBlockEditor";
import { type BotProgram, BOT_TEMPLATES } from "@/lib/bot-blocks";
import {
  createSimState, stepSimulation, defaultMarketConfig, defaultPoolConfig,
  type SimState, type SimConfig, type MarketType, type MarketConfig, type PoolConfig,
} from "@/lib/testnet-engine";
import { useNavigate } from "react-router-dom";

const MARKET_TYPES: { value: MarketType; label: string; description: string }[] = [
  { value: "token_swap", label: "Token Swap", description: "ETH/USDC style — GBM price path" },
  { value: "prediction", label: "Prediction Market", description: "Binary outcome converging to 0 or 1" },
  { value: "stablecoin", label: "Stablecoin Pool", description: "Mean-reverting peg around $1" },
  { value: "custom", label: "Custom", description: "Full control over all parameters" },
];

export default function Applications() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"setup" | "bots" | "dashboard">("setup");

  // Market config
  const [marketType, setMarketType] = useState<MarketType>("token_swap");
  const [marketConfig, setMarketConfig] = useState<MarketConfig>(defaultMarketConfig("token_swap"));
  const [poolConfig, setPoolConfig] = useState<PoolConfig>(defaultPoolConfig(defaultMarketConfig("token_swap")));
  const [duration, setDuration] = useState(500);
  const [speed, setSpeed] = useState(20);

  // Bots
  const [bots, setBots] = useState<BotProgram[]>([
    BOT_TEMPLATES[0].create(), // noise
    BOT_TEMPLATES[1].create(), // arb
  ]);

  // Simulation
  const [simState, setSimState] = useState<SimState | null>(null);
  const [running, setRunning] = useState(false);
  const rafRef = useRef<number>(0);
  const stateRef = useRef<SimState | null>(null);

  const handleMarketTypeChange = (type: MarketType) => {
    setMarketType(type);
    const mc = defaultMarketConfig(type);
    setMarketConfig(mc);
    setPoolConfig(defaultPoolConfig(mc));
  };

  const initSim = useCallback(() => {
    const config: SimConfig = { market: marketConfig, pool: poolConfig, durationTicks: duration, ticksPerSecond: speed };
    const state = createSimState(config, bots);
    setSimState(state);
    stateRef.current = state;
    setRunning(false);
  }, [marketConfig, poolConfig, duration, speed, bots]);

  const startSim = useCallback(() => {
    if (!stateRef.current) {
      const config: SimConfig = { market: marketConfig, pool: poolConfig, durationTicks: duration, ticksPerSecond: speed };
      const state = createSimState(config, bots);
      stateRef.current = state;
      setSimState(state);
    }
    setRunning(true);
    setTab("dashboard");
  }, [marketConfig, poolConfig, duration, speed, bots]);

  const stopSim = useCallback(() => {
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const resetSim = useCallback(() => {
    stopSim();
    stateRef.current = null;
    setSimState(null);
  }, [stopSim]);

  // Simulation loop
  useEffect(() => {
    if (!running) return;
    let lastTime = 0;
    const tickInterval = 1000 / speed;

    const loop = (timestamp: number) => {
      if (!stateRef.current || !running) return;
      if (timestamp - lastTime >= tickInterval) {
        lastTime = timestamp;
        if (stateRef.current.tick >= duration) {
          setRunning(false);
          return;
        }
        const next = stepSimulation(stateRef.current, bots);
        stateRef.current = next;
        // Update React state every few ticks for perf
        if (next.tick % 3 === 0 || next.tick >= duration) {
          setSimState({ ...next });
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running, speed, duration, bots]);

  // Chart data (last 200 points)
  const chartData = simState?.history.slice(-200).map(h => ({
    tick: h.tick,
    pool: +h.poolPrice.toFixed(4),
    external: +h.externalPrice.toFixed(4),
  })) || [];

  const feeData = simState?.history.slice(-200).map(h => ({
    tick: h.tick,
    fees: +h.totalFees.toFixed(2),
  })) || [];

  // Bot leaderboard
  const botLeaderboard = simState?.bots
    .map(b => ({ ...b }))
    .sort((a, b) => b.pnlPct - a.pnlPct) || [];

  const recentTrades = simState?.trades.slice(-20).reverse() || [];

  // Export
  const exportResults = () => {
    if (!simState) return;
    const data = {
      ticks: simState.tick,
      totalVolume: simState.totalVolume,
      totalFees: simState.pool.totalFees,
      finalPoolPrice: simState.history[simState.history.length - 1]?.poolPrice,
      bots: simState.bots.map(b => ({ name: b.name, pnlPct: b.pnlPct, trades: b.tradeCount, capital: b.holdingsX * (simState.history[simState.history.length - 1]?.poolPrice || 0) + b.holdingsY })),
      priceHistory: simState.history.map(h => ({ tick: h.tick, pool: h.poolPrice, external: h.externalPrice })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `testnet-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-sm font-bold tracking-tight text-foreground hover:opacity-70 transition-opacity">
            INVARIANT STUDIO
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-semibold text-foreground">Applications</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Sim controls */}
          {simState && (
            <div className="flex items-center gap-1.5 mr-3">
              <span className="text-[10px] font-mono text-muted-foreground">
                Tick {simState.tick}/{duration}
              </span>
              <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${(simState.tick / duration) * 100}%` }} />
              </div>
            </div>
          )}
          <button onClick={running ? stopSim : startSim}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${running ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
            {running ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> {simState ? "Resume" : "Start"}</>}
          </button>
          <button onClick={resetSim} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Reset">
            <RotateCcw className="w-4 h-4" />
          </button>
          {simState && (
            <button onClick={exportResults} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Export JSON">
              <Download className="w-4 h-4" />
            </button>
          )}
          <ThemeToggle />
        </div>
      </nav>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-border bg-secondary/30">
        {[
          { id: "setup" as const, label: "Market Setup", icon: Settings },
          { id: "bots" as const, label: "Bot Builder", icon: Zap },
          { id: "dashboard" as const, label: "Live Dashboard", icon: Activity },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* SETUP TAB */}
        {tab === "setup" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Market type */}
            <div className="surface-elevated rounded-xl p-4">
              <h3 className="text-xs font-semibold text-foreground mb-3">Market Type</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {MARKET_TYPES.map(mt => (
                  <button key={mt.value} onClick={() => handleMarketTypeChange(mt.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${marketType === mt.value ? "border-primary bg-primary/5" : "border-border hover:border-foreground/20"}`}>
                    <p className="text-xs font-semibold text-foreground">{mt.label}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{mt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Market parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="surface-elevated rounded-xl p-4">
                <h3 className="text-xs font-semibold text-foreground mb-3">Market Parameters</h3>
                <div className="space-y-2">
                  <ParamRow label="Initial Price" value={marketConfig.initialPrice} unit="$"
                    onChange={v => setMarketConfig({ ...marketConfig, initialPrice: v })} min={0.001} max={100000} step={0.01} />
                  <ParamRow label="Volatility" value={marketConfig.volatility} unit="%"
                    onChange={v => setMarketConfig({ ...marketConfig, volatility: v })} min={0} max={500} step={1} />
                  <ParamRow label="Drift" value={marketConfig.drift} unit="%"
                    onChange={v => setMarketConfig({ ...marketConfig, drift: v })} min={-100} max={100} step={1} />
                  <ParamRow label="Jump Probability" value={marketConfig.jumpProb} unit="%"
                    onChange={v => setMarketConfig({ ...marketConfig, jumpProb: v })} min={0} max={50} step={0.5} />
                  <ParamRow label="Jump Size" value={marketConfig.jumpSize} unit="%"
                    onChange={v => setMarketConfig({ ...marketConfig, jumpSize: v })} min={0} max={50} step={0.5} />
                  {marketType === "stablecoin" && (
                    <ParamRow label="Mean Reversion Speed" value={marketConfig.meanRevSpeed}
                      onChange={v => setMarketConfig({ ...marketConfig, meanRevSpeed: v })} min={0} max={1} step={0.01} />
                  )}
                  {marketType === "prediction" && (
                    <>
                      <ParamRow label="Expiry (ticks)" value={marketConfig.expiryTicks}
                        onChange={v => setMarketConfig({ ...marketConfig, expiryTicks: v })} min={10} max={10000} step={10} />
                      <ParamRow label="Target Price" value={marketConfig.customTarget} unit="$"
                        onChange={v => setMarketConfig({ ...marketConfig, customTarget: v })} min={0} max={100000} step={0.01} />
                    </>
                  )}
                </div>
              </div>

              <div className="surface-elevated rounded-xl p-4">
                <h3 className="text-xs font-semibold text-foreground mb-3">Pool & Simulation</h3>
                <div className="space-y-2">
                  <ParamRow label="Reserve X" value={poolConfig.reserveX}
                    onChange={v => setPoolConfig({ ...poolConfig, reserveX: v })} min={0.01} max={10000000} step={10} />
                  <ParamRow label="Reserve Y" value={poolConfig.reserveY} unit="$"
                    onChange={v => setPoolConfig({ ...poolConfig, reserveY: v })} min={1} max={10000000} step={100} />
                  <ParamRow label="Fee Rate" value={poolConfig.feeRate}
                    onChange={v => setPoolConfig({ ...poolConfig, feeRate: v })} min={0} max={0.1} step={0.0005} />
                  <ParamRow label="Duration (ticks)" value={duration}
                    onChange={setDuration} min={50} max={10000} step={50} />
                  <ParamRow label="Speed (ticks/sec)" value={speed}
                    onChange={setSpeed} min={1} max={100} step={1} />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* BOTS TAB */}
        {tab === "bots" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <BotBlockEditor bots={bots} onBotsChange={setBots} />
          </motion.div>
        )}

        {/* DASHBOARD TAB */}
        {tab === "dashboard" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {!simState ? (
              <div className="surface-elevated rounded-xl p-12 text-center">
                <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Press <strong>Start</strong> to begin the simulation</p>
              </div>
            ) : (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <StatCard label="Pool Price" value={`$${(simState.history[simState.history.length - 1]?.poolPrice || 0).toFixed(4)}`} />
                  <StatCard label="External Price" value={`$${simState.externalPrice.toFixed(4)}`} />
                  <StatCard label="Total Volume" value={`$${simState.totalVolume.toFixed(0)}`} />
                  <StatCard label="Pool Fees" value={`$${simState.pool.totalFees.toFixed(2)}`} />
                  <StatCard label="Total Trades" value={`${simState.trades.length}`} />
                </div>

                {/* Price chart */}
                <div className="surface-elevated rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-foreground mb-3">Price Chart</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                        <XAxis dataKey="tick" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 10 }} />
                        <Line type="monotone" dataKey="pool" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} name="Pool Price" />
                        <Line type="monotone" dataKey="external" stroke="hsl(var(--muted-foreground))" dot={false} strokeWidth={1} strokeDasharray="4 4" name="External" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bot Leaderboard */}
                  <div className="surface-elevated rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3">Bot P&L Leaderboard</h3>
                    <div className="space-y-1.5">
                      {botLeaderboard.map((b, i) => (
                        <div key={b.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-secondary/50">
                          <span className="text-[10px] font-mono text-muted-foreground w-4">{i + 1}</span>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                          <span className="text-[10px] font-medium text-foreground flex-1">{b.name}</span>
                          <span className={`text-[10px] font-mono font-semibold ${b.pnlPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {b.pnlPct >= 0 ? "+" : ""}{b.pnlPct.toFixed(2)}%
                          </span>
                          <span className="text-[9px] text-muted-foreground">{b.tradeCount} trades</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Trades */}
                  <div className="surface-elevated rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3">Recent Trades</h3>
                    <div className="space-y-0.5 max-h-[250px] overflow-y-auto">
                      {recentTrades.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-4">No trades yet</p>
                      ) : recentTrades.map((t, i) => (
                        <div key={`${t.tick}-${t.botId}-${i}`} className="flex items-center gap-2 px-2 py-1 rounded text-[9px]">
                          <span className="font-mono text-muted-foreground w-8">#{t.tick}</span>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.botColor }} />
                          <span className="text-foreground font-medium">{t.botName}</span>
                          <span className={`font-semibold ${t.direction === "buyX" ? "text-green-500" : "text-red-500"}`}>
                            {t.direction === "buyX" ? "BUY" : "SELL"}
                          </span>
                          <span className="text-muted-foreground ml-auto">${t.inputAmount.toFixed(2)}</span>
                          <span className="text-muted-foreground">slip: {t.slippage.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Fees chart */}
                <div className="surface-elevated rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-foreground mb-3">Cumulative Fees</h3>
                  <div className="h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={feeData}>
                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                        <XAxis dataKey="tick" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 10 }} />
                        <Area type="monotone" dataKey="fees" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" name="Fees ($)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function ParamRow({ label, value, unit, onChange, min, max, step }: {
  label: string; value: number; unit?: string; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {unit && <span className="text-[9px] text-muted-foreground">{unit}</span>}
        <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
          min={min} max={max} step={step}
          className="w-24 bg-secondary border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground outline-none text-right" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-elevated rounded-lg p-3">
      <p className="text-[9px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-semibold font-mono text-foreground">{value}</p>
    </div>
  );
}
