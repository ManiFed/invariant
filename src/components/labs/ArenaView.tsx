import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import type { EngineState, Candidate, RegimeId } from "@/lib/discovery-engine";
import {
  REGIMES,
  generatePricePath,
  TOTAL_LIQUIDITY,
  FEE_RATE,
  ARB_THRESHOLD,
  DT,
  FAST_PATH_STEPS,
  deriveReserves,
  priceImpact,
} from "@/lib/discovery-engine";

interface ArenaViewProps {
  state: EngineState;
  onSelectCandidate: (id: string) => void;
}

/** Simulate one step on a working copy of bins */
function simulateStep(
  bins: Float64Array,
  currentLogPrice: number,
  externalLogPrice: number,
  cumulativeFees: number,
): { feeDelta: number; cumulativeFees: number; lpValue: number; slippage: number; nextLogPrice: number } {
  let feeDelta = 0;

  // Random trade flow
  const tradeSize = TOTAL_LIQUIDITY * 0.01 * Math.exp((Math.random() - 0.5) * 1.0);
  const direction: "buy" | "sell" = Math.random() < 0.5 ? "buy" : "sell";
  const fee = tradeSize * FEE_RATE;
  const effectiveSize = tradeSize - fee;
  feeDelta += fee;

  const { slippage, newLogPrice } = priceImpact(bins, currentLogPrice, effectiveSize, direction);
  let nextLogPrice = newLogPrice;

  // Arb correction
  const deviation = Math.abs(nextLogPrice - externalLogPrice);
  if (deviation > ARB_THRESHOLD) {
    const arbFee = deviation * TOTAL_LIQUIDITY * 0.1 * FEE_RATE;
    feeDelta += arbFee;
    nextLogPrice = externalLogPrice;
  }

  const updatedFees = cumulativeFees + feeDelta;
  const { reserveX, reserveY } = deriveReserves(bins, externalLogPrice);
  const price = Math.exp(externalLogPrice);
  const lpValue = reserveX * price + reserveY + updatedFees;

  return { feeDelta, cumulativeFees: updatedFees, lpValue, slippage, nextLogPrice };
}

