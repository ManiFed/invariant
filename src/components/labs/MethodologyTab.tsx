import { motion } from "framer-motion";
import { type Candidate } from "@/lib/discovery-engine";
import {
  NUM_BINS,
  LOG_PRICE_MIN,
  LOG_PRICE_MAX,
  BIN_WIDTH,
  TOTAL_LIQUIDITY,
  FEE_RATE,
  ARB_THRESHOLD,
  DT,
  FAST_PATH_STEPS,
  MAX_TRAIN_PATHS_PER_EVAL,
  MAX_EVAL_PATHS_PER_EVAL,
  POPULATION_SIZE,
  ELITE_FRACTION,
  EXPLORATION_RATE,
} from "@/lib/discovery-engine";

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

function EquationBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-md border border-border p-3 bg-background/40">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <pre className="mt-2 text-[11px] bg-secondary/60 rounded-md p-3 overflow-x-auto text-foreground">{code}</pre>
    </div>
  );
}

const MethodologyTab = ({ archive, onSelectCandidate }: MethodologyTabProps) => {
  const leaderboard = [...archive].sort((a, b) => a.score - b.score).slice(0, 10);
  const bestLpCandidate = archive.length > 0
    ? archive.reduce((best, current) => (current.metrics.lpValueVsHodl > best.metrics.lpValueVsHodl ? current : best))
    : null;

  return (
    <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
      <motion.section {...fadeUp} className={block}>
        <h2 className="text-base md:text-lg font-semibold text-foreground">Discovery Atlas methodology (code-exact)</h2>
        <p className="mt-2">
          This tab documents the exact equations currently used by the Discovery Atlas codepaths in
          `discovery-engine.ts` and `DiscoveryAtlas.tsx`.
        </p>
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Core constants</h3>
        <EquationBlock
          title="Engine constants"
          code={`NUM_BINS = ${NUM_BINS}
LOG_PRICE_MIN = ${LOG_PRICE_MIN}
LOG_PRICE_MAX = ${LOG_PRICE_MAX}
BIN_WIDTH = (LOG_PRICE_MAX - LOG_PRICE_MIN) / NUM_BINS = ${BIN_WIDTH.toFixed(6)}
TOTAL_LIQUIDITY = ${TOTAL_LIQUIDITY}
FEE_RATE = ${FEE_RATE}
ARB_THRESHOLD = ${ARB_THRESHOLD}
FAST_PATH_STEPS = ${FAST_PATH_STEPS}
DT = ${DT}
MAX_TRAIN_PATHS_PER_EVAL = ${MAX_TRAIN_PATHS_PER_EVAL}
MAX_EVAL_PATHS_PER_EVAL = ${MAX_EVAL_PATHS_PER_EVAL}
POPULATION_SIZE = ${POPULATION_SIZE}
ELITE_FRACTION = ${ELITE_FRACTION}
EXPLORATION_RATE = ${EXPLORATION_RATE}`}
        />
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Simulation equations</h3>
        <div className="space-y-3 mt-3">
          <EquationBlock
            title="Price process per step"
            code={`x_t = x_{t-1} + diffusion_t + jump_t + reversion_t
diffusion_t = (mu - 0.5*sigma^2)*dt + sigma*sqrt(dt)*Z_t
jump_t = (jumpMean + jumpStd*Z'_t) if U_t < jumpIntensity*dt else 0
reversion_t = meanReversion*(anchor - x_{t-1})*dt

regime-shift special case:
  shiftPoint ~ Uniform[0.3, 0.7] * steps
  before shift: sigma=0.3, jumpIntensity=0
  at/after shift: sigma=1.0, jumpIntensity=5, jumpMean=-0.05, jumpStd=0.15`}
          />
          <EquationBlock
            title="Trade, impact, arbitrage, LP value"
            code={`tradeSize = TOTAL_LIQUIDITY * 0.01 * exp(randn()*0.5 - 1)
fee = tradeSize * FEE_RATE
effectiveSize = tradeSize - fee

priceImpact start bin:
  startBin = clamp(floor((clamp(refLogPrice)-LOG_PRICE_MIN)/BIN_WIDTH), 0, NUM_BINS-1)

buy ideal output  = |tradeSize| / exp(refLogPrice)
sell ideal output = |tradeSize| * exp(refLogPrice)
slippage = min(1, |1 - output/idealOutput|)

if |ammLogPrice - externalLogPrice| >= ARB_THRESHOLD:
  arbSize = deviation * TOTAL_LIQUIDITY * 0.1
  arbFee  = arbSize * FEE_RATE
  arbProfit = arbSize*deviation - arbFee
  if arbProfit > 0:
    arbLeakage += arbProfit
    totalFees += arbFee
    ammLogPrice += (externalLogPrice - ammLogPrice) * clamp(arbResponsiveness, 0.05, 1)

deriveReserves(bins, p):
  bins fully below p -> reserveY
  bins fully above p -> reserveX
  crossing bin split linearly by fraction

LP_value_t = reserveX_t * exp(externalLogPrice_t) + reserveY_t + totalFees_t`}
          />
          <EquationBlock
            title="Per-path metrics"
            code={`avgSlippage = totalSlippage / tradeCount
utilization = activeLiquidity / TOTAL_LIQUIDITY
  where active bins satisfy center in [min(path)-BIN_WIDTH, max(path)+BIN_WIDTH]

HODL_t = TOTAL_LIQUIDITY * 0.5 * (exp(path_t) + 1)
lpValueVsHodl = finalLP / finalHODL

drawdown_t = (peakLP_t - LP_t) / peakLP_t
maxDrawdown = max_t(drawdown_t)

ret_t = LP_t / LP_{t-1} - 1
volatilityOfReturns = sqrt(mean((ret_t - mean(ret))^2))`}
          />
        </div>
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Evaluation aggregation</h3>
        <EquationBlock
          title="evaluateCandidate"
          code={`effectiveTrain = clamp(numTrainPaths, 1, ${MAX_TRAIN_PATHS_PER_EVAL})
effectiveEval  = clamp(numEvalPaths,  1, ${MAX_EVAL_PATHS_PER_EVAL})

metrics = mean over eval paths only
stability = sqrt( variance( lpValueVsHodl over train+eval paths ) )

equityCurve:
  one extra path, normalized as LP_t / TOTAL_LIQUIDITY`}
        />
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Feature equations</h3>
        <EquationBlock
          title="computeFeatures(bins)"
          code={`norm_i = bins_i / sum_j bins_j

curvature = sum_{i=1..n-2} (norm_{i-1} - 2*norm_i + norm_{i+1})^2
curvatureGradient = sum abs(localCurv_i - localCurv_{i-1})
entropy = -sum_i norm_i * log2(norm_i), for norm_i > 1e-15

symmetry = corr( left half of norm, reversed right half of norm )
tailDensityRatio = mass(outer 25%) / mass(center 50%)
peakConcentration = max(norm) / (1/n)

center = (n-1)/2
concentrationWidth = sqrt( sum_i norm_i * (i-center)^2 ) / n`}
        />
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Normalization and composite score</h3>
        <EquationBlock
          title="normalizeMetrics(metrics, stability)"
          code={`fees         = min(totalFees / 50, 1)
utilization  = liquidityUtilization
lpValue      = min(lpValueVsHodl, 1.2) / 1.2
lowSlippage  = max(0, 1 - totalSlippage * 10)
lowArbLeak   = max(0, 1 - arbLeakage / 50)
stabilityN   = max(0, 1 - stability * 5)
lowDrawdown  = max(0, 1 - maxDrawdown * 5)`}
        />
        <div className="mt-3">
          <EquationBlock
            title="scoreCandidate(metrics, stability)  // lower is better"
            code={`axisValues = values(normalizeMetrics)
axisMean = mean(axisValues)
weakestAxis = min(axisValues)
strongestAxis = max(axisValues)

spiderCoverage = geometricMean(max(v, 0.02)) over axisValues
axisImbalance = sqrt(mean((v - axisMean)^2))
specialistEdge = max(0, strongestAxis - axisMean)

score =
  -1.6 * totalFees
  +1.0 * totalSlippage
  +1.3 * arbLeakage
  -2.2 * liquidityUtilization
  -4.2 * (lpValueVsHodl - 1)
  +1.9 * maxDrawdown
  +0.9 * volatilityOfReturns
  +1.6 * stability
  -6.5 * spiderCoverage
  +5.5 * (1 - weakestAxis)
  +3.0 * axisImbalance
  -1.4 * specialistEdge`}
          />
        </div>
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Generation update equations</h3>
        <EquationBlock
          title="runGeneration(population, regime)"
          code={`gen = population.generation + 1
if population empty:
  attempt POPULATION_SIZE random candidates
  keep only candidates passing validateInvariantFamily
else:
  elites = best floor(POPULATION_SIZE * ELITE_FRACTION)
  if elites empty: bootstrap random candidates

  championCoverage = spiderCoverage(population.champion)
  adaptiveExplorationRate =
    clamp(EXPLORATION_RATE + (0.58 - championCoverage) * 0.35, 0.14, 0.42)

  numChildren = POPULATION_SIZE - floor(POPULATION_SIZE * adaptiveExplorationRate)
  numExplore = POPULATION_SIZE - numChildren

  children: family mutation + optional guidance blend/remediation/amplification
  exploratory: random family samples
  keep only candidates passing validateInvariantFamily

newPopulation = best POPULATION_SIZE by score
metricChampions = per-metric best across current candidate pool
archive candidates selected every ARCHIVE_ROUND_INTERVAL generations`}
        />
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Experiment objective lenses</h3>
        <EquationBlock
          title="DiscoveryAtlas objective scorers"
          code={`m = candidate.metrics

J_lp_value(candidate) =
  1 / max(m.lpValueVsHodl, 1e-6) + 0.2 * candidate.stability

J_slippage(candidate) =
  10 * m.totalSlippage + 0.02 * m.arbLeakage + 0.1 * candidate.stability

J_balanced(candidate) = candidate.score

Pareto dominance (o dominates c) iff:
  o.lpValueVsHodl >= c.lpValueVsHodl
  o.totalSlippage <= c.totalSlippage
  o.maxDrawdown <= c.maxDrawdown
  and one inequality is strict.`}
        />
        <div className="mt-3">
          <EquationBlock
            title="Experiment telemetry in DiscoveryAtlas"
            code={`convergenceRate = round(prevBest - bestScore, 4)

parameterDispersion =
  sqrt( (1/n) * sum_i (bin_i - meanBins)^2 )

performanceVariance = stability^2

structuralFragility =
  round( min(1, stability * 5) * (1 + topologyMutationProbability), 4 )

robustnessScore =
  round(
    max(0, 1 - min(1, stability * 5))
    * (1 - 0.2 * mutationStrength)
    * stressPenalty,
    4
  )

stressPenalty = 0.9 if stressMode = "adversarial", else 1`}
          />
        </div>
      </motion.section>

      <motion.section {...fadeUp} className={block}>
        <h3 className="text-base font-semibold text-foreground">Live leaderboard</h3>
        <p className="mt-2 text-xs">Top 10 by composite score (lower is better).</p>
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
        {bestLpCandidate && (
          <p className="mt-2 text-xs">
            Best LP/HODL currently:{" "}
            <button onClick={() => onSelectCandidate(bestLpCandidate.id)} className="text-primary hover:underline">
              {bestLpCandidate.id} ({bestLpCandidate.metrics.lpValueVsHodl.toFixed(4)})
            </button>
          </p>
        )}
      </motion.section>
    </div>
  );
};

export default MethodologyTab;
