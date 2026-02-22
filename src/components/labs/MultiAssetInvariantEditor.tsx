import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Code2, HelpCircle, AlertTriangle, CheckCircle, Save, Zap, Maximize2, Minimize2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Cell } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Asset, AssetTable, Surface3D, PriceHeatmap, LiquidityRadar, DerivedMetrics,
  AdvancedMultiAssetOptimizer, PairwiseSliceSelector,
} from "@/components/labs/MultiAssetComponents";

interface SavedInvariant {
  expression: string;
  presetId: string;
  weightA: number;
  weightB: number;
  kValue: number;
  amplification: number;
  rangeLower: number;
  rangeUpper: number;
}

interface MultiAssetInvariantEditorProps {
  assets: Asset[];
  onAssetsChange: (assets: Asset[]) => void;
  onAddAsset: () => void;
  onRemoveAsset: (id: string) => void;
  onApplyWeights: (weights: number[]) => void;
  onSaveInvariant?: (inv: SavedInvariant) => void;
  savedInvariant?: SavedInvariant | null;
}

const HELP: Record<string, { title: string; desc: string }> = {
  kValue: { title: "k (Invariant Constant)", desc: "The constant product that the multi-asset formula maintains. Larger k means deeper liquidity across all pairs." },
  expression: { title: "Multi-Asset Invariant", desc: "The invariant is auto-generated from your asset weights: Πᵢ(xᵢ^wᵢ) = k. You can also write a custom expression." },
  invariantCurve: { title: "Pairwise Curves", desc: "Shows the invariant curve between any two assets while holding others fixed. Use the slice selector to explore different pairs." },
  ternary: { title: "Ternary Heatmap", desc: "Triangle represents the full 3-asset state space. Each point is a reserve composition, colored by the selected metric." },
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
  { label: "+", insert: " + ", group: "op" },
  { label: "−", insert: " - ", group: "op" },
  { label: "×", insert: " * ", group: "op" },
  { label: "÷", insert: " / ", group: "op" },
  { label: "^", insert: "^", group: "op" },
  { label: "=", insert: " = ", group: "op" },
  { label: "(", insert: "(", group: "op" },
  { label: ")", insert: ")", group: "op" },
  { label: "√", insert: "sqrt(", group: "func" },
  { label: "ln", insert: "ln(", group: "func" },
  { label: "Σ", insert: "sum(", group: "func" },
  { label: "Π", insert: "prod(", group: "func" },
];

function spotPrice(rI: number, wI: number, rJ: number, wJ: number): number {
  return (rJ / wJ) / (rI / wI);
}

// Ternary coordinate helpers (for 3-asset triangle)
function ternaryToCartesian(a: number, b: number, c: number): { x: number; y: number } {
  const sum = a + b + c;
  const na = a / sum, nb = b / sum, nc = c / sum;
  return {
    x: 0.5 * (2 * nb + nc),
    y: (Math.sqrt(3) / 2) * nc,
  };
}

type TernaryMetric = "fees" | "slippage" | "lpReturn" | "divergence";

