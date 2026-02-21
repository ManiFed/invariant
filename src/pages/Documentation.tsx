import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const sections = [
  {
    id: "overview",
    title: "1. Overview",
    content: `Invariant Studio is a dual-mode platform for designing, simulating, and stress-testing automated market maker (AMM) mechanisms. The platform provides both a guided Beginner Mode for intuitive experimentation and an Advanced Mode for formal invariant engineering.

All simulations are deterministic and reproducible. The platform operates entirely client-side with no external data dependencies.`,
  },
  {
    id: "amm-models",
    title: "2. AMM Models",
    content: `**2.1 Constant Product (x · y = k)**

The foundational AMM invariant, used by Uniswap V2. The product of token reserves must remain constant after every trade (excluding fees).

- Spot price: P = y/x = -dy/dx
- Slippage for trade Δx: slippage = Δx / (x + Δx)
- Liquidity distribution: Uniform across all prices from 0 to ∞
- Capital efficiency: 1.0x (baseline)

**2.2 Stable Swap (x + y + α·xy = k)**

A hybrid invariant combining constant sum and constant product, designed for correlated asset pairs (e.g., stablecoins). The parameter α controls the curvature — higher α concentrates liquidity around the 1:1 ratio.

- Near-zero slippage for small trades around peg
- Slippage grows quadratically: ~pct² × 50
- Capital efficiency: ~3.1x vs constant product near peg

**2.3 Weighted Pool (x^w₁ · y^w₂ = k)**

Generalized constant product where w₁ + w₂ = 1 but w₁ ≠ w₂. This creates asymmetric exposure — the majority-weighted token experiences less impermanent loss.

- Spot price: P = (w₁/w₂) × (y/x)
- IL is reduced proportional to weight asymmetry
- Capital efficiency: ~1.5x (weight-dependent)

**2.4 Concentrated Liquidity (√x · √y = √k in range [pₐ, pᵦ])**

Liquidity is deployed within a specific price range rather than across all prices. Within the active range, this is mathematically equivalent to a virtual constant product pool with amplified reserves.

- Capital efficiency: up to 4000x for narrow ranges
- Position goes inactive (earns no fees) outside range
- IL is amplified proportional to concentration factor`,
  },
  {
    id: "impermanent-loss",
    title: "3. Impermanent Loss",
    content: `**Definition**

Impermanent loss (IL) measures the value difference between holding tokens in an AMM pool versus holding them outright. It occurs whenever the price ratio of the pooled tokens diverges from the entry ratio.

**Formula (Constant Product)**

For a price change ratio r = P_new / P_initial:

    IL = 2√r / (1 + r) − 1

This is always ≤ 0 (a loss). The loss is symmetric — a 2x price increase produces the same IL as a 0.5x decrease.

**Key values:**
| Price Change | IL |
|---|---|
| 1.25x | -0.6% |
| 1.50x | -2.0% |
| 2.00x | -5.7% |
| 3.00x | -13.4% |
| 5.00x | -25.5% |

**Adjustments by Model:**
- Stable Swap: IL × 0.3 (correlated assets reduce divergence)
- Weighted Pool: IL × 0.7 (asymmetric weighting reduces exposure)
- Concentrated: IL × 1.8 (concentrated range amplifies losses)`,
  },
  {
    id: "slippage",
    title: "4. Slippage Model",
    content: `**Definition**

Slippage is the difference between the expected execution price and the actual price received. It increases with trade size relative to pool depth.

**Constant Product (exact)**

For a trade of Δx against pool reserves x:

    slippage = Δx / (x + Δx)

This simplifies to approximately Δx/x for small trades.

**Stable Swap**

Slippage grows quadratically near the peg:

    slippage ≈ (Δx/x)² × 50

This reflects the flat curve region near the 1:1 ratio.

**Price Impact**

The marginal price function is the negative first derivative of the invariant curve (-dy/dx). The second derivative (d²y/dx²) captures the convexity — how rapidly price impact increases with trade size.`,
  },
  {
    id: "monte-carlo",
    title: "5. Monte Carlo Simulation",
    content: `**Price Path Model**

Prices follow Geometric Brownian Motion (GBM) with optional jump-diffusion:

    S(t+dt) = S(t) × exp((μ − σ²/2)dt + σ√dt × Z + J)

Where:
- μ = annualized drift rate
- σ = annualized volatility
- Z ~ N(0,1) via Box-Muller transform
- J = jump component: with probability p, a uniform shock in [-0.1, 0.1]
- dt = 1/365 (daily steps)

**Random Number Generation**

The simulation uses a deterministic pseudo-random generator based on sin() for reproducibility:

    rng(seed) = frac(sin(seed) × 10000)

Box-Muller transform converts uniform samples to normal:

    Z = √(-2 ln(U₁)) × cos(2π U₂)

**Risk Metrics**

- **VaR (Value at Risk)**: The α-percentile of the return distribution. VaR(95%) means there is a 5% probability of losses exceeding this value.
- **CVaR (Conditional VaR)**: The expected loss given that losses exceed VaR. CVaR(95%) = E[Loss | Loss > VaR(95%)].
- **Win Rate**: Fraction of paths with positive terminal return.

**Statistical Notes:**
- Paths are independent but share the same RNG seed structure for reproducibility
- 1,000+ paths typically produce stable VaR estimates (±2% at 95% confidence)
- 10,000 paths recommended for CVaR convergence`,
  },
  {
    id: "arbitrage",
    title: "6. Arbitrage Flow Engine",
    content: `**Model**

The engine simulates price divergence between the AMM pool and an external reference price over a 24-hour period at 30-minute intervals.

**Price Divergence**

Modeled as a sinusoidal function scaled by external volatility:

    divergence(t) = sin(t/2) × σ_ext × 3 + cos(1.3t) × σ_ext × 1.5

This captures the oscillating nature of real price divergences.

**Arbitrage Volume**

Arbitrage occurs when the divergence exceeds the gas cost threshold:

    arbVolume = |divergence| × L × 0.001    (if |divergence| > gasCost/10000)

Where L is pool liquidity.

**Toxic Flow**

Informed (toxic) flow is modeled as a fraction of arbitrage volume, increasing with latency:

    toxicFlow = arbVolume × f(latency)

Where f(latency) = 0.1 if <100ms, 0.4 if <500ms, 0.7 if ≥500ms.

**Fee Capture Efficiency**

    feeCapture = arbVolume × feeRate − toxicFlow × 0.001
    captureRate = feeCapture / arbVolume`,
  },
  {
    id: "stability",
    title: "7. Stability Analysis",
    content: `**Checks Performed**

The stability module runs five diagnostic checks:

1. **Insolvency Edge Cases**: Tests whether the invariant maintains positive reserves across extreme price ranges. Concentrated liquidity positions flag a warning due to range boundaries.

2. **Path Dependence**: Evaluates whether LP returns depend on the sequence of trades (not just final state). High fees introduce path dependence because the fee-adjusted invariant shifts after each trade.

3. **Fee Distortion**: Measures how accumulated fees distort the effective invariant curve. Above 0.3% fee tier, the accumulated drift becomes measurable. Above 0.8%, it can create exploitable mispricing.

4. **Inventory Runaway**: Detects conditions where one-sided price movement causes extreme inventory imbalance. Weighted pools are resistant due to asymmetric exposure.

5. **Reflexivity Loops**: Identifies conditions where LP withdrawal pressure (from IL) causes further price impact, creating a feedback loop. Most dangerous in concentrated liquidity during high volatility.

**Stress Response**

The stress chart shows pool deviation under extreme scenarios, compared to a 5% safety threshold.`,
  },
  {
    id: "risk-metrics",
    title: "8. Risk Dashboard Metrics",
    content: `**Estimated Daily Fees**

    dailyFees = liquidity × feeRate × volatilityMultiplier × 0.01

The volatility multiplier (0.5 for low, 1 for medium, 2 for high) approximates the relationship between volatility and trading volume.

**Maximum Drawdown**

    maxDrawdown = volatilityMultiplier × 8% + concentratedPremium

Concentrated positions add a 12% premium due to amplified IL and range exit risk.

**Capital Efficiency**

Ratio of effective trading depth to capital deployed:
- Constant Product: 1.0x (baseline)
- Stable Swap: 3.1x (concentrated near peg)
- Weighted: 1.5x (modest improvement from asymmetric weighting)
- Concentrated: 4.2x (range-bounded amplification)

**Break-even Volatility**

    breakEvenVol = (feeRate × 365 × 100) / volatilityMultiplier

The annualized volatility at which fee income exactly offsets expected impermanent loss.

**Downside Deviation**

    downsideDev = volatilityMultiplier × 4.2%

Measures the standard deviation of negative returns only, providing a risk metric focused on losses.`,
  },
  {
    id: "invariant-editor",
    title: "9. Invariant Editor",
    content: `**Supported Presets**

1. Constant Product: y = k/x
2. Stable Swap: y = k − x − αx (simplified linear approximation near peg)
3. Weighted: y = (k/x^w₁)^(1/w₂)

**Auto-derived Properties**

- **Spot Price**: Computed numerically as -Δy/Δx between adjacent curve points
- **Convexity**: Second derivative d²y/dx², computed as Δ(spotPrice)/Δx
- **Liquidity Density**: Characterization of how reserves are distributed (Uniform, Concentrated, or Weighted)
- **Reserve Ratio**: Displays the w₁/w₂ weight split as a percentage

**Custom Expressions**

Users can enter arbitrary expressions. The editor accepts standard mathematical notation and evaluates the invariant curve numerically.`,
  },
  {
    id: "limitations",
    title: "10. Limitations & Assumptions",
    content: `1. **Simplified RNG**: The pseudo-random generator uses sin()-based hashing, which has lower statistical quality than Mersenne Twister or xoshiro. Adequate for educational simulation, not for production risk modeling.

2. **No Multi-asset Correlation**: The Monte Carlo engine simulates single-asset price paths. Correlated multi-asset dynamics are not modeled.

3. **Static Liquidity**: Simulations assume liquidity remains constant. Real pools experience dynamic LP entry/exit.

4. **No MEV Modeling**: The arbitrage engine does not model maximal extractable value (MEV), sandwich attacks, or block-level ordering effects.

5. **Deterministic Divergence**: The arbitrage price divergence model uses sinusoidal functions rather than stochastic processes.

6. **Fee Compounding**: Fee reinvestment into the pool is not modeled — fees accumulate separately.

7. **Gas Costs**: Gas is modeled as a fixed dollar cost, not as a function of network congestion.

8. **Stable Swap Approximation**: The stable swap invariant uses a linearized form rather than the full Curve Finance StableSwap equation (An^n Σx_i + D = ADn^n + D^(n+1) / n^n Πx_i).`,
  },
];

