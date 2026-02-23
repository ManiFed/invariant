// Strategy Block Coding System — Type definitions and block taxonomy

export type BlockCategory = "structural" | "condition" | "action" | "modifier" | "calculation" | "state" | "meta";

export interface BlockParam {
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

export interface BlockDefinition {
  id: string;
  label: string;
  category: BlockCategory;
  subcategory: string;
  color: string; // HSL token class
  params: BlockParam[];
  acceptsChildren?: boolean; // structural blocks
  description: string;
}

export interface BlockInstance {
  uid: string;
  blockId: string;
  params: Record<string, number | string>;
  children: BlockInstance[];
}

export interface CustomStrategy {
  id: string;
  name: string;
  color: string;
  blocks: BlockInstance[];
}

// Category colors (HSL-based classes for tailwind)
export const CATEGORY_COLORS: Record<BlockCategory, string> = {
  structural: "hsl(220, 70%, 55%)",
  condition: "hsl(35, 80%, 50%)",
  action: "hsl(150, 60%, 45%)",
  modifier: "hsl(280, 60%, 55%)",
  calculation: "hsl(190, 70%, 45%)",
  state: "hsl(350, 65%, 50%)",
  meta: "hsl(0, 0%, 50%)",
};

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  structural: "Control Flow",
  condition: "Conditions",
  action: "Actions",
  modifier: "Modifiers",
  calculation: "Calculations",
  state: "State Modes",
  meta: "Meta",
};

