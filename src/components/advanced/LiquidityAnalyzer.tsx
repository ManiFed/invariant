import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, HelpCircle, AlertTriangle, TrendingUp, Activity, Layers, Sigma } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const invariants = [
  { id: "cp", label: "Constant Product" },
  { id: "ss", label: "Stable Swap" },
  { id: "wt", label: "Weighted (40/60)" },
  { id: "cl", label: "Concentrated" },
  { id: "customA", label: "Custom A" },
  { id: "customB", label: "Custom B" },
];

const HELP: Record<string, { title: string; desc: string }> = {
  compareInv: { title: "Compare Invariants", desc: "Select two invariant types to compare their slippage, depth, and efficiency characteristics side by side. You can use two separate custom expressions." },
  poolLiquidity: { title: "Pool Liquidity", desc: "Total value locked. Larger pools have less slippage per trade. All comparisons use this same liquidity value." },
  efficiency: { title: "Capital Efficiency", desc: "How effectively deposited capital provides trading depth. Higher = more depth per dollar locked." },
  avgSlippage: { title: "Average Slippage", desc: "Mean price impact for a representative trade. Lower is better for traders." },
  depthRatio: { title: "Depth Ratio", desc: "Ratio of effective trading depth to total liquidity. Higher = deeper markets." },
  impactElasticity: { title: "Impact Elasticity", desc: "How quickly price impact grows with trade size. Lower = more graceful degradation for large trades." },
  customExprA: { title: "Custom Expression A", desc: "Define the first custom formula using x and y for reserves. Supports x^a * y^b, x + y, sqrt(x*y), etc." },
  customExprB: { title: "Custom Expression B", desc: "Define the second custom formula. Compare two different experimental invariants side by side." },
  mevExposure: { title: "MEV Exposure", desc: "Estimated sandwich attack profit for a $10k trade. Lower = more MEV resistant. Concentrated liquidity has higher MEV exposure." },
  capitalUtilization: { title: "Capital Utilization", desc: "Percentage of deposited capital actively used for trading at the current price. Higher = more efficient use of funds." },
  rebalanceCost: { title: "Rebalance Cost", desc: "Estimated gas + slippage cost to rebalance the position after a 10% price move. Lower = cheaper to maintain." },
  radarChart: { title: "Multi-Dimensional Comparison", desc: "Spider chart comparing invariants across 5 key dimensions: efficiency, depth, slippage resistance, MEV resistance, and capital utilization." },
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

// Parse custom expression to get slippage multiplier
function parseCustomSlippage(expr: string): number {
  try {
    const match = expr.match(/x\^?([\d.]*)\s*[·×*]\s*y\^?([\d.]*)/);
    if (match) {
      const a = parseFloat(match[1]) || 1;
      const b = parseFloat(match[2]) || 1;
      // Higher weight asymmetry = more slippage
      return 60 + Math.abs(a - b) * 40;
    }
    if (expr.includes("+")) return 30; // constant sum-like
    if (expr.includes("sqrt")) return 45;
    return 65;
  } catch { return 65; }
}

function parseCustomMetrics(expr: string): { efficiency: string; avgSlippage: string; depthRatio: string; impactElasticity: string; mev: number; utilization: number } {
  const slipMult = parseCustomSlippage(expr);
  const eff = (100 / slipMult * 1.8).toFixed(1);
  const slip = (slipMult / 20).toFixed(1);
  const depth = (100 / slipMult * 1.6).toFixed(2);
  const elast = (slipMult / 100).toFixed(2);
  return {
    efficiency: `${eff}x`, avgSlippage: `${slip}%`, depthRatio: depth, impactElasticity: elast,
    mev: slipMult * 0.8, utilization: Math.min(95, 100 - slipMult * 0.3),
  };
}

const LiquidityAnalyzer = () => {
  const colors = useChartColors();
  const [compareA, setCompareA] = useState("cp");
  const [compareB, setCompareB] = useState("cl");
  const [liquidity, setLiquidity] = useState(500000);
  const [customExprA, setCustomExprA] = useState("x^0.6 * y^0.4");
  const [customExprB, setCustomExprB] = useState("x^0.3 * y^0.7");
  const [customErrorA, setCustomErrorA] = useState<string | null>(null);
  const [customErrorB, setCustomErrorB] = useState<string | null>(null);

  const invColors: Record<string, string> = {
    cp: colors.line, ss: colors.green, wt: colors.red, cl: colors.gray,
    customA: "hsl(280, 70%, 55%)", customB: "hsl(30, 90%, 55%)",
  };

  // Validate custom expressions
  const validateExpr = (expr: string): string | null => {
    if (!expr.trim()) return "Expression cannot be empty";
    if (!expr.includes("x") && !expr.includes("y")) return "Expression must contain 'x' and/or 'y' variables";
    const invalidChars = expr.replace(/[xy\d\s^*.+\-/()√×÷αβ]/g, "");
    if (invalidChars.length > 0) return `Unknown character(s): "${invalidChars}". Use x, y, numbers, and operators (^, *, +, -, /, √)`;
    const openParens = (expr.match(/\(/g) || []).length;
    const closeParens = (expr.match(/\)/g) || []).length;
    if (openParens !== closeParens) return `Mismatched parentheses: ${openParens} opening vs ${closeParens} closing`;
    if (/\^\s*$/.test(expr) || /\*\s*$/.test(expr)) return "Expression ends with an operator — add a value after it";
    return null;
  };

  const handleExprChangeA = (v: string) => {
    setCustomExprA(v);
    setCustomErrorA(validateExpr(v));
  };
  const handleExprChangeB = (v: string) => {
    setCustomExprB(v);
    setCustomErrorB(validateExpr(v));
  };

  const customASlip = parseCustomSlippage(customExprA);
  const customBSlip = parseCustomSlippage(customExprB);
  const customAMetrics = parseCustomMetrics(customExprA);
  const customBMetrics = parseCustomMetrics(customExprB);

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
        customA: parseFloat((pct * customASlip).toFixed(3)),
        customB: parseFloat((pct * customBSlip).toFixed(3)),
      });
    }
    return data;
  }, [liquidity, customASlip, customBSlip]);

  const depthData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 40; i++) {
      const priceDistance = (i / 40) * 20 - 10;
      const absD = Math.abs(priceDistance);
      data.push({
        priceDistance: parseFloat(priceDistance.toFixed(1)),
        cp: parseFloat((liquidity / (1 + absD * 0.1)).toFixed(0)),
        ss: parseFloat((liquidity / (1 + absD * 0.02)).toFixed(0)),
        wt: parseFloat((liquidity / (1 + absD * 0.08)).toFixed(0)),
        cl: priceDistance > -3 && priceDistance < 3
          ? parseFloat((liquidity * 2 / (1 + absD * 0.05)).toFixed(0))
          : parseFloat((liquidity * 0.05).toFixed(0)),
        customA: parseFloat((liquidity / (1 + absD * customASlip / 1000)).toFixed(0)),
        customB: parseFloat((liquidity / (1 + absD * customBSlip / 1000)).toFixed(0)),
      });
    }
    return data;
  }, [liquidity, customASlip, customBSlip]);

  const metrics: Record<string, { efficiency: string; avgSlippage: string; depthRatio: string; impactElasticity: string }> = {
    cp: { efficiency: "1.0x", avgSlippage: "5.0%", depthRatio: "1.00", impactElasticity: "1.00" },
    ss: { efficiency: "3.1x", avgSlippage: "1.0%", depthRatio: "3.10", impactElasticity: "0.20" },
    wt: { efficiency: "1.5x", avgSlippage: "4.0%", depthRatio: "1.25", impactElasticity: "0.80" },
    cl: { efficiency: "4.2x", avgSlippage: "2.0%", depthRatio: "4.00", impactElasticity: "0.40" },
    customA: customAMetrics,
    customB: customBMetrics,
  };

  // Advanced metrics
  const advancedMetrics: Record<string, { mev: number; utilization: number; rebalanceCost: number }> = {
    cp: { mev: 45, utilization: 30, rebalanceCost: 12 },
    ss: { mev: 15, utilization: 65, rebalanceCost: 8 },
    wt: { mev: 38, utilization: 40, rebalanceCost: 15 },
    cl: { mev: 72, utilization: 85, rebalanceCost: 35 },
    customA: { mev: customAMetrics.mev, utilization: customAMetrics.utilization, rebalanceCost: customASlip * 0.2 },
    customB: { mev: customBMetrics.mev, utilization: customBMetrics.utilization, rebalanceCost: customBSlip * 0.2 },
  };

  // Radar chart data
  const radarData = useMemo(() => {
    const dims = ["Efficiency", "Depth", "Slip Resist", "MEV Resist", "Utilization"];
    const normalize = (id: string) => {
      const m = metrics[id];
      const adv = advancedMetrics[id];
      return [
        parseFloat(m.efficiency) / 4.2 * 100,
        parseFloat(m.depthRatio) / 4 * 100,
        (1 - parseFloat(m.impactElasticity)) * 100,
        (100 - adv.mev),
        adv.utilization,
      ];
    };
    const vA = normalize(compareA);
    const vB = normalize(compareB);
    return dims.map((d, i) => ({ dimension: d, [compareA]: Math.round(vA[i]), [compareB]: Math.round(vB[i]) }));
  }, [compareA, compareB, customASlip, customBSlip]);

  const tooltipStyle = { background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10, color: colors.tooltipText };

  const needsCustomA = compareA === "customA" || compareB === "customA";
  const needsCustomB = compareA === "customB" || compareB === "customB";

  return (
    <div className="space-y-6">
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Compare Invariants</h3>
          <HelpBtn id="compareInv" />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Invariant A</label>
            <div className="flex gap-1.5 flex-wrap">
              {invariants.map(inv => (
                <button key={inv.id} onClick={() => setCompareA(inv.id)}
                  className={`flex-1 min-w-[60px] py-2 rounded-md text-[10px] font-medium transition-all ${compareA === inv.id ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"}`}>
                  {inv.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Invariant B</label>
            <div className="flex gap-1.5 flex-wrap">
              {invariants.map(inv => (
                <button key={inv.id} onClick={() => setCompareB(inv.id)}
                  className={`flex-1 min-w-[60px] py-2 rounded-md text-[10px] font-medium transition-all ${compareB === inv.id ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"}`}>
                  {inv.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom Expression Inputs */}
        <AnimatePresence>
          {(needsCustomA || needsCustomB) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className={`grid ${needsCustomA && needsCustomB ? "grid-cols-2" : "grid-cols-1"} gap-4 mb-4`}>
                {needsCustomA && (
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <label className="text-[10px] text-muted-foreground">Custom A Expression</label>
                      <HelpBtn id="customExprA" />
                    </div>
                    <input value={customExprA} onChange={e => handleExprChangeA(e.target.value)}
                      className={`w-full bg-muted border rounded-md px-3 py-1.5 text-[10px] font-mono text-foreground outline-none transition-colors ${customErrorA ? "border-destructive" : "border-border focus:border-foreground/30"}`}
                      placeholder="x^0.6 * y^0.4" />
                    {customErrorA && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[9px] text-destructive mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> {customErrorA}
                      </motion.p>
                    )}
                  </div>
                )}
                {needsCustomB && (
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <label className="text-[10px] text-muted-foreground">Custom B Expression</label>
                      <HelpBtn id="customExprB" />
                    </div>
                    <input value={customExprB} onChange={e => handleExprChangeB(e.target.value)}
                      className={`w-full bg-muted border rounded-md px-3 py-1.5 text-[10px] font-mono text-foreground outline-none transition-colors ${customErrorB ? "border-destructive" : "border-border focus:border-foreground/30"}`}
                      placeholder="x^0.3 * y^0.7" />
                    {customErrorB && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[9px] text-destructive mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> {customErrorB}
                      </motion.p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <div className="flex items-center gap-1 mb-1">
            <label className="text-[10px] text-muted-foreground">Pool Liquidity</label>
            <HelpBtn id="poolLiquidity" />
          </div>
          <div className="flex items-center gap-2">
            <input type="range" min={100000} max={5000000} step={100000} value={liquidity} onChange={e => setLiquidity(Number(e.target.value))} className="flex-1 accent-foreground h-1" />
            <span className="text-[10px] font-mono text-foreground">${liquidity.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Advanced Metrics Row */}
      <motion.div className="grid grid-cols-3 md:grid-cols-6 gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <AdvMetric label="MEV Exposure A" value={`$${advancedMetrics[compareA].mev.toFixed(0)}`} helpId="mevExposure" color={advancedMetrics[compareA].mev > 50 ? "text-destructive" : "text-success"} />
        <AdvMetric label="MEV Exposure B" value={`$${advancedMetrics[compareB].mev.toFixed(0)}`} helpId="mevExposure" color={advancedMetrics[compareB].mev > 50 ? "text-destructive" : "text-success"} />
        <AdvMetric label="Utilization A" value={`${advancedMetrics[compareA].utilization.toFixed(0)}%`} helpId="capitalUtilization" color="text-foreground" />
        <AdvMetric label="Utilization B" value={`${advancedMetrics[compareB].utilization.toFixed(0)}%`} helpId="capitalUtilization" color="text-foreground" />
        <AdvMetric label="Rebal Cost A" value={`$${advancedMetrics[compareA].rebalanceCost.toFixed(0)}`} helpId="rebalanceCost" color="text-warning" />
        <AdvMetric label="Rebal Cost B" value={`$${advancedMetrics[compareB].rebalanceCost.toFixed(0)}`} helpId="rebalanceCost" color="text-warning" />
      </motion.div>

      {/* Efficiency Table */}
      <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center gap-1.5 mb-3">
          <h4 className="text-xs font-semibold text-foreground">Efficiency Comparison</h4>
        </div>
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
                { label: "Capital Efficiency", key: "efficiency" as const, helpId: "efficiency" },
                { label: "Avg Slippage", key: "avgSlippage" as const, helpId: "avgSlippage" },
                { label: "Depth Ratio", key: "depthRatio" as const, helpId: "depthRatio" },
                { label: "Impact Elasticity", key: "impactElasticity" as const, helpId: "impactElasticity" },
              ]).map(row => (
                <tr key={row.label} className="border-b border-border/50">
                  <td className="py-2 text-muted-foreground">
                    <span className="flex items-center gap-1">{row.label} <HelpBtn id={row.helpId} /></span>
                  </td>
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

      {/* Charts: Slippage, Depth, Radar */}
      <div className="grid md:grid-cols-3 gap-4">
        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <h4 className="text-xs font-semibold text-foreground mb-1">Slippage Comparison</h4>
          <p className="text-[10px] text-muted-foreground mb-3">Price impact by trade size</p>
          <div className="h-56" onWheel={e => e.stopPropagation()}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={slippageComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="tradeSize" tick={{ fontSize: 8, fill: colors.tick }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} wrapperStyle={{ pointerEvents: 'none' }} />
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
          <div className="h-56" onWheel={e => e.stopPropagation()}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={depthData}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="priceDistance" tick={{ fontSize: 8, fill: colors.tick }} tickFormatter={v => `${v}%`} />
                <YAxis tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} wrapperStyle={{ pointerEvents: 'none' }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey={compareA} name={invariants.find(i => i.id === compareA)?.label} stroke={invColors[compareA]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={compareB} name={invariants.find(i => i.id === compareB)?.label} stroke={invColors[compareB]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <h4 className="text-xs font-semibold text-foreground">Multi-Dimensional</h4>
            <HelpBtn id="radarChart" />
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">Spider comparison</p>
          <div className="h-56" onWheel={e => e.stopPropagation()}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke={colors.grid} />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 8, fill: colors.tick }} />
                <PolarRadiusAxis tick={{ fontSize: 8, fill: colors.tick }} domain={[0, 100]} />
                <Radar name={invariants.find(i => i.id === compareA)?.label} dataKey={compareA} stroke={invColors[compareA]} fill={invColors[compareA]} fillOpacity={0.15} strokeWidth={2} />
                <Radar name={invariants.find(i => i.id === compareB)?.label} dataKey={compareB} stroke={invColors[compareB]} fill={invColors[compareB]} fillOpacity={0.15} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Fee Revenue Projection */}
      <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-foreground" />
          <h4 className="text-xs font-semibold text-foreground">Fee Revenue vs IL Projection (90 days)</h4>
        </div>
        <div className="h-48" onWheel={e => e.stopPropagation()}>
          <FeeILProjection compareA={compareA} compareB={compareB} liquidity={liquidity} colors={colors} invColors={invColors} tooltipStyle={tooltipStyle} />
        </div>
      </motion.div>
    </div>
  );
};

const AdvMetric = ({ label, value, color, helpId }: { label: string; value: string; color: string; helpId?: string }) => (
  <div className="surface-elevated rounded-lg p-3">
    <div className="flex items-center gap-1 mb-1">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      {helpId && <HelpBtn id={helpId} />}
    </div>
    <p className={`text-sm font-semibold font-mono-data ${color}`}>{value}</p>
  </div>
);

const FeeILProjection = ({ compareA, compareB, liquidity, colors, invColors, tooltipStyle }: any) => {
  const data = useMemo(() => {
    const feeRates: Record<string, number> = { cp: 0.003, ss: 0.001, wt: 0.003, cl: 0.005, customA: 0.003, customB: 0.003 };
    const ilRates: Record<string, number> = { cp: 0.02, ss: 0.005, wt: 0.015, cl: 0.04, customA: 0.018, customB: 0.022 };
    const result = [];
    for (let d = 0; d <= 90; d++) {
      const feesA = liquidity * feeRates[compareA] * d * 0.01;
      const feesB = liquidity * feeRates[compareB] * d * 0.01;
      const ilA = liquidity * ilRates[compareA] * Math.sqrt(d / 365) * -1;
      const ilB = liquidity * ilRates[compareB] * Math.sqrt(d / 365) * -1;
      result.push({
        day: d,
        [`${compareA}_net`]: parseFloat((feesA + ilA).toFixed(0)),
        [`${compareB}_net`]: parseFloat((feesB + ilB).toFixed(0)),
      });
    }
    return result;
  }, [compareA, compareB, liquidity]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="day" tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={v => `D${v}`} />
        <YAxis tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
        <Tooltip contentStyle={tooltipStyle} wrapperStyle={{ pointerEvents: 'none' }} labelFormatter={v => `Day ${v}`} />
        <Area type="monotone" dataKey={`${compareA}_net`} stroke={invColors[compareA]} fill={invColors[compareA]} fillOpacity={0.1} strokeWidth={2} dot={false} name={`Net P&L A`} />
        <Area type="monotone" dataKey={`${compareB}_net`} stroke={invColors[compareB]} fill={invColors[compareB]} fillOpacity={0.1} strokeWidth={2} dot={false} name={`Net P&L B`} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default LiquidityAnalyzer;
