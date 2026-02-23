import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Cpu, Settings2, HelpCircle, Info } from "lucide-react";
import { type StrategyConfig, type SimulationConfig, type BacktestResult, runStrategyBacktest } from "@/lib/strategy-engine";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  strategies: StrategyConfig[];
  onResults: (results: BacktestResult[]) => void;
  savedFeeRate: number;
}

export default function StrategyBacktest({ strategies, onResults, savedFeeRate }: Props) {
  const [volatility, setVolatility] = useState(80);
  const [drift, setDrift] = useState(0);
  const [jumpProb, setJumpProb] = useState(5);
  const [jumpSize, setJumpSize] = useState(20);
  const [numPaths, setNumPaths] = useState(500);
  const [timeHorizon, setTimeHorizon] = useState(30);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [running, setRunning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const simConfig: SimulationConfig = useMemo(() => ({
    volatility, drift, jumpProb, jumpSize, numPaths, timeHorizon,
    initialCapital, feeRate: savedFeeRate, initialPrice: 100,
  }), [volatility, drift, jumpProb, jumpSize, numPaths, timeHorizon, initialCapital, savedFeeRate]);

  const handleRun = useCallback(() => {
    if (strategies.length === 0) return;
    setRunning(true);
    // Use setTimeout to let UI update
    setTimeout(() => {
      const seed = Date.now();
      const results = strategies.map((s, i) => runStrategyBacktest(s, simConfig, seed + i));
      onResults(results);
      setRunning(false);
    }, 50);
  }, [strategies, simConfig, onResults]);

  return (
    <div className="space-y-6">
      {strategies.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-2">
          <Info className="w-4 h-4 text-warning shrink-0" />
          <p className="text-xs text-foreground">Go back to <strong>Strategy Editor</strong> and add at least one strategy before running a backtest.</p>
        </motion.div>
      )}

      <div className="surface-elevated rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Simulation Parameters</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground bg-secondary border border-border transition-colors">
              <Settings2 className="w-3 h-3" /> {showAdvanced ? "Simple" : "Advanced"}
            </button>
            <button onClick={handleRun} disabled={strategies.length === 0 || running}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
              <Play className="w-3 h-3" /> {running ? "Running..." : `Run Backtest (${strategies.length} strategies)`}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SliderParam label="Volatility (%)" value={volatility} onChange={setVolatility} min={10} max={200} />
          <SliderParam label="Drift (%)" value={drift} onChange={setDrift} min={-50} max={50} />
          <SliderParam label="Jump Prob (%)" value={jumpProb} onChange={setJumpProb} min={0} max={30} />
          <SliderParam label="Horizon (days)" value={timeHorizon} onChange={setTimeHorizon} min={7} max={365} />
        </div>

        {showAdvanced && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
            <SliderParam label="Jump Size (%)" value={jumpSize} onChange={setJumpSize} min={5} max={50} />
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Paths</label>
              <input type="number" value={numPaths} onChange={e => setNumPaths(Math.max(10, Math.min(5000, Number(e.target.value))))}
                className="w-full bg-secondary border border-border rounded-md px-2 py-1 text-[10px] font-mono text-foreground outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Initial Capital ($)</label>
              <input type="number" value={initialCapital} onChange={e => setInitialCapital(Math.max(100, Number(e.target.value)))}
                className="w-full bg-secondary border border-border rounded-md px-2 py-1 text-[10px] font-mono text-foreground outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Fee Rate (bps)</label>
              <p className="text-[10px] font-mono text-foreground mt-1">{(savedFeeRate * 10000).toFixed(0)} bps</p>
              <p className="text-[8px] text-muted-foreground">From saved config</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Strategy summary */}
      {strategies.length > 0 && (
        <div className="surface-elevated rounded-xl p-4">
          <h4 className="text-[10px] font-bold text-foreground mb-2">Strategies to Backtest</h4>
          <div className="flex gap-2 flex-wrap">
            {strategies.map(s => (
              <span key={s.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border text-[9px] font-mono">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-foreground">{s.name}</span>
                <span className="text-muted-foreground">
                  {s.rangeWidth >= 10 ? "∞" : `±${(s.rangeWidth * 100).toFixed(0)}%`}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SliderParam({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] text-muted-foreground">{label}</label>
        <span className="text-[10px] font-mono text-foreground">{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-foreground h-1" />
    </div>
  );
}
