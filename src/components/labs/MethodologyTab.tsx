const block = "rounded-lg border border-border bg-card p-4 space-y-3";

const MethodologyTab = () => {
  return (
    <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
      <section id="method-overview" className={block}>
        <h2 className="text-base font-semibold text-foreground">Discover Lab Methodology: full system map</h2>
        <p>
          Discover Lab is a live evolutionary search system over AMM designs. Every generation evaluates a population of candidate invariants,
          computes stability and execution metrics, archives outcomes, and projects them into atlas visualizations for iterative steering.
        </p>
        <pre className="text-xs bg-secondary/60 rounded-md p-3 overflow-x-auto text-foreground">
{`┌────────────┐   mutate/select   ┌─────────────┐   evaluate   ┌───────────────┐
│ population │ ─────────────────▶ │ generation  │ ───────────▶ │ candidate set │
└────────────┘                    └─────────────┘              └──────┬────────┘
                                                                         │
                                 archive + sync + map + diagnostics ◀────┘`}
        </pre>
      </section>

      <section id="method-objective-math" className={block}>
        <h3 className="text-base font-semibold text-foreground">Objective composition and scoring</h3>
        <p>
          Candidate ranking combines LP value retention, slippage, leakage, drawdown, and stability. Objective-specific ranking in experiments is:
        </p>
        <pre className="text-xs bg-secondary/60 rounded-md p-3 overflow-x-auto text-foreground">
{`LP objective:       score = 1 / max(lpValueVsHodl, 1e-6) + 0.2 * stability
Slippage objective: score = 10 * totalSlippage + 0.02 * arbLeakage + 0.1 * stability
Balanced objective: score = candidate.score (engine-native aggregate)
Pareto front:       keep candidates not dominated on {lpValueVsHodl↑, slippage↓, drawdown↓}`}
        </pre>
      </section>

      <section id="method-engine-functions" className={block}>
        <h3 className="text-base font-semibold text-foreground">Core engine functions (microstructure)</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><code>createInitialState()</code>: seeds regime populations and initializes global archive.</li>
          <li><code>runGeneration(population, regime)</code>: performs selection, mutation, metric recomputation, and best-candidate update.</li>
          <li><code>paretoFront(candidates)</code>: filters non-dominated designs for multi-objective tracking.</li>
          <li><code>binDispersion(candidate)</code>: computes liquidity allocation spread, proxying concentration risk.</li>
          <li><code>scoreForObjective(candidate, objective)</code>: switches objective lens without changing simulation physics.</li>
          <li><code>ingestExperimentCandidates()</code>: appends externally generated candidates into atlas memory and persistence streams.</li>
        </ul>
      </section>

      <section id="method-sync" className={block}>
        <h3 className="text-base font-semibold text-foreground">State, role, and persistence pipeline</h3>
        <p>
          The lab supports three data modes: <strong>LIVE SYNC</strong> (cloud stream), <strong>PERSISTENT</strong> (local IndexedDB), and
          <strong> LOCAL</strong> (memory only). Role-aware sync avoids authority conflicts while preserving responsiveness.
        </p>
        <pre className="text-xs bg-secondary/60 rounded-md p-3 overflow-x-auto text-foreground">
{`syncMode = live | persisted | memory | loading
togglePersistence(): persisted ↔ memory (if supported)
archiveSize: uses backend count when available, local archive.length otherwise`}
        </pre>
      </section>

      <section id="method-dashboard" className={block}>
        <h3 className="text-base font-semibold text-foreground">Live Dashboard</h3>
        <p>
          Dashboard cards read directly from current engine state: latest champions, trajectory deltas, stability dispersion, and throughput.
          Generation rate uses short-window EMA-style averaging from generation tick timestamps.
        </p>
      </section>

      <section id="method-atlas" className={block}>
        <h3 className="text-base font-semibold text-foreground">Atlas Map & filters</h3>
        <p>
          Atlas projection allows slicing by contributor, experiment, objective type, regime, source, and pool layer.
          Filtering is conjunctive; every active filter must match for a candidate to render.
        </p>
      </section>

      <section id="method-directory" className={block}>
        <h3 className="text-base font-semibold text-foreground">Family Directory</h3>
        <p>
          Directory clusters discovered invariants into structural families so users can compare behavior within shared topology classes.
        </p>
      </section>

      <section id="method-studio-loop" className={block}>
        <h3 className="text-base font-semibold text-foreground">Studio Loop</h3>
        <p>
          Studio candidates are normalized and injected as <code>source=user-designed</code>, then evaluated in the same atlas language as discovered designs.
        </p>
      </section>

      <section id="method-observatory" className={block}>
        <h3 className="text-base font-semibold text-foreground">Geometry Observatory</h3>
        <p>
          Observatory examines local curvature and phase transitions of invariant surfaces. Outputs feed back into candidate diagnostics.
        </p>
      </section>

      <section id="method-experiments" className={block}>
        <h3 className="text-base font-semibold text-foreground">Experiments orchestration</h3>
        <p>
          Every experiment executes iterative generation loops until configured horizon, writing telemetry each step:
          champion score, Pareto size, convergence rate, dispersion, fragility, and robustness.
        </p>
        <pre className="text-xs bg-secondary/60 rounded-md p-3 overflow-x-auto text-foreground">
{`for generation in 1..N:
  newPopulation, newCandidates = runGeneration(population, regime)
  champion = argmin(scoreForObjective(candidate))
  pareto = paretoFront(population.candidates)
  metrics = { convergence, dispersion, fragility, robustness }
  ingestExperimentCandidates(tag(newCandidates))`}
        </pre>
      </section>

      <section id="method-detail" className={block}>
        <h3 className="text-base font-semibold text-foreground">Design Detail view</h3>
        <p>
          Detail view is the forensic lens for one candidate: parameterization, liquidity bins, metric decomposition,
          and source lineage (global, experiment, or studio).
        </p>
      </section>
    </div>
  );
};

export default MethodologyTab;
