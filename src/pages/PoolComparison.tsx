import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, BarChart3, TrendingDown, DollarSign, Shield, Zap } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import ThemeToggle from "@/components/ThemeToggle";
import { useChartColors } from "@/hooks/use-chart-theme";
import { createPool, executeTrade, calcIL, capitalEfficiency } from "@/lib/amm-engine";

type PoolType = "constant_product" | "stable_swap" | "weighted" | "concentrated";

interface PoolConfig {
  id: string;
  name: string;
  type: PoolType;
  liquidity: number;
  feeRate: number;
  color: string;
}

const POOL_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const POOL_TYPES: { id: PoolType; name: string; desc: string }[] = [
  { id: "constant_product", name: "Constant Product", desc: "x * y = k" },
  { id: "stable_swap", name: "Stable Swap", desc: "x + y + a*xy = k" },
  { id: "weighted", name: "Weighted Pool", desc: "x^w1 * y^w2 = k" },
  { id: "concentrated", name: "Concentrated", desc: "sqrt(x) * sqrt(y) = sqrt(k)" },
];

function computeSlippage(type: PoolType, tradeSize: number, liquidity: number): number {
  const pct = tradeSize / liquidity;
  switch (type) {
    case "constant_product": return Math.min(pct / (1 - Math.min(pct, 0.99)) * 100, 100);
    case "stable_swap": return Math.min(pct * pct * 50, 100);
    case "weighted": return Math.min(pct * 80, 100);
    case "concentrated": return Math.min(pct * 40, 100);
  }
}

function computeIL(type: PoolType, priceRatio: number): number {
  const sqrtR = Math.sqrt(priceRatio);
  const baseIL = (2 * sqrtR / (1 + priceRatio) - 1) * -100;
  switch (type) {
    case "constant_product": return baseIL;
    case "stable_swap": return baseIL * 0.3;
    case "weighted": return baseIL * 0.6;
    case "concentrated": return baseIL * 2.5;
  }
}

function computeCapitalEfficiency(type: PoolType): number {
  switch (type) {
    case "constant_product": return 1;
    case "stable_swap": return 2;
    case "weighted": return 1.5;
    case "concentrated": return 4.2;
  }
}

function computeDailyFees(type: PoolType, liquidity: number, feeRate: number): number {
  const volumeMultiplier = type === "concentrated" ? 4 : type === "stable_swap" ? 3 : 1;
  return liquidity * 0.02 * feeRate * volumeMultiplier;
}

function computeProtectionScore(type: PoolType): number {
  switch (type) {
    case "constant_product": return 60;
    case "stable_swap": return 80;
    case "weighted": return 70;
    case "concentrated": return 45;
  }
}

let nextId = 1;
function makeId() { return `pool-${nextId++}`; }

