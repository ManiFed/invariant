import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Code2, Play, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";

const presets = [
  { label: "Constant Product", expr: "x * y = k", params: { a: 1, b: 1 } },
  { label: "Stable Swap", expr: "x + y + α(x·y) = k", params: { a: 0.5, b: 1 } },
  { label: "Weighted (40/60)", expr: "x^0.4 · y^0.6 = k", params: { a: 0.4, b: 0.6 } },
  { label: "Custom", expr: "", params: { a: 1, b: 1 } },
];

const InvariantEditor = () => {
  const colors = useChartColors();
  const [expression, setExpression] = useState("x * y = k");
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [weightA, setWeightA] = useState(0.5);
  const [weightB, setWeightB] = useState(0.5);
  const [kValue, setKValue] = useState(10000);

  // Constant product: y = k/x
  // Stable swap (simplified): y = k - x - α*x (linear-ish near peg)
  // Weighted: y = (k / x^w1)^(1/w2) — generalized constant product
  const curveData = useMemo(() => {
    const data = [];
    for (let i = 1; i <= 100; i++) {
      const x = i * 2;
      let y: number;
      if (selectedPreset === 0) y = kValue / x;
      else if (selectedPreset === 1) y = kValue - x - weightA * x;
      else y = Math.pow(kValue / Math.pow(x, weightA), 1 / weightB);
      if (y > 0 && y < 10000) data.push({ x, y: parseFloat(y.toFixed(2)) });
    }
    return data;
  }, [selectedPreset, weightA, weightB, kValue]);

  // Spot price = -dy/dx (numerical derivative)
  const spotPriceData = useMemo(() => {
    return curveData.map((point, i) => {
      if (i === 0) return { x: point.x, spotPrice: 0 };
      const dx = point.x - curveData[i - 1].x;
      const dy = Math.abs(point.y - curveData[i - 1].y);
      return { x: point.x, spotPrice: parseFloat((dy / dx).toFixed(4)) };
    }).slice(1);
  }, [curveData]);

  // Convexity = d²y/dx² (second derivative)
  const convexityData = useMemo(() => {
    return spotPriceData.map((point, i) => {
      if (i === 0) return { x: point.x, convexity: 0 };
      const dx = point.x - spotPriceData[i - 1].x;
      const dSpot = Math.abs(point.spotPrice - spotPriceData[i - 1].spotPrice);
      return { x: point.x, convexity: parseFloat((dSpot / dx).toFixed(6)) };
    }).slice(1);
  }, [spotPriceData]);

  const tooltipStyle = { background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10 };

  return (
    <div className="space-y-6">
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Code2 className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Invariant Expression</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {presets.map((p, i) => (
            <button key={p.label} onClick={() => { setSelectedPreset(i); if (p.expr) setExpression(p.expr); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                selectedPreset === i ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"
              }`}>{p.label}</button>
          ))}
        </div>
        <div className="relative">
          <input value={expression} onChange={e => { setExpression(e.target.value); setSelectedPreset(3); }}
            className="w-full bg-muted border border-border rounded-lg px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/30 transition-colors"
            placeholder="Enter invariant expression (e.g., x^w1 · y^w2 = k)" />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-secondary text-foreground hover:bg-secondary/80 transition-colors">
            <Play className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Weight A (w₁)</label>
            <input type="range" min="0.1" max="0.9" step="0.05" value={weightA}
              onChange={e => { setWeightA(Number(e.target.value)); setWeightB(1 - Number(e.target.value)); }}
              className="w-full accent-foreground" />
            <span className="text-xs font-mono text-foreground">{weightA.toFixed(2)}</span>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Weight B (w₂)</label>
            <input type="range" min="0.1" max="0.9" step="0.05" value={weightB}
              onChange={e => setWeightB(Number(e.target.value))} className="w-full accent-foreground" disabled />
            <span className="text-xs font-mono text-foreground">{weightB.toFixed(2)}</span>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">k (invariant)</label>
            <input type="number" value={kValue} onChange={e => setKValue(Number(e.target.value))}
              className="w-full bg-secondary border border-border rounded-md px-3 py-1.5 text-xs font-mono text-foreground outline-none" />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <ChartPanel title="Invariant Curve" subtitle="Token reserves relationship" data={curveData} dataKey="y" color={colors.line} colors={colors} />
        <ChartPanel title="Spot Price" subtitle="−dy/dx (marginal price)" data={spotPriceData} dataKey="spotPrice" color={colors.green} colors={colors} />
        <ChartPanel title="Convexity" subtitle="d²y/dx² (curvature)" data={convexityData} dataKey="convexity" color={colors.red} colors={colors} />
      </div>

      <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Auto-derived Properties</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DerivedProp label="Spot Price at x=100" value={spotPriceData.length > 10 ? spotPriceData[10].spotPrice.toFixed(4) : "—"} />
          <DerivedProp label="Liquidity Density" value={selectedPreset === 0 ? "Uniform" : selectedPreset === 1 ? "Concentrated" : "Weighted"} />
          <DerivedProp label="Convexity Profile" value={selectedPreset === 0 ? "Hyperbolic" : selectedPreset === 1 ? "Flat" : "Power"} />
          <DerivedProp label="Reserve Ratio" value={`${(weightA * 100).toFixed(0)}/${(weightB * 100).toFixed(0)}`} />
        </div>
      </motion.div>
    </div>
  );
};

const ChartPanel = ({ title, subtitle, data, dataKey, color, colors }: { title: string; subtitle: string; data: any[]; dataKey: string; color: string; colors: ReturnType<typeof useChartColors> }) => (
  <div className="surface-elevated rounded-xl p-4">
    <h4 className="text-xs font-semibold text-foreground mb-0.5">{title}</h4>
    <p className="text-[10px] text-muted-foreground mb-3">{subtitle}</p>
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis dataKey="x" tick={{ fontSize: 9, fill: colors.tick }} />
          <YAxis tick={{ fontSize: 9, fill: colors.tick }} />
          <Tooltip contentStyle={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10 }} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const DerivedProp = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
    <p className="text-sm font-semibold font-mono-data text-foreground">{value}</p>
  </div>
);

export default InvariantEditor;
