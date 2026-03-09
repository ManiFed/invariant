import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, BookOpen, GraduationCap, Calculator, SkipForward, ArrowRight, Check, Lock, Circle, ChevronDown, Trophy, Flame } from "lucide-react";
import { COURSE_MODULES, type CourseStep, type CourseModule, type ChallengeStepDef } from "@/lib/course-content";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import AIChatPanel from "@/components/teaching/AIChatPanel";
import ChallengeStepComponent from "@/components/teaching/ChallengeStep";
import { InlineMiniSim } from "@/components/teaching/InlineMiniSim";
import { ALL_BADGES } from "@/hooks/use-course-progress";

// Deterministic shuffle: produces a stable permutation from a string seed
function seededShuffle<T>(arr: T[], seed: string): { items: T[]; indexMap: number[] } {
  // Simple hash from string
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  const indices = arr.map((_, i) => i);
  // Fisher-Yates with seeded pseudo-random
  for (let i = indices.length - 1; i > 0; i--) {
    h = Math.abs(((h * 1103515245 + 12345) | 0));
    const j = h % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return {
    items: indices.map(i => arr[i]),
    indexMap: indices, // indexMap[displayIdx] = originalIdx
  };
}

interface Props {
  currentModule: number;
  currentStep: number;
  onAdvanceStep: () => void;
  onGoBack: () => void;
  onCompleteModule: () => void;
  onSkipCourse: () => void;
  totalModules: number;
  completedModules: number;
  onNavigateModule: (idx: number) => void;
  modules?: CourseModule[];
  // New props for enhanced features
  xp?: number;
  badges?: string[];
  quizStreak?: number;
  onQuizAnswer?: (correct: boolean) => void;
  onStepComplete?: () => void;
  onChallengeComplete?: () => void;
  // Challenge metric values from simulation
  challengeMetrics?: Record<string, number>;
  // Current highlight controls (passed up to parent)
  onHighlightControlsChange?: (controls: string[]) => void;
}

function MiniCalculator() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");

  const evaluate = () => {
    try {
      const sanitized = expr.replace(/[^0-9+\-*/().  ]/g, "");
      const res = Function(`"use strict"; return (${sanitized})`)();
      setResult(typeof res === "number" ? res.toLocaleString() : String(res));
    } catch {
      setResult("Error");
    }
  };

  return (
    <div className="mt-2 p-2 rounded-lg bg-secondary border border-border">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Calculator className="w-3 h-3 text-muted-foreground" />
        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Calculator</span>
      </div>
      <div className="flex gap-1">
        <input
          value={expr}
          onChange={e => setExpr(e.target.value)}
          onKeyDown={e => e.key === "Enter" && evaluate()}
          className="flex-1 px-2 py-1 text-xs font-mono bg-background rounded border border-border min-w-0"
          placeholder="e.g. 1000 * 1000"
        />
        <button onClick={evaluate} className="px-2 py-1 text-xs font-mono bg-primary text-primary-foreground rounded">=</button>
      </div>
      {result && <div className="mt-1 text-xs font-mono text-success text-right">{result}</div>}
    </div>
  );
}

function ILSlider() {
  const [priceRatio, setPriceRatio] = useState(1);
  const il = (2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1) * 100;
  const lpHeight = Math.max(8, 50 * (1 + il / 100));
  const hodlHeight = 50;

  return (
    <div className="py-3 space-y-2">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">Drag price ratio</span>
        <span className="font-mono">{priceRatio.toFixed(2)}x</span>
      </div>
      <Slider min={0.1} max={5} step={0.01} value={[priceRatio]} onValueChange={([v]) => setPriceRatio(v)} />
      <div className="flex items-end justify-center gap-4 h-16">
        <div className="flex flex-col items-center gap-1">
          <motion.div
            className="w-10 rounded-t bg-chart-3/60"
            animate={{ height: `${lpHeight}px` }}
            transition={{ type: "spring", stiffness: 300 }}
          />
          <span className="text-[9px] font-mono text-muted-foreground">LP</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <motion.div
            className="w-10 rounded-t bg-chart-2/60"
            animate={{ height: `${hodlHeight}px` }}
          />
          <span className="text-[9px] font-mono text-muted-foreground">HODL</span>
        </div>
      </div>
      <div className="text-center text-[10px] font-mono text-destructive">
        IL: {il.toFixed(2)}%
      </div>
    </div>
  );
}

