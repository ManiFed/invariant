import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Boxes, Clock, Compass, Layers } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const Labs = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground transition-colors">

            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">LABS</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-warning/30 text-warning">
            EXPERIMENTAL
          </span>
        </div>
        <ThemeToggle />
      </header>

      <div className="max-w-3xl mx-auto px-8 pt-16 pb-10">
        <motion.h1
          className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-4 text-foreground"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}>

          Experimental AMM Labs
        </motion.h1>
        <motion.p
          className="text-base text-muted-foreground max-w-xl mb-12 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}>

          Not guaranteed to work. Quite cool.
        </motion.p>

        {/* Featured: Discovery Atlas */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}>

          <motion.div
            className="surface-elevated rounded-2xl p-6 cursor-pointer group hover:border-foreground/20 transition-all border-l-4 border-l-chart-3"
            onClick={() => navigate("/labs/discovery")}
            whileHover={{ y: -3 }}>

            <div className="flex items-start gap-4">
              


              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-lg font-bold text-foreground">Invariant Atlas</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  Continuous evolutionary search over liquidity geometries. The engine generates, evaluates, and
                  archives AMM designs across stochastic market regimes, exposing the geometric structure of the
                  explored design space.
                </p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <ul className="space-y-1 text-[11px] text-muted-foreground">
                    <li>• Discrete liquidity density (64 bins)</li>
                    <li>• 3 market regimes (GBM + jumps)</li>
                    <li>• Monte Carlo evaluation paths</li>
                  </ul>
                  <ul className="space-y-1 text-[11px] text-muted-foreground">
                    <li>• Evolutionary population search</li>
                    <li>• Multi-dimensional metric vectors</li>
                    <li>• Cross-path stability estimates</li>
                  </ul>
                  <ul className="space-y-1 text-[11px] text-muted-foreground">
                    <li>• Live champion dashboard</li>
                    <li>• 2D feature-space atlas map</li>
                    <li>• Full design inspection view</li>
                  </ul>
                </div>
                <div className="flex items-center gap-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-3">
                  Enter Atlas <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Liquidity Strategy Lab */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}>

          <motion.div
            className="surface-elevated rounded-2xl p-6 cursor-pointer group hover:border-foreground/20 transition-all border-l-4 border-l-chart-4"
            onClick={() => navigate("/labs/strategy")}
            whileHover={{ y: -3 }}>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-chart-4/10 border border-chart-4/20 flex items-center justify-center shrink-0">
                <Layers className="w-6 h-6 text-chart-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-lg font-bold text-foreground">Liquidity Strategy Lab</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  Design, backtest, and compare LP strategies over Monte Carlo price simulations. Evaluate active
                  management rules — range rebalancing, volatility tracking, hedging — against passive LPing.
                </p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <ul className="space-y-1 text-[11px] text-muted-foreground">
                    <li>• 4 strategy presets (Passive, Range, Vol, MR)</li>
                    <li>• Up to 3 side-by-side comparisons</li>
                    <li>• Configurable range, cooldown, hedging</li>
                  </ul>
                  <ul className="space-y-1 text-[11px] text-muted-foreground">
                    <li>• Monte Carlo simulation (up to 5k paths)</li>
                    <li>• GBM with jump diffusion</li>
                    <li>• Session-linked invariant &amp; fees</li>
                  </ul>
                  <ul className="space-y-1 text-[11px] text-muted-foreground">
                    <li>• Equity curves with confidence bands</li>
                    <li>• Sharpe, drawdown, win rate metrics</li>
                    <li>• Fee vs IL attribution breakdown</li>
                  </ul>
                </div>
                <div className="flex items-center gap-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-3">
                  Enter Lab <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          className="grid sm:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}>

          <motion.div
            className="surface-elevated rounded-2xl p-6 cursor-pointer group hover:border-foreground/20 transition-all"
            onClick={() => navigate("/labs/multi-asset")}
            whileHover={{ y: -3 }}>

            <div className="w-12 h-12 rounded-xl bg-chart-1/10 border border-chart-1/20 flex items-center justify-center mb-4">
              <Boxes className="w-6 h-6 text-chart-1" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Multi-Asset AMMs</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Design invariants across 3+ tokens. Asset table, 3D surface plots, pairwise slicing, price matrix
              heatmaps, and multi-asset optimization.
            </p>
            <ul className="space-y-1 text-[11px] text-muted-foreground mb-4">
              <li>• Spreadsheet-style asset configuration</li>
              <li>• 3D surface visualization &amp; pairwise slices</li>
              <li>• Radar chart of liquidity distribution</li>
              <li>• Price matrix heatmap (∂xⱼ/∂xᵢ)</li>
              <li>• Swap rate metrics between all pairs</li>
            </ul>
            <div className="flex items-center gap-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              Enter Lab <ArrowRight className="w-3 h-3" />
            </div>
          </motion.div>

          <motion.div
            className="surface-elevated rounded-2xl p-6 cursor-pointer group hover:border-foreground/20 transition-all"
            onClick={() => navigate("/labs/time-variance")}
            whileHover={{ y: -3 }}>

            <div className="w-12 h-12 rounded-xl bg-chart-2/10 border border-chart-2/20 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-chart-2" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Time-Variance AMMs</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Design AMMs that evolve over time. Animate the invariant curve, adjust parameters at keyframes, and build
              time-dependent fee and weight functions.
            </p>
            <ul className="space-y-1 text-[11px] text-muted-foreground mb-4">
              <li>• Continuous playback with pause/edit points</li>
              <li>• Parameter timeline editor with keyframes</li>
              <li>• Time-dependent expression functions</li>
              <li>• All graphs animated over time</li>
              <li>• Snapshot comparison at any two points</li>
            </ul>
            <div className="flex items-center gap-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              Enter Lab <ArrowRight className="w-3 h-3" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>);

};

export default Labs;