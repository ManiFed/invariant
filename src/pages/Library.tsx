import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Star, Users, Award, X, Download, Search } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import ThemeToggle from "@/components/ThemeToggle";
import { useChartColors } from "@/hooks/use-chart-theme";

interface AMMEntry {
  id: string;
  name: string;
  description: string;
  formula: string;
  category: "famous" | "featured" | "community";
  author?: string;
  params: { wA: number; wB: number; k: number; amp?: number };
}

const FAMOUS_AMMS: AMMEntry[] = [
  { id: "uniswap-v2", name: "Uniswap V2", description: "The original constant product AMM that launched DeFi summer. Simple, battle-tested, and the baseline for all comparisons.", formula: "x * y = k", category: "famous", author: "Uniswap Labs", params: { wA: 0.5, wB: 0.5, k: 10000 } },
  { id: "curve-stableswap", name: "Curve StableSwap", description: "Hybrid invariant combining constant sum and constant product. Extremely low slippage for pegged assets like stablecoins.", formula: "An²Σxᵢ + D = ADn² + D^(n+1)/(n²Πxᵢ)", category: "famous", author: "Curve Finance", params: { wA: 0.5, wB: 0.5, k: 10000, amp: 100 } },
  { id: "balancer-weighted", name: "Balancer Weighted Pool", description: "Generalized constant product with configurable weights. Enables 80/20 pools that reduce IL for the majority token.", formula: "x^w₁ · y^w₂ = k", category: "famous", author: "Balancer Labs", params: { wA: 0.8, wB: 0.2, k: 10000 } },
  { id: "uniswap-v3", name: "Uniswap V3 Concentrated", description: "Range-bounded virtual reserves. Up to 4000x capital efficiency within active range, but zero fees outside.", formula: "(√x − √pₐ)(√y − √p_b) = L²", category: "famous", author: "Uniswap Labs", params: { wA: 0.5, wB: 0.5, k: 10000 } },
  { id: "solidly-ve33", name: "Solidly ve(3,3)", description: "Combines vote-escrowed tokenomics with AMM. Uses x³y + xy³ = k for correlated pairs.", formula: "x³y + xy³ = k", category: "famous", author: "Andre Cronje", params: { wA: 0.5, wB: 0.5, k: 10000 } },
  { id: "cpmm-sqrt", name: "Geometric Mean MM", description: "Uses the geometric mean of reserves. Equivalent to constant product but expressed differently.", formula: "√(x · y) = √k", category: "famous", author: "Academic", params: { wA: 0.5, wB: 0.5, k: 10000 } },
];

const FEATURED_AMMS: AMMEntry[] = [
  { id: "power-perp", name: "Power Perpetual Curve", description: "Experimental curve for perpetual-style payoffs. Asymmetric slippage favoring long positions.", formula: "x^0.3 · y^0.7 = k", category: "featured", author: "Research", params: { wA: 0.3, wB: 0.7, k: 10000 } },
  { id: "dynamic-fee", name: "Volatility-Adjusted", description: "Invariant with implied dynamic fee adjustment based on reserve imbalance.", formula: "x^0.6 · y^0.4 = k", category: "featured", author: "Community", params: { wA: 0.6, wB: 0.4, k: 10000 } },
  { id: "cubic-mean", name: "Cubic Mean AMM", description: "Uses cubic relationship for ultra-flat trading near center with steep edges.", formula: "x³ + y³ = k", category: "featured", author: "Experimental", params: { wA: 0.5, wB: 0.5, k: 10000 } },
];

function evalCurveForCard(params: AMMEntry["params"]): { x: number; y: number }[] {
  const data: { x: number; y: number }[] = [];
  const { wA, wB, k } = params;
  for (let i = 1; i <= 40; i++) {
    const x = i * 5;
    try {
      const y = Math.pow(k / Math.pow(x, wA), 1 / wB);
      if (y > 0 && y < k * 10 && isFinite(y)) data.push({ x, y: parseFloat(y.toFixed(2)) });
    } catch { /* skip */ }
  }
  return data;
}

