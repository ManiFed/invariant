import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Code2, Play, Zap, HelpCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const presets = [
  { label: "Constant Product", expr: "x * y = k", params: { a: 0.5, b: 0.5 }, id: "cp" },
  { label: "Stable Swap", expr: "x + y + α(x·y) = k", params: { a: 0.5, b: 1 }, id: "ss" },
  { label: "Weighted (40/60)", expr: "x^0.4 · y^0.6 = k", params: { a: 0.4, b: 0.6 }, id: "wt" },
  { label: "Concentrated", expr: "(√x − √pₐ)(√y − √p_b) = L²", params: { a: 0.8, b: 1.2 }, id: "cl" },
  { label: "Custom", expr: "", params: { a: 1, b: 1 }, id: "custom" },
];

const HELP: Record<string, { title: string; desc: string }> = {
  weightA: { title: "Weight A (w₁)", desc: "Controls the exponent on token X in the invariant formula. For weighted pools, this determines the portfolio allocation to token X." },
  weightB: { title: "Weight B (w₂)", desc: "Controls the exponent on token Y. In a standard constant product, both weights are 0.5. Balancer-style pools use asymmetric weights." },
  kValue: { title: "k (Invariant Constant)", desc: "The constant that the formula must maintain. Larger k means deeper liquidity. k = initial_x × initial_y for constant product." },
  amplification: { title: "Amplification (A)", desc: "Controls how concentrated liquidity is around the 1:1 price. Higher A = flatter curve near peg = less slippage for correlated pairs." },
  rangeLower: { title: "Range Lower", desc: "Lower price bound for concentrated liquidity. Below this price, you hold 100% token X." },
  rangeUpper: { title: "Range Upper", desc: "Upper price bound for concentrated liquidity. Above this price, you hold 100% token Y." },
  spotPrice: { title: "Spot Price", desc: "The instantaneous exchange rate at a point on the curve, calculated as −dy/dx. This is what the next infinitesimally small trade would cost." },
  convexity: { title: "Convexity", desc: "The second derivative d²y/dx². Measures how quickly the price changes. Higher convexity = more slippage for large trades." },
  invariantCurve: { title: "Invariant Curve", desc: "Shows the relationship between token reserves. Every valid pool state must lie on this curve. Trades move the point along the curve." },
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

const MATH_SYMBOLS = [
  { label: "×", insert: " * " },
  { label: "÷", insert: " / " },
  { label: "^", insert: "^" },
  { label: "√", insert: "sqrt(" },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
  { label: "x", insert: "x" },
  { label: "y", insert: "y" },
  { label: "k", insert: "k" },
];

// Evaluate curve: given x, k, and parameters, compute y
function evalCurve(preset: string, x: number, k: number, wA: number, wB: number, amp: number, rLow: number, rHigh: number, customFn: ((x: number, k: number) => number) | null): number | null {
  try {
    switch (preset) {
      case "cp": return k / x;
      case "ss": {
        // StableSwap simplified: A*(x+y) + xy = A*D + (D/2)^2
        // Approximate: y ≈ (k - amp*x) / (1 + amp) for visualization
        const y = (k - amp * x) / (1 + amp * x / k);
        return y > 0 ? y : null;
      }
      case "wt": return Math.pow(k / Math.pow(x, wA), 1 / wB);
      case "cl": {
        // Concentrated: (√x - √pₐ)(√y - √p_b) = L²
        const sqrtPa = Math.sqrt(rLow * 100);
        const sqrtPb = Math.sqrt(rHigh * 100);
        const sqrtX = Math.sqrt(x);
        if (sqrtX <= sqrtPa) return null;
        const L2 = k / 10;
        const sqrtY = L2 / (sqrtX - sqrtPa) + sqrtPb;
        const y = sqrtY * sqrtY;
        return y > 0 && y < k * 10 ? y : null;
      }
      case "custom":
        if (customFn) return customFn(x, k);
        return k / x; // fallback to constant product
      default: return k / x;
    }
  } catch {
    return null;
  }
}

const InvariantEditor = () => {
  const colors = useChartColors();
  const [expression, setExpression] = useState("x * y = k");
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [weightA, setWeightA] = useState(0.5);
  const [weightB, setWeightB] = useState(0.5);
  const [kValue, setKValue] = useState(10000);
  const [amplification, setAmplification] = useState(100);
  const [rangeLower, setRangeLower] = useState(0.8);
  const [rangeUpper, setRangeUpper] = useState(1.2);

  const presetId = presets[selectedPreset]?.id || "cp";

  // Parse custom expression into a function
  const customFn = useMemo(() => {
    if (presetId !== "custom") return null;
    try {
      // Parse expression: replace math operators
      let expr = expression.replace(/=/g, "").replace(/k/g, "").trim();
      // Try to solve for y: if expression is "x * y" → y = k / x
      // If "x^a * y^b" → y = (k / x^a)^(1/b)
      // Simple heuristic parsing
      if (expression.includes("*") && expression.includes("y") && expression.includes("x")) {
        // Try: x^a * y^b = k → y = (k / x^a)^(1/b)
        const match = expression.match(/x\^?([\d.]*)\s*[·×*]\s*y\^?([\d.]*)/);
        if (match) {
          const a = parseFloat(match[1]) || 1;
          const b = parseFloat(match[2]) || 1;
          return (x: number, k: number) => Math.pow(k / Math.pow(x, a), 1 / b);
        }
        // Simple x * y = k
        return (x: number, k: number) => k / x;
      }
      if (expression.includes("+")) {
        // x + y = k → y = k - x
        return (x: number, k: number) => k - x;
      }
      // Fallback
      return (x: number, k: number) => k / x;
    } catch {
      return null;
    }
  }, [expression, presetId]);

  const insertSymbol = useCallback((sym: string) => {
    setExpression(prev => prev + sym);
    setSelectedPreset(4); // custom
  }, []);

  const curveData = useMemo(() => {
    const data = [];
    for (let i = 1; i <= 100; i++) {
      const x = i * 2;
      const y = evalCurve(presetId, x, kValue, weightA, weightB, amplification, rangeLower, rangeUpper, customFn);
      if (y !== null && y > 0 && y < kValue * 10) data.push({ x, y: parseFloat(y.toFixed(2)) });
    }
    return data;
  }, [presetId, weightA, weightB, kValue, amplification, rangeLower, rangeUpper, customFn]);

  const spotPriceData = useMemo(() => {
    return curveData.map((point, i) => {
      if (i === 0) return { x: point.x, spotPrice: 0 };
      const dx = point.x - curveData[i - 1].x;
      const dy = Math.abs(point.y - curveData[i - 1].y);
      return { x: point.x, spotPrice: parseFloat((dy / dx).toFixed(4)) };
    }).slice(1);
  }, [curveData]);

  const convexityData = useMemo(() => {
    return spotPriceData.map((point, i) => {
      if (i === 0) return { x: point.x, convexity: 0 };
      const dx = point.x - spotPriceData[i - 1].x;
      const dSpot = Math.abs(point.spotPrice - spotPriceData[i - 1].spotPrice);
      return { x: point.x, convexity: parseFloat((dSpot / dx).toFixed(6)) };
    }).slice(1);
  }, [spotPriceData]);

  return (
    <div className="space-y-6">
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Code2 className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Invariant Expression</h3>
          <HelpBtn id="invariantCurve" />
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {presets.map((p, i) => (
            <button key={p.label} onClick={() => { setSelectedPreset(i); if (p.expr) setExpression(p.expr); if (p.id === "wt") { setWeightA(0.4); setWeightB(0.6); } else if (p.id === "cp") { setWeightA(0.5); setWeightB(0.5); } }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                selectedPreset === i ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"
              }`}>{p.label}</button>
          ))}
        </div>

        {/* Expression input with math keyboard */}
        <div className="space-y-2">
          <div className="relative">
            <input value={expression} onChange={e => { setExpression(e.target.value); setSelectedPreset(4); }}
              className="w-full bg-muted border border-border rounded-lg px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/30 transition-colors"
              placeholder="Enter invariant expression (e.g., x^w1 · y^w2 = k)" />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-secondary text-foreground hover:bg-secondary/80 transition-colors">
              <Play className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Math keyboard */}
          <div className="flex gap-1 flex-wrap">
            {MATH_SYMBOLS.map(s => (
              <button key={s.label} onClick={() => insertSymbol(s.insert)}
                className="w-8 h-8 rounded-md bg-secondary border border-border text-xs font-mono text-foreground hover:bg-accent transition-colors flex items-center justify-center">
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Parameters */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          {(presetId === "cp" || presetId === "wt" || presetId === "custom") && (
            <>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-[11px] text-muted-foreground">Weight A (w₁)</label>
                  <HelpBtn id="weightA" />
                </div>
                <input type="range" min="0.1" max="0.9" step="0.05" value={weightA}
                  onChange={e => { setWeightA(Number(e.target.value)); setWeightB(1 - Number(e.target.value)); }}
                  className="w-full accent-foreground" />
                <span className="text-xs font-mono text-foreground">{weightA.toFixed(2)}</span>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-[11px] text-muted-foreground">Weight B (w₂)</label>
                  <HelpBtn id="weightB" />
                </div>
                <input type="range" min="0.1" max="0.9" step="0.05" value={weightB}
                  onChange={e => setWeightB(Number(e.target.value))} className="w-full accent-foreground" disabled />
                <span className="text-xs font-mono text-foreground">{weightB.toFixed(2)}</span>
              </div>
            </>
          )}
          {presetId === "ss" && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-[11px] text-muted-foreground">Amplification (A)</label>
                <HelpBtn id="amplification" />
              </div>
              <input type="range" min="1" max="1000" step="1" value={amplification}
                onChange={e => setAmplification(Number(e.target.value))} className="w-full accent-foreground" />
              <span className="text-xs font-mono text-foreground">{amplification}</span>
            </div>
          )}
          {presetId === "cl" && (
            <>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-[11px] text-muted-foreground">Range Lower</label>
                  <HelpBtn id="rangeLower" />
                </div>
                <input type="range" min="0.1" max={rangeUpper - 0.01} step="0.01" value={rangeLower}
                  onChange={e => setRangeLower(Number(e.target.value))} className="w-full accent-foreground" />
                <span className="text-xs font-mono text-foreground">{rangeLower.toFixed(2)}</span>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-[11px] text-muted-foreground">Range Upper</label>
                  <HelpBtn id="rangeUpper" />
                </div>
                <input type="range" min={rangeLower + 0.01} max="5" step="0.01" value={rangeUpper}
                  onChange={e => setRangeUpper(Number(e.target.value))} className="w-full accent-foreground" />
                <span className="text-xs font-mono text-foreground">{rangeUpper.toFixed(2)}</span>
              </div>
            </>
          )}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[11px] text-muted-foreground">k (invariant)</label>
              <HelpBtn id="kValue" />
            </div>
            <input type="number" value={kValue} onChange={e => setKValue(Number(e.target.value))}
              className="w-full bg-secondary border border-border rounded-md px-3 py-1.5 text-xs font-mono text-foreground outline-none" />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <ChartPanel title="Invariant Curve" subtitle="Token reserves relationship" helpId="invariantCurve" data={curveData} dataKey="y" color={colors.line} colors={colors} />
        <ChartPanel title="Spot Price" subtitle="−dy/dx (marginal price)" helpId="spotPrice" data={spotPriceData} dataKey="spotPrice" color={colors.green} colors={colors} />
        <ChartPanel title="Convexity" subtitle="d²y/dx² (curvature)" helpId="convexity" data={convexityData} dataKey="convexity" color={colors.red} colors={colors} />
      </div>

      <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Auto-derived Properties</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DerivedProp label="Spot Price at x=100" value={spotPriceData.length > 10 ? spotPriceData[10].spotPrice.toFixed(4) : "—"} />
          <DerivedProp label="Liquidity Density" value={presetId === "cp" ? "Uniform" : presetId === "ss" ? "Concentrated" : presetId === "cl" ? "Range-bound" : "Weighted"} />
          <DerivedProp label="Convexity Profile" value={presetId === "cp" ? "Hyperbolic" : presetId === "ss" ? "Flat" : presetId === "cl" ? "Bounded" : "Power"} />
          <DerivedProp label="Reserve Ratio" value={presetId === "cl" ? `${rangeLower.toFixed(2)}–${rangeUpper.toFixed(2)}` : `${(weightA * 100).toFixed(0)}/${(weightB * 100).toFixed(0)}`} />
        </div>
      </motion.div>
    </div>
  );
};

const ChartPanel = ({ title, subtitle, helpId, data, dataKey, color, colors }: { title: string; subtitle: string; helpId?: string; data: any[]; dataKey: string; color: string; colors: ReturnType<typeof useChartColors> }) => (
  <div className="surface-elevated rounded-xl p-4">
    <div className="flex items-center gap-1.5 mb-0.5">
      <h4 className="text-xs font-semibold text-foreground">{title}</h4>
      {helpId && <HelpBtn id={helpId} />}
    </div>
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
