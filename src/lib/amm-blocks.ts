// AMM Block Coding System — Type definitions and compiler for visual AMM curve design

export type AMMBlockCategory = "primitive" | "operation" | "curve" | "modifier" | "conditional" | "fee" | "multiasset" | "timevar" | "oracle" | "security";

export interface AMMBlockParam {
  key: string;
  label: string;
  type: "number" | "select";
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string }[];
  unit?: string;
}

export interface AMMBlockDefinition {
  id: string;
  label: string;
  category: AMMBlockCategory;
  subcategory: string;
  color: string;
  params: AMMBlockParam[];
  inputs?: number; // Number of input slots (for operations)
  output: "number" | "formula" | "curve";
  acceptsChildren?: boolean;
  description: string;
  symbol?: string; // Mathematical symbol for formula preview
}

export interface AMMBlockInstance {
  uid: string;
  blockId: string;
  params: Record<string, number | string>;
  children: AMMBlockInstance[];
  inputs: AMMBlockInstance[]; // Connected input blocks
}

export interface AMMDesign {
  id: string;
  name: string;
  blocks: AMMBlockInstance[];
  rootFormula?: string;
}

// Category colors (HSL-based)
export const AMM_CATEGORY_COLORS: Record<AMMBlockCategory, string> = {
  primitive: "hsl(220, 70%, 55%)",
  operation: "hsl(35, 80%, 50%)",
  curve: "hsl(150, 60%, 45%)",
  modifier: "hsl(280, 60%, 55%)",
  conditional: "hsl(350, 65%, 50%)",
  fee: "hsl(190, 70%, 45%)",
  multiasset: "hsl(30, 75%, 50%)",
  timevar: "hsl(260, 65%, 55%)",
  oracle: "hsl(45, 85%, 50%)",
  security: "hsl(0, 70%, 50%)",
};

export const AMM_CATEGORY_LABELS: Record<AMMBlockCategory, string> = {
  primitive: "Primitives",
  operation: "Operations",
  curve: "Curve Templates",
  modifier: "Modifiers",
  conditional: "Conditionals",
  fee: "Fee Logic",
  multiasset: "Multi-Asset",
  timevar: "Time-Variance",
  oracle: "Oracle & Pricing",
  security: "Security & Guards",
};

// ─── BLOCK DEFINITIONS ──────────────────────────────────────

