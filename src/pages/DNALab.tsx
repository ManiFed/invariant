import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Dna, Loader2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import DNAFingerprint from "@/components/labs/DNAFingerprint";
import DNAComparison from "@/components/labs/DNAComparison";
import DNALineage from "@/components/labs/DNALineage";
import type { Candidate, RegimeId, InvariantFamilyId, MetricVector, FeatureDescriptor } from "@/lib/discovery-engine";
import { NUM_BINS, TOTAL_LIQUIDITY } from "@/lib/discovery-engine";

function rowToCandidate(row: any): Candidate | null {
  try {
    const metrics: MetricVector = row.metrics
      ? (typeof row.metrics === "string" ? JSON.parse(row.metrics) : row.metrics)
      : { totalFees: 0, totalSlippage: 0, arbLeakage: 0, liquidityUtilization: 0, lpValueVsHodl: 1, maxDrawdown: 0, volatilityOfReturns: 0 };

    const features: FeatureDescriptor = row.features
      ? (typeof row.features === "string" ? JSON.parse(row.features) : row.features)
      : { curvature: 0, curvatureGradient: 0, entropy: 0, symmetry: 0, tailDensityRatio: 0, peakConcentration: 0, concentrationWidth: 0 };

    let bins: Float64Array;
    if (row.bins && Array.isArray(row.bins) && row.bins.length > 0) {
      bins = new Float64Array(row.bins);
    } else {
      bins = new Float64Array(NUM_BINS).fill(TOTAL_LIQUIDITY / NUM_BINS);
    }

    return {
      id: row.id,
      bins,
      familyId: (row.family_id || "piecewise-bands") as InvariantFamilyId,
      familyParams: row.family_params
        ? (typeof row.family_params === "string" ? JSON.parse(row.family_params) : row.family_params)
        : {},
      regime: (row.regime || "low-vol") as RegimeId,
      generation: row.generation ?? 0,
      metrics,
      features,
      stability: row.stability ?? 0,
      score: row.score ?? 0,
      timestamp: new Date(row.created_at).getTime(),
      source: "global",
      contributor: row.author || row.name,
    };
  } catch {
    return null;
  }
}

export default function DNALab() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("fingerprint");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("library_amms")
        .select("*")
        .order("score", { ascending: true })
        .limit(200);

      if (!error && data) {
        const parsed = data.map(rowToCandidate).filter(Boolean) as Candidate[];
        setCandidates(parsed);
        if (parsed.length > 0) setSelectedId(parsed[0].id);
      }
      setLoading(false);
    })();
  }, []);

  const selected = useMemo(
    () => candidates.find(c => c.id === selectedId) ?? candidates[0] ?? null,
    [candidates, selectedId],
  );

  const selectCandidate = (id: string) => setSelectedId(id);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/labs")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Dna className="w-4 h-4 text-chart-5" />
          <span className="text-sm font-bold text-foreground tracking-tight">DNA VISUALIZER</span>
          <span className="text-[10px] font-mono-data px-2 py-0.5 rounded border border-warning/30 text-warning">
            EXPERIMENTAL
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono-data text-muted-foreground">
            {candidates.length} library designs
          </span>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 border-r border-border overflow-y-auto shrink-0 bg-card">
          <div className="p-3 border-b border-border">
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Library</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCandidate(c.id)}
                  className={`w-full text-left px-3 py-2 transition-colors ${
                    selected?.id === c.id ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono-data text-foreground truncate">
                      {c.contributor || c.familyId.slice(0, 12)}
                    </span>
                    <span className="text-[9px] font-mono-data text-muted-foreground">
                      G{c.generation}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9px] text-muted-foreground">{c.regime}</span>
                    <span className="text-[9px] font-mono-data text-chart-5">{c.score.toFixed(4)}</span>
                  </div>
                </button>
              ))}
              {candidates.length === 0 && (
                <div className="p-4 text-center text-[11px] text-muted-foreground">
                  No designs in the library yet. Publish from the Discovery Atlas first.
                </div>
              )}
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="fingerprint">Fingerprint</TabsTrigger>
              <TabsTrigger value="compare">Compare</TabsTrigger>
              <TabsTrigger value="lineage">Lineage</TabsTrigger>
            </TabsList>

            <TabsContent value="fingerprint" className="mt-6">
              {selected ? (
                <motion.div
                  key={selected.id}
                  className="flex flex-col items-center gap-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <DNAFingerprint candidate={selected} size={320} />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl w-full">
                    {[
                      { label: "Fees", value: selected.metrics.totalFees.toFixed(4) },
                      { label: "Slippage", value: selected.metrics.totalSlippage.toFixed(4) },
                      { label: "Utilization", value: (selected.metrics.liquidityUtilization * 100).toFixed(1) + "%" },
                      { label: "LP/HODL", value: selected.metrics.lpValueVsHodl.toFixed(4) },
                      { label: "Arb Leak", value: selected.metrics.arbLeakage.toFixed(2) },
                      { label: "Drawdown", value: (selected.metrics.maxDrawdown * 100).toFixed(1) + "%" },
                      { label: "Stability", value: selected.stability.toFixed(4) },
                      { label: "Generation", value: String(selected.generation) },
                    ].map(({ label, value }) => (
                      <div key={label} className="surface-elevated rounded-lg px-3 py-2">
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
                        <div className="text-sm font-mono-data text-foreground font-semibold">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] font-mono-data text-muted-foreground">
                    {selected.id}
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  {loading ? "Loading…" : "Select a design from the sidebar"}
                </div>
              )}
            </TabsContent>

            <TabsContent value="compare" className="mt-6">
              <DNAComparison
                candidates={candidates.slice(0, 12)}
                allCandidates={candidates}
                onSelect={selectCandidate}
              />
            </TabsContent>

            <TabsContent value="lineage" className="mt-6">
              <DNALineage
                archive={candidates}
                onSelect={selectCandidate}
                selectedId={selected?.id}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
