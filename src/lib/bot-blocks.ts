// Bot Block Coding System — Block definitions for trading bot strategies
// Reuses BlockInstance architecture from strategy-blocks.ts

export type BotBlockCategory = "sensor" | "condition" | "action" | "modifier" | "timing" | "math" | "structural";

export interface BotBlockParam {
  key: string;
  label: string;
  type: "number" | "select" | "text";
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string }[];
  unit?: string;
}

export interface BotBlockDefinition {
  id: string;
  label: string;
  category: BotBlockCategory;
  subcategory: string;
  color: string;
  params: BotBlockParam[];
  acceptsChildren?: boolean;
  description: string;
}

export interface BotBlockInstance {
  uid: string;
  blockId: string;
  params: Record<string, number | string>;
  children: BotBlockInstance[];
}

export interface BotProgram {
  id: string;
  name: string;
  color: string;
  capital: number;
  enabled: boolean;
  blocks: BotBlockInstance[];
}

export const BOT_CATEGORY_COLORS: Record<BotBlockCategory, string> = {
  structural: "hsl(220, 70%, 55%)",
  sensor: "hsl(190, 70%, 45%)",
  condition: "hsl(35, 80%, 50%)",
  action: "hsl(150, 60%, 45%)",
  modifier: "hsl(280, 60%, 55%)",
  timing: "hsl(350, 65%, 50%)",
  math: "hsl(45, 80%, 50%)",
};

export const BOT_CATEGORY_LABELS: Record<BotBlockCategory, string> = {
  structural: "Control Flow",
  sensor: "Sensors",
  condition: "Conditions",
  action: "Actions",
  modifier: "Modifiers",
  timing: "Timing",
  math: "Math",
};

// ─── BLOCK DEFINITIONS ──────────────────────────────────────

