import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Beaker, FlaskConical, FileText, GraduationCap, Heart, BookOpen } from "lucide-react";
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
          <button onClick={() => navigate("/library")} className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
            Library
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
            Beginner Mode
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/advanced")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-border text-foreground font-medium hover:bg-secondary transition-colors"
          >
            Advanced Mode
          </button>
          <button
            onClick={() => navigate("/docs")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-border text-muted-foreground font-medium hover:bg-secondary transition-colors"
          >
            Documentation
          </button>
        </motion.div>
      </section>

      {/* What is an AMM? */}
      <section className="max-w-4xl mx-auto px-8 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-bold text-foreground mb-3">What is an Automated Market Maker?</h2>
          <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl">
            An AMM is a smart contract that holds two tokens and uses a mathematical formula to price trades between them. No order book, no matching engine — just math. Anyone can deposit tokens to provide liquidity, and anyone can trade against the pool.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { title: "Constant Product", desc: "The formula x × y = k ensures trades always have a price. As one reserve decreases, the other must increase." },
              { title: "Price Discovery", desc: "Prices emerge from reserve ratios. Arbitrageurs keep pool prices aligned with external markets." },
              { title: "LP Revenue", desc: "Liquidity providers earn trading fees. Every swap pays a small fee that accrues to the pool." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="surface-elevated rounded-xl p-5"
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Key Concepts */}
      <section className="max-w-4xl mx-auto px-8 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-bold text-foreground mb-3">Key Concepts You'll Explore</h2>
          <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl">
            Understanding these mechanics is essential for designing, deploying, or interacting with any DeFi protocol.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { title: "Slippage", desc: "Why larger trades cost more. The curve gets steeper as you move further, making each additional unit more expensive." },
              { title: "Impermanent Loss", desc: "How automatic rebalancing causes LPs to underperform vs simply holding. IL ≈ 5.7% when price doubles." },
              { title: "Arbitrage", desc: "Profit-seeking traders who keep AMM prices aligned with external markets — at the LP's expense." },
              { title: "Fee Revenue", desc: "Trading fees compensate LPs for impermanent loss. The tradeoff: higher fees discourage volume." },
              { title: "Volatility Risk", desc: "Price volatility drives both fee income and IL. Whether LPs profit depends on the fee tier vs volatility ratio." },
              { title: "Concentrated Liquidity", desc: "Capital efficiency through range-bound positions. Higher fee yield within range, zero fees outside it." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="p-4 rounded-xl bg-card border border-border"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <h3 className="text-sm font-semibold text-foreground mb-0.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Teaching Lab Banner */}
      <section className="max-w-4xl mx-auto px-8 pb-6">
        <motion.div
          className="surface-elevated rounded-xl p-6 cursor-pointer group hover:border-foreground/20 transition-all duration-300"
          onClick={() => navigate("/learn")}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          whileHover={{ y: -2 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-5 h-5 text-foreground" />
              <h3 className="text-lg font-semibold text-foreground">Interactive Teaching Lab</h3>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-success/30 text-success">NEW</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            New to AMMs? Start here. A guided course that teaches you everything from scratch — with quizzes at every step. The dashboard unlocks piece-by-piece as you learn each concept.
          </p>
          <div className="flex flex-wrap gap-2">
            {["What is an AMM?", "Reserves & Pools", "Price Curves", "Slippage", "Impermanent Loss", "Arbitrage", "Fees"].map(f => (
              <span key={f} className="text-[11px] font-mono px-2 py-1 rounded bg-secondary text-muted-foreground">{f}</span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            Start Learning <ArrowRight className="w-3 h-3" />
          </div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="max-w-4xl mx-auto px-8 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-bold text-foreground mb-8">How Invariant Studio Works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Choose Your Level", desc: "Start with the Teaching Lab for guided learning, Beginner Mode for template-based experimentation, or Advanced Mode for formal analysis." },
              { step: "02", title: "Configure & Simulate", desc: "Set pool parameters, execute trades, run auto-simulations with GBM price paths, and observe how reserves, prices, and LP value evolve." },
              { step: "03", title: "Analyze & Understand", desc: "Real-time metrics, contextual explanations, and prediction quizzes help you build deep intuition for AMM mechanics." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <span className="text-4xl font-bold text-border">{item.step}</span>
                <h3 className="text-sm font-semibold text-foreground mt-2 mb-1.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Mode Cards */}
      <section className="max-w-4xl mx-auto px-8 pb-16">
        <div className="grid md:grid-cols-2 gap-6">
          <ModeCard
            title="Beginner Mode"
            description="Guided AMM experimentation with templates, visual risk dashboards, and step-by-step configuration. No math required."
            features={["AMM templates", "Risk dashboard", "Guided wizard", "Education tooltips"]}
            badge="Free"
            onClick={() => navigate("/beginner")}
            delay={0}
          />
          <ModeCard
            title="Advanced Mode"
            description="Formal invariant construction, Monte Carlo stress testing, arbitrage analysis, and stability checks."
            features={["Invariant editor", "Monte Carlo", "Arbitrage engine", "Stability analysis"]}
            badge="Pro"
            onClick={() => navigate("/advanced")}
            delay={0.1}
          />
        </div>
      </section>

      {/* Support Banner */}
      <section className="max-w-4xl mx-auto px-8 pb-24">
        <motion.div
          className="rounded-xl border border-border p-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h3 className="text-sm font-semibold text-foreground mb-2">Support Invariant Studio</h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
            This project is free and open. If you find it useful for research, teaching, or building, consider supporting its development.
          </p>
          <a
            href="https://buy.stripe.com/test_placeholder"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Heart className="w-4 h-4" />
            Support the Project
          </a>
        </motion.div>
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
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
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
