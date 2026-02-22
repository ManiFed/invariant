import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Boxes, Clock } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

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

      <div className="max-w-3xl mx-auto px-8 pt-16 pb-10">
        <motion.h1
          className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-4 text-foreground"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Experimental AMM Labs
        </motion.h1>
        <motion.p
          className="text-base text-muted-foreground max-w-xl mb-12 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Extend beyond two-asset constant-product AMMs. Design multi-asset pools and time-varying mechanisms.
        </motion.p>

        <motion.div
          className="grid sm:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div
            className="surface-elevated rounded-2xl p-6 cursor-pointer group hover:border-foreground/20 transition-all"
            onClick={() => navigate("/labs/multi-asset")}
            whileHover={{ y: -3 }}
          >
            <div className="w-12 h-12 rounded-xl bg-chart-1/10 border border-chart-1/20 flex items-center justify-center mb-4">
              <Boxes className="w-6 h-6 text-chart-1" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Multi-Asset AMMs</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Design invariants across 3+ tokens. Asset table, 3D surface plots, pairwise slicing, price matrix heatmaps, and multi-asset optimization.
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
            whileHover={{ y: -3 }}
          >
            <div className="w-12 h-12 rounded-xl bg-chart-2/10 border border-chart-2/20 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-chart-2" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Time-Variance AMMs</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Design AMMs that evolve over time. Animate the invariant curve, adjust parameters at keyframes, and build time-dependent fee and weight functions.
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
    </div>
  );
};

export default Labs;