export const AMM_BLOCK_DEFINITIONS: AMMBlockDefinition[] = [
  // 1. PRIMITIVES — Base variables
  { id: "var_x", label: "X Reserves", category: "primitive", subcategory: "Variables", color: AMM_CATEGORY_COLORS.primitive, params: [], output: "number", description: "Reserve amount of token X", symbol: "x" },
  { id: "var_y", label: "Y Reserves", category: "primitive", subcategory: "Variables", color: AMM_CATEGORY_COLORS.primitive, params: [], output: "number", description: "Reserve amount of token Y", symbol: "y" },
  { id: "const_k", label: "k (Invariant)", category: "primitive", subcategory: "Variables", color: AMM_CATEGORY_COLORS.primitive, params: [], output: "number", description: "The constant invariant k", symbol: "k" },
  { id: "const_price", label: "Current Price", category: "primitive", subcategory: "Variables", color: AMM_CATEGORY_COLORS.primitive, params: [], output: "number", description: "Current price (y/x)", symbol: "p" },
  { id: "const_number", label: "Number", category: "primitive", subcategory: "Constants", color: AMM_CATEGORY_COLORS.primitive, params: [
    { key: "value", label: "Value", type: "number", default: 1, min: 0, max: 1000000, step: 0.01 },
  ], output: "number", description: "A constant number value", symbol: "n" },

  // 2. OPERATIONS — Math operators
  { id: "op_add", label: "Add (+)", category: "operation", subcategory: "Arithmetic", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 2, output: "number", description: "Add two values", symbol: "+" },
  { id: "op_subtract", label: "Subtract (−)", category: "operation", subcategory: "Arithmetic", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 2, output: "number", description: "Subtract second from first", symbol: "−" },
  { id: "op_multiply", label: "Multiply (×)", category: "operation", subcategory: "Arithmetic", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 2, output: "number", description: "Multiply two values", symbol: "×" },
  { id: "op_divide", label: "Divide (÷)", category: "operation", subcategory: "Arithmetic", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 2, output: "number", description: "Divide first by second", symbol: "÷" },
  { id: "op_power", label: "Power (^)", category: "operation", subcategory: "Arithmetic", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 2, output: "number", description: "Raise first to power of second", symbol: "^" },
  { id: "op_sqrt", label: "Square Root (√)", category: "operation", subcategory: "Functions", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 1, output: "number", description: "Square root of value", symbol: "√" },
  { id: "op_cbrt", label: "Cube Root (∛)", category: "operation", subcategory: "Functions", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 1, output: "number", description: "Cube root of value", symbol: "∛" },
  { id: "op_ln", label: "Natural Log (ln)", category: "operation", subcategory: "Functions", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 1, output: "number", description: "Natural logarithm", symbol: "ln" },
  { id: "op_exp", label: "Exponential (e^x)", category: "operation", subcategory: "Functions", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 1, output: "number", description: "e raised to power", symbol: "e^" },
  { id: "op_min", label: "Min", category: "operation", subcategory: "Comparison", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 2, output: "number", description: "Minimum of two values", symbol: "min" },
  { id: "op_max", label: "Max", category: "operation", subcategory: "Comparison", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 2, output: "number", description: "Maximum of two values", symbol: "max" },
  { id: "op_abs", label: "Absolute (|x|)", category: "operation", subcategory: "Functions", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 1, output: "number", description: "Absolute value", symbol: "|x|" },
  { id: "op_floor", label: "Floor (⌊x⌋)", category: "operation", subcategory: "Functions", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 1, output: "number", description: "Floor (round down)", symbol: "⌊x⌋" },
  { id: "op_ceil", label: "Ceiling (⌈x⌉)", category: "operation", subcategory: "Functions", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 1, output: "number", description: "Ceiling (round up)", symbol: "⌈x⌉" },
  { id: "op_modulo", label: "Modulo (%)", category: "operation", subcategory: "Arithmetic", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 2, output: "number", description: "Remainder of division", symbol: "%" },
  { id: "op_sigmoid", label: "Sigmoid (σ)", category: "operation", subcategory: "Activation", color: AMM_CATEGORY_COLORS.operation, params: [
    { key: "steepness", label: "Steepness", type: "number", default: 1, min: 0.01, max: 100, step: 0.1 },
    { key: "center", label: "Center", type: "number", default: 0, min: -1000, max: 1000, step: 0.1 },
  ], inputs: 1, output: "number", description: "Smooth S-curve transition (logistic function)", symbol: "σ(x)" },
  { id: "op_tanh", label: "Tanh", category: "operation", subcategory: "Activation", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 1, output: "number", description: "Hyperbolic tangent (-1 to 1)", symbol: "tanh" },
  { id: "op_log2", label: "Log Base 2", category: "operation", subcategory: "Functions", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 1, output: "number", description: "Logarithm base 2", symbol: "log₂" },
  { id: "op_log10", label: "Log Base 10", category: "operation", subcategory: "Functions", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 1, output: "number", description: "Logarithm base 10", symbol: "log₁₀" },
  { id: "op_reciprocal", label: "Reciprocal (1/x)", category: "operation", subcategory: "Functions", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 1, output: "number", description: "One divided by value", symbol: "1/x" },
  { id: "op_negate", label: "Negate (-x)", category: "operation", subcategory: "Arithmetic", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 1, output: "number", description: "Flip sign of value", symbol: "-x" },
  { id: "op_avg", label: "Average", category: "operation", subcategory: "Comparison", color: AMM_CATEGORY_COLORS.operation, params: [], inputs: 2, output: "number", description: "Average of two values", symbol: "avg" },

  // 3. CURVE TEMPLATES — Pre-built curve formulas
  { id: "curve_cp", label: "Constant Product", category: "curve", subcategory: "Classic", color: AMM_CATEGORY_COLORS.curve, params: [], output: "formula", description: "x × y = k (Uniswap v2 style)", symbol: "xy=k" },
  { id: "curve_csum", label: "Constant Sum", category: "curve", subcategory: "Classic", color: AMM_CATEGORY_COLORS.curve, params: [], output: "formula", description: "x + y = k (1:1 peg)", symbol: "x+y=k" },
  { id: "curve_stable", label: "StableSwap", category: "curve", subcategory: "Stablecoin", color: AMM_CATEGORY_COLORS.curve, params: [
    { key: "amp", label: "Amplification", type: "number", default: 100, min: 1, max: 5000, step: 10 },
  ], output: "formula", description: "Curve-style stable swap with amplification factor", symbol: "A×Σx + D = A×D + D^n/Πx" },
  { id: "curve_concentrated", label: "Concentrated Liquidity", category: "curve", subcategory: "Advanced", color: AMM_CATEGORY_COLORS.curve, params: [
    { key: "lower", label: "Lower Tick", type: "number", default: 0.9, min: 0.01, max: 0.99, step: 0.01 },
    { key: "upper", label: "Upper Tick", type: "number", default: 1.1, min: 1.01, max: 10, step: 0.01 },
  ], output: "formula", description: "Uniswap v3 style concentrated liquidity range", symbol: "(x+L/√pᵤ)(y+L√pₗ)=L²" },
  { id: "curve_weighted", label: "Weighted Pool", category: "curve", subcategory: "Advanced", color: AMM_CATEGORY_COLORS.curve, params: [
    { key: "wx", label: "Weight X", type: "number", default: 0.5, min: 0.01, max: 0.99, step: 0.01 },
  ], output: "formula", description: "Balancer-style weighted pool (x^w × y^(1-w) = k)", symbol: "x^w×y^(1-w)=k" },
  { id: "curve_solidly", label: "Solidly Stable", category: "curve", subcategory: "Stablecoin", color: AMM_CATEGORY_COLORS.curve, params: [], output: "formula", description: "Solidly/Velodrome x³y + xy³ = k stable swap", symbol: "x³y+xy³=k" },
  { id: "curve_cpmm_v3", label: "CPMM + Range", category: "curve", subcategory: "Advanced", color: AMM_CATEGORY_COLORS.curve, params: [
    { key: "lower", label: "Price Low", type: "number", default: 0.5, min: 0.01, max: 0.99, step: 0.01 },
    { key: "upper", label: "Price High", type: "number", default: 2.0, min: 1.01, max: 100, step: 0.01 },
    { key: "feeTier", label: "Fee Tier", type: "select", default: "0.3", options: [
      { label: "0.01%", value: "0.01" },
      { label: "0.05%", value: "0.05" },
      { label: "0.3%", value: "0.3" },
      { label: "1%", value: "1" },
    ] },
  ], output: "formula", description: "Uniswap V3-style CPMM with fee tier selection", symbol: "CL+fee" },
  { id: "curve_xyk_offset", label: "Offset Product", category: "curve", subcategory: "Advanced", color: AMM_CATEGORY_COLORS.curve, params: [
    { key: "offsetX", label: "Offset X", type: "number", default: 10, min: 0, max: 100000, step: 1 },
    { key: "offsetY", label: "Offset Y", type: "number", default: 10, min: 0, max: 100000, step: 1 },
  ], output: "formula", description: "(x+a)(y+b) = k — offset constant product", symbol: "(x+a)(y+b)=k" },
  { id: "curve_power", label: "Power Law", category: "curve", subcategory: "Advanced", color: AMM_CATEGORY_COLORS.curve, params: [
    { key: "exponent", label: "Exponent", type: "number", default: 2, min: 0.1, max: 10, step: 0.1 },
  ], output: "formula", description: "x^n + y^n = k (generalized constant)", symbol: "xⁿ+yⁿ=k" },
  { id: "curve_custom", label: "Custom Formula", category: "curve", subcategory: "Custom", color: AMM_CATEGORY_COLORS.curve, params: [], output: "formula", acceptsChildren: true, description: "Build your own formula from blocks" },

  // 4. MODIFIERS — Adjust curve behavior
  { id: "mod_weight", label: "Weight", category: "modifier", subcategory: "Scaling", color: AMM_CATEGORY_COLORS.modifier, params: [
    { key: "w", label: "Weight", type: "number", default: 0.5, min: 0.01, max: 0.99, step: 0.01 },
  ], inputs: 1, output: "number", description: "Apply weight exponent to input", symbol: "^w" },
  { id: "mod_amplify", label: "Amplify", category: "modifier", subcategory: "Scaling", color: AMM_CATEGORY_COLORS.modifier, params: [
    { key: "factor", label: "Factor", type: "number", default: 100, min: 1, max: 10000, step: 10 },
  ], inputs: 1, output: "number", description: "Multiply by amplification factor", symbol: "A×" },
  { id: "mod_clamp", label: "Clamp Range", category: "modifier", subcategory: "Bounds", color: AMM_CATEGORY_COLORS.modifier, params: [
    { key: "min", label: "Min", type: "number", default: 0, min: 0, max: 1000000, step: 0.01 },
    { key: "max", label: "Max", type: "number", default: 1000000, min: 0, max: 1000000, step: 0.01 },
  ], inputs: 1, output: "number", description: "Clamp value between min and max" },
  { id: "mod_smooth", label: "Smooth Transition", category: "modifier", subcategory: "Interpolation", color: AMM_CATEGORY_COLORS.modifier, params: [
    { key: "blend", label: "Blend", type: "number", default: 0.5, min: 0, max: 1, step: 0.01 },
  ], inputs: 2, output: "number", description: "Smoothly blend between two curves", symbol: "lerp" },
  { id: "mod_blend", label: "Blend Curves", category: "modifier", subcategory: "Interpolation", color: AMM_CATEGORY_COLORS.modifier, params: [
    { key: "ratio", label: "Ratio", type: "number", default: 0.5, min: 0, max: 1, step: 0.01 },
  ], inputs: 2, output: "formula", description: "Blend two curve formulas by ratio" },
  { id: "mod_normalize", label: "Normalize", category: "modifier", subcategory: "Scaling", color: AMM_CATEGORY_COLORS.modifier, params: [
    { key: "target", label: "Target", type: "number", default: 1, min: 0.001, max: 1000000, step: 0.01 },
  ], inputs: 1, output: "number", description: "Scale value so it equals target at equilibrium", symbol: "norm" },
  { id: "mod_invert", label: "Invert", category: "modifier", subcategory: "Transform", color: AMM_CATEGORY_COLORS.modifier, params: [], inputs: 1, output: "number", description: "Compute k/value (flip the curve)", symbol: "k/v" },
  { id: "mod_scale", label: "Scale", category: "modifier", subcategory: "Scaling", color: AMM_CATEGORY_COLORS.modifier, params: [
    { key: "multiplier", label: "Multiplier", type: "number", default: 1, min: 0, max: 10000, step: 0.01 },
    { key: "offset", label: "Offset", type: "number", default: 0, min: -100000, max: 100000, step: 0.01 },
  ], inputs: 1, output: "number", description: "Scale and shift: multiplier × value + offset", symbol: "ax+b" },
  { id: "mod_deadzone", label: "Dead Zone", category: "modifier", subcategory: "Bounds", color: AMM_CATEGORY_COLORS.modifier, params: [
    { key: "center", label: "Center", type: "number", default: 1, min: 0, max: 100000, step: 0.01 },
    { key: "width", label: "Width", type: "number", default: 0.1, min: 0, max: 1000, step: 0.01 },
  ], inputs: 1, output: "number", description: "Zero out changes within a dead zone around center" },
  { id: "mod_smoothstep", label: "Smoothstep", category: "modifier", subcategory: "Interpolation", color: AMM_CATEGORY_COLORS.modifier, params: [
    { key: "edge0", label: "Edge 0", type: "number", default: 0, min: 0, max: 100000, step: 0.01 },
    { key: "edge1", label: "Edge 1", type: "number", default: 1, min: 0, max: 100000, step: 0.01 },
  ], inputs: 1, output: "number", description: "Hermite smoothstep interpolation between edges", symbol: "S(x)" },

  // 5. CONDITIONALS — Piecewise logic
  { id: "cond_price_above", label: "IF Price >", category: "conditional", subcategory: "Price", color: AMM_CATEGORY_COLORS.conditional, params: [
    { key: "threshold", label: "Threshold", type: "number", default: 1, min: 0, max: 100000, step: 0.01 },
  ], acceptsChildren: true, output: "formula", description: "Apply child formula when price above threshold" },
  { id: "cond_price_below", label: "IF Price <", category: "conditional", subcategory: "Price", color: AMM_CATEGORY_COLORS.conditional, params: [
    { key: "threshold", label: "Threshold", type: "number", default: 1, min: 0, max: 100000, step: 0.01 },
  ], acceptsChildren: true, output: "formula", description: "Apply child formula when price below threshold" },
  { id: "cond_price_range", label: "IF Price In Range", category: "conditional", subcategory: "Price", color: AMM_CATEGORY_COLORS.conditional, params: [
    { key: "lower", label: "Lower", type: "number", default: 0.9, min: 0, max: 100000, step: 0.01 },
    { key: "upper", label: "Upper", type: "number", default: 1.1, min: 0, max: 100000, step: 0.01 },
  ], acceptsChildren: true, output: "formula", description: "Apply child formula when price in range" },
  { id: "cond_else", label: "ELSE", category: "conditional", subcategory: "Logic", color: AMM_CATEGORY_COLORS.conditional, params: [], acceptsChildren: true, output: "formula", description: "Default fallback when no conditions match" },

  // 6. FEE LOGIC
  { id: "fee_base", label: "Base Fee", category: "fee", subcategory: "Static", color: AMM_CATEGORY_COLORS.fee, params: [
    { key: "rate", label: "Fee Rate", type: "number", default: 0.003, min: 0, max: 0.1, step: 0.001, unit: "%" },
  ], output: "number", description: "Fixed fee percentage" },
  { id: "fee_dynamic", label: "Dynamic Fee", category: "fee", subcategory: "Dynamic", color: AMM_CATEGORY_COLORS.fee, params: [
    { key: "base", label: "Base", type: "number", default: 0.003, min: 0, max: 0.1, step: 0.001 },
    { key: "scale", label: "Scale", type: "number", default: 2, min: 0.1, max: 10, step: 0.1 },
  ], output: "number", description: "Fee scales with volatility", symbol: "base × vol^scale" },
  { id: "fee_tiered", label: "Tiered Fee", category: "fee", subcategory: "Dynamic", color: AMM_CATEGORY_COLORS.fee, params: [
    { key: "low", label: "Low Vol Fee", type: "number", default: 0.001, min: 0, max: 0.1, step: 0.001 },
    { key: "mid", label: "Mid Vol Fee", type: "number", default: 0.003, min: 0, max: 0.1, step: 0.001 },
    { key: "high", label: "High Vol Fee", type: "number", default: 0.01, min: 0, max: 0.1, step: 0.001 },
  ], output: "number", description: "Step-wise fee tiers based on volatility" },

  // 7. MULTI-ASSET — Pools with 3+ tokens
  { id: "var_z", label: "Z Reserves", category: "multiasset", subcategory: "Variables", color: AMM_CATEGORY_COLORS.multiasset, params: [], output: "number", description: "Reserve amount of token Z (3rd asset)", symbol: "z" },
  { id: "var_w", label: "W Reserves", category: "multiasset", subcategory: "Variables", color: AMM_CATEGORY_COLORS.multiasset, params: [], output: "number", description: "Reserve amount of token W (4th asset)", symbol: "w" },
  { id: "var_asset_n", label: "Asset N", category: "multiasset", subcategory: "Variables", color: AMM_CATEGORY_COLORS.multiasset, params: [
    { key: "index", label: "Index", type: "number", default: 0, min: 0, max: 7, step: 1 },
  ], output: "number", description: "Reserve of Nth asset in pool", symbol: "rₙ" },
  { id: "curve_multi_weighted", label: "Multi-Asset Weighted", category: "multiasset", subcategory: "Curves", color: AMM_CATEGORY_COLORS.multiasset, params: [
    { key: "wx", label: "Weight X", type: "number", default: 0.33, min: 0.01, max: 0.99, step: 0.01 },
    { key: "wy", label: "Weight Y", type: "number", default: 0.33, min: 0.01, max: 0.99, step: 0.01 },
    { key: "wz", label: "Weight Z", type: "number", default: 0.34, min: 0.01, max: 0.99, step: 0.01 },
  ], output: "formula", description: "Balancer-style 3-asset weighted pool", symbol: "x^wₓ×y^wᵧ×z^w_z=k" },
  { id: "curve_multi_stable", label: "Multi-Asset StableSwap", category: "multiasset", subcategory: "Curves", color: AMM_CATEGORY_COLORS.multiasset, params: [
    { key: "amp", label: "Amplification", type: "number", default: 100, min: 1, max: 5000, step: 10 },
    { key: "n", label: "Num Assets", type: "number", default: 3, min: 2, max: 8, step: 1 },
  ], output: "formula", description: "Curve-style multi-asset stableswap", symbol: "An^n Σxᵢ + D = An^n D + D^(n+1)/(n^n Πxᵢ)" },
  { id: "op_sum_all", label: "Sum All (Σ)", category: "multiasset", subcategory: "Operations", color: AMM_CATEGORY_COLORS.multiasset, params: [], output: "number", description: "Sum of all asset reserves", symbol: "Σxᵢ" },
  { id: "op_product_all", label: "Product All (Π)", category: "multiasset", subcategory: "Operations", color: AMM_CATEGORY_COLORS.multiasset, params: [], output: "number", description: "Product of all asset reserves", symbol: "Πxᵢ" },
  { id: "op_geometric_mean", label: "Geometric Mean", category: "multiasset", subcategory: "Operations", color: AMM_CATEGORY_COLORS.multiasset, params: [], output: "number", description: "Geometric mean of all reserves", symbol: "(Πxᵢ)^(1/n)" },
  { id: "mod_asset_weight", label: "Per-Asset Weight", category: "multiasset", subcategory: "Modifiers", color: AMM_CATEGORY_COLORS.multiasset, params: [
    { key: "asset", label: "Asset Index", type: "number", default: 0, min: 0, max: 7, step: 1 },
    { key: "weight", label: "Weight", type: "number", default: 0.25, min: 0.01, max: 0.99, step: 0.01 },
  ], output: "number", description: "Apply weight to specific asset" },

  // 8. TIME-VARIANCE — Parameters that change over time
  { id: "var_time", label: "Current Time (t)", category: "timevar", subcategory: "Variables", color: AMM_CATEGORY_COLORS.timevar, params: [], output: "number", description: "Current time in simulation", symbol: "t" },
  { id: "var_elapsed", label: "Elapsed Time", category: "timevar", subcategory: "Variables", color: AMM_CATEGORY_COLORS.timevar, params: [], output: "number", description: "Time since pool creation", symbol: "Δt" },
  { id: "var_epoch", label: "Current Epoch", category: "timevar", subcategory: "Variables", color: AMM_CATEGORY_COLORS.timevar, params: [
    { key: "duration", label: "Epoch Duration", type: "number", default: 86400, min: 1, max: 31536000, step: 1 },
  ], output: "number", description: "Current epoch number (time ÷ duration)", symbol: "epoch" },
  { id: "mod_time_decay", label: "Time Decay", category: "timevar", subcategory: "Modifiers", color: AMM_CATEGORY_COLORS.timevar, params: [
    { key: "halflife", label: "Half-life", type: "number", default: 3600, min: 1, max: 86400, step: 1 },
  ], inputs: 1, output: "number", description: "Exponentially decay value over time", symbol: "× e^(-t/τ)" },
  { id: "mod_time_ramp", label: "Time Ramp", category: "timevar", subcategory: "Modifiers", color: AMM_CATEGORY_COLORS.timevar, params: [
    { key: "start", label: "Start Value", type: "number", default: 0, min: 0, max: 1000000, step: 0.01 },
    { key: "end", label: "End Value", type: "number", default: 1, min: 0, max: 1000000, step: 0.01 },
    { key: "duration", label: "Duration", type: "number", default: 3600, min: 1, max: 86400, step: 1 },
  ], output: "number", description: "Linear ramp from start to end over duration", symbol: "ramp(t)" },
  { id: "mod_time_oscillate", label: "Oscillate", category: "timevar", subcategory: "Modifiers", color: AMM_CATEGORY_COLORS.timevar, params: [
    { key: "amplitude", label: "Amplitude", type: "number", default: 0.1, min: 0, max: 1, step: 0.01 },
    { key: "period", label: "Period", type: "number", default: 3600, min: 1, max: 86400, step: 1 },
  ], inputs: 1, output: "number", description: "Oscillate value sinusoidally over time", symbol: "× sin(2πt/T)" },
  { id: "keyframe_lerp", label: "Keyframe Lerp", category: "timevar", subcategory: "Keyframes", color: AMM_CATEGORY_COLORS.timevar, params: [
    { key: "t0", label: "Time 0", type: "number", default: 0, min: 0, max: 100000, step: 1 },
    { key: "v0", label: "Value 0", type: "number", default: 0, min: 0, max: 1000000, step: 0.01 },
    { key: "t1", label: "Time 1", type: "number", default: 100, min: 0, max: 100000, step: 1 },
    { key: "v1", label: "Value 1", type: "number", default: 1, min: 0, max: 1000000, step: 0.01 },
  ], output: "number", description: "Linear interpolation between two keyframes", symbol: "lerp(v₀,v₁,t)" },
  { id: "keyframe_step", label: "Keyframe Step", category: "timevar", subcategory: "Keyframes", color: AMM_CATEGORY_COLORS.timevar, params: [
    { key: "switchTime", label: "Switch At", type: "number", default: 50, min: 0, max: 100000, step: 1 },
    { key: "before", label: "Before Value", type: "number", default: 0, min: 0, max: 1000000, step: 0.01 },
    { key: "after", label: "After Value", type: "number", default: 1, min: 0, max: 1000000, step: 0.01 },
  ], output: "number", description: "Step function at specified time", symbol: "step(t)" },
  { id: "cond_time_before", label: "IF Time <", category: "timevar", subcategory: "Conditionals", color: AMM_CATEGORY_COLORS.timevar, params: [
    { key: "threshold", label: "Time", type: "number", default: 100, min: 0, max: 100000, step: 1 },
  ], acceptsChildren: true, output: "formula", description: "Apply when time is before threshold" },
  { id: "cond_time_after", label: "IF Time >", category: "timevar", subcategory: "Conditionals", color: AMM_CATEGORY_COLORS.timevar, params: [
    { key: "threshold", label: "Time", type: "number", default: 100, min: 0, max: 100000, step: 1 },
  ], acceptsChildren: true, output: "formula", description: "Apply when time is after threshold" },
  { id: "cond_epoch_is", label: "IF Epoch =", category: "timevar", subcategory: "Conditionals", color: AMM_CATEGORY_COLORS.timevar, params: [
    { key: "epoch", label: "Epoch", type: "number", default: 0, min: 0, max: 1000, step: 1 },
  ], acceptsChildren: true, output: "formula", description: "Apply during specific epoch" },

  // 9. ORACLE & PRICING — External price feeds and TWAP
  { id: "oracle_twap", label: "TWAP Price", category: "oracle", subcategory: "Price Feeds", color: AMM_CATEGORY_COLORS.oracle, params: [
    { key: "window", label: "Window (s)", type: "number", default: 1800, min: 60, max: 86400, step: 60 },
  ], output: "number", description: "Time-weighted average price over window", symbol: "TWAP" },
  { id: "oracle_spot", label: "Spot Price", category: "oracle", subcategory: "Price Feeds", color: AMM_CATEGORY_COLORS.oracle, params: [], output: "number", description: "Current spot price (y/x)", symbol: "spot" },
  { id: "oracle_ema", label: "EMA Price", category: "oracle", subcategory: "Price Feeds", color: AMM_CATEGORY_COLORS.oracle, params: [
    { key: "alpha", label: "Smoothing (α)", type: "number", default: 0.1, min: 0.001, max: 1, step: 0.01 },
  ], output: "number", description: "Exponential moving average price", symbol: "EMA" },
  { id: "oracle_deviation", label: "Price Deviation", category: "oracle", subcategory: "Analytics", color: AMM_CATEGORY_COLORS.oracle, params: [
    { key: "reference", label: "Reference", type: "number", default: 1, min: 0.001, max: 100000, step: 0.01 },
  ], inputs: 0, output: "number", description: "Deviation of current price from reference price", symbol: "|Δp|" },
  { id: "oracle_volatility", label: "Implied Volatility", category: "oracle", subcategory: "Analytics", color: AMM_CATEGORY_COLORS.oracle, params: [
    { key: "lookback", label: "Lookback", type: "number", default: 24, min: 1, max: 168, step: 1 },
  ], output: "number", description: "Estimated volatility from price history", symbol: "σ" },
  { id: "oracle_liquidity_depth", label: "Liquidity Depth", category: "oracle", subcategory: "Analytics", color: AMM_CATEGORY_COLORS.oracle, params: [
    { key: "bps", label: "Basis Points", type: "number", default: 200, min: 1, max: 10000, step: 1 },
  ], output: "number", description: "Liquidity available within N bps of current price", symbol: "depth" },
  { id: "oracle_price_impact", label: "Price Impact", category: "oracle", subcategory: "Analytics", color: AMM_CATEGORY_COLORS.oracle, params: [
    { key: "tradeSize", label: "Trade Size", type: "number", default: 100, min: 0.01, max: 1000000, step: 1 },
  ], inputs: 0, output: "number", description: "Estimated price impact for a given trade size", symbol: "Δp%" },

  // 10. SECURITY & GUARDS — Protection mechanisms
  { id: "guard_max_trade", label: "Max Trade Size", category: "security", subcategory: "Limits", color: AMM_CATEGORY_COLORS.security, params: [
    { key: "maxPct", label: "Max % of Pool", type: "number", default: 10, min: 0.1, max: 100, step: 0.1, unit: "%" },
  ], output: "number", description: "Reject trades larger than % of pool reserves", symbol: "maxTx" },
  { id: "guard_price_band", label: "Price Band", category: "security", subcategory: "Limits", color: AMM_CATEGORY_COLORS.security, params: [
    { key: "lower", label: "Lower Bound", type: "number", default: 0.8, min: 0.01, max: 0.99, step: 0.01 },
    { key: "upper", label: "Upper Bound", type: "number", default: 1.2, min: 1.01, max: 100, step: 0.01 },
  ], output: "number", description: "Halt trading if price exits band", symbol: "band" },
  { id: "guard_rate_limit", label: "Rate Limiter", category: "security", subcategory: "Limits", color: AMM_CATEGORY_COLORS.security, params: [
    { key: "maxPerBlock", label: "Max/Block", type: "number", default: 5, min: 1, max: 100, step: 1 },
    { key: "cooldown", label: "Cooldown (s)", type: "number", default: 12, min: 1, max: 3600, step: 1 },
  ], output: "number", description: "Limit trades per block/time window", symbol: "rate" },
  { id: "guard_slippage", label: "Slippage Guard", category: "security", subcategory: "Protection", color: AMM_CATEGORY_COLORS.security, params: [
    { key: "maxSlippage", label: "Max Slippage", type: "number", default: 1, min: 0.01, max: 50, step: 0.01, unit: "%" },
  ], output: "number", description: "Revert if slippage exceeds threshold", symbol: "slip%" },
  { id: "guard_sandwich", label: "Anti-Sandwich", category: "security", subcategory: "Protection", color: AMM_CATEGORY_COLORS.security, params: [
    { key: "delay", label: "Delay Blocks", type: "number", default: 1, min: 1, max: 10, step: 1 },
  ], output: "number", description: "Enforce minimum delay between same-direction trades", symbol: "anti-MEV" },
  { id: "guard_oracle_check", label: "Oracle Price Check", category: "security", subcategory: "Protection", color: AMM_CATEGORY_COLORS.security, params: [
    { key: "maxDeviation", label: "Max Deviation", type: "number", default: 5, min: 0.1, max: 50, step: 0.1, unit: "%" },
  ], output: "number", description: "Compare pool price vs oracle and halt on deviation", symbol: "Δoracle" },
];

