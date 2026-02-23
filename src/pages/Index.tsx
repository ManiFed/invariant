import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Beaker, FileText, GraduationCap, Heart, Library, Lightbulb, FlaskConical } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { AsciiCurveHero } from "@/components/AsciiCurveHero";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.08, ease: [0.25, 0.4, 0.25, 1] },
  }),
};

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
      <section className="max-w-6xl mx-auto px-8 pt-12 pb-6">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <div className="space-y-6">
            <motion.span
              className="inline-block rounded-full border border-border px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground"
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={0}>
              AMM mechanism design platform
            </motion.span>

            <motion.h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] text-foreground"
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={1}>
              Design, simulate, and stress-test AMM invariants.
            </motion.h1>

            <motion.p
              className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed"
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={2}>
              A dual-mode workspace for engineering custom pricing curves, running Monte Carlo stress tests, and exploring the full design space of decentralized exchange mechanisms.
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-3 pt-1"
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={3}>
              <button
                onClick={() => navigate("/learn")}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                Start Learning
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => navigate("/beginner")}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
                Open Studio
              </button>
            </motion.div>
          </div>

          {/* ASCII curve — hidden on mobile, shown on lg+ */}
          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}>
            <div aria-hidden />
          </motion.div>
        </div>
      </section>

      {/* ASCII Curve Visualization */}
      <section className="max-w-6xl mx-auto px-8 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}>
          <AsciiCurveHero />
        </motion.div>
      </section>

      {/* Value Props Panel */}
      <section className="max-w-6xl mx-auto px-8 pb-10">
        <motion.div
          className="grid gap-px rounded-2xl border border-border bg-border overflow-hidden md:grid-cols-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.4 }}>
          <ValueProp
            label="Full invariant design"
            text="Define custom xy=k curves, concentrated liquidity ranges, and multi-asset invariants in a live editor." />
          <ValueProp
            label="Monte Carlo stress testing"
            text="Simulate thousands of market scenarios to find edge-case failures before deployment." />
          <ValueProp
            label="Beginner to advanced"
            text="Start with guided templates, graduate to a full-power invariant engineering workspace." />
        </motion.div>
      </section>

      {/* Navigation Grid */}
      <section className="max-w-6xl mx-auto px-8 pb-16">
        <motion.p
          className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}>
          Explore
        </motion.p>
        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}>

          <NavCard
            title="Teaching Lab"
            description="Guided course that teaches AMM mechanics from scratch"
            icon={<GraduationCap className="w-5 h-5" />}
            badge="Start Here"
            badgeColor="border-success/30 text-success"
            onClick={() => navigate("/learn")} />

          <NavCard
            title="Beginner Mode"
            description="Template-based experimentation with visual risk dashboards"
            icon={<Beaker className="w-5 h-5" />}
            onClick={() => navigate("/beginner")} />

          <NavCard
            title="Advanced Mode"
            description="Invariant editor, Monte Carlo, arbitrage engine, stability analysis"
            icon={<Lightbulb className="w-5 h-5" />}
            badge="Pro"
            onClick={() => navigate("/advanced")} />

          <NavCard
            title="Labs"
            description="Multi-asset pools and time-varying AMM mechanisms"
            icon={<FlaskConical className="w-5 h-5" />}
            badge="New"
            badgeColor="border-warning/30 text-warning"
            onClick={() => navigate("/labs")} />

          <NavCard
            title="AMM Library"
            description="Browse famous, featured, and community-made AMM designs"
            icon={<Library className="w-5 h-5" />}
            onClick={() => navigate("/library")} />

          <NavCard
            title="Documentation"
            description="Platform docs, AMM theory, and reference material"
            icon={<FileText className="w-5 h-5" />}
            onClick={() => navigate("/docs")} />
        </motion.div>
      </section>

      {/* Support */}
      <section className="max-w-6xl mx-auto px-8 pb-12">
        <div className="rounded-2xl border border-border p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Support the project</h3>
            <p className="text-xs text-muted-foreground">Free and open-source. Consider supporting continued development.</p>
          </div>
          <a
            href="https://buy.stripe.com/test_placeholder"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity shrink-0">
            <Heart className="w-3.5 h-3.5" />
            Support
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>Invariant Studio — AMM mechanism design platform</p>
      </footer>
    </div>
  );
};

/* ── Sub-components ── */

const ValueProp = ({ label, text }: { label: string; text: string }) => (
  <div className="bg-background p-6">
    <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
    <p className="text-sm sm:text-base text-foreground leading-relaxed">{text}</p>
  </div>
);

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
    whileHover={{ y: -2 }}>
    <div className="flex items-center justify-between mb-3">
      <div className="text-foreground">{icon}</div>
      {badge && (
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeColor || "border-foreground/20 text-foreground/60"}`}>
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
