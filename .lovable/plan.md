

# New Features for Invariant Studio

Four major additions to make this a DeFi power tool: Solidity Export, Global Leaderboard, Fork & Remix, and Historical Backtest.

---

## 1. Solidity Smart Contract Export

**What:** "Export Solidity" button on every Library AMM detail modal. Generates a deploy-ready `.sol` file implementing the candidate's exact liquidity distribution as a constant-product variant with configurable fee tiers.

**Where:**
- New file `src/lib/codegen-solidity.ts` — template engine that maps `familyId`, `familyParams`, and `bins` to Solidity code (hardcoded bin array as `uint256[]`, swap function with binary search over bins, fee accumulator, ERC-20 LP token)
- Add "Export Solidity" button to both detail modals in `src/pages/Library.tsx` (the `selectedAMM` modal and the `selectedDbAMM` modal)
- Syntax-highlighted preview in a modal (using `<pre>` with monospace styling) with copy-to-clipboard and `.sol` file download

**Templates:** Three contract variants based on family:
- `PiecewiseBandsPool.sol` — concentrated liquidity with discrete tick ranges
- `AmplifiedHybridPool.sol` — Curve-style amplified invariant
- `TailShieldedPool.sol` — custom tail protection logic

Each includes: constructor with bin config, `swap()`, `addLiquidity()`, `removeLiquidity()`, fee collection, and events.

---

## 2. Global Leaderboard

**What:** A new "Leaderboard" tab/section on the Library page showing the top-scoring AMM designs across all time, auto-ranked by composite score per regime.

**Where:**
- Add a `"leaderboard"` filter option alongside the existing `all/famous/featured/community` tabs in `src/pages/Library.tsx`
- Sort community DB AMMs by `score` (ascending = better) grouped by regime
- Show rank badges (#1, #2, #3), score, regime, family, upvotes, and contributor name
- Top 3 per regime get gold/silver/bronze styling
- No new DB table needed — the existing `library_amms` table already has `score`, `regime`, `upvotes`

---

## 3. Fork & Remix

**What:** "Fork to Atlas" button on any Library AMM. Injects the design as a seed candidate into the Discovery Engine so the evolutionary search can mutate and improve it.

**Where:**
- Add "Fork to Atlas" button to both Library detail modals in `src/pages/Library.tsx`
- On click: serialize the AMM's `bins`, `familyId`, `familyParams`, and `regime` into localStorage under a key like `atlas-fork-seed`
- In `src/hooks/use-discovery-engine.ts`, on mount check for `atlas-fork-seed` in localStorage. If present, inject it as a high-priority candidate into the matching regime's population, then clear the key
- Navigate to `/labs/discover` after setting the seed
- For famous AMMs (which don't have bins), generate approximate bins from the formula params using the closest matching `InvariantFamily`

---

## 4. Historical Backtest

**What:** Run any Library AMM against real historical price data (fetched from CoinGecko free API) instead of synthetic Monte Carlo paths.

**Where:**
- New server endpoint in `server.mjs`: `GET /api/price-history?pair=ETH-USDC&days=365` — fetches from CoinGecko, caches in a new Postgres table `price_cache` for 24h
- New file `src/lib/historical-backtest.ts` — takes a candidate's bins + a real price series and simulates LP performance (fees, IL, equity curve) using the same swap/arb logic from `discovery-engine.ts`
- New component `src/components/library/HistoricalBacktest.tsx` — shows equity curve (line chart), cumulative fees, IL, and final LP vs HODL ratio
- Add "Backtest on Real Data" button to the Library detail modals. Opens an expandable section below the existing charts showing the backtest results
- Pair selector dropdown (ETH/USDC, BTC/USDC, SOL/USDC) and timeframe selector (90d, 180d, 365d)

**DB migration:** Create `price_cache` table in Postgres via server.mjs `ensureAtlasTables` (no Supabase migration needed since this runs on the self-hosted server).

---

## Implementation Order

1. **Solidity Export** — pure client-side, no backend changes
2. **Global Leaderboard** — pure client-side, reuses existing DB data
3. **Fork & Remix** — client-side with localStorage bridge between Library and Atlas
4. **Historical Backtest** — requires new server endpoint + price cache table + new component

---

## Technical Notes

- Solidity codegen is entirely client-side string templates — no compiler needed
- Leaderboard reuses the existing `loadLibraryAMMs()` query, just adds client-side sorting/grouping
- Fork seed injection happens at engine init, before the first generation runs
- Price history endpoint uses CoinGecko's free `/coins/{id}/market_chart` endpoint (no API key required for basic usage)
- The backtest simulation reuses `evaluateCandidate`'s core swap logic but replaces GBM price generation with the real price series

