import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Clock, TrendingUp, Users, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, BarChart3,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SAMPLE_QUESTIONS, FORECAST_CATEGORIES, generateSampleForecasts } from "@/forecasting/lib/sample-data";
import { brierScore, logScore } from "@/forecasting/lib/scoring";
import type { ForecastQuestion } from "@/forecasting/lib/sample-data";
import { forecastRoute } from "@/forecasting/lib/routes";

interface UserForecast {
  questionId: string;
  probability: number;
  revisions: { probability: number; timestamp: string }[];
  createdAt: string;
}

export default function Arena() {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [userForecasts, setUserForecasts] = useState<Map<string, UserForecast>>(new Map());
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [draftProbability, setDraftProbability] = useState(50);

  const sampleResolved = generateSampleForecasts();

  const filteredQuestions = categoryFilter === "All"
    ? SAMPLE_QUESTIONS
    : SAMPLE_QUESTIONS.filter((q) => q.category === categoryFilter);

  const handleSubmitForecast = useCallback(
    (question: ForecastQuestion) => {
      const prob = draftProbability / 100;
      const existing = userForecasts.get(question.id);
      const now = new Date().toISOString();

      if (existing) {
        const updated: UserForecast = {
          ...existing,
          probability: prob,
          revisions: [...existing.revisions, { probability: prob, timestamp: now }],
        };
        setUserForecasts((prev) => new Map(prev).set(question.id, updated));
      } else {
        const newForecast: UserForecast = {
          questionId: question.id,
          probability: prob,
          revisions: [{ probability: prob, timestamp: now }],
          createdAt: now,
        };
        setUserForecasts((prev) => new Map(prev).set(question.id, newForecast));
      }
      setExpandedQuestion(null);
    },
    [draftProbability, userForecasts],
  );

  const toggleQuestion = useCallback(
    (id: string) => {
      if (expandedQuestion === id) {
        setExpandedQuestion(null);
      } else {
        setExpandedQuestion(id);
        const existing = userForecasts.get(id);
        setDraftProbability(existing ? Math.round(existing.probability * 100) : 50);
      }
    },
    [expandedQuestion, userForecasts],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(forecastRoute())}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-foreground">Forecasting Arena</span>
            <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
              {userForecasts.size} active forecasts
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <Tabs defaultValue="active">
          <TabsList className="mb-6">
            <TabsTrigger value="active">Active Questions</TabsTrigger>
            <TabsTrigger value="my-forecasts">My Forecasts</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
          </TabsList>

          {/* Active Questions Tab */}
          <TabsContent value="active">
            {/* Category Filter */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
              <button
                onClick={() => setCategoryFilter("All")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  categoryFilter === "All"
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {FORECAST_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    categoryFilter === cat
                      ? "bg-foreground text-background"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              {filteredQuestions.map((q, i) => {
                const isExpanded = expandedQuestion === q.id;
                const userFc = userForecasts.get(q.id);

                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="surface-elevated rounded-xl overflow-hidden"
                  >
                    {/* Question Header */}
                    <button
                      onClick={() => toggleQuestion(q.id)}
                      className="w-full text-left p-5 flex items-start gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {q.category}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Resolves {new Date(q.resolutionDate).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-sm font-medium text-foreground leading-snug">
                          {q.question}
                        </h3>
                        <div className="flex items-center gap-4 mt-2">
                          {q.crowdMedian !== undefined && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              Crowd: {Math.round(q.crowdMedian * 100)}%
                            </span>
                          )}
                          {userFc && (
                            <span className="text-[11px] text-foreground flex items-center gap-1 font-medium">
                              <TrendingUp className="w-3 h-3" />
                              You: {Math.round(userFc.probability * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-muted-foreground shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Forecast Input */}
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-border px-5 pb-5 pt-4"
                      >
                        <p className="text-xs text-muted-foreground mb-4">
                          {q.description}
                        </p>
                        <div className="bg-card rounded-lg p-4 border border-border mb-4">
                          <div className="flex items-center gap-2 mb-1 text-[10px] text-muted-foreground">
                            <AlertCircle className="w-3 h-3" />
                            Resolution Criteria
                          </div>
                          <p className="text-xs text-foreground">{q.resolutionCriteria}</p>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Your probability:</span>
                            <span className="font-mono-data text-2xl font-bold text-foreground">
                              {draftProbability}%
                            </span>
                          </div>
                          <Slider
                            value={[draftProbability]}
                            onValueChange={([v]) => setDraftProbability(v)}
                            min={1}
                            max={99}
                            step={1}
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Very unlikely</span>
                            <span>Toss-up</span>
                            <span>Very likely</span>
                          </div>

                          {/* Probability meaning helper */}
                          <div className="text-[11px] text-muted-foreground bg-card rounded p-2 border border-border">
                            {draftProbability <= 10
                              ? "≈ 1 in 10 or less. You think this is quite unlikely."
                              : draftProbability <= 25
                                ? "≈ 1 in 4. Unlikely, but wouldn't be shocking."
                                : draftProbability <= 40
                                  ? "Unlikely but plausible. More likely to not happen."
                                  : draftProbability <= 60
                                    ? "Close to a coin flip. Genuine uncertainty."
                                    : draftProbability <= 75
                                      ? "More likely than not. You lean yes."
                                      : draftProbability <= 90
                                        ? "Quite likely. You'd be somewhat surprised if it didn't happen."
                                        : "Very confident this will happen. Surprised if wrong."}
                          </div>

                          <Button onClick={() => handleSubmitForecast(q)} className="w-full">
                            {userFc ? "Update Forecast" : "Submit Forecast"}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* My Forecasts Tab */}
          <TabsContent value="my-forecasts">
            {userForecasts.size === 0 ? (
              <div className="text-center py-16">
                <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No forecasts yet. Start predicting in the Active Questions tab.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from(userForecasts.entries()).map(([qId, fc]) => {
                  const question = SAMPLE_QUESTIONS.find((q) => q.id === qId);
                  if (!question) return null;
                  return (
                    <div key={qId} className="surface-elevated rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="text-[10px]">{question.category}</Badge>
                      </div>
                      <h3 className="text-sm font-medium text-foreground mb-2">{question.question}</h3>
                      <div className="flex items-center gap-6">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Your forecast</span>
                          <span className="font-mono-data text-lg font-bold text-foreground">
                            {Math.round(fc.probability * 100)}%
                          </span>
                        </div>
                        {question.crowdMedian !== undefined && (
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Crowd median</span>
                            <span className="font-mono-data text-lg font-bold text-muted-foreground">
                              {Math.round(question.crowdMedian * 100)}%
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Revisions</span>
                          <span className="font-mono-data text-lg font-bold text-muted-foreground">
                            {fc.revisions.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Resolved Tab */}
          <TabsContent value="resolved">
            <div className="space-y-3">
              {sampleResolved.map((f) => {
                const brier = brierScore(f.probability, f.outcome!);
                const log = logScore(f.probability, f.outcome!);
                return (
                  <div key={f.id} className="surface-elevated rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className="text-[10px]">{f.category}</Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          f.outcome ? "border-success/30 text-success" : "border-destructive/30 text-destructive"
                        }`}
                      >
                        {f.outcome ? "Resolved YES" : "Resolved NO"}
                      </Badge>
                    </div>
                    <h3 className="text-sm font-medium text-foreground mb-2">{f.question}</h3>
                    <div className="flex items-center gap-6">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Forecast</span>
                        <span className="font-mono-data text-lg font-bold text-foreground">
                          {Math.round(f.probability * 100)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Brier Score</span>
                        <span className={`font-mono-data text-lg font-bold ${brier < 0.15 ? "text-success" : brier < 0.25 ? "text-warning" : "text-destructive"}`}>
                          {brier.toFixed(3)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Log Score</span>
                        <span className="font-mono-data text-lg font-bold text-muted-foreground">
                          {log.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Outcome</span>
                        <span className="text-sm">
                          {f.outcome ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-destructive" />
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
