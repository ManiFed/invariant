

# AMM Challenges / Puzzle Mode

A gamified challenge system where users solve progressively harder AMM design puzzles, scored on how well their solution meets specific constraints.

## Concept

A standalone `/challenges` page with 8-10 curated challenges across 3 difficulty tiers (Beginner, Intermediate, Expert). Each challenge presents a scenario with constraints (e.g., "Design a pool for stablecoins with < 0.1% slippage on $50k trades") and the user configures parameters to meet the goal. A scoring engine evaluates their solution in real-time.

## Challenge Examples

- **"The Stablecoin Peg"** (Beginner): Keep slippage under 0.05% for a DAI/USDC pair during normal volume. Teaches stable swap curves.
- **"Survive the Crash"** (Intermediate): Design a pool that limits IL to < 5% during a 60% price drop. Teaches concentrated liquidity tradeoffs.
- **"Fee Maximizer"** (Intermediate): Maximize fee revenue over 90 days of volatile trading. Teaches fee tier selection.
- **"The Flash Crash"** (Expert): Maintain pool solvency during a Black Thursday replay. Teaches reserve management.
- **"MEV Shield"** (Expert): Minimize extractable value from sandwich attacks. Teaches protection mechanisms.

## Architecture

### New Files
- **`src/pages/Challenges.tsx`** — Main page: challenge grid, difficulty filters, progress tracking
- **`src/lib/challenge-engine.ts`** — Challenge definitions, constraint evaluation, scoring logic
- **`src/components/challenges/ChallengeCard.tsx`** — Card component for the grid
- **`src/components/challenges/ChallengeWorkbench.tsx`** — The solve interface: parameter controls on left, live score/metrics on right, animated pass/fail indicators

### Routing
- Add `/challenges` route in `App.tsx`
- Add nav card on `Index.tsx`

### Scoring Engine (`challenge-engine.ts`)
Each challenge defines:
```text
{
  id, name, difficulty, description, story,
  constraints: [{ metric, operator, target, weight }],
  defaultParams, allowedTemplates,
  evaluate(params) → { score: 0-100, passed: boolean, breakdown[] }
}
```

Reuses existing `amm-engine.ts` functions (`createPool`, `executeTrade`, `simulateArbitrage`) to run the actual simulation, then checks results against constraints.

### Workbench UI
- Left panel: template selector + parameter sliders (reuses patterns from BeginnerMode)
- Right panel: live constraint checklist with green/red indicators, overall score gauge, animated celebration on pass
- "Run Simulation" button triggers evaluation
- Star rating (1-3 stars) based on how much you beat the constraints by

### Progress Tracking
- `localStorage` persistence for completed challenges and best scores
- Progress bar on the main grid showing completion percentage
- Unlockable challenges (Expert tier locked until 3 Intermediate challenges completed)

### Visual Design
- Matches existing site aesthetic (surface-elevated cards, monospace accents, framer-motion animations)
- Each challenge has a thematic icon and color
- Animated confetti or particle burst on first completion of a challenge

## What It Reuses
- `amm-engine.ts` for all pool simulation
- Template definitions from BeginnerMode
- Chart components (recharts) for showing simulation results
- Existing UI primitives (Card, Button, Slider, Tabs, Progress)

## Scope
~4 files, ~1200 lines. No database needed — all client-side with localStorage for progress.

