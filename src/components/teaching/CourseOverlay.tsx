import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, CheckCircle2, XCircle, ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import { COURSE_MODULES, type CourseModule, type CourseStep } from "@/lib/course-content";
import { Progress } from "@/components/ui/progress";

interface Props {
  currentModule: number;
  currentStep: number;
  onAdvanceStep: () => void;
  onCompleteModule: () => void;
  totalModules: number;
}

function LessonVisual({ visual }: { visual?: string }) {
  if (!visual) return null;

  const visuals: Record<string, React.ReactNode> = {
    "pool-intro": (
      <div className="flex items-center justify-center gap-4 py-4">
        <div className="flex flex-col items-center gap-1">
          <div className="w-16 h-16 rounded-xl bg-chart-1/20 border border-chart-1/30 flex items-center justify-center text-2xl">🪙</div>
          <span className="text-[10px] font-mono text-muted-foreground">Token X</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-xs font-mono text-muted-foreground px-3 py-1 rounded-full bg-secondary border border-border">x × y = k</div>
          <ArrowRight className="w-4 h-4 text-muted-foreground rotate-0" />
          <ArrowRight className="w-4 h-4 text-muted-foreground rotate-180" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-16 h-16 rounded-xl bg-chart-2/20 border border-chart-2/30 flex items-center justify-center text-2xl">💎</div>
          <span className="text-[10px] font-mono text-muted-foreground">Token Y</span>
        </div>
      </div>
    ),
    "reserves-diagram": (
      <div className="py-4 space-y-3">
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-muted-foreground">Reserve X</span>
            <span className="font-mono">1,000</span>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-chart-1/60" initial={{ width: 0 }} animate={{ width: "50%" }} transition={{ duration: 0.8, delay: 0.2 }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-muted-foreground">Reserve Y</span>
            <span className="font-mono">1,000</span>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-chart-2/60" initial={{ width: 0 }} animate={{ width: "50%" }} transition={{ duration: 0.8, delay: 0.4 }} />
          </div>
        </div>
        <div className="text-center text-[10px] font-mono text-muted-foreground pt-1">k = 1,000 × 1,000 = 1,000,000</div>
      </div>
    ),
    "curve-preview": (
      <div className="py-4 flex items-center justify-center">
        <svg viewBox="0 0 200 140" className="w-full max-w-[240px]" fill="none">
          <path d="M 20 120 Q 40 80 60 60 Q 80 45 100 38 Q 130 30 160 25 Q 180 22 190 20" stroke="hsl(var(--chart-1))" strokeWidth="2" fill="none" />
          <circle cx="100" cy="38" r="5" fill="hsl(var(--chart-2))" stroke="hsl(var(--background))" strokeWidth="2" />
          <line x1="70" y1="55" x2="130" y2="21" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          <text x="105" y="52" fontSize="8" fill="hsl(var(--muted-foreground))">Current position</text>
          <text x="20" y="135" fontSize="7" fill="hsl(var(--muted-foreground))">Reserve X →</text>
          <text x="3" y="15" fontSize="7" fill="hsl(var(--muted-foreground))" transform="rotate(-90, 8, 70)">Reserve Y →</text>
        </svg>
      </div>
    ),
    "trade-animation": (
      <div className="py-4 flex items-center justify-center">
        <svg viewBox="0 0 200 140" className="w-full max-w-[240px]" fill="none">
          <path d="M 20 120 Q 40 80 60 60 Q 80 45 100 38 Q 130 30 160 25 Q 180 22 190 20" stroke="hsl(var(--chart-1))" strokeWidth="2" fill="none" />
          <circle cx="80" cy="48" r="4" fill="hsl(var(--chart-3))" opacity="0.5" />
          <motion.circle cx="80" cy="48" r="5" fill="hsl(var(--chart-2))" stroke="hsl(var(--background))" strokeWidth="2"
            animate={{ cx: [80, 120], cy: [48, 32] }} transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }} />
          <text x="60" y="70" fontSize="7" fill="hsl(var(--chart-3))">Before</text>
          <text x="115" y="46" fontSize="7" fill="hsl(var(--chart-2))">After</text>
          <motion.line x1="80" y1="48" x2="120" y2="32" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="2 2" opacity="0.3"
            animate={{ opacity: [0.1, 0.5, 0.1] }} transition={{ duration: 2, repeat: Infinity }} />
        </svg>
      </div>
    ),
    "il-diagram": (
      <div className="py-4 space-y-2">
        <div className="flex gap-3">
          <div className="flex-1 rounded-lg bg-chart-2/10 border border-chart-2/20 p-2 text-center">
            <div className="text-[10px] text-muted-foreground mb-1">HODL Value</div>
            <div className="text-sm font-mono font-semibold text-chart-2">$2,200</div>
          </div>
          <div className="flex-1 rounded-lg bg-chart-3/10 border border-chart-3/20 p-2 text-center">
            <div className="text-[10px] text-muted-foreground mb-1">LP Value</div>
            <div className="text-sm font-mono font-semibold text-chart-3">$2,075</div>
          </div>
        </div>
        <div className="text-center text-[10px] font-mono text-destructive">IL = -5.7% (price doubled)</div>
      </div>
    ),
    "arb-diagram": (
      <div className="py-4 space-y-2">
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <div className="rounded-lg bg-secondary border border-border px-3 py-2 text-center flex-1">
            <div className="text-muted-foreground">Pool Price</div>
            <div className="font-mono font-semibold">$1,900</div>
          </div>
          <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <ArrowRight className="w-4 h-4 text-warning" />
          </motion.div>
          <div className="rounded-lg bg-warning/10 border border-warning/20 px-3 py-2 text-center flex-1">
            <div className="text-muted-foreground">Market Price</div>
            <div className="font-mono font-semibold text-warning">$2,000</div>
          </div>
        </div>
        <div className="text-center text-[10px] text-muted-foreground">Arbitrageur buys cheap → pool price corrects ↑</div>
      </div>
    ),
    "fees-diagram": (
      <div className="py-4">
        <div className="flex items-end gap-2 justify-center h-20">
          {[
            { label: "Fees", value: 65, color: "bg-chart-2" },
            { label: "IL", value: 40, color: "bg-chart-3" },
            { label: "Net", value: 25, color: "bg-chart-1" },
          ].map((bar) => (
            <div key={bar.label} className="flex flex-col items-center gap-1">
              <motion.div
                className={`w-12 rounded-t ${bar.color}/60`}
                initial={{ height: 0 }}
                animate={{ height: `${bar.value}px` }}
                transition={{ duration: 0.6, delay: 0.2 }}
              />
              <span className="text-[9px] font-mono text-muted-foreground">{bar.label}</span>
            </div>
          ))}
        </div>
        <div className="text-center text-[10px] text-muted-foreground mt-2">Fees − IL = Net LP Profit</div>
      </div>
    ),
  };

  return visuals[visual] || null;
}