function LessonVisual({ visual }: { visual?: string }) {
  if (!visual) return null;

  const visuals: Record<string, React.ReactNode> = {
    "pool-intro": (
      <div className="flex items-center justify-center gap-3 py-3">
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-xl bg-chart-1/20 border border-chart-1/30 flex items-center justify-center text-lg">🪙</div>
          <span className="text-[9px] font-mono text-muted-foreground">Token X</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-[9px] font-mono text-muted-foreground px-2 py-0.5 rounded-full bg-secondary border border-border">x × y = k</div>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <ArrowRight className="w-3 h-3 text-muted-foreground rotate-180" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-xl bg-chart-2/20 border border-chart-2/30 flex items-center justify-center text-lg">💎</div>
          <span className="text-[9px] font-mono text-muted-foreground">Token Y</span>
        </div>
      </div>
    ),
    "reserves-diagram": (
      <div className="py-3 space-y-2">
        <div>
          <div className="flex justify-between text-[9px] mb-0.5">
            <span className="text-muted-foreground">Reserve X</span>
            <span className="font-mono">1,000</span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-chart-1/60" initial={{ width: 0 }} animate={{ width: "50%" }} transition={{ duration: 0.8 }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[9px] mb-0.5">
            <span className="text-muted-foreground">Reserve Y</span>
            <span className="font-mono">1,000</span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-chart-2/60" initial={{ width: 0 }} animate={{ width: "50%" }} transition={{ duration: 0.8, delay: 0.2 }} />
          </div>
        </div>
        <div className="text-center text-[9px] font-mono text-muted-foreground">k = 1,000 × 1,000 = 1,000,000</div>
      </div>
    ),
    "constant-product": (
      <div className="py-3 flex flex-col items-center gap-2">
        <div className="text-lg font-mono font-bold text-foreground">x × y = k</div>
        <div className="flex gap-3 text-[9px]">
          <div className="px-2 py-1 rounded bg-chart-1/10 border border-chart-1/20 font-mono">x = Reserve X</div>
          <div className="px-2 py-1 rounded bg-chart-2/10 border border-chart-2/20 font-mono">y = Reserve Y</div>
        </div>
        <motion.div
          className="text-[9px] text-muted-foreground font-mono"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          k never changes during trades
        </motion.div>
      </div>
    ),
    "curve-preview": (
      <div className="py-3 flex items-center justify-center">
        <svg viewBox="0 0 180 120" className="w-full max-w-[200px]" fill="none">
          <path d="M 15 105 Q 35 70 50 52 Q 65 40 85 33 Q 110 26 140 22 Q 160 19 170 17" stroke="hsl(var(--chart-1))" strokeWidth="2" fill="none" />
          <circle cx="85" cy="33" r="4" fill="hsl(var(--chart-2))" stroke="hsl(var(--background))" strokeWidth="2" />
          <line x1="60" y1="47" x2="110" y2="19" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          <text x="90" y="45" fontSize="7" fill="hsl(var(--muted-foreground))">Current</text>
          <text x="15" y="115" fontSize="6" fill="hsl(var(--muted-foreground))">Reserve X →</text>
        </svg>
      </div>
    ),
    "curve-steepness": (
      <div className="py-3 flex items-center justify-center">
        <svg viewBox="0 0 180 120" className="w-full max-w-[200px]" fill="none">
          <path d="M 15 105 Q 35 70 50 52 Q 65 40 85 33 Q 110 26 140 22 Q 160 19 170 17" stroke="hsl(var(--chart-1))" strokeWidth="2" fill="none" />
          <rect x="60" y="20" width="60" height="25" fill="hsl(var(--chart-2))" opacity="0.08" rx="3" />
          <text x="72" y="32" fontSize="6" fill="hsl(var(--chart-2))">Flat = low impact</text>
          <rect x="10" y="60" width="35" height="50" fill="hsl(var(--chart-3))" opacity="0.08" rx="3" />
          <text x="12" y="72" fontSize="6" fill="hsl(var(--chart-3))">Steep = high impact</text>
        </svg>
      </div>
    ),
    "trade-animation": (
      <div className="py-3 flex items-center justify-center">
        <svg viewBox="0 0 180 120" className="w-full max-w-[200px]" fill="none">
          <path d="M 15 105 Q 35 70 50 52 Q 65 40 85 33 Q 110 26 140 22 Q 160 19 170 17" stroke="hsl(var(--chart-1))" strokeWidth="2" fill="none" />
          <circle cx="70" cy="42" r="3" fill="hsl(var(--chart-3))" opacity="0.5" />
          <motion.circle cx="70" cy="42" r="4" fill="hsl(var(--chart-2))" stroke="hsl(var(--background))" strokeWidth="2"
            animate={{ cx: [70, 105], cy: [42, 28] }} transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }} />
          <text x="52" y="58" fontSize="6" fill="hsl(var(--chart-3))">Before</text>
          <text x="100" y="42" fontSize="6" fill="hsl(var(--chart-2))">After</text>
        </svg>
      </div>
    ),
    "slippage-why": (
      <div className="py-3 space-y-1.5">
        <div className="text-[9px] font-mono text-muted-foreground text-center mb-1">Each unit costs more:</div>
        {[1, 2, 3, 4, 5].map(i => (
          <motion.div
            key={i}
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
          >
            <span className="text-[9px] font-mono text-muted-foreground w-12">Unit {i}:</span>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-chart-3/60"
                initial={{ width: 0 }}
                animate={{ width: `${20 + i * 15}%` }}
                transition={{ delay: i * 0.15 + 0.3, duration: 0.4 }}
              />
            </div>
            <span className="text-[9px] font-mono text-chart-3">{(1 + (i - 1) * 0.02).toFixed(2)}</span>
          </motion.div>
        ))}
        <div className="text-[9px] text-muted-foreground text-center mt-1">Each orange costs more as the pool runs low</div>
      </div>
    ),
    "slippage-nonlinear": (
      <div className="py-3">
        <div className="flex items-end justify-center gap-2 h-20">
          {[
            { size: "50", slip: 2, h: 16 },
            { size: "100", slip: 5, h: 32 },
            { size: "200", slip: 12, h: 55 },
            { size: "400", slip: 30, h: 75 },
          ].map((d, i) => (
            <motion.div
              key={d.size}
              className="flex flex-col items-center gap-0.5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.2 }}
            >
              <span className="text-[8px] font-mono text-chart-3">{d.slip}%</span>
              <motion.div
                className="w-8 rounded-t bg-chart-3/50"
                initial={{ height: 0 }}
                animate={{ height: `${d.h}px` }}
                transition={{ delay: i * 0.2 + 0.1, duration: 0.4 }}
              />
              <span className="text-[8px] font-mono text-muted-foreground">{d.size}</span>
            </motion.div>
          ))}
        </div>
        <div className="text-[9px] text-muted-foreground text-center mt-1">Trade size → Slippage (nonlinear!)</div>
      </div>
    ),
    "hodl-explain": (
      <div className="py-3 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg bg-secondary border border-border p-2 text-center">
            <div className="text-[9px] text-muted-foreground mb-0.5">You have</div>
            <div className="text-xs font-mono">100 ETH + 100K USDC</div>
          </div>
        </div>
        <motion.div
          className="text-center text-lg"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          💤
        </motion.div>
        <div className="rounded-lg bg-chart-2/10 border border-chart-2/20 p-2 text-center">
          <div className="text-[9px] text-muted-foreground mb-0.5">HODL = Just hold them. Do nothing.</div>
          <div className="text-xs font-mono text-chart-2">Value changes only with market price</div>
        </div>
      </div>
    ),
    "il-animated": (
      <div className="py-3 space-y-2">
        <div className="flex gap-2">
          <motion.div
            className="flex-1 rounded-lg bg-chart-2/10 border border-chart-2/20 p-2 text-center"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="text-[9px] text-muted-foreground mb-0.5">HODL Value</div>
            <div className="text-sm font-mono font-semibold text-chart-2">$2,200</div>
          </motion.div>
          <motion.div
            className="flex-1 rounded-lg bg-chart-3/10 border border-chart-3/20 p-2 text-center"
            animate={{ scale: [1, 0.98, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="text-[9px] text-muted-foreground mb-0.5">LP Value</div>
            <div className="text-sm font-mono font-semibold text-chart-3">$2,075</div>
          </motion.div>
        </div>
        <motion.div
          className="text-center text-[10px] font-mono text-destructive"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          IL = -5.7% (price doubled)
        </motion.div>
        <div className="text-[9px] text-muted-foreground text-center">
          The pool sold the winning token as it rose. LPs missed out.
        </div>
      </div>
    ),
    "arb-diagram": (
      <div className="py-3 space-y-2">
        <div className="flex items-center justify-between gap-2 text-[9px]">
          <div className="rounded-lg bg-secondary border border-border px-2 py-1.5 text-center flex-1">
            <div className="text-muted-foreground">Pool</div>
            <div className="font-mono font-semibold">$1,900</div>
          </div>
          <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <ArrowRight className="w-3.5 h-3.5 text-warning" />
          </motion.div>
          <div className="rounded-lg bg-warning/10 border border-warning/20 px-2 py-1.5 text-center flex-1">
            <div className="text-muted-foreground">Market</div>
            <div className="font-mono font-semibold text-warning">$2,000</div>
          </div>
        </div>
        <div className="text-center text-[9px] text-muted-foreground">Arbitrageur buys cheap → price corrects ↑</div>
      </div>
    ),
    "arb-flow": (
      <div className="py-3 space-y-1.5">
        {["① Pool mispriced", "② Arb buys cheap token", "③ Pool price rises", "④ LP inventory shifts", "⑤ IL occurs"].map((step, i) => (
          <motion.div
            key={step}
            className="flex items-center gap-2 text-[9px]"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.2 }}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${i < 3 ? "bg-warning" : "bg-destructive"}`} />
            <span className="text-muted-foreground">{step}</span>
          </motion.div>
        ))}
      </div>
    ),
    "fees-diagram": (
      <div className="py-3">
        <div className="flex items-end gap-2 justify-center h-16">
          {[
            { label: "Fees", value: 55, color: "bg-chart-2" },
            { label: "IL", value: 35, color: "bg-chart-3" },
            { label: "Net", value: 20, color: "bg-chart-1" },
          ].map((bar, i) => (
            <div key={bar.label} className="flex flex-col items-center gap-0.5">
              <motion.div
                className={`w-10 rounded-t ${bar.color}/60`}
                initial={{ height: 0 }}
                animate={{ height: `${bar.value}px` }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
              />
              <span className="text-[8px] font-mono text-muted-foreground">{bar.label}</span>
            </div>
          ))}
        </div>
        <div className="text-center text-[9px] text-muted-foreground mt-1">Fees − IL = Net LP Profit</div>
      </div>
    ),
    "fees-vs-il": (
      <div className="py-3 space-y-1.5">
        <div className="flex items-center gap-2 text-[9px]">
          <div className="w-2 h-2 rounded-full bg-chart-2" />
          <span className="text-muted-foreground">High volatility →</span>
          <span className="font-mono text-chart-2">More fees</span>
          <span className="text-muted-foreground">+</span>
          <span className="font-mono text-chart-3">More IL</span>
        </div>
        <div className="flex items-center gap-2 text-[9px]">
          <div className="w-2 h-2 rounded-full bg-chart-1" />
          <span className="text-muted-foreground">Low volatility →</span>
          <span className="font-mono text-chart-2">Less fees</span>
          <span className="text-muted-foreground">+</span>
          <span className="font-mono text-chart-1">Less IL</span>
        </div>
        <div className="text-center text-[9px] font-mono text-warning mt-1">The question: do fees &gt; IL?</div>
      </div>
    ),
    // ── Intermediate visuals ──
    "concentrated-range": (
      <div className="py-3 flex items-center justify-center">
        <svg viewBox="0 0 200 100" className="w-full max-w-[220px]" fill="none">
          <path d="M 10 85 Q 30 60 50 45 Q 70 35 100 28 Q 130 22 160 18 Q 180 16 195 15" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" opacity="0.3" fill="none" />
          <rect x="65" y="12" width="70" height="78" rx="4" fill="hsl(var(--chart-1))" opacity="0.12" stroke="hsl(var(--chart-1))" strokeWidth="1" strokeDasharray="3 2" />
          <path d="M 65 42 Q 80 34 100 28 Q 120 23 135 20" stroke="hsl(var(--chart-1))" strokeWidth="2.5" fill="none" />
          <circle cx="65" cy="42" r="3" fill="hsl(var(--chart-2))" />
          <circle cx="135" cy="20" r="3" fill="hsl(var(--chart-2))" />
          <text x="55" y="55" fontSize="6" fill="hsl(var(--chart-2))">pₗ</text>
          <text x="135" y="14" fontSize="6" fill="hsl(var(--chart-2))">pᵤ</text>
          <text x="82" y="70" fontSize="7" fill="hsl(var(--chart-1))">Your range</text>
          <text x="15" y="95" fontSize="5" fill="hsl(var(--muted-foreground))">Full range (wasted capital) →</text>
        </svg>
      </div>
    ),
    "capital-efficiency-bars": (
      <div className="py-3">
        <div className="flex items-end justify-center gap-3 h-20">
          {[
            { label: "Full", eff: "1x", h: 10, color: "bg-muted-foreground/30" },
            { label: "±20%", eff: "3x", h: 30, color: "bg-chart-2/50" },
            { label: "±10%", eff: "6x", h: 55, color: "bg-chart-1/50" },
            { label: "±5%", eff: "20x", h: 80, color: "bg-warning/50" },
          ].map((d, i) => (
            <motion.div key={d.label} className="flex flex-col items-center gap-0.5"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}>
              <span className="text-[8px] font-mono text-warning">{d.eff}</span>
              <motion.div className={`w-9 rounded-t ${d.color}`}
                initial={{ height: 0 }} animate={{ height: `${d.h}px` }} transition={{ delay: i * 0.15 + 0.1, duration: 0.4 }} />
              <span className="text-[8px] font-mono text-muted-foreground">{d.label}</span>
            </motion.div>
          ))}
        </div>
        <div className="text-[9px] text-muted-foreground text-center mt-1">Range width → Capital efficiency</div>
      </div>
    ),
    "amplified-il": (
      <div className="py-3 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg bg-muted/50 border border-border p-2 text-center">
            <div className="text-[9px] text-muted-foreground mb-0.5">Full range IL</div>
            <div className="text-sm font-mono text-chart-3">−5.7%</div>
          </div>
          <div className="flex-1 rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-center">
            <div className="text-[9px] text-muted-foreground mb-0.5">±5% range IL</div>
            <div className="text-sm font-mono text-destructive font-bold">−100%</div>
          </div>
        </div>
        <motion.div className="text-center text-[9px] text-muted-foreground" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
          Concentrated = amplified gains AND losses
        </motion.div>
      </div>
    ),
    "narrow-vs-wide": (
      <div className="py-3 flex items-center justify-center">
        <svg viewBox="0 0 200 80" className="w-full max-w-[220px]" fill="none">
          <rect x="80" y="5" width="40" height="70" rx="3" fill="hsl(var(--chart-1))" opacity="0.15" stroke="hsl(var(--chart-1))" strokeWidth="1" />
          <text x="87" y="42" fontSize="6" fill="hsl(var(--chart-1))">±5%</text>
          <text x="82" y="52" fontSize="5" fill="hsl(var(--chart-1))">High eff.</text>
          <rect x="30" y="5" width="140" height="70" rx="3" fill="hsl(var(--chart-2))" opacity="0.08" stroke="hsl(var(--chart-2))" strokeWidth="1" strokeDasharray="3 2" />
          <text x="35" y="16" fontSize="5" fill="hsl(var(--chart-2))">±50% — Safer, lower eff.</text>
          <line x1="100" y1="0" x2="100" y2="80" stroke="hsl(var(--warning))" strokeWidth="1" strokeDasharray="2 2" />
          <text x="90" y="78" fontSize="5" fill="hsl(var(--warning))">Current</text>
        </svg>
      </div>
    ),
    "fee-tier-spectrum": (
      <div className="py-3">
        <div className="flex items-end justify-center gap-2 h-16">
          {[
            { tier: "0.01%", vol: "Stables", h: 60, color: "bg-chart-1/50" },
            { tier: "0.05%", vol: "Majors", h: 50, color: "bg-chart-2/50" },
            { tier: "0.30%", vol: "General", h: 35, color: "bg-warning/50" },
            { tier: "1.00%", vol: "Exotic", h: 15, color: "bg-chart-3/50" },
          ].map((d, i) => (
            <motion.div key={d.tier} className="flex flex-col items-center gap-0.5"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}>
              <motion.div className={`w-10 rounded-t ${d.color}`}
                initial={{ height: 0 }} animate={{ height: `${d.h}px` }} transition={{ delay: i * 0.12, duration: 0.4 }} />
              <span className="text-[7px] font-mono text-foreground">{d.tier}</span>
              <span className="text-[6px] text-muted-foreground">{d.vol}</span>
            </motion.div>
          ))}
        </div>
        <div className="text-[9px] text-muted-foreground text-center mt-1">Volume distribution by fee tier</div>
      </div>
    ),
    "lbp-weight-shift": (
      <div className="py-3 space-y-2">
        <div className="flex items-center gap-2 text-[9px]">
          <div className="flex-1">
            <div className="text-muted-foreground mb-0.5">Start: 95/5</div>
            <div className="h-2.5 rounded-full bg-secondary overflow-hidden flex">
              <motion.div className="h-full bg-chart-1/60 rounded-l-full" initial={{ width: 0 }} animate={{ width: "95%" }} transition={{ duration: 0.8 }} />
              <div className="h-full bg-chart-2/60 flex-1 rounded-r-full" />
            </div>
          </div>
        </div>
        <motion.div className="text-center text-lg" animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>⏳</motion.div>
        <div className="flex items-center gap-2 text-[9px]">
          <div className="flex-1">
            <div className="text-muted-foreground mb-0.5">End: 50/50</div>
            <div className="h-2.5 rounded-full bg-secondary overflow-hidden flex">
              <motion.div className="h-full bg-chart-1/60 rounded-l-full" initial={{ width: "95%" }} animate={{ width: "50%" }} transition={{ duration: 1.5, delay: 0.5 }} />
              <div className="h-full bg-chart-2/60 flex-1 rounded-r-full" />
            </div>
          </div>
        </div>
        <div className="text-[9px] text-muted-foreground text-center">Weight shift creates natural selling pressure</div>
      </div>
    ),
    "weighted-curve": (
      <div className="py-3 flex flex-col items-center gap-2">
        <div className="text-sm font-mono font-bold text-foreground">x<sup>w₁</sup> × y<sup>w₂</sup> = k</div>
        <div className="flex gap-2 text-[9px]">
          <div className="px-2 py-1 rounded bg-chart-1/10 border border-chart-1/20 font-mono">w₁ = 0.80</div>
          <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>→</motion.div>
          <div className="px-2 py-1 rounded bg-chart-2/10 border border-chart-2/20 font-mono">w₁ = 0.50</div>
        </div>
        <div className="text-[9px] text-muted-foreground">Shifting weight changes the curve shape</div>
      </div>
    ),
    "oracle-spot-vs-twap": (
      <div className="py-3 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-center">
            <div className="text-[9px] text-muted-foreground mb-0.5">Spot (1 block)</div>
            <motion.div className="text-sm font-mono text-destructive" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}>
              $9,999
            </motion.div>
            <div className="text-[8px] text-destructive/60">⚠️ Manipulable</div>
          </div>
          <div className="flex-1 rounded-lg bg-success/10 border border-success/20 p-2 text-center">
            <div className="text-[9px] text-muted-foreground mb-0.5">TWAP (30 min)</div>
            <div className="text-sm font-mono text-success">$2,001</div>
            <div className="text-[8px] text-success/60">✓ Robust</div>
          </div>
        </div>
      </div>
    ),
    "twap-accumulator": (
      <div className="py-3 space-y-1.5">
        <div className="text-[9px] font-mono text-muted-foreground text-center mb-1">Price accumulator over blocks:</div>
        {[
          { block: "101", price: "$2,000", acc: "2,000" },
          { block: "102", price: "$2,010", acc: "4,010" },
          { block: "103", price: "$2,005", acc: "6,015" },
          { block: "104", price: "$9,999", acc: "16,014" },
          { block: "105", price: "$2,002", acc: "18,016" },
        ].map((d, i) => (
          <motion.div key={d.block} className={`flex items-center gap-2 text-[9px] ${i === 3 ? "text-destructive" : "text-muted-foreground"}`}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.12 }}>
            <span className="font-mono w-8">#{d.block}</span>
            <span className="font-mono w-14">{d.price}</span>
            <span className="font-mono text-foreground">Σ={d.acc}</span>
          </motion.div>
        ))}
        <div className="text-[9px] text-muted-foreground text-center mt-1">TWAP = Σ/n = $3,603 — manipulation diluted</div>
      </div>
    ),
    "multi-hop-arb": (
      <div className="py-3 flex items-center justify-center">
        <svg viewBox="0 0 180 100" className="w-full max-w-[200px]" fill="none">
          <circle cx="90" cy="20" r="16" fill="hsl(var(--chart-1))" opacity="0.15" stroke="hsl(var(--chart-1))" strokeWidth="1" />
          <text x="80" y="23" fontSize="7" fill="hsl(var(--chart-1))">ETH</text>
          <circle cx="40" cy="75" r="16" fill="hsl(var(--chart-2))" opacity="0.15" stroke="hsl(var(--chart-2))" strokeWidth="1" />
          <text x="28" y="78" fontSize="7" fill="hsl(var(--chart-2))">USDC</text>
          <circle cx="140" cy="75" r="16" fill="hsl(var(--chart-3))" opacity="0.15" stroke="hsl(var(--chart-3))" strokeWidth="1" />
          <text x="132" y="78" fontSize="7" fill="hsl(var(--chart-3))">DAI</text>
          <line x1="78" y1="32" x2="52" y2="63" stroke="hsl(var(--warning))" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
          <line x1="56" y1="75" x2="124" y2="75" stroke="hsl(var(--warning))" strokeWidth="1.5" />
          <line x1="148" y1="60" x2="100" y2="32" stroke="hsl(var(--warning))" strokeWidth="1.5" />
          <text x="55" y="95" fontSize="6" fill="hsl(var(--warning))">Profitable cycle = arb ✓</text>
        </svg>
      </div>
    ),
    "sandwich-attack": (
      <div className="py-3 space-y-1.5">
        {[
          { step: "① Frontrun", desc: "Bot buys 50 ETH", color: "text-destructive" },
          { step: "② Your trade", desc: "You buy 10 ETH (worse price!)", color: "text-warning" },
          { step: "③ Backrun", desc: "Bot sells 50 ETH for profit", color: "text-destructive" },
        ].map((d, i) => (
          <motion.div key={d.step} className="flex items-center gap-2 text-[9px]"
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.2 }}>
            <span className={`font-mono ${d.color}`}>{d.step}</span>
            <span className="text-muted-foreground">{d.desc}</span>
          </motion.div>
        ))}
        <div className="text-[9px] text-muted-foreground text-center mt-1">You pay more; bot profits from the difference</div>
      </div>
    ),
    // ── Advanced course visuals ──
    "invariant-landscape": (
      <div className="py-3 flex items-center justify-center">
        <svg viewBox="0 0 200 110" className="w-full max-w-[220px]" fill="none">
          {/* Constant product */}
          <path d="M 15 95 Q 35 60 55 42 Q 75 30 100 24 Q 130 19 170 15" stroke="hsl(var(--chart-1))" strokeWidth="2" fill="none" />
          <text x="155" y="12" fontSize="6" fill="hsl(var(--chart-1))">x·y=k</text>
          {/* Constant sum */}
          <line x1="15" y1="15" x2="185" y2="95" stroke="hsl(var(--chart-2))" strokeWidth="1.5" strokeDasharray="4 2" />
          <text x="155" y="90" fontSize="6" fill="hsl(var(--chart-2))">x+y=k</text>
          {/* StableSwap blend */}
          <path d="M 15 80 Q 40 60 65 38 Q 80 30 100 26 Q 120 24 140 24 Q 160 26 185 40" stroke="hsl(var(--warning))" strokeWidth="2.5" fill="none" />
          <text x="100" y="40" fontSize="6" fill="hsl(var(--warning))">StableSwap</text>
          <text x="55" y="105" fontSize="5" fill="hsl(var(--muted-foreground))">The invariant design space</text>
        </svg>
      </div>
    ),
    "stableswap-blend": (
      <div className="py-3 space-y-2">
        <div className="flex items-center justify-center">
          <svg viewBox="0 0 200 90" className="w-full max-w-[220px]" fill="none">
            {/* Low A (like Uniswap) */}
            <path d="M 10 80 Q 30 50 50 38 Q 70 28 100 22 Q 140 16 190 12" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.4" fill="none" />
            <text x="150" y="10" fontSize="5" fill="hsl(var(--muted-foreground))">A=1</text>
            {/* Medium A */}
            <path d="M 10 75 Q 30 55 60 35 Q 80 28 100 25 Q 120 23 140 23 Q 170 25 190 32" stroke="hsl(var(--chart-2))" strokeWidth="1.5" fill="none" />
            <text x="155" y="30" fontSize="5" fill="hsl(var(--chart-2))">A=10</text>
            {/* High A (nearly flat) */}
            <path d="M 10 60 Q 30 42 60 30 Q 80 26 100 25 Q 120 25 140 26 Q 170 30 190 42" stroke="hsl(var(--warning))" strokeWidth="2.5" fill="none" />
            <text x="155" y="46" fontSize="5" fill="hsl(var(--warning))">A=100</text>
            {/* Flat zone highlight */}
            <rect x="70" y="20" width="60" height="12" rx="3" fill="hsl(var(--warning))" opacity="0.08" />
            <text x="76" y="28" fontSize="5" fill="hsl(var(--warning))">Near-zero slip</text>
          </svg>
        </div>
        <div className="text-[9px] text-muted-foreground text-center">Higher A → flatter curve near peg → less slippage</div>
      </div>
    ),
    "invariant-design-space": (
      <div className="py-3 space-y-2">
        <div className="text-sm font-mono font-bold text-foreground text-center">
          f(x,y) = α·(x+y) + (1−α)·(x·y)
        </div>
        <div className="flex items-center justify-center gap-2">
          {[
            { α: "0.0", label: "Uniswap", color: "bg-chart-1/30" },
            { α: "0.5", label: "Hybrid", color: "bg-warning/30" },
            { α: "1.0", label: "Const-sum", color: "bg-chart-2/30" },
          ].map((d, i) => (
            <motion.div key={d.α} className={`px-2 py-1.5 rounded ${d.color} text-center`}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.15 }}>
              <div className="text-[8px] font-mono text-foreground">α={d.α}</div>
              <div className="text-[7px] text-muted-foreground">{d.label}</div>
            </motion.div>
          ))}
        </div>
        <div className="text-[9px] text-muted-foreground text-center">Parameterize between known curves</div>
      </div>
    ),
    "mev-sandwich-diagram": (
      <div className="py-3 space-y-1">
        <div className="flex items-center justify-center">
          <svg viewBox="0 0 200 100" className="w-full max-w-[220px]" fill="none">
            {/* Price axis */}
            <line x1="20" y1="85" x2="180" y2="85" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" opacity="0.3" />
            <line x1="20" y1="85" x2="20" y2="10" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" opacity="0.3" />
            <text x="5" y="50" fontSize="5" fill="hsl(var(--muted-foreground))" transform="rotate(-90, 5, 50)">Price</text>
            {/* Frontrun: price up */}
            <motion.rect x="40" y="40" width="30" height="45" rx="3" fill="hsl(var(--destructive))" opacity="0.2"
              initial={{ height: 0, y: 85 }} animate={{ height: 45, y: 40 }} transition={{ duration: 0.6 }} />
            <text x="42" y="36" fontSize="6" fill="hsl(var(--destructive))">① Front</text>
            {/* Your trade: price up more */}
            <motion.rect x="85" y="28" width="30" height="57" rx="3" fill="hsl(var(--warning))" opacity="0.2"
              initial={{ height: 0, y: 85 }} animate={{ height: 57, y: 28 }} transition={{ duration: 0.6, delay: 0.3 }} />
            <text x="87" y="24" fontSize="6" fill="hsl(var(--warning))">② You</text>
            {/* Backrun: bot sells */}
            <motion.rect x="130" y="50" width="30" height="35" rx="3" fill="hsl(var(--destructive))" opacity="0.2"
              initial={{ height: 0, y: 85 }} animate={{ height: 35, y: 50 }} transition={{ duration: 0.6, delay: 0.6 }} />
            <text x="132" y="46" fontSize="6" fill="hsl(var(--destructive))">③ Back</text>
            {/* Profit bracket */}
            <motion.line x1="170" y1="40" x2="170" y2="50" stroke="hsl(var(--chart-2))" strokeWidth="2"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} />
            <motion.text x="174" y="47" fontSize="6" fill="hsl(var(--chart-2))"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>Profit</motion.text>
          </svg>
        </div>
        <div className="text-[9px] text-muted-foreground text-center">Bot profits from the price impact your trade creates</div>
      </div>
    ),
    "jit-liquidity-timeline": (
      <div className="py-3 space-y-1.5">
        {[
          { step: "① Large swap detected in mempool", icon: "👁️", color: "text-muted-foreground" },
          { step: "② JIT bot adds tight liquidity", icon: "💧", color: "text-chart-1" },
          { step: "③ Swap executes (better price!)", icon: "🔄", color: "text-warning" },
          { step: "④ Bot removes liquidity + fees", icon: "💰", color: "text-chart-2" },
          { step: "⑤ Passive LPs earned nothing", icon: "😔", color: "text-destructive" },
        ].map((d, i) => (
          <motion.div key={i} className="flex items-center gap-2 text-[9px]"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }}>
            <span>{d.icon}</span>
            <span className={d.color}>{d.step}</span>
          </motion.div>
        ))}
      </div>
    ),
    "mev-defense-layers": (
      <div className="py-3 space-y-1.5">
        {[
          { layer: "Network", defenses: "Encrypted mempool, PBS", color: "bg-chart-1/20 border-chart-1/30" },
          { layer: "Protocol", defenses: "Batch auctions, CoW", color: "bg-chart-2/20 border-chart-2/30" },
          { layer: "Contract", defenses: "Dynamic fees, TWAP", color: "bg-warning/20 border-warning/30" },
          { layer: "User", defenses: "Slippage limits, private RPC", color: "bg-chart-3/20 border-chart-3/30" },
        ].map((d, i) => (
          <motion.div key={d.layer} className={`flex items-center gap-2 text-[9px] px-2 py-1.5 rounded-lg border ${d.color}`}
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}>
            <span className="font-mono font-semibold w-14 text-foreground">{d.layer}</span>
            <span className="text-muted-foreground">{d.defenses}</span>
          </motion.div>
        ))}
      </div>
    ),
    "chain-fragmentation": (
      <div className="py-3 flex items-center justify-center">
        <svg viewBox="0 0 200 100" className="w-full max-w-[220px]" fill="none">
          {[
            { cx: 40, cy: 30, label: "Eth", size: 18 },
            { cx: 100, cy: 20, label: "Arb", size: 14 },
            { cx: 155, cy: 35, label: "Base", size: 12 },
            { cx: 60, cy: 70, label: "OP", size: 11 },
            { cx: 130, cy: 75, label: "Sol", size: 15 },
          ].map((chain, i) => (
            <g key={chain.label}>
              <motion.circle cx={chain.cx} cy={chain.cy} r={chain.size} fill="hsl(var(--chart-1))" opacity={0.1 + i * 0.03}
                stroke="hsl(var(--chart-1))" strokeWidth="1" strokeDasharray="3 2"
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1 }} />
              <text x={chain.cx - 7} y={chain.cy + 3} fontSize="7" fill="hsl(var(--chart-1))">{chain.label}</text>
            </g>
          ))}
          <text x="40" y="95" fontSize="6" fill="hsl(var(--muted-foreground))">Isolated liquidity islands</text>
        </svg>
      </div>
    ),
    "intent-vs-bridge": (
      <div className="py-3 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-center">
            <div className="text-[9px] text-muted-foreground mb-0.5">Bridge-Based</div>
            <div className="text-[8px] font-mono text-destructive">Lock → Mint → Swap → Bridge</div>
            <div className="text-[7px] text-muted-foreground mt-0.5">⏱ 10-30 min, 🔗 Trust bridge</div>
          </div>
          <div className="flex-1 rounded-lg bg-chart-2/10 border border-chart-2/20 p-2 text-center">
            <div className="text-[9px] text-muted-foreground mb-0.5">Intent-Based</div>
            <div className="text-[8px] font-mono text-chart-2">"I want X for Y" → Solver fills</div>
            <div className="text-[7px] text-muted-foreground mt-0.5">⚡ Seconds, 🏆 Best price</div>
          </div>
        </div>
      </div>
    ),
    "virtual-pool-mesh": (
      <div className="py-3 flex items-center justify-center">
        <svg viewBox="0 0 200 100" className="w-full max-w-[220px]" fill="none">
          {/* Connected nodes */}
          {[
            { cx: 40, cy: 30 }, { cx: 100, cy: 20 }, { cx: 160, cy: 30 },
            { cx: 60, cy: 70 }, { cx: 140, cy: 70 },
          ].map((n, i, arr) => (
            <g key={i}>
              <circle cx={n.cx} cy={n.cy} r="12" fill="hsl(var(--chart-2))" opacity="0.15" stroke="hsl(var(--chart-2))" strokeWidth="1" />
              {arr.slice(i + 1).map((m, j) => (
                <motion.line key={j} x1={n.cx} y1={n.cy} x2={m.cx} y2={m.cy}
                  stroke="hsl(var(--chart-2))" strokeWidth="0.5" opacity="0.3"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: i * 0.1, duration: 0.5 }} />
              ))}
            </g>
          ))}
          <text x="50" y="95" fontSize="6" fill="hsl(var(--chart-2))">Virtual unified liquidity mesh</text>
        </svg>
      </div>
    ),
    "static-vs-dynamic-fees": (
      <div className="py-3 space-y-2">
        <div className="flex items-end justify-center gap-3 h-16">
          {[
            { label: "Calm", staticFee: 30, dynFee: 15, vol: "Low σ" },
            { label: "Normal", staticFee: 30, dynFee: 30, vol: "Med σ" },
            { label: "Volatile", staticFee: 30, dynFee: 55, vol: "High σ" },
          ].map((d, i) => (
            <div key={d.label} className="flex flex-col items-center gap-0.5">
              <div className="flex items-end gap-0.5">
                <motion.div className="w-4 rounded-t bg-muted-foreground/30"
                  initial={{ height: 0 }} animate={{ height: `${d.staticFee}px` }} transition={{ delay: i * 0.15, duration: 0.4 }} />
                <motion.div className="w-4 rounded-t bg-warning/60"
                  initial={{ height: 0 }} animate={{ height: `${d.dynFee}px` }} transition={{ delay: i * 0.15, duration: 0.4 }} />
              </div>
              <span className="text-[7px] font-mono text-muted-foreground">{d.vol}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-3 text-[8px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-muted-foreground/30" /> Static</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-warning/60" /> Dynamic</span>
        </div>
      </div>
    ),
    "volatility-fee-curve": (
      <div className="py-3 flex items-center justify-center">
        <svg viewBox="0 0 200 90" className="w-full max-w-[220px]" fill="none">
          <line x1="20" y1="75" x2="180" y2="75" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" opacity="0.3" />
          <line x1="20" y1="75" x2="20" y2="10" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" opacity="0.3" />
          <text x="80" y="88" fontSize="5" fill="hsl(var(--muted-foreground))">Volatility (σ)</text>
          <text x="5" y="45" fontSize="5" fill="hsl(var(--muted-foreground))" transform="rotate(-90, 5, 45)">Fee</text>
          {/* f = f_base + k*sigma */}
          <motion.path d="M 20 60 Q 60 55 100 42 Q 140 28 180 15"
            stroke="hsl(var(--warning))" strokeWidth="2" fill="none"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
          {/* Base fee line */}
          <line x1="20" y1="60" x2="180" y2="60" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="3 2" opacity="0.4" />
          <text x="140" y="67" fontSize="5" fill="hsl(var(--muted-foreground))">f_base</text>
          <text x="50" y="20" fontSize="6" fill="hsl(var(--warning))">f = f_base + k·σ</text>
        </svg>
      </div>
    ),
    "directional-fee-diagram": (
      <div className="py-3 space-y-2">
        <div className="flex gap-2">
          <motion.div className="flex-1 rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-center"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <div className="text-[9px] text-muted-foreground mb-0.5">Toward oracle →</div>
            <div className="text-sm font-mono text-destructive font-bold">0.8%</div>
            <div className="text-[7px] text-muted-foreground">Likely arbitrage</div>
          </motion.div>
          <motion.div className="flex-1 rounded-lg bg-chart-2/10 border border-chart-2/20 p-2 text-center"
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <div className="text-[9px] text-muted-foreground mb-0.5">Away from oracle →</div>
            <div className="text-sm font-mono text-chart-2 font-bold">0.1%</div>
            <div className="text-[7px] text-muted-foreground">Likely retail</div>
          </motion.div>
        </div>
        <div className="text-[9px] text-muted-foreground text-center">Charge informed flow more, uninformed less</div>
      </div>
    ),
    "checkpoint-summary": (
      <div className="py-3 space-y-1.5">
        {[
          { mod: "1", topic: "Custom Invariants", key: "Convexity + parameterization", emoji: "🔬" },
          { mod: "2", topic: "MEV Protection", key: "Layered defense strategies", emoji: "🛡️" },
          { mod: "3", topic: "Cross-Chain", key: "Intents > bridges", emoji: "🌐" },
          { mod: "4", topic: "Dynamic Fees", key: "Adapt to volatility", emoji: "⚡" },
        ].map((d, i) => (
          <motion.div key={d.mod} className="flex items-center gap-2 text-[9px] px-2 py-1 rounded bg-secondary border border-border"
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <span>{d.emoji}</span>
            <span className="font-mono text-foreground">M{d.mod}</span>
            <span className="text-muted-foreground flex-1">{d.key}</span>
          </motion.div>
        ))}
      </div>
    ),
    "mercenary-capital-cycle": (
      <div className="py-3 flex items-center justify-center">
        <svg viewBox="0 0 200 110" className="w-full max-w-[220px]" fill="none">
          {/* Circular arrows */}
          <motion.path d="M 100 15 Q 160 15 165 55 Q 165 90 100 95 Q 35 95 35 55 Q 35 15 100 15"
            stroke="hsl(var(--destructive))" strokeWidth="1.5" fill="none" strokeDasharray="4 2"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, repeat: Infinity }} />
          {/* Stages */}
          {[
            { x: 100, y: 10, label: "High APY" },
            { x: 168, y: 55, label: "LP inflow" },
            { x: 100, y: 100, label: "APY drops" },
            { x: 28, y: 55, label: "LP exodus" },
          ].map((d, i) => (
            <g key={d.label}>
              <circle cx={d.x} cy={d.y} r="3" fill="hsl(var(--destructive))" />
              <text x={d.x - 12} y={d.y + (i === 0 ? -5 : i === 2 ? 12 : 0)} fontSize="6" fill="hsl(var(--destructive))">{d.label}</text>
            </g>
          ))}
          <text x="60" y="60" fontSize="6" fill="hsl(var(--muted-foreground))">Death spiral</text>
        </svg>
      </div>
    ),
    "bonding-mechanism": (
      <div className="py-3 space-y-1.5">
        {[
          { step: "① User has LP tokens", icon: "🎟️", desc: "Worth $1,000 at market" },
          { step: "② Protocol offers bond", icon: "📜", desc: "$1,050 in OHM (5% discount)" },
          { step: "③ User bonds LP tokens", icon: "🤝", desc: "Gives LP, gets vesting OHM" },
          { step: "④ Protocol owns liquidity", icon: "🏛️", desc: "Permanent, no emissions needed" },
        ].map((d, i) => (
          <motion.div key={i} className="flex items-center gap-2 text-[9px]"
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }}>
            <span>{d.icon}</span>
            <span className="font-mono text-foreground">{d.step}</span>
          </motion.div>
        ))}
      </div>
    ),
    "pol-strategies-comparison": (
      <div className="py-3">
        <div className="flex items-end justify-center gap-2 h-16">
          {[
            { label: "Emissions", sustain: 15, color: "bg-destructive/40" },
            { label: "Bonding", sustain: 55, color: "bg-chart-2/50" },
            { label: "80/20 Pool", sustain: 65, color: "bg-chart-1/50" },
            { label: "Active POL", sustain: 75, color: "bg-warning/50" },
          ].map((d, i) => (
            <motion.div key={d.label} className="flex flex-col items-center gap-0.5"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}>
              <motion.div className={`w-9 rounded-t ${d.color}`}
                initial={{ height: 0 }} animate={{ height: `${d.sustain}px` }} transition={{ delay: i * 0.12, duration: 0.4 }} />
              <span className="text-[6px] font-mono text-muted-foreground">{d.label}</span>
            </motion.div>
          ))}
        </div>
        <div className="text-[9px] text-muted-foreground text-center mt-1">Sustainability of liquidity strategies</div>
      </div>
    ),
    "testing-vs-formal": (
      <div className="py-3 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg bg-warning/10 border border-warning/20 p-2 text-center">
            <div className="text-[9px] text-muted-foreground mb-0.5">Testing</div>
            <div className="flex items-center justify-center gap-0.5">
              {[1,2,3,4,5].map(i => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-chart-2/60"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }} />
              ))}
              <span className="text-[8px] text-warning ml-1">…?</span>
            </div>
            <div className="text-[7px] text-muted-foreground mt-0.5">Checks samples</div>
          </div>
          <div className="flex-1 rounded-lg bg-chart-2/10 border border-chart-2/20 p-2 text-center">
            <div className="text-[9px] text-muted-foreground mb-0.5">Formal</div>
            <motion.div className="text-sm font-mono text-chart-2"
              animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>∀x ✓</motion.div>
            <div className="text-[7px] text-muted-foreground mt-0.5">Proves all inputs</div>
          </div>
        </div>
      </div>
    ),
    "verification-properties": (
      <div className="py-3 space-y-1">
        {[
          { prop: "No-drain", desc: "Can't extract more than deposited", icon: "🛡️" },
          { prop: "Monotonicity", desc: "More in → more out", icon: "📈" },
          { prop: "Conservation", desc: "Invariant always holds", icon: "⚖️" },
          { prop: "Rounding safety", desc: "Rounding favors pool", icon: "🔢" },
          { prop: "No stuck states", desc: "Pool always accepts trades", icon: "🔄" },
        ].map((d, i) => (
          <motion.div key={d.prop} className="flex items-center gap-2 text-[9px] px-1.5 py-1 rounded bg-secondary/50"
            initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
            <span className="text-[10px]">{d.icon}</span>
            <span className="font-mono text-foreground w-20">{d.prop}</span>
            <span className="text-muted-foreground">{d.desc}</span>
          </motion.div>
        ))}
      </div>
    ),
    "verification-toolchain": (
      <div className="py-3 space-y-1.5">
        {[
          { tool: "Certora", type: "SMT-based prover", strength: "Production standard", color: "bg-chart-1/20 border-chart-1/30" },
          { tool: "Halmos", type: "Symbolic execution", strength: "Quick setup", color: "bg-chart-2/20 border-chart-2/30" },
          { tool: "Lean/Coq", type: "Theorem prover", strength: "Deepest guarantees", color: "bg-warning/20 border-warning/30" },
        ].map((d, i) => (
          <motion.div key={d.tool} className={`flex items-center gap-2 text-[9px] px-2 py-1.5 rounded-lg border ${d.color}`}
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}>
            <span className="font-mono font-semibold text-foreground w-14">{d.tool}</span>
            <span className="text-muted-foreground flex-1">{d.strength}</span>
          </motion.div>
        ))}
      </div>
    ),
    "graduation-advanced": (
      <div className="py-4 flex flex-col items-center gap-2">
        <motion.div className="text-3xl"
          animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}>
          🎓
        </motion.div>
        <div className="text-sm font-bold text-foreground">Advanced Complete</div>
        <div className="flex flex-wrap justify-center gap-1">
          {["🔬", "🛡️", "🌐", "⚡", "🏛️", "📐"].map((e, i) => (
            <motion.span key={i} className="text-lg"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              {e}
            </motion.span>
          ))}
        </div>
        <div className="text-[9px] text-muted-foreground text-center">6 modules mastered — go build something</div>
      </div>
    ),
  };

  return visuals[visual] || null;
}

// Shuffled quiz component — shuffles options deterministically by question text
function ShuffledQuiz({
  question, options, correctIndex, explanation, wrongExplanation,
  selectedAnswer, answered, onAnswer, isFollowUp,
}: {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  wrongExplanation: string;
  selectedAnswer: number | null;
  answered: boolean;
  onAnswer: (idx: number) => void;
  isFollowUp?: boolean;
}) {
  const { items: shuffledOptions, indexMap } = useMemo(
    () => seededShuffle(options, question),
    [options, question]
  );
  const gotCorrect = selectedAnswer !== null && indexMap[selectedAnswer] === correctIndex;
  const py = isFollowUp ? "py-1.5" : "py-2";

  return (
    <>
      <div className="space-y-1">
        {shuffledOptions.map((opt, displayIdx) => {
          const origIdx = indexMap[displayIdx];
          const isCorrect = origIdx === correctIndex;
          const isSelected = selectedAnswer === displayIdx;
          let optClass = "bg-background border-border text-foreground hover:bg-secondary cursor-pointer";
          if (answered) {
            if (isCorrect) optClass = "bg-success/10 border-success/30 text-success";
            else if (isSelected && !isCorrect) optClass = "bg-destructive/10 border-destructive/30 text-destructive";
            else optClass = "bg-background border-border text-muted-foreground opacity-50";
          }
          return (
            <button
              key={displayIdx}
              onClick={() => onAnswer(displayIdx)}
              disabled={answered}
              className={`w-full text-left text-[10px] px-2.5 ${py} rounded-lg border transition-all ${optClass}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-2 rounded-lg text-[10px] leading-relaxed ${
            gotCorrect
              ? "bg-success/10 border border-success/20 text-foreground"
              : "bg-destructive/10 border border-destructive/20 text-foreground"
          }`}
        >
          {gotCorrect ? explanation : wrongExplanation}
        </motion.div>
      )}
    </>
  );
}

export default function CourseSidebar({ currentModule, currentStep, onAdvanceStep, onGoBack, onCompleteModule, onSkipCourse, totalModules, completedModules, onNavigateModule, modules, xp = 0, badges = [], quizStreak = 0, onQuizAnswer, onStepComplete, onChallengeComplete, challengeMetrics = {}, onHighlightControlsChange }: Props) {
  const courseModules = modules || COURSE_MODULES;
  const [showAI, setShowAI] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [followUpActive, setFollowUpActive] = useState(false);
  const [followUpAnswer, setFollowUpAnswer] = useState<number | null>(null);
  const [followUpAnswered, setFollowUpAnswered] = useState(false);

  const mod = courseModules[currentModule];
  if (!mod) return null;
  const step = mod.steps[currentStep];
  if (!step) return null;

  const isLastStep = currentStep === mod.steps.length - 1;
  const isLastModule = currentModule === totalModules - 1;
  const overallProgress = ((currentModule + (currentStep + 1) / mod.steps.length) / totalModules) * 100;
  const canGoBack = currentStep > 0 || currentModule > 0;

  const handleNext = () => {
    setSelectedAnswer(null);
    setAnswered(false);
    setFollowUpActive(false);
    setFollowUpAnswer(null);
    setFollowUpAnswered(false);
    if (isLastStep) {
      onCompleteModule();
    } else {
      onAdvanceStep();
    }
  };

  const handleBack = () => {
    setSelectedAnswer(null);
    setAnswered(false);
    setFollowUpActive(false);
    setFollowUpAnswer(null);
    setFollowUpAnswered(false);
    onGoBack();
  };

  const handleQuizAnswer = (idx: number) => {
    if (answered) return;
    setSelectedAnswer(idx);
    setAnswered(true);
  };

  const handleFollowUpAnswer = (idx: number) => {
    if (followUpAnswered) return;
    setFollowUpAnswer(idx);
    setFollowUpAnswered(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Progress header with module nav */}
      <div className="p-3 border-b border-border space-y-1.5">
        <div className="flex items-center justify-between">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors">
                <span className="uppercase tracking-wider">Module {currentModule + 1}/{totalModules}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-56 p-1.5">
              <div className="flex flex-col gap-0.5">
                {courseModules.map((m, i) => {
                  const isComplete = i < completedModules;
                  const isCurrent = i === currentModule;
                  const canClick = isComplete || isCurrent;
                  return (
                    <button
                      key={m.id}
                      onClick={() => canClick && onNavigateModule(i)}
                      disabled={!canClick}
                      className={`flex items-center gap-1.5 text-left text-[10px] px-2 py-1.5 rounded-md transition-all ${
                        isCurrent ? "bg-primary text-primary-foreground font-medium"
                        : isComplete ? "text-success hover:bg-secondary"
                        : "text-muted-foreground/40 cursor-not-allowed"
                      }`}
                    >
                      {isComplete ? <Check className="w-3 h-3 shrink-0" /> : isCurrent ? <Circle className="w-3 h-3 shrink-0 fill-current" /> : <Lock className="w-2.5 h-2.5 shrink-0" />}
                      <span>{m.emoji} {m.title}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAI(!showAI)}
              className={`text-[9px] font-mono transition-colors flex items-center gap-1 ${showAI ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              🤖 AI
            </button>
            <button onClick={onSkipCourse} className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <SkipForward className="w-3 h-3" /> Skip
            </button>
          </div>
        </div>
        <Progress value={overallProgress} className="h-1" />
      </div>

      {showAI ? (
        <div className="flex-1 min-h-0">
          <AIChatPanel context={`the Teaching Lab course, Module ${currentModule + 1}: "${mod.title}" — ${mod.subtitle}. Step ${currentStep + 1}: "${step.type === "lesson" ? step.title : "Knowledge Check"}`} />
        </div>
      ) : (
        <>
          {/* Module title */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm">{mod.emoji}</span>
              <h2 className="text-xs font-bold text-foreground">{mod.title}</h2>
            </div>
            <p className="text-[10px] text-muted-foreground">{mod.subtitle}</p>
          </div>

          {/* Step content — scrollable */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentModule}-${currentStep}`}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <BookOpen className="w-3 h-3 text-muted-foreground" />
                    <h3 className="text-[11px] font-semibold text-foreground">{step.type === "lesson" ? step.title : "Knowledge Check"}</h3>
                    <span className="text-[9px] font-mono text-muted-foreground ml-auto">{currentStep + 1}/{mod.steps.length}</span>
                  </div>

                  {step.type === "lesson" ? (
                    <div className="space-y-2">
                      {step.content.map((para, i) => (
                        <motion.p
                          key={i}
                          className="text-[11px] text-foreground/80 leading-relaxed"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                        >
                          {para}
                        </motion.p>
                      ))}
                      <LessonVisual visual={step.visual} />
                      {step.interactive === "il-slider" && <ILSlider />}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-lg bg-secondary border border-border">
                        <p className="text-[11px] font-medium text-foreground">{step.question}</p>
                      </div>
                      <ShuffledQuiz
                        question={step.question}
                        options={step.options}
                        correctIndex={step.correctIndex}
                        explanation={step.explanation}
                        wrongExplanation={step.wrongExplanation}
                        selectedAnswer={selectedAnswer}
                        answered={answered}
                        onAnswer={handleQuizAnswer}
                      />
                      {answered && step.followUpQuiz && !followUpActive && (
                        <button
                          onClick={() => setFollowUpActive(true)}
                          className="text-[9px] text-primary hover:underline font-medium"
                        >
                          Follow-up question →
                        </button>
                      )}
                      {followUpActive && step.followUpQuiz && (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 mt-2 pt-2 border-t border-border">
                          <div className="p-2 rounded-lg bg-secondary border border-border">
                            <p className="text-[10px] font-medium text-foreground">{step.followUpQuiz.question}</p>
                          </div>
                          <ShuffledQuiz
                            question={step.followUpQuiz.question}
                            options={step.followUpQuiz.options}
                            correctIndex={step.followUpQuiz.correctIndex}
                            explanation={step.followUpQuiz.explanation}
                            wrongExplanation={step.followUpQuiz.wrongExplanation}
                            selectedAnswer={followUpAnswer}
                            answered={followUpAnswered}
                            onAnswer={handleFollowUpAnswer}
                            isFollowUp
                          />
                        </motion.div>
                      )}
                      {step.calculatorNeeded && <MiniCalculator />}
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer nav */}
          <div className="px-3 py-2 border-t border-border flex items-center justify-between gap-2">
            <button
              onClick={handleBack}
              disabled={!canGoBack}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                canGoBack ? "text-foreground hover:bg-secondary" : "text-muted-foreground/30 cursor-not-allowed"
              }`}
            >
              <ChevronLeft className="w-3 h-3" /> Back
            </button>
            <button
              onClick={handleNext}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all"
            >
              {isLastStep && isLastModule ? (
                <>Open Dashboard <GraduationCap className="w-3 h-3" /></>
              ) : isLastStep ? (
                <>Next Module <ChevronRight className="w-3 h-3" /></>
              ) : (
                <>Continue <ChevronRight className="w-3 h-3" /></>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