const Library = () => {
  const navigate = useNavigate();
  const colors = useChartColors();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [communityAMMs, setCommunityAMMs] = useState<AMMEntry[]>([]);
  const [selectedAMM, setSelectedAMM] = useState<AMMEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"famous" | "featured" | "community">("famous");

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const entry: AMMEntry = {
          id: `community-${Date.now()}`,
          name: json.name || "Untitled AMM",
          description: json.description || "Community-uploaded AMM",
          formula: json.formula || json.expression || "x * y = k",
          category: "community",
          author: json.author || "You",
          params: {
            wA: json.params?.wA ?? json.weightA ?? 0.5,
            wB: json.params?.wB ?? json.weightB ?? 0.5,
            k: json.params?.k ?? json.kValue ?? 10000,
            amp: json.params?.amp ?? json.amplification,
          },
        };
        setCommunityAMMs(prev => [...prev, entry]);
        setActiveTab("community");
      } catch {
        alert("Invalid JSON file. Please upload a valid AMM configuration.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const allAMMs = useMemo(() => {
    const all = [...FAMOUS_AMMS, ...FEATURED_AMMS, ...communityAMMs];
    if (!searchQuery.trim()) return all.filter(a => a.category === activeTab);
    const q = searchQuery.toLowerCase();
    return all.filter(a => a.name.toLowerCase().includes(q) || a.formula.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
  }, [activeTab, communityAMMs, searchQuery]);

  const handleDownload = (amm: AMMEntry) => {
    const json = JSON.stringify({ name: amm.name, description: amm.description, formula: amm.formula, author: amm.author, params: amm.params }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${amm.id}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 bg-background z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">AMM LIBRARY</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
            <Upload className="w-3 h-3" /> Upload AMM
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleUpload} />
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Search + Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search AMMs..."
              className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="flex gap-1">
            {([
              { id: "famous" as const, label: "Famous", icon: Star },
              { id: "featured" as const, label: "Featured", icon: Award },
              { id: "community" as const, label: "Community", icon: Users },
            ]).map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab.id && !searchQuery ? "bg-foreground/5 text-foreground border border-foreground/20" : "text-muted-foreground hover:text-foreground border border-transparent"
                }`}>
                <tab.icon className="w-3 h-3" /> {tab.label}
                {tab.id === "community" && communityAMMs.length > 0 && (
                  <span className="text-[9px] font-mono bg-primary/10 text-primary px-1 rounded">{communityAMMs.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* AMM Grid */}
        {allAMMs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground mb-2">
              {activeTab === "community" ? "No community AMMs yet." : "No results found."}
            </p>
            {activeTab === "community" && (
              <button onClick={() => fileInputRef.current?.click()}
                className="text-xs text-primary hover:underline">Upload your first AMM →</button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allAMMs.map((amm, i) => (
              <AMM_Card key={amm.id} amm={amm} colors={colors} index={i} onClick={() => setSelectedAMM(amm)} />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAMM && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAMM(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background border border-border rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{selectedAMM.name}</h2>
                    {selectedAMM.author && <p className="text-xs text-muted-foreground">by {selectedAMM.author}</p>}
                  </div>
                  <button onClick={() => setSelectedAMM(null)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-secondary border border-border mb-4">
                  <p className="text-xs font-mono text-foreground text-center">{selectedAMM.formula}</p>
                </div>

                <div className="h-48 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evalCurveForCard(selectedAMM.params)}>
                      <Line type="monotone" dataKey="y" stroke={colors.line} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{selectedAMM.description}</p>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-secondary border border-border text-center">
                    <p className="text-[9px] text-muted-foreground mb-0.5">Weight A</p>
                    <p className="text-xs font-mono font-semibold text-foreground">{selectedAMM.params.wA}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary border border-border text-center">
                    <p className="text-[9px] text-muted-foreground mb-0.5">Weight B</p>
                    <p className="text-xs font-mono font-semibold text-foreground">{selectedAMM.params.wB}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary border border-border text-center">
                    <p className="text-[9px] text-muted-foreground mb-0.5">k</p>
                    <p className="text-xs font-mono font-semibold text-foreground">{selectedAMM.params.k.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => handleDownload(selectedAMM)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors border border-border">
                    <Download className="w-3 h-3" /> Download JSON
                  </button>
                  <button onClick={() => { navigate("/advanced"); }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
                    Open in Editor →
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AMM_Card = ({ amm, colors, index, onClick }: { amm: AMMEntry; colors: ReturnType<typeof useChartColors>; index: number; onClick: () => void }) => {
  const curveData = useMemo(() => evalCurveForCard(amm.params), [amm.params]);
  const categoryColors = { famous: "text-warning", featured: "text-primary", community: "text-success" };
  const categoryIcons = { famous: Star, featured: Award, community: Users };
  const Icon = categoryIcons[amm.category];

  return (
    <motion.div
      className="surface-elevated rounded-xl p-4 cursor-pointer group hover:border-foreground/20 transition-all"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">{amm.name}</h3>
        <Icon className={`w-3.5 h-3.5 ${categoryColors[amm.category]}`} />
      </div>
      <div className="h-24 mb-2 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curveData}>
            <Line type="monotone" dataKey="y" stroke={colors.line} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] font-mono text-muted-foreground mb-1.5">{amm.formula}</p>
      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{amm.description}</p>
      {amm.author && <p className="text-[9px] text-muted-foreground/60 mt-1.5">by {amm.author}</p>}
    </motion.div>
  );
};

export default Library;