function computeTernaryData(assets: Asset[], metric: TernaryMetric, resolution: number = 20) {
  if (assets.length < 3) return [];
  const data: { x: number; y: number; value: number; a: number; b: number; c: number }[] = [];
  const totalReserve = assets[0].reserve + assets[1].reserve + assets[2].reserve;

  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution - i; j++) {
      const k = resolution - i - j;
      const a = i / resolution;
      const b = j / resolution;
      const c = k / resolution;
      if (a < 0.02 || b < 0.02 || c < 0.02) continue;

      const rA = a * totalReserve;
      const rB = b * totalReserve;
      const rC = c * totalReserve;
      const { x, y } = ternaryToCartesian(a, b, c);

      let value = 0;
      switch (metric) {
        case "fees": {
          // Fee efficiency: how balanced the pool is (entropy-like)
          const entropy = -(a * Math.log(a) + b * Math.log(b) + c * Math.log(c)) / Math.log(3);
          value = entropy * 100;
          break;
        }
        case "slippage": {
          // Average slippage across pairs
          const s1 = Math.abs(1 - spotPrice(rA, assets[0].weight, rB, assets[1].weight));
          const s2 = Math.abs(1 - spotPrice(rB, assets[1].weight, rC, assets[2].weight));
          const s3 = Math.abs(1 - spotPrice(rA, assets[0].weight, rC, assets[2].weight));
          value = ((s1 + s2 + s3) / 3) * 100;
          break;
        }
        case "lpReturn": {
          // Simulated LP return based on weight alignment
          const wDiff = Math.abs(a - assets[0].weight) + Math.abs(b - assets[1].weight) + Math.abs(c - assets[2].weight);
          value = (1 - wDiff) * 100;
          break;
        }
        case "divergence": {
          // Divergence from optimal weights
          const d = Math.sqrt(
            Math.pow(a - assets[0].weight, 2) +
            Math.pow(b - assets[1].weight, 2) +
            Math.pow(c - assets[2].weight, 2)
          );
          value = d * 100;
          break;
        }
      }
      data.push({ x, y, value, a, b, c });
    }
  }
  return data;
}

