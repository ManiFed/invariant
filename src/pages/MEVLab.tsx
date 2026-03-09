import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Zap, Eye, AlertTriangle, Lightbulb, TrendingUp, Activity } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar, ScatterChart, Scatter, ZAxis } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { simulateMEV, type MEVSimConfig, type MEVResult } from "@/lib/mev-engine";

const ATTACK_COLORS = {
  sandwich: "hsl(var(--destructive))",
  backrun: "hsl(var(--warning))",
  jit: "hsl(var(--chart-2))",
  lpFees: "hsl(var(--primary))",
};

function generateSuggestions(result: MEVResult, bins: number[]): { title: string; desc: string; impact: "high" | "medium" | "low" }[] {
  const suggestions: { title: string; desc: string; impact: "high" | "medium" | "low" }[] = [];
  const avgBin = bins.length > 0 ? bins.reduce((a, b) => a + b, 0) / bins.length : 0.5;
  const binVar = bins.length > 0 ? Math.sqrt(bins.reduce((a, b) => a + (b - avgBin) ** 2, 0) / bins.length) : 0;

  if (result.metrics.sandwichCount > 5) {
    suggestions.push({ title: "Increase concentration around active range", desc: "High sandwich count suggests liquidity is too thin at popular price levels. Concentrating bins near the current price makes frontrunning less profitable.", impact: "high" });
  }
  if (binVar < 0.15) {
    suggestions.push({ title: "Add bin variance for natural resistance", desc: "Uniform bin distributions are predictable. Adding variance makes optimal extraction strategies harder to compute.", impact: "medium" });
  }
  if (result.metrics.jitCount > result.metrics.sandwichCount) {
    suggestions.push({ title: "Consider time-weighted liquidity", desc: "High JIT count means passive LPs are losing fee share. Time-weighted positions would penalize just-in-time providers.", impact: "high" });
  }
  if (result.metrics.slippageAmplification > 2) {
    suggestions.push({ title: "Reduce slippage amplification", desc: `Current amplification is ${result.metrics.slippageAmplification.toFixed(1)}×. Smoother invariant curves reduce the profitability of price manipulation.`, impact: "high" });
  }
  if (result.metrics.protectionScore < 50) {
    suggestions.push({ title: "Enable dynamic fee adjustment", desc: "Low protection score indicates the static fee doesn't capture enough MEV value. Dynamic fees based on recent volatility can recapture value for LPs.", impact: "medium" });
  }
  if (result.metrics.backrunCount > 10) {
    suggestions.push({ title: "Implement oracle-based pricing", desc: "Frequent backrun arbitrage suggests the pool price deviates from market. An oracle feed would reduce profitable arbitrage opportunities.", impact: "medium" });
  }
  if (suggestions.length === 0) {
    suggestions.push({ title: "Design looks MEV-resistant", desc: "Your bin distribution provides good natural protection against common MEV strategies. Monitor with higher attacker budgets for stress testing.", impact: "low" });
  }
  return suggestions;
}

