

# Applications Page — Fully Customizable Bot Builder with Block Coding

## Concept

Instead of picking from 5 preset bot types (Noise, Arbitrageur, etc.), users build bot trading strategies using the same **block coding system** already used for LP strategies (`strategy-blocks.ts`). Each bot is a custom block program that reads market state and outputs trade decisions. Presets exist only as starter templates that can be fully edited.

## What Changes

### 1. New file: `src/lib/bot-blocks.ts`
Bot-specific block definitions, reusing the same `BlockInstance` architecture from `strategy-blocks.ts`:

**Categories:**
- **Sensors** — read market state: `pool_price`, `external_price`, `price_deviation_pct`, `ema(period)`, `bollinger_band(period, stddev)`, `realized_vol(window)`, `order_flow_imbalance`, `reserve_ratio`, `time_elapsed`
- **Conditions** — same pattern as strategy blocks: comparisons, AND/OR/NOT logic, threshold crossings
- **Actions** — `buy(size_mode, amount)`, `sell(size_mode, amount)`, `market_buy`, `market_sell`, `skip_tick`. Size mode can be fixed $, % of capital, or "close gap" (for arb)
- **Modifiers** — `cooldown(ticks)`, `max_position(%)`, `stop_loss(%)`, `take_profit(%)`, `slippage_limit(bps)`, `capital_allocation(%)`
- **Timing** — `every_n_ticks`, `poisson_arrival(rate)`, `on_signal_change`
- **Math** — `ema_crossover`, `mean_revert_signal`, `momentum_score`, `random_uniform`, `power_law_size`

**Starter templates** (fully editable block programs):
- Noise Trader: `every poisson(rate) → buy_or_sell(random, lognormal_size)`
- Arbitrageur: `if price_deviation > threshold → trade to close gap`
- Trend Follower: `if ema_fast crosses above ema_slow → buy; crosses below → sell`
- Mean Reversion: `if price < bollinger_lower → buy; > bollinger_upper → sell`
- Whale: `every poisson(low_rate) → trade(power_law_size)`

### 2. New file: `src/lib/testnet-engine.ts`
Simulation engine:
- Price generators: GBM, Ornstein-Uhlenbeck, logistic (prediction market), custom
- Pool state manager using `amm-engine.ts` primitives
- Bot executor: each tick, evaluate each bot's block program against current state, collect trade actions, execute in order
- Metrics collector: price history, trade log, per-bot P&L, pool fees, reserves, slippage

### 3. New file: `src/components/apps/BotBlockEditor.tsx`
Reuses the drag-and-drop block editor pattern from `StrategyBlockEditor.tsx` but with bot-specific blocks. Users can:
- Add multiple bots, each with its own block program
- Name and color-code bots
- Set per-bot capital allocation
- Use templates as starting points then customize everything
- Duplicate/fork bots for A/B comparison

### 4. New file: `src/pages/Applications.tsx`
Three-section layout:

**Setup Panel (left sidebar):**
- AMM selector (from library or Design Studio)
- Market type picker with full parameter customization (vol, drift, jump params, mean-reversion speed, etc.)
- Initial liquidity and fee rate
- Simulation speed and duration controls

**Bot Builder (center, expandable):**
- Tabbed bot editor — each tab is one bot with its own block program
- Block palette on left, canvas on right (same as Strategy Block Editor)
- Quick-add from templates
- Per-bot settings: capital, color, enable/disable

**Live Dashboard (right / below):**
- Real-time price chart (pool vs external)
- Trade flow waterfall (color-coded by bot)
- Reserve gauge, fee accumulation, slippage heatmap
- Bot P&L leaderboard
- Play/pause/speed controls
- Export results (JSON/CSV)

### 5. Edit: `src/App.tsx`
Add `/applications` route.

### 6. Edit: `src/pages/Index.tsx`
Add Applications NavCard on homepage.

### 7. Edit: `src/lib/documentation-content.ts`
Add Applications/Testnet docs section covering bot block coding and market types.

## Files Summary

| File | Action |
|------|--------|
| `src/lib/bot-blocks.ts` | Create — bot block definitions + templates |
| `src/lib/testnet-engine.ts` | Create — simulation loop, price generators, bot executor |
| `src/components/apps/BotBlockEditor.tsx` | Create — drag-and-drop bot strategy editor |
| `src/pages/Applications.tsx` | Create — full page with setup, bot builder, dashboard |
| `src/App.tsx` | Edit — add route |
| `src/pages/Index.tsx` | Edit — add NavCard |
| `src/lib/documentation-content.ts` | Edit — add docs section |

