import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Target, BookOpen, Crosshair, BarChart3, Dumbbell, Brain } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { AsciiCalibrationHero } from "@/forecasting/components/AsciiCalibrationHero";
import { forecastRoute } from "@/forecasting/lib/routes";

const ForecastIndex = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <span className="text-lg font-bold tracking-tight text-foreground">FORECAST LAB</span>
        <ThemeToggle />
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 pt-16 pb-6">
        <motion.h1
          className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05] mb-6 text-foreground"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
        >
          Train your mind to predict the future accurately.
        </motion.h1>

        <motion.p
          className="text-lg text-muted-foreground max-w-2xl mb-8 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
        >
          A deliberate practice environment for probabilistic reasoning.
          Not opinionated. Not confident. Accurate.
        </motion.p>
      </section>

      {/* ASCII Calibration Curve */}
      <section className="max-w-4xl mx-auto px-8 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24 }}
        >
          <AsciiCalibrationHero />
        </motion.div>
      </section>

      {/* Navigation Grid */}
      <section className="max-w-4xl mx-auto px-8 pb-16">
        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <NavCard
            title="Lessons"
            description="Interactive scenario-based lessons on probabilistic reasoning"
            icon={<BookOpen className="w-5 h-5" />}
            badge="Start Here"
            badgeColor="border-success/30 text-success"
            onClick={() => navigate(forecastRoute("/lessons"))}
          />

          <NavCard
            title="Forecasting Arena"
            description="Make predictions on real questions, track your accuracy over time"
            icon={<Target className="w-5 h-5" />}
            onClick={() => navigate(forecastRoute("/arena"))}
          />

          <NavCard
            title="Practice Drills"
            description="Base rates, updating, calibration, and decomposition exercises"
            icon={<Dumbbell className="w-5 h-5" />}
            badge="Core"
            badgeColor="border-warning/30 text-warning"
            onClick={() => navigate(forecastRoute("/drills"))}
          />

          <NavCard
            title="Skill Profile"
            description="Brier score, calibration error, overconfidence index, and progression"
            icon={<BarChart3 className="w-5 h-5" />}
            onClick={() => navigate(forecastRoute("/profile"))}
          />

          <NavCard
            title="Calibration Test"
            description="Rapid-fire factual questions to measure your calibration curve"
            icon={<Crosshair className="w-5 h-5" />}
            onClick={() => navigate(`${forecastRoute("/drills")}?tab=calibration`)}
          />

          <NavCard
            title="How It Works"
            description="Scoring methodology, Brier scores, log scores, and skill tiers"
            icon={<Brain className="w-5 h-5" />}
            onClick={() => navigate(`${forecastRoute("/lessons")}?module=5`)}
          />
        </motion.div>
      </section>

      {/* Core Skills Section */}
      <section className="max-w-4xl mx-auto px-8 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.36 }}
        >
          <h2 className="text-xl font-bold text-foreground mb-6">Core Skills You Will Train</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "Assigning numerical probabilities to uncertain events",
              "Understanding and applying base rates",
              "Updating beliefs when new evidence appears",
              "Breaking complex questions into components",
              "Distinguishing signal from noise",
              "Calibrating confidence levels accurately",
              "Avoiding cognitive distortions in forecasting",
            ].map((skill, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50"
              >
                <span className="font-mono-data text-xs text-muted-foreground mt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm text-foreground">{skill}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>
          Forecast Lab — A deliberate practice environment for probabilistic reasoning
        </p>
      </footer>
    </div>
  );
};

const NavCard = ({
  title,
  description,
  icon,
  badge,
  badgeColor,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  onClick: () => void;
}) => (
  <motion.div
    className="surface-elevated rounded-xl p-5 cursor-pointer group hover:border-foreground/20 transition-all duration-300"
    onClick={onClick}
    whileHover={{ y: -2 }}
  >
    <div className="flex items-center justify-between mb-3">
      <div className="text-foreground">{icon}</div>
      {badge && (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor || "border-border text-muted-foreground"}`}>
          {badge}
        </span>
      )}
    </div>
    <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
    <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
    <div className="mt-3 flex items-center gap-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
      Enter <ArrowRight className="w-3 h-3" />
    </div>
  </motion.div>
);

export default ForecastIndex;
