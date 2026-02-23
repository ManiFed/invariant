import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Layers, ChevronUp, ChevronDown, AlertTriangle, Code2, Cpu, BarChart3, GitCompare, Rocket } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import StrategyEditor from "@/components/labs/StrategyEditor";
import StrategyBacktest from "@/components/labs/StrategyBacktest";
import StrategyResults from "@/components/labs/StrategyResults";
import AMMComparison from "@/components/advanced/AMMComparison";
import DeploymentExport from "@/components/advanced/DeploymentExport";
import { type StrategyConfig, type BacktestResult } from "@/lib/strategy-engine";

const SESSION_KEY = "strategy_lab_config";

function loadStrategies(): StrategyConfig[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function loadSavedInvariant() {
  try {
    const raw = sessionStorage.getItem("advanced_invariant");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function loadSavedFees(): number[] | null {
  try {
    const raw = sessionStorage.getItem("advanced_fees");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const tabs = [
  { id: "editor", label: "Strategy Editor", icon: Code2, desc: "Design LP strategies", step: 1 },
  { id: "backtest", label: "Simulation", icon: Cpu, desc: "Configure & run backtest", step: 2 },
  { id: "results", label: "Results", icon: BarChart3, desc: "Performance dashboard", step: 3 },
  { id: "compare", label: "Compare", icon: GitCompare, desc: "Compare across AMMs", step: 4 },
  { id: "deploy", label: "Deploy", icon: Rocket, desc: "Export strategy + config", step: 5 },
] as const;

type TabId = typeof tabs[number]["id"];

const LiquidityStrategyLab = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("editor");
  const [hovered, setHovered] = useState(false);
  const [strategies, setStrategies] = useState<StrategyConfig[]>(loadStrategies);
  const [results, setResults] = useState<BacktestResult[]>([]);
  const savedInvariant = useMemo(loadSavedInvariant, []);
  const savedFees = useMemo(loadSavedFees, []);

  const feeRate = useMemo(() => {
    if (savedFees && savedFees.length > 0) {
      return savedFees.reduce((a, b) => a + b, 0) / savedFees.length / 10000;
    }
    return 0.003;
  }, [savedFees]);

  const handleStrategiesChange = useCallback((s: StrategyConfig[]) => {
    setStrategies(s);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }, []);

  const handleResults = useCallback((r: BacktestResult[]) => {
    setResults(r);
    setActiveTab("results");
  }, []);

  const hasStrategies = strategies.length > 0;
  const hasResults = results.length > 0;

  const handleTabClick = (id: TabId) => {
    if (id === "backtest" && !hasStrategies) return;
    if (id === "results" && !hasResults) return;
    setActiveTab(id);
  };

  const currentTabIndex = tabs.findIndex(t => t.id === activeTab);
  const canGoPrev = currentTabIndex > 0;
  const canGoNext = currentTabIndex < tabs.length - 1;

  const goPrev = () => { if (canGoPrev) setActiveTab(tabs[currentTabIndex - 1].id); };
  const goNext = () => { if (canGoNext) setActiveTab(tabs[currentTabIndex + 1].id); };

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
          {savedInvariant && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-secondary border border-border">
              <span className="text-[9px] text-muted-foreground">Invariant:</span>
              <span className="text-[10px] font-mono text-foreground truncate max-w-48">{savedInvariant.expression}</span>
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className={`border-r border-border shrink-0 transition-all duration-200 flex flex-col sticky top-0 h-screen ${hovered ? "w-56" : "w-14"}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          <nav className="flex-1 py-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isLocked = (tab.id === "backtest" && !hasStrategies) || (tab.id === "results" && !hasResults);
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
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {activeTab === "editor" && (
                <StrategyEditor strategies={strategies} onStrategiesChange={handleStrategiesChange} />
              )}
              {activeTab === "backtest" && (
                <StrategyBacktest strategies={strategies} onResults={handleResults} savedFeeRate={feeRate} />
              )}
              {activeTab === "results" && (
                <StrategyResults results={results} />
              )}
              {activeTab === "compare" && (
                <AMMComparison savedInvariant={savedInvariant} />
              )}
              {activeTab === "deploy" && (
                <DeploymentExport savedInvariant={savedInvariant} savedFees={savedFees} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default LiquidityStrategyLab;
