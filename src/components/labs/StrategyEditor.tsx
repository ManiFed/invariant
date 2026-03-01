import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, RotateCcw, Layers } from "lucide-react";
import { STRATEGY_PRESETS, type StrategyConfig } from "@/lib/strategy-engine";

const COLORS = ["hsl(0, 0%, 70%)", "hsl(142, 50%, 50%)", "hsl(30, 80%, 55%)"];

interface Props {
  strategies: StrategyConfig[];
  onStrategiesChange: (s: StrategyConfig[]) => void;
}

export default function StrategyEditor({ strategies, onStrategiesChange }: Props) {
  const addStrategy = (presetId: string) => {
    if (strategies.length >= 3) return;
    const preset = STRATEGY_PRESETS.find(p => p.presetId === presetId);
    if (!preset) return;
    const s: StrategyConfig = {
      ...preset,
      id: `${presetId}_${Date.now()}`,
      color: COLORS[strategies.length % COLORS.length],
    };
    onStrategiesChange([...strategies, s]);
  };

  const removeStrategy = (id: string) => {
    onStrategiesChange(strategies.filter(s => s.id !== id));
  };

  const updateStrategy = (id: string, patch: Partial<StrategyConfig>) => {
    onStrategiesChange(strategies.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  return (
    <div className="space-y-6">
      {/* Preset picker */}
      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Strategy Presets</h3>
          <span className="text-[9px] text-muted-foreground ml-auto">{strategies.length}/3 active</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {STRATEGY_PRESETS.map(preset => (
            <button
              key={preset.presetId}
              onClick={() => addStrategy(preset.presetId)}
              disabled={strategies.length >= 3}
              className="text-left p-3 rounded-lg bg-secondary border border-border hover:border-foreground/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <p className="text-xs font-semibold text-foreground mb-1">{preset.name}</p>
              <p className="text-[9px] text-muted-foreground">
                Range: {preset.rangeWidth >= 10 ? "∞" : `±${(preset.rangeWidth * 100).toFixed(0)}%`}
                {preset.hedgeRatio > 0 && ` · Hedge: ${(preset.hedgeRatio * 100).toFixed(0)}%`}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Active strategies */}
      {strategies.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
          <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">No strategies configured</p>
          <p className="text-[10px] text-muted-foreground">Click a preset above to add up to 3 strategies for comparison</p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {strategies.map((s, idx) => (
          <motion.div
            key={s.id}
            className="surface-elevated rounded-xl p-4 border-l-4"
            style={{ borderLeftColor: s.color }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-foreground">{s.name}</h4>
              <div className="flex gap-1">
                <button onClick={() => {
                  const preset = STRATEGY_PRESETS.find(p => p.presetId === s.presetId);
                  if (preset) updateStrategy(s.id, { ...preset });
                }} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Reset to preset">
                  <RotateCcw className="w-3 h-3" />
                </button>
                <button onClick={() => removeStrategy(s.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <ParamRow label="Range Width" value={s.rangeWidth >= 10 ? "∞" : `±${(s.rangeWidth * 100).toFixed(0)}%`}>
                <input type="range" min={0.02} max={1} step={0.01} value={Math.min(s.rangeWidth, 1)}
                  onChange={e => updateStrategy(s.id, { rangeWidth: Number(e.target.value) })}
                  className="w-full accent-foreground h-1" />
              </ParamRow>

              <ParamRow label="Rebalance Trigger" value={`${(s.rebalanceTrigger * 100).toFixed(0)}%`}>
                <input type="range" min={0.01} max={0.5} step={0.01} value={s.rebalanceTrigger}
                  onChange={e => updateStrategy(s.id, { rebalanceTrigger: Number(e.target.value) })}
                  className="w-full accent-foreground h-1" />
              </ParamRow>

              <ParamRow label="Cooldown (days)" value={`${s.rebalanceCooldown}d`}>
                <input type="range" min={1} max={30} step={1} value={s.rebalanceCooldown}
                  onChange={e => updateStrategy(s.id, { rebalanceCooldown: Number(e.target.value) })}
                  className="w-full accent-foreground h-1" />
              </ParamRow>

              <ParamRow label="Stop-Loss IL" value={`${s.stopLoss}%`}>
                <input type="range" min={5} max={100} step={1} value={s.stopLoss}
                  onChange={e => updateStrategy(s.id, { stopLoss: Number(e.target.value) })}
                  className="w-full accent-foreground h-1" />
              </ParamRow>

              <ParamRow label="Hedge Ratio" value={`${(s.hedgeRatio * 100).toFixed(0)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={s.hedgeRatio}
                  onChange={e => updateStrategy(s.id, { hedgeRatio: Number(e.target.value) })}
                  className="w-full accent-foreground h-1" />
              </ParamRow>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ParamRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-muted-foreground">{label}</span>
        <span className="text-[9px] font-mono text-foreground">{value}</span>
      </div>
      {children}
    </div>
  );
}
