import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, BookOpen, GraduationCap, Calculator, SkipForward, ArrowRight, Check, Lock, Circle, ChevronDown } from "lucide-react";
import { COURSE_MODULES, type CourseStep, type CourseModule } from "@/lib/course-content";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import AIChatPanel from "@/components/teaching/AIChatPanel";

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

export default function CourseSidebar({ currentModule, currentStep, onAdvanceStep, onGoBack, onCompleteModule, onSkipCourse, totalModules, completedModules, onNavigateModule, modules }: Props) {
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
