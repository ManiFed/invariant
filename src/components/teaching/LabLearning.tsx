import { useState, useMemo, useEffect } from "react";
import type { LessonTab } from "./LabControls";
import type { PoolState, TradeResult, HistoryPoint } from "@/lib/amm-engine";
import { poolPrice, calcIL, lpValue, hodlValue, isInRange, capitalEfficiency } from "@/lib/amm-engine";

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const QUESTION_BANK: Record<LessonTab, Question[]> = {
  slippage: [
    { question: "If you double the trade size, what happens to slippage?", options: ["Doubles", "More than doubles", "Stays same"], correctIndex: 1, explanation: "Slippage grows nonlinearly. Doubling trade size more than doubles slippage because the price curve is convex — each additional unit moves the price more than the previous one." },
    { question: "What happens to slippage if you double the pool reserves?", options: ["Halves", "Quarters", "Unchanged"], correctIndex: 0, explanation: "Larger pools absorb trades more easily. Doubling reserves roughly halves slippage for the same trade size because the trade represents a smaller fraction of the pool." },
  ],
  il: [
    { question: "If the price doubles, what's the approximate IL?", options: ["~2%", "~5.7%", "~25%"], correctIndex: 1, explanation: "When price doubles (r=2), IL = 2√2/(1+2) - 1 ≈ -5.7%. The loss comes from the pool automatically rebalancing — selling the appreciating asset as it rises." },
    { question: "Does IL depend on which direction price moves?", options: ["Only up", "Only down", "Both equally"], correctIndex: 2, explanation: "IL is symmetric — a 2x increase or 0.5x decrease produces the same IL percentage. The formula depends on the price ratio, not direction." },
  ],
  arbitrage: [
    { question: "Without arbitrageurs, what happens to the pool price?", options: ["Stays accurate", "Drifts from market", "Goes to zero"], correctIndex: 1, explanation: "Without arbitrage, the pool price only changes from trades within the pool. External market movements aren't reflected, causing the pool to become stale and mispriced." },
    { question: "Who pays for arbitrage corrections?", options: ["Arbitrageurs", "LPs (indirectly)", "The protocol"], correctIndex: 1, explanation: "LPs bear the cost — arbitrageurs extract value by trading against stale pool prices. This is the fundamental source of impermanent loss." },
  ],
  fees: [
    { question: "Can fees fully offset impermanent loss?", options: ["Always", "Sometimes", "Never"], correctIndex: 1, explanation: "It depends on trading volume vs price movement. High volume with moderate volatility can make LPs profitable. But during sharp, sustained trends, IL often exceeds fee revenue." },
    { question: "Higher fees attract more volume. True?", options: ["True", "False", "It depends"], correctIndex: 2, explanation: "Higher fees discourage trading. There's an optimal fee that maximizes total revenue — too low means little per-trade income, too high means fewer trades." },
  ],
  volatility: [
    { question: "Higher volatility means more fees. Is LP better off?", options: ["Yes, always", "No, IL grows faster", "Depends on fee tier"], correctIndex: 2, explanation: "Volatility drives both fees (from arb volume) and IL. Whether the LP profits depends on the fee tier relative to volatility. This is the fundamental LP tradeoff." },
    { question: "What price behavior is best for LPs?", options: ["Trending up", "Mean-reverting", "Flat"], correctIndex: 1, explanation: "Mean-reverting prices generate trading fees as prices oscillate, while trend reversals undo impermanent loss. Trending prices cause persistent IL as the pool rebalances in one direction." },
  ],
  concentrated: [
    { question: "Narrower range = higher capital efficiency. What's the tradeoff?", options: ["Higher fees always", "More range risk", "No tradeoff"], correctIndex: 1, explanation: "Tighter ranges amplify both fee yield AND risk. If price exits your range, you earn zero fees and hold 100% of the less valuable asset." },
    { question: "Price exits your range upward. What do you hold?", options: ["100% token X", "100% token Y", "50/50 mix"], correctIndex: 0, explanation: "When price rises above your upper bound, all your Y has been sold for X. You hold 100% of the (now relatively cheaper) X token." },
  ],
};

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

