import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { DollarSign, HelpCircle, RotateCcw, Plus, Minus, Download, Save, LineChart as LineChartIcon, SlidersHorizontal } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line, ReferenceLine } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Asset {
  id: string;
  symbol: string;
  reserve: number;
  weight: number;
  color: string;
}

const NUM_POINTS = 20;

function HelpBtn({ label, desc }: { label: string; desc: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors" type="button">
          <HelpCircle className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-52 p-2.5">
        <h4 className="text-[11px] font-semibold text-foreground mb-1">{label}</h4>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
      </PopoverContent>
    </Popover>
  );
}

const PRESETS = [
  { label: "Flat", desc: "Uniform fee across all prices", gen: () => Array(NUM_POINTS).fill(30) },
  { label: "U-Shaped", desc: "Higher fees at extremes, low in center", gen: () => Array.from({ length: NUM_POINTS }, (_, i) => { const d = Math.abs(i - NUM_POINTS / 2) / (NUM_POINTS / 2); return Math.round(10 + d * d * 90); }) },
  { label: "Bell Curve", desc: "Higher fees in center, low at extremes", gen: () => Array.from({ length: NUM_POINTS }, (_, i) => { const d = Math.abs(i - NUM_POINTS / 2) / (NUM_POINTS / 2); return Math.round(80 - d * d * 60); }) },
  { label: "Ascending", desc: "Fees increase with price", gen: () => Array.from({ length: NUM_POINTS }, (_, i) => Math.round(5 + (i / NUM_POINTS) * 80)) },
  { label: "Descending", desc: "Fees decrease with price", gen: () => Array.from({ length: NUM_POINTS }, (_, i) => Math.round(85 - (i / NUM_POINTS) * 80)) },
];

interface FeeStructureEditorProps {
  assets?: Asset[];
  onSaveFees?: (fees: number[]) => void;
  savedFees?: number[] | null;
  onSavePairFees?: (pairFees: Record<string, number[]>) => void;
  savedPairFees?: Record<string, number[]> | null;
}