export default function MEVLab({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const colors = useChartColors();
  const [designs, setDesigns] = useState<{ id: string; name: string; bins: number[] }[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [result, setResult] = useState<MEVResult | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "attacks" | "suggestions" | "sensitivity">("overview");
  const [config, setConfig] = useState({
    numBlocks: 200,
    swapsPerBlock: 5,
    attackerBudget: 50000,
    feeRate: 0.003,
    sandwichEnabled: true,
    backrunEnabled: true,
    jitEnabled: true,
  });

  useEffect(() => {
    supabase.from("library_amms").select("id, name, bins").then(({ data }) => {
      if (data) {
        const parsed = data.filter(d => d.bins).map(d => ({
          id: d.id, name: d.name,
          bins: (Array.isArray(d.bins) ? d.bins : JSON.parse(d.bins as string)) as number[],
        }));
        setDesigns(parsed);
        if (parsed.length > 0) setSelectedDesign(parsed[0].id);
      }
    });
  }, []);

  const currentBins = useMemo(() => designs.find(d => d.id === selectedDesign)?.bins || [], [designs, selectedDesign]);

  const runSim = useCallback(() => {
    const design = designs.find(d => d.id === selectedDesign);
    if (!design) return;
    const res = simulateMEV({ bins: design.bins, ...config });
    setResult(res);
    setActiveTab("overview");
  }, [designs, selectedDesign, config]);

  const flowData = result ? [
    { name: "LP Earnings", value: result.flow.lpEarnings, color: ATTACK_COLORS.lpFees },
    { name: "Arbitrageurs", value: result.flow.arbitrageurProfit, color: ATTACK_COLORS.backrun },
    { name: "Searchers", value: result.flow.searcherProfit, color: ATTACK_COLORS.sandwich },
    { name: "Protocol", value: result.flow.protocolFees, color: "hsl(var(--muted-foreground))" },
  ].filter(d => d.value > 0) : [];

  const suggestions = useMemo(() => result ? generateSuggestions(result, currentBins) : [], [result, currentBins]);

  // Radar data for attack profile
  const radarData = useMemo(() => {
    if (!result) return [];
    const max = Math.max(result.metrics.sandwichCount, result.metrics.backrunCount, result.metrics.jitCount, 1);
    return [
      { axis: "Sandwich", A: result.metrics.sandwichCount / max * 100 },
      { axis: "Backrun", A: result.metrics.backrunCount / max * 100 },
      { axis: "JIT", A: result.metrics.jitCount / max * 100 },
      { axis: "Slippage", A: Math.min(100, result.metrics.slippageAmplification * 25) },
      { axis: "LP Loss", A: Math.min(100, (result.metrics.lpValueLost / Math.max(1, result.flow.lpEarnings + result.metrics.lpValueLost)) * 100) },
      { axis: "Extraction", A: Math.min(100, (result.metrics.totalExtractedValue / Math.max(1, result.flow.totalVolume)) * 10000) },
    ];
  }, [result]);

  // Sensitivity: run sim at different budgets
  const sensitivityData = useMemo(() => {
    if (!result) return [];
    const design = designs.find(d => d.id === selectedDesign);
    if (!design) return [];
    const budgets = [10000, 25000, 50000, 100000, 250000, 500000];
    return budgets.map(budget => {
      const res = simulateMEV({ bins: design.bins, ...config, attackerBudget: budget, numBlocks: 100 });
      return {
        budget: `$${(budget / 1000).toFixed(0)}k`,
        budgetNum: budget,
        extracted: res.metrics.totalExtractedValue,
        protection: res.metrics.protectionScore,
        sandwiches: res.metrics.sandwichCount,
        lpLoss: res.metrics.lpValueLost,
      };
    });
  }, [result, designs, selectedDesign, config]);

  // Per-attack scatter data
  const scatterData = useMemo(() => {
    if (!result) return [];
    return result.events.filter(e => e.type !== "swap").map(e => ({
      profit: e.attackerProfit,
      impact: e.priceImpact * 100,
      gas: e.gasUsed,
      type: e.type,
    }));
  }, [result]);

  const TABS = [
    { id: "overview" as const, label: "Overview", icon: Shield },
    { id: "attacks" as const, label: "Attack Analysis", icon: Activity },
    { id: "suggestions" as const, label: "Suggestions", icon: Lightbulb },
    { id: "sensitivity" as const, label: "Sensitivity", icon: TrendingUp },
  ];

  return (
    <div className={`${embedded ? "" : "min-h-screen"} bg-background`}>
      {!embedded && (
        <header className="border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/labs")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-foreground tracking-tight">MEV IMPACT ANALYZER</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-warning/30 text-warning">EXPERIMENTAL</span>
          </div>
          <ThemeToggle />
        </header>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar */}
          <div className="space-y-4">
            <div className="border border-border rounded-xl p-4 bg-card">
              <h3 className="text-xs font-bold text-foreground mb-3">AMM Design</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {designs.map(d => (
                  <button key={d.id} onClick={() => setSelectedDesign(d.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedDesign === d.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}>{d.name}</button>
                ))}
              </div>
            </div>

            <div className="border border-border rounded-xl p-4 bg-card space-y-3">
              <h3 className="text-xs font-bold text-foreground">Attack Vectors</h3>
              {[
                { key: "sandwichEnabled" as const, label: "Sandwich Attacks", icon: <AlertTriangle className="w-3 h-3" />, color: "text-destructive" },
                { key: "backrunEnabled" as const, label: "Backrun Arb", icon: <Zap className="w-3 h-3" />, color: "text-warning" },
                { key: "jitEnabled" as const, label: "JIT Liquidity", icon: <Eye className="w-3 h-3" />, color: "text-chart-2" },
              ].map(v => (
                <label key={v.key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={config[v.key]}
                    onChange={() => setConfig(p => ({ ...p, [v.key]: !p[v.key] }))}
                    className="rounded border-border accent-primary" />
                  <span className={v.color}>{v.icon}</span>
                  <span className="text-foreground">{v.label}</span>
                </label>
              ))}
            </div>

            <div className="border border-border rounded-xl p-4 bg-card space-y-3">
              <h3 className="text-xs font-bold text-foreground">Parameters</h3>
              <div>
                <label className="text-[10px] text-muted-foreground">Blocks: {config.numBlocks}</label>
                <input type="range" min={50} max={500} step={50} value={config.numBlocks}
                  onChange={e => setConfig(p => ({ ...p, numBlocks: Number(e.target.value) }))} className="w-full accent-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Swaps/Block: {config.swapsPerBlock}</label>
                <input type="range" min={1} max={20} value={config.swapsPerBlock}
                  onChange={e => setConfig(p => ({ ...p, swapsPerBlock: Number(e.target.value) }))} className="w-full accent-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Attacker Budget: ${(config.attackerBudget / 1000).toFixed(0)}k</label>
                <input type="range" min={10000} max={500000} step={10000} value={config.attackerBudget}
                  onChange={e => setConfig(p => ({ ...p, attackerBudget: Number(e.target.value) }))} className="w-full accent-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Fee Rate: {(config.feeRate * 100).toFixed(1)}%</label>
                <input type="range" min={0.001} max={0.01} step={0.001} value={config.feeRate}
                  onChange={e => setConfig(p => ({ ...p, feeRate: Number(e.target.value) }))} className="w-full accent-primary" />
              </div>
            </div>

            <button onClick={runSim} disabled={!selectedDesign}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
              Run MEV Simulation
            </button>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {result ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {/* Protection Score Banner */}
                <div className={`border rounded-xl p-4 flex items-center gap-4 ${
                  result.metrics.protectionScore > 70 ? "border-green-500/30 bg-green-500/5" :
                  result.metrics.protectionScore > 40 ? "border-warning/30 bg-warning/5" :
                  "border-destructive/30 bg-destructive/5"
                }`}>
                  <Shield className={`w-10 h-10 ${
                    result.metrics.protectionScore > 70 ? "text-green-500" :
                    result.metrics.protectionScore > 40 ? "text-warning" : "text-destructive"
                  }`} />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{result.metrics.protectionScore.toFixed(0)}/100</p>
                    <p className="text-xs text-muted-foreground">MEV Protection Score</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-sm font-mono text-destructive">${result.metrics.totalExtractedValue.toFixed(0)} extracted</p>
                    <p className="text-[10px] text-muted-foreground">
                      {result.metrics.sandwichCount} sandwich · {result.metrics.backrunCount} backrun · {result.metrics.jitCount} JIT
                    </p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 flex-wrap">
                  {TABS.map(t => {
                    const Icon = t.icon;
                    return (
                      <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          activeTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}>
                        <Icon className="w-3 h-3" />{t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Overview */}
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <div className="grid lg:grid-cols-2 gap-4">
                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-2">Value Flow Breakdown</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={flowData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                {flowData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                              </Pie>
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-2">Attack Profile</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                              <PolarGrid stroke="hsl(var(--border))" />
                              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: colors.tick }} />
                              <Radar name="Vulnerability" dataKey="A" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.2)" fillOpacity={0.6} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-2">Cumulative Extraction</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={result.cumulativeExtraction}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="block" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis tick={{ fontSize: 8, fill: colors.tick }} />
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                              <Legend wrapperStyle={{ fontSize: 9 }} />
                              <Area type="monotone" dataKey="lpFees" name="LP Fees" stackId="1" stroke={ATTACK_COLORS.lpFees} fill={ATTACK_COLORS.lpFees + "33"} />
                              <Area type="monotone" dataKey="sandwich" name="Sandwich" stackId="2" stroke={ATTACK_COLORS.sandwich} fill={ATTACK_COLORS.sandwich + "33"} />
                              <Area type="monotone" dataKey="backrun" name="Backrun" stackId="2" stroke={ATTACK_COLORS.backrun} fill={ATTACK_COLORS.backrun + "33"} />
                              <Area type="monotone" dataKey="jit" name="JIT" stackId="2" stroke={ATTACK_COLORS.jit} fill={ATTACK_COLORS.jit + "33"} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-2">Pool Price Over Blocks</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={result.blockSummaries}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="block" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis tick={{ fontSize: 8, fill: colors.tick }} domain={["auto", "auto"]} />
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                              <Line type="monotone" dataKey="price" stroke={colors.line} strokeWidth={1.5} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                      {[
                        { label: "Sandwich Count", value: result.metrics.sandwichCount.toString() },
                        { label: "Avg Sandwich", value: `$${result.metrics.avgSandwichProfit.toFixed(0)}` },
                        { label: "Backrun Count", value: result.metrics.backrunCount.toString() },
                        { label: "Avg Backrun", value: `$${result.metrics.avgBackrunProfit.toFixed(0)}` },
                        { label: "JIT Count", value: result.metrics.jitCount.toString() },
                        { label: "Avg JIT", value: `$${result.metrics.avgJitProfit.toFixed(0)}` },
                        { label: "LP Value Lost", value: `$${result.metrics.lpValueLost.toFixed(0)}` },
                        { label: "Slippage Amp.", value: `${result.metrics.slippageAmplification.toFixed(1)}×` },
                        { label: "Total Volume", value: `$${(result.flow.totalVolume / 1000).toFixed(0)}k` },
                        { label: "LP Net", value: `$${result.flow.lpEarnings.toFixed(0)}` },
                        { label: "Protocol Fees", value: `$${result.flow.protocolFees.toFixed(0)}` },
                        { label: "Total Extracted", value: `$${result.metrics.totalExtractedValue.toFixed(0)}` },
                      ].map(m => (
                        <div key={m.label} className="p-2.5 rounded-lg bg-secondary border border-border text-center">
                          <p className="text-[8px] text-muted-foreground mb-0.5">{m.label}</p>
                          <p className="text-[11px] font-mono font-bold text-foreground">{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attack Analysis */}
                {activeTab === "attacks" && (
                  <div className="space-y-4">
                    <div className="grid lg:grid-cols-2 gap-4">
                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-2">Per-Block MEV vs LP Fees</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={result.blockSummaries.filter((_, i) => i % 2 === 0)}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="block" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis tick={{ fontSize: 8, fill: colors.tick }} />
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                              <Legend wrapperStyle={{ fontSize: 9 }} />
                              <Bar dataKey="lpFees" name="LP Fees" fill={ATTACK_COLORS.lpFees} stackId="a" />
                              <Bar dataKey="extractedValue" name="MEV Extracted" fill={ATTACK_COLORS.sandwich} stackId="a" radius={[2, 2, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-2">Profit vs Price Impact (per attack)</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="impact" name="Price Impact %" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis dataKey="profit" name="Profit $" tick={{ fontSize: 8, fill: colors.tick }} />
                              <ZAxis dataKey="gas" range={[20, 200]} />
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                              <Scatter data={scatterData.filter(d => d.type === "sandwich")} fill={ATTACK_COLORS.sandwich} name="Sandwich" />
                              <Scatter data={scatterData.filter(d => d.type === "backrun")} fill={ATTACK_COLORS.backrun} name="Backrun" />
                              <Scatter data={scatterData.filter(d => d.type === "jit")} fill={ATTACK_COLORS.jit} name="JIT" />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Attack type breakdown */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { type: "Sandwich", count: result.metrics.sandwichCount, avg: result.metrics.avgSandwichProfit, color: "destructive", desc: "Front-run + back-run around victim swaps" },
                        { type: "Backrun", count: result.metrics.backrunCount, avg: result.metrics.avgBackrunProfit, color: "warning", desc: "Arbitrage after large swaps move price" },
                        { type: "JIT", count: result.metrics.jitCount, avg: result.metrics.avgJitProfit, color: "chart-2", desc: "Just-in-time liquidity stealing fees" },
                      ].map(a => (
                        <div key={a.type} className={`border rounded-xl p-4 bg-card border-${a.color}/20`}>
                          <div className={`text-${a.color} text-xs font-bold mb-1`}>{a.type}</div>
                          <p className="text-2xl font-bold text-foreground">{a.count}</p>
                          <p className="text-[10px] text-muted-foreground">Avg profit: ${a.avg.toFixed(1)}</p>
                          <p className="text-[9px] text-muted-foreground mt-2">{a.desc}</p>
                        </div>
                      ))}
                    </div>

                    {/* Recent events */}
                    <div className="border border-border rounded-xl p-4 bg-card">
                      <h3 className="text-xs font-bold text-foreground mb-2">MEV Event Log (last 25)</h3>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {result.events.slice(-25).reverse().map((e, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-secondary text-[10px] font-mono">
                            <span className={`font-bold ${e.type === "sandwich" ? "text-destructive" : e.type === "backrun" ? "text-warning" : "text-chart-2"}`}>
                              {e.type.toUpperCase()}
                            </span>
                            <span className="text-muted-foreground">Block {e.block}</span>
                            <span className="text-foreground">+${e.attackerProfit.toFixed(2)}</span>
                            <span className="text-destructive">-${e.lpLoss.toFixed(2)} LP</span>
                            <span className="text-muted-foreground">{(e.gasUsed / 1000).toFixed(0)}k gas</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {activeTab === "suggestions" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Design recommendations based on the MEV simulation results:</p>
                    {suggestions.map((s, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className={`border rounded-xl p-4 bg-card ${
                          s.impact === "high" ? "border-destructive/20" : s.impact === "medium" ? "border-warning/20" : "border-green-500/20"
                        }`}>
                        <div className="flex items-start gap-3">
                          <Lightbulb className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            s.impact === "high" ? "text-destructive" : s.impact === "medium" ? "text-warning" : "text-green-500"
                          }`} />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-xs font-bold text-foreground">{s.title}</h4>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                                s.impact === "high" ? "border-destructive/30 text-destructive" : s.impact === "medium" ? "border-warning/30 text-warning" : "border-green-500/30 text-green-500"
                              }`}>{s.impact}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Sensitivity */}
                {activeTab === "sensitivity" && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">How does attacker budget affect extraction? Simulated across 6 budget levels.</p>
                    <div className="grid lg:grid-cols-2 gap-4">
                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-2">Extracted Value vs Budget</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sensitivityData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="budget" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis tick={{ fontSize: 8, fill: colors.tick }} />
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                              <Bar dataKey="extracted" name="Extracted $" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="border border-border rounded-xl p-4 bg-card">
                        <h3 className="text-xs font-bold text-foreground mb-2">Protection Score vs Budget</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sensitivityData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="budget" tick={{ fontSize: 8, fill: colors.tick }} />
                              <YAxis tick={{ fontSize: 8, fill: colors.tick }} domain={[0, 100]} />
                              <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                              <Line type="monotone" dataKey="protection" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    <div className="border border-border rounded-xl p-4 bg-card">
                      <h3 className="text-xs font-bold text-foreground mb-3">Budget Sensitivity Table</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Budget</th>
                              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Extracted</th>
                              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Protection</th>
                              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Sandwiches</th>
                              <th className="text-right py-2 px-3 text-muted-foreground font-medium">LP Loss</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sensitivityData.map((row, i) => (
                              <tr key={i} className="border-b border-border/50">
                                <td className="py-2 px-3 font-mono text-foreground">{row.budget}</td>
                                <td className="py-2 px-3 font-mono text-right text-destructive">${row.extracted.toFixed(0)}</td>
                                <td className="py-2 px-3 font-mono text-right">
                                  <span className={row.protection > 70 ? "text-green-500" : row.protection > 40 ? "text-warning" : "text-destructive"}>
                                    {row.protection.toFixed(0)}/100
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-mono text-right text-foreground">{row.sandwiches}</td>
                                <td className="py-2 px-3 font-mono text-right text-destructive">${row.lpLoss.toFixed(0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="border border-border rounded-xl p-12 bg-card text-center">
                <p className="text-sm text-muted-foreground">Select an AMM design and configure attack vectors, then click <strong>Run MEV Simulation</strong>.</p>
                <p className="text-xs text-muted-foreground/60 mt-2">Simulates sandwich attacks, backrun arbitrage, and JIT liquidity against your invariant's bin distribution.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
