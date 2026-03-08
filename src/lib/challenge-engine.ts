// Challenge definitions and scoring engine
import { createPool, executeTrade, executeArbitrage, gbmStep, calcIL, lpValue, hodlValue, poolPrice } from "./amm-engine";

export type Difficulty = "beginner" | "intermediate" | "expert";

export interface ChallengeConstraint {
  metric: string;
  label: string;
  operator: "<" | ">" | "<=" | ">=" ;
  target: number;
  unit: string;
  weight: number;
}

export interface ChallengeParams {
  reserveX: number;
  reserveY: number;
  feeRate: number;
  amplification: number; // for stable swap
  concentrationLower: number; // price range lower bound (ratio)
  concentrationUpper: number; // price range upper bound (ratio)
}

export interface SliderConfig {
  reserveX: { min: number; max: number; step: number; format?: (v: number) => string };
  reserveY: { min: number; max: number; step: number; format?: (v: number) => string };
  feeRate: { min: number; max: number; step: number };
  concentrationLower: { min: number; max: number; step: number };
  concentrationUpper: { min: number; max: number; step: number };
}

const DEFAULT_SLIDERS: SliderConfig = {
  reserveX: { min: 10, max: 1000, step: 10 },
  reserveY: { min: 10000, max: 2000000, step: 10000 },
  feeRate: { min: 1, max: 100, step: 1 },
  concentrationLower: { min: 10, max: 100, step: 5 },
  concentrationUpper: { min: 100, max: 500, step: 10 },
};

export interface ConstraintResult {
  constraint: ChallengeConstraint;
  actual: number;
  passed: boolean;
  score: number; // 0-100 per constraint
}

export interface ChallengeResult {
  score: number; // 0-100
  stars: 0 | 1 | 2 | 3;
  passed: boolean;
  breakdown: ConstraintResult[];
}

export interface Challenge {
  id: string;
  name: string;
  difficulty: Difficulty;
  icon: string;
  description: string;
  story: string;
  constraints: ChallengeConstraint[];
  defaultParams: ChallengeParams;
  solutionParams: ChallengeParams;
  hints: string[];
  evaluate: (params: ChallengeParams) => ChallengeResult;
}

// ─── Simulation helpers ─────────────────────────────────────────────

function simulateSlippage(params: ChallengeParams, tradeSize: number): number {
  const pool = createPool(params.reserveX, params.reserveY, params.feeRate);
  const { result } = executeTrade(pool, tradeSize, "buyY");
  return result.slippagePct;
}

function simulateIL(params: ChallengeParams, priceChangePct: number): number {
  const initialPrice = params.reserveY / params.reserveX;
  const newPrice = initialPrice * (1 + priceChangePct / 100);
  // For concentrated liquidity, IL is amplified
  let il = Math.abs(calcIL(initialPrice, newPrice));
  if (params.concentrationUpper - params.concentrationLower < 1.5) {
    const rangeWidth = params.concentrationUpper / params.concentrationLower;
    il *= Math.max(1, 3 / rangeWidth);
  }
  return il;
}

function simulateFeeRevenue(params: ChallengeParams, days: number, annualVol: number): number {
  let pool = createPool(params.reserveX, params.reserveY, params.feeRate);
  const dt = 1 / 365;
  let extPrice = poolPrice(pool);

  for (let d = 0; d < days; d++) {
    extPrice = gbmStep(extPrice, annualVol, dt);
    const arbResult = executeArbitrage(pool, extPrice);
    pool = arbResult.pool;
    // Random organic trades
    const tradeSize = (params.reserveX * 0.005) * (0.5 + Math.random());
    const dir = Math.random() > 0.5 ? "buyY" as const : "buyX" as const;
    const { pool: p2 } = executeTrade(pool, tradeSize, dir);
    pool = p2;
  }
  return pool.totalFees;
}