export default function ArenaView({ state, onSelectCandidate }: ArenaViewProps) {
  const chartColors = useChartColors();
  const [candidateA, setCandidateA] = useState<string>("");
  const [candidateB, setCandidateB] = useState<string>("");
  const [regime, setRegime] = useState<RegimeId>("low-vol");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [battleData, setBattleData] = useState<any[] | null>(null);
  const playRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topCandidates = useMemo(() => {
    return [...state.archive]
      .sort((a, b) => a.score - b.score)
      .slice(0, 30);
  }, [state.archive]);

  const runBattle = useCallback(() => {
    const a = state.archive.find(c => c.id === candidateA);
    const b = state.archive.find(c => c.id === candidateB);
    if (!a || !b) return;

    const regimeConfig = REGIMES.find(r => r.id === regime)!;
    const path = generatePricePath(regimeConfig, FAST_PATH_STEPS, DT);

    const data: any[] = [];
    let feesA = 0, feesB = 0;
    let logPriceA = 0, logPriceB = 0;

    for (let t = 0; t <= FAST_PATH_STEPS; t++) {
      const extPrice = path[t];

      if (t > 0) {
        const stepA = simulateStep(a.bins, logPriceA, extPrice, feesA);
        const stepB = simulateStep(b.bins, logPriceB, extPrice, feesB);
        feesA = stepA.cumulativeFees;
        feesB = stepB.cumulativeFees;
        logPriceA = stepA.nextLogPrice;
        logPriceB = stepB.nextLogPrice;

        data.push({
          step: t,
          price: Math.exp(extPrice).toFixed(3),
          lpA: parseFloat(stepA.lpValue.toFixed(2)),
          lpB: parseFloat(stepB.lpValue.toFixed(2)),
          feesA: parseFloat(feesA.toFixed(2)),
          feesB: parseFloat(feesB.toFixed(2)),
          delta: parseFloat((stepA.lpValue - stepB.lpValue).toFixed(2)),
        });
      } else {
        data.push({
          step: 0,
          price: "1.000",
          lpA: TOTAL_LIQUIDITY,
          lpB: TOTAL_LIQUIDITY,
          feesA: 0,
          feesB: 0,
          delta: 0,
        });
      }
    }

    setBattleData(data);
    setCurrentStep(0);
  }, [candidateA, candidateB, regime, state.archive]);

  // Animate playback
  useEffect(() => {
    if (!isPlaying || !battleData) return;
    playRef.current = true;

    const animate = () => {
      if (!playRef.current) return;
      setCurrentStep(prev => {
        if (prev >= battleData.length - 1) {
          setIsPlaying(false);
          playRef.current = false;
          return prev;
        }
        timerRef.current = setTimeout(animate, 60);
        return prev + 1;
      });
    };
    timerRef.current = setTimeout(animate, 60);

    return () => {
      playRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, battleData]);

  const visibleData = battleData?.slice(0, currentStep + 1) ?? [];
  const lastPoint = visibleData[visibleData.length - 1];

  const cA = state.archive.find(c => c.id === candidateA);
  const cB = state.archive.find(c => c.id === candidateB);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex items-center gap-2">
        <Swords className="w-4 h-4 text-foreground" />
        <h3 className="text-sm font-bold text-foreground">Head-to-Head Arena</h3>
      </div>

      {/* Candidate Selection */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[9px] text-muted-foreground block mb-1">Candidate A</label>
          <select
            value={candidateA}
            onChange={e => setCandidateA(e.target.value)}
            className="text-[10px] px-2 py-1.5 rounded border border-border bg-background w-full"
          >
            <option value="">Select...</option>
            {topCandidates.map(c => (
              <option key={c.id} value={c.id}>
                {c.familyId} · {c.regime} · {c.score.toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground block mb-1">Candidate B</label>
          <select
            value={candidateB}
            onChange={e => setCandidateB(e.target.value)}
            className="text-[10px] px-2 py-1.5 rounded border border-border bg-background w-full"
          >
            <option value="">Select...</option>
            {topCandidates.map(c => (
              <option key={c.id} value={c.id}>
                {c.familyId} · {c.regime} · {c.score.toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground block mb-1">Regime</label>
          <select
            value={regime}
            onChange={e => setRegime(e.target.value as RegimeId)}
            className="text-[10px] px-2 py-1.5 rounded border border-border bg-background w-full"
          >
            {REGIMES.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={runBattle} disabled={!candidateA || !candidateB}>
          <Swords className="w-3 h-3 mr-1" /> Battle
        </Button>
        {battleData && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setIsPlaying(!isPlaying); }}
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCurrentStep(0); setIsPlaying(false); }}>
              <RotateCcw className="w-3 h-3" />
            </Button>
            <span className="text-[9px] text-muted-foreground ml-auto">
              Step {currentStep} / {battleData.length - 1}
            </span>
          </>
        )}
      </div>

      {/* Battle Chart */}
      {battleData && (
        <div className="surface-elevated rounded-xl p-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visibleData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="step" tick={{ fontSize: 7, fill: chartColors.tick }} />
                <YAxis tick={{ fontSize: 7, fill: chartColors.tick }} width={50} />
                <Tooltip
                  contentStyle={{
                    background: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: 8,
                    fontSize: 9,
                    color: chartColors.tooltipText,
                  }}
                />
                <ReferenceLine y={TOTAL_LIQUIDITY} stroke={chartColors.grid} strokeDasharray="3 3" />
                <Line type="monotone" dataKey="lpA" stroke="hsl(142, 72%, 45%)" dot={false} strokeWidth={2} name="Candidate A" />
                <Line type="monotone" dataKey="lpB" stroke="hsl(38, 92%, 50%)" dot={false} strokeWidth={2} name="Candidate B" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Score Summary */}
      {lastPoint && cA && cB && (
        <div className="grid grid-cols-3 gap-3">
          <div className="surface-elevated rounded-xl p-3 border-l-2" style={{ borderLeftColor: "hsl(142, 72%, 45%)" }}>
            <p className="text-[9px] text-muted-foreground">Candidate A</p>
            <p className="text-xs font-bold text-foreground">{cA.familyId}</p>
            <p className="text-[10px] font-mono text-foreground mt-1">LP: {lastPoint.lpA}</p>
            <p className="text-[9px] font-mono text-muted-foreground">Fees: {lastPoint.feesA}</p>
          </div>
          <div className="surface-elevated rounded-xl p-3 text-center">
            <p className="text-[9px] text-muted-foreground">Delta</p>
            <p className={`text-lg font-bold font-mono ${lastPoint.delta > 0 ? "text-success" : lastPoint.delta < 0 ? "text-destructive" : "text-foreground"}`}>
              {lastPoint.delta > 0 ? "+" : ""}{lastPoint.delta}
            </p>
            <p className="text-[9px] text-muted-foreground mt-1">
              {lastPoint.delta > 0 ? "A leads" : lastPoint.delta < 0 ? "B leads" : "Tied"}
            </p>
          </div>
          <div className="surface-elevated rounded-xl p-3 border-l-2" style={{ borderLeftColor: "hsl(38, 92%, 50%)" }}>
            <p className="text-[9px] text-muted-foreground">Candidate B</p>
            <p className="text-xs font-bold text-foreground">{cB.familyId}</p>
            <p className="text-[10px] font-mono text-foreground mt-1">LP: {lastPoint.lpB}</p>
            <p className="text-[9px] font-mono text-muted-foreground">Fees: {lastPoint.feesB}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