// ─── BLOCK DEFINITIONS ──────────────────────────────────────

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  // 1. STRUCTURAL BLOCKS
  { id: "if", label: "IF", category: "structural", subcategory: "Flow", color: CATEGORY_COLORS.structural, acceptsChildren: true, params: [], description: "Execute child blocks when condition is met" },
  { id: "else_if", label: "ELSE IF", category: "structural", subcategory: "Flow", color: CATEGORY_COLORS.structural, acceptsChildren: true, params: [], description: "Alternative condition branch" },
  { id: "else", label: "ELSE", category: "structural", subcategory: "Flow", color: CATEGORY_COLORS.structural, acceptsChildren: true, params: [], description: "Default fallback branch" },
  { id: "and", label: "AND", category: "structural", subcategory: "Logic", color: CATEGORY_COLORS.structural, acceptsChildren: true, params: [], description: "All child conditions must be true" },
  { id: "or", label: "OR", category: "structural", subcategory: "Logic", color: CATEGORY_COLORS.structural, acceptsChildren: true, params: [], description: "Any child condition must be true" },
  { id: "not", label: "NOT", category: "structural", subcategory: "Logic", color: CATEGORY_COLORS.structural, acceptsChildren: true, params: [], description: "Invert the child condition" },
  { id: "on_event", label: "ON EVENT", category: "structural", subcategory: "Events", color: CATEGORY_COLORS.structural, acceptsChildren: true, params: [
    { key: "event", label: "Event", type: "select", default: "rebalance", options: [
      { label: "On Rebalance", value: "rebalance" },
      { label: "On Cooldown End", value: "cooldown_end" },
      { label: "On Price Exit Range", value: "price_exit" },
      { label: "On Volatility Spike", value: "vol_spike" },
      { label: "On Time Interval", value: "time_interval" },
    ] },
  ], description: "Trigger on a specific event" },

  // 2. CONDITION BLOCKS — Price
  { id: "price_change_pct", label: "Price Change %", category: "condition", subcategory: "Price", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: ">", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }, { label: "≥", value: ">=" }, { label: "≤", value: "<=" }] },
    { key: "value", label: "Threshold", type: "number", default: 5, min: 0, max: 100, step: 0.5, unit: "%" },
  ], description: "Price change exceeds threshold" },
  { id: "price_above", label: "Price > X", category: "condition", subcategory: "Price", color: CATEGORY_COLORS.condition, params: [
    { key: "value", label: "Price", type: "number", default: 100, min: 0, max: 100000, step: 1 },
  ], description: "Current price is above value" },
  { id: "price_below", label: "Price < X", category: "condition", subcategory: "Price", color: CATEGORY_COLORS.condition, params: [
    { key: "value", label: "Price", type: "number", default: 100, min: 0, max: 100000, step: 1 },
  ], description: "Current price is below value" },
  { id: "price_crosses", label: "Price Crosses", category: "condition", subcategory: "Price", color: CATEGORY_COLORS.condition, params: [
    { key: "direction", label: "Direction", type: "select", default: "above", options: [{ label: "Above", value: "above" }, { label: "Below", value: "below" }] },
    { key: "value", label: "Level", type: "number", default: 100, min: 0, max: 100000, step: 1 },
  ], description: "Price crosses above or below a level" },
  { id: "dist_mid_pct", label: "Distance from Mid %", category: "condition", subcategory: "Price", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: ">", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }] },
    { key: "value", label: "Threshold", type: "number", default: 10, min: 0, max: 100, step: 1, unit: "%" },
  ], description: "Distance from range midpoint" },
  { id: "dist_boundary_pct", label: "Distance from Boundary %", category: "condition", subcategory: "Price", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: "<", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }] },
    { key: "value", label: "Threshold", type: "number", default: 5, min: 0, max: 100, step: 1, unit: "%" },
  ], description: "Distance from range boundary" },

  // Conditions — Volatility
  { id: "realized_vol", label: "Realized Vol %", category: "condition", subcategory: "Volatility", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: ">", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }] },
    { key: "value", label: "Threshold", type: "number", default: 80, min: 0, max: 500, step: 5, unit: "%" },
  ], description: "Realized volatility exceeds threshold" },
  { id: "vol_change_pct", label: "Vol Change %", category: "condition", subcategory: "Volatility", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: ">", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }] },
    { key: "value", label: "Threshold", type: "number", default: 20, min: 0, max: 200, step: 5, unit: "%" },
  ], description: "Volatility changed by percentage" },
  { id: "vol_threshold", label: "Vol Above/Below", category: "condition", subcategory: "Volatility", color: CATEGORY_COLORS.condition, params: [
    { key: "direction", label: "Direction", type: "select", default: "above", options: [{ label: "Above", value: "above" }, { label: "Below", value: "below" }] },
    { key: "value", label: "Threshold", type: "number", default: 100, min: 0, max: 500, step: 5, unit: "%" },
  ], description: "Volatility above or below threshold" },

  // Conditions — Liquidity/Volume
  { id: "volume_spike", label: "Volume Spike %", category: "condition", subcategory: "Volume", color: CATEGORY_COLORS.condition, params: [
    { key: "value", label: "Threshold", type: "number", default: 50, min: 0, max: 500, step: 10, unit: "%" },
  ], description: "Volume spike exceeds threshold" },
  { id: "fee_apr_est", label: "Fee APR Estimate", category: "condition", subcategory: "Volume", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: "<", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }] },
    { key: "value", label: "APR", type: "number", default: 20, min: 0, max: 1000, step: 5, unit: "%" },
  ], description: "Estimated fee APR" },

  // Conditions — IL
  { id: "current_il", label: "Current IL %", category: "condition", subcategory: "IL", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: ">", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }] },
    { key: "value", label: "Threshold", type: "number", default: 5, min: 0, max: 100, step: 0.5, unit: "%" },
  ], description: "Current impermanent loss" },
  { id: "il_change", label: "IL Change %", category: "condition", subcategory: "IL", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: ">", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }] },
    { key: "value", label: "Threshold", type: "number", default: 2, min: 0, max: 50, step: 0.5, unit: "%" },
  ], description: "IL changed by percentage" },

  // Conditions — Time
  { id: "days_since_rebalance", label: "Days Since Rebalance", category: "condition", subcategory: "Time", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: ">", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }] },
    { key: "value", label: "Days", type: "number", default: 7, min: 0, max: 365, step: 1 },
  ], description: "Days since last rebalance" },
  { id: "time_in_range", label: "Time in Range", category: "condition", subcategory: "Time", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: ">", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }] },
    { key: "value", label: "Days", type: "number", default: 5, min: 0, max: 365, step: 1 },
  ], description: "Consecutive days price stayed in range" },
  { id: "time_out_range", label: "Time Out of Range", category: "condition", subcategory: "Time", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: ">", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }] },
    { key: "value", label: "Days", type: "number", default: 2, min: 0, max: 365, step: 1 },
  ], description: "Consecutive days price was out of range" },

  // Conditions — Performance
  { id: "net_pnl_pct", label: "Net PnL %", category: "condition", subcategory: "Performance", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: "<", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }] },
    { key: "value", label: "Threshold", type: "number", default: -10, min: -100, max: 100, step: 1, unit: "%" },
  ], description: "Net PnL percentage" },
  { id: "drawdown_pct", label: "Drawdown %", category: "condition", subcategory: "Performance", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: ">", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }] },
    { key: "value", label: "Threshold", type: "number", default: 15, min: 0, max: 100, step: 1, unit: "%" },
  ], description: "Drawdown exceeds threshold" },
  { id: "fee_earned_pct", label: "Fees Earned %", category: "condition", subcategory: "Performance", color: CATEGORY_COLORS.condition, params: [
    { key: "op", label: "Operator", type: "select", default: ">", options: [{ label: ">", value: ">" }, { label: "<", value: "<" }] },
    { key: "value", label: "Threshold", type: "number", default: 5, min: 0, max: 100, step: 0.5, unit: "%" },
  ], description: "Total fees earned as % of capital" },

  // 3. ACTION BLOCKS — Range Control
  { id: "set_range", label: "Set Range Width", category: "action", subcategory: "Range", color: CATEGORY_COLORS.action, params: [
    { key: "value", label: "Width", type: "number", default: 15, min: 1, max: 100, step: 1, unit: "%" },
  ], description: "Set range width to X%" },
  { id: "increase_range", label: "Increase Range", category: "action", subcategory: "Range", color: CATEGORY_COLORS.action, params: [
    { key: "value", label: "Amount", type: "number", default: 5, min: 1, max: 50, step: 1, unit: "%" },
  ], description: "Increase range width by X%" },
  { id: "decrease_range", label: "Decrease Range", category: "action", subcategory: "Range", color: CATEGORY_COLORS.action, params: [
    { key: "value", label: "Amount", type: "number", default: 5, min: 1, max: 50, step: 1, unit: "%" },
  ], description: "Decrease range width by X%" },
  { id: "shift_range", label: "Shift Range", category: "action", subcategory: "Range", color: CATEGORY_COLORS.action, params: [
    { key: "direction", label: "Direction", type: "select", default: "up", options: [{ label: "Up", value: "up" }, { label: "Down", value: "down" }] },
    { key: "value", label: "Amount", type: "number", default: 5, min: 1, max: 50, step: 1, unit: "%" },
  ], description: "Shift range up or down" },
  { id: "center_range", label: "Center Range", category: "action", subcategory: "Range", color: CATEGORY_COLORS.action, params: [], description: "Center range at current price" },

  // Actions — Rebalancing
  { id: "trigger_rebalance", label: "Trigger Rebalance", category: "action", subcategory: "Rebalance", color: CATEGORY_COLORS.action, params: [], description: "Force an immediate rebalance" },
  { id: "delay_rebalance", label: "Delay Rebalance", category: "action", subcategory: "Rebalance", color: CATEGORY_COLORS.action, params: [
    { key: "value", label: "Hours", type: "number", default: 24, min: 1, max: 720, step: 1 },
  ], description: "Delay rebalance by X hours" },
  { id: "disable_rebalance", label: "Disable Rebalance", category: "action", subcategory: "Rebalance", color: CATEGORY_COLORS.action, params: [], description: "Disable automatic rebalancing" },

  // Actions — Hedging
  { id: "set_hedge", label: "Set Hedge Ratio", category: "action", subcategory: "Hedge", color: CATEGORY_COLORS.action, params: [
    { key: "value", label: "Ratio", type: "number", default: 50, min: 0, max: 100, step: 5, unit: "%" },
  ], description: "Set hedge ratio to X%" },
  { id: "increase_hedge", label: "Increase Hedge", category: "action", subcategory: "Hedge", color: CATEGORY_COLORS.action, params: [
    { key: "value", label: "Amount", type: "number", default: 10, min: 1, max: 50, step: 5, unit: "%" },
  ], description: "Increase hedge by X%" },
  { id: "decrease_hedge", label: "Decrease Hedge", category: "action", subcategory: "Hedge", color: CATEGORY_COLORS.action, params: [
    { key: "value", label: "Amount", type: "number", default: 10, min: 1, max: 50, step: 5, unit: "%" },
  ], description: "Decrease hedge by X%" },
  { id: "remove_hedge", label: "Remove Hedge", category: "action", subcategory: "Hedge", color: CATEGORY_COLORS.action, params: [], description: "Remove all hedging" },

  // Actions — Risk Controls
  { id: "close_position", label: "Close Position", category: "action", subcategory: "Risk", color: CATEGORY_COLORS.action, params: [], description: "Close the entire LP position" },
  { id: "reduce_position", label: "Reduce Position", category: "action", subcategory: "Risk", color: CATEGORY_COLORS.action, params: [
    { key: "value", label: "Amount", type: "number", default: 50, min: 1, max: 100, step: 5, unit: "%" },
  ], description: "Reduce position size by X%" },
  { id: "pause_strategy", label: "Pause Strategy", category: "action", subcategory: "Risk", color: CATEGORY_COLORS.action, params: [], description: "Pause strategy execution" },
  { id: "defensive_mode", label: "Enter Defensive Mode", category: "action", subcategory: "Risk", color: CATEGORY_COLORS.action, params: [], description: "Switch to defensive mode" },

  // Actions — Allocation
  { id: "add_liquidity", label: "Add Liquidity", category: "action", subcategory: "Allocation", color: CATEGORY_COLORS.action, params: [
    { key: "value", label: "Amount", type: "number", default: 20, min: 1, max: 100, step: 5, unit: "%" },
  ], description: "Add liquidity percentage" },
  { id: "remove_liquidity", label: "Remove Liquidity", category: "action", subcategory: "Allocation", color: CATEGORY_COLORS.action, params: [
    { key: "value", label: "Amount", type: "number", default: 20, min: 1, max: 100, step: 5, unit: "%" },
  ], description: "Remove liquidity percentage" },

  // 4. MODIFIER BLOCKS
  { id: "mod_smooth", label: "Smooth Adjustment", category: "modifier", subcategory: "Timing", color: CATEGORY_COLORS.modifier, params: [
    { key: "duration", label: "Over (hours)", type: "number", default: 24, min: 1, max: 720, step: 1 },
  ], description: "Apply changes gradually over time" },
  { id: "mod_instant", label: "Instant Adjustment", category: "modifier", subcategory: "Timing", color: CATEGORY_COLORS.modifier, params: [], description: "Apply changes immediately" },
  { id: "mod_cap", label: "Cap at X%", category: "modifier", subcategory: "Limits", color: CATEGORY_COLORS.modifier, params: [
    { key: "value", label: "Max", type: "number", default: 50, min: 1, max: 100, step: 1, unit: "%" },
  ], description: "Cap the value at maximum" },
  { id: "mod_floor", label: "Floor at X%", category: "modifier", subcategory: "Limits", color: CATEGORY_COLORS.modifier, params: [
    { key: "value", label: "Min", type: "number", default: 5, min: 0, max: 100, step: 1, unit: "%" },
  ], description: "Set minimum floor value" },
  { id: "mod_apply_once", label: "Apply Once", category: "modifier", subcategory: "Repeat", color: CATEGORY_COLORS.modifier, params: [], description: "Execute only once" },
  { id: "mod_apply_until", label: "Apply Until Clear", category: "modifier", subcategory: "Repeat", color: CATEGORY_COLORS.modifier, params: [], description: "Apply until condition clears" },
  { id: "mod_cooldown", label: "Cooldown", category: "modifier", subcategory: "Repeat", color: CATEGORY_COLORS.modifier, params: [
    { key: "value", label: "Hours", type: "number", default: 24, min: 1, max: 720, step: 1 },
  ], description: "Cooldown period after execution" },

  // 5. CALCULATION BLOCKS
  { id: "calc_ma", label: "Moving Average", category: "calculation", subcategory: "Stats", color: CATEGORY_COLORS.calculation, params: [
    { key: "period", label: "Period", type: "number", default: 7, min: 2, max: 200, step: 1 },
    { key: "source", label: "Source", type: "select", default: "price", options: [{ label: "Price", value: "price" }, { label: "Volume", value: "volume" }, { label: "Volatility", value: "vol" }] },
  ], description: "Simple moving average" },
  { id: "calc_ema", label: "Exp. Moving Average", category: "calculation", subcategory: "Stats", color: CATEGORY_COLORS.calculation, params: [
    { key: "period", label: "Period", type: "number", default: 7, min: 2, max: 200, step: 1 },
    { key: "source", label: "Source", type: "select", default: "price", options: [{ label: "Price", value: "price" }, { label: "Volume", value: "volume" }, { label: "Volatility", value: "vol" }] },
  ], description: "Exponential moving average" },
  { id: "calc_stddev", label: "Standard Deviation", category: "calculation", subcategory: "Stats", color: CATEGORY_COLORS.calculation, params: [
    { key: "period", label: "Period", type: "number", default: 14, min: 2, max: 200, step: 1 },
  ], description: "Rolling standard deviation" },
  { id: "calc_roc", label: "Rate of Change", category: "calculation", subcategory: "Stats", color: CATEGORY_COLORS.calculation, params: [
    { key: "period", label: "Period", type: "number", default: 5, min: 1, max: 100, step: 1 },
  ], description: "Rate of change over period" },
  { id: "calc_percentile", label: "Percentile", category: "calculation", subcategory: "Stats", color: CATEGORY_COLORS.calculation, params: [
    { key: "percentile", label: "Percentile", type: "number", default: 95, min: 1, max: 99, step: 1 },
    { key: "period", label: "Period", type: "number", default: 30, min: 2, max: 200, step: 1 },
  ], description: "Percentile over rolling window" },
  { id: "calc_rolling_minmax", label: "Rolling Max/Min", category: "calculation", subcategory: "Stats", color: CATEGORY_COLORS.calculation, params: [
    { key: "type", label: "Type", type: "select", default: "max", options: [{ label: "Max", value: "max" }, { label: "Min", value: "min" }] },
    { key: "period", label: "Period", type: "number", default: 14, min: 2, max: 200, step: 1 },
  ], description: "Rolling maximum or minimum" },

  // 6. STATE BLOCKS
  { id: "state_normal", label: "Normal Mode", category: "state", subcategory: "Mode", color: CATEGORY_COLORS.state, params: [], description: "Switch to normal operating mode" },
  { id: "state_high_vol", label: "High Vol Mode", category: "state", subcategory: "Mode", color: CATEGORY_COLORS.state, params: [], description: "Switch to high volatility mode" },
  { id: "state_low_vol", label: "Low Vol Mode", category: "state", subcategory: "Mode", color: CATEGORY_COLORS.state, params: [], description: "Switch to low volatility mode" },
  { id: "state_defensive", label: "Defensive Mode", category: "state", subcategory: "Mode", color: CATEGORY_COLORS.state, params: [], description: "Switch to defensive mode" },
  { id: "state_aggressive", label: "Aggressive Mode", category: "state", subcategory: "Mode", color: CATEGORY_COLORS.state, params: [], description: "Switch to aggressive mode" },
  { id: "state_recovery", label: "Recovery Mode", category: "state", subcategory: "Mode", color: CATEGORY_COLORS.state, params: [], description: "Switch to recovery mode" },

  // 7. META BLOCKS
  { id: "meta_priority", label: "Set Priority", category: "meta", subcategory: "Control", color: CATEGORY_COLORS.meta, params: [
    { key: "level", label: "Level", type: "select", default: "normal", options: [{ label: "Low", value: "low" }, { label: "Normal", value: "normal" }, { label: "High", value: "high" }, { label: "Critical", value: "critical" }] },
  ], description: "Set rule priority level" },
  { id: "meta_override", label: "Override Previous", category: "meta", subcategory: "Control", color: CATEGORY_COLORS.meta, params: [], description: "Override any previous action" },
  { id: "meta_log", label: "Log Event", category: "meta", subcategory: "Debug", color: CATEGORY_COLORS.meta, params: [
    { key: "message", label: "Message", type: "text", default: "Event triggered" },
  ], description: "Log event for debugging" },
];

