import { useState, useCallback } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import { fetchPriceHistory, runBacktest, type BacktestResult } from "@/lib/historical-backtest";

interface Props {
  bins: number[];
  name: string;
}

const PAIRS = ["ETH-USDC", "BTC-USDC", "SOL-USDC"];
const TIMEFRAMES = [
  { label: "90d", days: 90 },
  { label: "180d", days: 180 },
  { label: "365d", days: 365 },
];

export default function HistoricalBacktest({ bins, name }: Props) {
  const colors = useChartColors();
  const [pair, setPair] = useState("ETH-USDC");
  const [days, setDays] = useState(365);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const prices = await fetchPriceHistory(pair, days);
      const res = runBacktest(bins, prices);
      setResult(res);
    } catch (e) {
      console.error("Backtest error:", e);
    } finally {
      setLoading(false);
    }
  }, [bins, pair, days]);

  return (
    <div className="border border-border rounded-xl p-4 bg-card">
      <h3 className="text-xs font-bold text-foreground mb-3">Historical Backtest — {name}</h3>

      <div className="flex flex-wrap gap-2 mb-3">
        {PAIRS.map(p => (
          <button key={p} onClick={() => setPair(p)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-mono transition-colors border ${
              pair === p ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:text-foreground"
            }`}>{p}</button>
        ))}
        <div className="w-px bg-border mx-1" />
        {TIMEFRAMES.map(t => (
          <button key={t.days} onClick={() => setDays(t.days)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-mono transition-colors border ${
              days === t.days ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:text-foreground"
            }`}>{t.label}</button>
        ))}
        <button onClick={run} disabled={loading}
          className="ml-auto px-3 py-1 rounded-md text-[10px] font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
          {loading ? "Running…" : "Run Backtest"}
        </button>
      </div>

      {result && (
        <>
          <div className="h-52 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.equityCurve} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis dataKey="day" tick={{ fontSize: 8, fill: colors.tick }} />
                <YAxis tick={{ fontSize: 8, fill: colors.tick }} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Line type="monotone" dataKey="lpValue" name="LP Value" stroke={colors.line} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="hodlValue" name="HODL" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="fees" name="Cum. Fees" stroke="hsl(var(--primary))" strokeWidth={1} dot={false} opacity={0.6} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "LP vs HODL", value: `${(result.lpVsHodl * 100).toFixed(1)}%`, good: result.lpVsHodl >= 1 },
              { label: "Total Fees", value: `${(result.totalFees * 100).toFixed(2)}%`, good: true },
              { label: "Imp. Loss", value: `${(result.totalIL * 100).toFixed(2)}%`, good: result.totalIL < 0.05 },
              { label: "Max Drawdown", value: `${(result.maxDrawdown * 100).toFixed(1)}%`, good: result.maxDrawdown < 0.2 },
              { label: "Sharpe Ratio", value: result.sharpeRatio.toFixed(2), good: result.sharpeRatio > 0.5 },
              { label: "Final LP", value: `${(result.finalLpValue * 100).toFixed(1)}%`, good: result.finalLpValue >= 1 },
            ].map(m => (
              <div key={m.label} className="p-2 rounded-lg bg-secondary border border-border text-center">
                <p className="text-[8px] text-muted-foreground mb-0.5">{m.label}</p>
                <p className={`text-[11px] font-mono font-bold ${m.good ? "text-green-500" : "text-destructive"}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {!result && !loading && (
        <p className="text-[10px] text-muted-foreground text-center py-6">
          Select a pair and timeframe, then click "Run Backtest" to simulate LP performance against historical prices.
        </p>
      )}
    </div>
  );
}
