import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, ChevronLeft, CheckCircle2, BookOpen, Lock } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { LESSON_MODULES } from "@/forecasting/lib/sample-data";

interface QuizState {
  moduleId: string;
  answer: number;
  submitted: boolean;
  feedback: string;
}

const MODULE_QUIZZES: Record<string, { question: string; idealRange: [number, number]; explanation: string }> = {
  m1: {
    question: "You believe there is a 'decent chance' something will happen. What probability best captures 'decent chance'?",
    idealRange: [0.55, 0.75],
    explanation: "A 'decent chance' typically corresponds to 55-75%. Many people assign either too low (near 50%) or too high (near 90%). Being specific about what verbal labels mean in numeric terms is a key calibration skill.",
  },
  m2: {
    question: "A startup in the enterprise SaaS space wants to IPO. Without knowing anything else, what probability would you assign based on historical base rates?",
    idealRange: [0.03, 0.12],
    explanation: "Only about 3-10% of venture-backed startups reach IPO. The base rate for any individual startup achieving an IPO is quite low. Starting from this base rate and adjusting is better than starting from your gut feeling.",
  },
  m3: {
    question: "You initially estimate 20% probability for an event. You then learn evidence that is 4x more likely if the event is true than if false. What should your updated probability be?",
    idealRange: [0.45, 0.55],
    explanation: "Using Bayes' theorem: P(H|E) = P(E|H)×P(H) / [P(E|H)×P(H) + P(E|¬H)×P(¬H)] = (4×0.2) / (4×0.2 + 1×0.8) = 0.8/1.6 = 50%. Many people either barely update (staying near 20%) or overreact (jumping to 80%+).",
  },
  m4: {
    question: "An event requires three independent conditions, each with 80% probability. What's the probability all three occur?",
    idealRange: [0.48, 0.55],
    explanation: "0.8 × 0.8 × 0.8 = 0.512, roughly 51%. People consistently overestimate the probability of conjunctive events. Three 'likely' conditions together become essentially a coin flip.",
  },
  m5: {
    question: "After a vivid plane crash in the news, how much should your estimate of plane crash probability change?",
    idealRange: [0.0, 0.05],
    explanation: "Almost not at all. One vivid event doesn't change the base rate. Availability bias makes recently-seen or emotionally charged events feel more probable. The actual statistical risk of flying hasn't changed.",
  },
  m6: {
    question: "If you always forecast 50% on everything, what would your average Brier score be?",
    idealRange: [0.24, 0.26],
    explanation: "The Brier score for always predicting 50% is exactly 0.25 (since (0.5-1)²=0.25 and (0.5-0)²=0.25). This is the 'no-skill' benchmark. Any average Brier score below 0.25 indicates you have forecasting skill.",
  },
};

