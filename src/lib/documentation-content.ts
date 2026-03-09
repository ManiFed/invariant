export interface DocSubsection {
  id: string;
  title: string;
  content: string;
  interactive?: "il-calculator" | "slippage-explorer" | "curve-comparison" | "fee-breakeven" | "monte-carlo-mini" | "mev-visualizer" | "block-taxonomy" | "strategy-block-taxonomy" | "challenge-list" | "scenario-list" | "regime-table" | "family-table" | "crossover-diagram";
  tip?: string;
  links?: { label: string; anchor: string }[];
}

export interface DocSection {
  id: string;
  title: string;
  subsections: DocSubsection[];
}

export const documentationSections: DocSection[] = [
  // ═══════════════════════════════════════════════════════════════════
  // 1. ABOUT
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "about",
    title: "About Invariant Studio",
    subsections: [
      {
        id: "about-who",
        title: "Who Is It For?",
        content: `**Invariant Studio** is an open-source educational platform for designing, simulating, and stress-testing automated market maker (AMM) mechanisms. It provides a zero-setup, browser-based environment where every formula is visible and every parameter is adjustable.

- **Students & Researchers** — Learn AMM mechanics through 21 guided course modules, interactive simulations, and 9 design challenges across three difficulty tiers
- **DeFi Developers** — Prototype custom invariant functions using 40+ composable blocks, compile to Solidity, and export deployment artifacts with gas profiling
- **Liquidity Providers** — Understand impermanent loss, fee dynamics, slippage, and capital efficiency through real-time risk dashboards before committing capital
- **Protocol Designers** — Explore novel bonding curve shapes with evolutionary discovery (MAP-Elites + CMA-ES), Monte Carlo stress testing (up to 50K paths), MEV vulnerability analysis, and 5-check stability diagnostics
- **Quantitative Analysts** — Backtest LP strategies with a 7-category visual block editor, run market replay over 8 historical scenarios, and compare Sharpe ratios, drawdowns, and VaR/CVaR across designs`,
      },
      {
        id: "about-architecture",
        title: "Platform Architecture",
        content: `Invariant Studio runs entirely in-browser — no backend dependency for simulations. All computations are performed client-side for instant feedback and reproducibility.

**Computation Architecture:**
- **Main Thread** — UI rendering, parameter controls, chart updates (React + Recharts)
- **Web Workers** — Heavy computations offloaded: Monte Carlo path generation, evolutionary search ticks, strategy backtests, MAP-Elites grid evaluation
- **Two-Phase Evaluation Pipeline** — Discovery engine uses early rejection screening (cheap metric check) before full simulation, reducing computation by ~60%
- **Cross-Tab Leader Election** — Discovery Atlas uses a leader-follower model: one tab runs the engine, others subscribe to state updates with graceful "leader-goodbye" handoff

**Storage:**
- **LocalStorage** — Course progress, XP, challenge completion, theme preference
- **SessionStorage** — Active invariant configuration, fee structure, persisted across Advanced Mode tabs
- **Cloud Database** — AMM Library (community designs, upvotes, metadata) via cloud backend
- **Cloud Edge Function** — AI assistant (Ammy) Q&A endpoint

**Key technologies:** React 18, TypeScript, Tailwind CSS, Framer Motion, Recharts, Radix UI, Web Workers, Vite.`,
      },
      {
        id: "about-philosophy",
        title: "Philosophy",
        content: `We believe the best way to learn finance is to break things in a sandbox. Every chart is interactive, every parameter is adjustable, and every formula is visible. There are no black boxes.

**Design Principles:**
1. **Progressive Disclosure** — Start with templates → advance to custom invariants → explore evolutionary discovery
2. **Show the Math** — Every metric displays its formula. Hover for explanations. No hidden calculations.
3. **Real Consequences** — Parameters have tradeoffs. Low fees mean less revenue. Tight ranges mean higher IL. The simulator doesn't sugarcoat.
4. **Reproducibility** — Deterministic RNG (seeded PRNGs) ensures identical results for identical inputs
5. **Open Source** — Full codebase available on GitHub. Fork it, extend it, learn from it.`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 2. GETTING STARTED
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "getting-started",
    title: "Getting Started",
    subsections: [
      {
        id: "gs-navigation",
        title: "Homepage Navigation",
        content: `The homepage presents a navigation grid with seven entry points:

1. **Teaching Lab** — 21 guided course modules (7 per level), interactive simulations, 9 design challenges. Recommended starting point for all users.
2. **Beginner Mode** — Template-based experimentation with 4 AMM models, guided tour, swap simulator, scenario runner, and pool health scoring.
3. **Advanced Mode** — 9-tab professional environment: Invariant Editor (up to 8 assets), Fee Structure Editor (draggable graph), AMM Comparison, Monte Carlo (50K paths), Arbitrage Flow, Liquidity Analyzer, Stability Analysis (5 checks), MEV Analyzer (sandwich/JIT/backrun), Deployment Export.
4. **Design Studio** — 4-mode visual design environment: Block Builder (40+ blocks, 8 categories), Multi-Asset Lab (3-8 tokens), Time-Variance Lab (keyframes, decay, oscillation), Invariant Compiler (Solidity + gas profiling).
5. **Labs** — Experimental research tools: Invariant Atlas (MAP-Elites evolutionary search), Liquidity Strategy Lab (visual block backtesting), AMM DNA Visualizer (genome fingerprints), Live Market Replay (8 historical scenarios).
6. **AMM Library** — Browse famous AMMs (Uniswap V2/V3, Curve, Balancer, Solidly) and community-created designs. Upvote, export, and backtest.
7. **Documentation** — This comprehensive reference page.`,
      },
      {
        id: "gs-learning-path",
        title: "Choosing Your Path",
        content: `**New to AMMs?**
Start with the Teaching Lab. Pick "Beginner" level. You'll work through 7 modules covering reserves, constant product, swaps, fees, impermanent loss, and capital efficiency. Each module has lessons, quizzes (with wrong-answer explanations), interactive challenges, and mini-simulations (slippage explorer, reserve balance visualizer, fee calculator). The left panel progressively reveals more controls as you advance.

**Know the basics?**
Jump to Beginner Mode. Select a template (Constant Product, Stable Swap, Weighted, or Concentrated). Configure parameters with sliders. The guided tour (7 steps with auto-scrolling) walks you through every section. Try swaps, run market scenarios (Bull Run, Crash, Sideways, Flash Crash), and analyze the pool health score.

**Ready to build?**
Advanced Mode is a 9-tab workspace. Start by configuring an invariant (presets or custom expression supporting up to 8 assets). Your invariant persists across all tabs via session storage. Run Monte Carlo simulations, analyze MEV exposure, and export Solidity code. The sidebar collapses for more workspace; Previous/Next buttons are always visible.

**Want to design visually?**
The Design Studio has 4 modes. The Block Builder lets you drag-and-drop from 40+ blocks across 8 categories (Primitives, Operations, Curves, Modifiers, Conditionals, Fees, Multi-Asset, Time-Variance). The curve preview updates in real-time. Compile to Solidity when ready.

**Want to discover?**
The Labs section has cutting-edge tools. The Invariant Atlas runs evolutionary searches (CMA-ES + MAP-Elites) across 4 market regimes to discover novel AMM designs automatically. The Strategy Lab lets you visually program LP strategies and backtest them.`,
      },
      {
        id: "gs-ai-assistant",
        title: "AI Assistant (Ammy)",
        content: `The floating chat button (bottom-right corner) connects you to **Ammy**, an AI tutor specialized in AMM mechanics. Ammy uses a cloud edge function with context about the current page.

**What you can ask:**
- Conceptual: "What is impermanent loss?" "How does concentrated liquidity work?"
- Parameter guidance: "What fee tier should I use for ETH/USDC?" "Is 80% annualized vol realistic?"
- Formula explanations: "How is VaR calculated?" "Walk me through the IL formula."
- Design tradeoffs: "Concentrated vs constant product for a stablecoin pair?"
- Debugging: "Why is my pool health score so low?" "My Monte Carlo VaR seems too high."

**Behavior:**
- Ammy opens with a random greeting after 12 seconds of inactivity
- Conversations persist within the session
- Supports markdown formatting in responses
- Rate-limited to prevent abuse`,
      },
      {
        id: "gs-keyboard",
        title: "UI Conventions",
        content: `**Theme Toggle:** Click the sun/moon icon in the top-right of any page to switch between light and dark mode. Preference is saved to localStorage.

**Navigation:** Every sub-page has a back arrow (←) in the header that returns to the parent page.

**Tooltips & Help:** Look for ❓ icons throughout the interface. Clicking them reveals detailed explanations of metrics and concepts.

**Session Persistence:** Advanced Mode saves your active invariant and fee configuration to sessionStorage. Refreshing the page preserves your work within the same session.

**Responsive Layout:** The platform is optimized for desktop viewports (1024px+). Mobile layouts adapt but some complex visualizations are best viewed on larger screens.`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 3. TEACHING LAB
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "teaching-lab",
    title: "Teaching Lab",
    subsections: [
      {
        id: "tl-courses",
        title: "Course Levels & Modules",
        content: `The Teaching Lab offers three progressive course tracks, each with 7 modules. Every module contains a mix of lessons, quizzes, and interactive challenges.

**Beginner** (7 modules):
1. **What Are AMMs?** — Introduction to automated market makers, how they differ from order books
2. **Token Reserves** — Understanding the two-sided pool, reserve ratios, and initial pricing
3. **The Constant Product Formula** — Deep dive into x·y = k, with interactive reserve balance mini-sim
4. **How Swaps Work** — Trade execution mechanics, the invariant curve, slippage explorer mini-sim
5. **Fee Mechanics** — How fees accumulate, fee tiers, fee calculator mini-sim
6. **Impermanent Loss** — IL formula derivation, IL tables, when IL matters and when it doesn't
7. **Capital Efficiency** — Comparing models, concentrated vs. full-range, efficiency multipliers

**Intermediate** (7 modules):
1. **Concentrated Liquidity** — Range positions, capital efficiency multiplier formula, tick math
2. **Dynamic Fee Structures** — Volume-responsive fees, volatility-adjusted fees, oracle-based fees
3. **Multi-Asset Pools** — 3+ token invariants, weighted geometric mean, Balancer math
4. **LP Strategy Optimization** — Rebalancing triggers, range management, stop-loss strategies
5. **Risk-Adjusted Returns** — Sharpe ratio, Sortino ratio, risk-adjusted fee yield
6. **Governance Mechanisms** — Fee voting, parameter adjustment, protocol-owned liquidity
7. **Protocol Comparison** — Uniswap vs Curve vs Balancer vs Solidly architecture comparison

**Advanced** (7 modules):
1. **Custom Invariant Design** — Engineering bonding curves from scratch, StableSwap derivation
2. **Stability Theory** — Path dependence, reflexivity, fee distortion, inventory runaway
3. **MEV & Toxic Flow** — Sandwich attacks, JIT liquidity, backrun extraction, protection mechanisms
4. **Cross-Chain AMM Design** — Bridge-aware pools, cross-chain arbitrage, latency considerations
5. **Formal Verification Concepts** — Invariant properties to prove, safety conditions, edge cases
6. **Novel Bonding Curves** — Power curves, Solidly's x³y+xy³, sigmoid-based invariants
7. **Building a Complete AMM** — End-to-end design project combining all concepts`,
      },
      {
        id: "tl-step-types",
        title: "Step Types",
        content: `Each module consists of multiple steps of three types:

**Lesson Steps:**
- Multi-paragraph prose with bold highlighting
- Optional visual indicators (e.g., "concentrated-range", "capital-efficiency-bars")
- Optional mini-simulations embedded inline:
  - \`slippage-explorer\` — Interactive slippage vs trade size chart
  - \`reserve-balance\` — Animated reserve rebalancing visualization
  - \`fee-calculator\` — Real-time fee accumulation calculator
- Optional \`highlightControls\` array that lights up specific simulation panel controls

**Quiz Steps:**
- Multiple-choice question with 3-4 options
- Correct answer explanation and wrong-answer explanation (shown on mistake)
- Optional follow-up quiz (harder variant triggered on correct answer)
- Optional \`calculatorNeeded\` flag suggesting the student use the simulation panel

**Challenge Steps:**
- Target metric with threshold and tolerance
- Hint system (3 progressive hints per challenge)
- Highlight controls that should be adjusted
- Scoring: continuous 0-100 based on how close the student gets`,
      },
      {
        id: "tl-xp",
        title: "XP & Progress System",
        content: `Each completed module awards **XP** (experience points). The progress system uses browser localStorage for persistence.

**Mechanics:**
- XP accumulates across sessions — close and reopen without losing progress
- A progress bar shows advancement through the current course level
- Completing all 7 modules in a level earns a completion indicator
- The simulation panel on the left **progressively reveals** sections as you advance:
  - Modules 1-2: Only bonding curve visible
  - Module 3+: Parameter controls unlock (reserves, fee rate, volatility sliders)
  - Module 4+: Reserve distribution chart appears
  - Module 5+: Risk metrics dashboard appears
  - Module 6+: Price history chart appears
  - Module 7: Full learning insights panel visible

**Level Switching:**
- Use the level picker dropdown at the top of the Teaching Lab sidebar
- Switching levels preserves progress in all levels`,
      },
      {
        id: "tl-simulations",
        title: "Interactive Simulation Panel",
        content: `The left panel of the Teaching Lab contains a live AMM simulation synchronized with course progress.

**Parameter Controls** (unlock at Module 3):
- **Reserve X** — Slider: 10 to 10,000 (token units)
- **Reserve Y** — Slider: 10,000 to 10,000,000 (token units)
- **Fee Rate** — Slider: 1 to 100 basis points (0.01% to 1.00%)
- **Volatility** — Dropdown: Low (30%), Medium (60%), High (100%) annualized

**Bonding Curve Chart:**
- Real-time Recharts visualization of the invariant curve y(x)
- Red dot marker showing current reserve position on the curve
- Axes: Reserve X vs Reserve Y

**Reserve Distribution:**
- Bar chart showing Token X vs Token Y allocation
- Color-coded by token

**Risk Metrics Dashboard:**
- **IL %** — Current impermanent loss at configured price ratio
- **Estimated Daily Fees** — liquidity × feeRate × volMultiplier × 0.01
- **Capital Efficiency** — Model-dependent: 1.0x (CP), 3.1x (SS), 1.5x (WP), 4.2x (CL)
- **Max Drawdown** — volMultiplier × 8% + concentrated premium (12% if applicable)
- **Break-even Volatility** — (feeRate × 365 × 100) / volMultiplier
- **Downside Deviation** — volMultiplier × 4.2%

**Price History Chart:**
- Simulated GBM price path over 90 days
- Uses configured volatility and zero drift
- Updates on parameter change

**Learning Insights:**
- Dynamic text tips that respond to your current parameter configuration
- Example: "Your fee rate is unusually high — this will deter volume" or "Low volatility means less arbitrage, fewer fees"`,
      },
      {
        id: "tl-challenges",
        title: "Design Challenges",
        content: `Accessible via the **"Challenges"** button in the Teaching Lab header. Also reachable directly via \`/learn?mode=challenges\`.

**9 Challenges across 3 difficulty tiers:**

🟢 **Beginner (3 challenges):**
- **The Stablecoin Peg** — Design a pool for stablecoins with <0.1% slippage on $50k trades. Key lever: reserve depth (needs ~$60M per side).
- **Your First Pool** — Create balanced ETH/USDC pool with <2% slippage on $10k trades. Teaches reserve sizing.
- **The Fee Sweet Spot** — Find the fee rate maximizing 30-day revenue without killing volume. Sweet spot: ~60-90 bps.

🟡 **Intermediate (3 challenges):**
- **Survive the Crash** — Limit IL during a 60% price drop. Wide ranges + high fees + deep reserves.
- **Fee Maximizer** — Maximize 90-day fee revenue at 80% annualized vol. Balance fee rate vs volume.
- **The Efficient Pool** — Maximize capital efficiency while maintaining solvency. Concentration vs risk.

🔴 **Expert (3 challenges):**
- **MEV Shield** — Minimize sandwich attack profitability while maintaining tradability.
- **The Degen Pool** — Survive 100 blocks of high-frequency trading with minimal LP value extraction.
- **Black Swan** — Design a pool that survives an 80% crash and recovers within 30 days.

**Challenge Mechanics:**
- Each has 2-4 constraints with operators (<, >, <=, >=) and target values
- Scoring: weighted average of constraint satisfaction (0-100)
- Stars: 0 = failed, 1 = passed (score ≥ 60), 2 = good (≥ 75), 3 = excellent (≥ 90)
- 3 progressive hints per challenge (increasingly specific)
- Slider ranges are challenge-specific (e.g., stablecoin pool uses $100K-$100M reserves)`,
        interactive: "challenge-list",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 4. BEGINNER MODE
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "beginner-mode",
    title: "Beginner Mode",
    subsections: [
      {
        id: "bm-templates",
        title: "Template Selection",
        content: `Four AMM model templates, each with a formula, description, and expandable "Learn More" section:

1. **⚖️ Constant Product** (x · y = k)
   - The Uniswap V2 model. Product of reserves is constant.
   - Uniform liquidity distribution across all prices 0→∞
   - Capital efficiency: 1.0x (baseline)
   - Slippage: Δx / (x + Δx) — linear growth with trade size
   - Best for: General-purpose volatile pairs

2. **🔗 Stable Swap** (x + y + α·xy = k)
   - Hybrid of constant sum and constant product. Curve Finance approach.
   - Near-zero slippage around peg, grows quadratically away from it
   - Capital efficiency: ~3.1x near peg
   - Amplification parameter α controls curvature (higher = flatter near peg)
   - Best for: Correlated asset pairs (stablecoins, wrapped assets)

3. **⚡ Weighted Pool** (x^w₁ · y^w₂ = k)
   - Balancer-style asymmetric weights where w₁ + w₂ = 1
   - Majority-weighted token has less IL exposure
   - Spot price: P = (w₁/w₂) × (y/x)
   - Capital efficiency: ~1.5x
   - Best for: Treasury exposure management (e.g., 80/20 ETH/USDC)

4. **🎯 Concentrated Liquidity** (√x · √y = √k in [pₐ, pᵦ])
   - Capital deployed within a specific price range only
   - Efficiency: up to 4000x for very narrow ranges
   - Position goes inactive outside range (earns no fees, holds 100% of depreciating asset)
   - IL is amplified proportional to concentration factor
   - Best for: Active LPs who monitor and rebalance`,
        interactive: "curve-comparison",
      },
      {
        id: "bm-parameters",
        title: "Parameter Configuration",
        content: `Each template exposes adjustable parameters via sliders and inputs. Changes update all charts and metrics in real-time.

**Universal Parameters:**
- **Token A Price** — Starting price of token A (default: $2,000 for ETH-like)
- **Token B Price** — Starting price of token B (default: $1 for USDC-like)
- **Liquidity** — Total dollar value deposited (slider: $10K to $10M)
- **Volatility Scenario** — Low / Medium / High presets
  - Low: 30% annualized, volMultiplier = 0.5
  - Medium: 60% annualized, volMultiplier = 1.0
  - High: 100% annualized, volMultiplier = 2.0
- **Fee Tier** — 0.01% / 0.05% / 0.30% / 1.00%

**Model-Specific Parameters:**
- **Stable Swap** — Amplification (A): controls flatness near peg. Range 1-5000.
- **Weighted Pool** — Weight split: 50/50, 60/40, 70/30, 80/20, 90/10
- **Concentrated** — Price range: Lower bound and Upper bound (as multiples of current price)

**Risk Profiles (Plain English):**
- **Conservative** 🛡️ — Prefers safety. Calm markets, standard fees.
- **Moderate** ⚖️ — Balanced risk/return. Normal markets, balanced fees.
- **Aggressive** 🔥 — Maximum returns. Volatile markets, high fees.`,
      },
      {
        id: "bm-health",
        title: "Pool Health Score",
        content: `A composite score (0–100) displayed as a radial gauge, summarizing pool quality across four weighted dimensions:

**Scoring Components:**

1. **Liquidity Depth** (25%) — Resistance to large trade slippage. Based on reserve size relative to expected trade volumes. Score = min(100, reserves / targetDepth × 100).

2. **Fee Sustainability** (25%) — Whether projected fee income covers expected IL. Score = min(100, projectedFees / expectedIL × 100). A score below 50 means the pool is expected to lose money.

3. **Capital Efficiency** (25%) — How effectively deployed capital generates trading depth. Concentrated positions score highest (up to 4.2x baseline). Full-range constant product scores 100/4.2 ≈ 24.

4. **Risk Profile** (25%) — Inverse of downside exposure. Based on maximum drawdown estimate and IL amplification. Concentrated positions in volatile markets score lowest.

**Color Coding:**
- 🟢 **Green** (75-100): Healthy pool, well-configured
- 🟡 **Yellow** (40-74): Viable but with notable risks
- 🔴 **Red** (0-39): High risk, likely unprofitable`,
      },
      {
        id: "bm-swap",
        title: "Swap Simulator",
        content: `Test trades against your configured pool to understand execution mechanics.

**How to use:**
1. Enter a trade amount in the input field (dollar value)
2. Click the ⚡ button to execute the simulated swap
3. View results:

**Output Metrics:**
- **You Receive** — Amount of output token received
- **Execution Price** — Actual price paid (includes slippage)
- **Slippage** — Percentage difference from spot price. Formula: Δx / (x + Δx) for constant product
- **Price Impact** — How much the pool price moved as a result of the trade
- **Fees Paid** — tradeAmount × feeRate
- **Post-Trade Reserves** — New reserve balances after the swap

The bonding curve visualization highlights the trade path: a line from the pre-trade position to the post-trade position on the invariant curve.`,
      },
      {
        id: "bm-scenarios",
        title: "Scenario Runner",
        content: `Pre-built market scenarios stress-test your pool configuration over 90 simulated days.

**Available Scenarios:**
- **📈 Bull Run** — Sustained upward price movement (+5% drift, medium volatility). Tests whether fee income offsets IL during directional moves.
- **📉 Crash** — Sharp downward correction (-8% drift, high volatility). Tests drawdown resilience and solvency.
- **↔️ Sideways** — Range-bound volatility (0% drift, low volatility). The ideal fee-farming scenario. Tests whether fees justify capital lockup.
- **⚡ Flash Crash** — Sudden 40% spike down, then partial recovery. Tests concentrated position behavior during extreme events.

**Output:**
- Animated line chart: LP Value vs Hold Value over 90 days
- Play / Pause / Reset controls
- Final metrics: Total Return, IL, Fees Earned, Net PnL
- Verdict: "Profitable" or "Unprofitable" with explanation

**Guided Tour:**
The tour (7 steps) walks new users through every section with auto-scrolling. Steps: Welcome → Template → Parameters → Health Score → Swap Sim → Charts → Scenarios → Done.`,
      },
      {
        id: "bm-education",
        title: "Educational Tooltips",
        content: `Throughout Beginner Mode, ❓ icons provide contextual education:

- **Slippage** — "Slippage is the difference between expected and actual execution price. Larger trades relative to pool size cause more slippage."
- **Impermanent Loss** — "IL occurs when the price ratio of pooled tokens diverges from entry. Formula: IL = 2√r/(1+r) − 1."
- **Daily Fees** — "Fee revenue depends on volume × fee tier. Higher volatility drives more arb trades → more fees but more IL."
- **Max Drawdown** — "Worst-case decline. Concentrated positions add 12% premium due to amplified IL."
- **Capital Efficiency** — "How effectively capital provides depth. Concentrated at 4.2x means $25k ≈ $100k constant product."
- **Break-even Vol** — "Minimum volatility for fee income to offset IL. Below this, LPing is unprofitable."`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 5. ADVANCED MODE
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "advanced-mode",
    title: "Advanced Mode",
    subsections: [
      {
        id: "am-layout",
        title: "Interface Layout",
        content: `Advanced Mode is a 9-tab professional workspace with a collapsible sidebar and persistent session state.

**Header:**
- Back arrow → Homepage
- Active invariant indicator (clickable → jumps to Invariant Editor tab)
- Import button → Load designs from Library (6 pre-built: Uniswap V2, Curve StableSwap, Balancer Weighted, Uniswap V3 Concentrated, Solidly ve(3,3), Power Perpetual Curve) or JSON upload

**Sidebar (Collapsible):**
- 9 tabs with icons, labels, and step numbers
- Previous/Next navigation buttons always visible at bottom (no scrolling needed)
- Hover to expand if collapsed

**Session Persistence:**
- Active invariant config saved to \`sessionStorage\` key "advanced_invariant"
- Fee structure saved to \`sessionStorage\` key "advanced_fees"
- Both survive page refresh within the same browser session
- All tabs read from this shared state`,
      },
      {
        id: "am-invariant",
        title: "Tab 1: Invariant Editor",
        content: `Write custom invariant expressions or choose from presets. Supports up to 8 assets.

**Presets:**
- Constant Product: y = k/x
- Stable Swap: y = k − x − αx (linearized approximation)
- Weighted: y = (k/x^w₁)^(1/w₂)

**Configurable Parameters:**
- Expression input (free-text mathematical notation)
- Weight A / Weight B sliders (0.01 to 0.99, step 0.01)
- k value (invariant constant)
- Amplification (for Stable Swap)
- Range Lower / Range Upper (for concentrated positions)

**Auto-Derived Properties:**
- **Spot Price** — Computed numerically as −Δy/Δx between adjacent curve points
- **Convexity** — Second derivative d²y/dx², computed as Δ(spotPrice)/Δx
- **Liquidity Density** — Classification: Uniform, Concentrated, or Weighted based on curve shape
- **Reserve Ratio** — Displays w₁/w₂ as percentage

**Advanced Features:**
- **Reverse Engineer** — Input a target curve shape, derive the invariant expression
- **5-Objective Expression Optimizer** — Optimize the expression across efficiency, stability, slippage, fee capture, and MEV resistance simultaneously
- **Multi-Asset Support** — Extend to 3-8 assets with per-asset weight configuration`,
      },
      {
        id: "am-fees",
        title: "Tab 2: Fee Structure Editor",
        content: `Design custom fee functions beyond flat rates. The fee structure persists across all tabs.

**Drag-to-Edit Graph:**
- Visual fee curve editor — click and drag points to shape the fee function
- X-axis: trade size (or price level)
- Y-axis: fee rate (0% to 10%)
- Supports multi-point spline interpolation

**Expression Mode:**
- Write mathematical fee expressions
- Example: \`0.003 + 0.01 * abs(price - 1)\` — base 30bps + 1% × price deviation
- Example: \`min(0.01, 0.003 * (1 + vol/0.5))\` — vol-responsive with cap

**IL Breakeven Calculator:**
- Input: annualized volatility
- Output: minimum fee rate to offset expected IL
- Formula: breakEvenFee = IL(vol) / (estimatedVolume × 365)

**Bulk Adjustment Controls:**
- Scale all fees by a multiplier
- Shift fee curve up/down by fixed amount
- Mirror fee curve (symmetric around midpoint)`,
      },
      {
        id: "am-comparison",
        title: "Tab 3: AMM Comparison",
        content: `Side-by-side benchmarking of multiple AMM configurations.

**Import Sources:**
- **Built-in Library** — 6 pre-loaded AMMs: Uniswap V2, Curve StableSwap, Balancer Weighted, Uniswap V3 Concentrated, Solidly ve(3,3), Power Perpetual Curve
- **Cloud Library** — Community-submitted designs
- **JSON Import** — Upload custom configuration files
- **Current Design** — Your active invariant from Tab 1

**Comparison Metrics:**
- Curve shape overlay (normalized to same k)
- Slippage profiles (trade size vs. slippage %)
- IL projections across price ranges
- Capital efficiency ratios
- Fee capture efficiency
- Stability diagnostic summary

**Visualization:**
- Overlay charts with color-coded curves
- Radar chart of multi-dimensional comparison
- Side-by-side metric tables`,
      },
      {
        id: "am-montecarlo",
        title: "Tab 4: Monte Carlo Engine",
        content: `Run large-scale price simulations to estimate return distributions and risk metrics.

**Configuration Panel:**
- **Paths:** 100 to 50,000 (slider with logarithmic scale)
- **Duration:** 7 to 365 days
- **Drift (μ):** Annualized expected return, -50% to +100%
- **Volatility (σ):** Annualized standard deviation, 10% to 200%
- **Jump Diffusion:** Toggle on/off. When enabled: probability p per day, uniform shock ±10%

**Output Dashboard:**
- **Return Distribution Histogram** — Bell curve of terminal returns across all paths
- **VaR (95%)** — 5th percentile of returns. "There's a 5% chance of losing more than this."
- **VaR (99%)** — 1st percentile. More extreme tail risk.
- **CVaR (95%)** — Expected loss given that you're in the worst 5%. Always worse than VaR.
- **Win Rate** — Fraction of paths with positive terminal return
- **Sharpe Ratio** — (mean return − risk-free) / std deviation
- **Skewness** — Asymmetry of return distribution (negative = left tail risk)
- **Kurtosis** — Fat-tailedness (>3 indicates fatter tails than normal)

**Advanced Metrics (researcher-grade):**
- Maximum drawdown distribution
- Time-to-recovery statistics
- Fee accumulation percentiles
- Jump diffusion impact decomposition

**CSV Export:** Download all path data and summary statistics.

See **Mathematical Reference → Monte Carlo Methodology** for full formulas.`,
        interactive: "monte-carlo-mini",
        links: [{ label: "Monte Carlo Methodology", anchor: "math-montecarlo" }],
      },
      {
        id: "am-arbitrage",
        title: "Tab 5: Arbitrage Flow Engine",
        content: `Simulates price divergence between the AMM pool and an external reference price over a 24-hour period at 30-minute intervals (48 data points).

**Configuration:**
- External volatility (σ_ext): scales the divergence amplitude
- Gas cost: threshold for arbitrage profitability (in dollars)
- Latency setting: affects toxic flow fraction

**Simulation Model:**
- Price divergence follows a multi-frequency sinusoidal model:
  divergence(t) = sin(t/2) × σ_ext × 3 + cos(1.3t) × σ_ext × 1.5
- Arbitrage triggers when |divergence| > gasCost/10000
- Volume: arbVolume = |divergence| × L × 0.001

**Toxic Flow Model:**
- Informed flow fraction depends on oracle latency:
  - <100ms: 10% of arb volume is toxic
  - <500ms: 40% toxic
  - ≥500ms: 70% toxic

**Output Metrics:**
- Fee capture: arbVolume × feeRate − toxicFlow × 0.001
- Capture rate: feeCapture / arbVolume
- Net LP position change
- Arbitrageur profit timeline
- Toxic flow decomposition chart

See **Mathematical Reference → Arbitrage & Toxic Flow** for derivations.`,
        links: [{ label: "Arbitrage & Toxic Flow", anchor: "math-arbitrage" }],
      },
      {
        id: "am-liquidity",
        title: "Tab 6: Liquidity Analyzer",
        content: `Diagnostic tools for analyzing liquidity quality of your configured invariant.

**Depth Chart:**
- Bid/ask liquidity at each price level
- Shows effective capital available at different distances from spot price
- Concentrated positions show sharp depth cliffs at range boundaries

**Efficiency Score:**
- Capital utilization ratio: what fraction of deposited capital is actively earning fees
- Constant Product: ~0% at extreme prices, ~100% near spot
- Concentrated: 100% in range, 0% out of range

**Slippage Curve:**
- Trade size (X-axis) vs. Slippage % (Y-axis)
- Comparison overlay with different pool configurations
- Key insight: concentrated positions have lower slippage in-range but infinite slippage at boundaries

**Concentration Map:**
- Heatmap of where liquidity is densest on the invariant curve
- For concentrated positions: sharp peak at active range
- For constant product: uniform flat distribution`,
      },
      {
        id: "am-stability",
        title: "Tab 7: Stability Analysis",
        content: `Five diagnostic checks testing invariant robustness under stress. Each produces a Pass / Warning / Fail status.

**1. Insolvency Edge Cases**
- Tests: Can reserves go negative at extreme prices?
- Method: Evaluate invariant at price = 0.01, 0.1, 0.5, 2, 10, 100
- Concentrated positions flag WARNING due to range boundaries
- FAIL if any evaluation produces negative reserves

**2. Path Dependence**
- Tests: Does trade sequence matter for final LP state?
- Method: Execute same trades in different orders, compare terminal values
- High fees (>0.5%) introduce measurable path dependence because fee-adjusted invariant shifts
- WARNING above 0.1% divergence, FAIL above 1%

**3. Fee Distortion**
- Tests: How much do accumulated fees warp the effective invariant?
- Method: Simulate 1000 fee-accumulating trades, measure curve drift
- Above 0.3% fee tier: measurable drift
- Above 0.8% fee tier: potentially exploitable mispricing
- FAIL if drift exceeds 5%

**4. Inventory Runaway**
- Tests: Does unidirectional price movement cause extreme reserve imbalance?
- Method: Simulate continuous buy pressure, measure reserve ratios
- Weighted pools are naturally resistant (asymmetric exposure absorbs pressure)
- FAIL if one reserve approaches zero while the other grows unbounded

**5. Reflexivity Loops**
- Tests: Can LP withdrawal pressure create a self-reinforcing death spiral?
- Method: Simulate IL → withdrawal → price impact → more IL cascade
- Most dangerous in concentrated liquidity during high volatility
- FAIL if cascade causes >50% additional price impact

**Stress Chart:**
- Line chart showing pool deviation under extreme scenarios
- Compared against a 5% safety threshold (red dotted line)
- Areas above the threshold are highlighted in red`,
      },
      {
        id: "am-mev",
        title: "Tab 8: MEV Analyzer",
        content: `Analyze maximal extractable value (MEV) vulnerabilities against your AMM design.

**Configuration:**
- Number of blocks to simulate (10-500)
- Swaps per block (1-20)
- Attacker budget (in token Y units)
- Toggle: Sandwich attacks, Backruns, JIT liquidity (enable/disable each)

**Attack Types Simulated:**

**Sandwich Attack:**
1. Attacker front-runs a victim trade (buys Y before victim)
2. Victim trade executes at worse price
3. Attacker back-runs (sells Y after victim at higher price)
4. Profit = price difference × victim volume − gas
5. Metric: Extra slippage suffered by victim (attackSlippage − normalSlippage)

**JIT (Just-In-Time) Liquidity:**
1. Attacker adds concentrated liquidity just before a large trade
2. Captures disproportionate fee share
3. Removes liquidity immediately after
4. Metric: Fee share captured vs LP fee dilution

**Backrun Extraction:**
1. After a large trade moves the price
2. Attacker arbitrages the pool back toward the external price
3. Profit = price correction × correction volume − gas
4. Metric: LP value leaked to backrunner

**Output Dashboard:**
- **Protection Score** (0-100): Higher = more MEV resistant. Based on:
  - Sandwich count / total swaps
  - Average sandwich profit per block
  - Total extracted value / total volume
  - Slippage amplification factor
- **Value Flow Breakdown**: Pie chart showing LP earnings vs arbitrageur profit vs searcher profit vs protocol fees
- **Cumulative Extraction Chart**: Line chart of sandwich / backrun / JIT extraction over time vs LP fees
- **Block Summaries**: Per-block table of swap count, MEV events, extracted value, LP fees`,
        interactive: "mev-visualizer",
      },
      {
        id: "am-export",
        title: "Tab 9: Deployment Export",
        content: `Export your AMM design for on-chain deployment.

**Solidity Code Generation:**
- Produces a complete ERC-20 compatible AMM contract
- Imports: OpenZeppelin IERC20, ERC20, ReentrancyGuard
- Includes: swap(), addLiquidity(), removeLiquidity() functions
- Bin weights encoded as uint256 array (scaled by 1e6)
- FEE_BPS constant (default: 30 = 0.30%)
- Full NatSpec documentation with design metadata

**Real-Time ETH Price:**
- Fetches current ETH price from API
- Used for gas cost estimation in USD

**Gas Profiling:**
- Estimated gas per swap operation
- Estimated gas for addLiquidity / removeLiquidity
- Gas cost in USD at current ETH price

**Export Formats:**
- **Solidity (.sol)** — Deploy-ready smart contract
- **JSON (.json)** — Design parameters, metadata, curve definition, bin weights
- **Deployment Checklist** — Security considerations, recommended audit steps, oracle configuration notes`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 6. DESIGN STUDIO
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "design-studio",
    title: "AMM Design Studio",
    subsections: [
      {
        id: "ds-overview",
        title: "Studio Overview",
        content: `The AMM Design Studio is a 4-mode visual design environment accessible from the homepage. It provides a header with mode tabs (Block Builder, Multi-Asset, Time-Variance, Compiler) and a full-height workspace below.

**Navigation:** Back arrow returns to homepage (not Labs).
**Mode Switching:** Click any tab to switch. State is maintained per-mode.
**Badge:** Marked "EXPERIMENTAL" — features may change.`,
      },
      {
        id: "ds-blocks",
        title: "Block Builder",
        content: `Visual drag-and-drop curve design using 40+ composable blocks across 8 categories.

**Block Categories:**

**1. Primitives** (5 blocks) — Base variables:
- X Reserves (x), Y Reserves (y), k (Invariant), Current Price (p), Number (constant)

**2. Operations** (11 blocks) — Math operators:
- Add (+), Subtract (−), Multiply (×), Divide (÷), Power (^)
- Square Root (√), Cube Root (∛), Natural Log (ln), Exponential (e^x)
- Min, Max

**3. Curve Templates** (6 blocks) — Pre-built formulas:
- Constant Product (xy=k), Constant Sum (x+y=k)
- StableSwap (with Amplification parameter: 1-5000)
- Concentrated Liquidity (with Lower/Upper tick params)
- Weighted Pool (with Weight X param: 0.01-0.99)
- Custom Formula (accepts children blocks)

**4. Modifiers** (5 blocks) — Adjust behavior:
- Weight (^w), Amplify (A×), Clamp Range (min/max), Smooth Transition (lerp), Blend Curves

**5. Conditionals** (4 blocks) — Piecewise logic:
- IF Price Above, IF Price Below, IF Price In Range, ELSE

**6. Fee Logic** (3 blocks) — Fee structure:
- Base Fee (fixed rate), Dynamic Fee (scales with volatility), Tiered Fee (step-wise by vol)

**7. Multi-Asset** (8 blocks) — 3+ token pools:
- Z Reserves, W Reserves, Asset N, Multi-Asset Weighted, Multi-Asset StableSwap
- Sum All (Σ), Product All (Π), Geometric Mean, Per-Asset Weight

**8. Time-Variance** (7 blocks) — Time-dependent:
- Current Time (t), Elapsed Time (Δt), Current Epoch
- Time Decay (e^(-t/τ)), Time Ramp (linear), Oscillate (sin(2πt/T)), Keyframe Lerp

**Preview Panel:**
- Real-time curve visualization as you compose blocks
- Spot price overlay
- Liquidity density indicator
- Generated formula string`,
        interactive: "block-taxonomy",
      },
      {
        id: "ds-multiasset",
        title: "Multi-Asset Lab",
        content: `Design invariants for pools with 3-8 tokens.

**Configuration:**
- Token count: 3 to 8 (dropdown)
- Per-token weight (must sum to 1.0)
- Per-token symbol and initial reserve amount
- Base model: Weighted Geometric Mean or Stable Multi-Asset

**Weighted Geometric Mean:**
- Invariant: Π(xᵢ^wᵢ) = k
- Spot price between any pair: Pᵢⱼ = (wᵢ/wⱼ) × (xⱼ/xᵢ)
- Balancer-style — generalizes the 2-token weighted pool

**Stable Multi-Asset (Curve-style):**
- Invariant: An^n Σxᵢ + D = An^n D + D^(n+1) / (n^n Πxᵢ)
- A = amplification parameter (1-5000)
- Near-zero slippage between any pair near peg

**Analysis:**
- 3D invariant surface visualization (for 3-token pools)
- Cross-pair slippage matrix
- Routing efficiency: which swap paths minimize slippage
- Comparison against equivalent 2-token pair decomposition
- Weight sensitivity analysis`,
      },
      {
        id: "ds-timevariance",
        title: "Time-Variance Lab",
        content: `Create curves that evolve over time — for liquidity bootstrapping, seasonal adjustment, and adaptive behavior.

**Keyframe Editor:**
- Timeline with draggable keypoints
- Each keypoint sets parameter values at a specific timestamp
- Parameters: weight, amplification, fee rate, range bounds

**Interpolation Modes:**
- **Linear** — Straight-line transition between keyframes
- **Exponential Decay** — e^(-t/τ) decay toward target value (half-life configurable)
- **Oscillation** — Sinusoidal variation with configurable amplitude and period
- **Step** — Instant switch at keyframe boundary

**Use Cases:**
- **Liquidity Bootstrapping Auction (LBA)** — Start with high token weight (e.g., 90/10), linearly ramp to 50/50 over 72 hours. Creates natural price discovery.
- **Seasonal Fee Adjustment** — Lower fees during low-vol periods, higher during volatile periods
- **Oracle-Driven Adaptation** — Fee or range adjusts based on external price feed deviation
- **Bonding Curve Launch** — Exponential decay from high initial price to equilibrium

**Preview Playback:**
- Animate the curve evolution over the configured time span
- Play / Pause / Seek controls
- Real-time curve shape, spot price, and liquidity density visualization`,
      },
      {
        id: "ds-compiler",
        title: "Invariant Compiler",
        content: `Compile visual block designs or custom expressions to deployable Solidity smart contracts.

**Solidity Generation:**
- Produces ERC-20 compatible AMM contract
- Supports all block types including multi-asset and time-variance
- Includes: swap(), addLiquidity(), removeLiquidity(), getSpotPrice() functions
- Uses OpenZeppelin libraries for security

**Gas Profiling:**
- Estimated gas per swap operation (based on contract complexity)
- Gas for liquidity operations
- Comparison against known AMMs (Uniswap V2 ~150k gas, V3 ~180k)

**Optimization Passes:**
- **Constant Folding** — Pre-compute pure-constant expressions
- **Common Subexpression Elimination** — Reuse repeated calculations
- **Dead Code Elimination** — Remove unreachable conditional branches

**Security Notes:**
- Overflow check warnings for large number operations
- Division-by-zero detection (when reserves approach zero)
- Rounding direction analysis (should round against trader)
- Reentrancy guard recommendations`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 7. EXPERIMENTAL LABS
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "labs",
    title: "Experimental Labs",
    subsections: [
      {
        id: "labs-overview",
        title: "Labs Overview",
        content: `The Labs section (/labs) provides access to 4 specialized research tools via a responsive grid layout. Each lab is marked "EXPERIMENTAL" — features are cutting-edge but may have rough edges.

Labs use cross-referencing: Discovery Atlas candidates can be published to the Library, Library designs can be loaded into the DNA Visualizer, and Market Replay can test any Library AMM.`,
      },
      {
        id: "labs-atlas",
        title: "Invariant Atlas & Discovery Engine",
        content: `A continuous evolutionary search engine for discovering novel AMM designs. The most computationally intensive feature in the platform.

**Architecture:**
- Engine runs in a Web Worker to avoid blocking the UI
- Two-phase evaluation: cheap screening → full simulation
- Cross-tab leader election: only one tab runs the engine; others follow via BroadcastChannel
- "Leader-goodbye" mechanism ensures graceful handoff when the leader tab closes

**Candidate Representation:**
- Each AMM design is a 64-bin liquidity distribution (Float64Array)
- Bins represent liquidity weight across a log-price range [exp(-2) ≈ 0.135 to exp(2) ≈ 7.389]
- Bins always sum to TOTAL_LIQUIDITY (1,000 normalized units)
- Fee rate fixed at 30 bps

**Invariant Families (3 built-in + custom):**

1. **Piecewise Bands** — Concentrated liquidity with discrete tick ranges
   - Parameters: centerMass (0.2-0.85), shoulder (0.05-0.4), skew (-0.45 to 0.45)
   - Generates: peaked distribution with configurable width and asymmetry

2. **Amplified Hybrid** — Smooth concentrated curve with tunable steepness
   - Parameters: amplification (1-12), decay (0.8-4), bias (-0.35 to 0.35)
   - Generates: bell-curve-like distribution with variable kurtosis

3. **Tail Shielded** — Defense-focused design with protective tail liquidity
   - Parameters: tailWeight (0.05-0.45), moatWidth (0.02-0.25), centerBias (0.2-0.8)
   - Generates: bimodal distribution with center mass and tail reserves

**Market Regimes (4):**
- **Low Volatility GBM** — σ=0.3, drift=0, no jumps
- **High Volatility GBM** — σ=1.0, drift=0, no jumps
- **Jump Diffusion** — σ=0.6, 5 jumps/year, mean=-0.05, std=0.15
- **Regime Shift** — σ=0.3 alternating with σ=1.0

**Evolutionary Operators:**
- **Mutation** — Gaussian perturbation of family parameters
- **Crossover** — Three modes:
  - Uniform: per-bin swap with 50% probability
  - Segment: left-half from parent A, right-half from parent B, with blended transition zone
  - Arithmetic: weighted blend of two parents
- **Selection** — Elite fraction (top 25%) survives; rest replaced by offspring
- **CMA-ES** — Covariance Matrix Adaptation for learning parameter correlations (16-dimensional reduced space)
- **MAP-Elites** — 12×12 grid indexed by entropy × peak concentration. Each cell stores the best candidate with those features.

**Metric Vector (7 dimensions per candidate):**
- totalFees, totalSlippage, arbLeakage, liquidityUtilization
- lpValueVsHodl (LP/HODL ratio), maxDrawdown, volatilityOfReturns

**Feature Descriptors (7 dimensions):**
- curvature, curvatureGradient, entropy, symmetry
- tailDensityRatio, peakConcentration, concentrationWidth

**Champion Tracking:**
- Overall champion (best composite score)
- Per-metric champions: Highest Fees, Best Utilization, Best LP/HODL, Lowest Slippage, Lowest Arb Leak, Lowest Drawdown, Most Stable

**Interface Panels:**
- **Live Dashboard** — Real-time generation counter, champion metrics, activity log
- **Pareto Frontier** — Interactive scatter plot of efficiency vs stability trade-offs
- **Head-to-Head Arena** — Real-time simulation battle between two candidates
- **Evolution Replay** — Scrub through generations to watch evolution unfold
- **Family Directory** — Browse all discovered families and their parameter ranges

**Archive & Publishing:**
- Candidates passing quality thresholds are archived every 5 generations
- Archive threshold: slippage ≤ 0.045, drawdown ≤ 0.28, arb leakage ≤ 24, stability ≤ 0.16
- "Publish to Library" persists any candidate to the community library with full metadata`,
        interactive: "family-table",
      },
      {
        id: "labs-strategy",
        title: "Liquidity Strategy Lab",
        content: `Design, backtest, and compare LP strategies using visual block coding over Monte Carlo price simulations.

**Strategy Block Editor (7 categories, 40+ blocks):**

1. **Control Flow** — IF, ELSE IF, ELSE, AND, OR, NOT, ON EVENT (rebalance/cooldown/price exit/vol spike/time interval)

2. **Conditions — Price** — Price Change %, Price > X, Price < X, Price Crosses, Distance from Mid %, Distance from Boundary %

3. **Conditions — Volatility** — Realized Vol %, Vol Change %, Vol Above/Below

4. **Conditions — Liquidity** — Volume Spike %, Fee APR Estimate

5. **Conditions — IL & Performance** — Current IL %, IL Change %, Net PnL %, Drawdown %, Fees Earned %

6. **Conditions — Time** — Days Since Rebalance, Time in Range, Time Out of Range

7. **Actions** — Set Range Width, Increase/Decrease Range, Shift Range, Center Range, Trigger/Delay/Disable Rebalance, Set/Increase/Decrease Hedge Ratio, Set Fee Override, Compound Fees, Exit Position, Re-enter Position

**Strategy Presets (4):**
- **Passive Hold** — Full range, no rebalancing, no stop-loss. Baseline comparison.
- **Range Rebalancer** — ±15% range, rebalance on 1% deviation, 1-day cooldown
- **Volatility Tracker** — ±30% range, rebalance on 5% deviation, 3-day cooldown, 20% hedge
- **Mean Reversion** — ±20% range, rebalance on 10% deviation, 5-day cooldown, 30% hedge

**Simulation Config:**
- Volatility: 10-200% annualized
- Drift: -50% to +100%
- Jump probability: 0-10% daily
- Jump size: 0-20% average
- Paths: 100 to 5,000
- Time horizon: 30-365 days
- Initial capital: configurable
- Fee rate: 1-100 bps

**Backtest Output:**
- Mean/median return, Sharpe ratio, max drawdown, win rate
- Average rebalance count, total fees, total IL, net PnL
- Equity curve: mean with 5th/95th percentile bands
- Return distribution histogram
- Per-strategy comparison table
- Fee vs IL attribution breakdown`,
        interactive: "strategy-block-taxonomy",
      },
      {
        id: "labs-dna",
        title: "AMM DNA Visualizer",
        content: `Visualize the genetic structure and evolutionary history of AMM designs from the Library.

**Genome Fingerprint:**
- 64-bin radial ring visualization
- Each bin's height represents liquidity weight at that log-price level
- Color-coded by concentration: blue (sparse) → red (dense)
- Rotational symmetry shows symmetry score
- Entropy displayed as inner ring opacity

**Feature Radar:**
- Multi-axis radar chart with 7 feature dimensions:
  - Curvature, Entropy, Symmetry, Peak Concentration
  - Tail Density, Concentration Width, Curvature Gradient
- Area fill shows overall feature coverage

**Side-by-Side Comparison:**
- Select two designs from the Library
- Genome rings displayed adjacent
- Feature radar overlaid
- Metric differences highlighted:
  - Green: design A wins
  - Red: design B wins

**Lineage Tree:**
- Trace evolutionary ancestry across generations
- Tree visualization showing parent → child relationships
- Highlights crossover points (which parent contributed which bins)
- Shows mutation events (which parameters changed)
- Only available for designs discovered via the Invariant Atlas`,
      },
      {
        id: "labs-replay",
        title: "Live Market Replay",
        content: `Replay historical market scenarios through any AMM design from the Library.

**8 Curated Scenarios:**

| Scenario | Period | Category | Base Price |
|---|---|---|---|
| LUNA Collapse | Apr-Jul 2022 | Crash | ETH $1,800 |
| FTX Collapse | Oct 2022-Jan 2023 | Crash | ETH $1,800 |
| Black Thursday | Feb-May 2020 | Crash | ETH $1,800 |
| DeFi Summer | Jun-Oct 2020 | Rally | ETH $1,800 |
| The Merge | Jul-Nov 2022 | Volatile | ETH $1,800 |
| 2023 Crab Market | Feb-Sep 2023 | Crab | ETH $1,800 |
| BTC ETF Rally | Oct 2023-Feb 2024 | Rally | BTC $28,000 |
| SOL Revival | Oct 2023-Jan 2024 | Rally | SOL $25 |

**Price Generation:**
- Synthetic prices using GBM with scenario-specific drift and volatility
- Crash scenarios: -0.8% daily drift, 4% daily vol
- Rally scenarios: +0.5% daily drift, 4% daily vol
- Volatile: 0.01% drift, 6% vol
- Crab: 0.01% drift, 1.5% vol
- Crash scenarios include injected spike events (-15% to -40% single-day drops)

**Replay Output:**
- Animated price playback with configurable speed
- Real-time LP Value vs HODL Value line chart
- Fee accumulation curve
- Cumulative IL curve
- Reserve evolution (X and Y over time)

**Summary Statistics:**
- Total return, HODL return, total fees, total IL
- Max drawdown, Sharpe ratio, win rate
- Average daily fee, worst day, best day
- Realized volatility, recovery days

**Crash Event Detection:**
- Automatically detects drawdown events exceeding 10%
- Labels with severity, start/end day, and recovery time
- Displayed as markers on the price chart`,
        interactive: "scenario-list",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 8. AMM LIBRARY
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "library",
    title: "AMM Library",
    subsections: [
      {
        id: "lib-famous",
        title: "Famous AMMs Catalog",
        content: `Pre-loaded designs representing real-world AMM implementations:

- **Uniswap V2** — x × y = k. The baseline constant product AMM. Weights: 50/50.
- **Curve StableSwap** — An²Σxᵢ + D = ADn² + D^(n+1)/(n²Πxᵢ). Amplification: 100. Optimized for stablecoin pairs.
- **Balancer Weighted** — x^0.8 × y^0.2 = k. 80/20 weight split. Minimal IL on the majority token.
- **Uniswap V3 Concentrated** — (√x − √pₐ)(√y − √p_b) = L². Range-bounded concentrated liquidity.
- **Solidly ve(3,3)** — x³y + xy³ = k. Novel invariant optimized for correlated pairs with different properties than StableSwap.
- **Power Perpetual Curve** — x^0.3 × y^0.7 = k. Asymmetric power curve for directional exposure.

Each entry includes: formula, parameters (wA, wB, k, amp), description, category, and can be imported into Advanced Mode or compared.`,
      },
      {
        id: "lib-community",
        title: "Community Designs & Sharing",
        content: `Users can save custom AMM designs to the shared cloud library.

**Saving a Design:**
- Available from: Discovery Atlas (Publish button), Advanced Mode (Export tab), Design Studio
- Metadata captured: name, description, author, category, formula, parameters, bin weights
- Optional: family ID, generation number, score, stability rating, regime, candidate ID

**Discovery Metadata (for evolved designs):**
- Family ID and family parameters (e.g., piecewise-bands with centerMass=0.65)
- Generation number and lineage
- Composite score and per-metric scores
- Feature descriptors (curvature, entropy, symmetry, etc.)

**Categories:** stable-pairs, volatile-pairs, multi-asset, experimental, evolved, community

**Upvoting:** Community members can upvote designs. Sort by upvotes, date, or score.

**Cloud Storage:**
- Designs stored in a cloud database (library_amms table)
- Fields: name, formula, params (JSON), bins (JSON), metrics (JSON), features (JSON), family_params (JSON)
- No authentication required for reading; designs are publicly browsable`,
      },
      {
        id: "lib-backtest",
        title: "Historical Backtest",
        content: `Test any library AMM against simulated price data.

**Workflow:**
1. Select a design from the Library
2. Choose a scenario (from the 8 curated market scenarios or custom parameters)
3. Run the backtest

**Output:**
- Cumulative fees over time
- IL evolution
- Net PnL timeline
- Drawdown waterfall chart
- Comparison against passive holding
- Comparison against other library designs (multi-line overlay)

**Export:** Download results as summary report.`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 9. MATHEMATICAL REFERENCE
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "math-reference",
    title: "Mathematical Reference",
    subsections: [
      {
        id: "math-models",
        title: "AMM Invariant Models",
        content: `**Constant Product (x · y = k)**
- Spot price: P = y/x = −dy/dx
- Slippage for trade Δx: slippage = Δx / (x + Δx)
- Liquidity: Uniform across all prices from 0 to ∞
- Capital efficiency: 1.0x (baseline)
- IL for price ratio r: IL = 2√r/(1+r) − 1

**Stable Swap (x + y + α·xy = k)**
- Near-zero slippage for small trades around peg
- Slippage grows quadratically: ~pct² × 50
- Capital efficiency: ~3.1x vs constant product near peg
- Amplification α controls blend between constant-sum and constant-product

**Weighted Pool (x^w₁ · y^w₂ = k), w₁ + w₂ = 1**
- Spot price: P = (w₁/w₂) × (y/x)
- IL is reduced proportional to weight asymmetry
- Capital efficiency: ~1.5x (weight-dependent)
- For 80/20 pool, IL at 2x price change: ~3.5% (vs 5.7% for 50/50)

**Concentrated Liquidity (√x · √y = √k in [pₐ, pᵦ])**
- Virtual reserves: x_virtual = x + L/√pᵤ, y_virtual = y + L√pₗ
- Capital efficiency: 1/(1 − √(pₗ/pᵤ)) — up to 4000x for narrow ranges
- Position goes inactive outside range (earns no fees)
- IL is amplified: IL_concentrated ≈ IL_fullrange × efficiency_multiplier

**Solidly ve(3,3) (x³y + xy³ = k)**
- Designed for correlated pairs (like StableSwap but with different curvature)
- Smoother transition from flat to steep regions
- Lower gas cost than multi-iteration StableSwap`,
        interactive: "curve-comparison",
      },
      {
        id: "math-il",
        title: "Impermanent Loss",
        content: `**Derivation (Constant Product)**

Starting position: x₀ tokens of A and y₀ tokens of B at price P₀ = y₀/x₀.
After price changes to P₁, the pool rebalances to maintain x·y = k.

New reserves: x₁ = √(k/P₁), y₁ = √(k·P₁)

LP value: V_lp = x₁·P₁ + y₁ = 2√(k·P₁)
HODL value: V_hodl = x₀·P₁ + y₀

For price ratio r = P₁/P₀:

    IL = V_lp/V_hodl − 1 = 2√r / (1 + r) − 1

This is always ≤ 0 (a loss). The loss is symmetric — a 2x increase produces the same IL as a 0.5x decrease.

**Key IL Values:**
| Price Change | IL | Notes |
|---|---|---|
| ±10% (1.1x or 0.91x) | −0.11% | Negligible for most fee tiers |
| ±25% (1.25x or 0.8x) | −0.6% | Easily covered by 30bps fees |
| ±50% (1.5x or 0.67x) | −2.0% | Significant — requires volume |
| 2x or 0.5x | −5.7% | Major loss for low-fee pools |
| 3x or 0.33x | −13.4% | Devastating without hedging |
| 5x or 0.2x | −25.5% | Near-total IL |

**Model Adjustments:**
- Stable Swap: IL × 0.3 (correlated assets — price rarely diverges far)
- Weighted (80/20): IL × 0.7 (majority token protected)
- Concentrated (±5% range): IL × ~20 (amplified by capital efficiency factor)

**When IL Doesn't Matter:**
- Stablecoin pairs (USDC/USDT): price ratio stays near 1
- Fee income exceeds IL: high-volume pools can be net positive
- Short time horizons: IL is "impermanent" — it reverses if price returns`,
        interactive: "il-calculator",
      },
      {
        id: "math-slippage",
        title: "Slippage Models",
        content: `**Constant Product (exact)**

For a trade of Δx against pool reserves x:

    slippage = Δx / (x + Δx)

This simplifies to approximately Δx/x for small trades (first-order approximation).

**Examples:**
| Trade Size (% of reserves) | Slippage |
|---|---|
| 0.1% | 0.1% |
| 1% | 0.99% |
| 5% | 4.76% |
| 10% | 9.09% |
| 50% | 33.3% |

**Stable Swap**

Slippage grows quadratically near the peg:

    slippage ≈ (Δx/x)² × 50

For a 1% trade: slippage ≈ 0.01² × 50 = 0.005 (0.5%) — much better than constant product's 0.99%.

**Concentrated Liquidity**

Within the active range, effective reserves are amplified:
    effective_x = x × efficiency_multiplier

Slippage formula remains Δx/(effective_x + Δx), but effective_x is much larger.
Result: dramatically lower slippage in-range, but infinite slippage at range boundaries.

**Price Impact**

The marginal price function is the negative first derivative of the invariant curve:

    P(x) = −dy/dx

The second derivative captures **convexity** — how rapidly price impact increases:

    convexity = d²y/dx²

High convexity means small trades have low impact but large trades have rapidly escalating impact (concentrated liquidity). Low convexity means more uniform impact (constant product).`,
        interactive: "slippage-explorer",
      },
      {
        id: "math-montecarlo",
        title: "Monte Carlo Methodology",
        content: `**Price Path Model (GBM with Jump Diffusion)**

Geometric Brownian Motion with optional Poisson jump process:

    S(t+dt) = S(t) × exp((μ − σ²/2)dt + σ√dt × Z + J)

Where:
- μ = annualized drift rate
- σ = annualized volatility
- Z ~ N(0,1) via Box-Muller transform
- J = jump component: with probability p per step, sample from U(-0.1, 0.1)
- dt = 1/365 (daily time step)

**Random Number Generation**

Deterministic pseudo-random generator for reproducibility:

    rng(seed) = frac(sin(seed) × 10000)

Returns values in [0, 1). Seeded PRNGs ensure identical results for identical inputs.

**Box-Muller Transform** (converts uniform → standard normal):

    U₁, U₂ ~ Uniform(0, 1)
    Z = √(−2 ln(U₁)) × cos(2π U₂)

**Risk Metrics Computation:**

**VaR (Value at Risk):**
- Sort terminal returns ascending
- VaR(α) = returns[floor(N × (1−α))]
- VaR(95%) = 5th percentile of returns

**CVaR (Conditional VaR / Expected Shortfall):**
- Mean of all returns below VaR
- CVaR(95%) = E[return | return < VaR(95%)]
- Always worse than VaR (more conservative)

**Win Rate:**
- Count of paths with positive terminal return / total paths

**Sharpe Ratio:**
- (mean return − risk-free rate) / std deviation of returns
- Risk-free rate assumed 0 in simulations

**Statistical Convergence:**
- 1,000+ paths: stable VaR estimates (±2% at 95% confidence)
- 5,000+ paths: stable CVaR estimates
- 10,000+ paths: reliable tail statistics (kurtosis, skewness)
- 50,000 paths: production-grade estimates for all metrics`,
      },
      {
        id: "math-arbitrage",
        title: "Arbitrage & Toxic Flow",
        content: `**Price Divergence Model**

External price deviates from AMM price following a multi-frequency sinusoidal:

    divergence(t) = sin(t/2) × σ_ext × 3 + cos(1.3t) × σ_ext × 1.5

This captures the oscillating nature of real divergences — prices diverge, arbitrageurs correct, then diverge again.

**Arbitrage Trigger Condition:**

    |divergence(t)| > gasCost / 10000

Only profitable arbitrage occurs. Sub-gas-cost divergences go uncorrected.

**Arbitrage Volume:**

    arbVolume = |divergence| × L × 0.001

Where L = pool liquidity (total value locked).

**Toxic Flow Model:**

Informed (toxic) flow is a fraction of arbitrage volume, increasing with oracle latency:

    toxicFlow = arbVolume × f(latency)

Where:
    f(latency < 100ms) = 0.10 (10% toxic)
    f(latency < 500ms) = 0.40 (40% toxic)
    f(latency ≥ 500ms) = 0.70 (70% toxic)

**Intuition:** Higher latency means the AMM's price is stale for longer, giving informed traders more time to extract value.

**Fee Capture Efficiency:**

    feeCapture = arbVolume × feeRate − toxicFlow × 0.001
    captureRate = feeCapture / arbVolume

A captureRate > 0 means the pool is profitable from arbitrage. High toxic flow can drive this negative.`,
      },
      {
        id: "math-risk",
        title: "Risk Metrics Reference",
        content: `**Estimated Daily Fees**

    dailyFees = liquidity × feeRate × volatilityMultiplier × 0.01

Volatility multiplier proxies the relationship between volatility and trading volume:
- Low vol (σ < 40%): multiplier = 0.5
- Medium vol (40% ≤ σ < 80%): multiplier = 1.0
- High vol (σ ≥ 80%): multiplier = 2.0

**Maximum Drawdown**

    maxDrawdown = volatilityMultiplier × 8% + concentratedPremium

Concentrated liquidity positions add a 12% premium due to amplified IL and range exit risk:
    concentratedPremium = isConcentrated ? 12% : 0%

**Capital Efficiency**

Ratio of effective trading depth to capital deployed:
| Model | Efficiency | Notes |
|---|---|---|
| Constant Product | 1.0x | Baseline |
| Weighted Pool | 1.5x | Modest improvement |
| Stable Swap | 3.1x | Near peg only |
| Concentrated (±5%) | ~20x | In-range only |
| Concentrated (±1%) | ~100x | Very narrow |

**Break-even Volatility**

    breakEvenVol = (feeRate × 365 × 100) / volatilityMultiplier

The annualized volatility at which fee income exactly offsets expected IL. Below this threshold, LPing is expected to be unprofitable.

**Downside Deviation**

    downsideDev = volatilityMultiplier × 4.2%

Standard deviation of negative returns only. More relevant than total volatility for risk assessment.

**Sharpe Ratio**

    sharpe = (meanReturn − riskFreeRate) / stdDev(returns)

Computed across all Monte Carlo paths. Higher = better risk-adjusted return. Above 1.0 is generally considered good.`,
        interactive: "fee-breakeven",
      },
      {
        id: "math-stability",
        title: "Stability Diagnostics",
        content: `Five diagnostic checks, each with a specific testing methodology:

**1. Insolvency Test**
- Evaluate invariant at prices: [0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 100.0]
- For each price, compute implied reserves
- PASS: All reserves positive
- WARNING: Concentrated position (range boundaries expected)
- FAIL: Any negative reserve

**2. Path Dependence Test**
- Generate N trade sequences (same trades, different orders)
- Execute each sequence against fresh pool
- Compare terminal LP values
- Metric: max(|V_i − V_mean|) / V_mean
- PASS: <0.1% divergence
- WARNING: 0.1-1% divergence
- FAIL: >1% divergence

**3. Fee Distortion Test**
- Start with fresh pool
- Execute 1000 random trades with fees
- After each trade, measure distance from original invariant curve
- Metric: average curve displacement
- PASS: <1% displacement
- WARNING: 1-5% displacement
- FAIL: >5% displacement

**4. Inventory Runaway Test**
- Simulate 200 unidirectional trades (continuous buy pressure)
- Track reserve ratio (X/Y) over time
- Metric: final reserve ratio
- PASS: ratio < 100:1
- WARNING: ratio between 100:1 and 1000:1
- FAIL: ratio > 1000:1 or one reserve ≈ 0

**5. Reflexivity Cascade Test**
- Simulate IL exceeding threshold → LP withdrawal → price impact → more IL
- Model: 10 cascade steps with 5% withdrawal per step
- Metric: cumulative additional price impact
- PASS: <5% additional impact
- WARNING: 5-20% additional impact
- FAIL: >20% additional impact or pool drain`,
      },
      {
        id: "math-mev",
        title: "MEV Attack Models",
        content: `**Sandwich Attack Simulation**

1. **Normal baseline:** Execute victim trade alone, record slippage
2. **Frontrun:** Attacker buys output token with budget = 2× victim size
3. **Victim trade:** Executes at worse price (higher slippage)
4. **Backrun:** Attacker sells acquired tokens at the now-elevated price
5. **MEV extracted:** Additional slippage × victim volume

    sandwichProfit = victimResult.slippage − normalResult.slippage

**JIT Liquidity Simulation**

1. Attacker detects large pending trade in mempool
2. Adds concentrated liquidity (narrow range around current price)
3. Large trade executes — attacker earns disproportionate fees
4. Attacker removes liquidity immediately
5. Impact: Dilutes existing LPs' fee share for that block

**Backrun Simulation**

1. Large trade moves pool price away from external price
2. Arbitrageur trades pool back toward external price
3. Profit = |price_deviation| × correction_volume − gas

**Protection Score Formula:**

    protectionScore = 100 − (
      25 × sandwichRate +
      25 × avgSandwichProfit/maxProfit +
      25 × totalExtracted/totalVolume +
      25 × slippageAmplification
    )

Score 0-100. Higher = more resistant. Factors:
- Sandwich rate (sandwich events / total swaps)
- Average sandwich profit (normalized)
- Total extraction rate
- Slippage amplification factor`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 10. LIMITATIONS
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "limitations",
    title: "Limitations & Assumptions",
    subsections: [
      {
        id: "lim-simulation",
        title: "Simulation Limitations",
        content: `1. **Simplified RNG** — Uses sin()-based hashing (rng = frac(sin(seed) × 10000)). Lower statistical quality than Mersenne Twister or xoshiro256++. Adequate for education, not production risk modeling. Passes basic uniformity tests but fails advanced randomness tests.

2. **Static Liquidity** — All simulations assume pool liquidity remains constant. Real pools experience dynamic LP entry/exit that affects depth, fee share, and IL exposure. No LP competition is modeled.

3. **No Real Market Data** — Market replay uses synthetic price paths shaped to match historical patterns. These are approximations, not actual tick-level data feeds. The crash timing, magnitude, and recovery are stylized.

4. **Deterministic Divergence** — The arbitrage price divergence model uses sinusoidal functions rather than stochastic processes. Real divergences are driven by order flow, MEV searcher competition, and network latency — all stochastic.

5. **Fee Compounding Not Modeled** — Fees accumulate separately and are not reinvested into the pool. In reality, some protocols compound fees (increasing k), which affects IL calculations.

6. **Gas Costs Fixed** — Gas is modeled as a constant dollar amount, not as a function of network congestion, base fee dynamics, or priority fee auctions.

7. **Stable Swap Approximation** — Uses linearized form (x + y + αxy = k) rather than the full iterative Newton's method solution of the Curve Finance equation: An^n Σxᵢ + D = ADn^n + D^(n+1)/(n^n Πxᵢ). The approximation diverges at extreme reserve ratios.

8. **Browser Constraints** — Heavy computations (50K Monte Carlo paths, large MAP-Elites archives, CMA-ES with 16D covariance matrix) may be slow on devices with <4GB RAM or older CPUs. Web Workers mitigate UI blocking but memory limits apply.

9. **No Multi-Pool Routing** — Simulations model a single isolated pool. Real DEX aggregators route through multiple pools simultaneously, which affects individual pool dynamics.

10. **No Oracle Manipulation** — The MEV analyzer does not model oracle manipulation attacks (e.g., TWAP manipulation, flash loan oracle attacks).`,
      },
      {
        id: "lim-model",
        title: "Model Assumptions",
        content: `**Price Process:**
- Prices follow GBM with optional Poisson jumps
- No mean reversion (except in regime-shift scenario)
- No autocorrelation in returns
- Volatility is constant within a scenario (no GARCH/stochastic vol)

**Pool Behavior:**
- No governance: fee rates don't change dynamically
- No protocol fees (all fees go to LPs)
- No flash loan interactions
- Pool is the sole venue (no DEX aggregator routing)
- Arbitrageurs are infinitely fast (instant correction above threshold)

**Economic Assumptions:**
- Risk-free rate = 0
- No transaction costs for LPs (only for traders)
- Infinite attacker capital in MEV simulations
- No market maker competition (single LP provider)

**Numerical Precision:**
- All calculations use JavaScript's 64-bit floating point (IEEE 754 double precision)
- Float64Array for bin weights (sufficient for 64-bin resolution)
- CMA-ES covariance matrix in 16-dimensional reduced space (not full 64D) for tractability`,
      },
    ],
  },
];
