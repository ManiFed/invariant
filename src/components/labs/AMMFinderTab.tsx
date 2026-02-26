import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { type Candidate, type EngineState, REGIMES } from "@/lib/discovery-engine";

type AMMFinderTabProps = {
  state: EngineState;
  onSelectCandidate: (id: string) => void;
};

type PreferenceKey = "fees" | "lpValue" | "lowSlippage" | "lowDrawdown" | "stability" | "utilization";

type PreferenceConfig = {
  key: PreferenceKey;
  label: string;
  description: string;
};

const PREFERENCE_CONFIG: PreferenceConfig[] = [
  { key: "fees", label: "Fee Generation", description: "Prefer AMMs that generate more trading fees." },
  { key: "lpValue", label: "LP Value", description: "Prefer AMMs that outperform simple HODL." },
  { key: "lowSlippage", label: "Low Slippage", description: "Prefer AMMs with tighter execution quality." },
  { key: "lowDrawdown", label: "Low Drawdown", description: "Prefer AMMs with smaller downside shocks." },
  { key: "stability", label: "Stability", description: "Prefer AMMs with steadier cross-path behavior." },
  { key: "utilization", label: "Utilization", description: "Prefer AMMs with higher capital usage." },
];

const metricValue = (candidate: Candidate, key: PreferenceKey): number => {
  if (key === "fees") return candidate.metrics.totalFees;
  if (key === "lpValue") return candidate.metrics.lpValueVsHodl;
  if (key === "lowSlippage") return -candidate.metrics.totalSlippage;
  if (key === "lowDrawdown") return -candidate.metrics.maxDrawdown;
  if (key === "stability") return candidate.stability;
  return candidate.metrics.liquidityUtilization;
};

const fmt = (value: number, digits = 3) => value.toFixed(digits);

const AMMFinderTab = ({ state, onSelectCandidate }: AMMFinderTabProps) => {
  const [weights, setWeights] = useState<Record<PreferenceKey, number>>({
    fees: 65,
    lpValue: 85,
    lowSlippage: 75,
    lowDrawdown: 70,
    stability: 80,
    utilization: 60,
  });
  const [regime, setRegime] = useState<"all" | Candidate["regime"]>("all");
  const [poolType, setPoolType] = useState<"all" | "two-asset" | "multi-asset">("all");

  const scoredCandidates = useMemo(() => {
    const candidates = state.archive.filter((candidate) => {
      if (regime !== "all" && candidate.regime !== regime) return false;
      if (poolType !== "all" && (candidate.poolType ?? "two-asset") !== poolType) return false;
      return true;
    });

    if (candidates.length === 0) return [];

    const totalWeight = Math.max(1, Object.values(weights).reduce((sum, weight) => sum + weight, 0));

    const metricBounds = PREFERENCE_CONFIG.reduce(
      (acc, pref) => {
        const values = candidates.map((candidate) => metricValue(candidate, pref.key));
        acc[pref.key] = {
          min: Math.min(...values),
          max: Math.max(...values),
        };
        return acc;
      },
      {} as Record<PreferenceKey, { min: number; max: number }>,
    );

    return candidates
      .map((candidate) => {
        const weightedScore = PREFERENCE_CONFIG.reduce((sum, pref) => {
          const metric = metricValue(candidate, pref.key);
          const bounds = metricBounds[pref.key];
          const span = bounds.max - bounds.min;
          const normalized = span <= 1e-9 ? 0.5 : (metric - bounds.min) / span;
          const weight = weights[pref.key] / totalWeight;
          return sum + normalized * weight;
        }, 0);

        return { candidate, weightedScore };
      })
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 10);
  }, [poolType, regime, state.archive, weights]);

  return (
    <div className="space-y-5">
      <section className="surface-elevated rounded-xl p-4 border border-border">
        <div className="flex items-center gap-2 mb-1">
          <SlidersHorizontal className="w-4 h-4 text-chart-3" />
          <h3 className="text-sm font-semibold text-foreground">Find your AMM profile</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Move sliders to define your ideal AMM. Atlas ranks the best generated candidates against your preferences.
        </p>

        <div className="grid md:grid-cols-2 gap-3 mb-4">
          {PREFERENCE_CONFIG.map((pref) => (
            <label key={pref.key} className="rounded-lg border border-border p-3 bg-background/60">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-foreground">{pref.label}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{weights[pref.key]}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={weights[pref.key]}
                onChange={(event) => setWeights((prev) => ({ ...prev, [pref.key]: Number(event.target.value) }))}
                className="w-full mt-2 accent-chart-3"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">{pref.description}</p>
            </label>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Market regime
            <select
              className="px-2 py-2 rounded-md border border-border bg-background text-xs"
              value={regime}
              onChange={(event) => setRegime(event.target.value as typeof regime)}
            >
              <option value="all">All regimes</option>
              {REGIMES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Pool type
            <select
              className="px-2 py-2 rounded-md border border-border bg-background text-xs"
              value={poolType}
              onChange={(event) => setPoolType(event.target.value as typeof poolType)}
            >
              <option value="all">All pool types</option>
              <option value="two-asset">Two-asset</option>
              <option value="multi-asset">Multi-asset</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Search className="w-3.5 h-3.5" />
          Showing top {scoredCandidates.length} matches from {state.archive.length.toLocaleString()} archived AMMs
        </div>

        {scoredCandidates.length === 0 ? (
          <div className="surface-elevated rounded-xl border border-border p-6 text-sm text-muted-foreground">
            No candidates match the selected filters yet. Try broadening regime/pool filters.
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-3">
            {scoredCandidates.map(({ candidate, weightedScore }, index) => (
              <button
                key={candidate.id}
                onClick={() => onSelectCandidate(candidate.id)}
                className="text-left surface-elevated rounded-xl border border-border p-4 hover:border-foreground/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-foreground">#{index + 1} Match</div>
                  <div className="text-[10px] font-mono text-chart-3">Fit {fmt(weightedScore * 100, 1)}%</div>
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  {candidate.familyId} • {candidate.regime} • Gen {candidate.generation}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-muted-foreground">Fees</span>
                  <span className="text-right text-foreground">{fmt(candidate.metrics.totalFees)}</span>
                  <span className="text-muted-foreground">LP/HODL</span>
                  <span className="text-right text-foreground">{fmt(candidate.metrics.lpValueVsHodl)}</span>
                  <span className="text-muted-foreground">Slippage</span>
                  <span className="text-right text-foreground">{fmt(candidate.metrics.totalSlippage, 4)}</span>
                  <span className="text-muted-foreground">Max Drawdown</span>
                  <span className="text-right text-foreground">{fmt(candidate.metrics.maxDrawdown, 4)}</span>
                  <span className="text-muted-foreground">Stability</span>
                  <span className="text-right text-foreground">{fmt(candidate.stability, 4)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AMMFinderTab;
