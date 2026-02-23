

# Liquidity Strategy Lab

A new experimental lab where you design, backtest, and compare LP strategies over simulated (or historical-style synthetic) price paths. The lab uses your chosen invariant and fee structure to evaluate how different active management rules perform vs passive LPing.

---

## Core Concept

You define **LP strategies** as sets of rules (when to enter/exit ranges, how to rebalance, whether to hedge), then run them against Monte Carlo price simulations using the AMM engine. The lab produces detailed performance breakdowns: fee income, IL, net PnL, Sharpe ratio, and more -- letting you find the optimal strategy for a given invariant design.

---

## Tab Structure (sidebar navigation with Previous/Next buttons, matching existing lab pattern)

### 1. Strategy Editor
- **Preset strategies** to start from: Passive Hold, Range Rebalancer, Volatility Tracker, Mean Reversion
- Each strategy is defined by editable parameters:
  - **Range width** (e.g., +/-10% around spot)
  - **Rebalance trigger** (deviation threshold before repositioning)
  - **Rebalance cooldown** (minimum time between adjustments)
  - **Exit conditions** (stop-loss threshold, max IL tolerance)
  - **Hedge ratio** (0-100%, simulates delta-neutral hedging cost)
- Up to 3 strategies can be configured side-by-side for comparison
- Session persistence (same pattern as Advanced Mode's `sessionStorage`)

### 2. Simulation Config
- Market parameters: volatility, drift, jump probability, jump size (reuses Monte Carlo conventions)
- Number of paths and time horizon
- Initial capital allocation
- Fee structure: loads from session if saved, or uses default
- Invariant selection: loads from session or picks constant-product default
- "Run Backtest" button triggers the simulation

### 3. Results Dashboard
- **Equity curves**: overlay of all strategies' cumulative PnL over time (line chart)
- **Fee vs IL attribution**: stacked area chart showing fee income vs impermanent loss per day
- **Return distribution**: histogram of final returns per strategy
- **Key metrics table**: Mean Return, Sharpe Ratio, Max Drawdown, Win Rate, Avg Rebalance Count, Total Fees Earned, Total IL, Net PnL
- **Rebalance events timeline**: scatter overlay on the equity curve showing when each strategy rebalanced

### 4. Compare (AMMComparison)
- Reuses the existing `AMMComparison` component to import a library AMM and compare strategy performance across different invariant shapes

### 5. Deploy
- Export strategy config + backtest results as JSON
- Reuses `DeploymentExport` component pattern with strategy metadata included

---

## New Files

| File | Purpose |
|------|---------|
| `src/pages/LiquidityStrategyLab.tsx` | Main page, sidebar + tab routing (follows MultiAssetLab pattern) |
| `src/components/labs/StrategyEditor.tsx` | Strategy preset picker + parameter editors for up to 3 strategies |
| `src/components/labs/StrategyBacktest.tsx` | Simulation config panel + "Run Backtest" trigger |
| `src/components/labs/StrategyResults.tsx` | Results dashboard with equity curves, attribution charts, metrics table |
| `src/lib/strategy-engine.ts` | Pure computation: strategy simulation loop, rebalance logic, metric calculations |

## Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add route `/labs/strategy` |
| `src/pages/Labs.tsx` | Add Liquidity Strategy Lab card with icon and description |

---

## Technical Details

### Strategy Engine (`strategy-engine.ts`)
- Runs on top of the existing `amm-engine.ts` primitives (`createPool`, `executeTrade`, `executeArbitrage`, `gbmStep`, `calcIL`, `lpValue`, `hodlValue`)
- For each simulated day on each path:
  1. Step the external price via GBM
  2. Execute arbitrage to align pool price
  3. Check strategy rules (is price outside range? has cooldown elapsed?)
  4. If rebalance triggered: withdraw liquidity, reposition at new range, record gas/slippage cost
  5. Accumulate fees, track IL, compute equity
- Outputs per-path time series and aggregate statistics

### Strategy Presets
```text
Passive Hold:     range=infinite, no rebalancing
Range Rebalancer: range=+/-15%, rebalance when price exits range
Volatility Track: range=2x rolling vol, adjusts width dynamically
Mean Reversion:   widens range on high vol, narrows on low vol
```

### Session Integration
- Reads `advanced_invariant` and `advanced_fees` from sessionStorage (same keys as Advanced Mode)
- Stores strategy configs under `strategy_lab_config`
- The Deploy tab includes strategy parameters alongside invariant/fee data

### UI Pattern
- Follows the exact same sidebar layout as MultiAssetLab and TimeVarianceLab
- Uses the same `surface-elevated` card styling, `ChevronUp`/`ChevronDown` sidebar collapse, and `Previous`/`Next` navigation buttons
- Charts use `useChartColors()` hook and recharts (consistent with all other labs)

