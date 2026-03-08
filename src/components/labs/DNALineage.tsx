import { useMemo } from "react";
import { motion } from "framer-motion";
import { type Candidate, NUM_BINS, INVARIANT_FAMILIES } from "@/lib/discovery-engine";

interface Props {
  archive: Candidate[];
  onSelect: (id: string) => void;
  selectedId?: string;
}

interface LineageChain {
  familyId: string;
  regime: string;
  candidates: Candidate[];
}

function miniGenomePath(bins: Float64Array, cx: number, cy: number, r: number): string {
  const maxBin = Math.max(...Array.from(bins));
  if (maxBin === 0) return "";
  const points: string[] = [];
  for (let i = 0; i < NUM_BINS; i++) {
    const angle = (i / NUM_BINS) * Math.PI * 2 - Math.PI / 2;
    const norm = bins[i] / maxBin;
    const pr = r * 0.4 + r * 0.6 * norm;
    points.push(`${i === 0 ? "M" : "L"} ${cx + pr * Math.cos(angle)} ${cy + pr * Math.sin(angle)}`);
  }
  return points.join(" ") + " Z";
}

const FAMILY_HUE: Record<string, string> = {
  "piecewise-bands": "hsl(172, 66%, 50%)",
  "amplified-hybrid": "hsl(270, 60%, 55%)",
  "tail-shielded": "hsl(28, 80%, 55%)",
  "custom": "hsl(210, 50%, 55%)",
};

export default function DNALineage({ archive, onSelect, selectedId }: Props) {
  const chains = useMemo(() => {
    const groups = new Map<string, Candidate[]>();
    for (const c of archive) {
      const key = `${c.familyId}|${c.regime}`;
      const list = groups.get(key) ?? [];
      list.push(c);
      groups.set(key, list);
    }

    const result: LineageChain[] = [];
    for (const [key, candidates] of groups.entries()) {
      if (candidates.length < 2) continue;
      const sorted = [...candidates].sort((a, b) => a.generation - b.generation);
      const [familyId, regime] = key.split("|");
      result.push({ familyId, regime, candidates: sorted.slice(0, 20) });
    }

    return result.sort((a, b) => b.candidates.length - a.candidates.length).slice(0, 8);
  }, [archive]);

  if (chains.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Need more archived candidates to build lineage trees. Let the engine run for a while.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {chains.map((chain, ci) => {
        const familyLabel = INVARIANT_FAMILIES.find(f => f.id === chain.familyId)?.label ?? chain.familyId;
        const color = FAMILY_HUE[chain.familyId] ?? FAMILY_HUE["custom"];

        return (
          <motion.div
            key={`${chain.familyId}-${chain.regime}`}
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ci * 0.1 }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-xs font-semibold text-foreground">{familyLabel}</span>
              <span className="text-[10px] font-mono-data text-muted-foreground">· {chain.regime}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{chain.candidates.length} generations</span>
            </div>

            <div className="relative flex items-center gap-1 overflow-x-auto pb-2">
              {/* Connecting line */}
              <div className="absolute top-1/2 left-4 right-4 h-px bg-border" />

              {chain.candidates.map((candidate, i) => {
                const prevScore = i > 0 ? chain.candidates[i - 1].score : candidate.score;
                const scoreDelta = candidate.score - prevScore;
                const isMutationJump = Math.abs(scoreDelta) > 0.02;
                const isSelected = candidate.id === selectedId;

                return (
                  <motion.div
                    key={candidate.id}
                    className={`relative flex flex-col items-center cursor-pointer group shrink-0 ${
                      isSelected ? "z-10" : ""
                    }`}
                    onClick={() => onSelect(candidate.id)}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: ci * 0.1 + i * 0.03 }}
                    whileHover={{ scale: 1.15 }}
                  >
                    {/* Mini genome */}
                    <svg width={40} height={40} viewBox="0 0 40 40" className="drop-shadow-sm">
                      {isMutationJump && (
                        <circle
                          cx={20} cy={20} r={18}
                          fill="none"
                          stroke={color}
                          strokeWidth={1.5}
                          opacity={0.5}
                          className="animate-pulse"
                        />
                      )}
                      <circle
                        cx={20} cy={20} r={16}
                        fill={isSelected ? color : "hsl(var(--card))"}
                        opacity={isSelected ? 0.2 : 1}
                        stroke={isSelected ? color : "hsl(var(--border))"}
                        strokeWidth={isSelected ? 1.5 : 0.5}
                      />
                      <path
                        d={miniGenomePath(candidate.bins, 20, 20, 15)}
                        fill={color}
                        opacity={0.5}
                        stroke={color}
                        strokeWidth={0.5}
                      />
                    </svg>

                    {/* Generation label */}
                    <span className="text-[8px] font-mono-data text-muted-foreground mt-0.5">
                      G{candidate.generation}
                    </span>

                    {/* Tooltip on hover */}
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                      <div className="bg-popover border border-border rounded px-2 py-1 shadow-lg whitespace-nowrap">
                        <div className="text-[9px] font-mono-data text-foreground">
                          Score: {candidate.score.toFixed(4)}
                        </div>
                        <div className="text-[9px] font-mono-data text-muted-foreground">
                          {scoreDelta !== 0 && (
                            <span className={scoreDelta < 0 ? "text-success" : "text-destructive"}>
                              Δ {scoreDelta > 0 ? "+" : ""}{scoreDelta.toFixed(4)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
