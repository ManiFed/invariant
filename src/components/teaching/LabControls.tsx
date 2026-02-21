import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpCircle, Check, Lock, Circle } from "lucide-react";
import { COURSE_MODULES } from "@/lib/course-content";
import AIChatPanel from "./AIChatPanel";

export type LessonTab = "slippage" | "il" | "arbitrage" | "fees" | "volatility" | "concentrated";

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

const HELP: Record<string, { title: string; desc: string }> = {
  reserveX: { title: "Reserve X", desc: "The amount of Token X in the pool. More reserves = deeper liquidity = less slippage per trade." },
  reserveY: { title: "Reserve Y", desc: "The amount of Token Y in the pool. Together with Reserve X, determines the starting price (Y/X)." },
  feeRate: { title: "Fee Rate", desc: "Percentage taken from each trade. Goes to LPs as revenue. Typical: 0.3%. Higher fees = more LP income but less trading volume." },
  volatility: { title: "Volatility (σ)", desc: "How much the external market price fluctuates per time step. Higher σ = bigger price swings = more arbitrage = more IL but also more fees." },
  tradeSize: { title: "Trade Size", desc: "How many tokens you want to trade. Larger trades cause more slippage because they move further along the curve." },
  direction: { title: "Trade Direction", desc: "Whether you're selling X for Y (Buy Y) or selling Y for X (Buy X). Both directions follow the same constant product curve." },
  arbEnabled: { title: "Arbitrage Toggle", desc: "When ON, arbitrageurs automatically trade to align the pool price with the external market price. This causes IL but keeps prices accurate." },
  timeSpeed: { title: "Time Speed", desc: "Controls how fast the auto-simulation runs. At 0, time is paused. Higher values = faster price evolution." },
  rangeLower: { title: "Range Lower", desc: "Lower bound of your concentrated liquidity position. Below this price, you hold 100% of Token X." },
  rangeUpper: { title: "Range Upper", desc: "Upper bound of your concentrated liquidity position. Above this price, you hold 100% of Token Y." },
};

interface Props {
  tab: LessonTab;
  onTabChange: (t: LessonTab) => void;
  controls: Controls;
  onChange: (c: Partial<Controls>) => void;
  onExecuteTrade: () => void;
  onReset: () => void;
  isRunning: boolean;
  onToggleRun: () => void;
  courseActive: boolean;
  courseModule: number;
  completedModules: number;
  onNavigateModule: (idx: number) => void;
}

function HelpButton({ id }: { id: string }) {
  const help = HELP[id];
  if (!help) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors" type="button">
          <HelpCircle className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" className="w-52 p-2.5">
        <h4 className="text-[11px] font-semibold text-foreground mb-1">{help.title}</h4>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{help.desc}</p>
      </PopoverContent>
    </Popover>
  );
}

