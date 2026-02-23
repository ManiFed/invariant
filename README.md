Methodology & Documentation
Complete technical reference for Invariant Studio's simulation engine, mathematical models, and risk metrics.

About Invariant Studio
Invariant Studio is an open educational platform for designing, simulating, and stress-testing automated market maker (AMM) mechanisms.

Who is it for?
- Students & Researchers — Learn AMM mechanics through interactive simulations with guided courses - DeFi Developers — Prototype and test custom invariant functions before deploying to mainnet - Liquidity Providers — Understand impermanent loss, fee dynamics, and capital efficiency before committing capital - Protocol Designers — Explore novel bonding curve shapes with real-time risk analytics

What can you do?
- Beginner Mode: Step-by-step guided pool design with plain-English scenarios and risk profiles - Teaching Lab: A 7-module interactive course covering AMM fundamentals from reserves to concentrated liquidity - Advanced Mode: Symbolic invariant editor, Monte Carlo simulations (up to 50K paths), arbitrage flow modeling, stability analysis, and deployment export - AI Assistant: Ask questions about any AMM concept and get instant explanations

Technology
Invariant Studio runs entirely in-browser — no backend dependency for simulations. All computations (GBM price paths, IL calculations, curve evaluation) are performed client-side for instant feedback and reproducibility. The AI assistant connects to a cloud function for natural language Q&A.

Philosophy
We believe the best way to learn finance is to break things in a sandbox. Every chart is interactive, every parameter is adjustable, and every formula is visible. There are no black boxes.

1. Overview
Invariant Studio is a dual-mode platform for designing, simulating, and stress-testing automated market maker (AMM) mechanisms. The platform provides both a guided Beginner Mode for intuitive experimentation and an Advanced Mode for formal invariant engineering.

All simulations are deterministic and reproducible. The platform operates entirely client-side with no external data dependencies.

2. AMM Models
2.1 Constant Product (x · y = k)
The foundational AMM invariant, used by Uniswap V2. The product of token reserves must remain constant after every trade (excluding fees).

- Spot price: P = y/x = -dy/dx - Slippage for trade Δx: slippage = Δx / (x + Δx) - Liquidity distribution: Uniform across all prices from 0 to ∞ - Capital efficiency: 1.0x (baseline)

2.2 Stable Swap (x + y + α·xy = k)
A hybrid invariant combining constant sum and constant product, designed for correlated asset pairs (e.g., stablecoins). The parameter α controls the curvature — higher α concentrates liquidity around the 1:1 ratio.

- Near-zero slippage for small trades around peg - Slippage grows quadratically: ~pct² × 50 - Capital efficiency: ~3.1x vs constant product near peg

2.3 Weighted Pool (x^w₁ · y^w₂ = k)
Generalized constant product where w₁ + w₂ = 1 but w₁ ≠ w₂. This creates asymmetric exposure — the majority-weighted token experiences less impermanent loss.

- Spot price: P = (w₁/w₂) × (y/x) - IL is reduced proportional to weight asymmetry - Capital efficiency: ~1.5x (weight-dependent)

2.4 Concentrated Liquidity (√x · √y = √k in range [pₐ, pᵦ])
Liquidity is deployed within a specific price range rather than across all prices. Within the active range, this is mathematically equivalent to a virtual constant product pool with amplified reserves.

- Capital efficiency: up to 4000x for narrow ranges - Position goes inactive (earns no fees) outside range - IL is amplified proportional to concentration factor

3. Impermanent Loss
Definition
Impermanent loss (IL) measures the value difference between holding tokens in an AMM pool versus holding them outright. It occurs whenever the price ratio of the pooled tokens diverges from the entry ratio.

Formula (Constant Product)
For a price change ratio r = P_new / P_initial:

IL = 2√r / (1 + r) − 1
This is always ≤ 0 (a loss). The loss is symmetric — a 2x price increase produces the same IL as a 0.5x decrease.

Key values: | Price Change | IL | |---|---| | 1.25x | -0.6% | | 1.50x | -2.0% | | 2.00x | -5.7% | | 3.00x | -13.4% | | 5.00x | -25.5% |

Adjustments by Model: - Stable Swap: IL × 0.3 (correlated assets reduce divergence) - Weighted Pool: IL × 0.7 (asymmetric weighting reduces exposure) - Concentrated: IL × 1.8 (concentrated range amplifies losses)

4. Slippage Model
Definition
Slippage is the difference between the expected execution price and the actual price received. It increases with trade size relative to pool depth.

Constant Product (exact)
For a trade of Δx against pool reserves x:

slippage = Δx / (x + Δx)
This simplifies to approximately Δx/x for small trades.

Stable Swap
Slippage grows quadratically near the peg:

slippage ≈ (Δx/x)² × 50
This reflects the flat curve region near the 1:1 ratio.

Price Impact
The marginal price function is the negative first derivative of the invariant curve (-dy/dx). The second derivative (d²y/dx²) captures the convexity — how rapidly price impact increases with trade size.

5. Monte Carlo Simulation
Price Path Model
Prices follow Geometric Brownian Motion (GBM) with optional jump-diffusion:

S(t+dt) = S(t) × exp((μ − σ²/2)dt + σ√dt × Z + J)
Where: - μ = annualized drift rate - σ = annualized volatility - Z ~ N(0,1) via Box-Muller transform - J = jump component: with probability p, a uniform shock in [-0.1, 0.1] - dt = 1/365 (daily steps)

Random Number Generation
The simulation uses a deterministic pseudo-random generator based on sin() for reproducibility:

rng(seed) = frac(sin(seed) × 10000)
Box-Muller transform converts uniform samples to normal:

