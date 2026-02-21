import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";

const invariants = [
  { id: "cp", label: "Constant Product" },
  { id: "ss", label: "Stable Swap" },
  { id: "wt", label: "Weighted (40/60)" },
  { id: "cl", label: "Concentrated" },
];

const LiquidityAnalyzer = () => {
  const colors = useChartColors();
  const [compareA, setCompareA] = useState("cp");
  const [compareB, setCompareB] = useState("cl");
  const [liquidity, setLiquidity] = useState(500000);

  const invColors: Record<string, string> = {
    cp: colors.line, ss: colors.green, wt: colors.red, cl: colors.gray,
  };

  const slippageComparison = useMemo(() => {
    const data = [];
    for (let i = 1; i <= 30; i++) {
      const tradeSize = (i / 30) * liquidity * 0.1;
      const pct = tradeSize / liquidity;
      data.push({
        tradeSize: Math.round(tradeSize),
        cp: parseFloat(((pct / (1 - pct)) * 100).toFixed(3)),
        ss: parseFloat((pct * pct * 50).toFixed(3)),
        wt: parseFloat((pct * 80).toFixed(3)),
        cl: parseFloat((pct * 40).toFixed(3)),
      });
    }
    return data;
  }, [liquidity]);

  const depthData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 40; i++) {
      const priceDistance = (i / 40) * 20 - 10;
      data.push({
        priceDistance: parseFloat(priceDistance.toFixed(1)),
        cp: parseFloat((liquidity / (1 + Math.abs(priceDistance) * 0.1)).toFixed(0)),
        ss: parseFloat((liquidity / (1 + Math.abs(priceDistance) * 0.02)).toFixed(0)),
        wt: parseFloat((liquidity / (1 + Math.abs(priceDistance) * 0.08)).toFixed(0)),
        cl: priceDistance > -3 && priceDistance < 3
          ? parseFloat((liquidity * 2 / (1 + Math.abs(priceDistance) * 0.05)).toFixed(0))
          : parseFloat((liquidity * 0.05).toFixed(0)),
      });
    }
    return data;
  }, [liquidity]);

  const metrics: Record<string, { efficiency: string; avgSlippage: string; depthRatio: string; impactElasticity: string }> = {
    cp: { efficiency: "1.0x", avgSlippage: "5.0%", depthRatio: "1.00", impactElasticity: "1.00" },
    ss: { efficiency: "3.1x", avgSlippage: "1.0%", depthRatio: "3.10", impactElasticity: "0.20" },
    wt: { efficiency: "1.5x", avgSlippage: "4.0%", depthRatio: "1.25", impactElasticity: "0.80" },
    cl: { efficiency: "4.2x", avgSlippage: "2.0%", depthRatio: "4.00", impactElasticity: "0.40" },
  };

  const tooltipStyle = { background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10 };

  return (
    <div className="space-y-6">
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Compare Invariants</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Invariant A</label>
            <div className="flex gap-2">
              {invariants.map(inv => (
                <button key={inv.id} onClick={() => setCompareA(inv.id)}
                  className={`flex-1 py-2 rounded-md text-[10px] font-medium transition-all ${compareA === inv.id ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"}`}>
                  {inv.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Invariant B</label>
            <div className="flex gap-2">
              {invariants.map(inv => (
                <button key={inv.id} onClick={() => setCompareB(inv.id)}
                  className={`flex-1 py-2 rounded-md text-[10px] font-medium transition-all ${compareB === inv.id ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"}`}>
                  {inv.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-[10px] text-muted-foreground">Pool Liquidity</label>
            <span className="text-[10px] font-mono text-foreground">${liquidity.toLocaleString()}</span>
          </div>
          <input type="range" min={100000} max={5000000} step={100000} value={liquidity} onChange={e => setLiquidity(Number(e.target.value))} className="w-full accent-foreground h-1" />
        </div>
      </div>

      <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h4 className="text-xs font-semibold text-foreground mb-3">Efficiency Comparison</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Metric</th>
                {invariants.map(inv => (
                  <th key={inv.id} className={`text-right py-2 font-medium ${(compareA === inv.id || compareB === inv.id) ? "text-foreground" : "text-muted-foreground"}`}>{inv.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                { label: "Capital Efficiency", key: "efficiency" as const },
                { label: "Avg Slippage", key: "avgSlippage" as const },
                { label: "Depth Ratio", key: "depthRatio" as const },
                { label: "Impact Elasticity", key: "impactElasticity" as const },
              ]).map(row => (
                <tr key={row.label} className="border-b border-border/50">
                  <td className="py-2 text-muted-foreground">{row.label}</td>
                  {invariants.map(inv => (
                    <td key={inv.id} className={`text-right py-2 font-mono-data ${(compareA === inv.id || compareB === inv.id) ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                      {metrics[inv.id][row.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-4">
        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <h4 className="text-xs font-semibold text-foreground mb-1">Slippage Comparison</h4>
          <p className="text-[10px] text-muted-foreground mb-3">Price impact by trade size</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={slippageComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="tradeSize" tick={{ fontSize: 8, fill: colors.tick }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey={compareA} name={invariants.find(i => i.id === compareA)?.label} stroke={invColors[compareA]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={compareB} name={invariants.find(i => i.id === compareB)?.label} stroke={invColors[compareB]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <h4 className="text-xs font-semibold text-foreground mb-1">Depth by Price Distance</h4>
          <p className="text-[10px] text-muted-foreground mb-3">Available liquidity vs. price offset</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={depthData}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="priceDistance" tick={{ fontSize: 8, fill: colors.tick }} tickFormatter={v => `${v}%`} />
                <YAxis tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey={compareA} name={invariants.find(i => i.id === compareA)?.label} stroke={invColors[compareA]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={compareB} name={invariants.find(i => i.id === compareB)?.label} stroke={invColors[compareB]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LiquidityAnalyzer;