function simulateCrash(params: ChallengeParams, crashPct: number): { maxDrawdownPct: number; finalIL: number; solvent: boolean } {
  let pool = createPool(params.reserveX, params.reserveY, params.feeRate);
  const initialLPVal = lpValue(pool, poolPrice(pool));
  const initX = params.reserveX;
  const initY = params.reserveY;
  let minLPVal = initialLPVal;
  let extPrice = poolPrice(pool);
  const targetPrice = extPrice * (1 - crashPct / 100);
  const steps = 50;

  for (let i = 0; i <= steps; i++) {
    extPrice = poolPrice(pool) + (targetPrice - poolPrice(pool)) * (i / steps) + (Math.random() - 0.5) * extPrice * 0.02;
    extPrice = Math.max(extPrice, targetPrice * 0.8);
    const arbResult = executeArbitrage(pool, extPrice);
    pool = arbResult.pool;
    const currentVal = lpValue(pool, extPrice);
    if (currentVal < minLPVal) minLPVal = currentVal;
  }

  const finalVal = lpValue(pool, extPrice);
  const holdVal = hodlValue(initX, initY, extPrice);
  const maxDrawdownPct = ((initialLPVal - minLPVal) / initialLPVal) * 100;
  const finalIL = ((finalVal - holdVal) / holdVal) * 100;

  return { maxDrawdownPct, finalIL: Math.abs(finalIL), solvent: pool.x > 0 && pool.y > 0 };
}

function simulateMEV(params: ChallengeParams): number {
  // Simulate sandwich attack: frontrun trade, victim trade, backrun trade
  let pool = createPool(params.reserveX, params.reserveY, params.feeRate);
  const victimSize = params.reserveX * 0.01; // 1% of reserves
  
  // Frontrun: attacker buys Y
  const frontrunSize = victimSize * 2;
  const { pool: p1, result: frontResult } = executeTrade(pool, frontrunSize, "buyY");
  
  // Victim trade
  const { pool: p2, result: victimResult } = executeTrade(p1, victimSize, "buyY");
  
  // Backrun: attacker sells Y (sell the Y they bought)
  const { pool: p3 } = executeTrade(p2, frontResult.output, "buyX");
  
  // MEV extracted = slippage amplification from sandwich
  const normalPool = createPool(params.reserveX, params.reserveY, params.feeRate);
  const { result: normalResult } = executeTrade(normalPool, victimSize, "buyY");
  
  const extraSlippage = victimResult.slippagePct - normalResult.slippagePct;
  return Math.max(0, extraSlippage);
}

// ─── Scoring ─────────────────────────────────────────────────────────

function scoreConstraint(constraint: ChallengeConstraint, actual: number): { passed: boolean; score: number } {
  const { operator, target } = constraint;
  let passed = false;
  switch (operator) {
    case "<": passed = actual < target; break;
    case ">": passed = actual > target; break;
    case "<=": passed = actual <= target; break;
    case ">=": passed = actual >= target; break;
  }

  if (passed) {
    // Bonus scoring: how much better than target?
    const overshoot = operator === "<" || operator === "<="
      ? Math.max(0, (target - actual) / target)
      : Math.max(0, (actual - target) / target);
    return { passed: true, score: Math.min(100, 70 + overshoot * 60) };
  } else {
    // Partial credit based on how close
    const distance = Math.abs(actual - target) / Math.max(Math.abs(target), 0.001);
    return { passed: false, score: Math.max(0, 50 * (1 - distance)) };
  }
}

function buildResult(constraints: ChallengeConstraint[], actuals: number[]): ChallengeResult {
  const breakdown: ConstraintResult[] = constraints.map((c, i) => {
    const { passed, score } = scoreConstraint(c, actuals[i]);
    return { constraint: c, actual: actuals[i], passed, score };
  });

  const totalWeight = breakdown.reduce((s, b) => s + b.constraint.weight, 0);
  const weightedScore = breakdown.reduce((s, b) => s + b.score * b.constraint.weight, 0) / totalWeight;
  const score = Math.round(weightedScore);
  const allPassed = breakdown.every(b => b.passed);

  const stars: 0 | 1 | 2 | 3 = !allPassed ? 0 : score >= 90 ? 3 : score >= 75 ? 2 : 1;

  return { score, stars, passed: allPassed, breakdown };
}

// ─── Challenge Definitions ──────────────────────────────────────────

