import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";

// Self-contained mini simulation: slippage explorer
export function SlippageMiniSim() {
  const [tradeSize, setTradeSize] = useState(50);
  const reserveX = 1000;
  const reserveY = 1000;
  const k = reserveX * reserveY;

  const { output, slippage } = useMemo(() => {
    const newX = reserveX + tradeSize;
    const newY = k / newX;
    const out = reserveY - newY;
    const idealPrice = reserveY / reserveX;
    const avgPrice = tradeSize / out;
    const slip = ((avgPrice - idealPrice) / idealPrice) * 100;
    return { output: out, slippage: slip };
  }, [tradeSize, k]);

  return (
    <div className="p-2.5 rounded-lg bg-secondary/50 border border-border space-y-2">
      <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
        🧪 Interactive: Slippage Explorer
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Trade size</span>
        <span className="font-mono">{tradeSize}</span>
      </div>
      <Slider min={1} max={800} step={1} value={[tradeSize]} onValueChange={([v]) => setTradeSize(v)} />
      <div className="flex gap-2">
        <div className="flex-1 rounded bg-background p-1.5 text-center">
          <div className="text-[8px] text-muted-foreground">Output</div>
          <div className="text-[11px] font-mono text-foreground">{output.toFixed(2)}</div>
        </div>
        <div className="flex-1 rounded bg-background p-1.5 text-center">
          <div className="text-[8px] text-muted-foreground">Slippage</div>
          <motion.div
            className={`text-[11px] font-mono ${slippage > 10 ? "text-destructive" : slippage > 5 ? "text-warning" : "text-foreground"}`}
            key={Math.round(slippage * 10)}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {slippage.toFixed(2)}%
          </motion.div>
        </div>
      </div>
      <div className="text-[9px] text-muted-foreground text-center italic">
        Drag the slider — watch how slippage accelerates!
      </div>
    </div>
  );
}

// Self-contained mini simulation: reserve balance
export function ReserveBalanceMiniSim() {
  const [tradeAmount, setTradeAmount] = useState(0);
  const baseX = 1000;
  const baseY = 1000;
  const k = baseX * baseY;
  
  const newX = baseX + tradeAmount;
  const newY = k / newX;
  const price = newY / newX;

  return (
    <div className="p-2.5 rounded-lg bg-secondary/50 border border-border space-y-2">
      <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
        🧪 Interactive: Reserve Balance
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Add/remove X</span>
        <span className="font-mono">{tradeAmount > 0 ? "+" : ""}{tradeAmount}</span>
      </div>
      <Slider min={-500} max={500} step={10} value={[tradeAmount]} onValueChange={([v]) => setTradeAmount(v)} />
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Reserve X</span>
          <span className="font-mono">{newX.toFixed(0)}</span>
        </div>
        <div className="h-2 bg-background rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "hsl(var(--chart-1))" }}
            animate={{ width: `${(newX / 2000) * 100}%` }}
            transition={{ type: "spring", stiffness: 300 }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Reserve Y</span>
          <span className="font-mono">{newY.toFixed(0)}</span>
        </div>
        <div className="h-2 bg-background rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "hsl(var(--chart-2))" }}
            animate={{ width: `${(newY / 2000) * 100}%` }}
            transition={{ type: "spring", stiffness: 300 }}
          />
        </div>
      </div>
      <div className="text-center text-[10px] font-mono text-muted-foreground">
        Price: <span className="text-foreground">{price.toFixed(4)}</span> · k = {k.toLocaleString()}
      </div>
    </div>
  );
}

// Fee accumulation mini sim
export function FeeAccumMiniSim() {
  const [volume, setVolume] = useState(100000);
  const [feeRate, setFeeRate] = useState(0.3);
  
  const dailyFees = volume * (feeRate / 100);
  const yearlyFees = dailyFees * 365;

  return (
    <div className="p-2.5 rounded-lg bg-secondary/50 border border-border space-y-2">
      <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
        🧪 Interactive: Fee Calculator
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Daily volume</span>
        <span className="font-mono">${volume.toLocaleString()}</span>
      </div>
      <Slider min={10000} max={10000000} step={10000} value={[volume]} onValueChange={([v]) => setVolume(v)} />
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Fee rate</span>
        <span className="font-mono">{feeRate.toFixed(2)}%</span>
      </div>
      <Slider min={0.01} max={1} step={0.01} value={[feeRate]} onValueChange={([v]) => setFeeRate(v)} />
      <div className="flex gap-2">
        <div className="flex-1 rounded bg-background p-1.5 text-center">
          <div className="text-[8px] text-muted-foreground">Daily fees</div>
          <div className="text-[11px] font-mono text-chart-2">${dailyFees.toFixed(0)}</div>
        </div>
        <div className="flex-1 rounded bg-background p-1.5 text-center">
          <div className="text-[8px] text-muted-foreground">Yearly fees</div>
          <div className="text-[11px] font-mono text-chart-1">${yearlyFees.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>
    </div>
  );
}

// Wrapper to render by key
export function InlineMiniSim({ type }: { type: string }) {
  switch (type) {
    case "slippage-explorer": return <SlippageMiniSim />;
    case "reserve-balance": return <ReserveBalanceMiniSim />;
    case "fee-calculator": return <FeeAccumMiniSim />;
    default: return null;
  }
}