const Documentation = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 bg-background z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">DOCUMENTATION</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex">
        {/* Sidebar TOC */}
        <aside className="hidden lg:block w-64 border-r border-border p-5 sticky top-[49px] h-[calc(100vh-49px)] overflow-y-auto">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contents</h4>
          <nav className="space-y-1">
            {sections.map(s => (
              <a key={s.id} href={`#${s.id}`} className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-1 truncate">
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 max-w-3xl mx-auto px-8 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold text-foreground mb-2">Methodology & Documentation</h1>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Complete technical reference for Invariant Studio's simulation engine, mathematical models, and risk metrics.
            </p>
          </motion.div>

          <div className="space-y-12">
            {sections.map((section, i) => (
              <motion.section
                key={section.id}
                id={section.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 }}
              >
                <h2 className="text-xl font-bold text-foreground mb-4 border-b border-border pb-2">{section.title}</h2>
                <div className="prose-custom">
                  {section.content.split('\n\n').map((paragraph, j) => {
                    if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                      return <h3 key={j} className="text-sm font-semibold text-foreground mt-6 mb-2">{paragraph.replace(/\*\*/g, '')}</h3>;
                    }
                    if (paragraph.startsWith('    ')) {
                      return (
                        <pre key={j} className="bg-secondary border border-border rounded-lg px-4 py-3 my-3 text-xs font-mono text-foreground overflow-x-auto">
                          {paragraph.trim()}
                        </pre>
                      );
                    }
                    if (paragraph.startsWith('|')) {
                      const rows = paragraph.split('\n').filter(r => !r.startsWith('|---'));
                      const headers = rows[0]?.split('|').filter(Boolean).map(h => h.trim());
                      const bodyRows = rows.slice(1);
                      return (
                        <table key={j} className="w-full text-xs my-3 border border-border rounded-lg overflow-hidden">
                          <thead>
                            <tr className="bg-secondary">
                              {headers?.map((h, hi) => <th key={hi} className="text-left py-2 px-3 text-muted-foreground font-medium">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {bodyRows.map((row, ri) => (
                              <tr key={ri} className="border-t border-border">
                                {row.split('|').filter(Boolean).map((cell, ci) => (
                                  <td key={ci} className="py-2 px-3 font-mono-data text-foreground">{cell.trim()}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    }
                    // Handle inline bold
                    const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);
                    return (
                      <p key={j} className="text-sm text-muted-foreground leading-relaxed mb-3">
                        {parts.map((part, k) =>
                          part.startsWith('**') && part.endsWith('**')
                            ? <strong key={k} className="text-foreground font-semibold">{part.replace(/\*\*/g, '')}</strong>
                            : <span key={k}>{part}</span>
                        )}
                      </p>
                    );
                  })}
                </div>
              </motion.section>
            ))}
          </div>

          <footer className="mt-16 pt-8 border-t border-border text-center text-xs text-muted-foreground">
            Invariant Studio — Technical Documentation v1.0
          </footer>
        </main>
      </div>
    </div>
  );
};

export default Documentation;