export const challenges: Challenge[] = [
  // ── Beginner ──
  {
    id: "stablecoin-peg",
    name: "The Stablecoin Peg",
    difficulty: "beginner",
    icon: "🔗",
    description: "Design a pool for stablecoins with minimal slippage on large trades.",
    story: "A DAO treasury needs to swap $50,000 of DAI→USDC with less than 0.1% slippage. Configure a pool that handles this efficiently.",
    constraints: [
      { metric: "slippage_50k", label: "Slippage on $50k trade", operator: "<", target: 0.1, unit: "%", weight: 3 },
      { metric: "slippage_100k", label: "Slippage on $100k trade", operator: "<", target: 0.5, unit: "%", weight: 2 },
      { metric: "fee_rate", label: "Fee rate", operator: "<=", target: 0.1, unit: "%", weight: 1 },
    ],
    defaultParams: { reserveX: 500000, reserveY: 500000, feeRate: 0.003, amplification: 1, concentrationLower: 0.5, concentrationUpper: 2 },
    solutionParams: { reserveX: 1000, reserveY: 1500000, feeRate: 0.0005, amplification: 1, concentrationLower: 0.5, concentrationUpper: 2 },
    hints: [
      "Stablecoin pools work best with very deep liquidity.",
      "Lower fee rates help, but the real trick is the reserve depth.",
      "Try reserves of 1M+ on each side."
    ],
    evaluate(params) {
      const slip50k = simulateSlippage(params, 50000);
      const slip100k = simulateSlippage(params, 100000);
      return buildResult(this.constraints, [slip50k, slip100k, params.feeRate * 100]);
    }
  },
  {
    id: "first-pool",
    name: "Your First Pool",
    difficulty: "beginner",
    icon: "🌱",
    description: "Create a balanced ETH/USDC pool that keeps slippage under 2% for $10k trades.",
    story: "You're launching your first liquidity pool. Start simple: provide enough liquidity so that a $10,000 trade doesn't move the price too much.",
    constraints: [
      { metric: "slippage_10k", label: "Slippage on $10k trade", operator: "<", target: 2, unit: "%", weight: 3 },
      { metric: "fee_revenue", label: "Daily fee revenue", operator: ">", target: 10, unit: "$", weight: 1 },
    ],
    defaultParams: { reserveX: 50, reserveY: 100000, feeRate: 0.003, amplification: 1, concentrationLower: 0.5, concentrationUpper: 2 },
    solutionParams: { reserveX: 500, reserveY: 500000, feeRate: 0.005, amplification: 1, concentrationLower: 0.5, concentrationUpper: 2 },
    hints: [
      "More liquidity = less slippage. But the fee rate matters too.",
      "Think about how much capital you're willing to deploy."
    ],
    evaluate(params) {
      const slip = simulateSlippage(params, 10000);
      const fees = simulateFeeRevenue(params, 1, 0.6);
      return buildResult(this.constraints, [slip, fees]);
    }
  },
  {
    id: "fee-optimizer",
    name: "The Fee Sweet Spot",
    difficulty: "beginner",
    icon: "💰",
    description: "Find the fee rate that maximizes revenue without killing volume.",
    story: "Your pool gets decent volume, but you suspect the fee is too high (or too low). Find the Goldilocks zone where you earn the most.",
    constraints: [
      { metric: "fee_30d", label: "30-day fee revenue", operator: ">", target: 500, unit: "$", weight: 3 },
      { metric: "slippage_5k", label: "Slippage on $5k trade", operator: "<", target: 1.5, unit: "%", weight: 2 },
    ],
    defaultParams: { reserveX: 100, reserveY: 200000, feeRate: 0.003, amplification: 1, concentrationLower: 0.5, concentrationUpper: 2 },
    solutionParams: { reserveX: 300, reserveY: 600000, feeRate: 0.005, amplification: 1, concentrationLower: 0.5, concentrationUpper: 2 },
    hints: [
      "Higher fees earn more per trade but discourage volume.",
      "Try fee rates between 0.05% and 1% and compare revenue.",
    ],
    evaluate(params) {
      const fees = simulateFeeRevenue(params, 30, 0.7);
      const slip = simulateSlippage(params, 5000);
      return buildResult(this.constraints, [fees, slip]);
    }
  },

  // ── Intermediate ──
  {
    id: "survive-crash",
    name: "Survive the Crash",
    difficulty: "intermediate",
    icon: "📉",
    description: "Design a pool that limits impermanent loss during a 60% price drop.",
    story: "Black Tuesday: ETH drops 60% in hours. Your LPs are panicking. Design a pool configuration that weathers the storm with minimal IL.",
    constraints: [
      { metric: "il", label: "Impermanent loss", operator: "<", target: 5, unit: "%", weight: 3 },
      { metric: "drawdown", label: "Max drawdown", operator: "<", target: 40, unit: "%", weight: 2 },
      { metric: "solvent", label: "Pool stays solvent", operator: ">=", target: 1, unit: "", weight: 3 },
    ],
    defaultParams: { reserveX: 100, reserveY: 200000, feeRate: 0.003, amplification: 1, concentrationLower: 0.3, concentrationUpper: 3 },
    solutionParams: { reserveX: 500, reserveY: 1000000, feeRate: 0.01, amplification: 1, concentrationLower: 0.1, concentrationUpper: 5 },
    hints: [
      "Wide price ranges reduce concentrated IL exposure.",
      "Higher fee rates help offset IL during volatile periods.",
      "Think about what happens to reserves as price drops."
    ],
    evaluate(params) {
      const result = simulateCrash(params, 60);
      return buildResult(this.constraints, [result.finalIL, result.maxDrawdownPct, result.solvent ? 1 : 0]);
    }
  },
  {
    id: "fee-maximizer",
    name: "Fee Maximizer",
    difficulty: "intermediate",
    icon: "🏦",
    description: "Maximize fee revenue over 90 days in a volatile market.",
    story: "You have 90 days to prove your pool design generates maximum revenue. Markets are volatile (80% annualized vol). Every basis point counts.",
    constraints: [
      { metric: "fees_90d", label: "90-day fee revenue", operator: ">", target: 2000, unit: "$", weight: 3 },
      { metric: "il_90d", label: "IL after 90 days", operator: "<", target: 8, unit: "%", weight: 2 },
    ],
    defaultParams: { reserveX: 100, reserveY: 200000, feeRate: 0.003, amplification: 1, concentrationLower: 0.5, concentrationUpper: 2 },
    solutionParams: { reserveX: 300, reserveY: 600000, feeRate: 0.008, amplification: 1, concentrationLower: 0.7, concentrationUpper: 1.5 },
    hints: [
      "Volatile markets generate more arb volume → more fees.",
      "But volatile markets also mean more IL. Balance is key.",
      "Concentrated ranges earn more fees when in range."
    ],
    evaluate(params) {
      const fees = simulateFeeRevenue(params, 90, 0.8);
      const il = simulateIL(params, -30); // assume some price movement
      return buildResult(this.constraints, [fees, il]);
    }
  },
  {
    id: "capital-efficient",
    name: "Capital Efficiency King",
    difficulty: "intermediate",
    icon: "⚡",
    description: "Achieve the same depth as a $1M pool using only $250k of capital.",
    story: "Capital is expensive. Your challenge: provide the same trading depth as a million-dollar constant product pool, but with only $250k. Concentrated liquidity is your weapon.",
    constraints: [
      { metric: "slippage_match", label: "Slippage ≤ $1M pool baseline", operator: "<=", target: 0.5, unit: "%", weight: 3 },
      { metric: "capital_used", label: "Total capital deployed", operator: "<=", target: 250000, unit: "$", weight: 3 },
    ],
    defaultParams: { reserveX: 62.5, reserveY: 125000, feeRate: 0.003, amplification: 1, concentrationLower: 0.8, concentrationUpper: 1.25 },
    solutionParams: { reserveX: 62.5, reserveY: 125000, feeRate: 0.003, amplification: 1, concentrationLower: 0.9, concentrationUpper: 1.1 },
    hints: [
      "Tight concentration ranges multiply capital efficiency.",
      "A range of ±20% can give 5x+ capital efficiency.",
      "But if price moves out of range, you earn nothing."
    ],
    evaluate(params) {
      // Baseline: $1M constant product pool
      const basePool = createPool(250, 500000, params.feeRate);
      const { result: baseResult } = executeTrade(basePool, 25000, "buyY");
      
      const { result: userResult } = executeTrade(
        createPool(params.reserveX, params.reserveY, params.feeRate),
        25000, "buyY"
      );
      
      const totalCapital = params.reserveX * (params.reserveY / params.reserveX) + params.reserveY;
      // Simplified: compare slippage ratios
      const slippageRatio = userResult.slippagePct / Math.max(baseResult.slippagePct, 0.001);
      
      return buildResult(this.constraints, [userResult.slippagePct, totalCapital]);
    }
  },

  // ── Expert ──
  {
    id: "flash-crash",
    name: "The Flash Crash",
    difficulty: "expert",
    icon: "⚡",
    description: "Maintain pool solvency during a Black Thursday replay — 45% drop in 10 minutes.",
    story: "March 12, 2020. ETH drops 45% in minutes. Cascading liquidations everywhere. Your pool must survive without losing solvency. This is the ultimate stress test.",
    constraints: [
      { metric: "solvent", label: "Pool remains solvent", operator: ">=", target: 1, unit: "", weight: 4 },
      { metric: "drawdown", label: "Max drawdown", operator: "<", target: 35, unit: "%", weight: 3 },
      { metric: "il", label: "Impermanent loss", operator: "<", target: 8, unit: "%", weight: 2 },
    ],
    defaultParams: { reserveX: 200, reserveY: 400000, feeRate: 0.01, amplification: 1, concentrationLower: 0.2, concentrationUpper: 5 },
    solutionParams: { reserveX: 800, reserveY: 1600000, feeRate: 0.015, amplification: 1, concentrationLower: 0.1, concentrationUpper: 5 },
    hints: [
      "Higher fee rates create a buffer during extreme moves.",
      "Very wide ranges ensure the pool never runs out of one asset.",
      "Deep reserves matter more than clever fee engineering here."
    ],
    evaluate(params) {
      const result = simulateCrash(params, 45);
      return buildResult(this.constraints, [result.solvent ? 1 : 0, result.maxDrawdownPct, result.finalIL]);
    }
  },
  {
    id: "mev-shield",
    name: "MEV Shield",
    difficulty: "expert",
    icon: "🛡️",
    description: "Minimize extractable value from sandwich attacks on your pool.",
    story: "MEV bots are draining your LPs. Every block, they sandwich large trades, extracting value. Design a pool that minimizes sandwich profitability.",
    constraints: [
      { metric: "mev_slippage", label: "Sandwich extra slippage", operator: "<", target: 0.5, unit: "%", weight: 3 },
      { metric: "normal_slip", label: "Normal trade slippage", operator: "<", target: 1, unit: "%", weight: 2 },
      { metric: "fee_revenue", label: "Still earns decent fees", operator: ">", target: 300, unit: "$", weight: 1 },
    ],
    defaultParams: { reserveX: 200, reserveY: 400000, feeRate: 0.003, amplification: 1, concentrationLower: 0.5, concentrationUpper: 2 },
    solutionParams: { reserveX: 800, reserveY: 1600000, feeRate: 0.01, amplification: 1, concentrationLower: 0.5, concentrationUpper: 2 },
    hints: [
      "Higher fees make sandwiches less profitable for attackers.",
      "Deep liquidity reduces the price impact of frontrunning.",
      "The tradeoff: high fees protect against MEV but reduce organic volume."
    ],
    evaluate(params) {
      const mevSlip = simulateMEV(params);
      const normalSlip = simulateSlippage(params, 10000);
      const fees = simulateFeeRevenue(params, 30, 0.6);
      return buildResult(this.constraints, [mevSlip, normalSlip, fees]);
    }
  },
];