export const BOT_BLOCK_DEFINITIONS: BotBlockDefinition[] = [
  // STRUCTURAL
  { id: "bot_if", label: "IF", category: "structural", subcategory: "Flow", color: BOT_CATEGORY_COLORS.structural, acceptsChildren: true, params: [], description: "Execute children when condition is met" },
  { id: "bot_else_if", label: "ELSE IF", category: "structural", subcategory: "Flow", color: BOT_CATEGORY_COLORS.structural, acceptsChildren: true, params: [], description: "Alternative condition branch" },
  { id: "bot_else", label: "ELSE", category: "structural", subcategory: "Flow", color: BOT_CATEGORY_COLORS.structural, acceptsChildren: true, params: [], description: "Default fallback branch" },
  { id: "bot_and", label: "AND", category: "structural", subcategory: "Logic", color: BOT_CATEGORY_COLORS.structural, acceptsChildren: true, params: [], description: "All child conditions must be true" },
  { id: "bot_or", label: "OR", category: "structural", subcategory: "Logic", color: BOT_CATEGORY_COLORS.structural, acceptsChildren: true, params: [], description: "Any child condition true" },
  { id: "bot_not", label: "NOT", category: "structural", subcategory: "Logic", color: BOT_CATEGORY_COLORS.structural, acceptsChildren: true, params: [], description: "Invert condition" },
  { id: "bot_repeat", label: "REPEAT", category: "structural", subcategory: "Loop", color: BOT_CATEGORY_COLORS.structural, acceptsChildren: true, params: [
    { key: "mode", label: "Mode", type: "select", default: "every_tick", options: [
      { label: "Every Tick", value: "every_tick" },
      { label: "On Signal Change", value: "on_signal" },
    ] },
  ], description: "Repeat children on each evaluation" },

  // SENSORS — read market state
  { id: "sen_pool_price", label: "Pool Price", category: "sensor", subcategory: "Price", color: BOT_CATEGORY_COLORS.sensor, params: [], description: "Current pool spot price (y/x)" },
  { id: "sen_external_price", label: "External Price", category: "sensor", subcategory: "Price", color: BOT_CATEGORY_COLORS.sensor, params: [], description: "External reference price feed" },
  { id: "sen_price_deviation", label: "Price Deviation %", category: "sensor", subcategory: "Price", color: BOT_CATEGORY_COLORS.sensor, params: [], description: "% difference between pool and external price" },
  { id: "sen_ema", label: "EMA", category: "sensor", subcategory: "Indicators", color: BOT_CATEGORY_COLORS.sensor, params: [
    { key: "period", label: "Period", type: "number", default: 20, min: 2, max: 500, step: 1 },
    { key: "source", label: "Source", type: "select", default: "pool_price", options: [
      { label: "Pool Price", value: "pool_price" },
      { label: "External Price", value: "external_price" },
      { label: "Volume", value: "volume" },
    ] },
  ], description: "Exponential moving average" },
  { id: "sen_bollinger", label: "Bollinger Band", category: "sensor", subcategory: "Indicators", color: BOT_CATEGORY_COLORS.sensor, params: [
    { key: "period", label: "Period", type: "number", default: 20, min: 5, max: 200, step: 1 },
    { key: "stddev", label: "Std Dev", type: "number", default: 2, min: 0.5, max: 5, step: 0.1 },
    { key: "band", label: "Band", type: "select", default: "lower", options: [
      { label: "Upper", value: "upper" },
      { label: "Middle", value: "middle" },
      { label: "Lower", value: "lower" },
    ] },
  ], description: "Bollinger band value" },
  { id: "sen_realized_vol", label: "Realized Volatility", category: "sensor", subcategory: "Indicators", color: BOT_CATEGORY_COLORS.sensor, params: [
    { key: "window", label: "Window", type: "number", default: 30, min: 5, max: 200, step: 1 },
  ], description: "Rolling realized volatility" },
  { id: "sen_order_flow", label: "Order Flow Imbalance", category: "sensor", subcategory: "Flow", color: BOT_CATEGORY_COLORS.sensor, params: [
    { key: "window", label: "Window", type: "number", default: 10, min: 1, max: 100, step: 1 },
  ], description: "Buy vs sell volume imbalance [-1, 1]" },
  { id: "sen_reserve_ratio", label: "Reserve Ratio", category: "sensor", subcategory: "Pool", color: BOT_CATEGORY_COLORS.sensor, params: [], description: "Pool reserve ratio x/(x+y)" },
  { id: "sen_time_elapsed", label: "Time Elapsed", category: "sensor", subcategory: "Time", color: BOT_CATEGORY_COLORS.sensor, params: [
    { key: "unit", label: "Unit", type: "select", default: "ticks", options: [
      { label: "Ticks", value: "ticks" },
      { label: "Sim Hours", value: "hours" },
    ] },
  ], description: "Time since simulation start" },
  { id: "sen_bot_pnl", label: "Bot P&L %", category: "sensor", subcategory: "Performance", color: BOT_CATEGORY_COLORS.sensor, params: [], description: "Current bot profit/loss percentage" },
  { id: "sen_bot_position", label: "Bot Position", category: "sensor", subcategory: "Performance", color: BOT_CATEGORY_COLORS.sensor, params: [
    { key: "asset", label: "Asset", type: "select", default: "x", options: [
      { label: "Token X", value: "x" },
      { label: "Token Y", value: "y" },
      { label: "Net Value", value: "net" },
    ] },
  ], description: "Current bot holdings" },
  { id: "sen_pool_fees", label: "Pool Fees Accumulated", category: "sensor", subcategory: "Pool", color: BOT_CATEGORY_COLORS.sensor, params: [], description: "Total fees collected by pool" },
  { id: "sen_slippage_est", label: "Slippage Estimate", category: "sensor", subcategory: "Pool", color: BOT_CATEGORY_COLORS.sensor, params: [
    { key: "size", label: "Trade Size", type: "number", default: 100, min: 1, max: 100000, step: 10 },
  ], description: "Estimated slippage for given trade size" },

  // CONDITIONS — comparisons
  { id: "cond_gt", label: "Greater Than", category: "condition", subcategory: "Compare", color: BOT_CATEGORY_COLORS.condition, params: [
    { key: "value", label: "Value", type: "number", default: 0, min: -100000, max: 100000, step: 0.1 },
  ], description: "Sensor value > threshold" },
  { id: "cond_lt", label: "Less Than", category: "condition", subcategory: "Compare", color: BOT_CATEGORY_COLORS.condition, params: [
    { key: "value", label: "Value", type: "number", default: 0, min: -100000, max: 100000, step: 0.1 },
  ], description: "Sensor value < threshold" },
  { id: "cond_between", label: "Between", category: "condition", subcategory: "Compare", color: BOT_CATEGORY_COLORS.condition, params: [
    { key: "low", label: "Low", type: "number", default: -5, min: -100000, max: 100000, step: 0.1 },
    { key: "high", label: "High", type: "number", default: 5, min: -100000, max: 100000, step: 0.1 },
  ], description: "Value between low and high" },
  { id: "cond_crosses_above", label: "Crosses Above", category: "condition", subcategory: "Crossover", color: BOT_CATEGORY_COLORS.condition, params: [
    { key: "value", label: "Level", type: "number", default: 0, min: -100000, max: 100000, step: 0.1 },
  ], description: "Value crosses above level" },
  { id: "cond_crosses_below", label: "Crosses Below", category: "condition", subcategory: "Crossover", color: BOT_CATEGORY_COLORS.condition, params: [
    { key: "value", label: "Level", type: "number", default: 0, min: -100000, max: 100000, step: 0.1 },
  ], description: "Value crosses below level" },
  { id: "cond_ema_cross", label: "EMA Crossover", category: "condition", subcategory: "Crossover", color: BOT_CATEGORY_COLORS.condition, params: [
    { key: "fast", label: "Fast Period", type: "number", default: 10, min: 2, max: 200, step: 1 },
    { key: "slow", label: "Slow Period", type: "number", default: 30, min: 5, max: 500, step: 1 },
    { key: "direction", label: "Direction", type: "select", default: "bullish", options: [
      { label: "Fast > Slow (Bullish)", value: "bullish" },
      { label: "Fast < Slow (Bearish)", value: "bearish" },
    ] },
  ], description: "EMA crossover signal" },
  { id: "cond_random", label: "Random Chance", category: "condition", subcategory: "Stochastic", color: BOT_CATEGORY_COLORS.condition, params: [
    { key: "probability", label: "Probability", type: "number", default: 0.5, min: 0, max: 1, step: 0.01 },
  ], description: "True with given probability each tick" },

  // ACTIONS — trade execution
  { id: "act_buy", label: "Buy Token X", category: "action", subcategory: "Trade", color: BOT_CATEGORY_COLORS.action, params: [
    { key: "size_mode", label: "Size Mode", type: "select", default: "pct_capital", options: [
      { label: "% of Capital", value: "pct_capital" },
      { label: "Fixed $", value: "fixed" },
      { label: "Close Gap", value: "close_gap" },
    ] },
    { key: "amount", label: "Amount", type: "number", default: 10, min: 0.1, max: 100, step: 0.1 },
  ], description: "Buy token X (sell Y)" },
  { id: "act_sell", label: "Sell Token X", category: "action", subcategory: "Trade", color: BOT_CATEGORY_COLORS.action, params: [
    { key: "size_mode", label: "Size Mode", type: "select", default: "pct_capital", options: [
      { label: "% of Capital", value: "pct_capital" },
      { label: "Fixed $", value: "fixed" },
      { label: "Close Gap", value: "close_gap" },
    ] },
    { key: "amount", label: "Amount", type: "number", default: 10, min: 0.1, max: 100, step: 0.1 },
  ], description: "Sell token X (buy Y)" },
  { id: "act_skip", label: "Skip Tick", category: "action", subcategory: "Control", color: BOT_CATEGORY_COLORS.action, params: [], description: "Do nothing this tick" },
  { id: "act_close_all", label: "Close All Positions", category: "action", subcategory: "Risk", color: BOT_CATEGORY_COLORS.action, params: [], description: "Sell all holdings back to Y" },
  { id: "act_flip", label: "Flip Position", category: "action", subcategory: "Trade", color: BOT_CATEGORY_COLORS.action, params: [
    { key: "size_mode", label: "Size Mode", type: "select", default: "pct_capital", options: [
      { label: "% of Capital", value: "pct_capital" },
      { label: "Fixed $", value: "fixed" },
    ] },
    { key: "amount", label: "Amount", type: "number", default: 20, min: 0.1, max: 100, step: 0.1 },
  ], description: "Reverse position direction" },

  // MODIFIERS — risk management
  { id: "mod_cooldown", label: "Cooldown", category: "modifier", subcategory: "Timing", color: BOT_CATEGORY_COLORS.modifier, params: [
    { key: "ticks", label: "Ticks", type: "number", default: 5, min: 1, max: 1000, step: 1 },
  ], description: "Wait N ticks after acting" },
  { id: "mod_max_position", label: "Max Position %", category: "modifier", subcategory: "Limits", color: BOT_CATEGORY_COLORS.modifier, params: [
    { key: "value", label: "Max", type: "number", default: 80, min: 1, max: 100, step: 1, unit: "%" },
  ], description: "Cap position as % of capital" },
  { id: "mod_stop_loss", label: "Stop Loss", category: "modifier", subcategory: "Risk", color: BOT_CATEGORY_COLORS.modifier, params: [
    { key: "value", label: "Loss %", type: "number", default: 10, min: 0.5, max: 100, step: 0.5, unit: "%" },
  ], description: "Close all if loss exceeds threshold" },
  { id: "mod_take_profit", label: "Take Profit", category: "modifier", subcategory: "Risk", color: BOT_CATEGORY_COLORS.modifier, params: [
    { key: "value", label: "Profit %", type: "number", default: 20, min: 0.5, max: 500, step: 0.5, unit: "%" },
  ], description: "Close all if profit exceeds threshold" },
  { id: "mod_slippage_limit", label: "Slippage Limit", category: "modifier", subcategory: "Limits", color: BOT_CATEGORY_COLORS.modifier, params: [
    { key: "bps", label: "Max Slippage", type: "number", default: 50, min: 1, max: 1000, step: 1, unit: "bps" },
  ], description: "Skip trade if slippage exceeds limit" },
  { id: "mod_capital_alloc", label: "Capital Allocation", category: "modifier", subcategory: "Sizing", color: BOT_CATEGORY_COLORS.modifier, params: [
    { key: "value", label: "Allocation", type: "number", default: 100, min: 1, max: 100, step: 1, unit: "%" },
  ], description: "Use only % of total capital" },

  // TIMING — when to execute
  { id: "tim_every_n", label: "Every N Ticks", category: "timing", subcategory: "Interval", color: BOT_CATEGORY_COLORS.timing, params: [
    { key: "n", label: "Interval", type: "number", default: 1, min: 1, max: 1000, step: 1 },
  ], description: "Execute every N ticks" },
  { id: "tim_poisson", label: "Poisson Arrival", category: "timing", subcategory: "Random", color: BOT_CATEGORY_COLORS.timing, params: [
    { key: "rate", label: "Avg per 100 ticks", type: "number", default: 10, min: 0.1, max: 100, step: 0.1 },
  ], description: "Random arrival with Poisson distribution" },
  { id: "tim_on_signal", label: "On Signal Change", category: "timing", subcategory: "Event", color: BOT_CATEGORY_COLORS.timing, params: [], description: "Fire only when signal transitions" },
  { id: "tim_delay", label: "Delay", category: "timing", subcategory: "Wait", color: BOT_CATEGORY_COLORS.timing, params: [
    { key: "ticks", label: "Ticks", type: "number", default: 5, min: 1, max: 1000, step: 1 },
  ], description: "Wait N ticks before executing" },

  // MATH — sizing and randomness
  { id: "math_lognormal_size", label: "Log-Normal Size", category: "math", subcategory: "Distribution", color: BOT_CATEGORY_COLORS.math, params: [
    { key: "mean", label: "Mean $", type: "number", default: 100, min: 1, max: 100000, step: 10 },
    { key: "sigma", label: "Sigma", type: "number", default: 0.5, min: 0.01, max: 3, step: 0.01 },
  ], description: "Log-normal distributed trade size" },
  { id: "math_power_law", label: "Power Law Size", category: "math", subcategory: "Distribution", color: BOT_CATEGORY_COLORS.math, params: [
    { key: "min_size", label: "Min $", type: "number", default: 10, min: 1, max: 10000, step: 1 },
    { key: "max_size", label: "Max $", type: "number", default: 10000, min: 100, max: 1000000, step: 100 },
    { key: "alpha", label: "Alpha", type: "number", default: 1.5, min: 1, max: 5, step: 0.1 },
  ], description: "Power-law distributed trade size (whales)" },
  { id: "math_momentum", label: "Momentum Score", category: "math", subcategory: "Signal", color: BOT_CATEGORY_COLORS.math, params: [
    { key: "period", label: "Period", type: "number", default: 14, min: 2, max: 200, step: 1 },
  ], description: "Momentum score [-1, 1]" },
  { id: "math_mean_revert", label: "Mean Reversion Signal", category: "math", subcategory: "Signal", color: BOT_CATEGORY_COLORS.math, params: [
    { key: "period", label: "Period", type: "number", default: 20, min: 5, max: 200, step: 1 },
    { key: "threshold", label: "Threshold σ", type: "number", default: 2, min: 0.5, max: 5, step: 0.1 },
  ], description: "Mean reversion z-score signal" },
  { id: "math_random_uniform", label: "Random Uniform", category: "math", subcategory: "Random", color: BOT_CATEGORY_COLORS.math, params: [
    { key: "min", label: "Min", type: "number", default: 0, min: -10000, max: 10000, step: 0.1 },
    { key: "max", label: "Max", type: "number", default: 1, min: -10000, max: 10000, step: 0.1 },
  ], description: "Uniform random value in [min, max]" },
];

