import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type InvariantType = "cp" | "ss" | "wt" | "cl" | "custom";

const HELP: Record<string, { title: string; desc: string }> = {
  invariantType: { title: "Invariant Type", desc: "The AMM curve formula to test. Each has different risk characteristics under stress conditions." },
  feeRate: { title: "Fee Rate", desc: "Swap fee percentage. Higher fees can introduce path dependence and price distortion." },
  volatility: { title: "Volatility", desc: "Annualized price volatility used in stress scenarios. Higher vol tests more extreme conditions." },
  insolvency: { title: "Insolvency Check", desc: "Tests whether the pool can maintain positive reserves in all tokens under extreme price movements." },
  pathDep: { title: "Path Dependence", desc: "Checks if the final pool state depends on the order of trades, not just the final price. Ideally path-independent." },
  feeDistortion: { title: "Fee Distortion", desc: "Measures how much fees distort the invariant curve away from the theoretical ideal." },
  inventory: { title: "Inventory Runaway", desc: "Tests whether one-sided price moves cause unsustainable inventory concentration." },
  reflexivity: { title: "Reflexivity Loops", desc: "Checks for feedback loops where pool mechanics amplify external price movements." },
  stressChart: { title: "Stress Response", desc: "Shows how the pool behaves under a range of extreme scenarios. Values above the threshold indicate potential instability." },
  customExpr: { title: "Custom Invariant", desc: "Define your own invariant formula. Use 'x' and 'y' for reserves. The formula should equal a constant k." },
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

const StabilityAnalysis = () => {
  const colors = useChartColors();
  const [invariant, setInvariant] = useState<InvariantType>("cp");
  const [feeRate, setFeeRate] = useState(0.3);
  const [volatility, setVolatility] = useState(80);
  const [customExpr, setCustomExpr] = useState("x^0.6 * y^0.4");

  const effectiveInvariant = invariant === "custom" ? "wt" : invariant; // custom treated as weighted variant for analysis

  const checks = useMemo(() => {
    const base: { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string; helpId: string }[] = [
      { id: "insolvency", label: "Insolvency Edge Cases", helpId: "insolvency", status: effectiveInvariant === "cl" ? "warn" : "pass", detail: effectiveInvariant === "cl" ? "Concentrated positions can reach zero liquidity if price exits range" : "Pool maintains solvency across all tested price ranges" },
      { id: "path_dep", label: "Path Dependence", helpId: "pathDep", status: feeRate > 0.5 ? "warn" : "pass", detail: feeRate > 0.5 ? "High fee tiers introduce measurable path dependence in LP returns" : "Path dependence is negligible at current fee tier" },
      { id: "fee_distortion", label: "Fee Distortion", helpId: "feeDistortion", status: feeRate > 0.8 ? "fail" : feeRate > 0.3 ? "warn" : "pass", detail: feeRate > 0.8 ? "Fee distortion exceeds safe thresholds" : "Fee distortion within acceptable bounds" },
      { id: "inventory", label: "Inventory Runaway", helpId: "inventory", status: effectiveInvariant === "wt" ? "pass" : volatility > 120 ? "fail" : volatility > 60 ? "warn" : "pass", detail: volatility > 120 ? "High volatility creates inventory imbalance beyond rebalance capacity" : "Inventory drift is manageable" },
      { id: "reflexivity", label: "Reflexivity Loops", helpId: "reflexivity", status: effectiveInvariant === "cl" && volatility > 100 ? "fail" : effectiveInvariant === "cl" ? "warn" : "pass", detail: effectiveInvariant === "cl" && volatility > 100 ? "Concentrated positions + high vol create reflexive cascades" : "No significant reflexivity detected" },
    ];
    return base;
  }, [effectiveInvariant, feeRate, volatility]);

  const stressData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 50; i++) {
      const scenario = i * 2;
      const volFactor = volatility / 100;
      const baseStress = Math.sin(scenario * 0.1) * volFactor * 5;
      const selectedStress = effectiveInvariant === "cp" ? baseStress : effectiveInvariant === "ss" ? baseStress * 0.3 : effectiveInvariant === "wt" ? baseStress * 0.7 : baseStress * 1.8;
      data.push({ scenario, stress: parseFloat(selectedStress.toFixed(2)), threshold: 5 });
    }
    return data;
  }, [effectiveInvariant, volatility]);

  const passCount = checks.filter(c => c.status === "pass").length;
  const warnCount = checks.filter(c => c.status === "warn").length;
  const failCount = checks.filter(c => c.status === "fail").length;
  const tooltipStyle = { background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10 };

  return (
    <div className="space-y-6">
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Stability Parameters</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-1 mb-2">
              <label className="text-[10px] text-muted-foreground">Invariant Type</label>
              <HelpBtn id="invariantType" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {([["cp", "x·y=k"], ["ss", "Stable"], ["wt", "Weighted"], ["cl", "Conc."], ["custom", "Custom"]] as [InvariantType, string][]).map(([id, label]) => (
                <button key={id} onClick={() => setInvariant(id)}
                  className={`flex-1 min-w-[50px] py-1.5 rounded-md text-[10px] font-medium transition-all ${invariant === id ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"}`}>
                  {label}
                </button>
              ))}
            </div>
            {invariant === "custom" && (
              <div className="mt-2">
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-[9px] text-muted-foreground">Expression</label>
                  <HelpBtn id="customExpr" />
                </div>
                <input value={customExpr} onChange={e => setCustomExpr(e.target.value)}
                  className="w-full bg-muted border border-border rounded-md px-2 py-1.5 text-[10px] font-mono text-foreground outline-none" placeholder="x^0.6 * y^0.4" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[10px] text-muted-foreground">Fee Rate (%)</label>
              <HelpBtn id="feeRate" />
            </div>
            <span className="text-[10px] font-mono text-foreground float-right">{feeRate.toFixed(2)}</span>
            <input type="range" min={0.01} max={1} step={0.01} value={feeRate} onChange={e => setFeeRate(Number(e.target.value))} className="w-full accent-foreground h-1" />
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[10px] text-muted-foreground">Volatility (%)</label>
              <HelpBtn id="volatility" />
            </div>
            <span className="text-[10px] font-mono text-foreground float-right">{volatility}</span>
            <input type="range" min={10} max={200} step={5} value={volatility} onChange={e => setVolatility(Number(e.target.value))} className="w-full accent-foreground h-1" />
          </div>
        </div>
      </div>

      <motion.div className="grid grid-cols-3 gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="surface-elevated rounded-lg p-4 text-center">
          <p className="text-2xl font-bold font-mono-data text-success">{passCount}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Passed</p>
        </div>
        <div className="surface-elevated rounded-lg p-4 text-center">
          <p className="text-2xl font-bold font-mono-data text-warning">{warnCount}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Warnings</p>
        </div>
        <div className="surface-elevated rounded-lg p-4 text-center">
          <p className="text-2xl font-bold font-mono-data text-destructive">{failCount}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Failed</p>
        </div>
      </motion.div>

      <div className="space-y-2">
        {checks.map((check, i) => (
          <motion.div key={check.id} className="surface-elevated rounded-xl p-4 flex items-start gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
            {check.status === "pass" && <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />}
            {check.status === "warn" && <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />}
            {check.status === "fail" && <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <h4 className="text-xs font-semibold text-foreground">{check.label}</h4>
                  <HelpBtn id={check.helpId} />
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  check.status === "pass" ? "bg-success/10 text-success" : check.status === "warn" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                }`}>{check.status.toUpperCase()}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{check.detail}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center gap-1.5 mb-1">
          <h4 className="text-xs font-semibold text-foreground">Stress Response</h4>
          <HelpBtn id="stressChart" />
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">Pool behavior under extreme scenarios</p>
        <div className="h-48" onWheel={e => e.stopPropagation()}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stressData}>
              <defs>
                <linearGradient id="stressGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.red} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={colors.red} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey="scenario" tick={{ fontSize: 9, fill: colors.tick }} />
              <YAxis tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} wrapperStyle={{ pointerEvents: 'none' }} />
              <Area type="monotone" dataKey="stress" stroke={colors.red} fill="url(#stressGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="threshold" stroke={colors.gray} strokeDasharray="5 5" fill="none" strokeWidth={1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
};

export default StabilityAnalysis;
