import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FlaskConical, Lock, Code2, Cpu, BarChart3, Search, Shield } from "lucide-react";

const features = [
  { icon: <Code2 className="w-4 h-4" />, title: "Invariant Editor", desc: "Symbolic expression editor with multi-asset support and constraint declarations" },
  { icon: <Cpu className="w-4 h-4" />, title: "Monte Carlo Engine", desc: "10,000+ path simulations with configurable volatility, drift, and jump parameters" },
  { icon: <BarChart3 className="w-4 h-4" />, title: "Arbitrage Flow Engine", desc: "Toxic flow analysis, latency arbitrage, and fee capture efficiency metrics" },
  { icon: <Search className="w-4 h-4" />, title: "Liquidity Analyzer", desc: "Capital efficiency ratios, slippage curvature integrals, and side-by-side comparison" },
  { icon: <Shield className="w-4 h-4" />, title: "Stability Analysis", desc: "Insolvency detection, path dependence, fee distortion, and reflexivity loops" },
  { icon: <FlaskConical className="w-4 h-4" />, title: "Contract Export", desc: "Solidity templates, parameter configs, gas simulation, and test suites" },
];

const AdvancedMode = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-pattern opacity-20" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-10 blur-[100px]"
        style={{ background: "radial-gradient(circle, hsl(260, 60%, 60%), transparent)" }} />
      
      <div className="relative z-10">
        <header className="border-b border-border px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-6 h-6 rounded bg-chart-purple/20 flex items-center justify-center">
            <FlaskConical className="w-3.5 h-3.5 text-chart-purple" />
          </div>
          <span className="text-sm font-semibold text-foreground">Advanced Mode</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-chart-purple/10 text-chart-purple border border-chart-purple/20">PRO</span>
        </header>

        <div className="max-w-4xl mx-auto px-8 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-chart-purple/10 border border-chart-purple/20 flex items-center justify-center mx-auto mb-6">
              <Lock className="w-7 h-7 text-chart-purple" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Advanced Mode
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Full invariant engineering, Monte Carlo stress testing, arbitrage analysis, and deployable contract export. Built for quantitative researchers and protocol architects.
            </p>
          </motion.div>

          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="surface-elevated rounded-xl p-5 text-left"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
              >
                <div className="w-8 h-8 rounded-lg bg-chart-purple/10 flex items-center justify-center text-chart-purple mb-3">
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <button className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-chart-purple/10 text-chart-purple border border-chart-purple/20 font-medium text-sm hover:bg-chart-purple/20 transition-colors">
              <Lock className="w-4 h-4" />
              Coming Soon — Join Waitlist
            </button>
            <p className="text-xs text-muted-foreground mt-4">Advanced mode is under active development</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedMode;
