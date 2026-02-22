import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { DollarSign, HelpCircle, RotateCcw } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
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

export default function FeeStructureEditor({ assets }: { assets?: Asset[] }) {
  const colors = useChartColors();
  const [fees, setFees] = useState<number[]>(() => PRESETS[0].gen());
  const [activePreset, setActivePreset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const setFeeAt = useCallback((index: number, value: number) => {
    setFees(prev => {
      const next = [...prev];
      next[index] = Math.max(1, Math.min(100, value));
      return next;
    });
    setActivePreset(-1);
  }, []);

  const chartData = useMemo(() => 
    fees.map((fee, i) => ({
      price: `${((i / NUM_POINTS) * 200).toFixed(0)}`,
      fee: fee,
      feePct: (fee / 100).toFixed(2),
    })),
  [fees]);

  const revenueData = useMemo(() => {
    // Simulate revenue projection with non-uniform fees
    return fees.map((fee, i) => {
      const priceDistance = Math.abs(i - NUM_POINTS / 2) / (NUM_POINTS / 2);
      const volumeWeight = Math.exp(-priceDistance * 2); // Most volume near center
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

  const tooltipStyle = { 
    background: colors.tooltipBg, 
    border: `1px solid ${colors.tooltipBorder}`, 
    borderRadius: 8, 
    fontSize: 10,
    color: "inherit"
  };

  return (
    <div className="space-y-6">
      {/* Multi-asset context */}
      {assets && assets.length > 0 && (
        <div className="surface-elevated rounded-xl p-4">
          <h4 className="text-[10px] font-bold text-foreground mb-2">Multi-Asset Fee Context</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {assets.map((a, i) => assets.slice(i + 1).map(b => (
              <div key={`${a.id}-${b.id}`} className="p-2 rounded-lg bg-secondary border border-border">
                <p className="text-[9px] font-mono text-muted-foreground">{a.symbol}/{b.symbol}</p>
                <p className="text-[10px] font-semibold text-foreground">{(Number(avgFee) * (a.weight + b.weight)).toFixed(0)} bps (weighted)</p>
              </div>
            )))}
          </div>
        </div>
      )}

      {/* Presets */}
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Fee Structure</h3>
          <HelpBtn label="Custom Fee Distribution" desc="Define how swap fees vary across the price curve. Higher fees at volatile ranges protect LPs, while lower fees at the center attract more volume." />
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">
          {assets && assets.length > 2 ? `Fee structure applied across all ${assets.length} asset pairs.` : "Choose a preset or drag the sliders below to create a custom fee distribution."}
        </p>

        <div className="flex gap-2 mb-4 flex-wrap">
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => { setFees(p.gen()); setActivePreset(i); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activePreset === i ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent hover:border-border"
              }`}>
              {p.label}
            </button>
          ))}
          <button onClick={() => { setFees(PRESETS[0].gen()); setActivePreset(0); }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ml-auto">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
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
        </div>

        {/* Fee sliders per point */}
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground">Price range (low → high)</span>
            <span className="text-[9px] text-muted-foreground">Fee (basis points)</span>
          </div>
          <div className="grid grid-cols-1 gap-0.5">
            {fees.map((fee, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-muted-foreground w-8 text-right">{((i / NUM_POINTS) * 200).toFixed(0)}</span>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={fee}
                  onChange={e => setFeeAt(i, Number(e.target.value))}
                  onMouseDown={() => setDragging(true)}
                  onMouseUp={() => setDragging(false)}
                  className="flex-1 accent-foreground h-1"
                />
                <span className="text-[8px] font-mono text-foreground w-8">{fee} bp</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fee Distribution Graph */}
      <div className="grid md:grid-cols-2 gap-4">
        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <h4 className="text-xs font-semibold text-foreground">Fee Distribution</h4>
            <HelpBtn label="Fee Curve" desc="Visualizes how fees change across the price range. Each bar represents the fee at that price point." />
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">Fee (bps) by price</p>
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
