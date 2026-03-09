// AMM Block Coding System — Type definitions and compiler for visual AMM curve design

export type AMMBlockCategory = "primitive" | "operation" | "curve" | "modifier" | "conditional" | "fee" | "multiasset" | "timevar";

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
};

export const AMM_CATEGORY_LABELS: Record<AMMBlockCategory, string> = {
  primitive: "Primitives",
  operation: "Operations",
  curve: "Curve Templates",
  modifier: "Modifiers",
  conditional: "Conditionals",
  fee: "Fee Logic",
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

  // Curve templates
  if (block.blockId === "curve_cp") return "x × y = k";
  if (block.blockId === "curve_csum") return "x + y = k";
  if (block.blockId === "curve_stable") return `StableSwap(A=${block.params.amp})`;
  if (block.blockId === "curve_concentrated") return `Concentrated(${block.params.lower}–${block.params.upper})`;
  if (block.blockId === "curve_weighted") return `x^${block.params.wx} × y^${(1 - Number(block.params.wx)).toFixed(2)} = k`;
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

// ─── CURVE EVALUATION ─────────────────────────────────────────

export interface CurvePoint {
  x: number;
  y: number;
}

export function evaluateAMMCurve(design: AMMDesign, k: number = 10000, points: number = 100): CurvePoint[] {
  const result: CurvePoint[] = [];
  const compiled = compileAMMDesign(design);
  
  // Generate curve based on detected type
  const minX = 1;
  const maxX = Math.sqrt(k) * 3;
  
  for (let i = 0; i <= points; i++) {
    const x = minX + (maxX - minX) * (i / points);
    let y: number;

    // Find the first curve block and evaluate
    const curveBlock = design.blocks.find(b => getAMMBlockDef(b.blockId)?.category === "curve");
    
    if (!curveBlock) {
      // Default to constant product
      y = k / x;
    } else if (curveBlock.blockId === "curve_cp") {
      y = k / x;
    } else if (curveBlock.blockId === "curve_csum") {
      y = k - x;
      if (y < 0) continue;
    } else if (curveBlock.blockId === "curve_weighted") {
      const wx = Number(curveBlock.params.wx) || 0.5;
      // x^wx * y^(1-wx) = k => y = (k / x^wx)^(1/(1-wx))
      y = Math.pow(k / Math.pow(x, wx), 1 / (1 - wx));
    } else if (curveBlock.blockId === "curve_stable") {
      // Simplified StableSwap approximation
      const A = Number(curveBlock.params.amp) || 100;
      const D = Math.sqrt(k) * 2;
      // Use constant product as base, flatten around midpoint
      const xMid = D / 2;
      const dist = Math.abs(x - xMid) / xMid;
      const blend = Math.min(1, dist * 2);
      const yCP = k / x;
      const yCS = D - x;
      y = yCS * (1 - blend / A) + yCP * (blend / A);
      if (y < 0) continue;
    } else if (curveBlock.blockId === "curve_concentrated") {
      const lower = Number(curveBlock.params.lower) || 0.9;
      const upper = Number(curveBlock.params.upper) || 1.1;
      const L = Math.sqrt(k);
      const sqrtPl = Math.sqrt(lower);
      const sqrtPu = Math.sqrt(upper);
      // Virtual reserves model
      const xVirtual = x + L / sqrtPu;
      const yVirtual = (L * L) / xVirtual - L * sqrtPl;
      y = Math.max(0, yVirtual);
    } else {
      // Fallback to constant product
      y = k / x;
    }

    if (y > 0 && y < maxX * 10 && isFinite(y)) {
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
    if (b.children.length > 0) {
      return { ...b, children: addChildToBlock(b.children, parentUid, child) };
    }
    return b;
  });
}

export function addInputToBlock(blocks: AMMBlockInstance[], parentUid: string, input: AMMBlockInstance): AMMBlockInstance[] {
  return blocks.map(b => {
    if (b.uid === parentUid) {
      return { ...b, inputs: [...b.inputs, input] };
    }
    if (b.children.length > 0) {
      return { ...b, children: addInputToBlock(b.children, parentUid, input) };
    }
    return b;
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
