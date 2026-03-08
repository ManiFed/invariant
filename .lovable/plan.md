

# AMM DNA Visualizer

A new interactive page at `/labs/dna` that renders the genetic fingerprint of any AMM design — its bin distribution as a radial genome, mutation lineage as a tree, and trait comparison across candidates.

---

## What Gets Built

### 1. DNA Fingerprint Visualization (`src/components/labs/DNAFingerprint.tsx`)
- **Radial genome ring**: 64 bins rendered as segments in a circular layout (like a chromosome ring). Each segment's height/color encodes liquidity density. Color maps to family (teal = piecewise-bands, purple = amplified-hybrid, orange = tail-shielded).
- **Inner rings**: Feature descriptors (curvature, entropy, symmetry, tail density, peak concentration) as concentric radar-style arcs.
- **Center label**: Family name, regime badge, composite score.
- Built with SVG + framer-motion for animated transitions when switching candidates.

### 2. Trait Comparison Mode (`src/components/labs/DNAComparison.tsx`)
- Select 2-3 candidates side-by-side. Their genome rings render in parallel with a difference overlay highlighting where bin distributions diverge (red = more liquidity in A, blue = more in B).
- Below: a normalized bar chart comparing all 7 metrics + 7 features head-to-head.
- "Similarity Score" computed as cosine similarity of the bin vectors.

### 3. Lineage Tree (`src/components/labs/DNALineage.tsx`)
- Traces evolution ancestry through the archive: candidates sharing the same `familyId` and `regime` are grouped into lineage chains sorted by generation.
- Rendered as a vertical timeline/tree. Each node is a mini genome thumbnail. Clicking a node loads its full fingerprint.
- Highlights mutation jumps (large score changes between generations) with glow effects.

### 4. New Lab Card + Route
- Add "AMM DNA Visualizer" card to `/labs` page with a DNA/Fingerprint icon.
- New route `/labs/dna` in `App.tsx` pointing to a new `src/pages/DNALab.tsx`.
- The page uses `useDiscoveryEngine()` to access the live archive, with a candidate picker sidebar and the three visualization panels in a tabbed layout (Fingerprint | Compare | Lineage).

---

## File Plan

| File | Action |
|------|--------|
| `src/pages/DNALab.tsx` | Create — page shell with candidate picker + tabs |
| `src/components/labs/DNAFingerprint.tsx` | Create — radial genome ring SVG component |
| `src/components/labs/DNAComparison.tsx` | Create — side-by-side diff view |
| `src/components/labs/DNALineage.tsx` | Create — generational ancestry tree |
| `src/pages/Labs.tsx` | Edit — add DNA Visualizer card |
| `src/App.tsx` | Edit — add `/labs/dna` route |

No database changes needed — reads entirely from the in-memory discovery engine archive.

