import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Trophy, Radar, Activity, ChevronDown, ChevronRight, TrendingUp, Zap, BarChart3, Eye } from "lucide-react";
import {
  RadarChart, Radar as RechartsRadar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import type { EngineState, Candidate } from "@/lib/discovery-engine";
import { computeFamilySummaries, INVARIANT_FAMILIES, REGIMES } from "@/lib/discovery-engine";

interface FamilyDirectoryProps {
  state: EngineState;
}

const FAMILY_COLORS = [
  "hsl(172, 66%, 50%)",
  "hsl(262, 60%, 55%)",
  "hsl(38, 92%, 55%)",
];

const FamilyDirectory = ({ state }: FamilyDirectoryProps) => {
  const colors = useChartColors();
  const summaries = useMemo(() => computeFamilySummaries(state.archive), [state.archive]);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [selectedRegime, setSelectedRegime] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score" | "coverage" | "count" | "dominance">("score");

  // Per-family regime breakdowns
  const familyRegimeData = useMemo(() => {
    const map = new Map<string, Record<string, { count: number; avgScore: number; bestScore: number }>>();
    for (const c of state.archive) {
      if (!c.familyId) continue;
      if (!map.has(c.familyId)) map.set(c.familyId, {});
      const regimeMap = map.get(c.familyId)!;
      if (!regimeMap[c.regime]) regimeMap[c.regime] = { count: 0, avgScore: 0, bestScore: Infinity };
      regimeMap[c.regime].count++;
      regimeMap[c.regime].avgScore += c.score;
      regimeMap[c.regime].bestScore = Math.min(regimeMap[c.regime].bestScore, c.score);
    }
    for (const [, regimeMap] of map) {
      for (const regime of Object.keys(regimeMap)) {
        regimeMap[regime].avgScore /= regimeMap[regime].count;
      }
    }
    return map;
  }, [state.archive]);

  // Top candidates per family
  const familyTopCandidates = useMemo(() => {
    const map = new Map<string, Candidate[]>();
    for (const c of state.archive) {
      if (!c.familyId) continue;
      if (!map.has(c.familyId)) map.set(c.familyId, []);
      map.get(c.familyId)!.push(c);
    }
    for (const [key, candidates] of map) {
      map.set(key, candidates.sort((a, b) => a.score - b.score).slice(0, 5));
    }
    return map;
  }, [state.archive]);

  const sorted = useMemo(() => {
    const arr = [...summaries];
    if (sortBy === "score") arr.sort((a, b) => a.avgScore - b.avgScore);
    else if (sortBy === "coverage") arr.sort((a, b) => b.regimeCoverage - a.regimeCoverage);
    else if (sortBy === "count") arr.sort((a, b) => b.count - a.count);
    else if (sortBy === "dominance") arr.sort((a, b) => b.dominanceFrequency - a.dominanceFrequency);
    return arr;
  }, [summaries, sortBy]);

  // Overall radar data for comparing families
  const radarData = useMemo(() => {
    if (summaries.length === 0) return [];
    const metrics = ["Avg Score", "Stability", "Curvature", "Coverage", "Dominance"];
    return metrics.map(metric => {
      const entry: Record<string, any> = { metric };
      for (const s of summaries) {
        const def = INVARIANT_FAMILIES.find(f => f.id === s.familyId);
        const label = def?.label ?? s.familyId;
        if (metric === "Avg Score") entry[label] = Number.isFinite(s.avgScore) ? Math.max(0, 1 - Math.abs(s.avgScore) / 10) : 0;
        else if (metric === "Stability") entry[label] = Number.isFinite(s.avgStability) ? Math.max(0, 1 - s.avgStability) : 0;
        else if (metric === "Curvature") entry[label] = Number.isFinite(s.avgCurvature) ? Math.min(1, s.avgCurvature * 5) : 0;
        else if (metric === "Coverage") entry[label] = s.regimeCoverage;
        else if (metric === "Dominance") entry[label] = s.dominanceFrequency;
      }
      return entry;
    });
  }, [summaries]);

  const familyLabels = summaries.map(s => INVARIANT_FAMILIES.find(f => f.id === s.familyId)?.label ?? s.familyId);

  // Bar chart data for family comparison
  const barData = useMemo(() => {
    return sorted.map((s, i) => {
      const def = INVARIANT_FAMILIES.find(f => f.id === s.familyId);
      return {
        name: def?.label ?? s.familyId,
        designs: s.count,
        dominance: Math.round(s.dominanceFrequency * 100),
        color: FAMILY_COLORS[i % FAMILY_COLORS.length],
      };
    });
  }, [sorted]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="surface-elevated rounded-xl p-5 border border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-chart-1" />
            <h3 className="text-base font-bold">Invariant Family Directory</h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedRegime}
              onChange={e => setSelectedRegime(e.target.value)}
              className="px-2 py-1.5 rounded-md border border-border bg-background text-xs"
            >
              <option value="all">All Regimes</option>
              {REGIMES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-2 py-1.5 rounded-md border border-border bg-background text-xs"
            >
              <option value="score">Sort by Score</option>
              <option value="coverage">Sort by Coverage</option>
              <option value="count">Sort by Designs</option>
              <option value="dominance">Sort by Dominance</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Validated invariant families with parameterized forms, cross-regime performance, and exploration coverage. Click a family to explore its detailed breakdown.
        </p>
      </div>

      {/* Radar + Bar comparison */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="surface-elevated rounded-xl p-4 border border-border/50">
            <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <Radar className="w-3.5 h-3.5 text-chart-2" />
              Family Comparison Radar
            </h4>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke={colors.grid} />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: colors.tick }} />
                {familyLabels.map((label, i) => (
                  <RechartsRadar
                    key={label}
                    name={label}
                    dataKey={label}
                    stroke={FAMILY_COLORS[i % FAMILY_COLORS.length]}
                    fill={FAMILY_COLORS[i % FAMILY_COLORS.length]}
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {familyLabels.map((label, i) => (
                <div key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: FAMILY_COLORS[i % FAMILY_COLORS.length] }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="surface-elevated rounded-xl p-4 border border-border/50">
            <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-chart-4" />
              Design Count &amp; Dominance
            </h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} layout="vertical" margin={{ left: 4, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 9, fill: colors.tick }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: colors.tick }} width={100} />
                <Tooltip
                  contentStyle={{ background: colors.tooltipBg, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: colors.tick }}
                />
                <Bar dataKey="designs" name="Designs" radius={[0, 4, 4, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Family Cards */}
      <div className="space-y-3">
        {sorted.map((summary, idx) => {
          const definition = INVARIANT_FAMILIES.find(f => f.id === summary.familyId);
          const scoreLabel = Number.isFinite(summary.avgScore) ? summary.avgScore.toFixed(3) : "—";
          const isExpanded = expandedFamily === summary.familyId;
          const color = FAMILY_COLORS[idx % FAMILY_COLORS.length];
          const regimeBreakdown = familyRegimeData.get(summary.familyId);
          const topCandidates = familyTopCandidates.get(summary.familyId) ?? [];

          return (
            <motion.div
              key={summary.familyId}
              layout
              className="surface-elevated rounded-xl border border-border/50 overflow-hidden"
            >
              {/* Card header - clickable */}
              <button
                onClick={() => setExpandedFamily(isExpanded ? null : summary.familyId)}
                className="w-full flex items-center justify-between p-4 hover:bg-accent/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-8 rounded-full" style={{ background: color }} />
                  <div>
                    <h4 className="text-sm font-semibold">{definition?.label ?? summary.familyId}</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {summary.count} designs · {(summary.regimeCoverage * 100).toFixed(0)}% coverage · {(summary.dominanceFrequency * 100).toFixed(0)}% dominance
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="grid grid-cols-3 gap-4 text-right">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Avg Score</p>
                      <p className="text-xs font-mono font-medium">{scoreLabel}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Stability</p>
                      <p className="text-xs font-mono font-medium">{summary.avgStability.toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Curvature</p>
                      <p className="text-xs font-mono font-medium">{summary.avgCurvature.toFixed(3)}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4">
                      {/* Parameter Ranges */}
                      {definition && (
                        <div>
                          <h5 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-chart-1" />
                            Parameter Ranges
                          </h5>
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(definition.parameterRanges).map(([key, range]) => (
                              <div key={key} className="rounded-lg bg-secondary/50 p-2.5">
                                <p className="text-[10px] font-medium text-foreground">{key}</p>
                                <div className="mt-1.5 h-1.5 rounded-full bg-background relative overflow-hidden">
                                  <div
                                    className="absolute inset-y-0 left-0 rounded-full"
                                    style={{
                                      background: color,
                                      width: `${((range.max - range.min) / (range.max + Math.abs(range.min) + 0.01)) * 100}%`,
                                      opacity: 0.7,
                                    }}
                                  />
                                </div>
                                <p className="text-[9px] text-muted-foreground mt-1">{range.min.toFixed(2)} – {range.max.toFixed(2)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Regime Breakdown */}
                      {regimeBreakdown && (
                        <div>
                          <h5 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
                            <Activity className="w-3 h-3 text-chart-2" />
                            Regime Breakdown
                          </h5>
                          <div className="grid grid-cols-3 gap-2">
                            {REGIMES.map(regime => {
                              const data = regimeBreakdown[regime.id];
                              return (
                                <div key={regime.id} className="rounded-lg bg-secondary/50 p-2.5">
                                  <p className="text-[10px] font-medium">{regime.label}</p>
                                  {data ? (
                                    <div className="mt-1 space-y-0.5">
                                      <p className="text-[10px] text-muted-foreground">{data.count} designs</p>
                                      <p className="text-[10px] text-muted-foreground">
                                        Best: <span className="font-mono">{data.bestScore === Infinity ? "—" : data.bestScore.toFixed(3)}</span>
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        Avg: <span className="font-mono">{data.avgScore.toFixed(3)}</span>
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-muted-foreground mt-1 italic">No data</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Top Candidates */}
                      {topCandidates.length > 0 && (
                        <div>
                          <h5 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
                            <Trophy className="w-3 h-3 text-chart-4" />
                            Top 5 Candidates
                          </h5>
                          <div className="rounded-lg border border-border/30 overflow-hidden">
                            <table className="w-full text-[10px]">
                              <thead>
                                <tr className="bg-secondary/30">
                                  <th className="text-left px-2 py-1.5 font-medium">ID</th>
                                  <th className="text-left px-2 py-1.5 font-medium">Regime</th>
                                  <th className="text-right px-2 py-1.5 font-medium">Score</th>
                                  <th className="text-right px-2 py-1.5 font-medium">Stability</th>
                                  <th className="text-right px-2 py-1.5 font-medium">LP/HODL</th>
                                  <th className="text-right px-2 py-1.5 font-medium">Fees</th>
                                </tr>
                              </thead>
                              <tbody>
                                {topCandidates.map((c, i) => (
                                  <tr key={c.id} className={`border-t border-border/20 ${i === 0 ? "bg-chart-1/5" : ""}`}>
                                    <td className="px-2 py-1.5 font-mono">{c.id.slice(0, 10)}</td>
                                    <td className="px-2 py-1.5">{c.regime}</td>
                                    <td className="px-2 py-1.5 text-right font-mono">{c.score.toFixed(3)}</td>
                                    <td className="px-2 py-1.5 text-right font-mono">{c.stability.toFixed(3)}</td>
                                    <td className="px-2 py-1.5 text-right font-mono">{c.metrics.lpValueVsHodl.toFixed(3)}</td>
                                    <td className="px-2 py-1.5 text-right font-mono">{c.metrics.totalFees.toFixed(1)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Dominance bar */}
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Dominance frequency</span>
                        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${summary.dominanceFrequency * 100}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">{(summary.dominanceFrequency * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {summaries.length === 0 && (
        <div className="surface-elevated rounded-xl p-8 border border-border/50 text-center">
          <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">No families discovered yet. The engine is exploring...</p>
        </div>
      )}
    </div>
  );
};

export default FamilyDirectory;
