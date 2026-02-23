import { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Map as MapIcon, Layers, Eye, ZoomIn } from "lucide-react";
import type { EngineState, RegimeId, Candidate } from "@/lib/discovery-engine";
import { embedCandidates, computeCoverage } from "@/lib/discovery-engine";

const REGIME_COLORS: Record<RegimeId, string> = {
  "low-vol": "hsl(142, 72%, 45%)",
  "high-vol": "hsl(38, 92%, 50%)",
  "jump-diffusion": "hsl(0, 72%, 55%)",
};

const REGIME_LABELS: Record<RegimeId, string> = {
  "low-vol": "Low Vol",
  "high-vol": "High Vol",
  "jump-diffusion": "Jump Diff",
};

interface AtlasSurfaceProps {
  state: EngineState;
  onSelectCandidate: (id: string) => void;
}

const GRID_SIZE = 16;

export default function AtlasSurface({ state, onSelectCandidate }: AtlasSurfaceProps) {
  const [filterRegime, setFilterRegime] = useState<RegimeId | "all">("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filteredCandidates = useMemo(() => {
    if (filterRegime === "all") return state.archive;
    return state.archive.filter(c => c.regime === filterRegime);
  }, [state.archive, filterRegime]);

  const embedding = useMemo(() => {
    if (filteredCandidates.length === 0) return [];
    return embedCandidates(filteredCandidates);
  }, [filteredCandidates]);

  const coverage = useMemo(() => {
    if (state.archive.length === 0) return { coverage: 0, densityMap: [], totalCells: 0, occupiedCells: 0 };
    return computeCoverage(state.archive, GRID_SIZE);
  }, [state.archive]);

  // Create lookup: embeddingId → candidate
  const candidateMap = useMemo(() => {
    const lookup = new globalThis.Map<string, Candidate>();
    for (const c of filteredCandidates) lookup.set(c.id, c);
    return lookup;
  }, [filteredCandidates]);

  const hoveredCandidate = hoveredId ? candidateMap.get(hoveredId) ?? null : null;

  // Density heatmap colors
  const maxDensity = useMemo(() => {
    let max = 0;
    for (const row of coverage.densityMap) {
      for (const v of row) max = Math.max(max, v);
    }
    return max;
  }, [coverage.densityMap]);

  const handlePointClick = useCallback((id: string) => {
    onSelectCandidate(id);
  }, [onSelectCandidate]);

  // SVG dimensions
  const svgW = 600;
  const svgH = 500;
  const pad = 40;
  const plotW = svgW - 2 * pad;
  const plotH = svgH - 2 * pad;

  return (
    <div className="space-y-5">
      {/* Controls row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Atlas Map</h3>
          <span className="text-[9px] font-mono text-muted-foreground ml-2">
            {filteredCandidates.length} candidates plotted
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground">Filter:</span>
          {(["all", "low-vol", "high-vol", "jump-diffusion"] as const).map(r => (
            <button
              key={r}
              onClick={() => setFilterRegime(r)}
              className={`px-2.5 py-1 rounded-md text-[9px] font-medium transition-all ${
                filterRegime === r
                  ? "bg-foreground/10 text-foreground border border-foreground/20"
                  : "bg-secondary text-muted-foreground border border-transparent hover:text-foreground"
              }`}
            >
              {r === "all" ? "All" : REGIME_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Coverage indicator */}
      <motion.div className="grid grid-cols-3 gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="surface-elevated rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Layers className="w-3 h-3 text-muted-foreground" />
            <p className="text-[9px] text-muted-foreground">Space Coverage</p>
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{(coverage.coverage * 100).toFixed(1)}%</p>
          <p className="text-[8px] text-muted-foreground">{coverage.occupiedCells}/{coverage.totalCells} cells</p>
        </div>
        <div className="surface-elevated rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ZoomIn className="w-3 h-3 text-muted-foreground" />
            <p className="text-[9px] text-muted-foreground">Densest Region</p>
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{maxDensity}</p>
          <p className="text-[8px] text-muted-foreground">candidates in peak cell</p>
        </div>
        <div className="surface-elevated rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Eye className="w-3 h-3 text-muted-foreground" />
            <p className="text-[9px] text-muted-foreground">Sparse Regions</p>
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{coverage.totalCells - coverage.occupiedCells}</p>
          <p className="text-[8px] text-muted-foreground">unexplored cells</p>
        </div>
      </motion.div>

      {/* Main map */}
      <motion.div
        className="surface-elevated rounded-xl p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-xs font-semibold text-foreground">Feature Space Projection</h4>
            <p className="text-[9px] text-muted-foreground">
              X: Concentration (curvature + peak) &nbsp;|&nbsp; Y: Asymmetry (tail ratio + skew)
            </p>
          </div>
          {hoveredCandidate && (
            <div className="text-right">
              <p className="text-[9px] font-mono text-foreground">{hoveredCandidate.id}</p>
              <p className="text-[8px] text-muted-foreground">
                Score: {hoveredCandidate.score.toFixed(3)} | Gen {hoveredCandidate.generation}
              </p>
            </div>
          )}
        </div>

        {filteredCandidates.length === 0 ? (
          <div className="h-80 flex items-center justify-center">
            <p className="text-[10px] text-muted-foreground">No candidates yet. Start the engine to populate the atlas.</p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full"
            style={{ maxHeight: 500 }}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Density heatmap background */}
            {coverage.densityMap.map((row, yi) =>
              row.map((val, xi) => {
                if (val === 0) return null;
                const opacity = maxDensity > 0 ? (val / maxDensity) * 0.3 : 0;
                return (
                  <rect
                    key={`d-${xi}-${yi}`}
                    x={pad + (xi / GRID_SIZE) * plotW}
                    y={pad + (yi / GRID_SIZE) * plotH}
                    width={plotW / GRID_SIZE}
                    height={plotH / GRID_SIZE}
                    fill="hsl(var(--foreground))"
                    fillOpacity={opacity}
                    rx={2}
                  />
                );
              })
            )}

            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <g key={`grid-${v}`}>
                <line
                  x1={pad + v * plotW} y1={pad}
                  x2={pad + v * plotW} y2={pad + plotH}
                  stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="4 4"
                />
                <line
                  x1={pad} y1={pad + v * plotH}
                  x2={pad + plotW} y2={pad + v * plotH}
                  stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="4 4"
                />
              </g>
            ))}

            {/* Axes */}
            <line x1={pad} y1={pad + plotH} x2={pad + plotW} y2={pad + plotH} stroke="hsl(var(--border))" strokeWidth={1} />
            <line x1={pad} y1={pad} x2={pad} y2={pad + plotH} stroke="hsl(var(--border))" strokeWidth={1} />
            <text x={pad + plotW / 2} y={svgH - 5} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">Concentration</text>
            <text x={8} y={pad + plotH / 2} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))" transform={`rotate(-90, 8, ${pad + plotH / 2})`}>Asymmetry</text>

            {/* Candidate points */}
            {embedding.map((pt, i) => {
              const c = filteredCandidates[i];
              if (!c) return null;
              const cx = pad + Math.max(0, Math.min(1, pt.x)) * plotW;
              const cy = pad + plotH - Math.max(0, Math.min(1, pt.y)) * plotH;
              const isChampion = Object.values(state.populations).some(p => p.champion?.id === c.id);
              const isHovered = hoveredId === c.id;
              const r = isChampion ? 5 : isHovered ? 4 : 2.5;
              return (
                <circle
                  key={c.id}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={REGIME_COLORS[c.regime]}
                  fillOpacity={isChampion ? 0.9 : 0.5}
                  stroke={isChampion ? "hsl(var(--foreground))" : "none"}
                  strokeWidth={isChampion ? 1.5 : 0}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredId(c.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handlePointClick(c.id)}
                />
              );
            })}
          </svg>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-border">
          {(["low-vol", "high-vol", "jump-diffusion"] as const).map(r => (
            <div key={r} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: REGIME_COLORS[r] }} />
              <span className="text-[9px] text-muted-foreground">{REGIME_LABELS[r]}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border-2 border-foreground bg-transparent" />
            <span className="text-[9px] text-muted-foreground">Champion</span>
          </div>
        </div>
      </motion.div>

      {/* Hovered candidate quick info */}
      {hoveredCandidate && (
        <motion.div
          className="surface-elevated rounded-xl p-4"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-foreground">
              Quick Preview — {hoveredCandidate.id}
            </h4>
            <button
              onClick={() => handlePointClick(hoveredCandidate.id)}
              className="text-[9px] px-2 py-1 rounded bg-secondary text-foreground border border-border hover:bg-accent transition-colors"
            >
              Open Detail
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <QuickStat label="Curvature" value={hoveredCandidate.features.curvature.toFixed(4)} />
            <QuickStat label="Entropy" value={hoveredCandidate.features.entropy.toFixed(2)} />
            <QuickStat label="Symmetry" value={hoveredCandidate.features.symmetry.toFixed(3)} />
            <QuickStat label="Tail Ratio" value={hoveredCandidate.features.tailDensityRatio.toFixed(3)} />
            <QuickStat label="Peak Conc." value={hoveredCandidate.features.peakConcentration.toFixed(2)} />
          </div>
        </motion.div>
      )}
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[8px] text-muted-foreground">{label}</p>
      <p className="text-[10px] font-mono font-semibold text-foreground">{value}</p>
    </div>
  );
}
