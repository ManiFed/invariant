import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Beaker, FlaskConical, Zap, Shield, TrendingUp, Code2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />

      {/* Glow orb */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
        style={{ background: "radial-gradient(circle, hsl(185 80% 55%), transparent)" }} />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center glow-primary-sm">
              <FlaskConical className="w-4 h-4 text-primary" />
            </div>
            <span className="text-lg font-semibold text-foreground tracking-tight">Invariant Studio</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span className="hidden sm:inline cursor-pointer hover:text-foreground transition-colors">Docs</span>
            <span className="hidden sm:inline cursor-pointer hover:text-foreground transition-colors">Pricing</span>
            <button className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors">
              Launch App
            </button>
          </div>
        </nav>

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-8 pt-20 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-8">
              <Zap className="w-3 h-3" />
              Design · Simulate · Deploy
            </div>
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05] mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <span className="text-foreground">Engineer your </span>
            <span className="text-gradient-primary">AMM invariant</span>
          </motion.h1>

          <motion.p
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            A dual-mode platform for designing, simulating, and stress-testing automated market maker mechanisms. From guided experimentation to formal invariant construction.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <button
              onClick={() => navigate("/beginner")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:brightness-110 transition-all glow-primary"
            >
              <Beaker className="w-4 h-4" />
              Beginner Mode
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("/advanced")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors border border-border"
            >
              <Code2 className="w-4 h-4" />
              Advanced Mode
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </section>

        {/* Mode Cards */}
        <section className="max-w-5xl mx-auto px-8 pb-24">
          <div className="grid md:grid-cols-2 gap-6">
            <ModeCard
              title="Beginner Mode"
              description="Guided AMM experimentation with templates, scenario simulation, and intuitive risk dashboards. No math required."
              features={["AMM templates", "Scenario simulator", "Range assistant", "Risk dashboard"]}
              icon={<Beaker className="w-5 h-5" />}
              badge="Free"
              onClick={() => navigate("/beginner")}
              delay={0.4}
            />
            <ModeCard
              title="Advanced Mode"
              description="Formal invariant construction, Monte Carlo stress testing, arbitrage analysis, and contract export."
              features={["Invariant editor", "Monte Carlo engine", "Arbitrage simulator", "Contract export"]}
              icon={<FlaskConical className="w-5 h-5" />}
              badge="Pro"
              onClick={() => navigate("/advanced")}
              delay={0.5}
            />
          </div>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-8 pb-24">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl font-bold text-foreground mb-3">Built for precision</h2>
            <p className="text-muted-foreground">Every tool you need to engineer market mechanisms</p>
          </motion.div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: <TrendingUp className="w-4 h-4" />, title: "Real-time simulation", desc: "Sub-3s scenario computation" },
              { icon: <Shield className="w-4 h-4" />, title: "Stress testing", desc: "10,000 Monte Carlo paths in <15s" },
              { icon: <Code2 className="w-4 h-4" />, title: "Contract export", desc: "Solidity templates with test suites" },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                className="surface-elevated rounded-lg p-5"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-3">
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
          <p>Invariant Studio — AMM mechanism design platform</p>
        </footer>
      </div>
    </div>
  );
};

const ModeCard = ({ title, description, features, icon, badge, onClick, delay }: {
  title: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  badge: string;
  onClick: () => void;
  delay: number;
}) => (
  <motion.div
    className="surface-elevated rounded-xl p-6 cursor-pointer group hover:border-glow transition-all duration-300"
    onClick={onClick}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    whileHover={{ y: -2 }}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </div>
      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
        {badge}
      </span>
    </div>
    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{description}</p>
    <div className="flex flex-wrap gap-2">
      {features.map(f => (
        <span key={f} className="text-[11px] font-mono px-2 py-1 rounded bg-muted text-muted-foreground">
          {f}
        </span>
      ))}
    </div>
    <div className="mt-4 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
      Enter <ArrowRight className="w-3 h-3" />
    </div>
  </motion.div>
);

export default Index;
