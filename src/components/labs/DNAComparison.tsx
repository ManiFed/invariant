import { useState } from "react";
import { motion } from "framer-motion";
import { type Candidate, NUM_BINS } from "@/lib/discovery-engine";
import DNAFingerprint from "./DNAFingerprint";
import { Badge } from "@/components/ui/badge";

function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

const METRIC_KEYS = [
  { key: "totalFees", label: "Fees", higher: true },
  { key: "totalSlippage", label: "Slippage", higher: false },
  { key: "arbLeakage", label: "Arb Leak", higher: false },
  { key: "liquidityUtilization", label: "Utilization", higher: true },
  { key: "lpValueVsHodl", label: "LP/HODL", higher: true },
  { key: "maxDrawdown", label: "Drawdown", higher: false },
  { key: "volatilityOfReturns", label: "Vol. Returns", higher: false },
] as const;

interface Props {
  candidates: Candidate[];
  allCandidates: Candidate[];
  onSelect: (id: string) => void;
}

export default function DNAComparison({ candidates, allCandidates, onSelect }: Props) {
  const [selectedPair, setSelectedPair] = useState<[number, number]>([0, Math.min(1, candidates.length - 1)]);

  const a = candidates[selectedPair[0]];
  const b = candidates[selectedPair[1]];

  if (!a || !b) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select at least 2 candidates from the archive to compare DNA
      </div>
    );
  }

  const similarity = cosineSimilarity(a.bins, b.bins);

  // Compute difference bins for overlay
  const diffBins: number[] = [];
  const maxBinA = Math.max(...Array.from(a.bins));
  const maxBinB = Math.max(...Array.from(b.bins));
  for (let i = 0; i < NUM_BINS; i++) {
    const normA = maxBinA > 0 ? a.bins[i] / maxBinA : 0;
    const normB = maxBinB > 0 ? b.bins[i] / maxBinB : 0;
    diffBins.push(normA - normB);
  }

  return (
    <div className="space-y-6">
      {/* Candidate selector pills */}
      <div className="flex flex-wrap gap-2">
        {candidates.slice(0, 12).map((c, i) => (
          <button
            key={c.id}
            onClick={() => {
              if (selectedPair[0] === i) return;
              if (selectedPair[1] === i) return;
              setSelectedPair(prev => [prev[1], i]);
            }}
            className={`px-2 py-1 rounded text-[10px] font-mono-data border transition-colors ${
              selectedPair.includes(i)
                ? "border-foreground/30 bg-accent text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/20"
            }`}
          >
            Gen {c.generation} · {c.familyId.slice(0, 8)}
          </button>
        ))}
      </div>

      {/* Side-by-side fingerprints */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="flex flex-col items-center gap-2">
          <Badge variant="outline" className="text-[10px]">Candidate A</Badge>
          <DNAFingerprint candidate={a} size={220} />
          <span className="text-[10px] font-mono-data text-muted-foreground">{a.id.slice(0, 12)}</span>
        </div>

        {/* Difference overlay */}
        <div className="flex flex-col items-center gap-3">
          <Badge variant="outline" className="text-[10px]">Divergence Map</Badge>
          <svg width={220} height={220} viewBox="0 0 220 220" className="drop-shadow-md">
            <circle cx={110} cy={110} r={90} fill="none" stroke="hsl(var(--border))" strokeWidth={0.5} opacity={0.3} />
            {diffBins.map((diff, i) => {
              const angle = (i / NUM_BINS) * Math.PI * 2 - Math.PI / 2;
              const nextAngle = ((i + 1) / NUM_BINS) * Math.PI * 2 - Math.PI / 2;
              const r = 50 + Math.abs(diff) * 40;
              const x1 = 110 + 50 * Math.cos(angle);
              const y1 = 110 + 50 * Math.sin(angle);
              const x2 = 110 + r * Math.cos(angle);
              const y2 = 110 + r * Math.sin(angle);
              const x3 = 110 + r * Math.cos(nextAngle);
              const y3 = 110 + r * Math.sin(nextAngle);
              const x4 = 110 + 50 * Math.cos(nextAngle);
              const y4 = 110 + 50 * Math.sin(nextAngle);

              const color = diff > 0 ? "hsl(var(--destructive))" : "hsl(172, 66%, 50%)";

              return (
                <motion.path
                  key={i}
                  d={`M ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A 50 50 0 0 0 ${x1} ${y1} Z`}
                  fill={color}
                  opacity={0.15 + Math.abs(diff) * 0.6}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.15 + Math.abs(diff) * 0.6 }}
                  transition={{ delay: i * 0.005 }}
                />
              );
            })}
            <text x={110} y={106} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={22} fontWeight={700}>
              {(similarity * 100).toFixed(0)}%
            </text>
            <text x={110} y={122} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={9}>
              similarity
            </text>
          </svg>
          <div className="flex gap-4 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-destructive opacity-60" />
              <span>More in A</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: "hsl(172, 66%, 50%)" }} />
              <span>More in B</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Badge variant="outline" className="text-[10px]">Candidate B</Badge>
          <DNAFingerprint candidate={b} size={220} />
          <span className="text-[10px] font-mono-data text-muted-foreground">{b.id.slice(0, 12)}</span>
        </div>
      </div>

      {/* Metric comparison bars */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-foreground">Metric Comparison</h3>
        <div className="grid gap-1.5">
          {METRIC_KEYS.map(({ key, label, higher }) => {
            const valA = (a.metrics as any)[key] as number;
            const valB = (b.metrics as any)[key] as number;
            const maxVal = Math.max(Math.abs(valA), Math.abs(valB), 0.001);
            const barA = Math.abs(valA) / maxVal;
            const barB = Math.abs(valB) / maxVal;
            const aWins = higher ? valA > valB : valA < valB;

            return (
              <div key={key} className="grid grid-cols-[1fr_80px_1fr] gap-2 items-center">
                <div className="flex justify-end">
                  <motion.div
                    className="h-4 rounded-l-sm"
                    style={{
                      width: `${barA * 100}%`,
                      background: aWins ? "hsl(var(--success))" : "hsl(var(--muted-foreground))",
                      opacity: aWins ? 0.7 : 0.25,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${barA * 100}%` }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  />
                </div>
                <div className="text-center text-[10px] font-mono-data text-muted-foreground truncate">{label}</div>
                <div className="flex justify-start">
                  <motion.div
                    className="h-4 rounded-r-sm"
                    style={{
                      width: `${barB * 100}%`,
                      background: !aWins ? "hsl(var(--success))" : "hsl(var(--muted-foreground))",
                      opacity: !aWins ? 0.7 : 0.25,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${barB * 100}%` }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
