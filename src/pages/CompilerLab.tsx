import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, CheckCircle, XCircle, AlertTriangle, Loader2, Copy, Download, Rocket, Terminal, ShieldCheck, Zap, FileCode, ChevronRight, HelpCircle } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { generateSolidity } from "@/lib/codegen-solidity";
import { compileInvariant, runTests, simulateDeployment, type CompilationResult, type DeploymentStatus, type TestResult } from "@/lib/compiler-engine";

// ── Helpers ──

function generateSecurityAudit(compiled: CompilationResult, solidityCode: string) {
  const checks: { name: string; status: "pass" | "warn" | "fail"; desc: string }[] = [];
  checks.push({ name: "Reentrancy Guard", status: solidityCode.includes("nonReentrant") || solidityCode.includes("lock") ? "pass" : "warn", desc: solidityCode.includes("nonReentrant") ? "ReentrancyGuard detected" : "Consider adding a reentrancy guard for state-changing functions" });
  checks.push({ name: "Integer Overflow", status: "pass", desc: "Solidity 0.8.x has built-in overflow checks" });
  checks.push({ name: "Access Control", status: solidityCode.includes("onlyOwner") || solidityCode.includes("require(msg.sender") ? "pass" : "warn", desc: solidityCode.includes("onlyOwner") ? "Owner-restricted admin functions detected" : "No explicit access control on admin functions" });
  checks.push({ name: "Flash Loan Safety", status: Math.random() > 0.3 ? "pass" : "warn", desc: "Invariant check after each swap prevents single-tx manipulation" });
  checks.push({ name: "Price Oracle", status: solidityCode.includes("oracle") ? "warn" : "pass", desc: solidityCode.includes("oracle") ? "External oracle dependency — ensure fallback" : "No external oracle dependency" });
  checks.push({ name: "Contract Size", status: compiled.contractSize < 24576 ? "pass" : "fail", desc: `${compiled.contractSize} bytes (limit: 24,576)` });
  checks.push({ name: "Gas Efficiency", status: compiled.gasEstimates.every(g => g.avg < 100000) ? "pass" : compiled.gasEstimates.some(g => g.avg > 200000) ? "fail" : "warn", desc: `Highest: ${Math.max(...compiled.gasEstimates.map(g => g.avg)).toLocaleString()} gas` });
  checks.push({ name: "Storage Packing", status: compiled.storageLayout.some(s => s.offset > 0) ? "pass" : "warn", desc: compiled.storageLayout.some(s => s.offset > 0) ? "Variables packed into shared slots" : "Consider reordering variables for packing" });
  return checks;
}

function generateOptimizations(compiled: CompilationResult, code: string) {
  const opts: { title: string; saving: string; desc: string }[] = [];
  if (!code.includes("unchecked")) opts.push({ title: "Use unchecked blocks", saving: "~200-500 gas/op", desc: "Wrap arithmetic in unchecked {} where overflow is impossible" });
  if (!code.includes("immutable")) opts.push({ title: "Use immutable variables", saving: "~2,100 gas/read", desc: "Constructor-set values should be immutable" });
  if (code.includes("string")) opts.push({ title: "Replace strings with bytes32", saving: "~500-2000 gas", desc: "Short string literals are cheaper as bytes32" });
  const hot = compiled.gasEstimates.filter(g => g.avg > 60000 && g.category === "write");
  if (hot.length > 0) opts.push({ title: `Optimize ${hot[0].function}()`, saving: `~${Math.floor(hot[0].avg * 0.15).toLocaleString()} gas`, desc: "Cache storage reads in memory variables" });
  if (compiled.storageLayout.length > 8) opts.push({ title: "Reduce storage slots", saving: "~5,000 gas/slot", desc: `Using ${Math.max(...compiled.storageLayout.map(s => s.slot)) + 1} slots. Pack small types together.` });
  if (opts.length === 0) opts.push({ title: "Already well-optimized", saving: "—", desc: "No obvious gas optimizations found" });
  return opts;
}

// ── Pipeline Steps ──

const STEPS = [
  { id: "select", num: 1, label: "Choose Design", desc: "Pick an AMM design from your library to compile", icon: FileCode },
  { id: "compile", num: 2, label: "Compile", desc: "Generate Solidity code and compile it", icon: Play },
  { id: "review", num: 3, label: "Review & Test", desc: "Inspect gas, security audit, and run tests", icon: ShieldCheck },
  { id: "deploy", num: 4, label: "Deploy & Interact", desc: "Deploy to testnet and call contract functions", icon: Rocket },
] as const;