Z = √(-2 ln(U₁)) × cos(2π U₂)
Risk Metrics
- VaR (Value at Risk): The α-percentile of the return distribution. VaR(95%) means there is a 5% probability of losses exceeding this value. - CVaR (Conditional VaR): The expected loss given that losses exceed VaR. CVaR(95%) = E[Loss | Loss > VaR(95%)]. - Win Rate: Fraction of paths with positive terminal return.

Statistical Notes: - Paths are independent but share the same RNG seed structure for reproducibility - 1,000+ paths typically produce stable VaR estimates (±2% at 95% confidence) - 10,000 paths recommended for CVaR convergence

6. Arbitrage Flow Engine
Model
The engine simulates price divergence between the AMM pool and an external reference price over a 24-hour period at 30-minute intervals.

Price Divergence
Modeled as a sinusoidal function scaled by external volatility:

divergence(t) = sin(t/2) × σ_ext × 3 + cos(1.3t) × σ_ext × 1.5
This captures the oscillating nature of real price divergences.

Arbitrage Volume
Arbitrage occurs when the divergence exceeds the gas cost threshold:

arbVolume = |divergence| × L × 0.001    (if |divergence| > gasCost/10000)
Where L is pool liquidity.

Toxic Flow
Informed (toxic) flow is modeled as a fraction of arbitrage volume, increasing with latency:

toxicFlow = arbVolume × f(latency)
Where f(latency) = 0.1 if <100ms, 0.4 if <500ms, 0.7 if ≥500ms.

Fee Capture Efficiency
feeCapture = arbVolume × feeRate − toxicFlow × 0.001
    captureRate = feeCapture / arbVolume
7. Stability Analysis
Checks Performed
The stability module runs five diagnostic checks:

1. Insolvency Edge Cases: Tests whether the invariant maintains positive reserves across extreme price ranges. Concentrated liquidity positions flag a warning due to range boundaries.

2. Path Dependence: Evaluates whether LP returns depend on the sequence of trades (not just final state). High fees introduce path dependence because the fee-adjusted invariant shifts after each trade.

3. Fee Distortion: Measures how accumulated fees distort the effective invariant curve. Above 0.3% fee tier, the accumulated drift becomes measurable. Above 0.8%, it can create exploitable mispricing.

4. Inventory Runaway: Detects conditions where one-sided price movement causes extreme inventory imbalance. Weighted pools are resistant due to asymmetric exposure.

5. Reflexivity Loops: Identifies conditions where LP withdrawal pressure (from IL) causes further price impact, creating a feedback loop. Most dangerous in concentrated liquidity during high volatility.

Stress Response
The stress chart shows pool deviation under extreme scenarios, compared to a 5% safety threshold.

8. Risk Dashboard Metrics
Estimated Daily Fees
dailyFees = liquidity × feeRate × volatilityMultiplier × 0.01
The volatility multiplier (0.5 for low, 1 for medium, 2 for high) approximates the relationship between volatility and trading volume.

Maximum Drawdown
maxDrawdown = volatilityMultiplier × 8% + concentratedPremium
Concentrated positions add a 12% premium due to amplified IL and range exit risk.

Capital Efficiency
Ratio of effective trading depth to capital deployed: - Constant Product: 1.0x (baseline) - Stable Swap: 3.1x (concentrated near peg) - Weighted: 1.5x (modest improvement from asymmetric weighting) - Concentrated: 4.2x (range-bounded amplification)

Break-even Volatility
breakEvenVol = (feeRate × 365 × 100) / volatilityMultiplier
The annualized volatility at which fee income exactly offsets expected impermanent loss.

Downside Deviation
downsideDev = volatilityMultiplier × 4.2%
Measures the standard deviation of negative returns only, providing a risk metric focused on losses.

9. Invariant Editor
Supported Presets
1. Constant Product: y = k/x 2. Stable Swap: y = k − x − αx (simplified linear approximation near peg) 3. Weighted: y = (k/x^w₁)^(1/w₂)

Auto-derived Properties
- Spot Price: Computed numerically as -Δy/Δx between adjacent curve points - Convexity: Second derivative d²y/dx², computed as Δ(spotPrice)/Δx - Liquidity Density: Characterization of how reserves are distributed (Uniform, Concentrated, or Weighted) - Reserve Ratio: Displays the w₁/w₂ weight split as a percentage

Custom Expressions
Users can enter arbitrary expressions. The editor accepts standard mathematical notation and evaluates the invariant curve numerically.

10. Limitations & Assumptions
1. Simplified RNG: The pseudo-random generator uses sin()-based hashing, which has lower statistical quality than Mersenne Twister or xoshiro. Adequate for educational simulation, not for production risk modeling.

2. No Multi-asset Correlation: The Monte Carlo engine simulates single-asset price paths. Correlated multi-asset dynamics are not modeled.

3. Static Liquidity: Simulations assume liquidity remains constant. Real pools experience dynamic LP entry/exit.

4. No MEV Modeling: The arbitrage engine does not model maximal extractable value (MEV), sandwich attacks, or block-level ordering effects.

5. Deterministic Divergence: The arbitrage price divergence model uses sinusoidal functions rather than stochastic processes.

6. Fee Compounding: Fee reinvestment into the pool is not modeled — fees accumulate separately.

7. Gas Costs: Gas is modeled as a fixed dollar cost, not as a function of network congestion.

8. Stable Swap Approximation: The stable swap invariant uses a linearized form rather than the full Curve Finance StableSwap equation (An^n Σx_i + D = ADn^n + D^(n+1) / n^n Πx_i).

