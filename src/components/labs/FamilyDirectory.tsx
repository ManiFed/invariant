import { useMemo } from "react";
import { Layers, Trophy, Radar, Activity } from "lucide-react";
import type { EngineState } from "@/lib/discovery-engine";
import { computeFamilySummaries, INVARIANT_FAMILIES } from "@/lib/discovery-engine";

interface FamilyDirectoryProps {
  state: EngineState;
}

const FamilyDirectory = ({ state }: FamilyDirectoryProps) => {
  const summaries = useMemo(() => computeFamilySummaries(state.archive), [state.archive]);

  return (
    <div className="space-y-4">
      <div className="surface-elevated rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-chart-1" />
          <h3 className="text-sm font-semibold">Family Directory</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Validated invariant families with parameterized forms, cross-regime performance, and exploration coverage.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {summaries.map((summary) => {
          const definition = INVARIANT_FAMILIES.find((family) => family.id === summary.familyId);
          const scoreLabel = Number.isFinite(summary.avgScore) ? summary.avgScore.toFixed(3) : "—";

          return (
            <div key={summary.familyId} className="surface-elevated rounded-xl p-4 border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold">{definition?.label ?? summary.familyId}</h4>
                <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground">{summary.count} designs</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="text-muted-foreground">Avg score</p>
                  <p className="font-mono">{scoreLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Coverage</p>
                  <p className="font-mono">{(summary.regimeCoverage * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Stability</p>
                  <p className="font-mono">{summary.avgStability.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Curvature</p>
                  <p className="font-mono">{summary.avgCurvature.toFixed(3)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Trophy className="w-3 h-3" /> Dominance {(summary.dominanceFrequency * 100).toFixed(0)}%</span>
                <span className="inline-flex items-center gap-1"><Radar className="w-3 h-3" /> Family-aware atlas</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="surface-elevated rounded-xl p-4 border border-border/50">
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Activity className="w-3 h-3" />
          White-space now tracks underexplored regions in both liquidity geometry and family parameter domains.
        </p>
      </div>
    </div>
  );
};

export default FamilyDirectory;
