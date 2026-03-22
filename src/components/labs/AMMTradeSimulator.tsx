import { useState, useMemo } from "react";
import { ArrowRightLeft, TrendingDown, TrendingUp, Shield, Activity } from "lucide-react";
import { type AMMDesign, simulateTrade, analyzeCurve } from "@/lib/amm-blocks";

interface Props {
  design: AMMDesign;
  k: number;
}

export default function AMMTradeSimulator({ design, k }: Props) {
  const [tradeSize, setTradeSize] = useState(10);
  const [direction, setDirection] = useState<"x-to-y" | "y-to-x">("x-to-y");

  const result = useMemo(
    () => simulateTrade(design, k, tradeSize, direction),
    [design, k, tradeSize, direction]
  );

  const analytics = useMemo(() => analyzeCurve(design, k), [design, k]);

  // Simulate multiple trade sizes for the slippage chart
  const slippageSeries = useMemo(() => {
    const sqrtK = Math.sqrt(k);
    const sizes = [0.1, 0.5, 1, 2, 5, 10, 20, 50].map((pct) => pct / 100 * sqrtK);
    return sizes.map((size) => {
      const sim = simulateTrade(design, k, size, direction);
      return {
        pctOfPool: ((size / sqrtK) * 100).toFixed(1),
        slippage: sim.slippage,
        priceImpact: sim.priceImpact,
        size,
      };
    });
  }, [design, k, direction]);

  const impactColor =
    result.priceImpact < 0.5
      ? "text-emerald-500"
      : result.priceImpact < 2
        ? "text-yellow-500"
        : "text-red-500";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
          <Activity className="w-3 h-3" />
          Trade Simulator
        </p>
        <button
          onClick={() => setDirection(direction === "x-to-y" ? "y-to-x" : "x-to-y")}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[9px] font-medium border border-border hover:bg-accent transition-colors"
        >
          <ArrowRightLeft className="w-3 h-3" />
          {direction === "x-to-y" ? "X → Y" : "Y → X"}
        </button>
      </div>

      {/* Trade size input */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-muted-foreground shrink-0">Trade Size:</span>
        <input
          type="range"
          min={0.1}
          max={Math.sqrt(k) * 0.5}
          step={0.1}
          value={tradeSize}
          onChange={(e) => setTradeSize(parseFloat(e.target.value))}
          className="flex-1 accent-primary h-1"
        />
        <input
          type="number"
          value={tradeSize}
          onChange={(e) => setTradeSize(parseFloat(e.target.value) || 0.1)}
          className="w-16 bg-secondary border border-border rounded px-2 py-0.5 text-[10px] text-foreground outline-none text-center"
        />
      </div>

      {/* Trade results */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded border border-border p-2">
          <p className="text-[8px] text-muted-foreground uppercase">Output</p>
          <p className="text-xs font-bold text-foreground">{result.outputAmount.toFixed(4)}</p>
        </div>
        <div className="rounded border border-border p-2">
          <p className="text-[8px] text-muted-foreground uppercase">Effective Price</p>
          <p className="text-xs font-bold text-foreground">{result.effectivePrice.toFixed(6)}</p>
        </div>
        <div className="rounded border border-border p-2">
          <p className="text-[8px] text-muted-foreground uppercase">Price Impact</p>
          <p className={`text-xs font-bold ${impactColor}`}>
            {result.priceImpact < 0.01 ? "<0.01" : result.priceImpact.toFixed(2)}%
            <span className="text-[8px] text-muted-foreground ml-1">({result.priceImpactBps} bps)</span>
          </p>
        </div>
        <div className="rounded border border-border p-2">
          <p className="text-[8px] text-muted-foreground uppercase">Slippage</p>
          <p className={`text-xs font-bold ${impactColor}`}>
            {result.slippage.toFixed(3)}%
          </p>
        </div>
        <div className="rounded border border-border p-2">
          <p className="text-[8px] text-muted-foreground uppercase">Fee Paid</p>
          <p className="text-xs font-bold text-foreground">{result.feeAmount.toFixed(4)}</p>
        </div>
        <div className="rounded border border-border p-2">
          <p className="text-[8px] text-muted-foreground uppercase">Spot After</p>
          <p className="text-xs font-bold text-foreground">{result.spotPriceAfter.toFixed(6)}</p>
        </div>
      </div>

      {/* Slippage by trade size table */}
      <div>
        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          Slippage by Trade Size
        </p>
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-[9px]">
            <thead>
              <tr className="bg-secondary">
                <th className="text-left px-2 py-1 font-semibold text-muted-foreground">% Pool</th>
                <th className="text-right px-2 py-1 font-semibold text-muted-foreground">Slippage</th>
                <th className="text-right px-2 py-1 font-semibold text-muted-foreground">Impact</th>
              </tr>
            </thead>
            <tbody>
              {slippageSeries.map((row) => (
                <tr key={row.pctOfPool} className="border-t border-border">
                  <td className="px-2 py-1 text-foreground">{row.pctOfPool}%</td>
                  <td className={`px-2 py-1 text-right font-mono ${
                    row.slippage < 0.5 ? "text-emerald-500" : row.slippage < 2 ? "text-yellow-500" : "text-red-500"
                  }`}>
                    {row.slippage.toFixed(3)}%
                  </td>
                  <td className={`px-2 py-1 text-right font-mono ${
                    row.priceImpact < 0.5 ? "text-emerald-500" : row.priceImpact < 2 ? "text-yellow-500" : "text-red-500"
                  }`}>
                    {row.priceImpact.toFixed(3)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Curve Analytics */}
      <div>
        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
          <Shield className="w-3 h-3" />
          Curve Analytics
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded border border-border p-2">
            <p className="text-[8px] text-muted-foreground uppercase">Capital Efficiency</p>
            <p className="text-xs font-bold text-foreground">
              {(analytics.capitalEfficiency * 100).toFixed(1)}%
            </p>
          </div>
          <div className="rounded border border-border p-2">
            <p className="text-[8px] text-muted-foreground uppercase">1% Trade Slip</p>
            <p className="text-xs font-bold text-foreground">
              {analytics.maxSlippage1Pct.toFixed(3)}%
            </p>
          </div>
          <div className="rounded border border-border p-2">
            <p className="text-[8px] text-muted-foreground uppercase">Liq Concentration</p>
            <p className="text-xs font-bold text-foreground">
              {(analytics.liquidityConcentration * 100).toFixed(1)}%
            </p>
          </div>
          <div className="rounded border border-border p-2">
            <p className="text-[8px] text-muted-foreground uppercase">Price Range</p>
            <p className="text-[9px] font-bold text-foreground">
              {analytics.priceRange.min.toFixed(3)}–{analytics.priceRange.max.toFixed(3)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