export default function CourseOverlay({ currentModule, currentStep, onAdvanceStep, onCompleteModule, totalModules }: Props) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);

  const mod = COURSE_MODULES[currentModule];
  if (!mod) return null;
  const step = mod.steps[currentStep];
  if (!step) return null;

  const isLastStep = currentStep === mod.steps.length - 1;
  const isLastModule = currentModule === totalModules - 1;
  const overallProgress = ((currentModule + (currentStep + 1) / mod.steps.length) / totalModules) * 100;

  const handleNext = () => {
    setSelectedAnswer(null);
    setAnswerRevealed(false);
    if (isLastStep) {
      onCompleteModule();
    } else {
      onAdvanceStep();
    }
  };

  const handleAnswer = (idx: number) => {
    if (answerRevealed) return;
    setSelectedAnswer(idx);
    setAnswerRevealed(true);
  };

  const canProceed = step.type === "lesson" || (step.type === "quiz" && answerRevealed);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <motion.div
        className="w-full max-w-lg mx-4"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Progress header */}
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-mono uppercase tracking-wider">Module {currentModule + 1} of {totalModules}</span>
            <span className="font-mono">{Math.round(overallProgress)}% complete</span>
          </div>
          <Progress value={overallProgress} className="h-1.5" />
          <div className="flex gap-1">
            {COURSE_MODULES.map((m, i) => (
              <div
                key={m.id}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < currentModule ? "bg-success" : i === currentModule ? "bg-primary" : "bg-secondary"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="surface-elevated rounded-xl overflow-hidden">
          {/* Module header */}
          <div className="px-5 pt-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{mod.emoji}</span>
              <h2 className="text-sm font-bold text-foreground">{mod.title}</h2>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                {currentStep + 1}/{mod.steps.length}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">{mod.subtitle}</p>
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentModule}-${currentStep}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="px-5 py-4"
            >
              {step.type === "lesson" ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-foreground">{step.title}</h3>
                  </div>
                  <div className="space-y-2.5">
                    {step.content.map((para, i) => (
                      <motion.p
                        key={i}
                        className="text-xs text-foreground/80 leading-relaxed"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        {para}
                      </motion.p>
                    ))}
                  </div>
                  <LessonVisual visual={step.visual} />
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <GraduationCap className="w-3.5 h-3.5 text-primary" />
                    <h3 className="text-xs font-semibold text-foreground">Quiz</h3>
                  </div>
                  <p className="text-xs font-medium text-foreground mb-3">{step.question}</p>
                  <div className="space-y-2">
                    {step.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleAnswer(i)}
                        disabled={answerRevealed}
                        className={`w-full text-left text-xs px-3 py-2.5 rounded-lg border transition-all ${
                          answerRevealed && i === step.correctIndex
                            ? "border-success bg-success/10 text-success"
                            : answerRevealed && i === selectedAnswer && i !== step.correctIndex
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : selectedAnswer === i
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {answerRevealed && i === step.correctIndex && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                          {answerRevealed && i === selectedAnswer && i !== step.correctIndex && <XCircle className="w-3.5 h-3.5 shrink-0" />}
                          {opt}
                        </span>
                      </button>
                    ))}
                  </div>
                  {answerRevealed && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 p-3 rounded-lg bg-secondary text-[11px] text-muted-foreground leading-relaxed"
                    >
                      {selectedAnswer === step.correctIndex ? "✓ Correct! " : "✗ Not quite. "}
                      {step.explanation}
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border flex justify-end">
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                canProceed
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              }`}
            >
              {isLastStep && isLastModule ? (
                <>Open Dashboard <GraduationCap className="w-3.5 h-3.5" /></>
              ) : isLastStep ? (
                <>Next Module <ChevronRight className="w-3.5 h-3.5" /></>
              ) : (
                <>Continue <ChevronRight className="w-3.5 h-3.5" /></>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
