import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Compass, Dna, Layers, History } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const labs = [
  { route: "/labs/discovery", name: "Invariant Atlas", icon: Compass, color: "chart-3",
    desc: "Continuous global discovery with user-defined experiment runs, evolutionary searches, and configurable objectives.",
    bullets: ["64-bin liquidity representation", "Multi-objective scoring", "Pareto frontier tracking"] },
  { route: "/labs/strategy", name: "Liquidity Strategy Lab", icon: Layers, color: "chart-4",
    desc: "Design, backtest, and compare LP strategies over Monte Carlo price simulations against passive LPing.",
    bullets: ["4 strategy presets", "Up to 5k MC paths", "Fee vs IL attribution"] },
  { route: "/labs/dna", name: "AMM DNA Visualizer", icon: Dna, color: "chart-5",
    desc: "Radial genome rings, feature radar arcs, and lineage trees tracing evolutionary ancestry across generations.",
    bullets: ["64-bin genome fingerprint", "Side-by-side comparison", "Lineage tree exploration"] },
  { route: "/labs/replay", name: "Live Market Replay", icon: History, color: "chart-1",
    desc: "Replay historical market scenarios — Black Thursday, LUNA collapse, DeFi Summer — through any library AMM.",
    bullets: ["8 curated scenarios", "Animated playback", "Drawdown detection"] },
  { route: "/labs/mev", name: "MEV Impact Analyzer", icon: Shield, color: "destructive",
    desc: "Simulate sandwich attacks, backrun arbitrage, and JIT liquidity. Quantify value leakage from any design.",
    bullets: ["Protection Score 0-100", "Value flow breakdown", "Configurable attacker budget"] },
];

const Labs = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">LABS</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-warning/30 text-warning">EXPERIMENTAL</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="max-w-6xl mx-auto px-6 pt-12 pb-10">
        <motion.h1
          className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-3 text-foreground"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Experimental AMM Labs
        </motion.h1>
        <motion.p
          className="text-base text-muted-foreground max-w-xl mb-10 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Not guaranteed to work. Quite cool.
        </motion.p>

        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {labs.map((lab, i) => {
            const Icon = lab.icon;
            return (
              <motion.div
                key={lab.route}
                className="surface-elevated rounded-2xl p-5 cursor-pointer group hover:border-foreground/20 transition-all flex flex-col"
                onClick={() => navigate(lab.route)}
                whileHover={{ y: -3 }}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.04 }}
              >
                <div className={`w-10 h-10 rounded-xl bg-${lab.color}/10 border border-${lab.color}/20 flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 text-${lab.color}`} />
                </div>
                <h2 className="text-sm font-bold text-foreground mb-1.5">{lab.name}</h2>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3 flex-1">{lab.desc}</p>
                <ul className="space-y-0.5 text-[10px] text-muted-foreground mb-3">
                  {lab.bullets.map(b => <li key={b}>• {b}</li>)}
                </ul>
                <div className="flex items-center gap-1 text-[10px] text-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
                  Enter <ArrowRight className="w-3 h-3" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
};

export default Labs;
