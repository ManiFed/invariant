import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Beaker, FlaskConical, FileText, GraduationCap, Heart, BookOpen, Library } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <span className="text-lg font-bold tracking-tight text-foreground">INVARIANT STUDIO</span>
        <ThemeToggle />
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 pt-16 pb-10">
        <motion.h1
          className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05] mb-6 text-foreground"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Design, simulate, and stress-test AMM invariants.
        </motion.h1>

        <motion.p
          className="text-lg text-muted-foreground max-w-2xl mb-8 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          A dual-mode platform for automated market maker mechanism engineering.
        </motion.p>
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
            title="Teaching Lab"
            description="Guided course that teaches AMM mechanics from scratch"
            icon={<GraduationCap className="w-5 h-5" />}
            badge="Start Here"
            badgeColor="border-success/30 text-success"
            onClick={() => navigate("/learn")}
          />
          <NavCard
            title="Beginner Mode"
            description="Template-based experimentation with visual risk dashboards"
            icon={<Beaker className="w-5 h-5" />}
            onClick={() => navigate("/beginner")}
          />
          <NavCard
            title="Advanced Mode"
            description="Invariant editor, Monte Carlo, arbitrage engine, stability analysis"
            icon={<FlaskConical className="w-5 h-5" />}
            badge="Pro"
            onClick={() => navigate("/advanced")}
          />
          <NavCard
            title="AMM Library"
            description="Browse famous, featured, and community-made AMM designs"
            icon={<Library className="w-5 h-5" />}
            onClick={() => navigate("/library")}
          />
          <NavCard
            title="Documentation"
            description="Platform docs, AMM theory, and reference material"
            icon={<FileText className="w-5 h-5" />}
            onClick={() => navigate("/docs")}
          />
          <div className="rounded-xl border border-border p-5 flex flex-col items-center justify-center text-center">
            <h3 className="text-sm font-semibold text-foreground mb-2">Support the Project</h3>
            <p className="text-[11px] text-muted-foreground mb-3">Free and open. Consider supporting development.</p>
            <a
              href="https://buy.stripe.com/test_placeholder"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Heart className="w-3.5 h-3.5" />
              Support
            </a>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>Invariant Studio — AMM mechanism design platform</p>
      </footer>
    </div>
  );
};

const NavCard = ({ title, description, icon, badge, badgeColor, onClick }: {
  title: string; description: string; icon: React.ReactNode; badge?: string; badgeColor?: string; onClick: () => void;
}) => (
  <motion.div
    className="surface-elevated rounded-xl p-5 cursor-pointer group hover:border-foreground/20 transition-all duration-300"
    onClick={onClick}
    whileHover={{ y: -2 }}
  >
    <div className="flex items-center justify-between mb-3">
      <div className="text-foreground">{icon}</div>
      {badge && (
        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${badgeColor || "border-border text-muted-foreground"}`}>
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

export default Index;
