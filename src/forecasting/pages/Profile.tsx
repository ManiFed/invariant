import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Target, TrendingDown, TrendingUp, AlertTriangle,
  BarChart3, Activity, Award, Shield,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { generateSampleForecasts } from "@/forecasting/lib/sample-data";
import {
  computeSkillProfile,
  calibrationBuckets,
  type SkillTier,
} from "@/forecasting/lib/scoring";
import { forecastRoute } from "@/forecasting/lib/routes";

const TIER_CONFIG: Record<SkillTier, { color: string; icon: React.ReactNode; minResolved: number; description: string }> = {
  Novice: {
    color: "text-muted-foreground",
    icon: <Shield className="w-5 h-5" />,
    minResolved: 0,
    description: "Just getting started. Complete more forecasts to advance.",
  },
  Apprentice: {
    color: "text-foreground",
    icon: <Shield className="w-5 h-5" />,
    minResolved: 10,
    description: "Building a track record. Focus on calibration fundamentals.",
  },
  Practitioner: {
    color: "text-warning",
    icon: <Award className="w-5 h-5" />,
    minResolved: 25,
    description: "Demonstrating consistent skill. Refine your updating habits.",
  },
  Expert: {
    color: "text-success",
    icon: <Award className="w-5 h-5" />,
    minResolved: 50,
    description: "Strong forecasting ability. Outperforming most forecasters.",
  },
  Superforecaster: {
    color: "text-success",
    icon: <Target className="w-5 h-5" />,
    minResolved: 100,
    description: "Elite accuracy. Consistently well-calibrated across domains.",
  },
};

const TIER_ORDER: SkillTier[] = ["Novice", "Apprentice", "Practitioner", "Expert", "Superforecaster"];

