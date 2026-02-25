import { motion } from "framer-motion";

const block = "rounded-lg border border-border bg-card p-4 md:p-5";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 as const },
  transition: { duration: 0.35 },
};

const MethodologyTab = () => {
  return (
    <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
      <motion.section {...fadeUp} className={block}>
        <h2 className="text-base md:text-lg font-semibold text-foreground">Discover Lab methodology — full mechanism</h2>
        <p className="mt-2">
          Discover Lab runs an evolutionary optimization loop over AMM designs. Each generation mutates a regime-conditioned population,
          re-simulates outcomes, re-ranks candidates, updates Pareto structure, and streams results into the atlas archive.
        </p>
        <motion.pre
          animate={{ opacity: [0.75, 1, 0.75] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="mt-3 text-xs bg-secondary/60 rounded-md p-3 overflow-x-auto text-foreground"
        >
{`x_t = state at generation t
P_{t+1} = \mathcal{M}(\mathcal{S}(P_t), R)          # select + mutate by regime R
C_{t+1} = \mathcal{E}(P_{t+1})                      # evaluate all candidates
A_{t+1} = A_t \cup C_{t+1}                          # append to archive
\hat c_{t+1} = arg min_{c \in C_{t+1}} J(c)         # objective-specific champion`}
        </motion.pre>
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Precise objective equations</h3>
        <p className="mt-2">The experiment runner applies objective-specific score functions directly from the orchestrator logic:</p>
        <pre className="mt-3 text-xs bg-secondary/60 rounded-md p-3 overflow-x-auto text-foreground">
{`m = candidate.metrics

J_lp(c) = 1 / max(m.lpValueVsHodl, 10^{-6}) + 0.2 * c.stability
J_slip(c) = 10 * m.totalSlippage + 0.02 * m.arbLeakage + 0.1 * c.stability
J_balanced(c) = c.score

Pareto dominance (o dominates c) iff:
  o.lpValueVsHodl >= c.lpValueVsHodl
  o.totalSlippage <= c.totalSlippage
  o.maxDrawdown <= c.maxDrawdown
  and at least one inequality is strict.`}
        </pre>
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Experiment telemetry equations</h3>
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <motion.div whileHover={{ scale: 1.01 }} className="rounded-md border border-border p-3 bg-background/40">
            <p className="font-medium text-foreground">Convergence</p>
            <code className="text-xs">convergenceRate_t = round(prevBest - bestScore_t, 4)</code>
          </motion.div>
          <motion.div whileHover={{ scale: 1.01 }} className="rounded-md border border-border p-3 bg-background/40">
            <p className="font-medium text-foreground">Dispersion</p>
            <code className="text-xs">σ_bins = sqrt((1/n) Σ_i (b_i - μ)^2), μ = (1/n) Σ_i b_i</code>
          </motion.div>
          <motion.div whileHover={{ scale: 1.01 }} className="rounded-md border border-border p-3 bg-background/40">
            <p className="font-medium text-foreground">Structural fragility</p>
            <code className="text-xs">fragility = round(max(0, 1 - stability) * (1 + topologyMutationProbability), 4)</code>
          </motion.div>
          <motion.div whileHover={{ scale: 1.01 }} className="rounded-md border border-border p-3 bg-background/40">
            <p className="font-medium text-foreground">Robustness</p>
            <code className="text-xs">robustness = round(stability * (1 - 0.2*mutationStrength) * stressPenalty, 4)</code>
          </motion.div>
        </div>
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Execution pipeline (animated loop)</h3>
        <motion.div
          className="mt-3 rounded-md border border-border p-3 bg-secondary/40 text-xs font-mono text-foreground overflow-x-auto"
          animate={{ boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 0 0 2px rgba(120,120,255,0.25)", "0 0 0 rgba(0,0,0,0)"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
{`for generation = 1..N:
  (population', candidates') = runGeneration(population, regime)
  ranked = sort(candidates', by=J_objective)
  champion = ranked[0]
  front = paretoFront(candidates')
  updateExperimentTelemetry(champion, front)
  ingestExperimentCandidates(tag(candidates', source="experiment"))
  population = population'`}
        </motion.div>
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Subsystem roles</h3>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li><code>createInitialState()</code> initializes regime populations and baseline archive state.</li>
          <li><code>runGeneration(population, regimeConfig)</code> is the core transition function from generation t to t+1.</li>
          <li><code>scoreForObjective(candidate, objective)</code> is the objective lens used for experiment ranking.</li>
          <li><code>paretoFront(candidates)</code> computes non-dominated surfaces under LP/slippage/drawdown criteria.</li>
          <li><code>ingestExperimentCandidates()</code> persists tagged candidates into global atlas memory/sync layers.</li>
        </ul>
      </motion.section>
    </div>
  );
};

export default MethodologyTab;
