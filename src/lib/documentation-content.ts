export interface DocSubsection {
  id: string;
  title: string;
  content: string;
}

export interface DocSection {
  id: string;
  title: string;
  subsections: DocSubsection[];
}

export const documentationSections: DocSection[] = [
  {
    id: "about",
    title: "About Invariant Studio",
    subsections: [
      {
        id: "about-who",
        title: "Who Is It For?",
        content: `**Invariant Studio** is an open educational platform for designing, simulating, and stress-testing automated market maker (AMM) mechanisms.

- **Students & Researchers** — Learn AMM mechanics through interactive simulations with guided courses and design challenges
- **DeFi Developers** — Prototype and test custom invariant functions, compile to Solidity, and export deployment artifacts
- **Liquidity Providers** — Understand impermanent loss, fee dynamics, and capital efficiency before committing capital
- **Protocol Designers** — Explore novel bonding curve shapes with real-time risk analytics and evolutionary discovery`,
      },
      {
        id: "about-architecture",
        title: "Platform Architecture",
        content: `Invariant Studio runs entirely in-browser — no backend dependency for simulations. All computations (GBM price paths, IL calculations, curve evaluation, evolutionary search) are performed client-side using Web Workers for heavy tasks.

The AI assistant connects to a backend function for natural language Q&A about AMM concepts. The AMM Library uses a cloud database for persistent storage and community sharing.

**Key technologies:** React, TypeScript, Tailwind CSS, Framer Motion, Recharts, Web Workers.`,
      },
      {
        id: "about-philosophy",
        title: "Philosophy",
        content: `We believe the best way to learn finance is to break things in a sandbox. Every chart is interactive, every parameter is adjustable, and every formula is visible. There are no black boxes.

The platform follows a progressive disclosure model: start with templates and guided courses, advance to custom invariants and Monte Carlo engines, then explore evolutionary discovery and visual block coding.`,
      },
    ],
  },
  {
    id: "getting-started",
    title: "Getting Started",
    subsections: [
      {
        id: "gs-navigation",
        title: "Homepage Navigation",
        content: `The homepage presents a navigation grid with the following entry points:

1. **Teaching Lab** — Guided courses, interactive simulations, and design challenges (recommended starting point)
2. **Beginner Mode** — Template-based experimentation with visual risk dashboards
3. **Advanced Mode** — Full invariant editor, Monte Carlo, arbitrage engine, MEV analyzer, and stability analysis
4. **Design Studio** — Visual block coding, multi-asset invariants, time-variance, and Solidity compiler
5. **Labs** — Experimental features: Invariant Atlas, Strategy Lab, DNA Visualizer, Market Replay
6. **AMM Library** — Browse and share community-made AMM designs
7. **Documentation** — This page`,
      },
      {
        id: "gs-learning-path",
        title: "Choosing Your Path",
        content: `**New to AMMs?** Start with the Teaching Lab. It offers three course levels (Beginner, Intermediate, Advanced) with interactive simulations that unlock as you progress. Complete challenges to test your understanding.

**Know the basics?** Jump to Beginner Mode to experiment with four AMM templates (Constant Product, Stable Swap, Weighted, Concentrated) and see how parameter changes affect risk metrics in real-time.

**Ready to build?** Advanced Mode gives you full control: write custom invariant expressions, run Monte Carlo simulations, analyze arbitrage flows, and export to Solidity.

**Want to design visually?** The Design Studio lets you compose invariant curves from drag-and-drop blocks, design multi-asset pools, create time-varying curves, and compile to smart contracts.`,
      },
      {
        id: "gs-ai-assistant",
        title: "AI Assistant (Ammy)",
        content: `The floating AI chat button (bottom-right corner) connects you to **Ammy**, an AI tutor specialized in AMM mechanics. Ask about:

- AMM concepts ("What is impermanent loss?")
- Parameter guidance ("What fee tier should I use for volatile pairs?")
- Formula explanations ("How is VaR calculated?")
- Design tradeoffs ("Concentrated vs constant product for ETH/USDC?")

Ammy has context about whatever page you're viewing and can reference the mathematical models documented here.`,
      },
    ],
  },
  {
    id: "teaching-lab",
    title: "Teaching Lab",
    subsections: [
      {
        id: "tl-courses",
        title: "Course Levels",
        content: `The Teaching Lab offers three progressive course tracks:

**Beginner** (7 modules) — Covers what AMMs are, token reserves, the constant product formula, how swaps work, fee mechanics, impermanent loss, and capital efficiency. Each module includes prose explanation, key insight callouts, and interactive elements.

**Intermediate** (7 modules) — Concentrated liquidity, dynamic fee structures, multi-asset pools, LP strategy optimization, risk-adjusted returns, governance mechanisms, and protocol comparison.

**Advanced** (7 modules) — Custom invariant design, stability theory, MEV and toxic flow, cross-chain AMM design, formal verification concepts, novel bonding curves, and building a complete AMM.`,
      },
      {
        id: "tl-xp",
        title: "XP & Progress System",
        content: `Each completed module awards **XP** (experience points). A progress bar tracks your advancement through the current course level.

- XP accumulates across sessions (stored in browser localStorage)
- Completing all modules in a level unlocks a completion badge
- The simulation panel on the left progressively reveals controls, charts, and metrics as you advance through modules`,
      },
      {
        id: "tl-simulations",
        title: "Interactive Simulations",
        content: `The left panel of the Teaching Lab contains a live AMM simulation that responds to course progress:

- **Parameter Controls** — Adjust reserves (x, y), fee rate, and volatility. Unlocked after Module 3.
- **Bonding Curve** — Real-time visualization of the invariant curve with reserve position marker.
- **Reserve Distribution** — Bar chart showing current token allocation.
- **Risk Metrics** — IL percentage, estimated daily fees, capital efficiency, max drawdown.
- **Price History** — Simulated price chart showing volatility effects.
- **Learning Insights** — Dynamic tips that change based on your parameter selections.`,
      },
      {
        id: "tl-challenges",
        title: "Design Challenges",
        content: `Accessible via the "Challenges" button in the Teaching Lab header. Challenges are practical design exercises that test your understanding.

**Difficulty Tiers:**
- 🟢 **Easy** — Basic parameter tuning (e.g., "Set fees to minimize IL for a stable pair")
- 🟡 **Medium** — Multi-objective optimization (e.g., "Maximize fee capture while keeping slippage under 2%")
- 🔴 **Hard** — Complex scenarios (e.g., "Design a curve that survives a 80% price crash")

Each challenge has target metrics, a time estimate, and a workbench with parameter controls and a results dashboard. Meet or exceed all targets to complete the challenge.`,
      },
    ],
  },
  {
    id: "beginner-mode",
    title: "Beginner Mode",
    subsections: [
      {
        id: "bm-templates",
        title: "Template Selection",
        content: `Four AMM model templates are available:

1. **Constant Product** (x · y = k) — The Uniswap V2 model. Uniform liquidity, baseline efficiency.
2. **Stable Swap** (x + y + α·xy = k) — Optimized for correlated pairs. Low slippage near peg.
3. **Weighted Pool** (x^w₁ · y^w₂ = k) — Asymmetric exposure via adjustable weights.
4. **Concentrated Liquidity** (√x · √y = √k in [pₐ, pᵦ]) — Range-bounded for maximum capital efficiency.

Selecting a template configures default parameters and displays model-specific guidance.`,
      },
      {
        id: "bm-parameters",
        title: "Parameter Configuration",
        content: `Each template exposes adjustable parameters via sliders and inputs:

- **Initial Reserves** — Token X and Token Y starting amounts
- **Fee Rate** — Trading fee percentage (0.01% to 1%)
- **Volatility Scenario** — Low / Medium / High presets affecting simulation behavior
- **Model-specific**: Amplification (Stable Swap), Weight split (Weighted), Price range (Concentrated)

Changes update all charts and metrics in real-time.`,
      },
      {
        id: "bm-health",
        title: "Pool Health Score",
        content: `A composite score (0–100) summarizing pool quality across four dimensions:

- **Liquidity Depth** — Resistance to large trade slippage
- **Fee Sustainability** — Whether fees cover expected IL
- **Capital Efficiency** — Effective use of deployed capital
- **Risk Profile** — Downside exposure and drawdown potential

The score updates dynamically as parameters change, with color-coded status (green/yellow/red).`,
      },
      {
        id: "bm-swap",
        title: "Swap Simulator",
        content: `Test trades against your configured pool:

- Enter a trade amount (as % of pool reserves)
- See: execution price, slippage %, price impact, and post-trade reserves
- The bonding curve visualization highlights the trade path on the invariant curve`,
      },
      {
        id: "bm-scenarios",
        title: "Scenario Runner",
        content: `Pre-built market scenarios stress-test your pool configuration:

- **Bull Run** — Sustained upward price movement
- **Crash** — Sharp downward correction
- **Sideways** — Range-bound volatility
- **Flash Crash** — Sudden spike and recovery

Each scenario shows projected IL, fee accumulation, and final portfolio value compared to holding.`,
      },
    ],
  },
  {
    id: "advanced-mode",
    title: "Advanced Mode",
    subsections: [
      {
        id: "am-invariant",
        title: "Invariant Editor",
        content: `Write custom invariant expressions or choose from presets:

**Presets:** Constant Product (y = k/x), Stable Swap (y = k − x − αx), Weighted (y = (k/x^w₁)^(1/w₂))

**Auto-derived properties:**
- **Spot Price** — Computed numerically as −Δy/Δx between adjacent curve points
- **Convexity** — Second derivative d²y/dx², computed as Δ(spotPrice)/Δx
- **Liquidity Density** — Characterization: Uniform, Concentrated, or Weighted
- **Reserve Ratio** — w₁/w₂ weight split as a percentage

Custom expressions accept standard mathematical notation and are evaluated numerically across the curve domain.`,
      },
      {
        id: "am-fees",
        title: "Fee Structure Editor",
        content: `Design custom fee functions beyond flat rates:

- **Drag-to-edit graph** — Draw fee curves as a function of trade size or price
- **Expression mode** — Write fee functions (e.g., \`0.003 + 0.01 * abs(price - 1)\`)
- **IL Breakeven calculator** — Shows the fee rate needed to offset expected IL for given volatility
- **Dynamic fees** — Model fees that respond to volume, volatility, or oracle deviation`,
      },
      {
        id: "am-comparison",
        title: "AMM Comparison",
        content: `Side-by-side benchmarking of multiple AMM configurations:

- Import designs from the Library or create ad-hoc configurations
- Compare: curve shape, slippage profiles, IL projections, capital efficiency
- Overlay charts show differences visually
- Export comparison reports`,
      },
      {
        id: "am-montecarlo",
        title: "Monte Carlo Engine",
        content: `Run large-scale price simulations to estimate risk distributions.

**Configuration:**
- Paths: 100 to 50,000
- Duration: 7 to 365 days
- Drift (μ): annualized expected return
- Volatility (σ): annualized standard deviation
- Jump diffusion: toggle random shocks

**Output metrics:** VaR (95%, 99%), CVaR, win rate, return distribution histogram, drawdown analysis.

See the **Mathematical Reference → Monte Carlo** section for full methodology.`,
      },
      {
        id: "am-arbitrage",
        title: "Arbitrage Flow Engine",
        content: `Simulates price divergence between the AMM and external markets over 24 hours at 30-minute intervals.

**Models:**
- Sinusoidal divergence scaled by external volatility
- Gas cost threshold for arbitrage profitability
- Toxic flow fraction increasing with oracle latency
- Fee capture efficiency metrics

See **Mathematical Reference → Arbitrage & Toxic Flow** for formulas.`,
      },
      {
        id: "am-liquidity",
        title: "Liquidity Analyzer",
        content: `Diagnostic tools for liquidity quality:

- **Depth chart** — Bid/ask liquidity at each price level
- **Efficiency score** — Capital utilization ratio
- **Slippage curve** — Trade size vs. slippage for the configured pool
- **Concentration map** — Where liquidity is densest on the invariant curve`,
      },
      {
        id: "am-stability",
        title: "Stability Analysis",
        content: `Five diagnostic checks for invariant robustness:

1. **Insolvency Edge Cases** — Tests positive reserves across extreme prices. Concentrated positions flag warnings at range boundaries.
2. **Path Dependence** — Whether LP returns depend on trade sequence (high fees introduce path dependence).
3. **Fee Distortion** — How accumulated fees distort the effective invariant. >0.3% creates measurable drift; >0.8% can create exploitable mispricing.
4. **Inventory Runaway** — One-sided price movement causing extreme imbalance. Weighted pools are resistant.
5. **Reflexivity Loops** — LP withdrawal pressure from IL causing further price impact. Most dangerous in concentrated liquidity.

A stress chart shows pool deviation under extreme scenarios vs. a 5% safety threshold.`,
      },
      {
        id: "am-mev",
        title: "MEV Analyzer",
        content: `Analyze maximal extractable value vulnerabilities:

- **Sandwich attacks** — Estimate profit from front-running + back-running a target trade
- **JIT (Just-In-Time) liquidity** — Model the impact of JIT LPs that add/remove liquidity around large trades
- **Backrun extraction** — Calculate arbitrage profit from post-trade price correction

Configure pool parameters, trade sizes, and gas costs to see MEV exposure under different conditions.`,
      },
      {
        id: "am-export",
        title: "Deployment Export",
        content: `Export your AMM design for deployment:

- **Solidity code** — Generated smart contract implementing your invariant
- **JSON configuration** — Parameters, metadata, and curve definition
- **Deployment checklist** — Security considerations and recommended audits`,
      },
    ],
  },
  {
    id: "design-studio",
    title: "AMM Design Studio",
    subsections: [
      {
        id: "ds-blocks",
        title: "Block Builder",
        content: `Visual drag-and-drop curve design using composable blocks:

**Block categories:**
- **Base curves** — Constant Product, Stable Swap, Weighted, Linear
- **Modifiers** — Amplification, Dampening, Clamping, Scaling
- **Combinators** — Blend, Switch, Interpolate between curves
- **Fee blocks** — Static fee, Dynamic fee, Volume-responsive

Connect blocks to create compound invariant functions. The preview panel shows the resulting curve in real-time with spot price and liquidity density overlays.`,
      },
      {
        id: "ds-multiasset",
        title: "Multi-Asset Lab",
        content: `Design invariants for pools with 3+ tokens:

- Configure token count (3–8 tokens) with individual weights
- Choose base model: Weighted Geometric Mean or Stable Multi-Asset
- Visualize 3D invariant surfaces (for 3-token pools)
- Analyze cross-pair slippage and routing efficiency
- Compare against equivalent 2-token pair decomposition`,
      },
      {
        id: "ds-timevariance",
        title: "Time-Variance Lab",
        content: `Create curves that evolve over time:

- **Keyframe editor** — Define curve parameters at specific timestamps
- **Interpolation modes** — Linear, exponential decay, oscillation, step
- **Use cases**: Liquidity bootstrapping (declining weight), seasonal fee adjustment, oracle-driven adaptation
- **Preview playback** — Animate the curve evolution over the configured time span`,
      },
      {
        id: "ds-compiler",
        title: "Invariant Compiler",
        content: `Compile visual designs or custom expressions to deployable smart contracts:

- **Solidity generation** — Produces an ERC-20 compatible AMM contract
- **Gas profiling** — Estimated gas cost per swap, add/remove liquidity
- **Optimization passes** — Constant folding, common subexpression elimination
- **Security notes** — Flags potential issues (overflow, division by zero, rounding)`,
      },
    ],
  },
  {
    id: "labs",
    title: "Experimental Labs",
    subsections: [
      {
        id: "labs-atlas",
        title: "Invariant Atlas & Discovery",
        content: `A continuous evolutionary search engine for discovering novel AMM designs.

**MAP-Elites algorithm** — Maintains a 2D archive grid where each cell represents a unique behavioral niche (e.g., "high efficiency + low slippage"). New candidates are generated via mutation and crossover, evaluated on multiple objectives, and placed into the archive.

**Features:**
- 64-bin liquidity representation as the genome
- Multi-objective scoring: efficiency, stability, capital utilization, slippage
- Pareto frontier visualization of non-dominated designs
- Configurable experiment runs with custom objective weights
- Export discovered designs to the Library`,
      },
      {
        id: "labs-strategy",
        title: "Liquidity Strategy Lab",
        content: `Design, backtest, and compare LP strategies over Monte Carlo price simulations.

**Strategy block editor** — Compose strategies from rebalancing rules, range management, and fee reinvestment policies.

**Presets:** Passive Hold, Active Rebalance, Range Following, Fee Compounding

**Backtest output:**
- Up to 5,000 Monte Carlo paths
- Fee vs IL attribution breakdown
- Sharpe ratio and maximum drawdown
- Comparison against passive LP (buy-and-hold the pool)`,
      },
      {
        id: "labs-dna",
        title: "AMM DNA Visualizer",
        content: `Visualize the genetic structure and evolutionary history of AMM designs.

- **Genome fingerprint** — 64-bin radial ring showing the liquidity distribution as a visual "DNA strand"
- **Feature radar** — Multi-axis radar chart of key properties (efficiency, stability, slippage, etc.)
- **Side-by-side comparison** — Compare two designs' genomes and features
- **Lineage tree** — Trace evolutionary ancestry: which parent designs were crossed/mutated to produce a candidate`,
      },
      {
        id: "labs-replay",
        title: "Live Market Replay",
        content: `Replay historical market scenarios through any AMM design from the Library.

**Curated scenarios:**
- Black Thursday (March 2020)
- DeFi Summer (June–Sept 2020)
- LUNA/UST Collapse (May 2022)
- FTX Contagion (Nov 2022)
- And 4 more…

**Features:**
- Animated price playback with configurable speed
- Real-time IL, fee accumulation, and portfolio value tracking
- Drawdown detection with severity markers
- Compare multiple AMM designs' performance on the same scenario`,
      },
    ],
  },
  {
    id: "library",
    title: "AMM Library",
    subsections: [
      {
        id: "lib-famous",
        title: "Famous AMMs Catalog",
        content: `Pre-loaded designs representing real-world AMM implementations:

- **Uniswap V2** — Constant product baseline
- **Curve Finance** — StableSwap with high amplification
- **Balancer** — Weighted pool with configurable token weights
- **Uniswap V3** — Concentrated liquidity with tick-based ranges
- And more community-contributed designs

Each entry includes: formula, parameters, description, risk metrics, and historical context.`,
      },
      {
        id: "lib-community",
        title: "Community Designs",
        content: `Users can save their custom AMM designs to the shared library:

- **Save from any mode** — Beginner, Advanced, Design Studio, or Discovery Atlas
- **Metadata** — Name, description, author, category, generation (if evolved)
- **Upvoting** — Community voting to surface the best designs
- **Categories** — Stable pairs, volatile pairs, multi-asset, experimental, evolved`,
      },
      {
        id: "lib-backtest",
        title: "Historical Backtest",
        content: `Test any library AMM against historical price data:

- Select a scenario (or use Monte Carlo-generated paths)
- Run the backtest to see: cumulative fees, IL, net PnL, drawdown timeline
- Compare against holding or against other library designs
- Export results as a summary report`,
      },
    ],
  },
  {
    id: "math-reference",
    title: "Mathematical Reference",
    subsections: [
      {
        id: "math-models",
        title: "AMM Models",
        content: `**Constant Product (x · y = k)**
- Spot price: P = y/x = −dy/dx
- Slippage for trade Δx: slippage = Δx / (x + Δx)
- Liquidity: Uniform across all prices from 0 to ∞
- Capital efficiency: 1.0x (baseline)

**Stable Swap (x + y + α·xy = k)**
- Near-zero slippage for small trades around peg
- Slippage grows quadratically: ~pct² × 50
- Capital efficiency: ~3.1x vs constant product near peg

**Weighted Pool (x^w₁ · y^w₂ = k)**
- Spot price: P = (w₁/w₂) × (y/x)
- IL is reduced proportional to weight asymmetry
- Capital efficiency: ~1.5x (weight-dependent)

**Concentrated Liquidity (√x · √y = √k in range [pₐ, pᵦ])**
- Capital efficiency: up to 4000x for narrow ranges
- Position goes inactive outside range (earns no fees)
- IL is amplified proportional to concentration factor`,
      },
      {
        id: "math-il",
        title: "Impermanent Loss",
        content: `**Formula (Constant Product)**

For a price change ratio r = P_new / P_initial:

    IL = 2√r / (1 + r) − 1

This is always ≤ 0 (a loss). The loss is symmetric — a 2x increase produces the same IL as a 0.5x decrease.

**Key values:**
| Price Change | IL |
|---|---|
| 1.25x | −0.6% |
| 1.50x | −2.0% |
| 2.00x | −5.7% |
| 3.00x | −13.4% |
| 5.00x | −25.5% |

**Adjustments by Model:**
- Stable Swap: IL × 0.3 (correlated assets reduce divergence)
- Weighted Pool: IL × 0.7 (asymmetric weighting reduces exposure)
- Concentrated: IL × 1.8 (concentrated range amplifies losses)`,
      },
      {
        id: "math-slippage",
        title: "Slippage Models",
        content: `**Constant Product (exact)**

For a trade of Δx against pool reserves x:

    slippage = Δx / (x + Δx)

Simplifies to approximately Δx/x for small trades.

**Stable Swap**

Slippage grows quadratically near the peg:

    slippage ≈ (Δx/x)² × 50

This reflects the flat curve region near the 1:1 ratio.

**Price Impact**

The marginal price function is the negative first derivative of the invariant curve (−dy/dx). The second derivative (d²y/dx²) captures the convexity — how rapidly price impact increases with trade size.`,
      },
      {
        id: "math-montecarlo",
        title: "Monte Carlo Methodology",
        content: `**Price Path Model (GBM with Jump Diffusion)**

    S(t+dt) = S(t) × exp((μ − σ²/2)dt + σ√dt × Z + J)

Where:
- μ = annualized drift rate
- σ = annualized volatility
- Z ~ N(0,1) via Box-Muller transform
- J = jump component: with probability p, a uniform shock in [−0.1, 0.1]
- dt = 1/365 (daily steps)

**Random Number Generation**

Deterministic pseudo-random generator based on sin() for reproducibility:

    rng(seed) = frac(sin(seed) × 10000)

Box-Muller transform converts uniform samples to normal:

    Z = √(−2 ln(U₁)) × cos(2π U₂)

**Statistical Notes:**
- Paths are independent but share the same RNG seed structure
- 1,000+ paths typically produce stable VaR estimates (±2% at 95% confidence)
- 10,000 paths recommended for CVaR convergence`,
      },
      {
        id: "math-arbitrage",
        title: "Arbitrage & Toxic Flow",
        content: `**Price Divergence Model**

    divergence(t) = sin(t/2) × σ_ext × 3 + cos(1.3t) × σ_ext × 1.5

**Arbitrage Volume**

    arbVolume = |divergence| × L × 0.001    (if |divergence| > gasCost/10000)

Where L = pool liquidity.

**Toxic Flow**

Informed (toxic) flow increases with latency:

    toxicFlow = arbVolume × f(latency)

Where f(latency) = 0.1 if <100ms, 0.4 if <500ms, 0.7 if ≥500ms.

**Fee Capture Efficiency**

    feeCapture = arbVolume × feeRate − toxicFlow × 0.001
    captureRate = feeCapture / arbVolume`,
      },
      {
        id: "math-risk",
        title: "Risk Metrics",
        content: `**VaR (Value at Risk)** — The α-percentile of the return distribution. VaR(95%) means 5% probability of losses exceeding this value.

**CVaR (Conditional VaR)** — Expected loss given that losses exceed VaR. CVaR(95%) = E[Loss | Loss > VaR(95%)].

**Estimated Daily Fees**

    dailyFees = liquidity × feeRate × volatilityMultiplier × 0.01

Volatility multiplier: 0.5 (low), 1 (medium), 2 (high).

**Maximum Drawdown**

    maxDrawdown = volatilityMultiplier × 8% + concentratedPremium

Concentrated positions add 12% premium.

**Capital Efficiency** — Ratio of effective trading depth to capital deployed:
- Constant Product: 1.0x
- Stable Swap: 3.1x
- Weighted: 1.5x
- Concentrated: 4.2x

**Break-even Volatility**

    breakEvenVol = (feeRate × 365 × 100) / volatilityMultiplier

**Downside Deviation**

    downsideDev = volatilityMultiplier × 4.2%`,
      },
      {
        id: "math-stability",
        title: "Stability Diagnostics",
        content: `Five checks are run on each invariant configuration:

1. **Insolvency** — Verify positive reserves across [0.01, 100] price range
2. **Path Dependence** — Compare terminal states across permuted trade sequences
3. **Fee Distortion** — Measure invariant drift after 1000 fee-accumulating trades
4. **Inventory Runaway** — Simulate unidirectional price movement, measure reserve imbalance
5. **Reflexivity** — Model LP withdrawal cascade under IL stress

Each check produces a Pass / Warning / Fail status with explanatory text and a stress deviation chart.`,
      },
    ],
  },
  {
    id: "limitations",
    title: "Limitations & Assumptions",
    subsections: [
      {
        id: "lim-all",
        title: "Known Limitations",
        content: `1. **Simplified RNG** — The pseudo-random generator uses sin()-based hashing, which has lower statistical quality than Mersenne Twister or xoshiro. Adequate for educational simulation, not for production risk modeling.

2. **Static Liquidity** — Simulations assume liquidity remains constant. Real pools experience dynamic LP entry/exit.

3. **Deterministic Divergence** — The arbitrage price divergence model uses sinusoidal functions rather than stochastic processes.

4. **Fee Compounding** — Fee reinvestment into the pool is not modeled — fees accumulate separately.

5. **Gas Costs** — Gas is modeled as a fixed dollar cost, not as a function of network congestion.

6. **Stable Swap Approximation** — Uses a linearized form rather than the full Curve Finance StableSwap equation (An^n Σx_i + D = ADn^n + D^(n+1) / n^n Πx_i).

7. **Browser Constraints** — Heavy computations (50K Monte Carlo paths, large MAP-Elites archives) may be slow on older devices. Web Workers mitigate this but memory limits apply.

8. **No Real Market Data** — Market replay scenarios use curated approximations, not actual tick-level data feeds.`,
      },
    ],
  },
];
