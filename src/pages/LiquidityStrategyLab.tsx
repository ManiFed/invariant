import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Code2, DollarSign, AlertTriangle, Upload, BookOpen, ChevronUp, ChevronDown, GitCompare, Layers, Play, TrendingUp, Shield, Rocket, Puzzle } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import InvariantEditor from "@/components/advanced/InvariantEditor";
import DeploymentExport from "@/components/advanced/DeploymentExport";
import FeeStructureEditor from "@/components/advanced/FeeStructureEditor";
import AMMComparison from "@/components/advanced/AMMComparison";
import StrategyEditor from "@/components/labs/StrategyEditor";
import StrategyBlockEditor from "@/components/labs/StrategyBlockEditor";
import StrategyBacktest from "@/components/labs/StrategyBacktest";
import StrategyResults from "@/components/labs/StrategyResults";
import StabilityAnalysis from "@/components/advanced/StabilityAnalysis";
import { type StrategyConfig, type BacktestResult } from "@/lib/strategy-engine";
import { type CustomStrategy } from "@/lib/strategy-blocks";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const tabs = [
  { id: "invariant", label: "Invariant Editor", icon: Code2, desc: "Design your AMM curve formula", step: 1 },
  { id: "fees", label: "Fee Structure", icon: DollarSign, desc: "Custom fee distribution across the curve", step: 2 },
  { id: "strategy", label: "Strategy Presets", icon: Layers, desc: "Preset LP management strategies", step: 3 },
  { id: "blocks", label: "Block Editor", icon: Puzzle, desc: "Build custom strategies with blocks", step: 4 },
  { id: "compare", label: "Compare", icon: GitCompare, desc: "Import an AMM to compare against", step: 5 },
  { id: "backtest", label: "Backtest", icon: Play, desc: "Run Monte Carlo strategy simulation", step: 6 },
  { id: "results", label: "Results", icon: TrendingUp, desc: "Strategy performance dashboard", step: 7 },
  { id: "stability", label: "Stability", icon: Shield, desc: "Strategy stability diagnostics", step: 8 },
  { id: "deploy", label: "Deploy", icon: Rocket, desc: "Export as Solidity, JSON, or docs", step: 9 },
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

const SESSION_KEY = "strategy_lab_invariant";
const FEE_SESSION_KEY = "strategy_lab_fees";
const STRATEGY_SESSION_KEY = "strategy_lab_config";
const CUSTOM_STRATEGY_SESSION_KEY = "strategy_lab_custom_blocks";

function loadInvariant(): SavedInvariant | null {
  try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function loadFees(): number[] | null {
  try { const raw = sessionStorage.getItem(FEE_SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function loadStrategies(): StrategyConfig[] {
  try { const raw = sessionStorage.getItem(STRATEGY_SESSION_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function loadCustomStrategies(): CustomStrategy[] {
  try { const raw = sessionStorage.getItem(CUSTOM_STRATEGY_SESSION_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

const LiquidityStrategyLab = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("invariant");
  const [hovered, setHovered] = useState(false);
  const [savedInvariant, setSavedInvariant] = useState<SavedInvariant | null>(loadInvariant);
  const [savedFees, setSavedFees] = useState<number[] | null>(loadFees);
  const [strategies, setStrategies] = useState<StrategyConfig[]>(loadStrategies);
  const [customStrategies, setCustomStrategies] = useState<CustomStrategy[]>(loadCustomStrategies);
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [showImport, setShowImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const feeRate = savedFees && savedFees.length > 0
    ? savedFees.reduce((a, b) => a + b, 0) / savedFees.length / 10000
    : 0.003;

  const handleSaveInvariant = useCallback((inv: SavedInvariant) => {
    setSavedInvariant(inv);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(inv));
  }, []);

  const handleSaveFees = useCallback((fees: number[]) => {
    setSavedFees(fees);
    sessionStorage.setItem(FEE_SESSION_KEY, JSON.stringify(fees));
  }, []);

  const handleStrategiesChange = useCallback((s: StrategyConfig[]) => {
    setStrategies(s);
    sessionStorage.setItem(STRATEGY_SESSION_KEY, JSON.stringify(s));
  }, []);

  const handleCustomStrategiesChange = useCallback((s: CustomStrategy[]) => {
    setCustomStrategies(s);
    sessionStorage.setItem(CUSTOM_STRATEGY_SESSION_KEY, JSON.stringify(s));
  }, []);

  const handleResults = useCallback((r: BacktestResult[]) => {
    setResults(r);
    setActiveTab("results");
  }, []);

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
  const hasStrategies = strategies.length > 0;
  const hasResults = results.length > 0;

  const handleTabClick = (id: TabId) => {
    if (id !== "invariant" && !hasInvariant) return;
    if (id === "backtest" && !hasStrategies) return;
    if (id === "results" && !hasResults) return;
    setActiveTab(id);
  };

  const currentTabIndex = tabs.findIndex(t => t.id === activeTab);
  const canGoPrev = currentTabIndex > 0;
  const canGoNext = currentTabIndex < tabs.length - 1 && (currentTabIndex === 0 ? hasInvariant : true);

  const goPrev = () => { if (canGoPrev) setActiveTab(tabs[currentTabIndex - 1].id); };
  const goNext = () => { if (canGoNext) setActiveTab(tabs[currentTabIndex + 1].id); };

  const strategyBanner = hasStrategies ? (
    <div className="surface-elevated rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="w-3.5 h-3.5 text-chart-4" />
        <h4 className="text-[10px] font-bold text-foreground">Active Strategies</h4>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-chart-4/10 text-chart-4">{strategies.length} configured</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {strategies.map(s => (
          <div key={s.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border text-[9px] font-mono">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-foreground">{s.name}</span>
            <span className="text-muted-foreground">{s.rangeWidth >= 10 ? "∞" : `±${(s.rangeWidth * 100).toFixed(0)}%`}</span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/labs")} className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-4 h-4" /></button>
          <Layers className="w-4 h-4 text-chart-4" />
          <span className="text-sm font-bold text-foreground tracking-tight">LIQUIDITY STRATEGY LAB</span>
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

      <div className="flex flex-1 min-h-0">
        <aside className={`border-r border-border shrink-0 transition-all duration-200 flex flex-col sticky top-0 h-screen ${hovered ? "w-56" : "w-14"}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          <nav className="flex-1 py-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isLocked = (tab.id !== "invariant" && !hasInvariant) || (tab.id === "backtest" && !hasStrategies) || (tab.id === "results" && !hasResults);
              return (
                <button key={tab.id} onClick={() => handleTabClick(tab.id)} disabled={isLocked}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? "bg-foreground/5 text-foreground border-r-2 border-foreground" : isLocked ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
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

        <main className="flex-1 overflow-y-auto p-6 max-w-7xl">
          {!hasInvariant && activeTab === "invariant" && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <p className="text-xs text-foreground"><strong>Step 1:</strong> Design your invariant below, then click <strong>"Set as Active Invariant"</strong> to unlock the other tools.</p>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {activeTab === "invariant" && <InvariantEditor onSaveInvariant={handleSaveInvariant} savedInvariant={savedInvariant} />}
              {activeTab === "fees" && <FeeStructureEditor onSaveFees={handleSaveFees} savedFees={savedFees} />}
              {activeTab === "strategy" && <StrategyEditor strategies={strategies} onStrategiesChange={handleStrategiesChange} />}
              {activeTab === "blocks" && (
                <StrategyBlockEditor
                  strategies={strategies}
                  onStrategiesChange={handleStrategiesChange}
                  customStrategies={customStrategies}
                  onCustomStrategiesChange={handleCustomStrategiesChange}
                />
              )}
              {activeTab === "compare" && <AMMComparison savedInvariant={savedInvariant} />}
              {activeTab === "backtest" && (
                <div>
                  {strategyBanner}
                  <StrategyBacktest strategies={strategies} onResults={handleResults} savedFeeRate={feeRate} />
                </div>
              )}
              {activeTab === "results" && (
                <div>
                  {strategyBanner}
                  <StrategyResults results={results} />
                </div>
              )}
              {activeTab === "stability" && (
                <div>
                  {strategyBanner}
                  <StabilityAnalysis savedInvariant={savedInvariant} savedFees={savedFees} strategies={strategies} backtestResults={results} />
                </div>
              )}
              {activeTab === "deploy" && (
                <div>
                  {strategyBanner}
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

export default LiquidityStrategyLab;
