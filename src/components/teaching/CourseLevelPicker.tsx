import { motion } from "framer-motion";
import { BookOpen, Zap, Flame, Lock, ArrowRight, ChevronRight } from "lucide-react";

export type CourseLevel = "beginner" | "intermediate" | "advanced";

interface Props {
  onSelectLevel: (level: CourseLevel) => void;
}

const INTERMEDIATE_TOPICS = [
  "Concentrated liquidity & capital efficiency",
  "Multi-fee tier strategies",
  "Impermanent loss hedging techniques",
  "Liquidity bootstrapping pools (LBPs)",
  "Oracle manipulation & TWAP pricing",
  "Advanced arbitrage mechanics",
];

const ADVANCED_TOPICS = [
  "Custom invariant curve design",
  "MEV protection strategies",
  "Cross-chain liquidity routing",
  "Dynamic fee algorithms",
  "Protocol-owned liquidity models",
  "Formal verification of AMM properties",
];

export default function CourseLevelPicker({ onSelectLevel }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-3xl w-full space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            What's your AMM level?
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Choose a track that matches your experience. You can always switch later.
          </p>
        </motion.div>

        {/* Level cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          {/* Beginner */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => onSelectLevel("beginner")}
            className="group relative text-left rounded-xl border-2 border-success/30 bg-success/5 p-5 space-y-3 hover:border-success/60 hover:bg-success/10 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center">
                <BookOpen className="w-4.5 h-4.5 text-success" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Beginner</div>
                <div className="text-[10px] text-muted-foreground">Start from scratch</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Learn what AMMs are, how constant-product pools work, slippage, impermanent loss, and fees — all from zero.
            </p>
            <div className="flex items-center gap-1 text-xs font-medium text-success">
              <span>Start course</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="absolute top-3 right-3">
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/20">
                7 modules
              </span>
            </div>
          </motion.button>

          {/* Intermediate */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => onSelectLevel("intermediate")}
            className="group relative text-left rounded-xl border-2 border-warning/30 bg-warning/5 p-5 space-y-3 hover:border-warning/60 hover:bg-warning/10 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-warning/15 flex items-center justify-center">
                <Zap className="w-4.5 h-4.5 text-warning" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Intermediate</div>
                <div className="text-[10px] text-muted-foreground">Deepen your knowledge</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Concentrated liquidity, range strategies, fee tier design, LBPs, oracle pricing, and MEV mechanics.
            </p>
            <div className="flex items-center gap-1 text-xs font-medium text-warning">
              <span>Start course</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="absolute top-3 right-3">
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/20">
                6 modules
              </span>
            </div>
          </motion.button>

          {/* Advanced */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => onSelectLevel("advanced")}
            className="group relative text-left rounded-xl border-2 border-destructive/20 bg-destructive/5 p-5 space-y-3 hover:border-destructive/40 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-destructive/15 flex items-center justify-center">
                <Flame className="w-4.5 h-4.5 text-destructive" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  Advanced
                  <Lock className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="text-[10px] text-muted-foreground">Protocol design</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Design custom invariants, MEV protection, cross-chain routing, dynamic fees, and formal verification.
            </p>
            <div className="flex items-center gap-1 text-xs font-medium text-destructive/70">
              <span>Coming soon</span>
            </div>
            <div className="absolute top-3 right-3">
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-destructive/10 text-destructive/70 border border-destructive/15">
                6 modules
              </span>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export function ComingSoonOverlay({
  level,
  onBack,
}: {
  level: "intermediate" | "advanced";
  onBack: () => void;
}) {
  const isIntermediate = level === "intermediate";
  const topics = isIntermediate ? INTERMEDIATE_TOPICS : ADVANCED_TOPICS;
  const Icon = isIntermediate ? Zap : Flame;
  const label = isIntermediate ? "Intermediate" : "Advanced";

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full space-y-6"
      >
        <div className="text-center space-y-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${isIntermediate ? "bg-warning/15" : "bg-destructive/15"}`}>
            <Icon className={`w-7 h-7 ${isIntermediate ? "text-warning" : "text-destructive"}`} />
          </div>
          <h2 className="text-xl font-bold text-foreground">{label} Track</h2>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${isIntermediate ? "bg-warning/10 border border-warning/20" : "bg-destructive/10 border border-destructive/20"}`}>
            <Lock className={`w-3 h-3 ${isIntermediate ? "text-warning" : "text-destructive"}`} />
            <span className={`text-xs font-medium ${isIntermediate ? "text-warning" : "text-destructive"}`}>Coming Soon</span>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Planned Curriculum
          </h3>
          <div className="space-y-1.5">
            {topics.map((topic, i) => (
              <motion.div
                key={topic}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg bg-muted/50"
              >
                <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground">{topic}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <button
          onClick={onBack}
          className="w-full py-2.5 rounded-lg bg-secondary border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          ← Back to level select
        </button>
      </motion.div>
    </div>
  );
}
