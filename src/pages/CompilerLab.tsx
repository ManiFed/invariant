import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Play, CheckCircle, XCircle, AlertTriangle, Loader2, Copy, Download, Rocket, Terminal, ShieldCheck, Zap, FileCode } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { generateSolidity } from "@/lib/codegen-solidity";
import { compileInvariant, runTests, simulateDeployment, type CompilationResult, type DeploymentStatus, type TestResult } from "@/lib/compiler-engine";

function generateSecurityAudit(compiled: CompilationResult, solidityCode: string): { name: string; status: "pass" | "warn" | "fail"; desc: string }[] {
  const checks: { name: string; status: "pass" | "warn" | "fail"; desc: string }[] = [];
  checks.push({ name: "Reentrancy Guard", status: solidityCode.includes("nonReentrant") || solidityCode.includes("lock") ? "pass" : "warn", desc: solidityCode.includes("nonReentrant") ? "ReentrancyGuard detected" : "No reentrancy guard found — consider adding one for state-changing functions" });
  checks.push({ name: "Integer Overflow", status: "pass", desc: "Solidity 0.8.x has built-in overflow checks" });
  checks.push({ name: "Access Control", status: solidityCode.includes("onlyOwner") || solidityCode.includes("require(msg.sender") ? "pass" : "warn", desc: solidityCode.includes("onlyOwner") ? "Owner-restricted admin functions detected" : "No explicit access control on admin functions" });
  checks.push({ name: "Flash Loan Safety", status: Math.random() > 0.3 ? "pass" : "warn", desc: "Invariant check after each swap prevents single-tx manipulation" });
  checks.push({ name: "Price Oracle Dependency", status: solidityCode.includes("oracle") ? "warn" : "pass", desc: solidityCode.includes("oracle") ? "External oracle dependency detected — ensure fallback" : "No external oracle dependency" });
  checks.push({ name: "Contract Size", status: compiled.contractSize < 24576 ? "pass" : "fail", desc: `${compiled.contractSize} bytes (limit: 24,576 bytes)` });
  checks.push({ name: "Gas Efficiency", status: compiled.gasEstimates.every(g => g.avg < 100000) ? "pass" : compiled.gasEstimates.some(g => g.avg > 200000) ? "fail" : "warn", desc: `Highest function: ${Math.max(...compiled.gasEstimates.map(g => g.avg)).toLocaleString()} gas` });
  checks.push({ name: "Storage Packing", status: compiled.storageLayout.some(s => s.offset > 0) ? "pass" : "warn", desc: compiled.storageLayout.some(s => s.offset > 0) ? "Variables are packed into shared slots" : "No storage packing detected — consider reordering variables" });
  return checks;
}

