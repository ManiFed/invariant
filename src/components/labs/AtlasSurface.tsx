import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Map as MapIcon, Layers, Eye, ZoomIn, Pause, Play, RotateCcw } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
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

// ─── Collective Spider Graph ────────────────────────────────────────────────

function CollectiveSpiderGraph({ candidates, filterRegime }: { candidates: Candidate[]; filterRegime: RegimeId | "all" }) {
  const colors = useChartColors();

  const data = useMemo(() => {
    if (candidates.length === 0) return [];

    const axes = [
      { key: "fees", label: "Fees" },
      { key: "utilization", label: "Utilization" },
      { key: "lpValue", label: "LP Value" },
      { key: "lowSlippage", label: "Low Slippage" },
      { key: "lowArb", label: "Low Arb Leak" },
      { key: "stability", label: "Stability" },
    ];

    // Compute per-regime aggregates: mean, p10, p90
    const regimesToPlot: RegimeId[] = filterRegime === "all"
      ? ["low-vol", "high-vol", "jump-diffusion"]
      : [filterRegime];

    const grouped: Record<string, Candidate[]> = {};
    for (const r of regimesToPlot) grouped[r] = [];
    for (const c of candidates) {
      if (grouped[c.regime]) grouped[c.regime].push(c);
    }

    function metricValue(c: Candidate, key: string): number {
      const m = c.metrics;
      switch (key) {
        case "fees": return Math.min(m.totalFees / 50, 1) * 100;
        case "utilization": return m.liquidityUtilization * 100;
        case "lpValue": return Math.min(m.lpValueVsHodl, 1.2) / 1.2 * 100;
        case "lowSlippage": return Math.max(0, (1 - m.totalSlippage * 10)) * 100;
        case "lowArb": return Math.max(0, (1 - m.arbLeakage / 50)) * 100;
        case "stability": return Math.max(0, (1 - c.stability * 5)) * 100;
        default: return 0;
      }
    }

    function percentile(arr: number[], p: number): number {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.floor(p * (sorted.length - 1));
      return sorted[idx];
    }

    return axes.map(axis => {
      const point: Record<string, string | number> = { axis: axis.label };

      for (const r of regimesToPlot) {
        const vals = grouped[r].map(c => metricValue(c, axis.key));
        if (vals.length === 0) {
          point[`${r}_mean`] = 0;
          point[`${r}_p10`] = 0;
          point[`${r}_p90`] = 0;
        } else {
          point[`${r}_mean`] = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
          point[`${r}_p10`] = parseFloat(percentile(vals, 0.1).toFixed(1));
          point[`${r}_p90`] = parseFloat(percentile(vals, 0.9).toFixed(1));
        }
      }
      return point;
    });
  }, [candidates, filterRegime]);

  const regimesToPlot: RegimeId[] = filterRegime === "all"
    ? ["low-vol", "high-vol", "jump-diffusion"]
    : [filterRegime];

  if (candidates.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-[10px] text-muted-foreground">Waiting for candidates...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke={colors.grid} />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 8, fill: colors.tick }} />
            <Tooltip
              contentStyle={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 9, color: colors.tooltipText }}
              wrapperStyle={{ pointerEvents: "none" }}
            />
            {regimesToPlot.map(r => (
              <Radar
                key={`${r}_p90`}
                name={`${REGIME_LABELS[r]} P90`}
                dataKey={`${r}_p90`}
                stroke={REGIME_COLORS[r]}
                fill={REGIME_COLORS[r]}
                fillOpacity={0.04}
                strokeWidth={0.5}
                strokeDasharray="3 3"
              />
            ))}
            {regimesToPlot.map(r => (
              <Radar
                key={`${r}_mean`}
                name={`${REGIME_LABELS[r]} Mean`}
                dataKey={`${r}_mean`}
                stroke={REGIME_COLORS[r]}
                fill={REGIME_COLORS[r]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            ))}
            {regimesToPlot.map(r => (
              <Radar
                key={`${r}_p10`}
                name={`${REGIME_LABELS[r]} P10`}
                dataKey={`${r}_p10`}
                stroke={REGIME_COLORS[r]}
                fill="none"
                fillOpacity={0}
                strokeWidth={0.5}
                strokeDasharray="3 3"
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 mt-1">
        {regimesToPlot.map(r => (
          <div key={r} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: REGIME_COLORS[r] }} />
            <span className="text-[8px] text-muted-foreground">{REGIME_LABELS[r]}</span>
          </div>
        ))}
        <span className="text-[8px] text-muted-foreground/60 ml-2">solid = mean | dashed = P10/P90</span>
      </div>
    </div>
  );
}

// ─── Individual Spider Graph ─────────────────────────────────────────────────

function IndividualSpiderGraph({ candidate }: { candidate: Candidate }) {
  const colors = useChartColors();

  const data = useMemo(() => {
    const m = candidate.metrics;
    return [
      { axis: "Fees", value: Math.min(m.totalFees / 50, 1) * 100 },
      { axis: "Utilization", value: m.liquidityUtilization * 100 },
      { axis: "LP Value", value: Math.min(m.lpValueVsHodl, 1.2) / 1.2 * 100 },
      { axis: "Low Slippage", value: Math.max(0, (1 - m.totalSlippage * 10)) * 100 },
      { axis: "Low Arb Leak", value: Math.max(0, (1 - m.arbLeakage / 50)) * 100 },
      { axis: "Stability", value: Math.max(0, (1 - candidate.stability * 5)) * 100 },
      { axis: "Low Drawdown", value: Math.max(0, (1 - m.maxDrawdown * 2)) * 100 },
    ];
  }, [candidate]);

  const color = REGIME_COLORS[candidate.regime];

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke={colors.grid} />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 7, fill: colors.tick }} />
          <Tooltip
            contentStyle={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 9, color: colors.tooltipText }}
            wrapperStyle={{ pointerEvents: "none" }}
          />
          <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} name="Performance" />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Atlas Surface ─────────────────────────────────────────────────────

