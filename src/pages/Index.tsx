import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Beaker, FlaskConical, FileText } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <span className="text-lg font-bold tracking-tight text-foreground">INVARIANT STUDIO</span>
        <div className="flex items-center gap-4 text-sm">
          <button onClick={() => navigate("/docs")} className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
            Docs
          </button>
          <ThemeToggle />
          <button
            onClick={() => navigate("/beginner")}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Open App
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 pt-24 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-muted-foreground text-xs font-medium mb-8">
            AMM MECHANISM DESIGN PLATFORM
          </div>
        </motion.div>

        <motion.h1
          className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05] mb-6 text-foreground"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Design, simulate, and stress-test AMM invariants.
        </motion.h1>

        <motion.p
          className="text-lg text-muted-foreground max-w-2xl mb-10 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          A dual-mode platform for automated market maker mechanism engineering. From guided experimentation to formal invariant construction and Monte Carlo stress testing.
        </motion.p>

        <motion.div
          className="flex flex-wrap gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <button
            onClick={() => navigate("/beginner")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            <Beaker className="w-4 h-4" />
            Beginner Mode
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/advanced")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-border text-foreground font-medium hover:bg-secondary transition-colors"
          >
            <FlaskConical className="w-4 h-4" />
            Advanced Mode
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/docs")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-border text-muted-foreground font-medium hover:bg-secondary transition-colors"
          >
            <FileText className="w-4 h-4" />
            Documentation
          </button>
        </motion.div>
      </section>

      {/* Mode Cards */}
      <section className="max-w-4xl mx-auto px-8 pb-24">
        <div className="grid md:grid-cols-2 gap-6">
          <ModeCard
            title="Beginner Mode"
            description="Guided AMM experimentation with templates, visual risk dashboards, and step-by-step configuration. No math required."
            features={["AMM templates", "Risk dashboard", "Guided wizard", "Education tooltips"]}
            badge="Free"
            onClick={() => navigate("/beginner")}
            delay={0.4}
          />
          <ModeCard
            title="Advanced Mode"
            description="Formal invariant construction, Monte Carlo stress testing, arbitrage analysis, and stability checks."
            features={["Invariant editor", "Monte Carlo", "Arbitrage engine", "Stability analysis"]}
            badge="Pro"
            onClick={() => navigate("/advanced")}
            delay={0.5}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>Invariant Studio — AMM mechanism design platform</p>
      </footer>
    </div>
  );
};

const ModeCard = ({ title, description, features, badge, onClick, delay }: {
  title: string; description: string; features: string[]; badge: string; onClick: () => void; delay: number;
}) => (
  <motion.div
    className="surface-elevated rounded-xl p-6 cursor-pointer group hover:border-foreground/20 transition-all duration-300"
    onClick={onClick}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    whileHover={{ y: -2 }}
  >
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-border text-muted-foreground">
        {badge}
      </span>
    </div>
    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{description}</p>
    <div className="flex flex-wrap gap-2">
      {features.map(f => (
        <span key={f} className="text-[11px] font-mono px-2 py-1 rounded bg-secondary text-muted-foreground">
          {f}
        </span>
      ))}
    </div>
    <div className="mt-4 flex items-center gap-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
      Enter <ArrowRight className="w-3 h-3" />
    </div>
  </motion.div>
);

export default Index;