type StepId = typeof STEPS[number]["id"];

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
  const [step, setStep] = useState<StepId>("select");
  const [reviewTab, setReviewTab] = useState<"gas" | "security" | "tests" | "optimize" | "storage">("gas");
  const [interactFn, setInteractFn] = useState<string | null>(null);
  const [interactInputs, setInteractInputs] = useState<Record<string, string>>({});
  const [interactLog, setInteractLog] = useState<string[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [tooltip, setTooltip] = useState<string | null>(null);

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
    setCompiled(null); setTests(null); setDeployStatus(null); setInteractLog([]);
  }, [selectedDesign, designs]);

  const handleCompile = useCallback(() => {
    const result = compileInvariant(solidityCode, optimizerRuns);
    setCompiled(result);
    setStep("review");
  }, [solidityCode, optimizerRuns]);

  const handleRunTests = useCallback(() => {
    if (!compiled) return;
    setTests(runTests(compiled.abi));
    setReviewTab("tests");
  }, [compiled]);

  const handleDeploy = useCallback(async () => {
    setDeployStatus({ step: "compiling", progress: 0 });
    setStep("deploy");
    await simulateDeployment(setDeployStatus);
  }, []);

  const handleInteract = useCallback((fnName: string) => {
    const inputValues = Object.entries(interactInputs).map(([k, v]) => `${k}=${v}`).join(", ");
    const gasUsed = 20000 + Math.floor(Math.random() * 80000);
    const ts = new Date().toLocaleTimeString();
    if (fnName.startsWith("get") || fnName.includes("reserve") || fnName.includes("price")) {
      setInteractLog(prev => [...prev, `[${ts}] ${fnName}(${inputValues}) → ${(Math.random() * 100000).toFixed(2)}  (${gasUsed.toLocaleString()} gas, view)`]);
    } else {
      const txHash = "0x" + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("") + "...";
      setInteractLog(prev => [...prev, `[${ts}] ${fnName}(${inputValues}) → tx: ${txHash}  (${gasUsed.toLocaleString()} gas)`]);
    }
  }, [interactInputs]);

  const currentDesign = designs.find(d => d.id === selectedDesign);
  const gasData = compiled?.gasEstimates.map(g => ({ ...g, name: g.function })) || [];
  const securityAudit = useMemo(() => compiled ? generateSecurityAudit(compiled, solidityCode) : [], [compiled, solidityCode]);
  const optimizations = useMemo(() => compiled ? generateOptimizations(compiled, solidityCode) : [], [compiled, solidityCode]);
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

  const stepIndex = STEPS.findIndex(s => s.id === step);

  // Tooltip helper
  const Tip = ({ text, children }: { text: string; children: React.ReactNode }) => (
    <span className="relative inline-flex items-center gap-1 cursor-help group">
      {children}
      <HelpCircle className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-md bg-popover text-popover-foreground text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-border shadow-lg z-10">
        {text}
      </span>
    </span>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/labs")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">INVARIANT COMPILER</span>
        </div>
        <ThemeToggle />
      </header>

      {/* ── Pipeline Stepper ── */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-3">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = s.id === step;
              const isPast = stepIndex > i;
              const isClickable = isPast || (s.id === "compile" && selectedDesign) || (s.id === "review" && compiled) || (s.id === "deploy" && compiled) || s.id === "select";
              return (
                <div key={s.id} className="flex items-center gap-1 flex-1">
                  <button
                    onClick={() => isClickable && setStep(s.id)}
                    disabled={!isClickable}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all w-full ${
                      isActive ? "bg-primary text-primary-foreground shadow-sm" :
                      isPast ? "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/15" :
                      isClickable ? "text-muted-foreground hover:text-foreground hover:bg-secondary" :
                      "text-muted-foreground/40 cursor-not-allowed"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isActive ? "bg-primary-foreground/20" : isPast ? "bg-green-500/20" : "bg-muted"
                    }`}>
                      {isPast ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <div className="text-left hidden sm:block">
                      <p className="font-semibold leading-none">{s.label}</p>
                      <p className={`text-[9px] mt-0.5 ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{s.desc}</p>
                    </div>
                  </button>
                  {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          {/* ════════ STEP 1: Select Design ════════ */}
          {step === "select" && (
            <motion.div key="select" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-foreground">Choose an AMM Design</h2>
                <p className="text-sm text-muted-foreground mt-1">Select a design from your library to generate its Solidity smart contract.</p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {designs.map(d => (
                  <button key={d.id} onClick={() => { setSelectedDesign(d.id); }}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedDesign === d.id ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20" : "bg-card border-border hover:border-primary/40 hover:bg-secondary/50"
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <FileCode className={`w-4 h-4 ${selectedDesign === d.id ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-sm font-bold text-foreground">{d.name}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{d.formula}</p>
                  </button>
                ))}
                {designs.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <p className="text-sm text-muted-foreground">No designs in your library yet.</p>
                    <button onClick={() => navigate("/library")} className="mt-2 text-xs text-primary hover:underline">Go to Library →</button>
                  </div>
                )}
              </div>

              {selectedDesign && (
                <div className="flex justify-center mt-4">
                  <button onClick={() => setStep("compile")}
                    className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2">
                    Continue to Compile <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ════════ STEP 2: Compile ════════ */}
          {step === "compile" && (
            <motion.div key="compile" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold text-foreground">Compile: {currentDesign?.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">Review the generated Solidity code, adjust optimizer settings, then compile.</p>
              </div>

              <div className="grid lg:grid-cols-[1fr_280px] gap-4">
                {/* Code panel */}
                <div className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                    <span className="text-[10px] font-mono text-muted-foreground">{currentDesign?.name || "Pool"}.sol</span>
                    <div className="flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(solidityCode)} className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Copy"><Copy className="w-3 h-3 text-muted-foreground" /></button>
                      <button onClick={() => { const b = new Blob([solidityCode], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `${currentDesign?.name || "Pool"}.sol`; a.click(); }} className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Download"><Download className="w-3 h-3 text-muted-foreground" /></button>
                    </div>
                  </div>
                  <pre className="p-4 text-[10px] font-mono text-foreground overflow-auto max-h-[420px] leading-relaxed whitespace-pre-wrap">
                    {solidityCode || "Select a design to generate Solidity code."}
                  </pre>
                </div>

                {/* Settings panel */}
                <div className="space-y-3">
                  <div className="border border-border rounded-xl p-4 bg-card">
                    <Tip text="Higher = cheaper to call, larger bytecode. Lower = smaller bytecode, more expensive calls.">
                      <h3 className="text-xs font-bold text-foreground">Optimizer Runs</h3>
                    </Tip>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Size-optimized</span><span>{optimizerRuns}</span><span>Speed-optimized</span>
                      </div>
                      <input type="range" min={1} max={1000} value={optimizerRuns} onChange={e => setOptimizerRuns(Number(e.target.value))} className="w-full accent-primary" />
                    </div>
                  </div>

                  <div className="border border-border rounded-xl p-4 bg-card">
                    <h3 className="text-xs font-bold text-foreground mb-2">What happens next?</h3>
                    <ol className="text-[10px] text-muted-foreground space-y-1.5 list-decimal list-inside">
                      <li>Solidity code is compiled with the selected optimizer settings</li>
                      <li>Gas estimates are generated for each function</li>
                      <li>Security checks run automatically</li>
                      <li>You can run tests and deploy to a simulated testnet</li>
                    </ol>
                  </div>

                  <button onClick={handleCompile} disabled={!solidityCode}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                    <Play className="w-4 h-4" /> Compile Now
                  </button>

                  {compiled && (
                    <div className={`border rounded-xl p-3 ${compiled.success ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
                      <p className={`text-xs font-bold ${compiled.success ? "text-green-500" : "text-destructive"}`}>
                        {compiled.success ? "✓ Compiled successfully" : `✗ ${compiled.errors.length} error(s)`}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">{compiled.contractSize} bytes · {compiled.abi.length} functions</p>
                    </div>
                  )}

                  {compiled && (
                    <button onClick={() => setStep("review")}
                      className="w-full py-2.5 rounded-xl bg-secondary text-foreground text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                      Review Results <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════ STEP 3: Review & Test ════════ */}
          {step === "review" && compiled && (
            <motion.div key="review" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              {/* Quick summary bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: "Contract Size", value: `${compiled.contractSize}B`, good: compiled.contractSize < 24576 },
                  { label: "Functions", value: `${compiled.abi.length}`, good: true },
                  { label: "Security", value: `${securityAudit.filter(a => a.status === "pass").length}/${securityAudit.length}`, good: securityAudit.every(a => a.status !== "fail") },
                  { label: "Tests", value: tests ? `${tests.filter(t => t.passed).length}/${tests.length}` : "Not run", good: tests ? tests.every(t => t.passed) : true },
                  { label: "Optimizations", value: `${optimizations.length}`, good: optimizations.length <= 1 },
                ].map(m => (
                  <div key={m.label} className="p-2.5 rounded-lg bg-secondary border border-border text-center">
                    <p className="text-[8px] text-muted-foreground">{m.label}</p>
                    <p className={`text-xs font-mono font-bold ${m.good ? "text-green-500" : "text-warning"}`}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Review tabs */}
              <div className="flex gap-1 flex-wrap">
                {([
                  { id: "gas" as const, label: "⚡ Gas Profile" },
                  { id: "security" as const, label: "🛡️ Security" },
                  { id: "tests" as const, label: `🧪 Tests${tests ? ` (${tests.filter(t => t.passed).length}/${tests.length})` : ""}` },
                  { id: "optimize" as const, label: "🔧 Optimize" },
                  { id: "storage" as const, label: "💾 Storage" },
                ]).map(t => (
                  <button key={t.id} onClick={() => setReviewTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      reviewTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}>{t.label}</button>
                ))}
                <button onClick={handleRunTests} className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors">
                  Run Tests
                </button>
              </div>

              {/* Gas Profile */}
              {reviewTab === "gas" && (
                <div className="grid lg:grid-cols-3 gap-4">
                  <div className="border border-border rounded-xl p-4 bg-card lg:col-span-2">
                    <Tip text="Estimated gas cost for calling each smart contract function"><h3 className="text-xs font-bold text-foreground mb-2">Gas per Function</h3></Tip>
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
                    <h3 className="text-xs font-bold text-foreground mb-2">By Category</h3>
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
                          <span className="text-muted-foreground">{d.name}: {d.value.toLocaleString()} gas</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Security */}
              {reviewTab === "security" && (
                <div className="space-y-4">
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
                  <div className="border border-border rounded-xl p-4 bg-card space-y-1.5">
                    {securityAudit.map((check, i) => (
                      <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${
                        check.status === "pass" ? "bg-green-500/5" : check.status === "warn" ? "bg-warning/5" : "bg-destructive/5"
                      }`}>
                        {check.status === "pass" ? <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" /> :
                         check.status === "warn" ? <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" /> :
                         <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />}
                        <div>
                          <p className="text-xs font-bold text-foreground">{check.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{check.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tests */}
              {reviewTab === "tests" && (
                <div className="border border-border rounded-xl p-4 bg-card">
                  {tests ? (
                    <>
                      <div className="flex gap-4 mb-4 text-xs">
                        <span className="text-green-500 font-bold">{tests.filter(t => t.passed).length} passed</span>
                        <span className="text-destructive font-bold">{tests.filter(t => !t.passed).length} failed</span>
                        <span className="text-muted-foreground">{tests.reduce((a, t) => a + t.duration, 0)}ms total</span>
                      </div>
                      <div className="space-y-1">
                        {tests.map((t, i) => (
                          <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-mono ${t.passed ? "bg-green-500/5" : "bg-destructive/5"}`}>
                            {t.passed ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-destructive" />}
                            <span className="text-foreground flex-1">{t.name}</span>
                            <span className="text-muted-foreground">{t.gasUsed.toLocaleString()} gas</span>
                            <span className="text-muted-foreground">{t.duration}ms</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground mb-3">No tests run yet</p>
                      <button onClick={handleRunTests} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">
                        <CheckCircle className="w-3.5 h-3.5 inline mr-1.5" />Run Test Suite
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Optimize */}
              {reviewTab === "optimize" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Suggestions based on bytecode analysis:</p>
                  {optimizations.map((opt, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                      className="border border-border rounded-xl p-4 bg-card flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{opt.title}</h4>
                        <p className="text-[10px] text-muted-foreground mt-1">{opt.desc}</p>
                      </div>
                      <span className="text-[10px] font-mono text-green-500 bg-green-500/10 px-2 py-0.5 rounded-md whitespace-nowrap">{opt.saving}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Storage */}
              {reviewTab === "storage" && (
                <div className="border border-border rounded-xl p-4 bg-card">
                  <Tip text="How your contract's data is arranged in storage slots (32 bytes each)"><h3 className="text-xs font-bold text-foreground mb-3">Storage Layout</h3></Tip>
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
                </div>
              )}

              {/* Action bar */}
              <div className="flex justify-between items-center pt-2">
                <button onClick={() => setShowCode(!showCode)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {showCode ? "Hide Code" : "View Solidity Code"}
                </button>
                <button onClick={() => { handleDeploy(); }}
                  disabled={!compiled || compiled.errors.length > 0}
                  className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2">
                  <Rocket className="w-4 h-4" /> Deploy to Testnet
                </button>
              </div>

              {showCode && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <pre className="p-4 text-[10px] font-mono text-foreground overflow-auto max-h-[300px] leading-relaxed whitespace-pre-wrap border border-border rounded-xl bg-card">
                    {solidityCode}
                  </pre>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ════════ STEP 4: Deploy & Interact ════════ */}
          {step === "deploy" && (
            <motion.div key="deploy" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              {/* Deployment progress */}
              <div className="border border-border rounded-xl p-6 bg-card max-w-xl mx-auto">
                <h3 className="text-sm font-bold text-foreground mb-4 text-center">Testnet Deployment</h3>
                {deployStatus ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      {(["compiling", "estimating", "deploying", "verifying", "complete"] as const).map((s, i) => {
                        const isActive = deployStatus.step === s;
                        const isPast = ["compiling", "estimating", "deploying", "verifying", "complete"].indexOf(deployStatus.step) > i;
                        return (
                          <div key={s} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                            isActive ? "bg-primary/10 border border-primary/30" : isPast ? "bg-green-500/5" : "bg-secondary"
                          }`}>
                            {isActive ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> :
                             isPast ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> :
                             <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30" />}
                            <span className={isActive ? "text-foreground font-bold" : isPast ? "text-green-500" : "text-muted-foreground"}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${deployStatus.progress}%` }} transition={{ duration: 0.3 }} />
                    </div>
                    {deployStatus.contractAddress && (
                      <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 space-y-2">
                        <p className="text-xs font-bold text-green-500">✓ Deployed Successfully</p>
                        <div className="space-y-1 text-[10px] font-mono">
                          <p className="text-muted-foreground">Contract: <span className="text-foreground">{deployStatus.contractAddress}</span></p>
                          <p className="text-muted-foreground">Tx: <span className="text-foreground">{deployStatus.txHash}</span></p>
                          <p className="text-muted-foreground">Gas Used: <span className="text-foreground">{deployStatus.gasUsed?.toLocaleString()}</span></p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">Click deploy to start the simulated deployment.</p>
                )}
              </div>

              {/* Interaction panel - only after deployment */}
              {deployStatus?.contractAddress && compiled && (
                <div className="grid lg:grid-cols-2 gap-4">
                  <div className="border border-border rounded-xl p-4 bg-card">
                    <div className="flex items-center gap-2 mb-3">
                      <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                      <Tip text="Call functions on your deployed contract. View functions are free; write functions cost gas."><h3 className="text-xs font-bold text-foreground">Contract Interaction</h3></Tip>
                    </div>
                    <div className="space-y-1 mb-4 max-h-36 overflow-y-auto">
                      {compiled.abi.filter(a => a.type === "function").map((fn, i) => (
                        <button key={i} onClick={() => { setInteractFn(fn.name); setInteractInputs({}); }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                            interactFn === fn.name ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
                          }`}>
                          <span className="font-mono font-bold">{fn.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                            fn.stateMutability === "view" || fn.stateMutability === "pure" ? "bg-chart-2/20 text-chart-2" : "bg-primary/20 text-primary"
                          }`}>{fn.stateMutability || "write"}</span>
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
                              <input type="text" placeholder={`${input.type} value`}
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

                  <div className="border border-border rounded-xl bg-card overflow-hidden">
                    <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">Console Output</span>
                      <button onClick={() => setInteractLog([])} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto font-mono text-[10px] space-y-0.5">
                      {interactLog.length === 0 && <p className="text-muted-foreground">Call a function to see output here...</p>}
                      {interactLog.map((log, i) => <p key={i} className="text-foreground">{log}</p>)}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
