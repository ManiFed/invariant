

## Errors & Improvements Found

### Bugs to Fix

1. **NavCard badge not rendered as styled element** — `Index.tsx` line 163 renders `{badge}` as raw string text instead of a styled badge chip. The `badgeColor` prop is accepted but never used.

2. **Design Studio back button navigates to `/labs`** — Since Design Studio was promoted to top-level, the back arrow in `AMMDesignStudio.tsx` line 59 should navigate to `/` instead of `/labs`.

3. **Dynamic Tailwind classes in Labs grid won't work** — `Labs.tsx` line 72-73 uses template literals like `` bg-${lab.color}/10 `` and `` text-${lab.color} ``. Tailwind purges these at build time since they're not full static class names. Colors will be invisible.

4. **Duplicate comment on TeachingLab line 312-313** — Minor: `// Determine what to show based on progress` appears twice.

5. **Documentation is stale** — The "About" section and feature list don't mention Design Studio, Labs consolidation, MEV in Advanced Mode, challenges in Teaching Lab, or the block builder. The doc says "dual-mode platform" when there are now 5+ entry points.

### Improvements

6. **Homepage "Support" card layout broken** — Line 114-126: uses `flex-row` but the content (h3, p, a) needs vertical stacking. The `mb-2`/`mb-3` margins suggest it was designed for `flex-col`.

---

## Comprehensive Documentation Plan

Replace the current 10-section static doc with a full platform reference covering every feature. Structure:

```text
DOCUMENTATION
├── About Invariant Studio
│   ├── Who is it for
│   ├── Platform architecture (client-side, no backend)
│   └── Philosophy
├── Getting Started
│   ├── Homepage navigation guide
│   ├── Choosing your path (Teaching → Beginner → Advanced → Studio)
│   └── AI Assistant usage
├── Teaching Lab
│   ├── Course levels (Beginner / Intermediate / Advanced)
│   ├── Module structure & XP system
│   ├── Interactive simulation controls
│   └── Challenges (difficulty tiers, metrics, completion)
├── Beginner Mode
│   ├── Template selection (4 models)
│   ├── Parameter configuration
│   ├── Pool health score
│   ├── Swap simulator
│   ├── Scenario runner
│   └── Guided tour walkthrough
├── Advanced Mode
│   ├── Invariant Editor (presets, custom expressions, multi-asset)
│   ├── Fee Structure Editor (drag graph, expressions, IL breakeven)
│   ├── AMM Comparison (import, benchmark)
│   ├── Monte Carlo Engine (GBM, jump diffusion, VaR/CVaR)
│   ├── Arbitrage Flow Engine (divergence model, toxic flow)
│   ├── Liquidity Analyzer (depth, efficiency, slippage)
│   ├── Stability Analysis (5 diagnostic checks)
│   ├── MEV Analyzer (sandwich, JIT, backrun)
│   └── Deployment Export (Solidity, JSON)
├── AMM Design Studio
│   ├── Block Builder (visual coding, categories)
│   ├── Multi-Asset Lab (3+ tokens, weighted/stable)
│   ├── Time-Variance Lab (keyframes, decay, oscillation)
│   └── Invariant Compiler (Solidity generation, gas profiling)
├── Experimental Labs
│   ├── Invariant Atlas & Discovery (MAP-Elites, Pareto)
│   ├── Liquidity Strategy Lab (block editor, backtest)
│   ├── AMM DNA Visualizer (genome rings, lineage)
│   └── Live Market Replay (scenarios, drawdown)
├── AMM Library
│   ├── Famous AMMs catalog
│   ├── Community designs
│   ├── Upvoting & export
│   └── Historical backtest
├── Mathematical Reference
│   ├── AMM Models (constant product, stable swap, weighted, concentrated)
│   ├── Impermanent Loss formula & tables
│   ├── Slippage models
│   ├── Monte Carlo methodology (GBM, Box-Muller, RNG)
│   ├── Arbitrage & toxic flow model
│   ├── Risk metrics (VaR, CVaR, Sharpe, drawdown)
│   └── Stability diagnostics
└── Limitations & Assumptions
```

### Implementation approach

- Keep the same page structure (sidebar TOC + scrollable content) but generate sections from a comprehensive data array
- Add anchor-linked sidebar with collapsible subsections
- Each feature section includes: what it does, how to use it, key parameters, and links to the mathematical reference
- Preserve all existing math content, expand with Design Studio / Labs / MEV / Challenges docs
- Add a "Getting Started" quick-start guide at the top
- Cross-link between sections (e.g. "See Mathematical Reference > Impermanent Loss" from the Beginner Mode section)

### Bug fixes summary

All 6 items above will be fixed in the same pass: badge rendering, back nav, Tailwind dynamic classes, duplicate comment, stale docs, and support card layout.

