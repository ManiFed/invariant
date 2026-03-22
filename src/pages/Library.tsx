import { useState, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Star, Users, Award, X, Download, Search, ThumbsUp, Code, GitFork, Trophy, BarChart3 } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, AreaChart, Area } from "recharts";
import ThemeToggle from "@/components/ThemeToggle";
import { useChartColors } from "@/hooks/use-chart-theme";
import { loadLibraryAMMs, upvoteLibraryAMM, type LibraryAMM } from "@/lib/library-persistence";
import AutoDiscoveryStatus from "@/components/library/AutoDiscoveryStatus";
import { NUM_BINS, binPrice } from "@/lib/discovery-engine";
import SolidityExportModal from "@/components/library/SolidityExportModal";
import HistoricalBacktest from "@/components/library/HistoricalBacktest";

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

function evalCurveForCard(amm: AMMEntry): { x: number; y: number }[] {
  const data: { x: number; y: number }[] = [];
  const { wA, wB, k, amp } = amm.params;

  for (let i = 1; i <= 40; i++) {
    const x = i * 5;
    try {
      let y: number;
      if (amm.id === "curve-stableswap") {
        const A = amp || 100;
        y = (k - x) * A / (A + 1) + k / (A * x + k / A);
        y = Math.max(0.1, y);
      } else if (amm.id === "solidly-ve33") {
        const target = k * 100;
        y = Math.sqrt(target / x);
        for (let iter = 0; iter < 10; iter++) {
          const f = x * x * x * y + x * y * y * y - target;
          const fp = x * x * x + 3 * x * y * y;
          if (Math.abs(fp) < 1e-10) break;
          y = y - f / fp;
          if (y <= 0) { y = 0.1; break; }
        }
      } else if (amm.id === "cubic-mean") {
        const rem = k * 1000 - x * x * x;
        y = rem > 0 ? Math.pow(rem, 1 / 3) : 0;
      } else if (amm.id === "uniswap-v3") {
        const sqrtPa = Math.sqrt(50);
        const L2 = k / 10;
        const sqrtX = Math.sqrt(x);
        if (sqrtX <= sqrtPa) continue;
        const sqrtY = L2 / (sqrtX - sqrtPa) + Math.sqrt(200);
        y = sqrtY * sqrtY;
      } else if (amm.id === "cpmm-sqrt") {
        y = k / x;
      } else {
        y = Math.pow(k / Math.pow(x, wA), 1 / wB);
      }

      if (y > 0 && y < k * 100 && isFinite(y) && !isNaN(y)) {
        data.push({ x, y: parseFloat(y.toFixed(2)) });
      }
    } catch { /* skip */ }
  }
  return data;
}

// ─── Leaderboard helpers ──────────────────────────────────────────────────
const REGIME_ORDER = ["low-vol", "high-vol", "jump-diffusion", "regime-shift"];
const RANK_STYLES = ["text-yellow-500", "text-zinc-400", "text-amber-700"];

function groupByRegime(amms: LibraryAMM[]): Record<string, LibraryAMM[]> {
  const groups: Record<string, LibraryAMM[]> = {};
  for (const amm of amms) {
    const r = amm.regime || "unknown";
    if (!groups[r]) groups[r] = [];
    groups[r].push(amm);
  }
  // Sort each group by score ascending (lower = better)
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity));
  }
  return groups;
}

// ─── Fork to Atlas ────────────────────────────────────────────────────────
function forkToAtlas(amm: LibraryAMM, navigate: ReturnType<typeof useNavigate>) {
  const seed = {
    bins: amm.bins,
    familyId: amm.family_id || "piecewise-bands",
    familyParams: amm.family_params || {},
    regime: amm.regime || "low-vol",
    name: amm.name,
  };
  localStorage.setItem("atlas-fork-seed", JSON.stringify(seed));
  navigate("/labs/discovery");
}

type PoolType = "constant_product" | "stable_swap" | "weighted" | "concentrated";

function ammToPoolType(ammId: string): PoolType {
  if (ammId === "curve-stableswap") return "stable_swap";
  if (ammId === "balancer-weighted") return "weighted";
  if (ammId === "uniswap-v3") return "concentrated";
  return "constant_product";
}

function sendToCompare(amm: AMMEntry, navigate: ReturnType<typeof useNavigate>) {
  const seed = [{ name: amm.name, type: ammToPoolType(amm.id), liquidity: 100000, feeRate: amm.params.k ? 0.003 : 0.003 }];
  localStorage.setItem("pool-comparison-seed", JSON.stringify(seed));
  navigate("/compare");
}

