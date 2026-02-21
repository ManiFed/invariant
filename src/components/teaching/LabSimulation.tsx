import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceArea, ComposedChart, Bar, Area, AreaChart } from "recharts";
import { PoolState, TradeResult, HistoryPoint, generateCurveData, poolPrice } from "@/lib/amm-engine";
import type { LessonTab } from "./LabControls";

interface Props {
  pool: PoolState;
  history: HistoryPoint[];
  lastTrade: TradeResult | null;
  tab: LessonTab;
  rangeLower: number;
  rangeUpper: number;
}

export default function LabSimulation({ pool, history, lastTrade, tab, rangeLower, rangeUpper }: Props) {
  const curveData = useMemo(() => generateCurveData(pool.k, pool.x), [pool.k, pool.x]);
  const currentPrice = poolPrice(pool);
  const recentHistory = history.slice(-120);

  // Reserve bar data
  const totalReserves = pool.x + pool.y;
  const xPct = (pool.x / totalReserves) * 100;
  const yPct = (pool.y / totalReserves) * 100;

  return (
    <div className="flex flex-col h-full gap-2 p-2 overflow-y-auto">
      {/* 1. Price Curve */}
      <div className="surface-elevated rounded-lg p-3 flex-1 min-h-[180px]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">Constant Product Curve</h3>
          {lastTrade && (
            <span className="text-[10px] font-mono text-destructive">
              Slippage: {lastTrade.slippagePct.toFixed(2)}%
            </span>
          )}
        </div>
        <ResponsiveContainer width="100%" height="85%">
          <ComposedChart data={curveData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="x" type="number" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Reserve X", position: "bottom", fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis type="number" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Reserve Y", angle: -90, position: "insideLeft", fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
            <Line dataKey="y" type="monotone" dot={false} strokeWidth={2} stroke="hsl(var(--chart-1))" />
            <ReferenceDot x={pool.x} y={pool.y} r={6} fill="hsl(var(--chart-2))" stroke="hsl(var(--background))" strokeWidth={2} />
            {lastTrade && (
              <ReferenceDot
                x={lastTrade.direction === "buyY" ? pool.x - (lastTrade.input - lastTrade.feesPaid) : pool.x + lastTrade.output}
                y={lastTrade.direction === "buyY" ? pool.y + lastTrade.output : pool.y - (lastTrade.input - lastTrade.feesPaid)}
                r={4} fill="hsl(var(--chart-3))" stroke="hsl(var(--background))" strokeWidth={1}
              />
            )}
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              const price = d.y / d.x;
              return (
                <div className="bg-popover border border-border rounded-md px-2 py-1 text-[10px] font-mono shadow-lg">
                  <div>X: {d.x.toFixed(2)}</div>
                  <div>Y: {d.y.toFixed(2)}</div>
                  <div>Price: {price.toFixed(4)}</div>
                </div>
              );
            }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 2. Reserve State */}
      <div className="surface-elevated rounded-lg p-3 min-h-[100px]">
        <h3 className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-2">Reserve State</h3>
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-muted-foreground">Reserve X</span>
              <span className="font-mono text-foreground">{pool.x.toFixed(2)}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${xPct}%`, background: "hsl(var(--chart-1))" }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-muted-foreground">Reserve Y</span>
              <span className="font-mono text-foreground">{pool.y.toFixed(2)}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${yPct}%`, background: "hsl(var(--chart-2))" }} />
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Invariant k</span>
            <span className="font-mono text-foreground">{pool.k.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          {history.length > 0 && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">LP vs HODL</span>
              <span className={`font-mono ${history[history.length - 1].ilPct < 0 ? "text-destructive" : "text-success"}`}>
                {history[history.length - 1].ilPct.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. External vs Pool Price */}
      <div className="surface-elevated rounded-lg p-3 flex-1 min-h-[160px]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">External vs Pool Price</h3>
          {recentHistory.some(h => h.arbEvent) && (
            <span className="text-[10px] font-mono text-warning">ARB ⚡</span>
          )}
        </div>
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={recentHistory} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="step" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} domain={["auto", "auto"]} />
            <Line dataKey="poolPrice" dot={false} strokeWidth={2} stroke="hsl(var(--chart-1))" name="Pool" />
            <Line dataKey="externalPrice" dot={false} strokeWidth={1.5} strokeDasharray="4 2" stroke="hsl(var(--chart-2))" name="External" />
            {tab === "concentrated" && (
              <>
                <ReferenceArea y1={rangeLower * (history[0]?.externalPrice || 1)} y2={rangeUpper * (history[0]?.externalPrice || 1)} fill="hsl(var(--chart-2))" fillOpacity={0.08} />
              </>
            )}
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-popover border border-border rounded-md px-2 py-1 text-[10px] font-mono shadow-lg">
                  {payload.map(p => (
                    <div key={p.name}>{p.name}: {Number(p.value).toFixed(4)}</div>
                  ))}
                </div>
              );
            }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
