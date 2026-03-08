import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Dna } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDiscoveryEngine } from "@/hooks/use-discovery-engine";
import DNAFingerprint from "@/components/labs/DNAFingerprint";
import DNAComparison from "@/components/labs/DNAComparison";
import DNALineage from "@/components/labs/DNALineage";
import type { Candidate } from "@/lib/discovery-engine";

export default function DNALab() {
  const navigate = useNavigate();
  const { state, selectedCandidate, selectCandidate, clearSelection } = useDiscoveryEngine();
  const [tab, setTab] = useState("fingerprint");

  const archive = state.archive;

  // Sort archive by score (best first)
  const sortedArchive = useMemo(
    () => [...archive].sort((a, b) => a.score - b.score),
    [archive],
  );

  const selected = selectedCandidate ?? sortedArchive[0] ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
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
            {archive.length} archived designs
          </span>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: candidate picker */}
        <aside className="w-56 border-r border-border overflow-y-auto shrink-0 bg-card">
          <div className="p-3 border-b border-border">
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Archive</h2>
          </div>
          <div className="divide-y divide-border">
            {sortedArchive.slice(0, 60).map((c) => (
              <button
                key={c.id}
                onClick={() => selectCandidate(c.id)}
                className={`w-full text-left px-3 py-2 transition-colors ${
                  selected?.id === c.id
                    ? "bg-accent"
                    : "hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono-data text-foreground truncate">
                    {c.familyId.slice(0, 10)}
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
            {sortedArchive.length === 0 && (
              <div className="p-4 text-center text-[11px] text-muted-foreground">
                No archived candidates yet. Start the discovery engine from the Atlas to populate.
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
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

                  {/* Metrics grid */}
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

                  {/* ID */}
                  <div className="text-[10px] font-mono-data text-muted-foreground">
                    {selected.id}
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  Select a candidate from the sidebar
                </div>
              )}
            </TabsContent>

            <TabsContent value="compare" className="mt-6">
              <DNAComparison
                candidates={sortedArchive.slice(0, 12)}
                allCandidates={sortedArchive}
                onSelect={selectCandidate}
              />
            </TabsContent>

            <TabsContent value="lineage" className="mt-6">
              <DNALineage
                archive={archive}
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
