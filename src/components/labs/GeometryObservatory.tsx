import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Layers, Sparkles, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type RegimeMapEntry,
  type RegimeVector,
  computeRegimeCoverage,
  createRegimeGrid,
  estimateRegimeGeometry,
  evolveRegimePoint,
} from "@/lib/regime-mapper";

const defaultRegime: RegimeVector = {
  volatility: 0.45,
  jumpIntensity: 1.2,
  jumpMean: -0.036,
  jumpStd: 0.08,
  meanReversion: 0.8,
  arbResponsiveness: 0.75,
};

type OverlayCurve = {
  id: string;
  label: string;
  bins: number[];
  source: "evolved" | "interpolated";
};

function BinsCurve({ bins, className }: { bins: number[]; className?: string }) {
  if (bins.length === 0) return null;
  const max = Math.max(...bins, 1);
  const points = bins
    .map((value, i) => `${(i / (bins.length - 1)) * 100},${100 - (value / max) * 100}`)
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className={className}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function GeometryObservatory() {
  const [regime, setRegime] = useState<RegimeVector>(defaultRegime);
  const [entries, setEntries] = useState<RegimeMapEntry[]>([]);
  const [overlays, setOverlays] = useState<OverlayCurve[]>([]);
  const [isSampling, setIsSampling] = useState(false);

  const estimate = useMemo(() => estimateRegimeGeometry(regime, entries), [entries, regime]);
  const coverage = useMemo(() => computeRegimeCoverage(entries), [entries]);

  const curveBins = estimate ? Array.from(estimate.bins) : [];

  const sampleCurrentRegime = () => {
    setIsSampling(true);
    setTimeout(() => {
      const sampled = evolveRegimePoint(regime, { maxGenerations: 8, threshold: 0.003, patience: 2 });
      setEntries((prev) => [sampled, ...prev]);
      setIsSampling(false);
    }, 20);
  };

  const sampleSeedGrid = () => {
    setIsSampling(true);
    const grid = createRegimeGrid(2).slice(0, 8);
    setTimeout(() => {
      const seeded = grid.map((point) => evolveRegimePoint(point, { maxGenerations: 6, threshold: 0.003, patience: 2 }));
      setEntries((prev) => [...seeded, ...prev]);
      setIsSampling(false);
    }, 20);
  };

  return (
    <section className="space-y-4">
      <div className="surface-elevated rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2"><Radar className="w-4 h-4" /> Geometry Observatory</p>
            <p className="text-xs text-muted-foreground">Continuous regime sliders with direct optima and interpolation-aware geometry estimates.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={sampleSeedGrid} disabled={isSampling}>Seed regime grid</Button>
            <Button size="sm" onClick={sampleCurrentRegime} disabled={isSampling}>{isSampling ? "Sampling…" : "Evolve current regime"}</Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-4">
          <div className="space-y-3">
            {[
              ["Volatility", "volatility", 0.2, 1.2, 0.01],
              ["Jump intensity", "jumpIntensity", 0, 8, 0.1],
              ["Mean reversion", "meanReversion", 0, 3, 0.05],
              ["Arbitrage latency", "arbResponsiveness", 0.1, 1, 0.01],
            ].map(([label, key, min, max, step]) => (
              <label key={String(key)} className="block">
                <div className="flex justify-between text-xs mb-1">
                  <span>{label}</span>
                  <span className="font-mono text-muted-foreground">{(regime[key as keyof RegimeVector] as number).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={Number(min)}
                  max={Number(max)}
                  step={Number(step)}
                  value={regime[key as keyof RegimeVector] as number}
                  onChange={(event) => setRegime((prev) => ({ ...prev, [key]: Number(event.target.value) }))}
                  className="w-full"
                />
              </label>
            ))}
          </div>

          <div>
            <motion.div key={curveBins.join("|").slice(0, 120)} initial={{ opacity: 0.35 }} animate={{ opacity: 1 }} className="rounded-lg border border-border bg-background/50 p-3">
              <div className="h-52 text-chart-2">
                <BinsCurve bins={curveBins} className="w-full h-full" />
              </div>
              <div className="flex items-center justify-between text-[11px] mt-2">
                <span className="text-muted-foreground">Curve source:</span>
                <span className={estimate?.source === "evolved" ? "text-success" : "text-warning"}>{estimate?.source ?? "unsampled"}</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="surface-elevated rounded-xl border border-border p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Overlay compare</p>
            <Button
              size="sm"
              variant="outline"
              disabled={!estimate}
              onClick={() => estimate && setOverlays((prev) => [{ id: `${Date.now()}`, label: `${estimate.source} @ σ${regime.volatility.toFixed(2)}`, bins: Array.from(estimate.bins), source: estimate.source }, ...prev].slice(0, 4))}
            >
              Add current
            </Button>
          </div>

          <div className="space-y-2">
            {overlays.map((overlay, idx) => (
              <div key={overlay.id} className="rounded-md border border-border p-2">
                <p className="text-[11px] mb-1">{overlay.label}</p>
                <div className="h-20" style={{ color: ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"][idx % 4] }}>
                  <BinsCurve bins={overlay.bins} className="w-full h-full" />
                </div>
              </div>
            ))}
            {overlays.length === 0 && <p className="text-[11px] text-muted-foreground">No overlays yet. Add snapshots to compare structural changes.</p>}
          </div>
        </div>

        <div className="surface-elevated rounded-xl border border-border p-4">
          <p className="text-xs font-semibold flex items-center gap-1 mb-2"><Sparkles className="w-3.5 h-3.5" /> Live geometric features</p>
          {estimate ? (
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span>Concentration width</span><span className="font-mono">{estimate.features.concentrationWidth.toFixed(3)}</span></div>
              <div className="flex justify-between"><span>Entropy</span><span className="font-mono">{estimate.features.entropy.toFixed(3)}</span></div>
              <div className="flex justify-between"><span>Tail density ratio</span><span className="font-mono">{estimate.features.tailDensityRatio.toFixed(3)}</span></div>
              <div className="flex justify-between"><span>Curvature gradient</span><span className="font-mono">{estimate.features.curvatureGradient.toFixed(3)}</span></div>
              <div className="flex justify-between"><span>Symmetry index</span><span className="font-mono">{estimate.features.symmetry.toFixed(3)}</span></div>
              <div className="flex justify-between"><span>Stability</span><span className="font-mono">{estimate.stability.toFixed(4)}</span></div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Sample at least one regime to activate interpolation.</p>
          )}

          <div className="mt-4 pt-3 border-t border-border text-[11px] space-y-1">
            <div className="flex justify-between"><span>Sampled regimes</span><span>{coverage.sampled}</span></div>
            <div className="flex justify-between"><span>Converged</span><span>{coverage.converged}</span></div>
            <div className="flex justify-between"><span>Regime coverage</span><span>{(coverage.coverageRatio * 100).toFixed(1)}%</span></div>
            <div className="flex justify-between"><span>Convergence status</span><span>{(coverage.convergenceRatio * 100).toFixed(1)}%</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
