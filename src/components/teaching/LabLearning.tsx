import { useMemo } from "react";
import type { LessonTab } from "./LabControls";
import type { PoolState, TradeResult, HistoryPoint } from "@/lib/amm-engine";
import { poolPrice, calcIL, lpValue, hodlValue, isInRange, capitalEfficiency } from "@/lib/amm-engine";
import AIChatPanel from "./AIChatPanel";

interface Props {
  pool: PoolState;
  history: HistoryPoint[];
  lastTrade: TradeResult | null;
  tab: LessonTab;
  initialX: number;
  initialY: number;
  initialPrice: number;
  rangeLower: number;
  rangeUpper: number;
}

function MetricRow({ label, value, highlight, positive }: {label: string;value: string;highlight?: boolean;positive?: boolean | null;}) {
  return (
    <div className={`flex items-center justify-between text-[11px] py-0.5 ${highlight ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${positive === true ? "text-success" : positive === false ? "text-destructive" : "text-foreground"}`}>
        {value}
      </span>
    </div>);

}

export default function LabLearning({ pool, history, lastTrade, tab, initialX, initialY, initialPrice, rangeLower, rangeUpper }: Props) {
  const currentPrice = poolPrice(pool);
  const il = calcIL(initialPrice, currentPrice);
  const lpVal = lpValue(pool, currentPrice);
  const hodlVal = hodlValue(initialX, initialY, currentPrice);
  const inRange = isInRange(currentPrice, rangeLower * initialPrice, rangeUpper * initialPrice);
  const capEff = capitalEfficiency(rangeLower, rangeUpper);
  const latest = history.length > 0 ? history[history.length - 1] : null;

  const explanation = useMemo(() => {
    if (!lastTrade && history.length < 2) return "Adjust the controls or execute a trade to observe how the pool responds.";

    switch (tab) {
      case "slippage":
        if (lastTrade) {
          if (lastTrade.slippagePct > 5) return `Large trade detected — ${lastTrade.slippagePct.toFixed(1)}% slippage. The curve's convexity means each additional unit costs more. Try reducing trade size to see the nonlinear relationship.`;
          return `Slippage: ${lastTrade.slippagePct.toFixed(2)}%. The trade moved the price from ${lastTrade.priceBeforeTrade.toFixed(4)} to ${lastTrade.priceAfterTrade.toFixed(4)}. Increase trade size to see how slippage accelerates.`;
        }
        return "Execute a trade to observe price impact along the constant product curve.";
      case "il":
        return `Current IL: ${il.toFixed(2)}%. Price moved from ${initialPrice.toFixed(4)} to ${currentPrice.toFixed(4)} (${((currentPrice / initialPrice - 1) * 100).toFixed(1)}%). LP value: ${lpVal.toFixed(2)} vs HODL: ${hodlVal.toFixed(2)}. IL emerges from the pool's automatic rebalancing.`;
      case "arbitrage":
        if (latest?.arbEvent) return "Arbitrage event! An arbitrageur traded against the mispriced pool, pushing the pool price back toward the external market price. LPs paid for this correction through inventory shift.";
        return "Watch the external vs pool price chart. When they diverge, arbitrageurs profit by correcting the mismatch — at the LP's expense.";
      case "fees":
        return `Total fees collected: ${pool.totalFees.toFixed(2)}. Fee rate: ${(pool.feeRate * 100).toFixed(1)}%. ${pool.totalFees > Math.abs(il * lpVal / 100) ? "Fees currently exceed IL — LPs are net profitable." : "IL currently exceeds fees — LPs are underwater."}`;
      case "volatility":
        return `Volatility drives both fees (from arbitrage volume) and IL. ${Math.abs(il) > 3 ? "High price divergence is causing significant IL." : "Price has been relatively stable."} Net LP return: ${((lpVal + pool.totalFees - hodlVal) / hodlVal * 100).toFixed(2)}%.`;
      case "concentrated":
        return `Position is ${inRange ? "IN RANGE ✓" : "OUT OF RANGE ✗"}. Capital efficiency: ${capEff.toFixed(1)}x. ${inRange ? "You're earning amplified fees within your range." : "Price has left your range — earning zero fees, holding 100% of one token."}`;
    }
  }, [tab, lastTrade, il, currentPrice, initialPrice, lpVal, hodlVal, pool, latest, inRange, capEff, history.length]);

  const highlights: Record<LessonTab, string[]> = {
    slippage: ["Current Price", "Slippage", "Trade Cost"],
    il: ["LP Value", "HODL Value", "Impermanent Loss"],
    arbitrage: ["Current Price", "Pool Price", "External Price"],
    fees: ["Fee Revenue", "Net LP Return"],
    volatility: ["Impermanent Loss", "Fee Revenue", "Net LP Return"],
    concentrated: ["Capital Efficiency", "In Range"]
  };
  const hl = highlights[tab] || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Live Metrics */}
      <div className="p-3 border-b border-border shrink-0">
        <h2 className="text-[10px] font-mono font-semibold text-muted-foreground mb-2 tracking-wider uppercase">Live Metrics</h2>
        <div className="space-y-0.5">
          <MetricRow label="Current Price" value={currentPrice.toFixed(4)} highlight={hl.includes("Current Price")} />
          <MetricRow label="Slippage" value={lastTrade ? `${lastTrade.slippagePct.toFixed(2)}%` : "—"} highlight={hl.includes("Slippage")} />
          <MetricRow label="LP Value" value={lpVal.toFixed(2)} highlight={hl.includes("LP Value")} />
          <MetricRow label="HODL Value" value={hodlVal.toFixed(2)} highlight={hl.includes("HODL Value")} />
          <MetricRow label="Impermanent Loss" value={`${il.toFixed(2)}%`} highlight={hl.includes("Impermanent Loss")} positive={il >= 0 ? true : false} />
          <MetricRow label="Fee Revenue" value={pool.totalFees.toFixed(2)} highlight={hl.includes("Fee Revenue")} positive={pool.totalFees > 0 ? true : null} />
          <MetricRow label="Net LP Return" value={`${((lpVal + pool.totalFees - hodlVal) / hodlVal * 100).toFixed(2)}%`} highlight={hl.includes("Net LP Return")} positive={lpVal + pool.totalFees - hodlVal >= 0 ? true : false} />
          <MetricRow label="Trade Cost" value={lastTrade ? lastTrade.feesPaid.toFixed(2) : "—"} highlight={hl.includes("Trade Cost")} />
          {tab === "concentrated" &&
          <>
              <MetricRow label="In Range" value={inRange ? "Yes ✓" : "No ✗"} highlight positive={inRange ? true : false} />
              <MetricRow label="Capital Efficiency" value={`${capEff.toFixed(1)}x`} highlight={hl.includes("Capital Efficiency")} />
            </>
          }
        </div>
      </div>

      {/* Explanation */}
      




      {/* AI Assistant */}
      <div className="flex-1 min-h-0">
        <AIChatPanel />
      </div>
    </div>);

}