import { useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, RotateCcw, ChevronRight, Check, X, BarChart3,
  Database, RefreshCw, Crosshair, Layers,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  BASE_RATE_DRILLS,
  UPDATE_DRILLS,
  CALIBRATION_QUESTIONS,
  DECOMPOSITION_EXERCISES,
} from "@/forecasting/lib/sample-data";
import { forecastRoute } from "@/forecasting/lib/routes";

// --- Base Rate Drill ---

function BaseRateDrillSection() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [estimate, setEstimate] = useState(50);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<{ drillId: string; estimate: number; actual: number }[]>([]);

  const drill = BASE_RATE_DRILLS[currentIdx];

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    setResults((prev) => [
      ...prev,
      { drillId: drill.id, estimate: estimate / 100, actual: drill.actualRate },
    ]);
  }, [drill, estimate]);

  const handleNext = useCallback(() => {
    setCurrentIdx((i) => Math.min(i + 1, BASE_RATE_DRILLS.length - 1));
    setEstimate(50);
    setSubmitted(false);
  }, []);

  const handleReset = useCallback(() => {
    setCurrentIdx(0);
    setEstimate(50);
    setSubmitted(false);
    setResults([]);
  }, []);

  const avgError = useMemo(() => {
    if (results.length === 0) return 0;
    return results.reduce((s, r) => s + Math.abs(r.estimate - r.actual), 0) / results.length;
  }, [results]);

  return (
    <div>
      {/* Progress */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs text-muted-foreground">
          {currentIdx + 1} of {BASE_RATE_DRILLS.length}
        </span>
        <Progress value={((currentIdx + (submitted ? 1 : 0)) / BASE_RATE_DRILLS.length) * 100} className="h-1.5 flex-1" />
        {results.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Avg error: <span className="font-mono-data font-semibold text-foreground">{(avgError * 100).toFixed(1)}pp</span>
          </span>
        )}
      </div>

      <div className="surface-elevated rounded-xl p-6 mb-4">
        <h3 className="text-base font-semibold text-foreground mb-2">
          {drill.question}
        </h3>
        <p className="text-xs text-muted-foreground mb-6">{drill.hint}</p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Your estimate:</span>
            <span className="font-mono-data text-2xl font-bold text-foreground">{estimate}%</span>
          </div>
          <Slider
            value={[estimate]}
            onValueChange={([v]) => !submitted && setEstimate(v)}
            min={0}
            max={100}
            step={1}
            disabled={submitted}
          />

          {!submitted ? (
            <Button onClick={handleSubmit} className="w-full">Lock In Estimate</Button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border bg-card text-center">
                  <span className="text-[10px] text-muted-foreground block mb-1">Your Estimate</span>
                  <span className="font-mono-data text-xl font-bold text-foreground">{estimate}%</span>
                </div>
                <div className="p-4 rounded-lg border border-success/30 bg-success/5 text-center">
                  <span className="text-[10px] text-muted-foreground block mb-1">Actual Rate</span>
                  <span className="font-mono-data text-xl font-bold text-success">
                    {Math.round(drill.actualRate * 100)}%
                  </span>
                </div>
              </div>
              <div className="text-center">
                <span className={`text-sm font-medium ${Math.abs(estimate / 100 - drill.actualRate) < 0.1 ? "text-success" : Math.abs(estimate / 100 - drill.actualRate) < 0.2 ? "text-warning" : "text-destructive"}`}>
                  {Math.abs(estimate / 100 - drill.actualRate) < 0.1
                    ? "Excellent base rate intuition!"
                    : Math.abs(estimate / 100 - drill.actualRate) < 0.2
                      ? "Reasonable estimate, but room to improve."
                      : "Significant gap. Study this domain's base rates."}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Source: {drill.source}
              </p>

              {currentIdx < BASE_RATE_DRILLS.length - 1 ? (
                <Button onClick={handleNext} className="w-full">
                  Next Drill <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleReset} variant="outline" className="w-full">
                  <RotateCcw className="w-4 h-4 mr-1" /> Restart Drills
                </Button>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Update Drill ---

function UpdateDrillSection() {
  const [drillIdx, setDrillIdx] = useState(0);
  const [step, setStep] = useState(0); // 0 = initial, 1+ = update steps
  const [estimates, setEstimates] = useState<number[]>([]);
  const [currentEstimate, setCurrentEstimate] = useState(50);
  const [submitted, setSubmitted] = useState(false);

  const drill = UPDATE_DRILLS[drillIdx];
  const isInitial = step === 0;
  const updateIdx = step - 1;
  const isComplete = step > drill.updates.length;

  const handleSubmit = useCallback(() => {
    setEstimates((prev) => [...prev, currentEstimate / 100]);
    setSubmitted(true);
  }, [currentEstimate]);

  const handleNext = useCallback(() => {
    setStep((s) => s + 1);
    setSubmitted(false);
    setCurrentEstimate(currentEstimate);
  }, [currentEstimate]);

  const handleNewDrill = useCallback(() => {
    setDrillIdx((i) => (i + 1) % UPDATE_DRILLS.length);
    setStep(0);
    setEstimates([]);
    setCurrentEstimate(50);
    setSubmitted(false);
  }, []);

  return (
    <div>
      <div className="surface-elevated rounded-xl p-6 mb-4">
        <h3 className="text-base font-semibold text-foreground mb-2">
          {drill.scenario}
        </h3>

        {/* Initial context */}
        <div className="p-3 rounded-lg border border-border bg-card mb-4">
          <span className="text-[10px] text-muted-foreground block mb-1">Context</span>
          <p className="text-xs text-foreground">{drill.initialContext}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Historical base rate: <span className="font-mono-data font-semibold">{Math.round(drill.baseRate * 100)}%</span>
          </p>
        </div>

        {/* Show previous updates */}
        {step > 0 && !isComplete && (
          <div className="space-y-3 mb-4">
            {drill.updates.slice(0, updateIdx).map((u, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-card/50">
                <span className="text-[10px] text-muted-foreground">Update {i + 1}</span>
                <p className="text-xs text-foreground">{u.evidence}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your estimate: <span className="font-mono-data font-semibold">{Math.round((estimates[i + 1] || estimates[i]) * 100)}%</span>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Current step */}
        {!isComplete && (
          <>
            {!isInitial && (
              <div className="p-3 rounded-lg border border-warning/30 bg-warning/5 mb-4">
                <span className="text-[10px] text-warning font-semibold">New Evidence</span>
                <p className="text-xs text-foreground mt-1">
                  {drill.updates[updateIdx].evidence}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {isInitial ? "Initial estimate:" : "Updated estimate:"}
                </span>
                <span className="font-mono-data text-2xl font-bold text-foreground">{currentEstimate}%</span>
              </div>
              <Slider
                value={[currentEstimate]}
                onValueChange={([v]) => !submitted && setCurrentEstimate(v)}
                min={1}
                max={99}
                step={1}
                disabled={submitted}
              />

              {!submitted ? (
                <Button onClick={handleSubmit} className="w-full">
                  {isInitial ? "Submit Initial Estimate" : "Submit Update"}
                </Button>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {!isInitial && (
                    <div className="p-3 rounded-lg border border-border bg-card mb-4">
                      <span className="text-[10px] text-muted-foreground block mb-1">Guidance</span>
                      <p className="text-xs text-foreground">
                        {drill.updates[updateIdx].suggestedShift}
                      </p>
                    </div>
                  )}
                  {step < drill.updates.length ? (
                    <Button onClick={handleNext} className="w-full">
                      See Next Evidence <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : (
                    <Button onClick={() => { setSubmitted(false); setStep(step + 1); }} className="w-full">
                      View Summary
                    </Button>
                  )}
                </motion.div>
              )}
            </div>
          </>
        )}

        {/* Summary */}
        {isComplete && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Your Update Path</h4>
            <div className="flex items-center gap-2">
              {estimates.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="p-2 rounded-lg border border-border bg-card text-center min-w-[60px]">
                    <span className="text-[10px] text-muted-foreground block">
                      {i === 0 ? "Initial" : `Update ${i}`}
                    </span>
                    <span className="font-mono-data text-sm font-bold text-foreground">
                      {Math.round(e * 100)}%
                    </span>
                  </div>
                  {i < estimates.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 rounded-lg border border-border bg-card">
              <p className="text-xs text-muted-foreground">
                Good forecasters update incrementally in response to new evidence.
                Over-updating on single data points and under-updating (anchoring) are both common errors.
                Review the guidance for each step to calibrate your update magnitude.
              </p>
            </div>
            <Button onClick={handleNewDrill} className="w-full">
              <RotateCcw className="w-4 h-4 mr-1" /> Try Another Scenario
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// --- Calibration Drill ---

function CalibrationDrillSection() {
  const [questionIdx, setQuestionIdx] = useState(0);
  const [confidence, setConfidence] = useState(70);
  const [userAnswer, setUserAnswer] = useState<"True" | "False" | null>(null);
  const [results, setResults] = useState<
    { question: string; userAnswer: string; correctAnswer: string; confidence: number; correct: boolean }[]
  >([]);
  const [showResults, setShowResults] = useState(false);

  const question = CALIBRATION_QUESTIONS[questionIdx];
  const isComplete = questionIdx >= CALIBRATION_QUESTIONS.length;

  const handleSubmit = useCallback(() => {
    if (!userAnswer) return;
    const correct = userAnswer === question.answer;
    setResults((prev) => [
      ...prev,
      {
        question: question.question,
        userAnswer,
        correctAnswer: question.answer,
        confidence,
        correct,
      },
    ]);
    setQuestionIdx((i) => i + 1);
    setUserAnswer(null);
    setConfidence(70);
  }, [userAnswer, confidence, question]);

  const handleReset = useCallback(() => {
    setQuestionIdx(0);
    setUserAnswer(null);
    setConfidence(70);
    setResults([]);
    setShowResults(false);
  }, []);

  // Compute calibration buckets from results
  const calibrationData = useMemo(() => {
    const buckets = [
      { range: "50-60%", min: 50, max: 60, correct: 0, total: 0 },
      { range: "61-70%", min: 61, max: 70, correct: 0, total: 0 },
      { range: "71-80%", min: 71, max: 80, correct: 0, total: 0 },
      { range: "81-90%", min: 81, max: 90, correct: 0, total: 0 },
      { range: "91-100%", min: 91, max: 100, correct: 0, total: 0 },
    ];
    for (const r of results) {
      const bucket = buckets.find((b) => r.confidence >= b.min && r.confidence <= b.max);
      if (bucket) {
        bucket.total++;
        if (r.correct) bucket.correct++;
      }
    }
    return buckets.filter((b) => b.total > 0);
  }, [results]);

  if (isComplete || showResults) {
    const totalCorrect = results.filter((r) => r.correct).length;
    return (
      <div>
        <div className="surface-elevated rounded-xl p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Calibration Results</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg border border-border bg-card text-center">
              <span className="text-[10px] text-muted-foreground block mb-1">Accuracy</span>
              <span className="font-mono-data text-xl font-bold text-foreground">
                {Math.round((totalCorrect / results.length) * 100)}%
              </span>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card text-center">
              <span className="text-[10px] text-muted-foreground block mb-1">Questions</span>
              <span className="font-mono-data text-xl font-bold text-foreground">
                {results.length}
              </span>
            </div>
          </div>

          {/* Calibration curve */}
          <h4 className="text-sm font-semibold text-foreground mb-3">Calibration Curve</h4>
          <div className="space-y-2 mb-6">
            {calibrationData.map((b) => {
              const actual = b.total > 0 ? b.correct / b.total : 0;
              const predicted = (b.min + b.max) / 2 / 100;
              const diff = actual - predicted;
              return (
                <div key={b.range} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{b.range}</span>
                  <div className="flex-1 h-6 bg-secondary rounded relative overflow-hidden">
                    {/* Predicted bar (background) */}
                    <div
                      className="absolute inset-y-0 left-0 bg-muted-foreground/20 rounded"
                      style={{ width: `${predicted * 100}%` }}
                    />
                    {/* Actual bar */}
                    <div
                      className={`absolute inset-y-0 left-0 rounded ${
                        Math.abs(diff) < 0.1 ? "bg-success/60" : diff > 0 ? "bg-warning/60" : "bg-destructive/60"
                      }`}
                      style={{ width: `${actual * 100}%` }}
                    />
                  </div>
                  <span className="font-mono-data text-xs w-14 text-right">
                    {Math.round(actual * 100)}% ({b.total})
                  </span>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-lg border border-border bg-card mb-4">
            <p className="text-xs text-muted-foreground">
              {calibrationData.some((b) => {
                const actual = b.correct / b.total;
                const predicted = (b.min + b.max) / 2 / 100;
                return actual < predicted - 0.15;
              })
                ? "You appear overconfident in some ranges. Your accuracy is lower than the confidence you assigned."
                : calibrationData.some((b) => {
                      const actual = b.correct / b.total;
                      const predicted = (b.min + b.max) / 2 / 100;
                      return actual > predicted + 0.15;
                    })
                  ? "You appear underconfident. You got more right than your confidence levels suggested."
                  : "Your calibration looks reasonable. Keep practicing to refine further."}
            </p>
          </div>

          {/* Individual results */}
          <div className="space-y-1 max-h-60 overflow-y-auto mb-4">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1">
                {r.correct ? (
                  <Check className="w-3.5 h-3.5 text-success shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-destructive shrink-0" />
                )}
                <span className="text-foreground truncate flex-1">{r.question}</span>
                <span className="font-mono-data text-muted-foreground shrink-0">
                  {r.confidence}%
                </span>
              </div>
            ))}
          </div>

          <Button onClick={handleReset} variant="outline" className="w-full">
            <RotateCcw className="w-4 h-4 mr-1" /> Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs text-muted-foreground">
          {questionIdx + 1} of {CALIBRATION_QUESTIONS.length}
        </span>
        <Progress value={(questionIdx / CALIBRATION_QUESTIONS.length) * 100} className="h-1.5 flex-1" />
        {results.length >= 5 && (
          <Button variant="ghost" size="sm" onClick={() => setShowResults(true)} className="text-xs">
            View Results
          </Button>
        )}
      </div>

      <div className="surface-elevated rounded-xl p-6">
        <h3 className="text-base font-semibold text-foreground mb-6">
          {question.question}
        </h3>

        {/* True/False selection */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setUserAnswer("True")}
            className={`p-4 rounded-lg border text-center transition-colors ${
              userAnswer === "True"
                ? "border-foreground bg-foreground/5 text-foreground font-semibold"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
          >
            True
          </button>
          <button
            onClick={() => setUserAnswer("False")}
            className={`p-4 rounded-lg border text-center transition-colors ${
              userAnswer === "False"
                ? "border-foreground bg-foreground/5 text-foreground font-semibold"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
          >
            False
          </button>
        </div>

        {/* Confidence slider */}
        {userAnswer && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">How confident are you?</span>
              <span className="font-mono-data text-xl font-bold text-foreground">{confidence}%</span>
            </div>
            <Slider
              value={[confidence]}
              onValueChange={([v]) => setConfidence(v)}
              min={50}
              max={100}
              step={5}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>50% (guessing)</span>
              <span>75%</span>
              <span>100% (certain)</span>
            </div>
            <Button onClick={handleSubmit} className="w-full">
              Submit ({userAnswer}, {confidence}% confident)
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// --- Decomposition Drill ---

function DecompositionDrillSection() {
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const exercise = DECOMPOSITION_EXERCISES[exerciseIdx];
  const [subProbs, setSubProbs] = useState<number[]>(exercise.subQuestions.map(() => 50));
  const [submitted, setSubmitted] = useState(false);

  const jointProbability = subProbs.reduce((p, v) => p * (v / 100), 1);

  const handleSubProbChange = useCallback((idx: number, value: number) => {
    setSubProbs((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }, []);

  const handleNewExercise = useCallback(() => {
    const nextIdx = (exerciseIdx + 1) % DECOMPOSITION_EXERCISES.length;
    setExerciseIdx(nextIdx);
    setSubProbs(DECOMPOSITION_EXERCISES[nextIdx].subQuestions.map(() => 50));
    setSubmitted(false);
  }, [exerciseIdx]);

  return (
    <div>
      <div className="surface-elevated rounded-xl p-6">
        <h3 className="text-base font-semibold text-foreground mb-2">
          {exercise.mainQuestion}
        </h3>
        <p className="text-xs text-muted-foreground mb-6">{exercise.description}</p>

        <div className="space-y-5">
          {exercise.subQuestions.map((sq, i) => (
            <div key={i} className="p-4 rounded-lg border border-border bg-card">
              <p className="text-sm text-foreground mb-1">{sq.question}</p>
              <p className="text-[10px] text-muted-foreground mb-3">{sq.hint}</p>
              <div className="flex items-center gap-3">
                <Slider
                  value={[subProbs[i]]}
                  onValueChange={([v]) => !submitted && handleSubProbChange(i, v)}
                  min={1}
                  max={99}
                  step={1}
                  disabled={submitted}
                  className="flex-1"
                />
                <span className="font-mono-data text-sm font-bold text-foreground w-12 text-right">
                  {subProbs[i]}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Joint probability */}
        <div className="mt-6 p-4 rounded-lg border border-foreground/20 bg-card text-center">
          <span className="text-[10px] text-muted-foreground block mb-1">
            Joint Probability (all conditions must hold)
          </span>
          <span className="font-mono-data text-3xl font-bold text-foreground">
            {(jointProbability * 100).toFixed(1)}%
          </span>
        </div>

        {!submitted ? (
          <Button onClick={() => setSubmitted(true)} className="w-full mt-4">
            Submit Decomposition
          </Button>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-4">
            <div className="p-4 rounded-lg border border-border bg-card">
              <p className="text-xs text-muted-foreground">
                Notice how the joint probability ({(jointProbability * 100).toFixed(1)}%) is much lower than
                any individual component. This is the conjunction fallacy in action—complex events requiring
                multiple conditions are far less likely than we intuitively feel. Even if each sub-event is
                "more likely than not," the combination can be quite improbable.
              </p>
            </div>
            <Button onClick={handleNewExercise} variant="outline" className="w-full">
              <RotateCcw className="w-4 h-4 mr-1" /> Try Another Exercise
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// --- Main Drills Page ---

export default function Drills() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "base-rate";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(forecastRoute())}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-foreground">Deliberate Practice</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-foreground mb-2">Practice Drills</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Structured exercises to systematically improve your forecasting skills.
            Each drill targets a specific aspect of probabilistic reasoning.
          </p>

          <Tabs defaultValue={initialTab}>
            <TabsList className="mb-6 w-full justify-start overflow-x-auto">
              <TabsTrigger value="base-rate" className="gap-1.5">
                <Database className="w-3.5 h-3.5" /> Base Rates
              </TabsTrigger>
              <TabsTrigger value="update" className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Updating
              </TabsTrigger>
              <TabsTrigger value="calibration" className="gap-1.5">
                <Crosshair className="w-3.5 h-3.5" /> Calibration
              </TabsTrigger>
              <TabsTrigger value="decomposition" className="gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Decomposition
              </TabsTrigger>
            </TabsList>

            <TabsContent value="base-rate">
              <BaseRateDrillSection />
            </TabsContent>
            <TabsContent value="update">
              <UpdateDrillSection />
            </TabsContent>
            <TabsContent value="calibration">
              <CalibrationDrillSection />
            </TabsContent>
            <TabsContent value="decomposition">
              <DecompositionDrillSection />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