export default function Profile() {
  const navigate = useNavigate();

  const forecasts = useMemo(() => generateSampleForecasts(), []);
  const profile = useMemo(() => computeSkillProfile(forecasts), [forecasts]);

  const resolved = forecasts.filter((f) => f.resolved && f.outcome !== undefined);
  const calBuckets = useMemo(
    () =>
      calibrationBuckets(
        resolved.map((f) => ({ probability: f.probability, outcome: f.outcome! })),
      ),
    [resolved],
  );

  const tierConfig = TIER_CONFIG[profile.tier];
  const currentTierIdx = TIER_ORDER.indexOf(profile.tier);
  const nextTier = currentTierIdx < TIER_ORDER.length - 1 ? TIER_ORDER[currentTierIdx + 1] : null;
  const nextTierResolved = nextTier ? TIER_CONFIG[nextTier].minResolved : profile.resolvedForecasts;
  const tierProgress = nextTier
    ? Math.min(100, (profile.resolvedForecasts / nextTierResolved) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(forecastRoute())}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-foreground">Skill Profile</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Tier Card */}
          <div className="surface-elevated rounded-xl p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={`${tierConfig.color}`}>{tierConfig.icon}</div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{profile.tier}</h1>
                <p className="text-xs text-muted-foreground">{tierConfig.description}</p>
              </div>
            </div>

            {nextTier && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress to {nextTier}</span>
                  <span>
                    {profile.resolvedForecasts}/{nextTierResolved} resolved forecasts
                  </span>
                </div>
                <Progress value={tierProgress} className="h-2" />
              </div>
            )}

            {/* Tier ladder */}
            <div className="flex items-center gap-1 mt-4">
              {TIER_ORDER.map((tier, i) => (
                <div
                  key={tier}
                  className={`flex-1 h-1.5 rounded-full ${
                    i <= currentTierIdx ? "bg-foreground" : "bg-border"
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {TIER_ORDER.map((tier) => (
                <span
                  key={tier}
                  className={`text-[9px] ${
                    tier === profile.tier ? "text-foreground font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {tier}
                </span>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Avg Brier Score"
              value={profile.avgBrierScore.toFixed(3)}
              icon={<Target className="w-4 h-4" />}
              quality={profile.avgBrierScore < 0.15 ? "good" : profile.avgBrierScore < 0.25 ? "neutral" : "bad"}
              description="Lower is better. 0.25 = no skill."
            />
            <StatCard
              label="Calibration Error"
              value={(profile.calibrationError * 100).toFixed(1) + "%"}
              icon={<Activity className="w-4 h-4" />}
              quality={profile.calibrationError < 0.05 ? "good" : profile.calibrationError < 0.1 ? "neutral" : "bad"}
              description="How well predictions match reality."
            />
            <StatCard
              label="Overconfidence"
              value={(profile.overconfidenceIndex * 100).toFixed(0) + "%"}
              icon={<AlertTriangle className="w-4 h-4" />}
              quality={profile.overconfidenceIndex < 0.15 ? "good" : profile.overconfidenceIndex < 0.3 ? "neutral" : "bad"}
              description="% of confident-and-wrong forecasts."
            />
            <StatCard
              label="Update Responsiveness"
              value={(profile.updateResponsiveness * 100).toFixed(1) + "pp"}
              icon={<TrendingUp className="w-4 h-4" />}
              quality="neutral"
              description="Avg magnitude of probability revisions."
            />
          </div>

          {/* Resolved count */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="surface-elevated rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Resolved Forecasts</span>
              </div>
              <span className="font-mono-data text-3xl font-bold text-foreground">
                {profile.resolvedForecasts}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                of {profile.totalForecasts} total
              </span>
            </div>
            <div className="surface-elevated rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Brier Score Trend</span>
              </div>
              <div className="flex items-center gap-2">
                {profile.brierHistory.length >= 2 && (
                  <>
                    {profile.brierHistory[profile.brierHistory.length - 1] <
                    profile.brierHistory[0] ? (
                      <TrendingDown className="w-5 h-5 text-success" />
                    ) : (
                      <TrendingUp className="w-5 h-5 text-destructive" />
                    )}
                    <span className="text-sm text-foreground font-medium">
                      {profile.brierHistory[profile.brierHistory.length - 1] < profile.brierHistory[0]
                        ? "Improving"
                        : "Needs work"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Calibration Curve */}
          <div className="surface-elevated rounded-xl p-6 mb-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Calibration Curve</h2>
            <p className="text-xs text-muted-foreground mb-4">
              The diagonal line represents perfect calibration. Points above the line indicate
              underconfidence; points below indicate overconfidence.
            </p>
            <div className="space-y-3">
              {calBuckets.map((bucket, i) => {
                const diff = bucket.actual - bucket.predicted;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="font-mono-data text-xs text-muted-foreground w-12 text-right shrink-0">
                      {Math.round(bucket.predicted * 100)}%
                    </span>
                    <div className="flex-1 relative h-7">
                      {/* Background bar (predicted) */}
                      <div className="absolute inset-0 bg-secondary rounded" />
                      {/* Perfect calibration marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/30"
                        style={{ left: `${bucket.predicted * 100}%` }}
                      />
                      {/* Actual bar */}
                      <div
                        className={`absolute inset-y-0 left-0 rounded ${
                          Math.abs(diff) < 0.08
                            ? "bg-success/50"
                            : diff > 0
                              ? "bg-warning/50"
                              : "bg-destructive/50"
                        }`}
                        style={{ width: `${Math.min(100, bucket.actual * 100)}%` }}
                      />
                      {/* Predicted label */}
                      <span className="absolute inset-y-0 flex items-center text-[10px] font-mono-data text-foreground px-2">
                        Actual: {Math.round(bucket.actual * 100)}%
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 shrink-0">
                      n={bucket.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Brier Score History */}
          <div className="surface-elevated rounded-xl p-6 mb-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Score History</h2>
            <div className="flex items-end gap-1 h-32">
              {profile.brierHistory.map((score, i) => {
                const height = Math.max(5, (score / 0.5) * 100);
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center justify-end gap-1"
                  >
                    <span className="text-[8px] font-mono-data text-muted-foreground">
                      {score.toFixed(2)}
                    </span>
                    <div
                      className={`w-full rounded-t ${
                        score < 0.15
                          ? "bg-success/60"
                          : score < 0.25
                            ? "bg-warning/60"
                            : "bg-destructive/60"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[9px] text-muted-foreground">
              <span>Oldest</span>
              <span>Most recent</span>
            </div>
          </div>

          {/* Diagnostics */}
          <div className="surface-elevated rounded-xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Diagnostic Summary</h2>
            <div className="space-y-3">
              <DiagnosticRow
                label="Overconfidence"
                detected={profile.overconfidenceIndex > 0.2}
                message={
                  profile.overconfidenceIndex > 0.2
                    ? "You tend to assign extreme probabilities that don't match outcomes. Practice widening your uncertainty ranges."
                    : "Your confidence levels are reasonably well-calibrated."
                }
              />
              <DiagnosticRow
                label="Under-updating"
                detected={profile.updateResponsiveness < 0.05}
                message={
                  profile.updateResponsiveness < 0.05
                    ? "You rarely revise your forecasts. New evidence should shift your beliefs. Practice the Update drills."
                    : "You show healthy revision behavior when new information arrives."
                }
              />
              <DiagnosticRow
                label="Base Rate Neglect"
                detected={profile.calibrationError > 0.1}
                message={
                  profile.calibrationError > 0.1
                    ? "Your predictions are systematically off from actual frequencies. Spend more time with Base Rate drills."
                    : "Your predictions align well with observed frequencies."
                }
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  quality,
  description,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  quality: "good" | "neutral" | "bad";
  description: string;
}) {
  return (
    <div className="surface-elevated rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <span
        className={`font-mono-data text-xl font-bold block ${
          quality === "good"
            ? "text-success"
            : quality === "bad"
              ? "text-destructive"
              : "text-foreground"
        }`}
      >
        {value}
      </span>
      <span className="text-[9px] text-muted-foreground">{description}</span>
    </div>
  );
}

function DiagnosticRow({
  label,
  detected,
  message,
}: {
  label: string;
  detected: boolean;
  message: string;
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        detected
          ? "border-warning/30 bg-warning/5"
          : "border-success/30 bg-success/5"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {detected ? (
          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
        ) : (
          <Badge variant="outline" className="text-[9px] border-success/30 text-success">
            OK
          </Badge>
        )}
        <span className="text-xs font-semibold text-foreground">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
