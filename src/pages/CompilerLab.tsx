import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Play, CheckCircle, XCircle, AlertTriangle, Loader2, Copy, Download, Rocket } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { generateSolidity } from "@/lib/codegen-solidity";
import { compileInvariant, runTests, simulateDeployment, type CompilationResult, type DeploymentStatus, type TestResult } from "@/lib/compiler-engine";

export default function CompilerLab() {
  const navigate = useNavigate();
  const colors = useChartColors();
  const [designs, setDesigns] = useState<{ id: string; name: string; bins: number[]; formula: string; params: Record<string, number> }[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [solidityCode, setSolidityCode] = useState("");
  const [compiled, setCompiled] = useState<CompilationResult | null>(null);
  const [tests, setTests] = useState<TestResult[] | null>(null);
  const [deployStatus, setDeployStatus] = useState<DeploymentStatus | null>(null);
  const [optimizerRuns, setOptimizerRuns] = useState(200);
  const [activeTab, setActiveTab] = useState<"code" | "gas" | "storage" | "tests" | "deploy">("code");

  useEffect(() => {
    supabase.from("library_amms").select("id, name, bins, formula, params").then(({ data }) => {
      if (data) {
        const parsed = data.filter(d => d.bins).map(d => ({
          id: d.id, name: d.name,
          bins: (Array.isArray(d.bins) ? d.bins : JSON.parse(d.bins as string)) as number[],
          formula: d.formula || "x * y = k",
          params: (typeof d.params === "object" && d.params ? d.params : { k: 10000, wA: 0.5, wB: 0.5 }) as Record<string, number>,
        }));
        setDesigns(parsed);
        if (parsed.length > 0) setSelectedDesign(parsed[0].id);
      }
    });
  }, []);

  // Generate Solidity when design changes
  useEffect(() => {
    const design = designs.find(d => d.id === selectedDesign);
    if (!design) return;
    const result = generateSolidity({ name: design.name, familyParams: design.params, bins: design.bins });
    setSolidityCode(result.code);
    setCompiled(null);
    setTests(null);
    setDeployStatus(null);
  }, [selectedDesign, designs]);

  const handleCompile = useCallback(() => {
    const result = compileInvariant(solidityCode, optimizerRuns);
    setCompiled(result);
    setActiveTab("gas");
  }, [solidityCode, optimizerRuns]);

  const handleRunTests = useCallback(() => {
    if (!compiled) return;
    const results = runTests(compiled.abi);
    setTests(results);
    setActiveTab("tests");
  }, [compiled]);

  const handleDeploy = useCallback(async () => {
    setDeployStatus({ step: "compiling", progress: 0 });
    setActiveTab("deploy");
    await simulateDeployment(setDeployStatus);
  }, []);

  const currentDesign = designs.find(d => d.id === selectedDesign);
  const gasData = compiled?.gasEstimates.map(g => ({ ...g, name: g.function })) || [];

  const TABS = [
    { id: "code" as const, label: "Solidity" },
    { id: "gas" as const, label: "Gas Profile", disabled: !compiled },
    { id: "storage" as const, label: "Storage Layout", disabled: !compiled },
    { id: "tests" as const, label: `Tests${tests ? ` (${tests.filter(t => t.passed).length}/${tests.length})` : ""}`, disabled: !compiled },
    { id: "deploy" as const, label: "Deploy", disabled: !compiled },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/labs")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">INVARIANT COMPILER</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-warning/30 text-warning">EXPERIMENTAL</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          {/* Sidebar */}
          <div className="space-y-4">
            <div className="border border-border rounded-xl p-4 bg-card">
              <h3 className="text-xs font-bold text-foreground mb-3">Library Design</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {designs.map(d => (
                  <button key={d.id} onClick={() => setSelectedDesign(d.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedDesign === d.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}>{d.name}</button>
                ))}
              </div>
            </div>

            <div className="border border-border rounded-xl p-4 bg-card space-y-3">
              <h3 className="text-xs font-bold text-foreground">Compiler Settings</h3>
              <div>
                <label className="text-[10px] text-muted-foreground">Optimizer Runs: {optimizerRuns}</label>
                <input type="range" min={1} max={1000} value={optimizerRuns}
                  onChange={e => setOptimizerRuns(Number(e.target.value))} className="w-full accent-primary" />
              </div>
            </div>

            {/* Pipeline buttons */}
            <div className="space-y-2">
              <button onClick={handleCompile} disabled={!solidityCode}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                <Play className="w-3.5 h-3.5" /> Compile
              </button>
              <button onClick={handleRunTests} disabled={!compiled}
                className="w-full py-2.5 rounded-xl bg-secondary text-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                <CheckCircle className="w-3.5 h-3.5" /> Run Tests
              </button>
              <button onClick={handleDeploy} disabled={!compiled || compiled.errors.length > 0}
                className="w-full py-2.5 rounded-xl bg-secondary text-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                <Rocket className="w-3.5 h-3.5" /> Deploy to Testnet
              </button>
            </div>

            {compiled && (
              <div className={`border rounded-xl p-3 ${compiled.success ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
                <p className={`text-xs font-bold ${compiled.success ? "text-green-500" : "text-destructive"}`}>
                  {compiled.success ? "✓ Compilation Successful" : `✗ ${compiled.errors.length} Error(s)`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {compiled.contractSize} bytes · {compiled.abi.length} functions · {compiled.optimizerRuns} runs
                </p>
              </div>
            )}
          </div>

          {/* Main */}
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-border pb-2">
              {TABS.map(t => (
                <button key={t.id} onClick={() => !t.disabled && setActiveTab(t.id)}
                  className={`px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors ${
                    activeTab === t.id ? "bg-primary text-primary-foreground" : t.disabled ? "text-muted-foreground/40" : "text-muted-foreground hover:text-foreground"
                  }`}>{t.label}</button>
              ))}
            </div>

            {activeTab === "code" && (
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                  <span className="text-[10px] font-mono text-muted-foreground">{currentDesign?.name || "Select a design"}.sol</span>
                  <div className="flex gap-2">
                    <button onClick={() => navigator.clipboard.writeText(solidityCode)} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <button onClick={() => {
                      const blob = new Blob([solidityCode], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = `${currentDesign?.name || "Pool"}.sol`; a.click();
                    }} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                      <Download className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <pre className="p-4 text-[10px] font-mono text-foreground overflow-auto max-h-[500px] leading-relaxed whitespace-pre-wrap">
                  {solidityCode || "Select a design to generate Solidity code."}
                </pre>
              </div>
            )}

            {activeTab === "gas" && compiled && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="border border-border rounded-xl p-4 bg-card">
                  <h3 className="text-xs font-bold text-foreground mb-2">Gas Estimates by Function</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gasData} layout="vertical" margin={{ left: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 8, fill: colors.tick }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: colors.tick }} width={90} />
                        <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                        <Bar dataKey="avg" name="Avg Gas" radius={[0, 4, 4, 0]}>
                          {gasData.map((entry, i) => (
                            <Cell key={i} fill={entry.category === "read" ? "hsl(var(--chart-2))" : entry.category === "admin" ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {compiled.gasEstimates.map(g => (
                    <div key={g.function} className="p-2.5 rounded-lg bg-secondary border border-border">
                      <p className="text-[9px] text-muted-foreground font-mono">{g.function}</p>
                      <p className="text-xs font-bold text-foreground">{g.avg.toLocaleString()} gas</p>
                      <p className="text-[8px] text-muted-foreground">{g.min.toLocaleString()} – {g.max.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "storage" && compiled && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="border border-border rounded-xl p-4 bg-card">
                  <h3 className="text-xs font-bold text-foreground mb-3">Storage Layout</h3>
                  <div className="space-y-1">
                    {compiled.storageLayout.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary text-[10px] font-mono">
                        <span className="text-muted-foreground w-12">Slot {s.slot}</span>
                        <span className="text-muted-foreground w-16">+{s.offset} ({s.size}B)</span>
                        <span className="text-foreground font-bold flex-1">{s.variable}</span>
                        <span className="text-muted-foreground">{s.type}</span>
                        {/* Visual bar for slot usage */}
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(s.size / 32) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3">
                    Total: {compiled.storageLayout.length} entries across {Math.max(...compiled.storageLayout.map(s => s.slot)) + 1} slots · {compiled.contractSize} bytes bytecode
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === "tests" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="border border-border rounded-xl p-4 bg-card">
                  <h3 className="text-xs font-bold text-foreground mb-3">Test Results</h3>
                  {tests ? (
                    <>
                      <div className="flex gap-4 mb-4 text-xs">
                        <span className="text-green-500 font-bold">{tests.filter(t => t.passed).length} passed</span>
                        <span className="text-destructive font-bold">{tests.filter(t => !t.passed).length} failed</span>
                        <span className="text-muted-foreground">{tests.reduce((a, t) => a + t.duration, 0)}ms total</span>
                      </div>
                      <div className="space-y-1">
                        {tests.map((t, i) => (
                          <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-mono ${
                            t.passed ? "bg-green-500/5" : "bg-destructive/5"
                          }`}>
                            {t.passed ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-destructive" />}
                            <span className="text-foreground flex-1">{t.name}</span>
                            <span className="text-muted-foreground">{t.gasUsed.toLocaleString()} gas</span>
                            <span className="text-muted-foreground">{t.duration}ms</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">Click "Run Tests" to execute the test suite.</p>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "deploy" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="border border-border rounded-xl p-6 bg-card">
                  <h3 className="text-xs font-bold text-foreground mb-4">Testnet Deployment</h3>
                  {deployStatus ? (
                    <div className="space-y-4">
                      {/* Progress */}
                      <div className="space-y-2">
                        {["compiling", "estimating", "deploying", "verifying", "complete"].map((step, i) => {
                          const isActive = deployStatus.step === step;
                          const isPast = ["compiling", "estimating", "deploying", "verifying", "complete"].indexOf(deployStatus.step) > i;
                          return (
                            <div key={step} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                              isActive ? "bg-primary/10 border border-primary/30" : isPast ? "bg-green-500/5" : "bg-secondary"
                            }`}>
                              {isActive ? <Loader2 className="w-3 h-3 animate-spin text-primary" /> :
                               isPast ? <CheckCircle className="w-3 h-3 text-green-500" /> :
                               <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />}
                              <span className={isActive ? "text-foreground font-bold" : isPast ? "text-green-500" : "text-muted-foreground"}>
                                {step.charAt(0).toUpperCase() + step.slice(1)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${deployStatus.progress}%` }} transition={{ duration: 0.3 }} />
                      </div>

                      {deployStatus.contractAddress && (
                        <div className="space-y-2 mt-4 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                          <p className="text-xs font-bold text-green-500">✓ Deployed Successfully</p>
                          <div className="space-y-1 text-[10px] font-mono">
                            <p className="text-muted-foreground">Contract: <span className="text-foreground">{deployStatus.contractAddress}</span></p>
                            <p className="text-muted-foreground">Tx: <span className="text-foreground">{deployStatus.txHash}</span></p>
                            <p className="text-muted-foreground">Block: <span className="text-foreground">{deployStatus.blockNumber?.toLocaleString()}</span></p>
                            <p className="text-muted-foreground">Gas Used: <span className="text-foreground">{deployStatus.gasUsed?.toLocaleString()}</span></p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">Compile first, then click "Deploy to Testnet" to simulate deployment.</p>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
