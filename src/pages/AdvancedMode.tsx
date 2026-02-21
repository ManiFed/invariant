import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FlaskConical, Code2, Cpu, Search, BarChart3, Shield } from "lucide-react";
import InvariantEditor from "@/components/advanced/InvariantEditor";
import MonteCarloEngine from "@/components/advanced/MonteCarloEngine";
import ArbitrageEngine from "@/components/advanced/ArbitrageEngine";
import LiquidityAnalyzer from "@/components/advanced/LiquidityAnalyzer";
import StabilityAnalysis from "@/components/advanced/StabilityAnalysis";

const tabs = [
  { id: "invariant", label: "Invariant Editor", icon: Code2 },
  { id: "montecarlo", label: "Monte Carlo", icon: Cpu },
  { id: "arbitrage", label: "Arbitrage", icon: Search },
  { id: "liquidity", label: "Liquidity", icon: BarChart3 },
  { id: "stability", label: "Stability", icon: Shield },
] as const;

type TabId = typeof tabs[number]["id"];

const AdvancedMode = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("invariant");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-6 h-6 rounded bg-chart-purple/20 flex items-center justify-center">
            <FlaskConical className="w-3.5 h-3.5 text-chart-purple" />
          </div>
          <span className="text-sm font-semibold text-foreground">Advanced Mode</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-chart-purple/10 text-chart-purple border border-chart-purple/20">PRO</span>
        </div>
      </header>

      {/* Tab nav */}
      <div className="border-b border-border px-6">
        <nav className="flex gap-1 -mb-px">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-chart-purple"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-chart-purple"
                    layoutId="advancedTab"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <main className="p-6 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "invariant" && <InvariantEditor />}
            {activeTab === "montecarlo" && <MonteCarloEngine />}
            {activeTab === "arbitrage" && <ArbitrageEngine />}
            {activeTab === "liquidity" && <LiquidityAnalyzer />}
            {activeTab === "stability" && <StabilityAnalysis />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AdvancedMode;
