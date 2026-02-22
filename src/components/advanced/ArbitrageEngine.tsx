import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, HelpCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const HELP: Record<string, { title: string; desc: string }> = {
  externalVol: { title: "External Volatility", desc: "How volatile the external market price is. Higher volatility creates more arbitrage opportunities as the pool price deviates more frequently." },
  latency: { title: "Latency (ms)", desc: "Network/execution delay for arbitrageurs. Higher latency means arbitrageurs are slower, allowing more price divergence and toxic flow." },
  gasCost: { title: "Gas Cost", desc: "Transaction fee to execute an arbitrage trade. Higher gas costs set a minimum profitable divergence threshold." },
  poolLiq: { title: "Pool Liquidity", desc: "Total value locked in the pool. Larger pools have smaller price impact per trade, reducing arbitrage profit per event." },
  totalArb: { title: "Total Arb Volume", desc: "Total value of all arbitrage trades during the simulation period." },
  toxicFlow: { title: "Toxic Flow", desc: "Portion of arbitrage volume that extracts value from LPs. Higher latency = more toxic flow because prices are staler." },
  captureRate: { title: "Fee Capture Rate", desc: "Percentage of arbitrage volume captured as fees. Higher is better for LPs." },
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

const ArbitrageEngine = ({ assets }: { assets?: Asset[] }) => {
  const colors = useChartColors();
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

  const tooltipStyle = { background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10, color: colors.tooltipText };

  return (
    <div className="space-y-6">
      {/* Multi-asset context */}
      {assets && assets.length > 0 && (
        <div className="surface-elevated rounded-xl p-4">
          <h4 className="text-[10px] font-bold text-foreground mb-2">Cross-Pair Arbitrage Analysis</h4>
          <p className="text-[9px] text-muted-foreground mb-2">Modeling arbitrage across {assets.length * (assets.length - 1) / 2} trading pairs in the multi-asset pool.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {assets.map((a, i) => assets.slice(i + 1).map(b => (
              <div key={`${a.id}-${b.id}`} className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary border border-border text-[9px] font-mono">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                <span className="text-foreground">{a.symbol}/{b.symbol}</span>
              </div>
            )))}
          </div>
        </div>
      )}

      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Arbitrage Parameters</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Param label="External Vol (%)" value={externalVolatility} onChange={setExternalVolatility} min={10} max={200} helpId="externalVol" />
          <Param label="Latency (ms)" value={latencyMs} onChange={setLatencyMs} min={10} max={2000} step={10} helpId="latency" />
          <Param label="Gas Cost ($)" value={gasCost} onChange={setGasCost} min={1} max={100} helpId="gasCost" />
          <Param label="Pool Liquidity ($)" value={poolLiquidity} onChange={setPoolLiquidity} min={100000} max={10000000} step={100000} helpId="poolLiq" />
        </div>
      </div>

      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <StatCard label="Total Arb Volume" value={`$${(totalArbVolume / 1000).toFixed(0)}k`} helpId="totalArb" />
        <StatCard label="Toxic Flow" value={`$${(totalToxicFlow / 1000).toFixed(0)}k`} accent helpId="toxicFlow" />
        <StatCard label="Fee Capture" value={`$${totalFees.toFixed(0)}`} />
        <StatCard label="Capture Rate" value={`${captureRate}%`} helpId="captureRate" />
      </motion.div>

      <div className="grid md:grid-cols-2 gap-4">
        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <h4 className="text-xs font-semibold text-foreground mb-1">Arb Volume vs. Toxic Flow</h4>
          <p className="text-[10px] text-muted-foreground mb-3">24h simulation</p>
          <div className="h-56" onWheel={e => e.stopPropagation()}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={arbData}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="hour" tick={{ fontSize: 8, fill: colors.tick }} interval={5} />
                <YAxis tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} wrapperStyle={{ pointerEvents: 'none' }} />
                <Bar dataKey="arbVolume" name="Arb Volume" fill={colors.line} radius={[2, 2, 0, 0]} />
                <Bar dataKey="toxicFlow" name="Toxic Flow" fill={colors.red} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <h4 className="text-xs font-semibold text-foreground mb-1">Price Divergence</h4>
          <p className="text-[10px] text-muted-foreground mb-3">Pool vs. external price</p>
          <div className="h-56" onWheel={e => e.stopPropagation()}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={arbData}>
                <defs>
                  <linearGradient id="divGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.green} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={colors.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="hour" tick={{ fontSize: 8, fill: colors.tick }} interval={5} />
                <YAxis tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} wrapperStyle={{ pointerEvents: 'none' }} />
                <Area type="monotone" dataKey="priceDivergence" stroke={colors.green} fill="url(#divGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const Param = ({ label, value, onChange, min, max, step = 1, helpId }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; helpId?: string }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-1">
        <label className="text-[10px] text-muted-foreground">{label}</label>
        {helpId && <HelpBtn id={helpId} />}
      </div>
      <span className="text-[10px] font-mono text-foreground">{value.toLocaleString()}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-foreground h-1" />
  </div>
);

const StatCard = ({ label, value, accent, helpId }: { label: string; value: string; accent?: boolean; helpId?: string }) => (
  <div className="surface-elevated rounded-lg p-3">
    <div className="flex items-center gap-1 mb-1">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      {helpId && <HelpBtn id={helpId} />}
    </div>
    <p className={`text-sm font-semibold font-mono-data ${accent ? "text-destructive" : "text-foreground"}`}>{value}</p>
  </div>
);

export default ArbitrageEngine;
