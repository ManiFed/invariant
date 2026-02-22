import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Play, BarChart3, Grid3X3, Radar, Crosshair, Settings2, Boxes } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useChartColors } from "@/hooks/use-chart-theme";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as ReRadar,
} from "recharts";

/* ─── Types ─── */
interface Asset {
  id: string;
  symbol: string;
  reserve: number;
  weight: number;
  color: string;
}

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function defaultAssets(): Asset[] {
  return [
    { id: "1", symbol: "ETH", reserve: 1000, weight: 0.5, color: COLORS[0] },
    { id: "2", symbol: "USDC", reserve: 1000, weight: 0.3, color: COLORS[1] },
    { id: "3", symbol: "BTC", reserve: 500, weight: 0.2, color: COLORS[2] },
  ];
}

/* ─── Math helpers ─── */
function spotPrice(rI: number, wI: number, rJ: number, wJ: number): number {
  return (rJ / wJ) / (rI / wI);
}

function swapOut(rIn: number, wIn: number, rOut: number, wOut: number, amtIn: number): number {
  const ratio = rIn / (rIn + amtIn);
  return rOut * (1 - Math.pow(ratio, wIn / wOut));
}

/* ─── 3D Surface helpers ─── */
function project3D(x: number, y: number, z: number, angleX = 0.6, angleY = 0.8): { px: number; py: number } {
  const cosX = Math.cos(angleX), sinX = Math.sin(angleX);
  const cosY = Math.cos(angleY), sinY = Math.sin(angleY);
  const px = x * cosY + z * sinY;
  const py = -x * sinY * sinX + y * cosX + z * cosY * sinX;
  return { px, py };
}

function computeSurface(assets: Asset[], axisI: number, axisJ: number, gridSize: number = 20): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  const rI = assets[axisI].reserve;
  const rJ = assets[axisJ].reserve;
  const wI = assets[axisI].weight;
  const wJ = assets[axisJ].weight;
  // Compute k contribution from fixed assets
  let kOther = 1;
  assets.forEach((a, idx) => {
    if (idx !== axisI && idx !== axisJ) kOther *= Math.pow(a.reserve, a.weight);
  });
  const kTotal = Math.pow(rI, wI) * Math.pow(rJ, wJ) * kOther;

  for (let i = 1; i <= gridSize; i++) {
    const xi = (rI * 2 * i) / gridSize;
    const needed = kTotal / (Math.pow(xi, wI) * kOther);
    const yj = Math.pow(needed, 1 / wJ);
    if (isFinite(yj) && yj > 0 && yj < rJ * 10) {
      pts.push({ x: xi, y: yj, z: 0 });
    }
  }
  return pts;
}

/* ─── Components ─── */

