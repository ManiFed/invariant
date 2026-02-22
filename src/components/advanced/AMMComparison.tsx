import { useState, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { GitCompare, Upload, HelpCircle, BookOpen } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, BarChart, Bar, Cell } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

interface CompareAMM {
  name: string;
  expression: string;
  weightA: number;
  weightB: number;
  kValue: number;
}

interface Asset {
  id: string;
  symbol: string;
  reserve: number;
  weight: number;
  color: string;
}

const LIBRARY_AMMS: CompareAMM[] = [
  { name: "Uniswap V2", expression: "x * y = k", weightA: 0.5, weightB: 0.5, kValue: 10000 },
  { name: "Balancer 80/20", expression: "x^0.8 · y^0.2 = k", weightA: 0.8, weightB: 0.2, kValue: 10000 },
  { name: "Weighted 60/40", expression: "x^0.6 · y^0.4 = k", weightA: 0.6, weightB: 0.4, kValue: 10000 },
  { name: "Weighted 30/70", expression: "x^0.3 · y^0.7 = k", weightA: 0.3, weightB: 0.7, kValue: 10000 },
];

function evalCurve(wA: number, wB: number, k: number, x: number): number | null {
  try {
    const y = Math.pow(k / Math.pow(x, wA), 1 / wB);
    return y > 0 && y < k * 10 && isFinite(y) ? y : null;
  } catch { return null; }
}

function computeSlippage(wA: number, wB: number, k: number, tradeSize: number): number {
  const x0 = Math.pow(k, 1 / (wA + wB));
  const y0 = evalCurve(wA, wB, k, x0) || x0;
  const spotPrice = y0 / x0;
  const x1 = x0 + tradeSize;
  const y1 = evalCurve(wA, wB, k, x1);
  if (!y1) return 100;
  const output = y0 - y1;
  const idealOutput = tradeSize * spotPrice;
  return idealOutput > 0 ? Math.abs(1 - output / idealOutput) * 100 : 0;
}

function computeIL(wA: number, r: number): number {
  // Generalized IL for weighted pool
  const sqrtR = Math.pow(r, wA);
  return (wA * sqrtR + (1 - wA)) / (wA * r + (1 - wA)) - 1;
}

function computeCapitalEfficiency(wA: number, wB: number): number {
  // Approximate: how concentrated is liquidity
  const balance = 1 - Math.abs(wA - wB);
  return 1 + balance * 2;
}

function computeMEVExposure(wA: number, wB: number): number {
  // More balanced = more MEV exposure
  return 50 + (1 - Math.abs(wA - wB)) * 50;
}

