import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Code2, Cpu, Search, BarChart3, Shield, Rocket, DollarSign, AlertTriangle, Upload, BookOpen, Boxes } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import MultiAssetInvariantEditor from "@/components/labs/MultiAssetInvariantEditor";
import MonteCarloEngine from "@/components/advanced/MonteCarloEngine";
import ArbitrageEngine from "@/components/advanced/ArbitrageEngine";
import LiquidityAnalyzer from "@/components/advanced/LiquidityAnalyzer";
import StabilityAnalysis from "@/components/advanced/StabilityAnalysis";
import DeploymentExport from "@/components/advanced/DeploymentExport";
import FeeStructureEditor from "@/components/advanced/FeeStructureEditor";
import { Asset, ASSET_COLORS, defaultAssets } from "@/components/labs/MultiAssetComponents";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const tabs = [
  { id: "invariant", label: "Invariant Editor", icon: Code2, desc: "Design your multi-asset AMM curve", step: 1 },
  { id: "fees", label: "Fee Structure", icon: DollarSign, desc: "Custom fee distribution per asset pair", step: 2 },
  { id: "montecarlo", label: "Monte Carlo", icon: Cpu, desc: "Multi-asset correlated simulations", step: 3 },
  { id: "arbitrage", label: "Arbitrage", icon: Search, desc: "Cross-pair toxic flow & MEV", step: 4 },
  { id: "liquidity", label: "Liquidity", icon: BarChart3, desc: "Multi-asset depth & efficiency", step: 5 },
  { id: "stability", label: "Stability", icon: Shield, desc: "Multi-asset edge case diagnostics", step: 6 },
  { id: "deploy", label: "Deploy", icon: Rocket, desc: "Export multi-token Solidity contract", step: 7 },
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

const SESSION_KEY = "multiasset_invariant";

function loadInvariant(): SavedInvariant | null {
  try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

const MultiAssetLab = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("invariant");
  const [hovered, setHovered] = useState(false);
  const [savedInvariant, setSavedInvariant] = useState<SavedInvariant | null>(loadInvariant);
  const [showImport, setShowImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<Asset[]>(defaultAssets);

  const handleSaveInvariant = useCallback((inv: SavedInvariant) => {
    setSavedInvariant(inv);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(inv));
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
        handleSaveInvariant(inv);
        setShowImport(false);
        setActiveTab("invariant");
      } catch { alert("Invalid JSON file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const addAsset = () => {
    if (assets.length >= 5) return;
    const idx = assets.length;
    setAssets(prev => [...prev, { id: String(Date.now()), symbol: `TKN${idx + 1}`, reserve: 1000, weight: 0.1, color: ASSET_COLORS[idx % ASSET_COLORS.length] }]);
  };

  const removeAsset = (id: string) => { setAssets(prev => prev.filter(a => a.id !== id)); };

  const applyWeights = (weights: number[]) => {
    setAssets(prev => prev.map((a, i) => ({ ...a, weight: parseFloat(weights[i].toFixed(4)) })));
  };

  const hasInvariant = savedInvariant !== null;

  const handleTabClick = (id: TabId) => {
    if (id !== "invariant" && !hasInvariant) return;
    setActiveTab(id);
  };

  const multiAssetExpr = assets.map(a => `${a.symbol}^${a.weight}`).join(" · ") + " = k";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/labs")} className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-4 h-4" /></button>
          <Boxes className="w-4 h-4 text-chart-1" />
          <span className="text-sm font-bold text-foreground tracking-tight">MULTI-ASSET LAB</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-warning/30 text-warning">EXPERIMENTAL</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors border border-border">
            <Upload className="w-3 h-3" /> Import AMM
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleJsonUpload} />
          <button
            onClick={() => setActiveTab("invariant")}
            className="flex items-center gap-2 px-3 py-1 rounded-lg bg-secondary border border-border hover:bg-accent transition-colors cursor-pointer"
          >
            <span className="text-[9px] text-muted-foreground">Active:</span>
            <span className="text-[10px] font-mono text-foreground truncate max-w-48">{savedInvariant ? savedInvariant.expression : multiAssetExpr}</span>
          </button>
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
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 max-w-7xl">
          {!hasInvariant && activeTab === "invariant" && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <p className="text-xs text-foreground"><strong>Step 1:</strong> Configure your assets and design your invariant below, then click <strong>"Set as Active Invariant"</strong> to unlock the other tools.</p>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {activeTab === "invariant" && (
                <MultiAssetInvariantEditor
                  assets={assets} onAssetsChange={setAssets} onAddAsset={addAsset}
                  onRemoveAsset={removeAsset} onApplyWeights={applyWeights}
                  onSaveInvariant={handleSaveInvariant} savedInvariant={savedInvariant}
                />
              )}
              {activeTab === "fees" && <FeeStructureEditor assets={assets} />}
              {activeTab === "montecarlo" && <MonteCarloEngine assets={assets} />}
              {activeTab === "arbitrage" && <ArbitrageEngine assets={assets} />}
              {activeTab === "liquidity" && <LiquidityAnalyzer assets={assets} />}
              {activeTab === "stability" && <StabilityAnalysis assets={assets} />}
              {activeTab === "deploy" && <DeploymentExport assets={assets} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default MultiAssetLab;
