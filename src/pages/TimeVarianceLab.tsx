import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Code2, Cpu, Search, BarChart3, Shield, Rocket, DollarSign, AlertTriangle, Upload, BookOpen, Clock, ChevronUp, ChevronDown, GitCompare, Layers, Maximize2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import InvariantEditor from "@/components/advanced/InvariantEditor";
import MonteCarloEngine from "@/components/advanced/MonteCarloEngine";
import ArbitrageEngine from "@/components/advanced/ArbitrageEngine";
import LiquidityAnalyzer from "@/components/advanced/LiquidityAnalyzer";
import StabilityAnalysis from "@/components/advanced/StabilityAnalysis";
import DeploymentExport from "@/components/advanced/DeploymentExport";
import FeeStructureEditor from "@/components/advanced/FeeStructureEditor";
import AMMComparison from "@/components/advanced/AMMComparison";
import { TimeVariancePanel, type TimeVarianceConfig, type Keyframe } from "@/components/labs/TimeVarianceComponents";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const tabs = [
  { id: "invariant", label: "Invariant Editor", icon: Code2, desc: "Design your time-variant AMM curve", step: 1 },
  { id: "fees", label: "Fee Structure", icon: DollarSign, desc: "Time-variant fee distribution", step: 2 },
  { id: "compare", label: "Compare", icon: GitCompare, desc: "Import an AMM to compare against", step: 3 },
  { id: "montecarlo", label: "Monte Carlo", icon: Cpu, desc: "Time-aware stress testing", step: 4 },
  { id: "arbitrage", label: "Arbitrage", icon: Search, desc: "Time-variant toxic flow analysis", step: 5 },
  { id: "liquidity", label: "Liquidity", icon: BarChart3, desc: "Time-variant depth & efficiency", step: 6 },
  { id: "stability", label: "Stability", icon: Shield, desc: "Time-variant stability checks", step: 7 },
  { id: "deploy", label: "Deploy", icon: Rocket, desc: "Export time-variant AMM config", step: 8 },
] as const;

type TabId = typeof tabs[number]["id"];

interface SavedInvariant {
  expression: string;
  presetId: string;
  weightA: number;
  weightB: number;
  kValue: number;
  amplification: number;
  rangeLower: number;
  rangeUpper: number;
}

interface LibraryAMM {
  id: string;
  name: string;
  formula: string;
  params: { wA: number; wB: number; k: number; amp?: number };
}

const LIBRARY_AMMS: LibraryAMM[] = [
  { id: "uniswap-v2", name: "Uniswap V2", formula: "x * y = k", params: { wA: 0.5, wB: 0.5, k: 10000 } },
  { id: "curve-stableswap", name: "Curve StableSwap", formula: "An²Σxᵢ + D = ADn² + D^(n+1)/(n²Πxᵢ)", params: { wA: 0.5, wB: 0.5, k: 10000, amp: 100 } },
  { id: "balancer-weighted", name: "Balancer Weighted Pool", formula: "x^w₁ · y^w₂ = k", params: { wA: 0.8, wB: 0.2, k: 10000 } },
  { id: "uniswap-v3", name: "Uniswap V3 Concentrated", formula: "(√x − √pₐ)(√y − √p_b) = L²", params: { wA: 0.5, wB: 0.5, k: 10000 } },
  { id: "solidly-ve33", name: "Solidly ve(3,3)", formula: "x³y + xy³ = k", params: { wA: 0.5, wB: 0.5, k: 10000 } },
  { id: "power-perp", name: "Power Perpetual Curve", formula: "x^0.3 · y^0.7 = k", params: { wA: 0.3, wB: 0.7, k: 10000 } },
];

const SESSION_KEY = "timevariance_invariant";
const FEE_SESSION_KEY = "timevariance_fees";
const TV_CONFIG_KEY = "timevariance_config";