export default function MultiAssetInvariantEditor({
  assets, onAssetsChange, onAddAsset, onRemoveAsset, onApplyWeights,
  onSaveInvariant, savedInvariant,
}: MultiAssetInvariantEditorProps) {
  const colors = useChartColors();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kValue, setKValue] = useState(savedInvariant?.kValue ?? 10000);
  const [isCustomExpr, setIsCustomExpr] = useState(false);
  const [customExpression, setCustomExpression] = useState("");
  const [vizMode, setVizMode] = useState<"surface" | "heatmap" | "radar" | "metrics" | "ternary">("surface");
  const [vizExpanded, setVizExpanded] = useState(false);
  const [axisI, setAxisI] = useState(0);
  const [axisJ, setAxisJ] = useState(1);
  const [fixedValues, setFixedValues] = useState<number[]>([]);
  const [ternaryMetric, setTernaryMetric] = useState<TernaryMetric>("fees");

  // Auto-generated expression from assets
  const autoExpression = assets.map(a => `${a.symbol}^${a.weight}`).join(" · ") + " = k";
  const expression = isCustomExpr ? customExpression : autoExpression;

  const handleFixedChange = (idx: number, val: number) => {
    setFixedValues(prev => { const next = [...prev]; next[idx] = val; return next; });
  };

  const displayAssets = useMemo(() =>
    assets.map((a, i) => ({ ...a, reserve: (i !== axisI && i !== axisJ && fixedValues[i]) ? fixedValues[i] : a.reserve })),
    [assets, axisI, axisJ, fixedValues]
  );

  // Compute pairwise spot price data for the selected pair
  const pairCurveData = useMemo(() => {
    if (assets.length < 2) return [];
    const ai = assets[axisI];
    const aj = assets[axisJ];
    if (!ai || !aj) return [];
    const data: { x: number; spotPrice: number }[] = [];
    const baseReserve = ai.reserve;
    for (let i = 1; i <= 40; i++) {
      const x = (baseReserve * 2 * i) / 40;
      const sp = spotPrice(x, ai.weight, aj.reserve, aj.weight);
      if (isFinite(sp) && sp > 0 && sp < aj.reserve * 10) {
        data.push({ x: parseFloat(x.toFixed(2)), spotPrice: parseFloat(sp.toFixed(4)) });
      }
    }
    return data;
  }, [assets, axisI, axisJ]);

  // Ternary heatmap data
  const ternaryData = useMemo(() => {
    if (assets.length < 3 || vizMode !== "ternary") return [];
    return computeTernaryData(assets, ternaryMetric, 25);
  }, [assets, ternaryMetric, vizMode]);

  const insertAtCursor = useCallback((sym: string) => {
    if (!isCustomExpr) {
      setIsCustomExpr(true);
      setCustomExpression(autoExpression + sym);
      return;
    }
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? customExpression.length;
      const end = input.selectionEnd ?? customExpression.length;
      const newExpr = customExpression.slice(0, start) + sym + customExpression.slice(end);
      setCustomExpression(newExpr);
      setTimeout(() => { input.focus(); const newPos = start + sym.length; input.setSelectionRange(newPos, newPos); }, 0);
    } else {
      setCustomExpression(prev => prev + sym);
    }
  }, [isCustomExpr, customExpression, autoExpression]);

  const handleSave = () => {
    if (!onSaveInvariant) return;
    onSaveInvariant({
      expression,
      presetId: "custom",
      weightA: assets[0]?.weight ?? 0.5,
      weightB: assets[1]?.weight ?? 0.5,
      kValue,
      amplification: 10,
      rangeLower: 0.5,
      rangeUpper: 2.0,
    });
  };

  const totalWeight = assets.reduce((s, a) => s + a.weight, 0);

  // Color scale for ternary
  const getColor = (value: number, max: number) => {
    const t = Math.min(1, value / (max || 1));
    if (ternaryMetric === "divergence" || ternaryMetric === "slippage") {
      // Red = bad
      const r = Math.round(50 + t * 200);
      const g = Math.round(200 - t * 150);
      return `rgb(${r}, ${g}, 80)`;
    }
    // Green = good
    const r = Math.round(200 - t * 150);
    const g = Math.round(80 + t * 120);
    return `rgb(${r}, ${g}, 80)`;
  };

  const ternaryMax = ternaryData.length > 0 ? Math.max(...ternaryData.map(d => d.value)) : 1;

  return (
    <div className="space-y-6">
      {/* Section 1: Define Assets */}
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Multi-Asset Invariant Designer</h3>
            <HelpBtn id="expression" />
          </div>
          {onSaveInvariant && (
            <button onClick={handleSave}
              disabled={Math.abs(totalWeight - 1) >= 0.01}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              <Save className="w-3 h-3" /> Set as Active Invariant
            </button>
          )}
        </div>

        {/* Asset Table */}
        <AssetTable assets={assets} onChange={onAssetsChange} onAdd={onAddAsset} onRemove={onRemoveAsset} />

        {/* Expression display */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-muted-foreground">Invariant Expression</span>
            <button
              onClick={() => { setIsCustomExpr(!isCustomExpr); if (!isCustomExpr) setCustomExpression(autoExpression); }}
              className={`text-[9px] px-2 py-0.5 rounded border transition-all ${isCustomExpr ? "border-primary/30 bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {isCustomExpr ? "Custom" : "Auto"}
            </button>
          </div>
          {isCustomExpr ? (
            <input ref={inputRef} value={customExpression}
              onChange={e => setCustomExpression(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/30 transition-colors"
              placeholder="Custom multi-asset expression"
              spellCheck={false} autoComplete="off" />
          ) : (
            <div className="w-full bg-muted border border-border rounded-lg px-4 py-3 font-mono text-sm text-foreground">
              {autoExpression}
            </div>
          )}

          {/* Math keyboard for custom mode */}
          {isCustomExpr && (
            <div className="flex gap-0.5 flex-wrap">
              <span className="text-[8px] text-muted-foreground w-8 flex items-center">Vars</span>
              {assets.map((a) => (
                <button key={a.id} onClick={() => insertAtCursor(a.symbol)}
                  className="px-2 h-7 rounded-md bg-secondary border border-border text-[10px] font-mono text-foreground hover:bg-accent transition-colors flex items-center justify-center"
                  style={{ borderColor: a.color + "40" }}>
                  {a.symbol}
                </button>
              ))}
              <span className="text-[8px] text-muted-foreground w-6 flex items-center ml-2">k</span>
              <button onClick={() => insertAtCursor("k")}
                className="w-8 h-7 rounded-md bg-secondary border border-border text-[11px] font-mono text-foreground hover:bg-accent transition-colors flex items-center justify-center">
                k
              </button>
              {MATH_KEYBOARD.map(s => (
                <button key={s.label} onClick={() => insertAtCursor(s.insert)}
                  className="w-8 h-7 rounded-md bg-secondary border border-border text-[11px] font-mono text-foreground hover:bg-accent transition-colors flex items-center justify-center">
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* k value */}
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-muted-foreground">k (invariant)</label>
              <HelpBtn id="kValue" />
            </div>
            <input type="number" value={kValue} onChange={e => setKValue(Number(e.target.value))}
              className="w-32 bg-secondary border border-border rounded-md px-3 py-1.5 text-xs font-mono text-foreground outline-none" />
          </div>
        </div>
      </div>

      {/* Section 2: Visualizations */}
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Multi-Asset Visualizations</h3>
            <HelpBtn id="invariantCurve" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {(["surface", "heatmap", "radar", "metrics", ...(assets.length >= 3 ? ["ternary" as const] : [])] as const).map(m => (
                <button key={m} onClick={() => setVizMode(m as any)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all capitalize ${vizMode === m ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"}`}>
                  {m === "surface" ? "Pairwise Curves" : m === "heatmap" ? "Price Matrix" : m === "radar" ? "Liquidity Radar" : m === "ternary" ? "Ternary Heatmap" : "Swap Metrics"}
                </button>
              ))}
            </div>
            {vizMode !== "surface" && (
              <button onClick={() => setVizExpanded(!vizExpanded)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title={vizExpanded ? "Collapse" : "Expand"}>
                {vizExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {vizMode === "ternary" && assets.length >= 3 ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] text-muted-foreground">Metric:</span>
              {(["fees", "slippage", "lpReturn", "divergence"] as TernaryMetric[]).map(m => (
                <button key={m} onClick={() => setTernaryMetric(m)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all capitalize ${ternaryMetric === m ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"}`}>
                  {m === "lpReturn" ? "LP Return" : m}
                </button>
              ))}
              <HelpBtn id="ternary" />
            </div>
            <div className={`${vizExpanded ? "h-[500px]" : "h-80"} transition-all relative`}>
              {/* SVG Triangle */}
              <svg viewBox="-0.05 -0.05 1.1 1.0" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                {/* Triangle border */}
                <polygon
                  points={`${ternaryToCartesian(1,0,0).x},${0.866 - ternaryToCartesian(1,0,0).y} ${ternaryToCartesian(0,1,0).x},${0.866 - ternaryToCartesian(0,1,0).y} ${ternaryToCartesian(0,0,1).x},${0.866 - ternaryToCartesian(0,0,1).y}`}
                  fill="none" stroke="hsl(var(--border))" strokeWidth="0.005"
                />
                {/* Data points */}
                {ternaryData.map((d, i) => (
                  <circle key={i} cx={d.x} cy={0.866 - d.y} r={0.015}
                    fill={getColor(d.value, ternaryMax)} fillOpacity={0.8}
                  />
                ))}
                {/* Current position marker */}
                {(() => {
                  const total = assets[0].reserve + assets[1].reserve + assets[2].reserve;
                  const pos = ternaryToCartesian(assets[0].reserve / total, assets[1].reserve / total, assets[2].reserve / total);
                  return <circle cx={pos.x} cy={0.866 - pos.y} r={0.02} fill="none" stroke="hsl(var(--foreground))" strokeWidth="0.004" />;
                })()}
                {/* Vertex labels */}
                <text x={ternaryToCartesian(1,0,0).x} y={0.866 - ternaryToCartesian(1,0,0).y + 0.05} textAnchor="middle" fontSize="0.035" fill="hsl(var(--foreground))">{assets[0]?.symbol}</text>
                <text x={ternaryToCartesian(0,1,0).x - 0.03} y={0.866 - ternaryToCartesian(0,1,0).y + 0.02} textAnchor="end" fontSize="0.035" fill="hsl(var(--foreground))">{assets[1]?.symbol}</text>
                <text x={ternaryToCartesian(0,0,1).x + 0.03} y={0.866 - ternaryToCartesian(0,0,1).y + 0.02} textAnchor="start" fontSize="0.035" fill="hsl(var(--foreground))">{assets[2]?.symbol}</text>
              </svg>
              {/* Color legend */}
              <div className="absolute bottom-2 right-2 flex items-center gap-2 bg-background/80 rounded-md px-2 py-1 border border-border">
                <div className="w-16 h-2 rounded" style={{ background: ternaryMetric === "divergence" || ternaryMetric === "slippage" ? "linear-gradient(to right, rgb(80,200,80), rgb(250,50,80))" : "linear-gradient(to right, rgb(200,80,80), rgb(80,200,80))" }} />
                <span className="text-[8px] text-muted-foreground">{ternaryMetric === "divergence" || ternaryMetric === "slippage" ? "Low → High" : "Low → High"}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className={vizExpanded && vizMode !== "surface" ? "" : "grid md:grid-cols-3 gap-4"}>
            <div className={vizExpanded && vizMode !== "surface" ? "w-full" : "md:col-span-2"}>
              {vizMode === "surface" && <Surface3D assets={displayAssets} axisI={axisI} axisJ={axisJ} />}
              {vizMode === "heatmap" && <PriceHeatmap assets={displayAssets} expanded={vizExpanded} />}
              {vizMode === "radar" && <LiquidityRadar assets={displayAssets} expanded={vizExpanded} />}
              {vizMode === "metrics" && <DerivedMetrics assets={displayAssets} expanded={vizExpanded} />}
            </div>
            {(!vizExpanded || vizMode === "surface") && (
              <div className="space-y-4">
                <PairwiseSliceSelector
                  assets={assets} axisI={axisI} axisJ={axisJ}
                  onChangeI={setAxisI} onChangeJ={setAxisJ}
                  fixedValues={fixedValues} onFixedChange={handleFixedChange}
                />
                {/* Spot price chart for selected pair */}
                {pairCurveData.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-foreground mb-2">
                      Spot Price: {assets[axisI]?.symbol}/{assets[axisJ]?.symbol}
                    </h4>
                    <div className="h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={pairCurveData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                          <XAxis dataKey="x" tick={{ fontSize: 8, fill: colors.tick }} />
                          <YAxis tick={{ fontSize: 8, fill: colors.tick }} />
                          <Tooltip contentStyle={{ backgroundColor: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10, color: colors.tooltipText }} />
                          <Line type="monotone" dataKey="spotPrice" stroke={colors.green} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Advanced Optimizer */}
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Expression Optimizer</h3>
        </div>
        <AdvancedMultiAssetOptimizer assets={assets} onApply={onApplyWeights} />
      </div>

      {/* Section 4: Derived Properties */}
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Auto-derived Properties</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DerivedProp label="Asset Count" value={`${assets.length} tokens`} />
          <DerivedProp label="Weight Distribution" value={Math.abs(totalWeight - 1) < 0.01 ? "Balanced ✓" : `Σ = ${totalWeight.toFixed(2)} ⚠`} />
          <DerivedProp label="Liquidity Profile" value={assets.every(a => Math.abs(a.weight - 1/assets.length) < 0.05) ? "Uniform" : "Weighted"} />
          <DerivedProp label="Max Weight Ratio" value={`${(Math.max(...assets.map(a => a.weight)) / Math.min(...assets.map(a => a.weight))).toFixed(1)}x`} />
        </div>
      </div>
    </div>
  );
}

const DerivedProp = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
    <p className="text-sm font-semibold font-mono-data text-foreground">{value}</p>
  </div>
);