import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Zap } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const ArbitrageEngine = () => {
  const [externalVolatility, setExternalVolatility] = useState(60);
  const [latencyMs, setLatencyMs] = useState(200);
  const [gasCost, setGasCost] = useState(15);
  const [poolLiquidity, setPoolLiquidity] = useState(1000000);

  const arbData = useMemo(() => {
    const data = [];
    for (let i = 0; i < 48; i++) {
      const hour = i * 0.5;
      const volFactor = externalVolatility / 100;
      const priceDivergence = Math.sin(hour * 0.5) * volFactor * 3 + Math.cos(hour * 1.3) * volFactor * 1.5;
      const arbVolume = Math.abs(priceDivergence) > gasCost / 10000 ? Math.abs(priceDivergence) * poolLiquidity * 0.001 : 0;
      const toxicFlow = arbVolume * (latencyMs > 500 ? 0.7 : latencyMs > 100 ? 0.4 : 0.1);
      const feeCapture = arbVolume * 0.003 - toxicFlow * 0.001;
      data.push({
        hour: `${Math.floor(hour)}:${hour % 1 === 0 ? "00" : "30"}`,
        priceDivergence: parseFloat(priceDivergence.toFixed(3)),
        arbVolume: Math.round(arbVolume),
        toxicFlow: Math.round(toxicFlow),
        feeCapture: parseFloat(Math.max(0, feeCapture).toFixed(2)),
      });
    }
    return data;
  }, [externalVolatility, latencyMs, gasCost, poolLiquidity]);

  const totalArbVolume = arbData.reduce((s, d) => s + d.arbVolume, 0);
  const totalToxicFlow = arbData.reduce((s, d) => s + d.toxicFlow, 0);
  const totalFees = arbData.reduce((s, d) => s + d.feeCapture, 0);
  const captureRate = totalArbVolume > 0 ? ((totalFees / totalArbVolume) * 100).toFixed(2) : "0";

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-chart-purple" />
          <h3 className="text-sm font-semibold text-foreground">Arbitrage Parameters</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Param label="External Vol (%)" value={externalVolatility} onChange={setExternalVolatility} min={10} max={200} />
          <Param label="Latency (ms)" value={latencyMs} onChange={setLatencyMs} min={10} max={2000} step={10} />
          <Param label="Gas Cost ($)" value={gasCost} onChange={setGasCost} min={1} max={100} />
          <Param label="Pool Liquidity ($)" value={poolLiquidity} onChange={setPoolLiquidity} min={100000} max={10000000} step={100000} />
        </div>
      </div>

      {/* Metrics */}
      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <StatCard label="Total Arb Volume" value={`$${(totalArbVolume / 1000).toFixed(0)}k`} />
        <StatCard label="Toxic Flow" value={`$${(totalToxicFlow / 1000).toFixed(0)}k`} accent />
        <StatCard label="Fee Capture" value={`$${totalFees.toFixed(0)}`} />
        <StatCard label="Capture Rate" value={`${captureRate}%`} />
      </motion.div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <h4 className="text-xs font-semibold text-foreground mb-1">Arbitrage Volume vs. Toxic Flow</h4>
          <p className="text-[10px] text-muted-foreground mb-3">24h simulation (30-min intervals)</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={arbData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 16%)" />
                <XAxis dataKey="hour" tick={{ fontSize: 8, fill: "hsl(215, 15%, 50%)" }} interval={5} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(215, 15%, 50%)" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "hsl(225, 20%, 9%)", border: "1px solid hsl(225, 15%, 16%)", borderRadius: 8, fontSize: 10 }} />
                <Bar dataKey="arbVolume" name="Arb Volume" fill="hsl(260, 60%, 60%)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="toxicFlow" name="Toxic Flow" fill="hsl(0, 72%, 55%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <h4 className="text-xs font-semibold text-foreground mb-1">Price Divergence</h4>
          <p className="text-[10px] text-muted-foreground mb-3">Pool vs. external price spread</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={arbData}>
                <defs>
                  <linearGradient id="divGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(185, 80%, 55%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(185, 80%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 16%)" />
                <XAxis dataKey="hour" tick={{ fontSize: 8, fill: "hsl(215, 15%, 50%)" }} interval={5} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(215, 15%, 50%)" }} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ background: "hsl(225, 20%, 9%)", border: "1px solid hsl(225, 15%, 16%)", borderRadius: 8, fontSize: 10 }} />
                <Area type="monotone" dataKey="priceDivergence" stroke="hsl(185, 80%, 55%)" fill="url(#divGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const Param = ({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="text-[10px] text-muted-foreground">{label}</label>
      <span className="text-[10px] font-mono text-foreground">{value.toLocaleString()}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-chart-purple h-1" />
  </div>
);

const StatCard = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="surface-elevated rounded-lg p-3">
    <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
    <p className={`text-sm font-semibold font-mono-data ${accent ? "text-destructive" : "text-foreground"}`}>{value}</p>
  </div>
);

export default ArbitrageEngine;
