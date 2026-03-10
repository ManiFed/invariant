# AMM Designer (Block Editor) End-to-End Evaluation

## Scope
This evaluation checks whether the **AMM Block Builder** can support a full advanced AMM workflow from design to simulation/comparison/deployment.

## Verdict
**Current status: Not yet end-to-end complete.**

The Block Builder can construct and preview curves, but critical handoff points to the broader advanced workflow are either missing or schema-incompatible.

---

## Workflow Exam Matrix

| Stage | Expected | Current Result | Status |
|---|---|---|---|
| 1) Build AMM visually | Compose invariant via blocks and parameters | Works for adding blocks, params, nested child/input blocks | ✅ |
| 2) Compile to formula | Produce a usable symbolic output and metadata | Works, but metadata is generic and can be lossy for custom trees | ⚠️ |
| 3) Simulate/compare in other advanced labs | Export from builder and import into Advanced/Multi-Asset/Time-Variance labs | **Broken contract**: export shape differs from import expectations | ❌ |
| 4) Compile/deploy via Compiler Lab | Move design into compiler pipeline | No direct bridge from Block Builder to library/compiler pipeline | ❌ |
| 5) Solidity export fidelity | Generated contract should match designed family/type | Family mapping mismatch defaults most designs to piecewise-bands template | ❌ |

---

## Findings

### F1 — Export/Import schema mismatch blocks cross-lab handoff (Critical)
- Block Builder exports JSON as:
  - `{ design, compiled }`
- Advanced/Multi-Asset/Time-Variance import handlers expect top-level fields like:
  - `formula`, `expression`, `params`, etc.
- Result: importing a raw Block Builder export does not preserve intended formula/params and typically falls back to defaults.

**Impact:** The designer cannot reliably continue into analysis tabs as a single workflow.

### F2 — No first-class “send to next lab” pathway (High)
- AMM Design Studio hosts Block Builder, Multi-Asset, Time-Variance, and Compiler as separate modes.
- There is no shared state/store bridge that carries the current Block Builder design into other modes.

**Impact:** Users must manually export/import and still hit schema mismatch (F1).

### F3 — Solidity generator family mismatch (Critical)
- Block Builder passes `compiled.curveType` as `familyId` to Solidity codegen.
- Codegen only recognizes `amplified-hybrid` and `tail-shielded`; unknown family IDs fall back to `piecewise-bands`.

**Impact:** Exported Solidity often does **not** represent the user’s chosen curve family (e.g., constant-product/weighted/etc.), undermining deployment confidence.

### F4 — Compiler Lab source-of-truth disconnected from builder (High)
- Compiler Lab loads designs from `library_amms` (Supabase), not from Block Builder state/export.
- Block Builder has no publish/persist action to that library table.

**Impact:** “Design → Compile → Deploy” is not directly possible from the Block Editor alone.

### F5 — Single-root semantics are ambiguous for multi-block top-level designs (Medium)
- `compileAMMDesign` iterates over top-level blocks and joins formula parts.
- Numeric evaluation path effectively uses the last non-fee block result during solving loops.

**Impact:** Complex top-level compositions can behave unexpectedly unless users manually structure a single coherent root block.

---

## What Works Well
- Visual composition is functional and easy to start with presets.
- Formula preview and curve chart update in real time.
- Basic export actions (JSON and Solidity file download) are present.

---

## Minimum changes needed for a true end-to-end advanced workflow
1. **Unify JSON contract**
   - Define one canonical AMM design schema used by export/import across all labs.
   - Provide migration adapters for legacy files.
2. **Add inter-lab handoff actions**
   - Buttons like “Open in Advanced Mode”, “Open in Multi-Asset Lab”, “Open in Compiler”.
   - Persist via shared store/session or canonical serialized payload.
3. **Fix codegen family mapping**
   - Map block-compiled curve types to supported codegen families explicitly.
   - Block unsupported families with clear UX warnings instead of silent fallback.
4. **Integrate Block Builder with library pipeline**
   - “Save/Publish to Library” from builder into `library_amms` (or equivalent local abstraction).
5. **Enforce single-root invariant graph**
   - Require one explicit output root node and validate graph before export/simulate.

---

## Final Assessment
The Block Editor is currently a **strong prototyping UI**, but **not yet a complete advanced AMM production workflow**. The biggest blockers are cross-lab data contract mismatches and deployment-codegen fidelity.
