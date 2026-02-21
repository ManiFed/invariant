import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export type LessonTab = "slippage" | "il" | "arbitrage" | "fees" | "volatility" | "concentrated";

const TABS: { id: LessonTab; label: string }[] = [
  { id: "slippage", label: "Pricing & Slippage" },
  { id: "il", label: "Impermanent Loss" },
  { id: "arbitrage", label: "Arbitrage Mechanics" },
  { id: "fees", label: "Fees & LP Revenue" },
  { id: "volatility", label: "Volatility & LP Risk" },
  { id: "concentrated", label: "Concentrated Liquidity" },
];

export interface Controls {
  reserveX: number;
  reserveY: number;
  feeRate: number;
  volatility: number;
  tradeSize: number;
  direction: "buyY" | "buyX";
  timeSpeed: number;
  rangeLower: number;
  rangeUpper: number;
  arbEnabled: boolean;
}

interface Props {
  tab: LessonTab;
  onTabChange: (t: LessonTab) => void;
  controls: Controls;
  onChange: (c: Partial<Controls>) => void;
  onExecuteTrade: () => void;
  onReset: () => void;
  isRunning: boolean;
  onToggleRun: () => void;
}

function SliderRow({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <span className="text-[11px] font-mono text-foreground">{format ? format(value) : value}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

export default function LabControls({ tab, onTabChange, controls, onChange, onExecuteTrade, onReset, isRunning, onToggleRun }: Props) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Tabs */}
      <div className="p-3 border-b border-border">
        <h2 className="text-[10px] font-mono font-semibold text-muted-foreground mb-2 tracking-wider uppercase">Concept</h2>
        <div className="flex flex-col gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`text-left text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="p-3 space-y-3 flex-1">
        <h2 className="text-[10px] font-mono font-semibold text-muted-foreground tracking-wider uppercase">Controls</h2>

        <SliderRow label="Reserve X" value={controls.reserveX} min={100} max={10000} step={100}
          onChange={v => onChange({ reserveX: v })} format={v => v.toLocaleString()} />
        <SliderRow label="Reserve Y" value={controls.reserveY} min={100} max={10000} step={100}
          onChange={v => onChange({ reserveY: v })} format={v => v.toLocaleString()} />
        <SliderRow label="Fee Rate" value={controls.feeRate} min={0} max={0.05} step={0.001}
          onChange={v => onChange({ feeRate: v })} format={v => `${(v * 100).toFixed(1)}%`} />
        <SliderRow label="Volatility (σ)" value={controls.volatility} min={0.01} max={2} step={0.01}
          onChange={v => onChange({ volatility: v })} format={v => `${(v * 100).toFixed(0)}%`} />
        <SliderRow label="Trade Size" value={controls.tradeSize} min={1} max={Math.max(controls.reserveX, controls.reserveY) * 0.5} step={1}
          onChange={v => onChange({ tradeSize: v })} format={v => v.toLocaleString()} />

        <div className="flex items-center gap-2">
          <Label className="text-[11px] text-muted-foreground">Direction</Label>
          <div className="flex gap-1 text-[10px]">
            <button onClick={() => onChange({ direction: "buyY" })}
              className={`px-2 py-1 rounded ${controls.direction === "buyY" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              Buy Y
            </button>
            <button onClick={() => onChange({ direction: "buyX" })}
              className={`px-2 py-1 rounded ${controls.direction === "buyX" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              Buy X
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Arbitrage</Label>
          <Switch checked={controls.arbEnabled} onCheckedChange={v => onChange({ arbEnabled: v })} />
        </div>

        <SliderRow label="Time Speed" value={controls.timeSpeed} min={0} max={10} step={1}
          onChange={v => onChange({ timeSpeed: v })} format={v => `${v}x`} />

        {tab === "concentrated" && (
          <>
            <SliderRow label="Range Lower" value={controls.rangeLower} min={0.1} max={controls.rangeUpper - 0.01} step={0.01}
              onChange={v => onChange({ rangeLower: v })} format={v => v.toFixed(2)} />
            <SliderRow label="Range Upper" value={controls.rangeUpper} min={controls.rangeLower + 0.01} max={5} step={0.01}
              onChange={v => onChange({ rangeUpper: v })} format={v => v.toFixed(2)} />
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="p-3 border-t border-border space-y-2">
        <button onClick={onExecuteTrade}
          className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
          Execute Trade
        </button>
        <div className="flex gap-2">
          <button onClick={onToggleRun}
            className="flex-1 px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium hover:opacity-90 transition-opacity">
            {isRunning ? "⏸ Pause" : "▶ Auto-Run"}
          </button>
          <button onClick={onReset}
            className="px-3 py-1.5 rounded-md bg-secondary text-muted-foreground text-xs hover:text-foreground transition-colors">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
