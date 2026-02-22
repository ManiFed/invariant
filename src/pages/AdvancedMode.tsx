import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Code2, Cpu, Search, BarChart3, Shield, Rocket, DollarSign, AlertTriangle } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import InvariantEditor from "@/components/advanced/InvariantEditor";
import MonteCarloEngine from "@/components/advanced/MonteCarloEngine";
import ArbitrageEngine from "@/components/advanced/ArbitrageEngine";
import LiquidityAnalyzer from "@/components/advanced/LiquidityAnalyzer";
import StabilityAnalysis from "@/components/advanced/StabilityAnalysis";
import DeploymentExport from "@/components/advanced/DeploymentExport";
import FeeStructureEditor from "@/components/advanced/FeeStructureEditor";

const tabs = [
  { id: "invariant", label: "Invariant Editor", icon: Code2, desc: "Design your AMM curve formula", step: 1 },
  { id: "fees", label: "Fee Structure", icon: DollarSign, desc: "Custom fee distribution across the curve", step: 2 },
  { id: "montecarlo", label: "Monte Carlo", icon: Cpu, desc: "Stress-test with simulated price paths", step: 3 },
  { id: "arbitrage", label: "Arbitrage", icon: Search, desc: "Model toxic flow and MEV extraction", step: 4 },
  { id: "liquidity", label: "Liquidity", icon: BarChart3, desc: "Compare depth, efficiency, slippage", step: 5 },
  { id: "stability", label: "Stability", icon: Shield, desc: "Run diagnostic checks for edge cases", step: 6 },
  { id: "deploy", label: "Deploy", icon: Rocket, desc: "Export as Solidity, JSON, or docs", step: 7 },
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

const SESSION_KEY = "advanced_invariant";

function loadInvariant(): SavedInvariant | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const AdvancedMode = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("invariant");
  const [hovered, setHovered] = useState(false);
  const [savedInvariant, setSavedInvariant] = useState<SavedInvariant | null>(loadInvariant);

  const handleSaveInvariant = useCallback((inv: SavedInvariant) => {
    setSavedInvariant(inv);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(inv));
  }, []);

  const hasInvariant = savedInvariant !== null;

  // If user tries to navigate to a non-invariant tab without saving, redirect
  const handleTabClick = (id: TabId) => {
    if (id !== "invariant" && !hasInvariant) return;
    setActiveTab(id);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">ADVANCED MODE</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground">PRO</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Active invariant badge */}
          {savedInvariant && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-secondary border border-border">
              <span className="text-[9px] text-muted-foreground">Active:</span>
              <span className="text-[10px] font-mono text-foreground">{savedInvariant.expression}</span>
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar Navigation — collapsed, expand on hover, fixed */}
        <aside
          className={`border-r border-border shrink-0 transition-all duration-200 flex flex-col sticky top-0 h-screen ${hovered ? "w-56" : "w-14"}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <nav className="flex-1 py-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isLocked = tab.id !== "invariant" && !hasInvariant;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  disabled={isLocked}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isActive ? "bg-foreground/5 text-foreground border-r-2 border-foreground" :
                    isLocked ? "text-muted-foreground/30 cursor-not-allowed" :
                    "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                  title={!hovered ? tab.label : undefined}
                >
                  <div className="relative shrink-0">
                    <Icon className="w-4 h-4" />
                    {isLocked && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-muted-foreground/30" />
                    )}
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
          {/* Step indicator when collapsed */}
          {!hovered && !hasInvariant && (
            <div className="px-2 py-3 border-t border-border">
              <div className="flex items-center justify-center">
                <AlertTriangle className="w-3 h-3 text-warning" />
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 max-w-7xl">
          {/* Prompt to design invariant first */}
          {!hasInvariant && activeTab === "invariant" && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <p className="text-xs text-foreground">
                <strong>Step 1:</strong> Design your invariant below, then click <strong>"Set as Active Invariant"</strong> to unlock the other tools.
              </p>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {activeTab === "invariant" && <InvariantEditor onSaveInvariant={handleSaveInvariant} savedInvariant={savedInvariant} />}
              {activeTab === "fees" && <FeeStructureEditor />}
              {activeTab === "montecarlo" && <MonteCarloEngine />}
              {activeTab === "arbitrage" && <ArbitrageEngine />}
              {activeTab === "liquidity" && <LiquidityAnalyzer />}
              {activeTab === "stability" && <StabilityAnalysis />}
              {activeTab === "deploy" && <DeploymentExport />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default AdvancedMode;