export default function FeeStructureEditor({ assets, onSaveFees, savedFees, onSavePairFees, savedPairFees }: FeeStructureEditorProps) {
  const colors = useChartColors();
  const [fees, setFees] = useState<number[]>(() => savedFees || PRESETS[0].gen());
  const [activePreset, setActivePreset] = useState(savedFees ? -1 : 0);
  const [dragging, setDragging] = useState(false);
  const [bulkAmount, setBulkAmount] = useState(5);
  
  // Multi-asset pair fee selection
  const pairs = useMemo(() => {
    if (!assets || assets.length < 2) return [];
    const result: { key: string; label: string }[] = [];
    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        result.push({ key: `${assets[i].symbol}>${assets[j].symbol}`, label: `${assets[i].symbol} → ${assets[j].symbol}` });
      }
    }
    return result;
  }, [assets]);
  
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [pairFees, setPairFees] = useState<Record<string, number[]>>(savedPairFees || {});

  // Auto-select first pair for multi-asset (no global option)
  useEffect(() => {
    if (assets && assets.length > 2 && pairs.length > 0 && !selectedPair) {
      setSelectedPair(pairs[0].key);
    }
  }, [assets, pairs, selectedPair]);

  // When pair selection changes, load that pair's fees
  useEffect(() => {
    if (selectedPair && pairFees[selectedPair]) {
      setFees(pairFees[selectedPair]);
      setActivePreset(-1);
    } else if (selectedPair) {
      setPairFees(prev => ({ ...prev, [selectedPair]: [...fees] }));
    }
  }, [selectedPair]);

  const updateFees = useCallback((newFees: number[]) => {
    setFees(newFees);
    setActivePreset(-1);
    if (selectedPair) {
      setPairFees(prev => {
        const next = { ...prev, [selectedPair]: newFees };
        onSavePairFees?.(next);
        return next;
      });
    }
    onSaveFees?.(newFees);
  }, [selectedPair, onSaveFees, onSavePairFees]);

  const setFeeAt = useCallback((index: number, value: number) => {
    const next = [...fees];
    next[index] = Math.max(1, Math.min(100, value));
    updateFees(next);
  }, [fees, updateFees]);

  const bulkAdjust = useCallback((delta: number) => {
    const next = fees.map(f => Math.max(1, Math.min(100, f + delta)));
    updateFees(next);
  }, [fees, updateFees]);

  const handlePreset = useCallback((i: number) => {
    const newFees = PRESETS[i].gen();
    setFees(newFees);
    setActivePreset(i);
    if (selectedPair) {
      setPairFees(prev => {
        const next = { ...prev, [selectedPair]: newFees };
        onSavePairFees?.(next);
        return next;
      });
    }
    onSaveFees?.(newFees);
  }, [selectedPair, onSaveFees, onSavePairFees]);

  const handleExportFees = useCallback(() => {
    const data = { fees, pairFees: Object.keys(pairFees).length > 0 ? pairFees : undefined };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "fee_structure.json"; a.click();
    URL.revokeObjectURL(url);
  }, [fees, pairFees]);

  const chartData = useMemo(() => 
    fees.map((fee, i) => ({
      price: `${((i / NUM_POINTS) * 200).toFixed(0)}`,
      fee: fee,
      feePct: (fee / 100).toFixed(2),
    })),
  [fees]);

  const revenueData = useMemo(() => {
    return fees.map((fee, i) => {
      const priceDistance = Math.abs(i - NUM_POINTS / 2) / (NUM_POINTS / 2);
      const volumeWeight = Math.exp(-priceDistance * 2);
      const revenue = fee * volumeWeight * 10;
      const ilCost = priceDistance * 30;
      return {
        price: `${((i / NUM_POINTS) * 200).toFixed(0)}`,
        revenue: parseFloat(revenue.toFixed(1)),
        ilCost: parseFloat(ilCost.toFixed(1)),
        net: parseFloat((revenue - ilCost).toFixed(1)),
      };
    });
  }, [fees]);

  const avgFee = (fees.reduce((a, b) => a + b, 0) / fees.length).toFixed(1);
  const maxFee = Math.max(...fees);
  const minFee = Math.min(...fees);

  // IL breakeven calculation: for a 2x price move, IL ~ 5.7%. Fee must cover that over expected volume.
  const ilBreakeven = useMemo(() => {
    // Assume average price move of 50% over holding period, IL ~ 2.02%
    // breakeven fee = IL / expected_trades. Rough: IL_cost / volume_ratio
    const avgIL = 2.02; // % for 50% price move
    const assumedTrades = 100; // trades per period
    const breakevenBps = (avgIL / assumedTrades) * 10000;
    return Math.max(1, Math.round(breakevenBps));
  }, []);

  const [editMode, setEditMode] = useState<"sliders" | "graph">("sliders");
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // Draggable graph data
  const graphEditData = useMemo(() =>
    fees.map((fee, i) => ({ index: i, price: ((i / NUM_POINTS) * 200).toFixed(0), fee })),
  [fees]);

  const handleGraphDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!graphContainerRef.current) return;
    const rect = graphContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = Math.round((x / rect.width) * (NUM_POINTS - 1));
    const val = Math.round(100 - (y / rect.height) * 100);
    if (idx >= 0 && idx < NUM_POINTS) {
      setFeeAt(idx, Math.max(1, Math.min(100, val)));
    }
  }, [setFeeAt]);

  const [isGraphDragging, setIsGraphDragging] = useState(false);

  const tooltipStyle = { 
    background: colors.tooltipBg, 
    border: `1px solid ${colors.tooltipBorder}`, 
    borderRadius: 8, 
    fontSize: 10,
    color: colors.tooltipText,
  };

  return (
    <div className="space-y-6">
      {/* Multi-asset pair selector — no global option for multi-asset */}
      {assets && assets.length > 2 && pairs.length > 0 && (
        <div className="surface-elevated rounded-xl p-4">
          <h4 className="text-[10px] font-bold text-foreground mb-2">Per-Pair Fee Structure</h4>
          <p className="text-[9px] text-muted-foreground mb-3">Select a trading pair to customize its individual fee curve.</p>
          <div className="flex gap-2 flex-wrap">
            {pairs.map((p, idx) => (
              <button key={p.key} onClick={() => setSelectedPair(p.key)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all ${(selectedPair || pairs[0]?.key) === p.key ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Presets + Bulk Adjust */}
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Fee Structure</h3>
          <HelpBtn label="Custom Fee Distribution" desc="Define how swap fees vary across the price curve. Higher fees at volatile ranges protect LPs, while lower fees at the center attract more volume." />
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleExportFees}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium bg-secondary text-muted-foreground hover:text-foreground border border-border transition-colors">
              <Download className="w-3 h-3" /> Export
            </button>
            {onSaveFees && (
              <button onClick={() => onSaveFees(fees)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                <Save className="w-3 h-3" /> Save
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => handlePreset(i)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activePreset === i ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent hover:border-border"
              }`}>
              {p.label}
            </button>
          ))}
          <button onClick={() => { handlePreset(0); }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ml-auto">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bulk adjust */}
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-secondary border border-border">
          <span className="text-[10px] text-muted-foreground">Bulk Adjust:</span>
          <button onClick={() => bulkAdjust(-bulkAmount)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-background text-foreground border border-border hover:bg-accent transition-colors">
            <Minus className="w-3 h-3" /> {bulkAmount} bps
          </button>
          <input type="number" value={bulkAmount} onChange={e => setBulkAmount(Math.max(1, Math.min(50, Number(e.target.value))))}
            className="w-14 bg-background border border-border rounded-md px-2 py-1 text-[10px] font-mono text-foreground outline-none text-center" />
          <button onClick={() => bulkAdjust(bulkAmount)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-background text-foreground border border-border hover:bg-accent transition-colors">
            <Plus className="w-3 h-3" /> {bulkAmount} bps
          </button>
          <span className="text-[9px] text-muted-foreground ml-auto">Shift all fees up or down</span>
        </div>

        {/* Summary stats + IL breakeven */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="p-2 rounded-lg bg-secondary border border-border text-center">
            <p className="text-[9px] text-muted-foreground">Avg Fee</p>
            <p className="text-sm font-mono font-semibold text-foreground">{avgFee} bps</p>
          </div>
          <div className="p-2 rounded-lg bg-secondary border border-border text-center">
            <p className="text-[9px] text-muted-foreground">Min Fee</p>
            <p className="text-sm font-mono font-semibold text-foreground">{minFee} bps</p>
          </div>
          <div className="p-2 rounded-lg bg-secondary border border-border text-center">
            <p className="text-[9px] text-muted-foreground">Max Fee</p>
            <p className="text-sm font-mono font-semibold text-foreground">{maxFee} bps</p>
          </div>
          <div className={`p-2 rounded-lg border text-center ${Number(avgFee) >= ilBreakeven ? "bg-chart-2/10 border-chart-2/30" : "bg-destructive/10 border-destructive/30"}`}>
            <p className="text-[9px] text-muted-foreground">IL Breakeven</p>
            <p className="text-sm font-mono font-semibold text-foreground">{ilBreakeven} bps</p>
            <p className="text-[8px] text-muted-foreground">{Number(avgFee) >= ilBreakeven ? "✓ Covered" : "✗ Below"}</p>
          </div>
        </div>

        {/* Edit mode toggle */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] text-muted-foreground">Edit mode:</span>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button onClick={() => setEditMode("sliders")}
              className={`flex items-center gap-1 px-2.5 py-1 text-[9px] font-medium transition-all ${editMode === "sliders" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <SlidersHorizontal className="w-3 h-3" /> Sliders
            </button>
            <button onClick={() => setEditMode("graph")}
              className={`flex items-center gap-1 px-2.5 py-1 text-[9px] font-medium transition-all ${editMode === "graph" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <LineChartIcon className="w-3 h-3" /> Graph
            </button>
          </div>
        </div>

        {/* Fee editing: sliders or draggable graph */}
        {editMode === "sliders" ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-muted-foreground">Price range (low → high)</span>
              <span className="text-[9px] text-muted-foreground">Fee (basis points)</span>
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {fees.map((fee, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[8px] font-mono text-muted-foreground w-8 text-right">{((i / NUM_POINTS) * 200).toFixed(0)}</span>
                  <input type="range" min={1} max={100} value={fee}
                    onChange={e => setFeeAt(i, Number(e.target.value))}
                    onMouseDown={() => setDragging(true)} onMouseUp={() => setDragging(false)}
                    className="flex-1 accent-foreground h-1" />
                  <span className="text-[8px] font-mono text-foreground w-8">{fee} bp</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[9px] text-muted-foreground mb-2">Click and drag on the graph to set fee values at fine precision.</p>
            <div
              ref={graphContainerRef}
              className="h-64 cursor-crosshair select-none"
              onMouseDown={(e) => { setIsGraphDragging(true); handleGraphDrag(e); }}
              onMouseMove={(e) => { if (isGraphDragging) handleGraphDrag(e); }}
              onMouseUp={() => setIsGraphDragging(false)}
              onMouseLeave={() => setIsGraphDragging(false)}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphEditData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                  <XAxis dataKey="price" tick={{ fontSize: 8, fill: colors.tick }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: colors.tick }} />
                  <ReferenceLine y={ilBreakeven} stroke={colors.red} strokeDasharray="4 4" label={{ value: `IL breakeven: ${ilBreakeven}`, fontSize: 8, fill: colors.tick, position: "insideTopRight" }} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: colors.tick }} itemStyle={{ color: colors.tick }} />
                  <Line type="monotone" dataKey="fee" stroke={colors.line} strokeWidth={2} dot={{ r: 3, fill: colors.line }} activeDot={{ r: 5 }} name="Fee (bps)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Fee Distribution Graph */}
      <div className="grid md:grid-cols-2 gap-4">
        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <h4 className="text-xs font-semibold text-foreground">Fee Distribution</h4>
            <HelpBtn label="Fee Curve" desc="Visualizes how fees change across the price range. Each bar represents the fee at that price point." />
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">Fee (bps) by price{selectedPair ? ` — ${selectedPair}` : ""}</p>
          <div className="h-56" onWheel={e => e.stopPropagation()}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="price" tick={{ fontSize: 8, fill: colors.tick }} />
                <YAxis tick={{ fontSize: 9, fill: colors.tick }} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={tooltipStyle} 
                  wrapperStyle={{ pointerEvents: 'none' }} 
                  labelStyle={{ color: colors.tick }}
                  itemStyle={{ color: colors.tick }}
                />
                <Bar dataKey="fee" name="Fee (bps)" radius={[2, 2, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={fees[i] > 60 ? colors.red : fees[i] > 30 ? colors.line : colors.green} fillOpacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <h4 className="text-xs font-semibold text-foreground">Revenue vs IL Projection</h4>
            <HelpBtn label="Net Revenue" desc="Projects fee revenue against impermanent loss at each price point. Green area = net positive for LPs." />
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">Revenue, IL cost, and net by price</p>
          <div className="h-56" onWheel={e => e.stopPropagation()}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="price" tick={{ fontSize: 8, fill: colors.tick }} />
                <YAxis tick={{ fontSize: 9, fill: colors.tick }} />
                <Tooltip 
                  contentStyle={tooltipStyle} 
                  wrapperStyle={{ pointerEvents: 'none' }}
                  labelStyle={{ color: colors.tick }}
                  itemStyle={{ color: colors.tick }}
                />
                <Area type="monotone" dataKey="revenue" stroke={colors.green} fill={colors.green} fillOpacity={0.15} strokeWidth={2} name="Revenue" />
                <Area type="monotone" dataKey="ilCost" stroke={colors.red} fill={colors.red} fillOpacity={0.1} strokeWidth={1.5} name="IL Cost" />
                <Area type="monotone" dataKey="net" stroke={colors.line} fill={colors.line} fillOpacity={0.05} strokeWidth={2} name="Net P&L" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}