import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Code2, Cpu, Search, BarChart3, Shield, Rocket, ChevronLeft, ChevronRight } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import InvariantEditor from "@/components/advanced/InvariantEditor";
import MonteCarloEngine from "@/components/advanced/MonteCarloEngine";
import ArbitrageEngine from "@/components/advanced/ArbitrageEngine";
import LiquidityAnalyzer from "@/components/advanced/LiquidityAnalyzer";
import StabilityAnalysis from "@/components/advanced/StabilityAnalysis";
import DeploymentExport from "@/components/advanced/DeploymentExport";

const tabs = [
  { id: "invariant", label: "Invariant Editor", icon: Code2, desc: "Write and visualize custom AMM formulas" },
  { id: "montecarlo", label: "Monte Carlo", icon: Cpu, desc: "Stress-test with thousands of simulated price paths" },
  { id: "arbitrage", label: "Arbitrage", icon: Search, desc: "Model toxic flow and MEV extraction" },
  { id: "liquidity", label: "Liquidity", icon: BarChart3, desc: "Compare depth, efficiency, and slippage across models" },
  { id: "stability", label: "Stability", icon: Shield, desc: "Run diagnostic checks for edge cases" },
  { id: "deploy", label: "Deploy", icon: Rocket, desc: "Export your invariant as Solidity, JSON, or docs" },
] as const;

type TabId = typeof tabs[number]["id"];

const AdvancedMode = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("invariant");
  const [collapsed, setCollapsed] = useState(false);

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
        <ThemeToggle />
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar Navigation */}
        <aside className={`border-r border-border shrink-0 transition-all duration-200 flex flex-col ${collapsed ? "w-14" : "w-56"}`}>
          <nav className="flex-1 py-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isActive ? "bg-foreground/5 text-foreground border-r-2 border-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                  title={collapsed ? tab.label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && (
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{tab.label}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{tab.desc}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
          <button onClick={() => setCollapsed(c => !c)}
            className="p-3 border-t border-border text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center">
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 max-w-7xl">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {activeTab === "invariant" && <InvariantEditor />}
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
