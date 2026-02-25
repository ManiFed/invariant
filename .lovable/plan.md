

# Discovery Atlas: New Features and Optimization Ideas

## Part 1: New Features

### 1. Pareto Frontier Visualizer
Add an interactive Pareto frontier chart to the Live Dashboard showing the trade-off surface between competing objectives (e.g., Fees vs. IL, Utilization vs. Drawdown). Users can click any point on the frontier to inspect that candidate. This makes multi-objective optimization tangible -- instead of a single opaque score, users see *why* certain designs dominate others.

**Implementation:**
- New component `src/components/labs/ParetoFrontier.tsx`
- Scatter plot (recharts) with selectable X/Y axis metrics from the 7-metric vector
- Highlight dominated vs. non-dominated candidates with color coding
- Click-to-select wired into existing `selectCandidate`

### 2. Custom Invariant Family Designer
Let users define their own invariant family by drawing a liquidity curve shape (click-to-place control points on a canvas), then inject it into the evolution engine as a 4th family. The engine will mutate the control point positions during evolution, discovering optimized versions of the user's idea.

**Implementation:**
- New component `src/components/labs/CustomFamilyDesigner.tsx`
- Spline interpolation from control points to 64-bin density
- Register as a new entry in `INVARIANT_FAMILIES` dynamically
- Persist custom families in sessionStorage

### 3. Regime Transition Stress Test
Add a new regime type that *switches* between low-vol and high-vol mid-path (simulating real market regime changes). This tests how robust a candidate is when conditions shift suddenly -- a critical real-world concern that the current static regimes miss.

**Implementation:**
- Add `"regime-shift"` to `RegimeId` and `REGIMES` in discovery-engine
- `generatePricePath` detects regime-shift and swaps volatility/jump params at a random midpoint
- New column in results tables showing regime-shift resilience score

### 4. Head-to-Head Arena
A dedicated view where users pick 2 candidates from the archive and watch them compete in real-time on the same price path. An animated chart shows both LP values diverging step-by-step, with commentary on why one wins at each moment.

**Implementation:**
- New component `src/components/labs/ArenaView.tsx`
- Runs `simulatePath` on both candidates with the same seeded price path
- Animated recharts line chart with play/pause controls
- Side panel showing per-step metric deltas

### 5. Evolution Replay / Time Travel
Record the champion history per regime across generations. Users can scrub a timeline slider to see how the best design evolved over time -- watching the liquidity shape morph from random noise into an optimized distribution.

**Implementation:**
- Store champion snapshots (bins + score + generation) in a ring buffer (last 500)
- New `src/components/labs/EvolutionReplay.tsx` with a slider + animated bin visualization
- Shows score trajectory chart alongside the morphing shape

---

## Part 2: Latency Optimizations

### 1. Web Worker for Engine Tick
The discovery engine currently runs `evaluateCandidate` on the main thread (each call runs 4-8 Monte Carlo paths with 96 steps each). Moving this to a Web Worker eliminates UI jank entirely.

**Implementation:**
- New `src/workers/discovery-worker.ts` using `postMessage` API
- `useDiscoveryEngine` sends tick requests to the worker, receives state updates back
- Main thread only handles rendering -- zero simulation compute

### 2. Batch Evaluation with Typed Arrays
Currently each candidate evaluation allocates multiple `Float64Array` paths independently. Batch all candidates in a generation into a single pre-allocated buffer, reducing GC pressure and improving cache locality.

**Implementation:**
- Pre-allocate a shared `Float64Array` buffer for all paths in a generation
- Reuse path buffers across evaluations with index offsets
- Estimated 30-40% reduction in GC pauses

### 3. Reduce Path Length for Early Rejection
Most bad candidates are identifiable within the first 30 steps. Add a two-phase evaluation: run a short 32-step "screening" path first, and only promote candidates that pass a minimum threshold to the full 96-step evaluation.

**Implementation:**
- New `screenCandidate` function: 1 path, 32 steps, check if score is within 2x of current champion
- Only ~25% of candidates proceed to full `evaluateCandidate`
- 3-4x speedup in generations per second