// ─── HELPERS ──────────────────────────────────────────────────

export function getAMMBlockDef(blockId: string): AMMBlockDefinition | undefined {
  return AMM_BLOCK_DEFINITIONS.find(b => b.id === blockId);
}

export function getAMMBlocksByCategory(): Record<AMMBlockCategory, Record<string, AMMBlockDefinition[]>> {
  const grouped: Record<AMMBlockCategory, Record<string, AMMBlockDefinition[]>> = {
    primitive: {},
    operation: {},
    curve: {},
    modifier: {},
    conditional: {},
    fee: {},
    multiasset: {},
    timevar: {},
    oracle: {},
    security: {},
  };
  for (const block of AMM_BLOCK_DEFINITIONS) {
    if (!grouped[block.category][block.subcategory]) {
      grouped[block.category][block.subcategory] = [];
    }
    grouped[block.category][block.subcategory].push(block);
  }
  return grouped;
}

export function createAMMBlockInstance(blockId: string): AMMBlockInstance {
  const def = getAMMBlockDef(blockId);
  if (!def) throw new Error(`Unknown block: ${blockId}`);
  const params: Record<string, number | string> = {};
  for (const p of def.params) {
    params[p.key] = p.default;
  }
  return {
    uid: `${blockId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    blockId,
    params,
    children: [],
    inputs: [],
  };
}

// ─── FORMULA COMPILER ──────────────────────────────────────────

export interface CompiledAMMFormula {
  formula: string;        // Human-readable formula string
  curveType: string;      // Detected curve type
  feeLogic?: string;      // Fee description
  params: Record<string, number>;
}

function compileBlockToFormula(block: AMMBlockInstance): string {
  const def = getAMMBlockDef(block.blockId);
  if (!def) return "?";

  // Primitives
  if (block.blockId === "var_x") return "x";
  if (block.blockId === "var_y") return "y";
  if (block.blockId === "const_k") return "k";
  if (block.blockId === "const_price") return "p";
  if (block.blockId === "const_number") return String(block.params.value);

  // Operations
  if (block.blockId === "op_add" && block.inputs.length === 2) {
    return `(${compileBlockToFormula(block.inputs[0])} + ${compileBlockToFormula(block.inputs[1])})`;
  }
  if (block.blockId === "op_subtract" && block.inputs.length === 2) {
    return `(${compileBlockToFormula(block.inputs[0])} − ${compileBlockToFormula(block.inputs[1])})`;
  }
  if (block.blockId === "op_multiply" && block.inputs.length === 2) {
    return `(${compileBlockToFormula(block.inputs[0])} × ${compileBlockToFormula(block.inputs[1])})`;
  }
  if (block.blockId === "op_divide" && block.inputs.length === 2) {
    return `(${compileBlockToFormula(block.inputs[0])} ÷ ${compileBlockToFormula(block.inputs[1])})`;
  }
  if (block.blockId === "op_power" && block.inputs.length === 2) {
    return `${compileBlockToFormula(block.inputs[0])}^${compileBlockToFormula(block.inputs[1])}`;
  }
  if (block.blockId === "op_sqrt" && block.inputs.length >= 1) {
    return `√(${compileBlockToFormula(block.inputs[0])})`;
  }
  if (block.blockId === "op_cbrt" && block.inputs.length >= 1) {
    return `∛(${compileBlockToFormula(block.inputs[0])})`;
  }
  if (block.blockId === "op_ln" && block.inputs.length >= 1) {
    return `ln(${compileBlockToFormula(block.inputs[0])})`;
  }
  if (block.blockId === "op_exp" && block.inputs.length >= 1) {
    return `e^(${compileBlockToFormula(block.inputs[0])})`;
  }
  if (block.blockId === "op_min" && block.inputs.length === 2) {
    return `min(${compileBlockToFormula(block.inputs[0])}, ${compileBlockToFormula(block.inputs[1])})`;
  }
  if (block.blockId === "op_max" && block.inputs.length === 2) {
    return `max(${compileBlockToFormula(block.inputs[0])}, ${compileBlockToFormula(block.inputs[1])})`;
  }
  if (block.blockId === "op_abs" && block.inputs.length >= 1) {
    return `|${compileBlockToFormula(block.inputs[0])}|`;
  }
  if (block.blockId === "op_floor" && block.inputs.length >= 1) {
    return `⌊${compileBlockToFormula(block.inputs[0])}⌋`;
  }
  if (block.blockId === "op_ceil" && block.inputs.length >= 1) {
    return `⌈${compileBlockToFormula(block.inputs[0])}⌉`;
  }
  if (block.blockId === "op_modulo" && block.inputs.length === 2) {
    return `(${compileBlockToFormula(block.inputs[0])} % ${compileBlockToFormula(block.inputs[1])})`;
  }
  if (block.blockId === "op_sigmoid" && block.inputs.length >= 1) {
    return `σ(${compileBlockToFormula(block.inputs[0])}, k=${block.params.steepness}, c=${block.params.center})`;
  }
  if (block.blockId === "op_tanh" && block.inputs.length >= 1) {
    return `tanh(${compileBlockToFormula(block.inputs[0])})`;
  }
  if (block.blockId === "op_log2" && block.inputs.length >= 1) {
    return `log₂(${compileBlockToFormula(block.inputs[0])})`;
  }
  if (block.blockId === "op_log10" && block.inputs.length >= 1) {
    return `log₁₀(${compileBlockToFormula(block.inputs[0])})`;
  }
  if (block.blockId === "op_reciprocal" && block.inputs.length >= 1) {
    return `1/(${compileBlockToFormula(block.inputs[0])})`;
  }
  if (block.blockId === "op_negate" && block.inputs.length >= 1) {
    return `-(${compileBlockToFormula(block.inputs[0])})`;
  }
  if (block.blockId === "op_avg" && block.inputs.length === 2) {
    return `avg(${compileBlockToFormula(block.inputs[0])}, ${compileBlockToFormula(block.inputs[1])})`;
  }

  // Curve templates
  if (block.blockId === "curve_cp") return "x × y = k";
  if (block.blockId === "curve_csum") return "x + y = k";
  if (block.blockId === "curve_stable") return `StableSwap(A=${block.params.amp})`;
  if (block.blockId === "curve_concentrated") return `Concentrated(${block.params.lower}–${block.params.upper})`;
  if (block.blockId === "curve_weighted") return `x^${block.params.wx} × y^${(1 - Number(block.params.wx)).toFixed(2)} = k`;
  if (block.blockId === "curve_solidly") return "x³y + xy³ = k";
  if (block.blockId === "curve_cpmm_v3") return `CL(${block.params.lower}–${block.params.upper}, fee=${block.params.feeTier}%)`;
  if (block.blockId === "curve_xyk_offset") return `(x+${block.params.offsetX})(y+${block.params.offsetY}) = k`;
  if (block.blockId === "curve_power") return `x^${block.params.exponent} + y^${block.params.exponent} = k`;
  if (block.blockId === "curve_custom" && block.children.length > 0) {
    return block.children.map(c => compileBlockToFormula(c)).join(" ");
  }

  // Modifiers
  if (block.blockId === "mod_weight" && block.inputs.length >= 1) {
    return `${compileBlockToFormula(block.inputs[0])}^${block.params.w}`;
  }
  if (block.blockId === "mod_amplify" && block.inputs.length >= 1) {
    return `${block.params.factor} × ${compileBlockToFormula(block.inputs[0])}`;
  }
  if (block.blockId === "mod_blend" && block.inputs.length === 2) {
    return `blend(${compileBlockToFormula(block.inputs[0])}, ${compileBlockToFormula(block.inputs[1])}, ${block.params.ratio})`;
  }
  if (block.blockId === "mod_normalize" && block.inputs.length >= 1) {
    return `normalize(${compileBlockToFormula(block.inputs[0])}, target=${block.params.target})`;
  }
  if (block.blockId === "mod_invert" && block.inputs.length >= 1) {
    return `k/(${compileBlockToFormula(block.inputs[0])})`;
  }
  if (block.blockId === "mod_scale" && block.inputs.length >= 1) {
    return `${block.params.multiplier}×(${compileBlockToFormula(block.inputs[0])})+${block.params.offset}`;
  }
  if (block.blockId === "mod_deadzone" && block.inputs.length >= 1) {
    return `deadzone(${compileBlockToFormula(block.inputs[0])}, ±${block.params.width} around ${block.params.center})`;
  }
  if (block.blockId === "mod_smoothstep" && block.inputs.length >= 1) {
    return `smoothstep(${compileBlockToFormula(block.inputs[0])}, ${block.params.edge0}..${block.params.edge1})`;
  }

  // Conditionals
  if (block.blockId === "cond_price_above" && block.children.length > 0) {
    return `IF p > ${block.params.threshold}: ${block.children.map(c => compileBlockToFormula(c)).join(" ")}`;
  }
  if (block.blockId === "cond_price_below" && block.children.length > 0) {
    return `IF p < ${block.params.threshold}: ${block.children.map(c => compileBlockToFormula(c)).join(" ")}`;
  }
  if (block.blockId === "cond_price_range" && block.children.length > 0) {
    return `IF ${block.params.lower} < p < ${block.params.upper}: ${block.children.map(c => compileBlockToFormula(c)).join(" ")}`;
  }
  if (block.blockId === "cond_else" && block.children.length > 0) {
    return `ELSE: ${block.children.map(c => compileBlockToFormula(c)).join(" ")}`;
  }

  // Fee
  if (block.blockId === "fee_base") return `fee=${(Number(block.params.rate) * 100).toFixed(2)}%`;
  if (block.blockId === "fee_dynamic") return `fee=dynamic(${block.params.base}×vol^${block.params.scale})`;
  if (block.blockId === "fee_tiered") return `fee=tiered(${block.params.low}/${block.params.mid}/${block.params.high})`;

  // Oracle blocks
  if (block.blockId === "oracle_twap") return `TWAP(${block.params.window}s)`;
  if (block.blockId === "oracle_spot") return "spot(y/x)";
  if (block.blockId === "oracle_ema") return `EMA(α=${block.params.alpha})`;
  if (block.blockId === "oracle_deviation") return `|price - ${block.params.reference}|`;
  if (block.blockId === "oracle_volatility") return `vol(${block.params.lookback}h)`;
  if (block.blockId === "oracle_liquidity_depth") return `depth(${block.params.bps}bps)`;
  if (block.blockId === "oracle_price_impact") return `impact(${block.params.tradeSize})`;

  // Security blocks
  if (block.blockId === "guard_max_trade") return `maxTrade(${block.params.maxPct}%)`;
  if (block.blockId === "guard_price_band") return `priceBand(${block.params.lower}–${block.params.upper})`;
  if (block.blockId === "guard_rate_limit") return `rateLimit(${block.params.maxPerBlock}/blk, ${block.params.cooldown}s)`;
  if (block.blockId === "guard_slippage") return `slippageGuard(${block.params.maxSlippage}%)`;
  if (block.blockId === "guard_sandwich") return `antiSandwich(${block.params.delay}blks)`;
  if (block.blockId === "guard_oracle_check") return `oracleCheck(±${block.params.maxDeviation}%)`;

  return def.symbol || def.label;
}

export function compileAMMDesign(design: AMMDesign): CompiledAMMFormula {
  const formulaParts: string[] = [];
  const params: Record<string, number> = {};
  let curveType = "custom";
  let feeLogic: string | undefined;

  for (const block of design.blocks) {
    const def = getAMMBlockDef(block.blockId);
    if (!def) continue;

    // Detect curve type
    if (def.category === "curve") {
      if (block.blockId === "curve_cp") curveType = "constant-product";
      else if (block.blockId === "curve_csum") curveType = "constant-sum";
      else if (block.blockId === "curve_stable") curveType = "stableswap";
      else if (block.blockId === "curve_concentrated") curveType = "concentrated";
      else if (block.blockId === "curve_weighted") curveType = "weighted";
      else if (block.blockId === "curve_solidly") curveType = "solidly-stable";
      else if (block.blockId === "curve_cpmm_v3") curveType = "concentrated-v3";
      else if (block.blockId === "curve_xyk_offset") curveType = "offset-product";
      else if (block.blockId === "curve_power") curveType = "power-law";
    }

    // Extract params
    for (const [key, value] of Object.entries(block.params)) {
      if (typeof value === "number") {
        params[`${block.blockId}_${key}`] = value;
      }
    }

    // Compile formula part
    const part = compileBlockToFormula(block);
    if (def.category === "fee") {
      feeLogic = part;
    } else {
      formulaParts.push(part);
    }
  }

  return {
    formula: formulaParts.join(" | ") || "No formula defined",
    curveType,
    feeLogic,
    params,
  };
}

// ─── NUMERIC BLOCK EVALUATION ─────────────────────────────────

export interface EvalContext {
  x: number;
  y: number;
  k: number;
  t: number;
  assets?: number[];
}

/**
 * Evaluate a single block tree node to a numeric value.
 * Used for custom formula evaluation and curve solving.
 */
export function evaluateBlockNumeric(block: AMMBlockInstance, ctx: EvalContext): number {
  // Get input values eagerly
  const inputs = block.inputs.map(inp => evaluateBlockNumeric(inp, ctx));
  const [a, b] = inputs;

  switch (block.blockId) {
    // ── Primitives ──
    case "var_x": return ctx.x;
    case "var_y": return ctx.y;
    case "const_k": return ctx.k;
    case "const_price": return ctx.x > 0 ? ctx.y / ctx.x : 0;
    case "const_number": return Number(block.params.value) || 0;
    case "var_z": return ctx.assets?.[2] ?? 0;
    case "var_w": return ctx.assets?.[3] ?? 0;
    case "var_asset_n": return ctx.assets?.[Number(block.params.index)] ?? 0;
    case "var_time": return ctx.t;
    case "var_elapsed": return ctx.t;
    case "var_epoch": return Math.floor(ctx.t / (Number(block.params.duration) || 86400));

    // ── Arithmetic Operations ──
    case "op_add": return (a ?? 0) + (b ?? 0);
    case "op_subtract": return (a ?? 0) - (b ?? 0);
    case "op_multiply": return (a ?? 0) * (b ?? 0);
    case "op_divide": return b ? (a ?? 0) / b : 0;
    case "op_power": return Math.pow(Math.abs(a ?? 0), b ?? 1);
    case "op_sqrt": return Math.sqrt(Math.abs(a ?? 0));
    case "op_cbrt": return Math.cbrt(a ?? 0);
    case "op_ln": return (a ?? 0) > 0 ? Math.log(a!) : 0;
    case "op_exp": return Math.exp(Math.min(a ?? 0, 500));
    case "op_min": return Math.min(a ?? 0, b ?? 0);
    case "op_max": return Math.max(a ?? 0, b ?? 0);
    case "op_abs": return Math.abs(a ?? 0);
    case "op_floor": return Math.floor(a ?? 0);
    case "op_ceil": return Math.ceil(a ?? 0);
    case "op_modulo": return b ? (a ?? 0) % b : 0;
    case "op_sigmoid": {
      const k = Number(block.params.steepness) || 1;
      const c = Number(block.params.center) || 0;
      return 1 / (1 + Math.exp(-k * ((a ?? 0) - c)));
    }
    case "op_tanh": return Math.tanh(a ?? 0);
    case "op_log2": return (a ?? 0) > 0 ? Math.log2(a!) : 0;
    case "op_log10": return (a ?? 0) > 0 ? Math.log10(a!) : 0;
    case "op_reciprocal": return (a ?? 0) !== 0 ? 1 / (a!) : 0;
    case "op_negate": return -(a ?? 0);
    case "op_avg": return ((a ?? 0) + (b ?? 0)) / 2;

    // ── Curve Templates (return invariant value) ──
    case "curve_cp": return ctx.x * ctx.y;
    case "curve_csum": return ctx.x + ctx.y;
    case "curve_weighted": {
      const wx = Number(block.params.wx) || 0.5;
      return Math.pow(Math.abs(ctx.x), wx) * Math.pow(Math.abs(ctx.y), 1 - wx);
    }
    case "curve_stable": {
      const A = Number(block.params.amp) || 100;
      const sum = ctx.x + ctx.y;
      const prod = ctx.x * ctx.y;
      return A * sum + (prod > 0 ? (sum * sum) / (4 * prod) : 0);
    }
    case "curve_concentrated": {
      const lower = Number(block.params.lower) || 0.9;
      const upper = Number(block.params.upper) || 1.1;
      const L = Math.sqrt(ctx.k);
      return (ctx.x + L / Math.sqrt(upper)) * (ctx.y + L * Math.sqrt(lower));
    }
    case "curve_solidly": {
      return Math.pow(ctx.x, 3) * ctx.y + ctx.x * Math.pow(ctx.y, 3);
    }
    case "curve_cpmm_v3": {
      const lower = Number(block.params.lower) || 0.5;
      const upper = Number(block.params.upper) || 2.0;
      const L = Math.sqrt(ctx.k);
      return (ctx.x + L / Math.sqrt(upper)) * (ctx.y + L * Math.sqrt(lower));
    }
    case "curve_xyk_offset": {
      const ox = Number(block.params.offsetX) || 10;
      const oy = Number(block.params.offsetY) || 10;
      return (ctx.x + ox) * (ctx.y + oy);
    }
    case "curve_power": {
      const n = Number(block.params.exponent) || 2;
      return Math.pow(ctx.x, n) + Math.pow(ctx.y, n);
    }
    case "curve_custom": {
      if (block.children.length > 0) {
        // Last child's value is the invariant expression
        return block.children.reduce((_, child) => evaluateBlockNumeric(child, ctx), 0);
      }
      return ctx.x * ctx.y;
    }

    // ── Modifiers ──
    case "mod_weight": return Math.pow(Math.abs(a ?? 0), Number(block.params.w) || 0.5);
    case "mod_amplify": return (Number(block.params.factor) || 1) * (a ?? 0);
    case "mod_clamp": return Math.max(Number(block.params.min) || 0, Math.min(Number(block.params.max) || 1e6, a ?? 0));
    case "mod_smooth": {
      const blend = Number(block.params.blend) || 0.5;
      return (a ?? 0) * (1 - blend) + (b ?? 0) * blend;
    }
    case "mod_blend": {
      const ratio = Number(block.params.ratio) || 0.5;
      return (a ?? 0) * (1 - ratio) + (b ?? 0) * ratio;
    }
    case "mod_normalize": {
      const target = Number(block.params.target) || 1;
      const val = a ?? 1;
      return val === 0 ? target : val * (target / Math.abs(val));
    }
    case "mod_invert": return (a ?? 1) !== 0 ? ctx.k / (a!) : ctx.k;
    case "mod_scale": {
      const mult = Number(block.params.multiplier) || 1;
      const off = Number(block.params.offset) || 0;
      return mult * (a ?? 0) + off;
    }
    case "mod_deadzone": {
      const center = Number(block.params.center) || 1;
      const width = Number(block.params.width) || 0.1;
      const val = a ?? 0;
      return Math.abs(val - center) < width ? center : val;
    }
    case "mod_smoothstep": {
      const e0 = Number(block.params.edge0) || 0;
      const e1 = Number(block.params.edge1) || 1;
      const val = a ?? 0;
      const t = Math.max(0, Math.min(1, (val - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    }

    // ── Conditionals ──
    case "cond_price_above": {
      const price = ctx.x > 0 ? ctx.y / ctx.x : 0;
      if (price > Number(block.params.threshold) && block.children.length > 0) {
        return evaluateBlockNumeric(block.children[0], ctx);
      }
      return ctx.x * ctx.y; // fallback CP
    }
    case "cond_price_below": {
      const price = ctx.x > 0 ? ctx.y / ctx.x : 0;
      if (price < Number(block.params.threshold) && block.children.length > 0) {
        return evaluateBlockNumeric(block.children[0], ctx);
      }
      return ctx.x * ctx.y;
    }
    case "cond_price_range": {
      const price = ctx.x > 0 ? ctx.y / ctx.x : 0;
      const lo = Number(block.params.lower);
      const hi = Number(block.params.upper);
      if (price > lo && price < hi && block.children.length > 0) {
        return evaluateBlockNumeric(block.children[0], ctx);
      }
      return ctx.x * ctx.y;
    }
    case "cond_else": {
      return block.children.length > 0 ? evaluateBlockNumeric(block.children[0], ctx) : ctx.x * ctx.y;
    }

    // ── Fee blocks (return fee rate) ──
    case "fee_base": return Number(block.params.rate) || 0.003;
    case "fee_dynamic": return Number(block.params.base) || 0.003;
    case "fee_tiered": return Number(block.params.mid) || 0.003;

    // ── Time Modifiers ──
    case "mod_time_decay": {
      const halflife = Number(block.params.halflife) || 3600;
      return (a ?? 1) * Math.exp(-ctx.t * Math.LN2 / halflife);
    }
    case "mod_time_ramp": {
      const start = Number(block.params.start);
      const end = Number(block.params.end);
      const dur = Number(block.params.duration) || 3600;
      return start + (end - start) * Math.min(1, ctx.t / dur);
    }
    case "mod_time_oscillate": {
      const amp = Number(block.params.amplitude) || 0.1;
      const period = Number(block.params.period) || 3600;
      return (a ?? 1) * (1 + amp * Math.sin(2 * Math.PI * ctx.t / period));
    }
    case "keyframe_lerp": {
      const t0 = Number(block.params.t0), v0 = Number(block.params.v0);
      const t1 = Number(block.params.t1), v1 = Number(block.params.v1);
      if (ctx.t <= t0) return v0;
      if (ctx.t >= t1) return v1;
      return v0 + (v1 - v0) * (ctx.t - t0) / (t1 - t0);
    }
    case "keyframe_step":
      return ctx.t >= Number(block.params.switchTime) ? Number(block.params.after) : Number(block.params.before);
    case "cond_time_before":
      if (ctx.t < Number(block.params.threshold) && block.children.length > 0)
        return evaluateBlockNumeric(block.children[0], ctx);
      return ctx.x * ctx.y;
    case "cond_time_after":
      if (ctx.t > Number(block.params.threshold) && block.children.length > 0)
        return evaluateBlockNumeric(block.children[0], ctx);
      return ctx.x * ctx.y;
    case "cond_epoch_is":
      if (Math.floor(ctx.t / 86400) === Number(block.params.epoch) && block.children.length > 0)
        return evaluateBlockNumeric(block.children[0], ctx);
      return ctx.x * ctx.y;

    // ── Multi-asset Operations ──
    case "op_sum_all": return (ctx.assets || [ctx.x, ctx.y]).reduce((s, v) => s + v, 0);
    case "op_product_all": return (ctx.assets || [ctx.x, ctx.y]).reduce((p, v) => p * v, 1);
    case "op_geometric_mean": {
      const arr = ctx.assets || [ctx.x, ctx.y];
      return Math.pow(arr.reduce((p, v) => p * Math.abs(v), 1), 1 / arr.length);
    }
    case "mod_asset_weight": {
      const idx = Number(block.params.asset) || 0;
      const w = Number(block.params.weight) || 0.25;
      const val = ctx.assets?.[idx] ?? (idx === 0 ? ctx.x : ctx.y);
      return Math.pow(Math.abs(val), w);
    }
    case "curve_multi_weighted": {
      const wx = Number(block.params.wx) || 0.33;
      const wy = Number(block.params.wy) || 0.33;
      const wz = Number(block.params.wz) || 0.34;
      const z = ctx.assets?.[2] ?? Math.cbrt(ctx.k);
      return Math.pow(ctx.x, wx) * Math.pow(ctx.y, wy) * Math.pow(z, wz);
    }
    case "curve_multi_stable": {
      const A = Number(block.params.amp) || 100;
      const n = Number(block.params.n) || 3;
      const assets = ctx.assets || [ctx.x, ctx.y];
      const sum = assets.reduce((s, v) => s + v, 0);
      const prod = assets.reduce((p, v) => p * v, 1);
      return A * Math.pow(n, n) * sum + (prod > 0 ? Math.pow(sum, n + 1) / (Math.pow(n, n) * prod) : 0);
    }

    // ── Oracle blocks (simulated values) ──
    case "oracle_twap":
    case "oracle_spot": return ctx.x > 0 ? ctx.y / ctx.x : 0;
    case "oracle_ema": return ctx.x > 0 ? ctx.y / ctx.x : 0;
    case "oracle_deviation": {
      const ref = Number(block.params.reference) || 1;
      const price = ctx.x > 0 ? ctx.y / ctx.x : 0;
      return Math.abs(price - ref);
    }
    case "oracle_volatility": return 0.5; // simulated
    case "oracle_liquidity_depth": return Math.sqrt(ctx.k) * (Number(block.params.bps) / 10000);
    case "oracle_price_impact": {
      const tradeSize = Number(block.params.tradeSize) || 100;
      return tradeSize / (ctx.x + tradeSize) * 100;
    }

    // ── Security blocks (return threshold values) ──
    case "guard_max_trade": return (Number(block.params.maxPct) / 100) * ctx.x;
    case "guard_price_band": return ctx.x > 0 ? ctx.y / ctx.x : 0;
    case "guard_rate_limit": return Number(block.params.maxPerBlock) || 5;
    case "guard_slippage": return Number(block.params.maxSlippage) / 100;
    case "guard_sandwich": return Number(block.params.delay) || 1;
    case "guard_oracle_check": return Number(block.params.maxDeviation) / 100;

    default: return 0;
  }
}

/**
 * Numerically solve for y given x, using the block tree as the invariant function.
 * Uses bisection: finds y where f(x,y) = target.
 */
function solveCustomForY(formulaBlocks: AMMBlockInstance[], x: number, k: number, t: number = 0): number | null {
  // Compute the target invariant value at equilibrium (√k, √k)
  const eqY = Math.sqrt(k);
  const eqCtx: EvalContext = { x: eqY, y: eqY, k, t };
  let target = 0;
  for (const block of formulaBlocks) {
    const def = getAMMBlockDef(block.blockId);
    if (!def || def.category === "fee") continue;
    target = evaluateBlockNumeric(block, eqCtx);
  }
  if (!isFinite(target) || target === 0) target = k;

  const evalAt = (y: number): number => {
    const ctx: EvalContext = { x, y, k, t };
    let result = 0;
    for (const block of formulaBlocks) {
      const def = getAMMBlockDef(block.blockId);
      if (!def || def.category === "fee") continue;
      result = evaluateBlockNumeric(block, ctx);
    }
    return result;
  };

  // Determine monotonicity direction
  const valLo = evalAt(0.01);
  const valHi = evalAt(k * 100);
  const increasing = valHi > valLo;

  let lo = 0.001, hi = k * 100;

  // Bisection: find y where evalAt(y) ≈ target
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const val = evalAt(mid);
    if (!isFinite(val)) { hi = mid; continue; }
    const diff = val - target;
    if (Math.abs(diff) < Math.abs(target) * 1e-10) return mid;
    if ((increasing && diff > 0) || (!increasing && diff < 0)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  const result = (lo + hi) / 2;
  return isFinite(result) && result > 0 ? result : null;
}

// ─── CURVE EVALUATION ─────────────────────────────────────────

export interface CurvePoint {
  x: number;
  y: number;
}

/**
 * Evaluate the complete AMM design to generate curve points.
 * Handles named templates with closed-form solutions and custom block compositions with numeric solving.
 */
export function evaluateAMMCurve(design: AMMDesign, k: number = 10000, points: number = 100): CurvePoint[] {
  const result: CurvePoint[] = [];

  // Filter out fee-only blocks
  const formulaBlocks = design.blocks.filter(b => {
    const def = getAMMBlockDef(b.blockId);
    return def && def.category !== "fee";
  });

  if (formulaBlocks.length === 0) {
    // No formula → default constant product
    const minX = 1, maxX = Math.sqrt(k) * 3;
    for (let i = 0; i <= points; i++) {
      const x = minX + (maxX - minX) * (i / points);
      result.push({ x, y: k / x });
    }
    return result;
  }

  // Check if we have a simple named curve template (use closed-form)
  const namedCurve = formulaBlocks.find(b =>
    b.blockId.startsWith("curve_") && b.blockId !== "curve_custom"
  );
  const hasOnlyNamedCurve = namedCurve && formulaBlocks.length === 1;

  const minX = 1;
  const maxX = Math.sqrt(k) * 3;

  for (let i = 0; i <= points; i++) {
    const x = minX + (maxX - minX) * (i / points);
    let y: number | null = null;

    if (hasOnlyNamedCurve && namedCurve) {
      // Closed-form solutions for named templates
      switch (namedCurve.blockId) {
        case "curve_cp": y = k / x; break;
        case "curve_csum": y = k - x; break;
        case "curve_weighted": {
          const wx = Number(namedCurve.params.wx) || 0.5;
          y = Math.pow(k / Math.pow(x, wx), 1 / (1 - wx));
          break;
        }
        case "curve_stable": {
          const A = Number(namedCurve.params.amp) || 100;
          const D = Math.sqrt(k) * 2;
          const xMid = D / 2;
          const dist = Math.abs(x - xMid) / xMid;
          const blend = Math.min(1, dist * 2);
          const yCP = k / x;
          const yCS = D - x;
          y = yCS * (1 - blend / A) + yCP * (blend / A);
          break;
        }
        case "curve_concentrated": {
          const lower = Number(namedCurve.params.lower) || 0.9;
          const upper = Number(namedCurve.params.upper) || 1.1;
          const L = Math.sqrt(k);
          const xV = x + L / Math.sqrt(upper);
          y = (L * L) / xV - L * Math.sqrt(lower);
          break;
        }
        case "curve_solidly": {
          // x³y + xy³ = k → y found via bisection (no easy closed form)
          y = solveCustomForY([namedCurve], x, k);
          break;
        }
        case "curve_cpmm_v3": {
          const lower = Number(namedCurve.params.lower) || 0.5;
          const upper = Number(namedCurve.params.upper) || 2.0;
          const L = Math.sqrt(k);
          const xV = x + L / Math.sqrt(upper);
          y = (L * L) / xV - L * Math.sqrt(lower);
          break;
        }
        case "curve_xyk_offset": {
          const ox = Number(namedCurve.params.offsetX) || 10;
          const oy = Number(namedCurve.params.offsetY) || 10;
          y = k / (x + ox) - oy;
          break;
        }
        case "curve_power": {
          const n = Number(namedCurve.params.exponent) || 2;
          const remainder = k - Math.pow(x, n);
          y = remainder > 0 ? Math.pow(remainder, 1 / n) : null;
          break;
        }
        default: y = k / x;
      }
    } else {
      // Numeric solving for custom formulas / block compositions
      y = solveCustomForY(formulaBlocks, x, k);
    }

    if (y !== null && y > 0 && y < maxX * 10 && isFinite(y)) {
      result.push({ x, y });
    }
  }

  return result;
}

// ─── TREE MANIPULATION ────────────────────────────────────────

export function addChildToBlock(blocks: AMMBlockInstance[], parentUid: string, child: AMMBlockInstance): AMMBlockInstance[] {
  return blocks.map(b => {
    if (b.uid === parentUid) {
      return { ...b, children: [...b.children, child] };
    }
    return {
      ...b,
      children: addChildToBlock(b.children, parentUid, child),
      inputs: addChildToBlock(b.inputs, parentUid, child),
    };
  });
}

export function addInputToBlock(blocks: AMMBlockInstance[], parentUid: string, input: AMMBlockInstance): AMMBlockInstance[] {
  return blocks.map(b => {
    if (b.uid === parentUid) {
      return { ...b, inputs: [...b.inputs, input] };
    }
    return {
      ...b,
      children: addInputToBlock(b.children, parentUid, input),
      inputs: addInputToBlock(b.inputs, parentUid, input),
    };
  });
}

export function removeBlockFromTree(blocks: AMMBlockInstance[], uid: string): AMMBlockInstance[] {
  return blocks.filter(b => b.uid !== uid).map(b => ({
    ...b,
    children: removeBlockFromTree(b.children, uid),
    inputs: removeBlockFromTree(b.inputs, uid),
  }));
}

export function updateBlockParam(blocks: AMMBlockInstance[], uid: string, key: string, value: number | string): AMMBlockInstance[] {
  return blocks.map(b => {
    if (b.uid === uid) {
      return { ...b, params: { ...b.params, [key]: value } };
    }
    return {
      ...b,
      children: updateBlockParam(b.children, uid, key, value),
      inputs: updateBlockParam(b.inputs, uid, key, value),
    };
  });
}

/** Deep-clone a block instance with fresh UIDs */
export function duplicateBlockInstance(block: AMMBlockInstance): AMMBlockInstance {
  return {
    ...block,
    uid: `${block.blockId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    params: { ...block.params },
    children: block.children.map(c => duplicateBlockInstance(c)),
    inputs: block.inputs.map(i => duplicateBlockInstance(i)),
  };
}

/** Duplicate a block in the tree (adds copy after the original) */
export function duplicateBlockInTree(blocks: AMMBlockInstance[], uid: string): AMMBlockInstance[] {
  const result: AMMBlockInstance[] = [];
  for (const b of blocks) {
    result.push({
      ...b,
      children: duplicateBlockInTree(b.children, uid),
      inputs: duplicateBlockInTree(b.inputs, uid),
    });
    if (b.uid === uid) {
      result.push(duplicateBlockInstance(b));
    }
  }
  return result;
}

/** Move a block up or down among its siblings */
export function reorderBlock(blocks: AMMBlockInstance[], uid: string, direction: "up" | "down"): AMMBlockInstance[] {
  const idx = blocks.findIndex(b => b.uid === uid);
  if (idx >= 0) {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx >= 0 && newIdx < blocks.length) {
      const copy = [...blocks];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    }
    return blocks;
  }
  return blocks.map(b => ({
    ...b,
    children: reorderBlock(b.children, uid, direction),
    inputs: reorderBlock(b.inputs, uid, direction),
  }));
}