// Helper: get definition by ID
export function getBlockDef(id: string): BlockDefinition | undefined {
  return BLOCK_DEFINITIONS.find(b => b.id === id);
}

// Helper: group by category and subcategory
export function getBlocksByCategory(): Record<string, Record<string, BlockDefinition[]>> {
  const result: Record<string, Record<string, BlockDefinition[]>> = {};
  for (const block of BLOCK_DEFINITIONS) {
    if (!result[block.category]) result[block.category] = {};
    if (!result[block.category][block.subcategory]) result[block.category][block.subcategory] = [];
    result[block.category][block.subcategory].push(block);
  }
  return result;
}

// Helper: create a new block instance
export function createBlockInstance(blockId: string): BlockInstance {
  const def = getBlockDef(blockId);
  const params: Record<string, number | string> = {};
  if (def) {
    for (const p of def.params) {
      params[p.key] = p.default;
    }
  }
  return {
    uid: `${blockId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    blockId,
    params,
    children: [],
  };
}

// Compile blocks to a simplified strategy config for the engine
export function compileBlocksToConfig(strategy: CustomStrategy): {
  rangeWidth: number;
  rebalanceTrigger: number;
  rebalanceCooldown: number;
  stopLoss: number;
  hedgeRatio: number;
} {
  let rangeWidth = 0.15;
  let rebalanceTrigger = 0.05;
  let rebalanceCooldown = 1;
  let stopLoss = 50;
  let hedgeRatio = 0;

  // Walk blocks to extract parameters
  function walk(blocks: BlockInstance[]) {
    for (const b of blocks) {
      switch (b.blockId) {
        case "set_range": rangeWidth = (b.params.value as number) / 100; break;
        case "set_hedge": hedgeRatio = (b.params.value as number) / 100; break;
        case "trigger_rebalance": rebalanceTrigger = 0.01; break;
        case "delay_rebalance": rebalanceCooldown = Math.ceil((b.params.value as number) / 24); break;
        case "mod_cooldown": rebalanceCooldown = Math.ceil((b.params.value as number) / 24); break;
        case "close_position": stopLoss = 0; break;
        case "reduce_position": stopLoss = 100 - (b.params.value as number); break;
        case "current_il":
          if (b.params.op === ">") stopLoss = b.params.value as number;
          break;
        case "drawdown_pct":
          if (b.params.op === ">") stopLoss = b.params.value as number;
          break;
        case "price_change_pct":
          rebalanceTrigger = (b.params.value as number) / 100;
          break;
        case "days_since_rebalance":
          rebalanceCooldown = b.params.value as number;
          break;
        case "increase_range": rangeWidth += (b.params.value as number) / 100; break;
        case "decrease_range": rangeWidth = Math.max(0.01, rangeWidth - (b.params.value as number) / 100); break;
        case "increase_hedge": hedgeRatio = Math.min(1, hedgeRatio + (b.params.value as number) / 100); break;
        case "decrease_hedge": hedgeRatio = Math.max(0, hedgeRatio - (b.params.value as number) / 100); break;
        case "remove_hedge": hedgeRatio = 0; break;
      }
      if (b.children.length > 0) walk(b.children);
    }
  }

  walk(strategy.blocks);
  return { rangeWidth, rebalanceTrigger, rebalanceCooldown, stopLoss, hedgeRatio };
}