// ─── Progress persistence ────────────────────────────────────────────

const STORAGE_KEY = "amm-challenge-progress";

export interface ChallengeProgress {
  [challengeId: string]: {
    bestScore: number;
    stars: number;
    completedAt: string;
  };
}

export function loadProgress(): ChallengeProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveProgress(challengeId: string, result: ChallengeResult): ChallengeProgress {
  const progress = loadProgress();
  const existing = progress[challengeId];
  if (!existing || result.score > existing.bestScore) {
    progress[challengeId] = {
      bestScore: result.score,
      stars: result.stars,
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }
  return progress;
}

export function getCompletionStats(progress: ChallengeProgress) {
  const total = challenges.length;
  const completed = Object.values(progress).filter(p => p.stars > 0).length;
  const totalStars = Object.values(progress).reduce((s, p) => s + p.stars, 0);
  const maxStars = total * 3;
  
  const byDifficulty = (d: Difficulty) => {
    const inDiff = challenges.filter(c => c.difficulty === d);
    const completedInDiff = inDiff.filter(c => progress[c.id]?.stars > 0).length;
    return { total: inDiff.length, completed: completedInDiff };
  };

  return { total, completed, totalStars, maxStars, beginner: byDifficulty("beginner"), intermediate: byDifficulty("intermediate"), expert: byDifficulty("expert") };
}

export function isUnlocked(challenge: Challenge, progress: ChallengeProgress): boolean {
  if (challenge.difficulty === "beginner") return true;
  if (challenge.difficulty === "intermediate") {
    const beginnerDone = challenges.filter(c => c.difficulty === "beginner" && progress[c.id]?.stars > 0).length;
    return beginnerDone >= 2;
  }
  // Expert
  const intDone = challenges.filter(c => c.difficulty === "intermediate" && progress[c.id]?.stars > 0).length;
  return intDone >= 2;
}