// ─── TRADE SIMULATION ─────────────────────────────────────────

export interface TradeSimulationResult {
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;       // percentage
  effectivePrice: number;
  spotPriceBefore: number;
  spotPriceAfter: number;
  slippage: number;           // percentage
  feeAmount: number;
  priceImpactBps: number;
}

/**
 * Simulate a trade on the designed AMM curve.
 * Computes output amount, price impact, and slippage for a given input.
 */
export function simulateTrade(
  design: AMMDesign,
  k: number,
  inputAmount: number,
  direction: "x-to-y" | "y-to-x" = "x-to-y"
): TradeSimulationResult {
  const sqrtK = Math.sqrt(k);
  const xBefore = sqrtK;
  const yBefore = sqrtK;

  const formulaBlocks = design.blocks.filter(b => {
    const def = getAMMBlockDef(b.blockId);
    return def && def.category !== "fee";
  });

  // Get fee rate from fee blocks
  let feeRate = 0;
  for (const block of design.blocks) {
    const def = getAMMBlockDef(block.blockId);
    if (def?.category === "fee") {
      feeRate = evaluateBlockNumeric(block, { x: xBefore, y: yBefore, k, t: 0 });
    }
  }

  const amountAfterFee = inputAmount * (1 - feeRate);
  const feeAmount = inputAmount * feeRate;

  const spotPriceBefore = yBefore / xBefore;

  let xAfter: number, yAfter: number;
  if (direction === "x-to-y") {
    xAfter = xBefore + amountAfterFee;
    // Find new y on the curve
    if (formulaBlocks.length === 0) {
      yAfter = k / xAfter;
    } else {
      yAfter = solveCustomForY(formulaBlocks, xAfter, k) ?? k / xAfter;
    }
  } else {
    yAfter = yBefore + amountAfterFee;
    if (formulaBlocks.length === 0) {
      xAfter = k / yAfter;
    } else {
      // Swap x and y conceptually
      xAfter = solveCustomForY(formulaBlocks, yAfter, k) ?? k / yAfter;
    }
  }

  const outputAmount = direction === "x-to-y"
    ? Math.max(0, yBefore - yAfter)
    : Math.max(0, xBefore - xAfter);

  const effectivePrice = inputAmount > 0 ? outputAmount / inputAmount : 0;
  const spotPriceAfter = xAfter > 0 ? yAfter / xAfter : 0;
  const priceImpact = spotPriceBefore > 0
    ? Math.abs(spotPriceAfter - spotPriceBefore) / spotPriceBefore * 100
    : 0;
  const slippage = spotPriceBefore > 0
    ? Math.abs(effectivePrice - spotPriceBefore) / spotPriceBefore * 100
    : 0;

  return {
    inputAmount,
    outputAmount,
    priceImpact,
    effectivePrice,
    spotPriceBefore,
    spotPriceAfter,
    slippage,
    feeAmount,
    priceImpactBps: Math.round(priceImpact * 100),
  };
}