function AssetTable({ assets, onChange, onAdd, onRemove }: {
  assets: Asset[];
  onChange: (assets: Asset[]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const updateAsset = (id: string, field: keyof Asset, value: string | number) => {
    onChange(assets.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const totalWeight = assets.reduce((s, a) => s + a.weight, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground">Asset Table</h3>
        <button
          onClick={onAdd}
          disabled={assets.length >= 5}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Plus className="w-3 h-3" /> Add Asset
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1.5 px-2 text-muted-foreground font-medium w-8">#</th>
              <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Symbol</th>
              <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Reserve</th>
              <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Weight</th>
              <th className="text-left py-1.5 px-2 text-muted-foreground font-medium w-8"></th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a, i) => (
              <tr key={a.id} className="border-b border-border/50">
                <td className="py-1.5 px-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: a.color + "20", color: a.color }}>
                    {i + 1}
                  </div>
                </td>
                <td className="py-1.5 px-2">
                  <input
                    value={a.symbol}
                    onChange={e => updateAsset(a.id, "symbol", e.target.value)}
                    className="w-16 px-1.5 py-1 bg-secondary rounded border border-border font-mono text-foreground"
                  />
                </td>
                <td className="py-1.5 px-2">
                  <input
                    type="number"
                    value={a.reserve}
                    onChange={e => updateAsset(a.id, "reserve", Math.max(1, Number(e.target.value)))}
                    className="w-20 px-1.5 py-1 bg-secondary rounded border border-border font-mono text-foreground"
                  />
                </td>
                <td className="py-1.5 px-2">
                  <input
                    type="number"
                    step={0.05}
                    min={0.01}
                    max={0.99}
                    value={a.weight}
                    onChange={e => updateAsset(a.id, "weight", Math.max(0.01, Math.min(0.99, Number(e.target.value))))}
                    className="w-16 px-1.5 py-1 bg-secondary rounded border border-border font-mono text-foreground"
                  />
                </td>
                <td className="py-1.5 px-2">
                  {assets.length > 2 && (
                    <button onClick={() => onRemove(a.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-[9px]">
        <span className="text-muted-foreground">Σ weights = </span>
        <span className={`font-mono font-bold ${Math.abs(totalWeight - 1) < 0.01 ? "text-success" : "text-warning"}`}>
          {totalWeight.toFixed(2)}
        </span>
        {Math.abs(totalWeight - 1) >= 0.01 && (
          <span className="text-warning">⚠ Should equal 1.0</span>
        )}
      </div>

      {/* Expression display */}
      <div className="p-2.5 rounded-lg bg-secondary border border-border">
        <p className="text-[9px] text-muted-foreground mb-1">Multi-Asset Invariant</p>
        <p className="text-xs font-mono text-foreground">
          {assets.map(a => `${a.symbol}^${a.weight}`).join(" · ")} = k
        </p>
      </div>
    </div>
  );
}

function Surface3D({ assets, axisI, axisJ }: { assets: Asset[]; axisI: number; axisJ: number }) {
  const pts = useMemo(() => computeSurface(assets, axisI, axisJ, 40), [assets, axisI, axisJ]);
  const chartData = pts.map(p => ({ x: parseFloat(p.x.toFixed(2)), y: parseFloat(p.y.toFixed(2)) }));

  return (
    <div className="h-64">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] font-mono text-muted-foreground">
          {assets[axisI].symbol} vs {assets[axisJ].symbol} invariant surface
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="x" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" label={{ value: assets[axisI].symbol, position: "insideBottom", offset: -2, fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" label={{ value: assets[axisJ].symbol, angle: -90, position: "insideLeft", fontSize: 9 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "10px", color: "hsl(var(--foreground))" }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Line type="monotone" dataKey="y" stroke={assets[axisI].color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PriceHeatmap({ assets }: { assets: Asset[] }) {
  const matrix = useMemo(() => {
    return assets.map((ai, i) =>
      assets.map((aj, j) => {
        if (i === j) return 1;
        return spotPrice(ai.reserve, ai.weight, aj.reserve, aj.weight);
      })
    );
  }, [assets]);

  const maxVal = Math.max(...matrix.flat().filter(v => v !== 1));

  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold text-foreground flex items-center gap-1.5">
        <Grid3X3 className="w-3 h-3" /> Price Matrix (∂xⱼ/∂xᵢ)
      </h4>
      <div className="overflow-x-auto">
        <table className="text-[9px] font-mono">
          <thead>
            <tr>
              <th className="px-2 py-1 text-muted-foreground"></th>
              {assets.map(a => (
                <th key={a.id} className="px-2 py-1 text-muted-foreground text-center">{a.symbol}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((ai, i) => (
              <tr key={ai.id}>
                <td className="px-2 py-1 text-muted-foreground font-semibold">{ai.symbol}</td>
                {matrix[i].map((val, j) => {
                  const intensity = i === j ? 0 : Math.min(1, val / maxVal);
                  return (
                    <td
                      key={j}
                      className="px-2 py-1 text-center rounded"
                      style={{
                        backgroundColor: i === j ? "hsl(var(--secondary))" : `hsla(var(--chart-1), ${0.1 + intensity * 0.5})`,
                        color: "hsl(var(--foreground))",
                      }}
                    >
                      {val.toFixed(4)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LiquidityRadar({ assets }: { assets: Asset[] }) {
  const data = useMemo(() => {
    return assets.map(a => ({
      subject: a.symbol,
      reserve: a.reserve,
      weight: a.weight * 1000,
      liquidity: a.reserve * a.weight,
    }));
  }, [assets]);

  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold text-foreground flex items-center gap-1.5">
        <Radar className="w-3 h-3" /> Liquidity Distribution
      </h4>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "hsl(var(--foreground))" }} />
            <PolarRadiusAxis tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} />
            <ReRadar name="Liquidity" dataKey="liquidity" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DerivedMetrics({ assets }: { assets: Asset[] }) {
  const pairs = useMemo(() => {
    const result: { from: string; to: string; rate: string; swapOut: string }[] = [];
    for (let i = 0; i < assets.length; i++) {
      for (let j = 0; j < assets.length; j++) {
        if (i === j) continue;
        const rate = spotPrice(assets[i].reserve, assets[i].weight, assets[j].reserve, assets[j].weight);
        const out = swapOut(assets[i].reserve, assets[i].weight, assets[j].reserve, assets[j].weight, assets[i].reserve * 0.01);
        result.push({
          from: assets[i].symbol,
          to: assets[j].symbol,
          rate: rate.toFixed(4),
          swapOut: out.toFixed(2),
        });
      }
    }
    return result;
  }, [assets]);

  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold text-foreground flex items-center gap-1.5">
        <Settings2 className="w-3 h-3" /> Swap Rates (1% of reserve)
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-[9px] font-mono">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1 px-1.5 text-muted-foreground">Pair</th>
              <th className="text-right py-1 px-1.5 text-muted-foreground">Spot Rate</th>
              <th className="text-right py-1 px-1.5 text-muted-foreground">Output (1%)</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p, i) => (
              <tr key={i} className="border-b border-border/30">
                <td className="py-1 px-1.5 text-foreground">{p.from} → {p.to}</td>
                <td className="py-1 px-1.5 text-right text-foreground">{p.rate}</td>
                <td className="py-1 px-1.5 text-right text-chart-2">{p.swapOut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MultiAssetOptimizer({ assets, onApply }: { assets: Asset[]; onApply: (weights: number[]) => void }) {
  const [objective, setObjective] = useState<"equal" | "minSlippage" | "maxEfficiency">("equal");

  const optimize = () => {
    let newWeights: number[];
    switch (objective) {
      case "equal":
        newWeights = assets.map(() => 1 / assets.length);
        break;
      case "minSlippage": {
        const totalReserve = assets.reduce((s, a) => s + a.reserve, 0);
        newWeights = assets.map(a => a.reserve / totalReserve);
        break;
      }
      case "maxEfficiency": {
        const totalVal = assets.reduce((s, a) => s + Math.sqrt(a.reserve), 0);
        newWeights = assets.map(a => Math.sqrt(a.reserve) / totalVal);
        break;
      }
    }
    onApply(newWeights);
  };

  return (
    <div className="space-y-3 p-3 rounded-lg bg-secondary border border-border">
      <h4 className="text-[10px] font-bold text-foreground">Multi-Asset Optimizer</h4>
      <div className="space-y-1">
        {([
          { id: "equal" as const, label: "Equal Weight", desc: "Distribute weights evenly across all assets" },
          { id: "minSlippage" as const, label: "Min Slippage", desc: "Weight proportional to reserves — minimize slippage for balanced trades" },
          { id: "maxEfficiency" as const, label: "Max Efficiency", desc: "Weight by √reserve — optimize capital efficiency" },
        ]).map(opt => (
          <button
            key={opt.id}
            onClick={() => setObjective(opt.id)}
            className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all text-[10px] ${
              objective === opt.id
                ? "border-primary/30 bg-primary/5 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-background"
            }`}
          >
            <p className="font-medium">{opt.label}</p>
            <p className="text-[9px] text-muted-foreground">{opt.desc}</p>
          </button>
        ))}
      </div>
      <button
        onClick={optimize}
        className="w-full px-3 py-2 text-[10px] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Apply Optimization
      </button>
    </div>
  );
}

/* ─── Pairwise Slice Selector ─── */
function PairwiseSliceSelector({ assets, axisI, axisJ, onChangeI, onChangeJ, fixedValues, onFixedChange }: {
  assets: Asset[];
  axisI: number;
  axisJ: number;
  onChangeI: (i: number) => void;
  onChangeJ: (j: number) => void;
  fixedValues: number[];
  onFixedChange: (idx: number, val: number) => void;
}) {
  return (
    <div className="space-y-2 p-3 rounded-lg bg-secondary border border-border">
      <h4 className="text-[10px] font-bold text-foreground flex items-center gap-1.5">
        <Crosshair className="w-3 h-3" /> Pairwise Slice Selector
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-muted-foreground">X Axis</label>
          <select
            value={axisI}
            onChange={e => onChangeI(Number(e.target.value))}
            className="w-full mt-0.5 px-2 py-1 text-[10px] bg-background border border-border rounded text-foreground"
          >
            {assets.map((a, i) => (
              <option key={i} value={i} disabled={i === axisJ}>{a.symbol}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground">Y Axis</label>
          <select
            value={axisJ}
            onChange={e => onChangeJ(Number(e.target.value))}
            className="w-full mt-0.5 px-2 py-1 text-[10px] bg-background border border-border rounded text-foreground"
          >
            {assets.map((a, i) => (
              <option key={i} value={i} disabled={i === axisI}>{a.symbol}</option>
            ))}
          </select>
        </div>
      </div>
      {assets.length > 2 && (
        <div className="space-y-1.5 mt-1">
          <p className="text-[9px] text-muted-foreground">Fix other reserves:</p>
          {assets.map((a, i) => {
            if (i === axisI || i === axisJ) return null;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-muted-foreground w-10">{a.symbol}</span>
                <Slider
                  min={1}
                  max={a.reserve * 3}
                  step={1}
                  value={[fixedValues[i] ?? a.reserve]}
                  onValueChange={([v]) => onFixedChange(i, v)}
                  className="flex-1"
                />
                <span className="text-[9px] font-mono text-foreground w-12 text-right">{(fixedValues[i] ?? a.reserve).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
const MultiAssetLab = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>(defaultAssets);
  const [axisI, setAxisI] = useState(0);
  const [axisJ, setAxisJ] = useState(1);
  const [fixedValues, setFixedValues] = useState<number[]>([]);
  const [vizTab, setVizTab] = useState("surface");

  const addAsset = () => {
    if (assets.length >= 5) return;
    const idx = assets.length;
    setAssets(prev => [...prev, {
      id: String(Date.now()),
      symbol: `TKN${idx + 1}`,
      reserve: 1000,
      weight: 0.1,
      color: COLORS[idx % COLORS.length],
    }]);
  };

  const removeAsset = (id: string) => {
    setAssets(prev => {
      const next = prev.filter(a => a.id !== id);
      if (axisI >= next.length) setAxisI(0);
      if (axisJ >= next.length) setAxisJ(Math.min(1, next.length - 1));
      return next;
    });
  };

  const applyWeights = (weights: number[]) => {
    setAssets(prev => prev.map((a, i) => ({ ...a, weight: parseFloat(weights[i].toFixed(4)) })));
  };

  const handleFixedChange = (idx: number, val: number) => {
    setFixedValues(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  // Build assets with fixed overrides for surface computation
  const displayAssets = useMemo(() => {
    return assets.map((a, i) => ({
      ...a,
      reserve: (i !== axisI && i !== axisJ && fixedValues[i]) ? fixedValues[i] : a.reserve,
    }));
  }, [assets, axisI, axisJ, fixedValues]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/labs")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Boxes className="w-4 h-4 text-chart-1" />
          <span className="text-sm font-bold text-foreground tracking-tight">MULTI-ASSET LAB</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-warning/30 text-warning">EXPERIMENTAL</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-lg bg-secondary border border-border text-[10px] font-mono text-foreground">
            {assets.map(a => `${a.symbol}^${a.weight}`).join(" · ")} = k
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left: Asset Table + Optimizer */}
        <aside className="w-80 border-r border-border p-4 overflow-y-auto shrink-0 space-y-4">
          <AssetTable assets={assets} onChange={setAssets} onAdd={addAsset} onRemove={removeAsset} />
          <MultiAssetOptimizer assets={assets} onApply={applyWeights} />
        </aside>

        {/* Center: Visualization */}
        <main className="flex-1 p-4 overflow-y-auto space-y-4">
          <Tabs value={vizTab} onValueChange={setVizTab}>
            <TabsList className="h-8">
              <TabsTrigger value="surface" className="text-[10px] px-3 py-1">
                <BarChart3 className="w-3 h-3 mr-1" /> Surface Plot
              </TabsTrigger>
              <TabsTrigger value="heatmap" className="text-[10px] px-3 py-1">
                <Grid3X3 className="w-3 h-3 mr-1" /> Price Heatmap
              </TabsTrigger>
              <TabsTrigger value="radar" className="text-[10px] px-3 py-1">
                <Radar className="w-3 h-3 mr-1" /> Liquidity Radar
              </TabsTrigger>
              <TabsTrigger value="metrics" className="text-[10px] px-3 py-1">
                <Settings2 className="w-3 h-3 mr-1" /> Swap Metrics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="surface" className="mt-4 space-y-4">
              {assets.length > 2 && (
                <PairwiseSliceSelector
                  assets={assets}
                  axisI={axisI}
                  axisJ={axisJ}
                  onChangeI={setAxisI}
                  onChangeJ={setAxisJ}
                  fixedValues={fixedValues}
                  onFixedChange={handleFixedChange}
                />
              )}
              <Surface3D assets={displayAssets} axisI={axisI} axisJ={axisJ} />
            </TabsContent>

            <TabsContent value="heatmap" className="mt-4">
              <PriceHeatmap assets={assets} />
            </TabsContent>

            <TabsContent value="radar" className="mt-4">
              <LiquidityRadar assets={assets} />
            </TabsContent>

            <TabsContent value="metrics" className="mt-4">
              <DerivedMetrics assets={assets} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default MultiAssetLab;
