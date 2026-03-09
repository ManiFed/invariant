

# AMM Block Builder — Visual AMM Design Lab

## Concept

A new dedicated lab (`/labs/amm-builder`) for designing **AMM invariants themselves** using visual block coding — not just LP strategies. Users compose curve behaviors from mathematical and logical building blocks, then simulate and export.

This differs from the existing **Liquidity Strategy Lab** (which designs *how to manage* positions on AMMs) by focusing on designing the *AMM curve formula itself*.

---

## Key Features

### 1. Block Categories for AMM Design

| Category | Purpose | Example Blocks |
|----------|---------|----------------|
| **Core Math** | Base operations | `x`, `y`, `k`, `+`, `×`, `^`, `sqrt()` |
| **Curve Primitives** | Pre-built curves | `ConstantProduct`, `StableSwap`, `Concentrated` |
| **Modifiers** | Adjust behavior | `Weight(0.6)`, `Amplify(100)`, `RangeBound(0.9, 1.1)` |
| **Conditionals** | Piecewise logic | `IF price > X THEN...`, `WHEN volatility > Y` |
| **Fee Logic** | Dynamic fees | `BaseFee(0.3%)`, `FeeScale(volatility)` |
| **Hybrid** | Combine curves | `Blend(CurveA, CurveB, ratio)` |

### 2. Visual Canvas

- **Node-based drag-and-drop** — blocks snap together
- **Live formula preview** — shows compiled expression (e.g., `x^0.4 × y^0.6 = k`)
- **Real-time curve visualization** — curve updates as you build

### 3. Simulation Panel

- Instant slippage/IL preview
- Compare against baseline AMMs (Uniswap v2, Curve)
- Stress test with synthetic volatility

### 4. Export Options

- Generate Solidity code
- Export as JSON config
- Add to Library for community sharing

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/pages/AMMBuilderLab.tsx` | Main page with sidebar navigation |
| `src/components/labs/AMMBlockCanvas.tsx` | Visual block workspace |
| `src/components/labs/AMMBlockPalette.tsx` | Draggable block categories |
| `src/components/labs/AMMCurvePreview.tsx` | Live curve visualization |
| `src/lib/amm-blocks.ts` | Block definitions + compiler |

### Reuse from Strategy Block Editor

- **Block structure types** (`BlockDefinition`, `BlockInstance`, `BlockParam`)
- **Palette component pattern** (category expand/collapse)
- **Drag-and-drop mechanics** (drag state, drop zones)
- **Canvas block rendering** (nested children, param inputs)

---

## Block Definitions (Sample)

```typescript
// Core primitives
{ id: "var_x", label: "X Reserves", category: "primitive", output: "number" }
{ id: "var_y", label: "Y Reserves", category: "primitive", output: "number" }
{ id: "const_k", label: "k (Constant)", category: "primitive", output: "number" }

// Operations
{ id: "op_multiply", label: "×", category: "operation", inputs: 2, output: "number" }
{ id: "op_power", label: "^", category: "operation", inputs: 2, output: "number" }
{ id: "op_sqrt", label: "√", category: "operation", inputs: 1, output: "number" }

// Curve templates (expand to formula)
{ id: "curve_cp", label: "Constant Product", category: "curve", output: "formula" }
{ id: "curve_stable", label: "StableSwap", category: "curve", params: [{ key: "amp", type: "number" }] }
{ id: "curve_concentrated", label: "Concentrated", params: [{ key: "lower" }, { key: "upper" }] }

// Modifiers
{ id: "mod_weight", label: "Weight", params: [{ key: "w", type: "number", default: 0.5 }] }
{ id: "mod_blend", label: "Blend Curves", inputs: 2, params: [{ key: "ratio" }] }

// Conditional
{ id: "cond_price_above", label: "IF Price >", params: [{ key: "threshold" }], acceptsChildren: true }
```

---

## Route & Navigation

- **Route**: `/labs/amm-builder`
- **Add to Labs grid** at `/labs` with icon & description
- **Link from Advanced Mode** as an alternative to formula-based editor

---

## Summary

This creates a **visual programming environment for AMM curve design** — complementing the existing text-based Invariant Editor. Users who prefer graphical composition can build hybrid, piecewise, or experimental curves without writing formulas, then export to Solidity or use in simulations.