export default function Lessons() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialModule = parseInt(searchParams.get("module") || "0", 10);

  const [selectedModule, setSelectedModule] = useState(Math.min(initialModule, LESSON_MODULES.length - 1));
  const [lessonStep, setLessonStep] = useState(0);
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());
  const [quiz, setQuiz] = useState<QuizState | null>(null);

  const currentModule = LESSON_MODULES[selectedModule];
  const totalLessons = currentModule.lessons.length;
  const isLastStep = lessonStep >= totalLessons;
  const moduleProgress = isLastStep ? 100 : (lessonStep / totalLessons) * 100;

  const handleNext = useCallback(() => {
    if (lessonStep < totalLessons) {
      setLessonStep((s) => s + 1);
    }
  }, [lessonStep, totalLessons]);

  const handlePrev = useCallback(() => {
    if (lessonStep > 0) {
      setLessonStep((s) => s - 1);
      setQuiz(null);
    }
  }, [lessonStep]);

  const handleModuleSelect = useCallback((idx: number) => {
    setSelectedModule(idx);
    setLessonStep(0);
    setQuiz(null);
  }, []);

  const handleQuizSubmit = useCallback(() => {
    if (!quiz) return;
    const quizData = MODULE_QUIZZES[currentModule.id];
    if (!quizData) return;

    const inRange = quiz.answer >= quizData.idealRange[0] && quiz.answer <= quizData.idealRange[1];
    const distance = inRange
      ? 0
      : Math.min(
          Math.abs(quiz.answer - quizData.idealRange[0]),
          Math.abs(quiz.answer - quizData.idealRange[1]),
        );

    let feedback: string;
    if (inRange) {
      feedback = "Excellent. Your estimate falls within the well-calibrated range.";
    } else if (distance < 0.15) {
      feedback = "Close, but not quite in the ideal range. Review the explanation below.";
    } else {
      feedback = "Significantly off. This is a common mistake — study the explanation carefully.";
    }

    setQuiz({ ...quiz, submitted: true, feedback });
    setCompletedModules((prev) => new Set(prev).add(currentModule.id));
  }, [quiz, currentModule]);

  const startQuiz = useCallback(() => {
    const quizData = MODULE_QUIZZES[currentModule.id];
    if (quizData) {
      setQuiz({
        moduleId: currentModule.id,
        answer: 0.5,
        submitted: false,
        feedback: "",
      });
    }
  }, [currentModule]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/forecast")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-foreground">Interactive Lessons</span>
            <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
              {completedModules.size}/{LESSON_MODULES.length} completed
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
        {/* Sidebar - Module List */}
        <aside className="lg:w-64 shrink-0">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Modules
          </h3>
          <div className="space-y-1">
            {LESSON_MODULES.map((mod, idx) => (
              <button
                key={mod.id}
                onClick={() => handleModuleSelect(idx)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  idx === selectedModule
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {completedModules.has(mod.id) ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                  ) : idx === selectedModule ? (
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
                  )}
                  <span className="truncate">{mod.title}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <motion.div
            key={`${selectedModule}-${lessonStep}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Module Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span>Module {selectedModule + 1}</span>
                <span>·</span>
                <span>{isLastStep ? "Quiz" : `Lesson ${lessonStep + 1} of ${totalLessons}`}</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">{currentModule.title}</h1>
              <p className="text-sm text-muted-foreground">{currentModule.description}</p>
              <div className="mt-4">
                <Progress value={moduleProgress} className="h-1.5" />
              </div>
            </div>

            {/* Lesson Content or Quiz */}
            {!isLastStep ? (
              <div className="surface-elevated rounded-xl p-8 mb-6">
                <div className="prose prose-sm max-w-none">
                  <p className="text-foreground text-base leading-relaxed">
                    {currentModule.lessons[lessonStep]}
                  </p>
                </div>

                {/* Lesson step indicator */}
                <div className="flex items-center gap-2 mt-8">
                  {currentModule.lessons.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === lessonStep
                          ? "w-8 bg-foreground"
                          : i < lessonStep
                            ? "w-4 bg-foreground/30"
                            : "w-4 bg-border"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : quiz ? (
              <div className="surface-elevated rounded-xl p-8 mb-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Module Quiz</h3>
                <p className="text-foreground mb-6">
                  {MODULE_QUIZZES[currentModule.id]?.question}
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Your probability estimate:</span>
                    <span className="font-mono-data text-lg font-semibold text-foreground">
                      {Math.round(quiz.answer * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[quiz.answer * 100]}
                    onValueChange={([v]) => !quiz.submitted && setQuiz({ ...quiz, answer: v / 100 })}
                    min={0}
                    max={100}
                    step={1}
                    disabled={quiz.submitted}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>

                  {!quiz.submitted ? (
                    <Button onClick={handleQuizSubmit} className="mt-4">
                      Submit Answer
                    </Button>
                  ) : (
                    <div className="mt-6 space-y-4">
                      <div
                        className={`p-4 rounded-lg border ${
                          quiz.feedback.startsWith("Excellent")
                            ? "border-success/30 bg-success/5 text-success"
                            : quiz.feedback.startsWith("Close")
                              ? "border-warning/30 bg-warning/5 text-warning"
                              : "border-destructive/30 bg-destructive/5 text-destructive"
                        }`}
                      >
                        <p className="text-sm font-medium">{quiz.feedback}</p>
                      </div>
                      <div className="p-4 rounded-lg border border-border bg-card">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">Ideal range: </span>
                          {Math.round(MODULE_QUIZZES[currentModule.id].idealRange[0] * 100)}% –{" "}
                          {Math.round(MODULE_QUIZZES[currentModule.id].idealRange[1] * 100)}%
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {MODULE_QUIZZES[currentModule.id].explanation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="surface-elevated rounded-xl p-8 mb-6 text-center">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Lesson Complete
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  You've read all lessons in this module. Take the quiz to test your understanding.
                </p>
                <Button onClick={startQuiz}>Take Module Quiz</Button>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={lessonStep === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              {!isLastStep ? (
                <Button onClick={handleNext}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : quiz?.submitted && selectedModule < LESSON_MODULES.length - 1 ? (
                <Button onClick={() => handleModuleSelect(selectedModule + 1)}>
                  Next Module
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : null}
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
