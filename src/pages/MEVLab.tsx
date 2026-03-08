import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Zap, Eye, AlertTriangle } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
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

export default function MEVLab() {
  const navigate = useNavigate();
  const colors = useChartColors();
  const [designs, setDesigns] = useState<{ id: string; name: string; bins: number[] }[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [result, setResult] = useState<MEVResult | null>(null);
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

  const runSim = useCallback(() => {
    const design = designs.find(d => d.id === selectedDesign);
    if (!design) return;
    const res = simulateMEV({ bins: design.bins, ...config });
    setResult(res);
  }, [designs, selectedDesign, config]);

  const flowData = result ? [
    { name: "LP Earnings", value: result.flow.lpEarnings, color: ATTACK_COLORS.lpFees },
    { name: "Arbitrageurs", value: result.flow.arbitrageurProfit, color: ATTACK_COLORS.backrun },
    { name: "Searchers", value: result.flow.searcherProfit, color: ATTACK_COLORS.sandwich },
    { name: "Protocol", value: result.flow.protocolFees, color: "hsl(var(--muted-foreground))" },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="min-h-screen bg-background">
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
                { key: "sandwichEnabled" as const, label: "Sandwich Attacks", icon: <AlertTriangle className="w-3 h-3" /> },
                { key: "backrunEnabled" as const, label: "Backrun Arb", icon: <Zap className="w-3 h-3" /> },
                { key: "jitEnabled" as const, label: "JIT Liquidity", icon: <Eye className="w-3 h-3" /> },
              ].map(v => (
                <label key={v.key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={config[v.key]}
                    onChange={() => setConfig(p => ({ ...p, [v.key]: !p[v.key] }))}
                    className="rounded border-border accent-primary" />
                  <span className="text-muted-foreground">{v.icon}</span>
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

                <div className="grid lg:grid-cols-2 gap-4">
                  {/* Value Flow Pie */}
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

                  {/* Cumulative Extraction */}
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

                  {/* Block-level MEV */}
                  <div className="border border-border rounded-xl p-4 bg-card">
                    <h3 className="text-xs font-bold text-foreground mb-2">Per-Block Extraction</h3>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={result.blockSummaries.filter((_, i) => i % 2 === 0)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="block" tick={{ fontSize: 8, fill: colors.tick }} />
                          <YAxis tick={{ fontSize: 8, fill: colors.tick }} />
                          <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                          <Legend wrapperStyle={{ fontSize: 9 }} />
                          <Bar dataKey="lpFees" name="LP Fees" fill={ATTACK_COLORS.lpFees} stackId="a" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="extractedValue" name="MEV" fill={ATTACK_COLORS.sandwich} stackId="a" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Price impact over time */}
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

                {/* Metrics grid */}
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

                {/* Recent MEV events */}
                <div className="border border-border rounded-xl p-4 bg-card">
                  <h3 className="text-xs font-bold text-foreground mb-2">Recent MEV Events (last 20)</h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {result.events.slice(-20).reverse().map((e, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-secondary text-[10px] font-mono">
                        <span className={`font-bold ${e.type === "sandwich" ? "text-destructive" : e.type === "backrun" ? "text-warning" : "text-green-500"}`}>
                          {e.type.toUpperCase()}
                        </span>
                        <span className="text-muted-foreground">Block {e.block}</span>
                        <span className="text-foreground">Profit: ${e.attackerProfit.toFixed(2)}</span>
                        <span className="text-destructive">LP Loss: ${e.lpLoss.toFixed(2)}</span>
                        <span className="text-muted-foreground">{(e.gasUsed / 1000).toFixed(0)}k gas</span>
                      </div>
                    ))}
                  </div>
                </div>
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