const PoolComparison = () => {
  const navigate = useNavigate();
  const colors = useChartColors();

  const [pools, setPools] = useState<PoolConfig[]>(() => {
    try {
      const seed = localStorage.getItem("pool-comparison-seed");
      if (seed) {
        localStorage.removeItem("pool-comparison-seed");
        const parsed = JSON.parse(seed) as Array<{ name: string; type: PoolType; liquidity?: number; feeRate?: number }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p, i) => ({
            id: makeId(),
            name: p.name,
            type: p.type,
            liquidity: p.liquidity ?? 100000,
            feeRate: p.feeRate ?? 0.003,
            color: POOL_COLORS[i % POOL_COLORS.length],
          }));
        }
      }
    } catch { /* ignore */ }
    return [
      { id: makeId(), name: "Uniswap V2 Style", type: "constant_product", liquidity: 100000, feeRate: 0.003, color: POOL_COLORS[0] },
      { id: makeId(), name: "Curve Style", type: "stable_swap", liquidity: 100000, feeRate: 0.001, color: POOL_COLORS[1] },
    ];
  });

  const addPool = () => {
    if (pools.length >= 6) return;
    const idx = pools.length;
    setPools([...pools, {
      id: makeId(),
      name: `Pool ${idx + 1}`,
      type: "constant_product",
      liquidity: 100000,
      feeRate: 0.003,
      color: POOL_COLORS[idx % POOL_COLORS.length],
    }]);
  };

  const removePool = (id: string) => {
    if (pools.length <= 1) return;
    setPools(pools.filter(p => p.id !== id));
  };

  const updatePool = (id: string, updates: Partial<PoolConfig>) => {
    setPools(pools.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  // Slippage comparison data
  const slippageData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 20; i++) {
      const tradePct = i * 0.5; // 0% to 10% of liquidity
      const point: Record<string, number | string> = { tradeSize: `${tradePct.toFixed(1)}%` };
      for (const pool of pools) {
        const tradeSize = pool.liquidity * (tradePct / 100);
        point[pool.id] = parseFloat(computeSlippage(pool.type, tradeSize, pool.liquidity).toFixed(3));
      }
      data.push(point);
    }
    return data;
  }, [pools]);

  // IL comparison data
  const ilData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 30; i++) {
      const priceRatio = 0.5 + (i / 30) * 1.5;
      const point: Record<string, number | string> = { priceRatio: priceRatio.toFixed(2) };
      for (const pool of pools) {
        point[pool.id] = parseFloat(computeIL(pool.type, priceRatio).toFixed(3));
      }
      data.push(point);
    }
    return data;
  }, [pools]);

  // Radar data for each pool
  const radarData = useMemo(() => {
    return [
      { metric: "Capital Eff.", ...Object.fromEntries(pools.map(p => [p.id, computeCapitalEfficiency(p.type) / 4.2 * 100])) },
      { metric: "Low Slippage", ...Object.fromEntries(pools.map(p => [p.id, 100 - computeSlippage(p.type, p.liquidity * 0.01, p.liquidity)])) },
      { metric: "Low IL", ...Object.fromEntries(pools.map(p => [p.id, 100 - Math.abs(computeIL(p.type, 1.5))])) },
      { metric: "MEV Protection", ...Object.fromEntries(pools.map(p => [p.id, computeProtectionScore(p.type)])) },
      { metric: "Fee Revenue", ...Object.fromEntries(pools.map(p => [p.id, Math.min(100, computeDailyFees(p.type, p.liquidity, p.feeRate) / 50 * 100)])) },
    ];
  }, [pools]);

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    return pools.map(pool => ({
      ...pool,
      capitalEff: computeCapitalEfficiency(pool.type),
      dailyFees: computeDailyFees(pool.type, pool.liquidity, pool.feeRate),
      maxIL: Math.abs(computeIL(pool.type, 2.0)),
      mevProtection: computeProtectionScore(pool.type),
    }));
  }, [pools]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">POOL COMPARISON</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-primary/30 text-primary">COMPARE</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addPool}
            disabled={pools.length >= 6}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Plus className="w-3 h-3" /> Add Pool
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Pool Configuration Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {pools.map(pool => (
              <motion.div
                key={pool.id}
                className="surface-elevated rounded-xl p-4 space-y-3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pool.color }} />
                    <input
                      value={pool.name}
                      onChange={e => updatePool(pool.id, { name: e.target.value })}
                      className="text-sm font-semibold text-foreground bg-transparent outline-none w-36"
                    />
                  </div>
                  <button
                    onClick={() => removePool(pool.id)}
                    disabled={pools.length <= 1}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Pool Type</label>
                  <select
                    value={pool.type}
                    onChange={e => updatePool(pool.id, { type: e.target.value as PoolType })}
                    className="w-full text-xs bg-secondary border border-border rounded-md px-2 py-1.5 text-foreground"
                  >
                    {POOL_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Liquidity</label>
                    <div className="flex items-center gap-1 bg-secondary border border-border rounded-md px-2 py-1.5">
                      <span className="text-[10px] text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={pool.liquidity}
                        onChange={e => updatePool(pool.id, { liquidity: Math.max(1000, Number(e.target.value)) })}
                        className="bg-transparent text-xs font-mono text-foreground w-full outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Fee Rate</label>
                    <select
                      value={pool.feeRate}
                      onChange={e => updatePool(pool.id, { feeRate: Number(e.target.value) })}
                      className="w-full text-xs bg-secondary border border-border rounded-md px-2 py-1.5 text-foreground"
                    >
                      <option value={0.0001}>0.01%</option>
                      <option value={0.0005}>0.05%</option>
                      <option value={0.003}>0.30%</option>
                      <option value={0.01}>1.00%</option>
                    </select>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Capital Eff.</p>
                    <p className="text-sm font-semibold font-mono text-foreground">{computeCapitalEfficiency(pool.type).toFixed(1)}x</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Est. Daily Fees</p>
                    <p className="text-sm font-semibold font-mono text-success">${computeDailyFees(pool.type, pool.liquidity, pool.feeRate).toFixed(2)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Slippage Comparison */}
          <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" /> Slippage Comparison
            </h3>
            <p className="text-[10px] text-muted-foreground mb-4">Price impact across trade sizes (% of pool liquidity)</p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={slippageData}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="tradeSize" tick={{ fontSize: 10, fill: colors.text }} />
                <YAxis tick={{ fontSize: 10, fill: colors.text }} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: colors.tooltipBg, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 11 }} />
                {pools.map(pool => (
                  <Area key={pool.id} type="monotone" dataKey={pool.id} name={pool.name} stroke={pool.color} fill={pool.color} fillOpacity={0.1} strokeWidth={2} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* IL Comparison */}
          <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Impermanent Loss Comparison
            </h3>
            <p className="text-[10px] text-muted-foreground mb-4">IL across price ratio changes</p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={ilData}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="priceRatio" tick={{ fontSize: 10, fill: colors.text }} label={{ value: "Price Ratio", position: "bottom", fontSize: 10, fill: colors.text }} />
                <YAxis tick={{ fontSize: 10, fill: colors.text }} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: colors.tooltipBg, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 11 }} />
                {pools.map(pool => (
                  <Area key={pool.id} type="monotone" dataKey={pool.id} name={pool.name} stroke={pool.color} fill={pool.color} fillOpacity={0.1} strokeWidth={2} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Radar Chart + Summary Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h3 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Pool Profile Radar
            </h3>
            <p className="text-[10px] text-muted-foreground mb-4">Multi-dimensional comparison (higher = better)</p>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke={colors.grid} />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: colors.text }} />
                <PolarRadiusAxis tick={{ fontSize: 9, fill: colors.text }} domain={[0, 100]} />
                {pools.map(pool => (
                  <Radar key={pool.id} name={pool.name} dataKey={pool.id} stroke={pool.color} fill={pool.color} fillOpacity={0.15} strokeWidth={2} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Summary Table */}
          <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h3 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Performance Summary
            </h3>
            <p className="text-[10px] text-muted-foreground mb-4">Key metrics at a glance</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Pool</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Cap. Eff.</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Daily Fees</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Max IL (2x)</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">MEV Score</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryMetrics.map(pool => (
                    <tr key={pool.id} className="border-b border-border/50">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pool.color }} />
                          <span className="font-medium text-foreground">{pool.name}</span>
                        </div>
                      </td>
                      <td className="text-right py-2.5 font-mono text-foreground">{pool.capitalEff.toFixed(1)}x</td>
                      <td className="text-right py-2.5 font-mono text-success">${pool.dailyFees.toFixed(2)}</td>
                      <td className="text-right py-2.5 font-mono text-destructive">{pool.maxIL.toFixed(2)}%</td>
                      <td className="text-right py-2.5">
                        <span className={`font-mono ${pool.mevProtection >= 70 ? "text-success" : pool.mevProtection >= 50 ? "text-warning" : "text-destructive"}`}>
                          {pool.mevProtection}/100
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Winner callout */}
            {summaryMetrics.length >= 2 && (
              <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20">
                <p className="text-[11px] text-success font-medium">
                  Best for fees: {summaryMetrics.sort((a, b) => b.dailyFees - a.dailyFees)[0].name} &bull;{" "}
                  Lowest IL: {[...summaryMetrics].sort((a, b) => a.maxIL - b.maxIL)[0].name} &bull;{" "}
                  Best MEV protection: {[...summaryMetrics].sort((a, b) => b.mevProtection - a.mevProtection)[0].name}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PoolComparison;
