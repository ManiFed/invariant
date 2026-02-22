import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Code2, Play, Zap, HelpCircle, AlertTriangle, CheckCircle } from "lucide-react";
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

const MATH_KEYBOARD = [
  { label: "x", insert: "x", group: "var" },
  { label: "y", insert: "y", group: "var" },
  { label: "k", insert: "k", group: "var" },
  { label: "π", insert: "π", group: "const" },
  { label: "e", insert: "e", group: "const" },
  { label: "+", insert: " + ", group: "op" },
  { label: "−", insert: " - ", group: "op" },
  { label: "×", insert: " * ", group: "op" },
  { label: "÷", insert: " / ", group: "op" },
  { label: "^", insert: "^", group: "op" },
  { label: "=", insert: " = ", group: "op" },
  { label: "(", insert: "(", group: "bracket" },
  { label: ")", insert: ")", group: "bracket" },
  { label: "√", insert: "sqrt(", group: "func" },
  { label: "ln", insert: "ln(", group: "func" },
  { label: "log", insert: "log(", group: "func" },
  { label: "abs", insert: "abs(", group: "func" },
  { label: "min", insert: "min(", group: "func" },
  { label: "max", insert: "max(", group: "func" },
  { label: "α", insert: "α", group: "greek" },
  { label: "β", insert: "β", group: "greek" },
  { label: "γ", insert: "γ", group: "greek" },
];

// Validate and parse custom expression
function validateExpression(expr: string): { valid: boolean; error: string | null; parsed: string } {
  if (!expr.trim()) return { valid: false, error: "Expression is empty", parsed: "" };
  
  // Check for required variables
  if (!expr.includes("x") && !expr.includes("y")) {
    return { valid: false, error: "Expression must contain at least 'x' or 'y' reserve variables", parsed: "" };
  }

  // Check balanced parentheses
  let depth = 0;
  for (const ch of expr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) return { valid: false, error: "Unexpected closing parenthesis ')' — check your bracket placement", parsed: "" };
  }
  if (depth > 0) return { valid: false, error: `Missing ${depth} closing parenthes${depth > 1 ? "es" : "is"} — add ')' to balance`, parsed: "" };

  // Check for dangling operators
  const trimmed = expr.trim();
  if (/[+\-*/^]\s*$/.test(trimmed)) {
    const lastOp = trimmed.match(/[+\-*/^]\s*$/)?.[0]?.trim();
    return { valid: false, error: `Expression ends with '${lastOp}' — add a value or variable after it`, parsed: "" };
  }
  if (/^[*/^]/.test(trimmed)) {
    return { valid: false, error: `Expression starts with an operator — add a value before '${trimmed[0]}'`, parsed: "" };
  }

  // Check for consecutive operators
  if (/[+\-*/^]\s*[+*/^]/.test(trimmed)) {
    return { valid: false, error: "Two operators next to each other — remove one or add a value between them", parsed: "" };
  }

  // Check for empty function calls
  const emptyFunc = trimmed.match(/(sqrt|ln|log|abs|min|max)\(\s*\)/);
  if (emptyFunc) {
    return { valid: false, error: `${emptyFunc[1]}() is empty — put a value inside the parentheses`, parsed: "" };
  }

  return { valid: true, error: null, parsed: trimmed };
}