function forkFamousToAtlas(amm: AMMEntry, navigate: ReturnType<typeof useNavigate>) {
  // Famous AMMs don't have bins — use a default piecewise-bands approximation
  const seed = {
    bins: null, // engine will generate from familyId
    familyId: "piecewise-bands",
    familyParams: { centerMass: 0.5, shoulder: 0.15, skew: 0 },
    regime: "low-vol",
    name: amm.name,
  };
  localStorage.setItem("atlas-fork-seed", JSON.stringify(seed));
  navigate("/labs/discovery");
}

const Library = () => {
  const navigate = useNavigate();
  const colors = useChartColors();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [communityAMMs, setCommunityAMMs] = useState<AMMEntry[]>([]);
  const [dbAMMs, setDbAMMs] = useState<LibraryAMM[]>([]);
  const [selectedAMM, setSelectedAMM] = useState<AMMEntry | null>(null);
  const [selectedDbAMM, setSelectedDbAMM] = useState<LibraryAMM | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "famous" | "featured" | "community" | "leaderboard">("all");
  const [solidityTarget, setSolidityTarget] = useState<{ name: string; familyId?: string; familyParams?: Record<string, number>; bins?: number[]; score?: number; regime?: string; author?: string } | null>(null);
  const [showBacktest, setShowBacktest] = useState(false);

  useEffect(() => {
    loadLibraryAMMs().then(setDbAMMs);
  }, []);

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
        setActiveFilter("community");
      } catch {
        alert("Invalid JSON file. Please upload a valid AMM configuration.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const dbAsEntries: AMMEntry[] = useMemo(() =>
    dbAMMs.map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      formula: d.formula,
      category: "community" as const,
      author: d.author,
      params: d.params,
    })),
    [dbAMMs]
  );

  const allCommunity = useMemo(() => [...communityAMMs, ...dbAsEntries], [communityAMMs, dbAsEntries]);

  const allAMMs = useMemo(() => {
    if (activeFilter === "leaderboard") return []; // leaderboard has its own rendering
    const all = [...FAMOUS_AMMS, ...FEATURED_AMMS, ...allCommunity];
    const filtered = activeFilter === "all" ? all : all.filter(a => a.category === activeFilter);
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter(a => a.name.toLowerCase().includes(q) || a.formula.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
  }, [activeFilter, allCommunity, searchQuery]);

  const leaderboardData = useMemo(() => {
    if (activeFilter !== "leaderboard") return {};
    return groupByRegime(dbAMMs.filter(d => d.score != null));
  }, [activeFilter, dbAMMs]);

  const communityCount = allCommunity.length;

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
          <button onClick={() => navigate("/compare")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors border border-border">
            <BarChart3 className="w-3 h-3" /> Compare Pools
          </button>
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
          <div className="flex gap-1 flex-wrap">
            {([
              { id: "all" as const, label: "All", icon: Star },
              { id: "famous" as const, label: "Famous", icon: Star },
              { id: "featured" as const, label: "Featured", icon: Award },
              { id: "community" as const, label: "Community", icon: Users },
              { id: "leaderboard" as const, label: "Leaderboard", icon: Trophy },
            ]).map(t => (
              <button key={t.id} onClick={() => { setActiveFilter(t.id); setSearchQuery(""); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeFilter === t.id ? "bg-foreground/5 text-foreground border border-foreground/20" : "text-muted-foreground hover:text-foreground border border-transparent"
                }`}>
                <t.icon className="w-3 h-3" /> {t.label}
                {t.id === "community" && communityCount > 0 && (
                  <span className="text-[9px] font-mono bg-primary/10 text-primary px-1 rounded">{communityCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-Discovery Status */}
        <div className="mb-6">
          <AutoDiscoveryStatus />
        </div>

        {/* Leaderboard View */}
        {activeFilter === "leaderboard" && (
          <div className="space-y-6">
            {Object.keys(leaderboardData).length === 0 ? (
              <div className="text-center py-16">
                <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No scored designs yet. Publish designs from the Discovery Atlas to see them ranked here.</p>
              </div>
            ) : (
              REGIME_ORDER.filter(r => leaderboardData[r]?.length > 0).map(regime => (
                <div key={regime}>
                  <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    {regime}
                    <span className="text-muted-foreground font-normal">({leaderboardData[regime].length} designs)</span>
                  </h2>
                  <div className="border border-border rounded-xl overflow-hidden">
                    {leaderboardData[regime].map((amm, idx) => (
                      <motion.div
                        key={amm.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors ${idx > 0 ? "border-t border-border" : ""}`}
                        onClick={() => setSelectedDbAMM(amm)}
                      >
                        <div className="w-8 text-center">
                          {idx < 3 ? (
                            <span className={`text-lg font-black ${RANK_STYLES[idx]}`}>#{idx + 1}</span>
                          ) : (
                            <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{amm.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{amm.family_id || "unknown"} · by {amm.author}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono font-bold text-foreground">{amm.score?.toFixed(4)}</p>
                          <p className="text-[9px] text-muted-foreground">score</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-mono text-foreground">{amm.stability?.toFixed(4)}</p>
                          <p className="text-[9px] text-muted-foreground">stability</p>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <ThumbsUp className="w-3 h-3" />
                          <span className="text-[10px] font-mono">{amm.upvotes}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* AMM Grid */}
        {activeFilter !== "leaderboard" && (
          allAMMs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-muted-foreground mb-2">
                {activeFilter === "community" ? "No community AMMs yet." : "No results found."}
              </p>
              {activeFilter === "community" && (
                <button onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-primary hover:underline">Upload your first AMM →</button>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allAMMs.map((amm, i) => (
                <AMM_Card key={amm.id} amm={amm} colors={colors} index={i} onClick={() => {
                  const dbMatch = dbAMMs.find(d => d.id === amm.id);
                  if (dbMatch) {
                    setSelectedDbAMM(dbMatch);
                  } else {
                    setSelectedAMM(amm);
                  }
                }} />
              ))}
            </div>
          )
        )}
      </div>

      {/* Famous/Featured Detail Modal */}
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
                    <LineChart data={evalCurveForCard(selectedAMM)} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <XAxis dataKey="x" tick={{ fontSize: 9, fill: colors.tick }} />
                      <YAxis tick={{ fontSize: 9, fill: colors.tick }} />
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

                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => handleDownload(selectedAMM)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors border border-border">
                    <Download className="w-3 h-3" /> JSON
                  </button>
                  <button onClick={() => setSolidityTarget({ name: selectedAMM.name, author: selectedAMM.author })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors border border-border">
                    <Code className="w-3 h-3" /> Solidity
                  </button>
                  <button onClick={() => forkFamousToAtlas(selectedAMM, navigate)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors border border-border">
                    <GitFork className="w-3 h-3" /> Fork
                  </button>
                  <button onClick={() => sendToCompare(selectedAMM, navigate)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors border border-border">
                    <BarChart3 className="w-3 h-3" /> Compare
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

      {/* DB AMM Detail Modal (discovered designs) */}
      <AnimatePresence>
        {selectedDbAMM && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => { setSelectedDbAMM(null); setShowBacktest(false); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background border border-border rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{selectedDbAMM.name}</h2>
                    <p className="text-xs text-muted-foreground">by {selectedDbAMM.author}</p>
                  </div>
                  <button onClick={() => { setSelectedDbAMM(null); setShowBacktest(false); }} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Liquidity distribution from bins */}
                {selectedDbAMM.bins && (selectedDbAMM.bins as number[]).length > 0 && (
                  <div className="h-48 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={(selectedDbAMM.bins as number[]).map((w: number, i: number) => ({ price: parseFloat(binPrice(i).toFixed(3)), weight: w }))} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                        <XAxis dataKey="price" tick={{ fontSize: 9, fill: colors.tick }} />
                        <YAxis tick={{ fontSize: 9, fill: colors.tick }} />
                        <Area type="monotone" dataKey="weight" stroke={colors.line} fill={colors.line} fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{selectedDbAMM.description}</p>

                {/* Discovery metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {selectedDbAMM.score != null && (
                    <div className="p-2 rounded-lg bg-secondary border border-border text-center">
                      <p className="text-[9px] text-muted-foreground mb-0.5">Score</p>
                      <p className="text-xs font-mono font-semibold text-foreground">{selectedDbAMM.score.toFixed(3)}</p>
                    </div>
                  )}
                  {selectedDbAMM.stability != null && (
                    <div className="p-2 rounded-lg bg-secondary border border-border text-center">
                      <p className="text-[9px] text-muted-foreground mb-0.5">Stability</p>
                      <p className="text-xs font-mono font-semibold text-foreground">{selectedDbAMM.stability.toFixed(4)}</p>
                    </div>
                  )}
                  {selectedDbAMM.regime && (
                    <div className="p-2 rounded-lg bg-secondary border border-border text-center">
                      <p className="text-[9px] text-muted-foreground mb-0.5">Regime</p>
                      <p className="text-xs font-mono font-semibold text-foreground">{selectedDbAMM.regime}</p>
                    </div>
                  )}
                  {selectedDbAMM.generation != null && (
                    <div className="p-2 rounded-lg bg-secondary border border-border text-center">
                      <p className="text-[9px] text-muted-foreground mb-0.5">Generation</p>
                      <p className="text-xs font-mono font-semibold text-foreground">{selectedDbAMM.generation}</p>
                    </div>
                  )}
                </div>

                {/* Detailed metrics */}
                {selectedDbAMM.metrics && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {Object.entries(selectedDbAMM.metrics as Record<string, number>).map(([key, val]) => (
                      <div key={key} className="p-2 rounded-lg bg-secondary border border-border text-center">
                        <p className="text-[8px] text-muted-foreground mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                        <p className="text-[10px] font-mono font-semibold text-foreground">{typeof val === 'number' ? val.toFixed(4) : String(val)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap mb-4">
                  <button
                    onClick={async () => {
                      const ok = await upvoteLibraryAMM(selectedDbAMM.id);
                      if (ok) {
                        setDbAMMs(prev => prev.map(d => d.id === selectedDbAMM.id ? { ...d, upvotes: d.upvotes + 1 } : d));
                        setSelectedDbAMM(prev => prev ? { ...prev, upvotes: prev.upvotes + 1 } : prev);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors border border-border"
                  >
                    <ThumbsUp className="w-3 h-3" /> {selectedDbAMM.upvotes}
                  </button>
                  <button onClick={() => {
                    const json = JSON.stringify({
                      name: selectedDbAMM.name, description: selectedDbAMM.description,
                      author: selectedDbAMM.author, regime: selectedDbAMM.regime,
                      family_id: selectedDbAMM.family_id, family_params: selectedDbAMM.family_params,
                      bins: selectedDbAMM.bins, score: selectedDbAMM.score,
                      stability: selectedDbAMM.stability, metrics: selectedDbAMM.metrics,
                      features: selectedDbAMM.features,
                    }, null, 2);
                    const blob = new Blob([json], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = `${selectedDbAMM.name}.json`; a.click();
                    URL.revokeObjectURL(url);
                  }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors border border-border">
                    <Download className="w-3 h-3" /> JSON
                  </button>
                  <button onClick={() => setSolidityTarget({
                    name: selectedDbAMM.name,
                    familyId: selectedDbAMM.family_id || undefined,
                    familyParams: selectedDbAMM.family_params as Record<string, number> | undefined,
                    bins: selectedDbAMM.bins as number[] | undefined,
                    score: selectedDbAMM.score ?? undefined,
                    regime: selectedDbAMM.regime ?? undefined,
                    author: selectedDbAMM.author,
                  })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors border border-border">
                    <Code className="w-3 h-3" /> Solidity
                  </button>
                  <button onClick={() => forkToAtlas(selectedDbAMM, navigate)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors border border-border">
                    <GitFork className="w-3 h-3" /> Fork to Atlas
                  </button>
                  <button onClick={() => setShowBacktest(!showBacktest)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors border ${
                      showBacktest ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border hover:bg-accent"
                    }`}>
                    <BarChart3 className="w-3 h-3" /> Backtest
                  </button>
                </div>

                {/* Historical Backtest expandable */}
                {showBacktest && selectedDbAMM.bins && (
                  <div className="mb-2">
                    <HistoricalBacktest bins={selectedDbAMM.bins as number[]} name={selectedDbAMM.name} />
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Solidity Export Modal */}
      <AnimatePresence>
        {solidityTarget && (
          <SolidityExportModal
            open={!!solidityTarget}
            onClose={() => setSolidityTarget(null)}
            {...solidityTarget}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const AMM_Card = ({ amm, colors, index, onClick }: { amm: AMMEntry; colors: ReturnType<typeof useChartColors>; index: number; onClick: () => void }) => {
  const curveData = useMemo(() => evalCurveForCard(amm), [amm]);
  const categoryColors = { famous: "text-warning", featured: "text-primary", community: "text-success" };
  const categoryIcons = { famous: Star, featured: Award, community: Users };
  const Icon = categoryIcons[amm.category];

  return (
    <motion.div
      className="rounded-xl p-4 cursor-pointer group hover:border-foreground/20 transition-all bg-card border border-border"
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
        {curveData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curveData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Line type="monotone" dataKey="y" stroke={colors.line} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground">
            Complex curve — click to view
          </div>
        )}
      </div>
      <p className="text-[10px] font-mono text-muted-foreground mb-1.5">{amm.formula}</p>
      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{amm.description}</p>
      {amm.author && <p className="text-[9px] text-muted-foreground/60 mt-1.5">by {amm.author}</p>}
    </motion.div>
  );
};

export default Library;