// ─── Helpers ─────────────────────────────────────────────────

export function getBotBlockDef(id: string): BotBlockDefinition | undefined {
  return BOT_BLOCK_DEFINITIONS.find(b => b.id === id);
}

export function getBotBlocksByCategory(): Record<string, Record<string, BotBlockDefinition[]>> {
  const result: Record<string, Record<string, BotBlockDefinition[]>> = {};
  for (const block of BOT_BLOCK_DEFINITIONS) {
    if (!result[block.category]) result[block.category] = {};
    if (!result[block.category][block.subcategory]) result[block.category][block.subcategory] = [];
    result[block.category][block.subcategory].push(block);
  }
  return result;
}

export function createBotBlockInstance(blockId: string): BotBlockInstance {
  const def = getBotBlockDef(blockId);
  const params: Record<string, number | string> = {};
  if (def) {
    for (const p of def.params) params[p.key] = p.default;
  }
  return {
    uid: `${blockId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    blockId,
    params,
    children: [],
  };
}

// ─── Tree helpers ───────────────────────────────────────────

export function addBotChildBlock(blocks: BotBlockInstance[], parentUid: string, child: BotBlockInstance): BotBlockInstance[] {
  return blocks.map(b => {
    if (b.uid === parentUid) return { ...b, children: [...b.children, child] };
    return { ...b, children: addBotChildBlock(b.children, parentUid, child) };
  });
}

export function removeBotBlock(blocks: BotBlockInstance[], uid: string): BotBlockInstance[] {
  return blocks.filter(b => b.uid !== uid).map(b => ({
    ...b, children: removeBotBlock(b.children, uid),
  }));
}

export function updateBotParam(blocks: BotBlockInstance[], uid: string, key: string, value: number | string): BotBlockInstance[] {
  return blocks.map(b => {
    if (b.uid === uid) return { ...b, params: { ...b.params, [key]: value } };
    return { ...b, children: updateBotParam(b.children, uid, key, value) };
  });
}

// ─── Starter Templates ──────────────────────────────────────

const BOT_COLORS = [
  "hsl(0, 70%, 55%)",
  "hsl(210, 70%, 55%)",
  "hsl(120, 50%, 45%)",
  "hsl(45, 80%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(180, 60%, 45%)",
];

function tpl(blockId: string, params?: Record<string, number | string>, children?: BotBlockInstance[]): BotBlockInstance {
  const inst = createBotBlockInstance(blockId);
  if (params) inst.params = { ...inst.params, ...params };
  if (children) inst.children = children;
  return inst;
}

export function createNoiseTraderTemplate(): BotProgram {
  return {
    id: `bot_${Date.now()}_noise`,
    name: "Noise Trader",
    color: BOT_COLORS[0],
    capital: 10000,
    enabled: true,
    blocks: [
      tpl("bot_repeat", { mode: "every_tick" }, [
        tpl("tim_poisson", { rate: 15 }),
        tpl("cond_random", { probability: 0.5 }),
        tpl("bot_if", {}, [
          tpl("act_buy", { size_mode: "fixed", amount: 50 }),
        ]),
        tpl("bot_else", {}, [
          tpl("act_sell", { size_mode: "fixed", amount: 50 }),
        ]),
      ]),
    ],
  };
}

export function createArbitrageurTemplate(): BotProgram {
  return {
    id: `bot_${Date.now()}_arb`,
    name: "Arbitrageur",
    color: BOT_COLORS[1],
    capital: 50000,
    enabled: true,
    blocks: [
      tpl("bot_repeat", { mode: "every_tick" }, [
        tpl("sen_price_deviation"),
        tpl("bot_if", {}, [
          tpl("cond_gt", { value: 0.5 }),
          tpl("act_sell", { size_mode: "close_gap", amount: 100 }),
        ]),
        tpl("bot_else_if", {}, [
          tpl("cond_lt", { value: -0.5 }),
          tpl("act_buy", { size_mode: "close_gap", amount: 100 }),
        ]),
      ]),
    ],
  };
}

export function createTrendFollowerTemplate(): BotProgram {
  return {
    id: `bot_${Date.now()}_trend`,
    name: "Trend Follower",
    color: BOT_COLORS[2],
    capital: 20000,
    enabled: true,
    blocks: [
      tpl("bot_repeat", { mode: "every_tick" }, [
        tpl("cond_ema_cross", { fast: 10, slow: 30, direction: "bullish" }),
        tpl("bot_if", {}, [
          tpl("act_buy", { size_mode: "pct_capital", amount: 15 }),
        ]),
        tpl("cond_ema_cross", { fast: 10, slow: 30, direction: "bearish" }),
        tpl("bot_if", {}, [
          tpl("act_sell", { size_mode: "pct_capital", amount: 15 }),
        ]),
        tpl("mod_cooldown", { ticks: 5 }),
      ]),
    ],
  };
}

export function createMeanReversionTemplate(): BotProgram {
  return {
    id: `bot_${Date.now()}_meanrev`,
    name: "Mean Reversion",
    color: BOT_COLORS[3],
    capital: 20000,
    enabled: true,
    blocks: [
      tpl("bot_repeat", { mode: "every_tick" }, [
        tpl("sen_bollinger", { period: 20, stddev: 2, band: "lower" }),
        tpl("bot_if", {}, [
          tpl("cond_lt", { value: 0 }),
          tpl("act_buy", { size_mode: "pct_capital", amount: 10 }),
        ]),
        tpl("sen_bollinger", { period: 20, stddev: 2, band: "upper" }),
        tpl("bot_if", {}, [
          tpl("cond_gt", { value: 0 }),
          tpl("act_sell", { size_mode: "pct_capital", amount: 10 }),
        ]),
        tpl("mod_stop_loss", { value: 8 }),
      ]),
    ],
  };
}

export function createWhaleTemplate(): BotProgram {
  return {
    id: `bot_${Date.now()}_whale`,
    name: "Whale",
    color: BOT_COLORS[4],
    capital: 500000,
    enabled: true,
    blocks: [
      tpl("bot_repeat", { mode: "every_tick" }, [
        tpl("tim_poisson", { rate: 2 }),
        tpl("math_power_law", { min_size: 1000, max_size: 50000, alpha: 1.5 }),
        tpl("cond_random", { probability: 0.5 }),
        tpl("bot_if", {}, [
          tpl("act_buy", { size_mode: "fixed", amount: 5000 }),
        ]),
        tpl("bot_else", {}, [
          tpl("act_sell", { size_mode: "fixed", amount: 5000 }),
        ]),
      ]),
    ],
  };
}

export const BOT_TEMPLATES = [
  { label: "Noise Trader", description: "Random trades at high frequency", create: createNoiseTraderTemplate },
  { label: "Arbitrageur", description: "Closes pool/external price gaps", create: createArbitrageurTemplate },
  { label: "Trend Follower", description: "EMA crossover momentum trading", create: createTrendFollowerTemplate },
  { label: "Mean Reversion", description: "Bollinger band contrarian strategy", create: createMeanReversionTemplate },
  { label: "Whale", description: "Low-frequency, high-impact trades", create: createWhaleTemplate },
];

export const STRUCTURAL_BOT_IDS = new Set(["bot_if", "bot_else_if", "bot_else", "bot_and", "bot_or", "bot_not", "bot_repeat"]);