export default function AtlasSurface({ state, onSelectCandidate }: AtlasSurfaceProps) {
  const [filterRegime, setFilterRegime] = useState<RegimeId | "all">("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Freeze state: when frozen, we snapshot the data and allow zoom/pan
  const [frozen, setFrozen] = useState(false);
  const [frozenState, setFrozenState] = useState<EngineState | null>(null);

  // Zoom/pan state (only active when frozen)
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 600, h: 500 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, vbX: 0, vbY: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const handleFreeze = useCallback(() => {
    setFrozen(true);
    setFrozenState(state);
    setViewBox({ x: 0, y: 0, w: 600, h: 500 }); // reset zoom
  }, [state]);

  const handleResume = useCallback(() => {
    setFrozen(false);
    setFrozenState(null);
    setViewBox({ x: 0, y: 0, w: 600, h: 500 });
  }, []);

  const handleResetZoom = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: 600, h: 500 });
  }, []);

  // Use frozen snapshot or live state
  const displayState = frozen && frozenState ? frozenState : state;

  const filteredCandidates = useMemo(() => {
    if (filterRegime === "all") return displayState.archive;
    return displayState.archive.filter(c => c.regime === filterRegime);
  }, [displayState.archive, filterRegime]);

  const embedding = useMemo(() => {
    if (filteredCandidates.length === 0) return [];
    return embedCandidates(filteredCandidates);
  }, [filteredCandidates]);

  const coverage = useMemo(() => {
    if (displayState.archive.length === 0) return { coverage: 0, densityMap: [], totalCells: 0, occupiedCells: 0 };
    return computeCoverage(displayState.archive, GRID_SIZE);
  }, [displayState.archive]);

  const candidateMap = useMemo(() => {
    const lookup = new globalThis.Map<string, Candidate>();
    for (const c of filteredCandidates) lookup.set(c.id, c);
    return lookup;
  }, [filteredCandidates]);

  const hoveredCandidate = hoveredId ? candidateMap.get(hoveredId) ?? null : null;

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

  // SVG base dimensions
  const svgW = 600;
  const svgH = 500;
  const pad = 40;
  const plotW = svgW - 2 * pad;
  const plotH = svgH - 2 * pad;

  // Zoom via scroll wheel (only when frozen)
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    if (!frozen) return;
    e.preventDefault();
    e.stopPropagation();

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
    const mouseY = ((e.clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;

    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.87;
    const newW = Math.max(60, Math.min(600, viewBox.w * zoomFactor));
    const newH = Math.max(50, Math.min(500, viewBox.h * zoomFactor));

    const ratioX = (mouseX - viewBox.x) / viewBox.w;
    const ratioY = (mouseY - viewBox.y) / viewBox.h;

    setViewBox({
      x: mouseX - ratioX * newW,
      y: mouseY - ratioY * newH,
      w: newW,
      h: newH,
    });
  }, [frozen, viewBox]);

  // Pan via mouse drag (only when frozen)
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!frozen) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, vbX: viewBox.x, vbY: viewBox.y };
  }, [frozen, viewBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning || !frozen) return;
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const dx = ((panStart.current.x - e.clientX) / rect.width) * viewBox.w;
    const dy = ((panStart.current.y - e.clientY) / rect.height) * viewBox.h;

    setViewBox(prev => ({
      ...prev,
      x: panStart.current.vbX + dx,
      y: panStart.current.vbY + dy,
    }));
  }, [isPanning, frozen, viewBox.w, viewBox.h]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Release pan on mouse leave
  useEffect(() => {
    const handleGlobalUp = () => setIsPanning(false);
    window.addEventListener("mouseup", handleGlobalUp);
    return () => window.removeEventListener("mouseup", handleGlobalUp);
  }, []);

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
          {frozen && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-warning/10 border border-warning/20 text-warning ml-1">
              FROZEN
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Freeze / Resume */}
          {!frozen ? (
            <button
              onClick={handleFreeze}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-medium bg-secondary text-foreground border border-border hover:bg-accent transition-colors"
              title="Freeze map to enable zoom and pan"
            >
              <Pause className="w-3 h-3" /> Freeze
            </button>
          ) : (
            <>
              <button
                onClick={handleResetZoom}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors"
                title="Reset zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <button
                onClick={handleResume}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-medium bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors"
                title="Resume live sync"
              >
                <Play className="w-3 h-3" /> Resume
              </button>
            </>
          )}
          <div className="w-px h-4 bg-border" />
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

      {/* Collective Spider Graph + Main Map side by side */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Spider graph */}
        <motion.div className="surface-elevated rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
          <h4 className="text-xs font-semibold text-foreground mb-1">Collective Performance</h4>
          <p className="text-[9px] text-muted-foreground mb-2">
            All {filteredCandidates.length} candidates — mean with P10/P90 bands
          </p>
          <CollectiveSpiderGraph candidates={filteredCandidates} filterRegime={filterRegime} />
        </motion.div>

        {/* Main map */}
        <motion.div
          className="md:col-span-2 surface-elevated rounded-xl p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Feature Space Projection</h4>
              <p className="text-[9px] text-muted-foreground">
                X: Concentration &nbsp;|&nbsp; Y: Asymmetry
                {frozen && <span className="text-warning ml-2">Scroll to zoom, drag to pan</span>}
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
              <p className="text-[10px] text-muted-foreground">Waiting for candidates to populate the atlas...</p>
            </div>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              className={`w-full ${frozen ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default"}`}
              style={{ maxHeight: 500 }}
              preserveAspectRatio="xMidYMid meet"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
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
                const isChampion = Object.values(displayState.populations).some(p => p.champion?.id === c.id);
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
      </div>

      {/* Hovered candidate quick info + individual spider graph */}
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
          <div className="grid md:grid-cols-3 gap-4">
            {/* Feature stats */}
            <div className="md:col-span-1 space-y-2">
              <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wide">Shape Features</p>
              <div className="grid grid-cols-2 gap-2">
                <QuickStat label="Curvature" value={hoveredCandidate.features.curvature.toFixed(4)} />
                <QuickStat label="Entropy" value={hoveredCandidate.features.entropy.toFixed(2)} />
                <QuickStat label="Symmetry" value={hoveredCandidate.features.symmetry.toFixed(3)} />
                <QuickStat label="Tail Ratio" value={hoveredCandidate.features.tailDensityRatio.toFixed(3)} />
                <QuickStat label="Peak Conc." value={hoveredCandidate.features.peakConcentration.toFixed(2)} />
                <QuickStat label="Score" value={hoveredCandidate.score.toFixed(3)} />
              </div>
            </div>
            {/* Individual spider graph */}
            <div className="md:col-span-2">
              <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Performance Profile</p>
              <IndividualSpiderGraph candidate={hoveredCandidate} />
            </div>
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