function SliderRow({ label, value, min, max, step, onChange, format, helpId }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string; helpId?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <Label className="text-[11px] text-muted-foreground">{label}</Label>
          {helpId && <HelpButton id={helpId} />}
        </div>
        <span className="text-[11px] font-mono text-foreground">{format ? format(value) : value}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

const MODULE_TAB_MAP: Record<string, LessonTab> = {
  intro: "slippage",
  reserves: "slippage",
  price: "slippage",
  trading: "slippage",
  il: "il",
  arbitrage: "arbitrage",
  fees: "fees",
};

export default function LabControls({
  tab, onTabChange, controls, onChange, onExecuteTrade, onReset,
  isRunning, onToggleRun, courseActive, courseModule, completedModules, onNavigateModule,
}: Props) {
  const courseComplete = completedModules >= COURSE_MODULES.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Course Navigator */}
      <div className="p-3 border-b border-border">
        <h2 className="text-[10px] font-mono font-semibold text-muted-foreground mb-2 tracking-wider uppercase">Course Modules</h2>
        <div className="flex flex-col gap-0.5">
          {COURSE_MODULES.map((m, i) => {
            const isComplete = i < completedModules;
            const isCurrent = courseActive && i === courseModule;
            const isLocked = !isComplete && !isCurrent;
            const canClick = isComplete || (courseComplete && true);

            return (
              <button
                key={m.id}
                onClick={() => {
                  if (canClick) {
                    onNavigateModule(i);
                    const mappedTab = MODULE_TAB_MAP[m.id];
                    if (mappedTab) onTabChange(mappedTab);
                  }
                }}
                disabled={isLocked && !courseComplete}
                className={`flex items-center gap-1.5 text-left text-[10px] px-2 py-1.5 rounded-md transition-all ${
                  isCurrent
                    ? "bg-primary text-primary-foreground font-medium"
                    : isComplete
                    ? "text-success hover:bg-secondary cursor-pointer"
                    : isLocked && !courseComplete
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                }`}
              >
                {isComplete ? (
                  <Check className="w-3 h-3 shrink-0" />
                ) : isCurrent ? (
                  <Circle className="w-3 h-3 shrink-0 fill-current" />
                ) : (
                  <Lock className="w-2.5 h-2.5 shrink-0" />
                )}
                <span className="mr-1">{m.emoji}</span>
                <span className="truncate">{m.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Chat Assistant */}
      <div className="flex-1 min-h-0 border-b border-border">
        <AIChatPanel />
      </div>

      {/* Controls */}
      <div className="p-3 space-y-2.5 overflow-y-auto">
        <h2 className="text-[10px] font-mono font-semibold text-muted-foreground tracking-wider uppercase">Controls</h2>

        <SliderRow label="Reserve X" value={controls.reserveX} min={100} max={10000} step={100}
          onChange={v => onChange({ reserveX: v })} format={v => v.toLocaleString()} helpId="reserveX" />
        <SliderRow label="Reserve Y" value={controls.reserveY} min={100} max={10000} step={100}
          onChange={v => onChange({ reserveY: v })} format={v => v.toLocaleString()} helpId="reserveY" />
        <SliderRow label="Fee Rate" value={controls.feeRate} min={0} max={0.05} step={0.001}
          onChange={v => onChange({ feeRate: v })} format={v => `${(v * 100).toFixed(1)}%`} helpId="feeRate" />
        <SliderRow label="Volatility (σ)" value={controls.volatility} min={0.01} max={2} step={0.01}
          onChange={v => onChange({ volatility: v })} format={v => `${(v * 100).toFixed(0)}%`} helpId="volatility" />
        <SliderRow label="Trade Size" value={controls.tradeSize} min={1} max={Math.max(controls.reserveX, controls.reserveY) * 0.5} step={1}
          onChange={v => onChange({ tradeSize: v })} format={v => v.toLocaleString()} helpId="tradeSize" />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Label className="text-[11px] text-muted-foreground">Direction</Label>
            <HelpButton id="direction" />
          </div>
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
          <div className="flex items-center gap-1">
            <Label className="text-[11px] text-muted-foreground">Arbitrage</Label>
            <HelpButton id="arbEnabled" />
          </div>
          <Switch checked={controls.arbEnabled} onCheckedChange={v => onChange({ arbEnabled: v })} />
        </div>

        <SliderRow label="Time Speed" value={controls.timeSpeed} min={0} max={10} step={1}
          onChange={v => onChange({ timeSpeed: v })} format={v => `${v}x`} helpId="timeSpeed" />

        {tab === "concentrated" && (
          <>
            <SliderRow label="Range Lower" value={controls.rangeLower} min={0.1} max={controls.rangeUpper - 0.01} step={0.01}
              onChange={v => onChange({ rangeLower: v })} format={v => v.toFixed(2)} helpId="rangeLower" />
            <SliderRow label="Range Upper" value={controls.rangeUpper} min={controls.rangeLower + 0.01} max={5} step={0.01}
              onChange={v => onChange({ rangeUpper: v })} format={v => v.toFixed(2)} helpId="rangeUpper" />
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
