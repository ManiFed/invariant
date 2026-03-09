import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Lightbulb, SkipForward, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export interface ChallengeConfig {
  id: string;
  title: string;
  description: string;
  targetMetric: string; // "slippage" | "price" | "il" | "reserveRatio" | "feeAccum"
  targetValue: number;
  tolerance: number; // e.g. 0.5 means ±0.5
  unit: string; // "%" | "x" | "" 
  hint: string;
  highlightControls: string[];
}

interface Props {
  challenge: ChallengeConfig;
  currentValue: number;
  onComplete: () => void;
  onSkip: () => void;
}

export default function ChallengeStep({ challenge, currentValue, onComplete, onSkip }: Props) {
  const [completed, setCompleted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const completedRef = useRef(false);

  const distance = Math.abs(currentValue - challenge.targetValue);
  const withinTolerance = distance <= challenge.tolerance;
  const progressPct = Math.min(100, Math.max(0, (1 - distance / Math.max(Math.abs(challenge.targetValue), 1)) * 100));

  useEffect(() => {
    if (withinTolerance && !completedRef.current) {
      completedRef.current = true;
      setCompleted(true);
      setShowCelebration(true);
      const timer = setTimeout(() => {
        onComplete();
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [withinTolerance, onComplete]);

  return (
    <div className="space-y-3">
      {/* Challenge header */}
      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20">
        <Target className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <div>
          <h4 className="text-[11px] font-semibold text-foreground">{challenge.title}</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">{challenge.description}</p>
        </div>
      </div>

      {/* Target vs Current */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Current</span>
          <span className="font-mono text-foreground">
            {currentValue.toFixed(2)}{challenge.unit}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Target</span>
          <span className="font-mono text-warning font-semibold">
            {challenge.targetValue.toFixed(2)}{challenge.unit} ±{challenge.tolerance}{challenge.unit}
          </span>
        </div>

        {/* Distance indicator */}
        <div className="space-y-1">
          <Progress value={progressPct} className="h-2" />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>Far</span>
            <span>{completed ? "🎯 Hit!" : `${distance.toFixed(2)}${challenge.unit} away`}</span>
            <span>Target</span>
          </div>
        </div>
      </div>

      {/* Celebration */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-success/10 border border-success/20"
          >
            <CheckCircle2 className="w-4 h-4 text-success" />
            <div>
              <div className="text-[11px] font-semibold text-success">Challenge Complete! +50 XP</div>
              <div className="text-[9px] text-muted-foreground">Moving on...</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint & Skip */}
      {!completed && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowHint(!showHint)}
            className="text-[9px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Lightbulb className="w-3 h-3" />
            {showHint ? "Hide hint" : "Show hint"}
          </button>
          <button
            onClick={onSkip}
            className="text-[9px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <SkipForward className="w-3 h-3" /> Skip
          </button>
        </div>
      )}

      <AnimatePresence>
        {showHint && !completed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-2 rounded-lg bg-secondary border border-border text-[10px] text-muted-foreground">
              💡 {challenge.hint}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