// Evaluate curve: given x, k, and parameters, compute y
function evalCurve(preset: string, x: number, k: number, wA: number, wB: number, amp: number, rLow: number, rHigh: number, customFn: ((x: number, k: number) => number) | null): number | null {
  try {
    switch (preset) {
      case "cp": return k / x;
      case "ss": {
        const y = (k - amp * x) / (1 + amp * x / k);
        return y > 0 ? y : null;
      }
      case "wt": return Math.pow(k / Math.pow(x, wA), 1 / wB);
      case "cl": {
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
        return k / x;
      default: return k / x;
    }
  } catch {
    return null;
  }
}

const InvariantEditor = () => {
  const colors = useChartColors();
  const inputRef = useRef<HTMLInputElement>(null);
  const [expression, setExpression] = useState("x * y = k");
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [weightA, setWeightA] = useState(0.5);
  const [weightB, setWeightB] = useState(0.5);
  const [kValue, setKValue] = useState(10000);
  const [amplification, setAmplification] = useState(100);
  const [rangeLower, setRangeLower] = useState(0.8);
  const [rangeUpper, setRangeUpper] = useState(1.2);

  const presetId = presets[selectedPreset]?.id || "cp";

  // Validate expression in real-time
  const validation = useMemo(() => {
    if (presetId !== "custom") return { valid: true, error: null, parsed: expression };
    return validateExpression(expression);
  }, [expression, presetId]);

  // Parse custom expression into a function
  const customFn = useMemo(() => {
    if (presetId !== "custom" || !validation.valid) return null;
    try {
      let expr = expression;
      // Remove "= k" part
      expr = expr.replace(/\s*=\s*k\s*$/i, "").trim();
      
      // x^a * y^b pattern
      const weightMatch = expr.match(/x\^?([\d.]*)\s*[·×*]\s*y\^?([\d.]*)/);
      if (weightMatch) {
        const a = parseFloat(weightMatch[1]) || 1;
        const b = parseFloat(weightMatch[2]) || 1;
        return (x: number, k: number) => Math.pow(k / Math.pow(x, a), 1 / b);
      }

      // sqrt(x * y) or √(x·y)
      if (/sqrt\s*\(\s*x\s*[*·×]\s*y\s*\)/.test(expr) || /√\s*\(\s*x\s*[*·×]\s*y\s*\)/.test(expr)) {
        return (x: number, k: number) => (k * k) / x;
      }

      // x + y pattern (constant sum)
      if (/^x\s*\+\s*y$/.test(expr.trim())) {
        return (x: number, k: number) => k - x;
      }

      // x^a + y^b pattern
      const sumMatch = expr.match(/x\^([\d.]+)\s*\+\s*y\^([\d.]+)/);
      if (sumMatch) {
        const a = parseFloat(sumMatch[1]);
        const b = parseFloat(sumMatch[2]);
        return (x: number, k: number) => {
          const rem = k - Math.pow(x, a);
          return rem > 0 ? Math.pow(rem, 1 / b) : null;
        };
      }

      // Fallback: treat as x * y
      if (expr.includes("x") && expr.includes("y")) {
        return (x: number, k: number) => k / x;
      }
      
      return null;
    } catch {
      return null;
    }
  }, [expression, presetId, validation.valid]);

  const insertAtCursor = useCallback((sym: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? expression.length;
      const end = input.selectionEnd ?? expression.length;
      const newExpr = expression.slice(0, start) + sym + expression.slice(end);
      setExpression(newExpr);
      setSelectedPreset(4);
      // Restore cursor position after render
      setTimeout(() => {
        input.focus();
        const newPos = start + sym.length;
        input.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      setExpression(prev => prev + sym);
      setSelectedPreset(4);
    }
  }, [expression]);

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

        {/* Expression input with validation */}
        <div className="space-y-2">
          <div className="relative">
            <input ref={inputRef} value={expression}
              onChange={e => { setExpression(e.target.value); setSelectedPreset(4); }}
              onKeyDown={e => {
                // Allow typing math characters naturally
                if (e.key === "*" || e.key === "/" || e.key === "+" || e.key === "-" || e.key === "^" || e.key === "(" || e.key === ")") {
                  // Let default behavior handle it
                }
              }}
              className={`w-full bg-muted border rounded-lg px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors ${
                presetId === "custom" && !validation.valid ? "border-destructive/50 focus:border-destructive" : "border-border focus:border-foreground/30"
              }`}
              placeholder="Enter invariant expression (e.g., x^0.6 * y^0.4 = k)"
              spellCheck={false}
              autoComplete="off"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {presetId === "custom" && (
                <span className="mr-1">
                  {validation.valid ? (
                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                  )}
                </span>
              )}
              <button onClick={() => { setSelectedPreset(4); }}
                className="p-1.5 rounded-md bg-secondary text-foreground hover:bg-secondary/80 transition-colors">
                <Play className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Syntax error message */}
          <AnimatePresence>
            {presetId === "custom" && validation.error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-destructive">Syntax Error</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{validation.error}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Enhanced math keyboard */}
          <div className="space-y-1.5">
            <div className="flex gap-0.5 flex-wrap">
              <span className="text-[8px] text-muted-foreground w-8 flex items-center">Vars</span>
              {MATH_KEYBOARD.filter(s => s.group === "var" || s.group === "const").map(s => (
                <button key={s.label} onClick={() => insertAtCursor(s.insert)}
                  className="w-8 h-7 rounded-md bg-secondary border border-border text-[11px] font-mono text-foreground hover:bg-accent transition-colors flex items-center justify-center">
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-0.5 flex-wrap">
              <span className="text-[8px] text-muted-foreground w-8 flex items-center">Ops</span>
              {MATH_KEYBOARD.filter(s => s.group === "op" || s.group === "bracket").map(s => (
                <button key={s.label} onClick={() => insertAtCursor(s.insert)}
                  className="w-8 h-7 rounded-md bg-secondary border border-border text-[11px] font-mono text-foreground hover:bg-accent transition-colors flex items-center justify-center">
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-0.5 flex-wrap">
              <span className="text-[8px] text-muted-foreground w-8 flex items-center">Funcs</span>
              {MATH_KEYBOARD.filter(s => s.group === "func").map(s => (
                <button key={s.label} onClick={() => insertAtCursor(s.insert)}
                  className="px-2 h-7 rounded-md bg-secondary border border-border text-[10px] font-mono text-foreground hover:bg-accent transition-colors flex items-center justify-center">
                  {s.label}
                </button>
              ))}
              {MATH_KEYBOARD.filter(s => s.group === "greek").map(s => (
                <button key={s.label} onClick={() => insertAtCursor(s.insert)}
                  className="w-8 h-7 rounded-md bg-secondary border border-border text-[11px] font-mono text-foreground hover:bg-accent transition-colors flex items-center justify-center">
                  {s.label}
                </button>
              ))}
            </div>
            {/* Quick templates */}
            <div className="flex gap-1 flex-wrap mt-1">
              <span className="text-[8px] text-muted-foreground flex items-center mr-1">Templates:</span>
              {[
                { label: "x·y = k", val: "x * y = k" },
                { label: "x^a·y^b", val: "x^0.5 * y^0.5 = k" },
                { label: "√(x·y)", val: "sqrt(x * y) = k" },
                { label: "x + y", val: "x + y = k" },
                { label: "x³ + y³", val: "x^3 + y^3 = k" },
              ].map(t => (
                <button key={t.label} onClick={() => { setExpression(t.val); setSelectedPreset(4); }}
                  className="px-2 py-0.5 rounded text-[9px] font-mono text-muted-foreground hover:text-foreground bg-muted border border-border hover:bg-accent transition-colors">
                  {t.label}
                </button>
              ))}
            </div>
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
          <DerivedProp label="Liquidity Density" value={presetId === "cp" ? "Uniform" : presetId === "ss" ? "Concentrated" : presetId === "cl" ? "Range-bound" : presetId === "custom" ? "Custom" : "Weighted"} />
          <DerivedProp label="Convexity Profile" value={presetId === "cp" ? "Hyperbolic" : presetId === "ss" ? "Flat" : presetId === "cl" ? "Bounded" : presetId === "custom" ? "Varies" : "Power"} />
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