export default function AMMComparison({ savedInvariant, assets }: { savedInvariant?: SavedInvariant | null; assets?: Asset[] }) {
  const colors = useChartColors();
  const [compareAMM, setCompareAMM] = useState<CompareAMM | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [customExpr, setCustomExpr] = useState("");
  const [customWA, setCustomWA] = useState(0.5);
  const [customWB, setCustomWB] = useState(0.5);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentAMM: CompareAMM = savedInvariant
    ? { name: "Your AMM", expression: savedInvariant.expression, weightA: savedInvariant.weightA, weightB: savedInvariant.weightB, kValue: savedInvariant.kValue }
    : { name: "Your AMM (default)", expression: "x * y = k", weightA: 0.5, weightB: 0.5, kValue: 10000 };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setCompareAMM({
          name: json.name || "Imported AMM",
          expression: json.formula || json.expression || "x * y = k",
          weightA: json.params?.wA ?? json.weightA ?? 0.5,
          weightB: json.params?.wB ?? json.weightB ?? 0.5,
          kValue: json.params?.k ?? json.kValue ?? 10000,
        });
        setShowImport(false);
      } catch { alert("Invalid JSON file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSetCustom = () => {
    setCompareAMM({
      name: "Custom",
      expression: customExpr || `x^${customWA} · y^${customWB} = k`,
      weightA: customWA,
      weightB: customWB,
      kValue: 10000,
    });
    setShowImport(false);
  };

  // Curve comparison data
  const curveData = useMemo(() => {
    if (!compareAMM) return [];
    const data = [];
    for (let i = 1; i <= 60; i++) {
      const x = i * 5;
      const yA = evalCurve(currentAMM.weightA, currentAMM.weightB, currentAMM.kValue, x);
      const yB = evalCurve(compareAMM.weightA, compareAMM.weightB, compareAMM.kValue, x);
      if (yA !== null && yB !== null) {
        data.push({ x, yours: parseFloat(yA.toFixed(2)), compare: parseFloat(yB.toFixed(2)) });
      }
    }
    return data;
  }, [currentAMM, compareAMM]);

  // Slippage comparison
  const slippageData = useMemo(() => {
    if (!compareAMM) return [];
    const data = [];
    for (let i = 1; i <= 20; i++) {
      const size = i * 50;
      data.push({
        tradeSize: size,
        yours: parseFloat(computeSlippage(currentAMM.weightA, currentAMM.weightB, currentAMM.kValue, size).toFixed(3)),
        compare: parseFloat(computeSlippage(compareAMM.weightA, compareAMM.weightB, compareAMM.kValue, size).toFixed(3)),
      });
    }
    return data;
  }, [currentAMM, compareAMM]);

  // IL comparison
  const ilData = useMemo(() => {
    if (!compareAMM) return [];
    const data = [];
    for (let i = 0; i <= 30; i++) {
      const r = 0.5 + i / 30 * 1.5;
      data.push({
        priceRatio: parseFloat(r.toFixed(2)),
        yours: parseFloat((computeIL(currentAMM.weightA, r) * -100).toFixed(2)),
        compare: parseFloat((computeIL(compareAMM.weightA, r) * -100).toFixed(2)),
      });
    }
    return data;
  }, [currentAMM, compareAMM]);

  // Radar comparison
  const radarData = useMemo(() => {
    if (!compareAMM) return [];
    return [
      { metric: "Capital Eff.", yours: computeCapitalEfficiency(currentAMM.weightA, currentAMM.weightB) * 30, compare: computeCapitalEfficiency(compareAMM.weightA, compareAMM.weightB) * 30 },
      { metric: "Slippage Res.", yours: 100 - computeSlippage(currentAMM.weightA, currentAMM.weightB, currentAMM.kValue, 100), compare: 100 - computeSlippage(compareAMM.weightA, compareAMM.weightB, compareAMM.kValue, 100) },
      { metric: "IL Resistance", yours: (1 + computeIL(currentAMM.weightA, 2)) * 100, compare: (1 + computeIL(compareAMM.weightA, 2)) * 100 },
      { metric: "MEV Resist.", yours: 100 - computeMEVExposure(currentAMM.weightA, currentAMM.weightB), compare: 100 - computeMEVExposure(compareAMM.weightA, compareAMM.weightB) },
      { metric: "Balance", yours: (1 - Math.abs(currentAMM.weightA - currentAMM.weightB)) * 100, compare: (1 - Math.abs(compareAMM.weightA - compareAMM.weightB)) * 100 },
    ];
  }, [currentAMM, compareAMM]);

  const tooltipStyle = { background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10, color: colors.tooltipText };

  return (
    <div className="space-y-6">
      {/* Import panel */}
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Compare AMMs</h3>
          </div>
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
            <Upload className="w-3 h-3" /> Import AMM to Compare
          </button>
        </div>

        {!compareAMM ? (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
            <GitCompare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">Import an AMM to compare against your current design</p>
            <p className="text-[10px] text-muted-foreground">Compare slippage curves, IL profiles, capital efficiency, and more</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1 p-3 rounded-lg bg-secondary border border-border">
              <p className="text-[9px] text-muted-foreground mb-0.5">Your AMM</p>
              <p className="text-xs font-mono font-semibold text-foreground">{currentAMM.expression}</p>
              <p className="text-[9px] text-muted-foreground">w₁={currentAMM.weightA} w₂={currentAMM.weightB}</p>
            </div>
            <span className="text-xs text-muted-foreground font-semibold">vs</span>
            <div className="flex-1 p-3 rounded-lg bg-secondary border border-border">
              <p className="text-[9px] text-muted-foreground mb-0.5">{compareAMM.name}</p>
              <p className="text-xs font-mono font-semibold text-foreground">{compareAMM.expression}</p>
              <p className="text-[9px] text-muted-foreground">w₁={compareAMM.weightA} w₂={compareAMM.weightB}</p>
            </div>
            <button onClick={() => setCompareAMM(null)} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}
      </div>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm font-bold">Import AMM to Compare</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5"><BookOpen className="w-3 h-3" /> From Library</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {LIBRARY_AMMS.map(amm => (
                  <button key={amm.name} onClick={() => { setCompareAMM(amm); setShowImport(false); }}
                    className="text-left p-2 rounded-lg bg-secondary border border-border hover:border-foreground/20 transition-all">
                    <p className="text-[10px] font-semibold text-foreground">{amm.name}</p>
                    <p className="text-[9px] font-mono text-muted-foreground truncate">{amm.expression}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <h4 className="text-xs font-semibold text-foreground mb-2">Custom Weights</h4>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[9px] text-muted-foreground">Weight A</label>
                  <input type="number" step={0.05} min={0.01} max={0.99} value={customWA} onChange={e => setCustomWA(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs font-mono bg-secondary rounded border border-border text-foreground" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground">Weight B</label>
                  <input type="number" step={0.05} min={0.01} max={0.99} value={customWB} onChange={e => setCustomWB(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs font-mono bg-secondary rounded border border-border text-foreground" />
                </div>
              </div>
              <button onClick={handleSetCustom} className="w-full py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
                Compare with Custom
              </button>
            </div>
            <div className="border-t border-border pt-3">
              <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5"><Upload className="w-3 h-3" /> Upload JSON</h4>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportJson} />
              <button onClick={() => fileInputRef.current?.click()} className="w-full p-3 rounded-lg border-2 border-dashed border-border hover:border-foreground/30 text-center text-xs text-muted-foreground hover:text-foreground transition-all">
                Click to upload a .json AMM config
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comparison Charts */}
      {compareAMM && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Curve Overlay */}
            <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h4 className="text-xs font-semibold text-foreground mb-3">Invariant Curves</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curveData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="x" tick={{ fontSize: 8, fill: colors.tick }} />
                    <YAxis tick={{ fontSize: 9, fill: colors.tick }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="yours" name="Your AMM" stroke={colors.line} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="compare" name={compareAMM.name} stroke={colors.green} strokeWidth={2} dot={false} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Slippage */}
            <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <h4 className="text-xs font-semibold text-foreground mb-3">Slippage Comparison</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={slippageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="tradeSize" tick={{ fontSize: 8, fill: colors.tick }} />
                    <YAxis tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="yours" name="Your AMM" stroke={colors.line} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="compare" name={compareAMM.name} stroke={colors.green} strokeWidth={2} dot={false} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* IL */}
            <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <h4 className="text-xs font-semibold text-foreground mb-3">Impermanent Loss Comparison</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ilData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="priceRatio" tick={{ fontSize: 8, fill: colors.tick }} />
                    <YAxis tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="yours" name="Your AMM" stroke={colors.red} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="compare" name={compareAMM.name} stroke={colors.green} strokeWidth={2} dot={false} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Radar */}
            <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <h4 className="text-xs font-semibold text-foreground mb-3">Multi-Metric Radar</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke={colors.grid} />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: colors.tick }} />
                    <PolarRadiusAxis tick={{ fontSize: 8, fill: colors.tick }} />
                    <Radar name="Your AMM" dataKey="yours" stroke={colors.line} fill={colors.line} fillOpacity={0.15} />
                    <Radar name={compareAMM.name} dataKey="compare" stroke={colors.green} fill={colors.green} fillOpacity={0.1} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