// ─── CURVE ANALYTICS ──────────────────────────────────────────

export interface CurveAnalytics {
  capitalEfficiency: number;    // ratio of useful liquidity
  maxSlippage1Pct: number;      // max slippage for 1% of reserves trade
  curvature: number;            // average curvature metric
  priceRange: { min: number; max: number };
  liquidityConcentration: number; // 0-1 how concentrated liquidity is
}

export function analyzeCurve(design: AMMDesign, k: number = 10000): CurveAnalytics {
  const points = evaluateAMMCurve(design, k, 200);
  if (points.length < 3) {
    return { capitalEfficiency: 0, maxSlippage1Pct: 0, curvature: 0, priceRange: { min: 0, max: 0 }, liquidityConcentration: 0 };
  }

  // Price range
  const prices = points.filter(p => p.x > 0).map(p => p.y / p.x);
  const priceRange = { min: Math.min(...prices), max: Math.max(...prices) };

  // Capital efficiency: ratio of liquidity within ±5% of equilibrium price
  const sqrtK = Math.sqrt(k);
  const eqPrice = 1; // at equilibrium
  const nearEq = points.filter(p => {
    const price = p.x > 0 ? p.y / p.x : 0;
    return Math.abs(price - eqPrice) / eqPrice < 0.05;
  });
  const capitalEfficiency = points.length > 0 ? nearEq.length / points.length : 0;

  // Curvature: average second derivative approximation
  let curvatureSum = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d2y = points[i + 1].y - 2 * points[i].y + points[i - 1].y;
    const dx = points[i + 1].x - points[i].x;
    if (dx > 0) curvatureSum += Math.abs(d2y / (dx * dx));
  }
  const curvature = curvatureSum / Math.max(1, points.length - 2);

  // Simulate 1% trade for slippage
  const trade = simulateTrade(design, k, sqrtK * 0.01);
  const maxSlippage1Pct = trade.slippage;

  // Liquidity concentration
  const totalLiq = points.reduce((s, p) => s + p.x * p.y, 0);
  const nearLiq = nearEq.reduce((s, p) => s + p.x * p.y, 0);
  const liquidityConcentration = totalLiq > 0 ? nearLiq / totalLiq : 0;

  return { capitalEfficiency, maxSlippage1Pct, curvature, priceRange, liquidityConcentration };
}