function MetricRow({ label, value, highlight, positive }: { label: string; value: string; highlight?: boolean; positive?: boolean | null }) {
  return (
    <div className={`flex items-center justify-between text-[11px] py-0.5 ${highlight ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${positive === true ? "text-success" : positive === false ? "text-destructive" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

export default function LabLearning({ pool, history, lastTrade, tab, initialX, initialY, initialPrice, rangeLower, rangeUpper }: Props) {
  const [qIndex, setQIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Reset question on tab change
  useEffect(() => { setQIndex(0); setAnswer(null); setRevealed(false); }, [tab]);

  const currentPrice = poolPrice(pool);
  const il = calcIL(initialPrice, currentPrice);
  const lpVal = lpValue(pool, currentPrice);
  const hodlVal = hodlValue(initialX, initialY, currentPrice);
  const inRange = isInRange(currentPrice, rangeLower * initialPrice, rangeUpper * initialPrice);
  const capEff = capitalEfficiency(rangeLower, rangeUpper);
  const latest = history.length > 0 ? history[history.length - 1] : null;

  const question = QUESTION_BANK[tab]?.[qIndex % QUESTION_BANK[tab].length];

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

  const handleAnswer = (idx: number) => {
    setAnswer(idx);
    setRevealed(true);
  };

  const nextQuestion = () => {
    setQIndex(i => i + 1);
    setAnswer(null);
    setRevealed(false);
  };

  // Highlight rules per tab
  const highlights: Record<LessonTab, string[]> = {
    slippage: ["Current Price", "Slippage", "Trade Cost"],
    il: ["LP Value", "HODL Value", "Impermanent Loss"],
    arbitrage: ["Current Price", "Pool Price", "External Price"],
    fees: ["Fee Revenue", "Net LP Return"],
    volatility: ["Impermanent Loss", "Fee Revenue", "Net LP Return"],
    concentrated: ["Capital Efficiency", "In Range"],
  };
  const hl = highlights[tab] || [];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Live Metrics */}
      <div className="p-3 border-b border-border">
        <h2 className="text-[10px] font-mono font-semibold text-muted-foreground mb-2 tracking-wider uppercase">Live Metrics</h2>
        <div className="space-y-0.5">
          <MetricRow label="Current Price" value={currentPrice.toFixed(4)} highlight={hl.includes("Current Price")} />
          <MetricRow label="Slippage" value={lastTrade ? `${lastTrade.slippagePct.toFixed(2)}%` : "—"} highlight={hl.includes("Slippage")} />
          <MetricRow label="LP Value" value={lpVal.toFixed(2)} highlight={hl.includes("LP Value")} />
          <MetricRow label="HODL Value" value={hodlVal.toFixed(2)} highlight={hl.includes("HODL Value")} />
          <MetricRow label="Impermanent Loss" value={`${il.toFixed(2)}%`} highlight={hl.includes("Impermanent Loss")} positive={il >= 0 ? true : false} />
          <MetricRow label="Fee Revenue" value={pool.totalFees.toFixed(2)} highlight={hl.includes("Fee Revenue")} positive={pool.totalFees > 0 ? true : null} />
          <MetricRow label="Net LP Return" value={`${((lpVal + pool.totalFees - hodlVal) / hodlVal * 100).toFixed(2)}%`} highlight={hl.includes("Net LP Return")} positive={(lpVal + pool.totalFees - hodlVal) >= 0 ? true : false} />
          <MetricRow label="Trade Cost" value={lastTrade ? lastTrade.feesPaid.toFixed(2) : "—"} highlight={hl.includes("Trade Cost")} />
          {tab === "concentrated" && (
            <>
              <MetricRow label="In Range" value={inRange ? "Yes ✓" : "No ✗"} highlight positive={inRange ? true : false} />
              <MetricRow label="Capital Efficiency" value={`${capEff.toFixed(1)}x`} highlight={hl.includes("Capital Efficiency")} />
            </>
          )}
        </div>
      </div>

      {/* Explanation */}
      <div className="p-3 border-b border-border">
        <h2 className="text-[10px] font-mono font-semibold text-muted-foreground mb-2 tracking-wider uppercase">Explanation</h2>
        <p className="text-xs text-foreground leading-relaxed">{explanation}</p>
      </div>

      {/* Interactive Question */}
      {question && (
        <div className="p-3 flex-1">
          <h2 className="text-[10px] font-mono font-semibold text-muted-foreground mb-2 tracking-wider uppercase">Test Your Intuition</h2>
          <p className="text-xs font-medium text-foreground mb-2">{question.question}</p>
          <div className="space-y-1.5">
            {question.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={revealed}
                className={`w-full text-left text-xs px-3 py-2 rounded-md border transition-all ${
                  revealed && i === question.correctIndex
                    ? "border-success bg-success/10 text-success"
                    : revealed && i === answer && i !== question.correctIndex
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : answer === i
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {revealed && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">{question.explanation}</p>
              <button onClick={nextQuestion}
                className="text-[10px] font-medium text-primary hover:underline">
                Next question →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
