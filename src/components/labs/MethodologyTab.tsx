import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { type Candidate } from "@/lib/discovery-engine";

const block = "rounded-lg border border-border bg-card p-4 md:p-5";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 as const },
  transition: { duration: 0.35 },
};

type MethodologyTabProps = {
  archive: Candidate[];
  onSelectCandidate: (id: string) => void;
};

const MethodologyTab = ({ archive, onSelectCandidate }: MethodologyTabProps) => {
  const uniqueFamilies = new Set(archive.map((candidate) => candidate.familyId)).size;
  const uniqueRegimes = new Set(archive.map((candidate) => candidate.regime)).size;
  const uniqueContributors = new Set(archive.map((candidate) => candidate.contributor).filter(Boolean)).size;
  const bestLpCandidate =
    archive.length > 0
      ? archive.reduce((best, current) =>
          current.metrics.lpValueVsHodl > best.metrics.lpValueVsHodl ? current : best,
        )
      : null;
  const bestSlippageCandidate =
    archive.length > 0
      ? archive.reduce((best, current) =>
          current.metrics.totalSlippage < best.metrics.totalSlippage ? current : best,
        )
      : null;
  const leaderboard = [...archive]
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);

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
P_{t+1} = M(S(P_t), R)                        # select + mutate by regime R
C_{t+1} = E(P_{t+1})                            # evaluate all candidates
A_{t+1} = A_t U C_{t+1}                          # append to archive
c_hat_{t+1} = arg min_{c in C_{t+1}} J(c)         # objective-specific champion`}
        </motion.pre>
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Outcomes dashboard</h3>
        <p className="mt-2">A live summary of what Discover Lab has achieved so far across the global archive.</p>
        <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-md border border-border p-3 bg-background/40">
            <p className="text-xs uppercase tracking-wide">Discovered AMMs</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{archive.length.toLocaleString()}</p>
          </div>
          <div className="rounded-md border border-border p-3 bg-background/40">
            <p className="text-xs uppercase tracking-wide">Families explored</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{uniqueFamilies}</p>
          </div>
          <div className="rounded-md border border-border p-3 bg-background/40">
            <p className="text-xs uppercase tracking-wide">Market regimes covered</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{uniqueRegimes}</p>
          </div>
          <div className="rounded-md border border-border p-3 bg-background/40">
            <p className="text-xs uppercase tracking-wide">Active contributors</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{uniqueContributors}</p>
          </div>
        </div>
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <div className="rounded-md border border-border p-3 bg-secondary/30">
            <p className="font-medium text-foreground">Best LP vs HODL</p>
            {bestLpCandidate ? (
              <button
                onClick={() => onSelectCandidate(bestLpCandidate.id)}
                className="mt-1 text-left text-xs text-primary hover:underline"
              >
                {bestLpCandidate.id} · {bestLpCandidate.metrics.lpValueVsHodl.toFixed(4)}
              </button>
            ) : (
              <p className="mt-1 text-xs">No candidates available yet.</p>
            )}
          </div>
          <div className="rounded-md border border-border p-3 bg-secondary/30">
            <p className="font-medium text-foreground">Lowest total slippage</p>
            {bestSlippageCandidate ? (
              <button
                onClick={() => onSelectCandidate(bestSlippageCandidate.id)}
                className="mt-1 text-left text-xs text-primary hover:underline"
              >
                {bestSlippageCandidate.id} · {bestSlippageCandidate.metrics.totalSlippage.toFixed(6)}
              </button>
            ) : (
              <p className="mt-1 text-xs">No candidates available yet.</p>
            )}
          </div>
        </div>
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Top 10 discovered AMMs leaderboard</h3>
        <p className="mt-2">Ranked by composite score (lower is better). Click any candidate to inspect full design detail.</p>
        <div className="mt-3 rounded-md border border-border overflow-hidden">
          <div className="grid grid-cols-[56px_1fr_120px_120px_120px] gap-2 px-3 py-2 text-xs font-medium bg-secondary/40 text-foreground">
            <span>Rank</span>
            <span>Candidate</span>
            <span>Score</span>
            <span>LP/HODL</span>
            <span>Slippage</span>
          </div>
          {leaderboard.map((candidate, index) => (
            <div
              key={candidate.id}
              className="grid grid-cols-[56px_1fr_120px_120px_120px] gap-2 px-3 py-2 text-xs border-t border-border/60"
            >
              <span className="text-foreground font-medium">#{index + 1}</span>
              <button onClick={() => onSelectCandidate(candidate.id)} className="text-left text-primary hover:underline">
                {candidate.id}
              </button>
              <span>{candidate.score.toFixed(4)}</span>
              <span>{candidate.metrics.lpValueVsHodl.toFixed(4)}</span>
              <span>{candidate.metrics.totalSlippage.toFixed(6)}</span>
            </div>
          ))}
          {leaderboard.length === 0 && <p className="px-3 py-4 text-xs">No discovered AMMs yet.</p>}
        </div>
        <p className="mt-2 text-xs">
          Need deeper comparisons? Visit the <Link to="/labs/discover" className="text-primary hover:underline">Discover Atlas</Link> map and
          open Design Detail for any leaderboard entry.
        </p>
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
