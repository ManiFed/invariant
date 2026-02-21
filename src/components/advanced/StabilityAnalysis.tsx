import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";

type InvariantType = "cp" | "ss" | "wt" | "cl";

const StabilityAnalysis = () => {
  const colors = useChartColors();
  const [invariant, setInvariant] = useState<InvariantType>("cp");
  const [feeRate, setFeeRate] = useState(0.3);
  const [volatility, setVolatility] = useState(80);

  const checks = useMemo(() => {
    const base: { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }[] = [
      { id: "insolvency", label: "Insolvency Edge Cases", status: invariant === "cl" ? "warn" : "pass", detail: invariant === "cl" ? "Concentrated positions can reach zero liquidity if price exits range" : "Pool maintains solvency across all tested price ranges" },
      { id: "path_dep", label: "Path Dependence", status: feeRate > 0.5 ? "warn" : "pass", detail: feeRate > 0.5 ? "High fee tiers introduce measurable path dependence in LP returns" : "Path dependence is negligible at current fee tier" },
      { id: "fee_distortion", label: "Fee Distortion", status: feeRate > 0.8 ? "fail" : feeRate > 0.3 ? "warn" : "pass", detail: feeRate > 0.8 ? "Fee distortion exceeds safe thresholds" : "Fee distortion within acceptable bounds" },
      { id: "inventory", label: "Inventory Runaway", status: invariant === "wt" ? "pass" : volatility > 120 ? "fail" : volatility > 60 ? "warn" : "pass", detail: volatility > 120 ? "High volatility creates inventory imbalance beyond rebalance capacity" : "Inventory drift is manageable" },
      { id: "reflexivity", label: "Reflexivity Loops", status: invariant === "cl" && volatility > 100 ? "fail" : invariant === "cl" ? "warn" : "pass", detail: invariant === "cl" && volatility > 100 ? "Concentrated positions + high vol create reflexive cascades" : "No significant reflexivity detected" },
    ];
    return base;
  }, [invariant, feeRate, volatility]);

  const stressData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 50; i++) {
      const scenario = i * 2;
      const volFactor = volatility / 100;
      const baseStress = Math.sin(scenario * 0.1) * volFactor * 5;
      const selectedStress = invariant === "cp" ? baseStress : invariant === "ss" ? baseStress * 0.3 : invariant === "wt" ? baseStress * 0.7 : baseStress * 1.8;
      data.push({ scenario, stress: parseFloat(selectedStress.toFixed(2)), threshold: 5 });
    }
    return data;
  }, [invariant, volatility]);

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
            <label className="text-[10px] text-muted-foreground mb-2 block">Invariant Type</label>
            <div className="flex gap-1.5">
              {([["cp", "x·y=k"], ["ss", "Stable"], ["wt", "Weighted"], ["cl", "Conc."]] as [InvariantType, string][]).map(([id, label]) => (
                <button key={id} onClick={() => setInvariant(id)}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${invariant === id ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1"><label className="text-[10px] text-muted-foreground">Fee Rate (%)</label><span className="text-[10px] font-mono text-foreground">{feeRate.toFixed(2)}</span></div>
            <input type="range" min={0.01} max={1} step={0.01} value={feeRate} onChange={e => setFeeRate(Number(e.target.value))} className="w-full accent-foreground h-1" />
          </div>
          <div>
            <div className="flex justify-between mb-1"><label className="text-[10px] text-muted-foreground">Volatility (%)</label><span className="text-[10px] font-mono text-foreground">{volatility}</span></div>
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
                <h4 className="text-xs font-semibold text-foreground">{check.label}</h4>
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
        <h4 className="text-xs font-semibold text-foreground mb-1">Stress Response</h4>
        <p className="text-[10px] text-muted-foreground mb-3">Pool behavior under extreme scenarios</p>
        <div className="h-48">
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
              <Tooltip contentStyle={tooltipStyle} />
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
