import { motion } from "framer-motion";
import { type Candidate, type InvariantFamilyId, INVARIANT_FAMILIES, NUM_BINS } from "@/lib/discovery-engine";

const FAMILY_COLORS: Record<InvariantFamilyId, { hue: string; ring: string; label: string }> = {
  "piecewise-bands": { hue: "hsl(172, 66%, 50%)", ring: "hsl(172, 66%, 30%)", label: "hsl(172, 66%, 65%)" },
  "amplified-hybrid": { hue: "hsl(270, 60%, 55%)", ring: "hsl(270, 60%, 35%)", label: "hsl(270, 60%, 70%)" },
  "tail-shielded": { hue: "hsl(28, 80%, 55%)", ring: "hsl(28, 80%, 35%)", label: "hsl(28, 80%, 70%)" },
  "custom": { hue: "hsl(210, 50%, 55%)", ring: "hsl(210, 50%, 35%)", label: "hsl(210, 50%, 70%)" },
};

const FEATURE_KEYS = ["curvature", "entropy", "symmetry", "tailDensityRatio", "peakConcentration", "concentrationWidth", "curvatureGradient"] as const;
const FEATURE_LABELS = ["Curvature", "Entropy", "Symmetry", "Tail Density", "Peak Conc.", "Width", "Curv. Grad."];

// Normalize feature values to 0–1 range for radar display
function normalizeFeature(key: string, value: number): number {
  const ranges: Record<string, [number, number]> = {
    curvature: [0, 50],
    curvatureGradient: [0, 30],
    entropy: [0, 6],
    symmetry: [-1, 1],
    tailDensityRatio: [0, 2],
    peakConcentration: [0, 20],
    concentrationWidth: [0, 30],
  };
  const [min, max] = ranges[key] ?? [0, 1];
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

interface Props {
  candidate: Candidate;
  size?: number;
  compact?: boolean;
  showLabels?: boolean;
}

export default function DNAFingerprint({ candidate, size = 280, compact = false, showLabels = true }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.25;
  const featureR = size * 0.2;
  const colors = FAMILY_COLORS[candidate.familyId] ?? FAMILY_COLORS["custom"];
  const familyLabel = INVARIANT_FAMILIES.find(f => f.id === candidate.familyId)?.label ?? candidate.familyId;

  // Find max bin for normalization
  const maxBin = Math.max(...Array.from(candidate.bins));

  // Build genome ring segments
  const segments: JSX.Element[] = [];
  const angleStep = (Math.PI * 2) / NUM_BINS;

  for (let i = 0; i < NUM_BINS; i++) {
    const angle = i * angleStep - Math.PI / 2;
    const nextAngle = (i + 1) * angleStep - Math.PI / 2;
    const norm = maxBin > 0 ? candidate.bins[i] / maxBin : 0;
    const r = innerR + (outerR - innerR) * norm;

    const x1Inner = cx + innerR * Math.cos(angle);
    const y1Inner = cy + innerR * Math.sin(angle);
    const x1Outer = cx + r * Math.cos(angle);
    const y1Outer = cy + r * Math.sin(angle);
    const x2Outer = cx + r * Math.cos(nextAngle);
    const y2Outer = cy + r * Math.sin(nextAngle);
    const x2Inner = cx + innerR * Math.cos(nextAngle);
    const y2Inner = cy + innerR * Math.sin(nextAngle);

    const opacity = 0.3 + norm * 0.7;

    const d = [
      `M ${x1Inner} ${y1Inner}`,
      `L ${x1Outer} ${y1Outer}`,
      `A ${r} ${r} 0 0 1 ${x2Outer} ${y2Outer}`,
      `L ${x2Inner} ${y2Inner}`,
      `A ${innerR} ${innerR} 0 0 0 ${x1Inner} ${y1Inner}`,
      "Z",
    ].join(" ");

    segments.push(
      <motion.path
        key={i}
        d={d}
        fill={colors.hue}
        opacity={opacity}
        initial={{ opacity: 0 }}
        animate={{ opacity }}
        transition={{ delay: i * 0.008, duration: 0.3 }}
      />
    );
  }

  // Build feature radar (inner arcs)
  const featurePoints = FEATURE_KEYS.map((key, i) => {
    const angle = (i / FEATURE_KEYS.length) * Math.PI * 2 - Math.PI / 2;
    const val = normalizeFeature(key, candidate.features[key]);
    const r = featureR * 0.3 + featureR * 0.7 * val;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      labelX: cx + (featureR + 8) * Math.cos(angle),
      labelY: cy + (featureR + 8) * Math.sin(angle),
      label: FEATURE_LABELS[i],
      val,
    };
  });

  const radarPath = featurePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
        {/* Background circles */}
        <circle cx={cx} cy={cy} r={outerR + 2} fill="none" stroke="hsl(var(--border))" strokeWidth={0.5} opacity={0.3} />
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="hsl(var(--border))" strokeWidth={0.5} opacity={0.2} />

        {/* Genome ring */}
        {segments}

        {/* Inner glow ring */}
        <circle cx={cx} cy={cy} r={innerR} fill={colors.ring} opacity={0.15} />

        {/* Feature radar */}
        <motion.path
          d={radarPath}
          fill={colors.label}
          opacity={0.15}
          stroke={colors.label}
          strokeWidth={1}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4, type: "spring" }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Feature dots */}
        {featurePoints.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2}
            fill={colors.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ delay: 0.6 + i * 0.05 }}
          />
        ))}

        {/* Center text */}
        {!compact && (
          <>
            <text x={cx} y={cy - 8} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={11} fontWeight={600}>
              {familyLabel}
            </text>
            <text x={cx} y={cy + 6} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={9}>
              {candidate.regime}
            </text>
            <text x={cx} y={cy + 19} textAnchor="middle" fill={colors.label} fontSize={10} fontWeight={700}>
              {candidate.score.toFixed(4)}
            </text>
          </>
        )}
      </svg>

      {showLabels && !compact && (
        <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-[10px] font-mono-data text-muted-foreground">
          {FEATURE_KEYS.map((key, i) => (
            <div key={key} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: colors.hue, opacity: 0.4 + featurePoints[i].val * 0.6 }} />
              <span>{FEATURE_LABELS[i]}</span>
              <span className="text-foreground ml-auto">{candidate.features[key].toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
