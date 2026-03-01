import { Target, BrainCircuit, Network, Sparkles } from "lucide-react";

export default function GoalsTab() {
  return (
    <div className="space-y-4">
      <section className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-chart-3" />
          <h3 className="text-sm font-semibold text-foreground">Ultimate Goal</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Discovery Lab is searching for an <span className="text-foreground font-medium">optimal AMM design manifold</span>: one AMM family
          that effectively behaves like a unified market maker across the entire spider graph, instead of excelling on only one or two axes.
          The target is broad, resilient performance under changing regimes with minimal slippage, low leakage, and strong LP outcomes.
        </p>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <div className="surface-elevated rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Network className="w-3.5 h-3.5 text-chart-1" />
            <p className="text-xs font-semibold text-foreground">Spider Graph Coverage</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Every axis should rise together. A strong candidate is not just "best at fees" or "best at stability" — it should fill most of
            the spider graph at once.
          </p>
        </div>

        <div className="surface-elevated rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <BrainCircuit className="w-3.5 h-3.5 text-chart-2" />
            <p className="text-xs font-semibold text-foreground">Learning Loop</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The map now learns from past successful AMMs and estimates where new high-coverage designs are most likely to emerge.
            It continuously updates a success zone and axis improvement suggestions.
          </p>
        </div>

        <div className="surface-elevated rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-chart-4" />
            <p className="text-xs font-semibold text-foreground">End State</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            A mechanism that appears as one coherent AMM "surface" spanning market regimes, maintaining robust liquidity behavior without
            fragmenting into many narrowly specialized designs.
          </p>
        </div>
      </section>
    </div>
  );
}
