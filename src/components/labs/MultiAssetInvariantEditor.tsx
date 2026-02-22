import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Code2, HelpCircle, AlertTriangle, CheckCircle, Save, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Asset, AssetTable, Surface3D, PriceHeatmap, LiquidityRadar, DerivedMetrics,
  MultiAssetOptimizer, PairwiseSliceSelector,
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

export default function MultiAssetInvariantEditor({
  assets, onAssetsChange, onAddAsset, onRemoveAsset, onApplyWeights,
  onSaveInvariant, savedInvariant,
}: MultiAssetInvariantEditorProps) {
  const colors = useChartColors();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kValue, setKValue] = useState(savedInvariant?.kValue ?? 10000);
  const [isCustomExpr, setIsCustomExpr] = useState(false);
  const [customExpression, setCustomExpression] = useState("");
  const [vizMode, setVizMode] = useState<"surface" | "heatmap" | "radar" | "metrics">("surface");
  const [axisI, setAxisI] = useState(0);
  const [axisJ, setAxisJ] = useState(1);
  const [fixedValues, setFixedValues] = useState<number[]>([]);

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
    const totalWeight = assets.reduce((s, a) => s + a.weight, 0);
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
              {assets.map((a, i) => (
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
          <div className="flex gap-1.5">
            {(["surface", "heatmap", "radar", "metrics"] as const).map(m => (
              <button key={m} onClick={() => setVizMode(m)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all capitalize ${vizMode === m ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"}`}>
                {m === "surface" ? "Pairwise Curves" : m === "heatmap" ? "Price Matrix" : m === "radar" ? "Liquidity Radar" : "Swap Metrics"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            {vizMode === "surface" && <Surface3D assets={displayAssets} axisI={axisI} axisJ={axisJ} />}
            {vizMode === "heatmap" && <PriceHeatmap assets={displayAssets} />}
            {vizMode === "radar" && <LiquidityRadar assets={displayAssets} />}
            {vizMode === "metrics" && <DerivedMetrics assets={displayAssets} />}
          </div>
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
        </div>
      </div>

      {/* Section 3: Optimizer */}
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Multi-Asset Optimizer</h3>
        </div>
        <MultiAssetOptimizer assets={assets} onApply={onApplyWeights} />
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