function loadInvariant(): SavedInvariant | null {
  try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function loadFees(): number[] | null {
  try { const raw = sessionStorage.getItem(FEE_SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function loadTVConfig(): TimeVarianceConfig {
  try {
    const raw = sessionStorage.getItem(TV_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    mode: "keyframe",
    keyframes: [
      { id: "1", t: 0, weightA: 0.5, weightB: 0.5, feeRate: 0.003, amplification: 10, expression: "x * y = k" },
      { id: "2", t: 50, weightA: 0.7, weightB: 0.3, feeRate: 0.005, amplification: 50, expression: "x^0.7 · y^0.3 = k" },
      { id: "3", t: 100, weightA: 0.5, weightB: 0.5, feeRate: 0.003, amplification: 10, expression: "x * y = k" },
    ],
    functionExpr: "wA(t) = 0.5 + 0.2*sin(t*π/100)\nwB(t) = 1 - wA(t)",
    feeMode: "keyframe",
    feeFunctionExpr: "fee(t) = 30 + 20*sin(t*π/50)",
  };
}

const TimeVarianceLab = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("invariant");
  const [hovered, setHovered] = useState(false);
  const [savedInvariant, setSavedInvariant] = useState<SavedInvariant | null>(loadInvariant);
  const [savedFees, setSavedFees] = useState<number[] | null>(loadFees);
  const [showImport, setShowImport] = useState(false);
  const [tvConfig, setTVConfig] = useState<TimeVarianceConfig>(loadTVConfig);
  const [showFullEditor, setShowFullEditor] = useState(false);
  const [editingKeyframeId, setEditingKeyframeId] = useState<string | undefined>(undefined);
  const [selectedFeeKeyframe, setSelectedFeeKeyframe] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveInvariant = useCallback((inv: SavedInvariant) => {
    setSavedInvariant(inv);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(inv));
    // If editing a specific keyframe, update its expression
    if (editingKeyframeId) {
      const updatedKfs = tvConfig.keyframes.map(kf =>
        kf.id === editingKeyframeId
          ? { ...kf, expression: inv.expression, weightA: inv.weightA, weightB: inv.weightB, amplification: inv.amplification }
          : kf
      );
      const newConfig = { ...tvConfig, keyframes: updatedKfs };
      setTVConfig(newConfig);
      sessionStorage.setItem(TV_CONFIG_KEY, JSON.stringify(newConfig));
    }
    setShowFullEditor(false);
    setEditingKeyframeId(undefined);
  }, [editingKeyframeId, tvConfig]);

  const handleSaveFees = useCallback((fees: number[]) => {
    setSavedFees(fees);
    sessionStorage.setItem(FEE_SESSION_KEY, JSON.stringify(fees));
    // If editing fees for a specific keyframe, save to that keyframe
    if (selectedFeeKeyframe) {
      const updatedKfs = tvConfig.keyframes.map(kf =>
        kf.id === selectedFeeKeyframe ? { ...kf, fees } : kf
      );
      const newConfig = { ...tvConfig, keyframes: updatedKfs };
      setTVConfig(newConfig);
      sessionStorage.setItem(TV_CONFIG_KEY, JSON.stringify(newConfig));
    }
  }, [selectedFeeKeyframe, tvConfig]);

  const handleTVConfigChange = useCallback((config: TimeVarianceConfig) => {
    setTVConfig(config);
    sessionStorage.setItem(TV_CONFIG_KEY, JSON.stringify(config));
  }, []);

  const openFullEditor = useCallback((keyframeId?: string) => {
    setEditingKeyframeId(keyframeId);
    if (keyframeId) {
      const kf = tvConfig.keyframes.find(k => k.id === keyframeId);
      if (kf) {
        setSavedInvariant({
          expression: kf.expression,
          presetId: "custom",
          weightA: kf.weightA,
          weightB: kf.weightB,
          kValue: 10000,
          amplification: kf.amplification,
          rangeLower: 0.5,
          rangeUpper: 2.0,
        });
      }
    }
    setShowFullEditor(true);
  }, [tvConfig.keyframes]);

  const importFromLibrary = (amm: LibraryAMM) => {
    const inv: SavedInvariant = { expression: amm.formula, presetId: "custom", weightA: amm.params.wA, weightB: amm.params.wB, kValue: amm.params.k, amplification: amm.params.amp || 10, rangeLower: 0.5, rangeUpper: 2.0 };
    handleSaveInvariant(inv);
    setShowImport(false);
    setActiveTab("invariant");
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const inv: SavedInvariant = { expression: json.formula || json.expression || "x * y = k", presetId: "custom", weightA: json.params?.wA ?? json.weightA ?? 0.5, weightB: json.params?.wB ?? json.weightB ?? 0.5, kValue: json.params?.k ?? json.kValue ?? 10000, amplification: json.params?.amp ?? json.amplification ?? 10, rangeLower: json.rangeLower ?? 0.5, rangeUpper: json.rangeUpper ?? 2.0 };
        if (json.fees) handleSaveFees(json.fees);
        handleSaveInvariant(inv);
        setShowImport(false);
        setActiveTab("invariant");
      } catch { alert("Invalid JSON file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const hasInvariant = savedInvariant !== null;

  const handleTabClick = (id: TabId) => {
    if (id !== "invariant" && !hasInvariant) return;
    setActiveTab(id);
  };

  const currentTabIndex = tabs.findIndex(t => t.id === activeTab);
  const canGoPrev = currentTabIndex > 0;
  const canGoNext = currentTabIndex < tabs.length - 1 && (currentTabIndex === 0 ? hasInvariant : true);
  const goPrev = () => { if (canGoPrev) setActiveTab(tabs[currentTabIndex - 1].id); };
  const goNext = () => { if (canGoNext) setActiveTab(tabs[currentTabIndex + 1].id); };

  // Time-variance context banner for analytical tabs
  const tvContextBanner = useMemo(() => {
    const kfCount = tvConfig.keyframes.length;
    const expressions = [...new Set(tvConfig.keyframes.map(kf => kf.expression))];
    return (
      <div className="surface-elevated rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-3.5 h-3.5 text-chart-2" />
          <h4 className="text-[10px] font-bold text-foreground">Time-Variance Active</h4>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-chart-2/10 text-chart-2">{tvConfig.mode === "keyframe" ? `${kfCount} keyframes` : "function mode"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {tvConfig.mode === "keyframe" ? expressions.map((expr, i) => (
            <div key={i} className="px-2 py-1 rounded-md bg-secondary border border-border">
              <span className="text-[9px] font-mono text-foreground">{expr}</span>
            </div>
          )) : (
            <div className="px-2 py-1 rounded-md bg-secondary border border-border">
              <span className="text-[9px] font-mono text-foreground">{tvConfig.functionExpr.split("\n")[0]}</span>
            </div>
          )}
          {savedFees && (
            <div className="px-2 py-1 rounded-md bg-secondary border border-border">
              <span className="text-[9px] text-muted-foreground">Fee: </span>
              <span className="text-[9px] font-mono text-foreground">{(savedFees.reduce((a,b)=>a+b,0)/savedFees.length).toFixed(0)} bps avg</span>
            </div>
          )}
        </div>
        <p className="text-[8px] text-muted-foreground mt-2">Analysis below accounts for time-varying parameters. Results represent aggregate behavior across the full time range.</p>
      </div>
    );
  }, [tvConfig, savedFees]);

  // Get the currently selected fee keyframe's saved fees for the fee editor
  const activeFeeKeyframe = selectedFeeKeyframe
    ? tvConfig.keyframes.find(kf => kf.id === selectedFeeKeyframe)
    : tvConfig.keyframes[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/labs")} className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-4 h-4" /></button>
          <Clock className="w-4 h-4 text-chart-2" />
          <span className="text-sm font-bold text-foreground tracking-tight">TIME-VARIANCE LAB</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-warning/30 text-warning">EXPERIMENTAL</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors border border-border">
            <Upload className="w-3 h-3" /> Import AMM
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleJsonUpload} />
          {savedInvariant && (
            <button onClick={() => setActiveTab("invariant")} className="flex items-center gap-2 px-3 py-1 rounded-lg bg-secondary border border-border hover:bg-accent transition-colors cursor-pointer">
              <span className="text-[9px] text-muted-foreground">Active:</span>
              <span className="text-[10px] font-mono text-foreground">{savedInvariant.expression}</span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm font-bold">Import AMM</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5"><BookOpen className="w-3 h-3" /> From Library</h4>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                {LIBRARY_AMMS.map(amm => (
                  <button key={amm.id} onClick={() => importFromLibrary(amm)} className="text-left p-2 rounded-lg bg-secondary border border-border hover:border-foreground/20 transition-all">
                    <p className="text-[10px] font-semibold text-foreground">{amm.name}</p>
                    <p className="text-[9px] font-mono text-muted-foreground truncate">{amm.formula}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5"><Upload className="w-3 h-3" /> Upload JSON</h4>
              <button onClick={() => fileInputRef.current?.click()} className="w-full p-3 rounded-lg border-2 border-dashed border-border hover:border-foreground/30 text-center text-xs text-muted-foreground hover:text-foreground transition-all">Click to upload a .json AMM config</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Expression Editor Dialog */}
      <Dialog open={showFullEditor} onOpenChange={(open) => { if (!open) { setShowFullEditor(false); setEditingKeyframeId(undefined); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {editingKeyframeId
                ? `Edit Expression — Keyframe ${tvConfig.keyframes.findIndex(k => k.id === editingKeyframeId) + 1}`
                : "Invariant Expression Editor"
              }
            </DialogTitle>
          </DialogHeader>
          <InvariantEditor onSaveInvariant={handleSaveInvariant} savedInvariant={savedInvariant} />
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className={`border-r border-border shrink-0 transition-all duration-200 flex flex-col sticky top-0 h-screen ${hovered ? "w-56" : "w-14"}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          <nav className="flex-1 py-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isLocked = tab.id !== "invariant" && !hasInvariant;
              return (
                <button key={tab.id} onClick={() => handleTabClick(tab.id)} disabled={isLocked}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? "bg-foreground/5 text-foreground border-r-2 border-foreground" : isLocked ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
                  title={!hovered ? tab.label : undefined}>
                  <div className="relative shrink-0">
                    <Icon className="w-4 h-4" />
                    {isLocked && <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-muted-foreground/30" />}
                  </div>
                  {hovered && (
                    <div className="min-w-0 overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono text-muted-foreground/60">{tab.step}</span>
                        <p className="text-xs font-medium truncate">{tab.label}</p>
                      </div>
                      <p className="text-[9px] text-muted-foreground truncate">{tab.desc}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
          {!hovered && !hasInvariant && (
            <div className="px-2 py-3 border-t border-border">
              <div className="flex items-center justify-center"><AlertTriangle className="w-3 h-3 text-warning" /></div>
            </div>
          )}
          <div className="border-t border-border p-2 flex flex-col gap-1">
            <button onClick={goPrev} disabled={!canGoPrev}
              className={`w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${canGoPrev ? "bg-secondary text-foreground hover:bg-accent border border-border" : "text-muted-foreground/30 cursor-not-allowed"}`}>
              <ChevronUp className="w-3 h-3" /> {hovered && "Previous"}
            </button>
            <button onClick={goNext} disabled={!canGoNext}
              className={`w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${canGoNext ? "bg-secondary text-foreground hover:bg-accent border border-border" : "text-muted-foreground/30 cursor-not-allowed"}`}>
              <ChevronDown className="w-3 h-3" /> {hovered && "Next"}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 max-w-7xl">
          {!hasInvariant && activeTab === "invariant" && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <p className="text-xs text-foreground"><strong>Step 1:</strong> Configure time-variance parameters below. Click the expand button on any keyframe to open the full expression editor, then click <strong>"Set as Active Invariant"</strong> to unlock the other tools.</p>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {activeTab === "invariant" && (
                <TimeVariancePanel
                  config={tvConfig}
                  onConfigChange={handleTVConfigChange}
                  onOpenFullEditor={openFullEditor}
                  hasActiveInvariant={hasInvariant}
                  onSaveAsActive={(params) => {
                    const inv: SavedInvariant = {
                      expression: params.expression,
                      presetId: "custom",
                      weightA: params.weightA,
                      weightB: params.weightB,
                      kValue: 10000,
                      amplification: params.amplification,
                      rangeLower: 0.5,
                      rangeUpper: 2.0,
                    };
                    handleSaveInvariant(inv);
                  }}
                />
              )}
              {activeTab === "fees" && (
                <div className="space-y-4">
                  {/* Time-variant fee mode selector */}
                  <div className="surface-elevated rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-chart-2" />
                        <h4 className="text-[10px] font-bold text-foreground">Time-Variant Fee Mode</h4>
                      </div>
                      <div className="flex rounded-md border border-border overflow-hidden">
                        <button onClick={() => handleTVConfigChange({ ...tvConfig, feeMode: "keyframe" })}
                          className={`flex items-center gap-1 px-2.5 py-1 text-[9px] font-medium transition-all ${tvConfig.feeMode === "keyframe" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                          <Layers className="w-3 h-3" /> Keyframes
                        </button>
                        <button onClick={() => handleTVConfigChange({ ...tvConfig, feeMode: "function" })}
                          className={`flex items-center gap-1 px-2.5 py-1 text-[9px] font-medium transition-all ${tvConfig.feeMode === "function" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                          <Code2 className="w-3 h-3" /> Function
                        </button>
                      </div>
                    </div>
                    {tvConfig.feeMode === "function" ? (
                      <div>
                        <label className="text-[9px] text-muted-foreground">Fee function f(t) — output in basis points</label>
                        <textarea
                          value={tvConfig.feeFunctionExpr}
                          onChange={e => handleTVConfigChange({ ...tvConfig, feeFunctionExpr: e.target.value })}
                          className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-[10px] font-mono text-foreground outline-none resize-none h-16"
                          placeholder="fee(t) = 30 + 20*sin(t*π/50)"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[9px] text-muted-foreground">Select a keyframe to edit its fee structure:</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {tvConfig.keyframes.map((kf, i) => (
                            <button
                              key={kf.id}
                              onClick={() => {
                                setSelectedFeeKeyframe(kf.id);
                                if (kf.fees) setSavedFees(kf.fees);
                              }}
                              className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all border ${
                                (selectedFeeKeyframe || tvConfig.keyframes[0]?.id) === kf.id
                                  ? "bg-foreground/5 text-foreground border-foreground/20"
                                  : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                              }`}
                            >
                              <span className="font-mono">t={kf.t}</span>
                              <span className="ml-1.5 text-[8px] text-muted-foreground">KF {i + 1}</span>
                              {kf.fees && <span className="ml-1 text-[8px] text-chart-2">✓</span>}
                            </button>
                          ))}
                        </div>
                        {activeFeeKeyframe && (
                          <div className="px-2 py-1.5 rounded-md bg-secondary border border-border">
                            <span className="text-[8px] text-muted-foreground">Editing fees for: </span>
                            <span className="text-[9px] font-mono text-foreground">{activeFeeKeyframe.expression} at t={activeFeeKeyframe.t}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <FeeStructureEditor onSaveFees={handleSaveFees} savedFees={activeFeeKeyframe?.fees || savedFees} />
                </div>
              )}
              {activeTab === "compare" && <AMMComparison savedInvariant={savedInvariant} />}
              {activeTab === "montecarlo" && (
                <div>
                  {tvContextBanner}
                  <MonteCarloEngine savedInvariant={savedInvariant} savedFees={savedFees} />
                </div>
              )}
              {activeTab === "arbitrage" && (
                <div>
                  {tvContextBanner}
                  <ArbitrageEngine savedInvariant={savedInvariant} savedFees={savedFees} />
                </div>
              )}
              {activeTab === "liquidity" && (
                <div>
                  {tvContextBanner}
                  <LiquidityAnalyzer savedInvariant={savedInvariant} />
                </div>
              )}
              {activeTab === "stability" && (
                <div>
                  {tvContextBanner}
                  <StabilityAnalysis savedInvariant={savedInvariant} savedFees={savedFees} />
                </div>
              )}
              {activeTab === "deploy" && (
                <div>
                  {tvContextBanner}
                  <DeploymentExport savedInvariant={savedInvariant} savedFees={savedFees} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default TimeVarianceLab;
