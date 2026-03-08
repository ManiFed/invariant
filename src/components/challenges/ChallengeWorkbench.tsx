import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Star, CheckCircle2, XCircle, Lightbulb, RotateCcw, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Challenge, ChallengeParams, ChallengeResult, ConstraintResult } from "@/lib/challenge-engine";
import { saveProgress, getSlidersForChallenge } from "@/lib/challenge-engine";

export default function ChallengeWorkbench({
  challenge,
  onBack,
  onProgressUpdate,
}: {
  challenge: Challenge;
  onBack: () => void;
  onProgressUpdate: () => void;
}) {
  const sliders = getSlidersForChallenge(challenge);
  const [params, setParams] = useState<ChallengeParams>({ ...challenge.defaultParams });
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showHint, setShowHint] = useState(-1);
  const [celebrated, setCelebrated] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [animating, setAnimating] = useState(false);

  const runEvaluation = useCallback(() => {
    setRunning(true);
    setCelebrated(false);
    // Simulate processing delay for UX
    setTimeout(() => {
      const r = challenge.evaluate(params);
      setResult(r);
      if (r.passed) {
        saveProgress(challenge.id, r);
        onProgressUpdate();
        if (!celebrated) setCelebrated(true);
      }
      setRunning(false);
    }, 600);
  }, [challenge, params, celebrated, onProgressUpdate]);

  const reset = () => {
    setParams({ ...challenge.defaultParams });
    setResult(null);
    setCelebrated(false);
    setShowHint(-1);
    setGaveUp(false);
  };

  const giveUp = useCallback(() => {
    if (animating) return;
    setGaveUp(true);
    setAnimating(true);
    setResult(null);

    const solution = challenge.solutionParams;
    const start = { ...params };
    const duration = 800;
    const startTime = performance.now();

    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      setParams({
        reserveX: Math.round(start.reserveX + (solution.reserveX - start.reserveX) * ease),
        reserveY: Math.round(start.reserveY + (solution.reserveY - start.reserveY) * ease),
        feeRate: start.feeRate + (solution.feeRate - start.feeRate) * ease,
        amplification: start.amplification + (solution.amplification - start.amplification) * ease,
        concentrationLower: start.concentrationLower + (solution.concentrationLower - start.concentrationLower) * ease,
        concentrationUpper: start.concentrationUpper + (solution.concentrationUpper - start.concentrationUpper) * ease,
      });
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setParams({ ...solution });
        setAnimating(false);
        // Auto-run evaluation after filling in
        setTimeout(() => {
          const r = challenge.evaluate(solution);
          setResult(r);
          if (r.passed) {
            // Don't save progress on give-up — it's a freebie
          }
        }, 300);
      }
    };
    requestAnimationFrame(animate);
  }, [challenge, params, animating]);

  const updateParam = (key: keyof ChallengeParams, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{challenge.icon}</span>
            <h2 className="text-lg font-semibold text-foreground">{challenge.name}</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{challenge.story}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Pool Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <ParamSlider
                label="Reserve X"
                value={params.reserveX}
                min={sliders.reserveX.min}
                max={sliders.reserveX.max}
                step={sliders.reserveX.step}
                format={sliders.reserveX.format || ((v) => `${v.toLocaleString()}`)}
                onChange={(v) => updateParam("reserveX", v)}
              />
              <ParamSlider
                label="Reserve Y"
                value={params.reserveY}
                min={sliders.reserveY.min}
                max={sliders.reserveY.max}
                step={sliders.reserveY.step}
                format={sliders.reserveY.format || ((v) => `$${(v / 1000).toFixed(0)}k`)}
                onChange={(v) => updateParam("reserveY", v)}
              />
              <ParamSlider
                label="Fee Rate"
                value={params.feeRate * 10000}
                min={sliders.feeRate.min}
                max={sliders.feeRate.max}
                step={sliders.feeRate.step}
                format={(v) => `${v} bps (${(v / 100).toFixed(2)}%)`}
                onChange={(v) => updateParam("feeRate", v / 10000)}
              />
              <ParamSlider
                label="Range Lower"
                value={params.concentrationLower * 100}
                min={sliders.concentrationLower.min}
                max={sliders.concentrationLower.max}
                step={sliders.concentrationLower.step}
                format={(v) => `${v}%`}
                onChange={(v) => updateParam("concentrationLower", v / 100)}
              />
              <ParamSlider
                label="Range Upper"
                value={params.concentrationUpper * 100}
                min={sliders.concentrationUpper.min}
                max={sliders.concentrationUpper.max}
                step={sliders.concentrationUpper.step}
                format={(v) => `${v}%`}
                onChange={(v) => updateParam("concentrationUpper", v / 100)}
              />
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={runEvaluation} disabled={running || animating}>
              <Play className="w-4 h-4" />
              {running ? "Simulating…" : "Run Simulation"}
            </Button>
            <Button variant="outline" onClick={reset} disabled={animating}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {/* Give Up */}
          {!gaveUp && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-destructive"
              onClick={giveUp}
              disabled={animating}
            >
              <Flag className="w-3.5 h-3.5 mr-1.5" />
              I give up — show me the answer
            </Button>
          )}
          {gaveUp && result && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-muted-foreground text-center bg-muted/50 rounded-lg px-3 py-2"
            >
              🏳️ Solution revealed — progress not saved. Hit <strong>Reset</strong> to try again yourself!
            </motion.div>
          )}

          {/* Hints */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" /> Hints
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {challenge.hints.map((hint, i) => (
                <button
                  key={i}
                  onClick={() => setShowHint(showHint === i ? -1 : i)}
                  className="w-full text-left"
                >
                  <div className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {showHint >= i ? hint : `💡 Hint ${i + 1} — tap to reveal`}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Score gauge */}
                <Card>
                  <CardContent className="pt-6 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 12 }}
                    >
                      <div className="text-5xl font-bold font-mono-data text-foreground mb-1">
                        {result.score}
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">SCORE</div>
                      <div className="flex justify-center gap-1 mb-3">
                        {[1, 2, 3].map((s) => (
                          <motion.div
                            key={s}
                            initial={{ rotateY: 90 }}
                            animate={{ rotateY: 0 }}
                            transition={{ delay: s * 0.15 }}
                          >
                            <Star
                              className={`w-6 h-6 ${
                                s <= result.stars
                                  ? "fill-warning text-warning"
                                  : "text-muted-foreground/20"
                              }`}
                            />
                          </motion.div>
                        ))}
                      </div>
                      <div
                        className={`text-sm font-semibold ${
                          result.passed ? "text-success" : "text-destructive"
                        }`}
                      >
                        {result.passed ? "✅ Challenge Passed!" : "❌ Not quite — keep tuning"}
                      </div>
                    </motion.div>
                  </CardContent>
                </Card>

                {/* Celebration */}
                {celebrated && result.passed && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center text-2xl"
                  >
                    🎉🎊✨
                  </motion.div>
                )}

                {/* Constraint breakdown */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Constraint Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result.breakdown.map((b, i) => (
                      <ConstraintRow key={i} result={b} index={i} />
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="surface-elevated rounded-xl p-12 text-center"
              >
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Ready to solve?</h3>
                <p className="text-[11px] text-muted-foreground">
                  Adjust parameters on the left, then hit "Run Simulation" to see your score.
                </p>

                {/* Show constraints as checklist */}
                <div className="mt-6 text-left space-y-2">
                  {challenge.constraints.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-4 h-4 rounded-full border border-border" />
                      <span>
                        {c.label}{" "}
                        <span className="font-mono-data">
                          {c.operator} {c.target}
                          {c.unit}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <label className="text-xs text-muted-foreground" htmlFor={`param-${label.toLowerCase().replace(/\s+/g, "-")}`}>{label}</label>
        <span className="text-xs font-mono-data text-foreground">{format(value)}</span>
      </div>
      <Slider
        id={`param-${label.toLowerCase().replace(/\s+/g, "-")}`}
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function ConstraintRow({ result, index }: { result: ConstraintResult; index: number }) {
  const { constraint, actual, passed, score } = result;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="space-y-1"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {passed ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-destructive" />
          )}
          <span className="text-xs text-foreground">{constraint.label}</span>
        </div>
        <div className="text-xs font-mono-data">
          <span className={passed ? "text-success" : "text-destructive"}>
            {actual.toFixed(2)}
            {constraint.unit}
          </span>
          <span className="text-muted-foreground">
            {" "}
            {constraint.operator} {constraint.target}
            {constraint.unit}
          </span>
        </div>
      </div>
      <Progress value={score} className="h-1.5" />
    </motion.div>
  );
}