### 4. Edge Function: Parallel Regime Evaluation
The cron job currently runs one regime per invocation. Run all 3 regimes in parallel using `Promise.all`, tripling throughput per cron tick.

**Implementation:**
- Refactor `atlas-engine` generate action to accept `regime: "all"`
- Use `Promise.all([evaluateRegime("low-vol"), evaluateRegime("high-vol"), evaluateRegime("jump-diffusion")])`

---

## Part 3: ML/Algorithm Improvements

### 1. CMA-ES (Covariance Matrix Adaptation)
Replace the naive "mutate random bins" approach with CMA-ES, a state-of-the-art derivative-free optimizer. CMA-ES learns the correlation structure between bins and adapts its mutation distribution, converging much faster on complex fitness landscapes.

**Implementation:**
- New `src/lib/cma-es.ts` implementing the (mu/mu_w, lambda)-CMA-ES algorithm
- Maintains a covariance matrix C and step-size sigma per regime population
- Replace `mutateBins` calls in `runGeneration` with CMA-ES sampling
- Expected 5-10x faster convergence to local optima

### 2. Surrogate Model (Bayesian Optimization)
Training a lightweight surrogate model (Gaussian Process or random forest) on the (params -> score) mapping accumulated in the archive. Use it to predict promising regions of parameter space before running expensive Monte Carlo evaluations.

**Implementation:**
- New `src/lib/surrogate-model.ts` with a simple RBF kernel GP
- Every 50 generations, fit the surrogate on the archive
- Use Expected Improvement (EI) acquisition function to propose 30% of new candidates
- Remaining 70% from standard mutation (keeps diversity)

### 3. Novelty Search + Quality-Diversity (MAP-Elites)
The current algorithm converges toward a single optimum per regime. MAP-Elites maintains a grid of *diverse* high-quality solutions indexed by behavioral features (e.g., entropy x symmetry). This discovers fundamentally different AMM designs rather than minor variations of one winner.

**Implementation:**
- New `src/lib/map-elites.ts`
- 2D grid indexed by (entropy, peakConcentration) from `FeatureDescriptor`
- Each cell stores the best-scoring candidate with those features
- Mutation draws parents from occupied cells, preferring under-explored regions
- The coverage grid in `GeometryObservatory` already visualizes this -- wire it to real MAP-Elites data

### 4. Crossover Operator
Currently only mutation is used. Add a crossover operator that blends bins from two elite parents, enabling the algorithm to combine good features from different families (e.g., the center mass of a "piecewise-bands" parent with the tail structure of a "tail-shielded" parent).

**Implementation:**
- `crossoverBins(parentA, parentB)`: uniform crossover per-bin with 50% probability, then normalize
- `crossoverParams`: blend family parameters when parents share the same family
- Use crossover for 30% of children, mutation for the rest

### 5. Adaptive Mutation Rate
Instead of a fixed `EXPLORATION_RATE = 0.15`, adapt it based on population diversity. When the population converges (low entropy across candidate scores), increase exploration. When diversity is high, focus on exploitation.

**Implementation:**
- Compute score entropy each generation
- `dynamicExplorationRate = 0.05 + 0.25 * (1 - normalizedEntropy)`
- Log rate changes as `exploration-spike` activity events (already supported)

---

## Suggested Implementation Priority

| Priority | Item | Impact |
|----------|------|--------|
| 1 | Web Worker for engine tick | Eliminates UI jank immediately |
| 2 | Early rejection screening | 3-4x generation throughput |
| 3 | CMA-ES optimizer | 5-10x faster convergence |
| 4 | Crossover operator | Better exploration, easy to add |
| 5 | Pareto Frontier Visualizer | High user value, moderate effort |
| 6 | MAP-Elites | Discovers diverse designs |
| 7 | Head-to-Head Arena | Fun, engaging feature |
| 8 | Surrogate model | Advanced but highest long-term impact |