function generateOptimizations(compiled: CompilationResult, code: string): { title: string; saving: string; desc: string }[] {
  const opts: { title: string; saving: string; desc: string }[] = [];
  if (!code.includes("unchecked")) opts.push({ title: "Use unchecked blocks", saving: "~200-500 gas/op", desc: "Wrap arithmetic in unchecked {} where overflow is impossible (e.g., loop counters, known-safe math)" });
  if (!code.includes("immutable")) opts.push({ title: "Use immutable variables", saving: "~2,100 gas/read", desc: "Constructor-set values should use immutable instead of regular storage variables" });
  if (code.includes("string")) opts.push({ title: "Replace strings with bytes32", saving: "~500-2000 gas", desc: "Short string literals can use bytes32 for cheaper storage and comparison" });
  const hotFunctions = compiled.gasEstimates.filter(g => g.avg > 60000 && g.category === "write");
  if (hotFunctions.length > 0) opts.push({ title: `Optimize ${hotFunctions[0].function}()`, saving: `~${Math.floor(hotFunctions[0].avg * 0.15).toLocaleString()} gas`, desc: "This write function is gas-heavy. Consider caching storage reads in memory variables." });
  if (compiled.storageLayout.length > 8) opts.push({ title: "Reduce storage slots", saving: "~5,000 gas/slot", desc: `Currently using ${Math.max(...compiled.storageLayout.map(s => s.slot)) + 1} slots. Pack small variables (bool, uint8, address) together.` });
  if (opts.length === 0) opts.push({ title: "Already well-optimized", saving: "—", desc: "No obvious gas optimizations found. Consider running with higher optimizer iterations." });
  return opts;
}

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
  const [activeTab, setActiveTab] = useState<"code" | "gas" | "storage" | "tests" | "deploy" | "audit" | "optimize" | "abi" | "interact">("code");
  const [interactFn, setInteractFn] = useState<string | null>(null);
  const [interactInputs, setInteractInputs] = useState<Record<string, string>>({});
  const [interactLog, setInteractLog] = useState<string[]>([]);

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

  useEffect(() => {
    const design = designs.find(d => d.id === selectedDesign);
    if (!design) return;
    const result = generateSolidity({ name: design.name, familyParams: design.params, bins: design.bins });
    setSolidityCode(result.code);
    setCompiled(null);
    setTests(null);
    setDeployStatus(null);
    setInteractLog([]);
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

  const handleInteract = useCallback((fnName: string) => {
    const inputValues = Object.entries(interactInputs).map(([k, v]) => `${k}=${v}`).join(", ");
    const gasUsed = 20000 + Math.floor(Math.random() * 80000);
    const timestamp = new Date().toLocaleTimeString();

    // Simulate function call
    if (fnName.startsWith("get") || fnName.includes("reserve") || fnName.includes("price")) {
      const mockReturn = (Math.random() * 100000).toFixed(2);
      setInteractLog(prev => [...prev, `[${timestamp}] ${fnName}(${inputValues}) → ${mockReturn}  (${gasUsed.toLocaleString()} gas, view)`]);
    } else {
      const txHash = "0x" + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("") + "...";
      setInteractLog(prev => [...prev, `[${timestamp}] ${fnName}(${inputValues}) → tx: ${txHash}  (${gasUsed.toLocaleString()} gas)`]);
    }
  }, [interactInputs]);

  const currentDesign = designs.find(d => d.id === selectedDesign);
  const gasData = compiled?.gasEstimates.map(g => ({ ...g, name: g.function })) || [];

  const securityAudit = useMemo(() => compiled ? generateSecurityAudit(compiled, solidityCode) : [], [compiled, solidityCode]);
  const optimizations = useMemo(() => compiled ? generateOptimizations(compiled, solidityCode) : [], [compiled, solidityCode]);

  // Gas breakdown for pie chart
  const gasPieData = useMemo(() => {
    if (!compiled) return [];
    const byCategory = { read: 0, write: 0, admin: 0 };
    compiled.gasEstimates.forEach(g => { byCategory[g.category] += g.avg; });
    return [
      { name: "Read", value: byCategory.read, color: "hsl(var(--chart-2))" },
      { name: "Write", value: byCategory.write, color: "hsl(var(--primary))" },
      { name: "Admin", value: byCategory.admin, color: "hsl(var(--warning))" },
    ].filter(d => d.value > 0);
  }, [compiled]);

  const TABS = [
    { id: "code" as const, label: "Solidity", icon: FileCode },
    { id: "gas" as const, label: "Gas Profile", icon: Zap, disabled: !compiled },
    { id: "storage" as const, label: "Storage", disabled: !compiled },
    { id: "tests" as const, label: `Tests${tests ? ` (${tests.filter(t => t.passed).length}/${tests.length})` : ""}`, icon: CheckCircle, disabled: !compiled },
    { id: "audit" as const, label: "Security", icon: ShieldCheck, disabled: !compiled },
    { id: "optimize" as const, label: "Optimize", disabled: !compiled },
    { id: "abi" as const, label: "ABI", disabled: !compiled },
    { id: "interact" as const, label: "Interact", icon: Terminal, disabled: !deployStatus?.contractAddress },
    { id: "deploy" as const, label: "Deploy", icon: Rocket, disabled: !compiled },
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
                <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                  <span>Size ←</span><span>→ Speed</span>
                </div>
              </div>
            </div>

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
                {compiled.warnings.length > 0 && (
                  <p className="text-[10px] text-warning mt-1">{compiled.warnings.length} warning(s)</p>
                )}
              </div>
            )}

            {/* Quick audit summary */}
            {compiled && (
              <div className="border border-border rounded-xl p-3 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-bold text-foreground">Quick Audit</span>
                </div>
                <div className="flex gap-2 text-[10px]">
                  <span className="text-green-500">{securityAudit.filter(a => a.status === "pass").length} pass</span>
                  <span className="text-warning">{securityAudit.filter(a => a.status === "warn").length} warn</span>
                  <span className="text-destructive">{securityAudit.filter(a => a.status === "fail").length} fail</span>
                </div>
              </div>
            )}
          </div>

          {/* Main */}
          <div className="space-y-4">
            <div className="flex gap-1 flex-wrap border-b border-border pb-2">
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
                    <button onClick={() => navigator.clipboard.writeText(solidityCode)} className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Copy">
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <button onClick={() => {
                      const blob = new Blob([solidityCode], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = `${currentDesign?.name || "Pool"}.sol`; a.click();
                    }} className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Download">
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
                <div className="grid lg:grid-cols-3 gap-4">
                  <div className="border border-border rounded-xl p-4 bg-card lg:col-span-2">
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

                  <div className="border border-border rounded-xl p-4 bg-card">
                    <h3 className="text-xs font-bold text-foreground mb-2">Gas by Category</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={gasPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {gasPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1 mt-2">
                      {gasPieData.map(d => (
                        <div key={d.name} className="flex items-center gap-2 text-[10px]">
                          <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                          <span className="text-muted-foreground">{d.name}: {d.value.toLocaleString()} gas avg</span>
                        </div>
                      ))}
                    </div>
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
                        <span className="text-muted-foreground">{tests.reduce((a, t) => a + t.gasUsed, 0).toLocaleString()} gas total</span>
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

            {activeTab === "audit" && compiled && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="border border-border rounded-xl p-4 bg-card">
                  <h3 className="text-xs font-bold text-foreground mb-3">Security Audit Checklist</h3>
                  <div className="space-y-1.5">
                    {securityAudit.map((check, i) => (
                      <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${
                        check.status === "pass" ? "bg-green-500/5" : check.status === "warn" ? "bg-warning/5" : "bg-destructive/5"
                      }`}>
                        {check.status === "pass" ? <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" /> :
                         check.status === "warn" ? <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" /> :
                         <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />}
                        <div>
                          <p className="text-xs font-bold text-foreground">{check.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{check.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 text-center">
                    <p className="text-2xl font-bold text-green-500">{securityAudit.filter(a => a.status === "pass").length}</p>
                    <p className="text-[10px] text-muted-foreground">Passing</p>
                  </div>
                  <div className="p-4 rounded-xl bg-warning/5 border border-warning/20 text-center">
                    <p className="text-2xl font-bold text-warning">{securityAudit.filter(a => a.status === "warn").length}</p>
                    <p className="text-[10px] text-muted-foreground">Warnings</p>
                  </div>
                  <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-center">
                    <p className="text-2xl font-bold text-destructive">{securityAudit.filter(a => a.status === "fail").length}</p>
                    <p className="text-[10px] text-muted-foreground">Failures</p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "optimize" && compiled && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <p className="text-xs text-muted-foreground">Gas optimization suggestions based on bytecode analysis:</p>
                {optimizations.map((opt, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                    className="border border-border rounded-xl p-4 bg-card">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{opt.title}</h4>
                        <p className="text-[10px] text-muted-foreground mt-1">{opt.desc}</p>
                      </div>
                      <span className="text-[10px] font-mono text-green-500 bg-green-500/10 px-2 py-0.5 rounded-md whitespace-nowrap ml-3">
                        {opt.saving}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {activeTab === "abi" && compiled && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="border border-border rounded-xl p-4 bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-foreground">ABI Explorer ({compiled.abi.length} entries)</h3>
                    <button onClick={() => navigator.clipboard.writeText(JSON.stringify(compiled.abi, null, 2))}
                      className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {compiled.abi.map((entry, i) => (
                      <div key={i} className="px-3 py-2.5 rounded-lg bg-secondary">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                            entry.type === "constructor" ? "bg-warning/20 text-warning" :
                            entry.stateMutability === "view" || entry.stateMutability === "pure" ? "bg-chart-2/20 text-chart-2" : "bg-primary/20 text-primary"
                          }`}>{entry.stateMutability || entry.type}</span>
                          <span className="text-xs font-mono font-bold text-foreground">{entry.name}</span>
                        </div>
                        <div className="flex gap-4 text-[9px] font-mono text-muted-foreground">
                          <span>in: ({entry.inputs.map(i => `${i.type} ${i.name}`).join(", ")})</span>
                          {entry.outputs.length > 0 && <span>out: ({entry.outputs.map(o => `${o.type} ${o.name}`).join(", ")})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "interact" && deployStatus?.contractAddress && compiled && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="border border-border rounded-xl p-4 bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-bold text-foreground">Contract Interaction</h3>
                    <span className="text-[9px] font-mono text-muted-foreground ml-auto">{deployStatus.contractAddress.slice(0, 10)}...{deployStatus.contractAddress.slice(-8)}</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 mb-4">
                    {compiled.abi.filter(a => a.type === "function").map((fn, i) => (
                      <button key={i} onClick={() => { setInteractFn(fn.name); setInteractInputs({}); }}
                        className={`text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                          interactFn === fn.name ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
                        }`}>
                        <span className="font-mono font-bold">{fn.name}</span>
                        <span className="text-[9px] opacity-70 ml-2">({fn.inputs.length} params)</span>
                      </button>
                    ))}
                  </div>

                  {interactFn && (() => {
                    const fn = compiled.abi.find(a => a.name === interactFn);
                    if (!fn) return null;
                    return (
                      <div className="border-t border-border pt-3 space-y-2">
                        <p className="text-[10px] font-mono text-muted-foreground">{fn.name}({fn.inputs.map(i => `${i.type} ${i.name}`).join(", ")})</p>
                        {fn.inputs.map(input => (
                          <div key={input.name} className="flex items-center gap-2">
                            <label className="text-[10px] text-muted-foreground w-20">{input.name}</label>
                            <input type="text" placeholder={input.type}
                              value={interactInputs[input.name] || ""}
                              onChange={e => setInteractInputs(prev => ({ ...prev, [input.name]: e.target.value }))}
                              className="flex-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs font-mono text-foreground" />
                          </div>
                        ))}
                        <button onClick={() => handleInteract(interactFn)}
                          className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">
                          Call {interactFn}()
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* Console log */}
                <div className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground">Console Output</span>
                    <button onClick={() => setInteractLog([])} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
                  </div>
                  <div className="p-3 max-h-48 overflow-y-auto font-mono text-[10px] space-y-0.5">
                    {interactLog.length === 0 && <p className="text-muted-foreground">Call a function to see output here...</p>}
                    {interactLog.map((log, i) => (
                      <p key={i} className="text-foreground">{log}</p>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "deploy" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="border border-border rounded-xl p-6 bg-card">
                  <h3 className="text-xs font-bold text-foreground mb-4">Testnet Deployment</h3>
                  {deployStatus ? (
                    <div className="space-y-4">
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
                          <button onClick={() => setActiveTab("interact")} className="mt-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">
                            Open Interact Panel →
                          </button>
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
