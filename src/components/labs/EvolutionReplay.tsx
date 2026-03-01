import { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid,
} from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import type { EngineState, RegimeId, Candidate } from "@/lib/discovery-engine";
import { NUM_BINS, binPrice } from "@/lib/discovery-engine";

const REGIME_COLORS: Record<RegimeId, string> = {
  "low-vol": "hsl(142, 72%, 45%)",
  "high-vol": "hsl(38, 92%, 50%)",
  "jump-diffusion": "hsl(0, 72%, 55%)",
  "regime-shift": "hsl(270, 65%, 55%)",
};

interface EvolutionReplayProps {
  state: EngineState;
}

interface Snapshot {
  generation: number;
  regime: RegimeId;
  score: number;
  bins: number[];
  familyId: string;
  timestamp: number;
}

export default function EvolutionReplay({ state }: EvolutionReplayProps) {
  const chartColors = useChartColors();
  const [regimeFilter, setRegimeFilter] = useState<RegimeId>("low-vol");
  const [playbackIdx, setPlaybackIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef(false);
  const snapshotsRef = useRef<Snapshot[]>([]);

  // Build snapshots from champion-replaced events + current champions
  const snapshots = useMemo(() => {
    const snaps: Snapshot[] = [];

    // Extract from archive: group by regime, sort by generation, take best per generation
    const regimeArchive = state.archive.filter(c => c.regime === regimeFilter);
    const byGen = new Map<number, Candidate>();
    for (const c of regimeArchive) {
      const existing = byGen.get(c.generation);
      if (!existing || c.score < existing.score) {
        byGen.set(c.generation, c);
      }
    }

    const sorted = [...byGen.entries()].sort((a, b) => a[0] - b[0]);
    for (const [gen, c] of sorted) {
      snaps.push({
        generation: gen,
        regime: c.regime,
        score: c.score,
        bins: Array.from(c.bins),
        familyId: c.familyId,
        timestamp: c.timestamp,
      });
    }

    // Add current champion if not already present
    const champion = state.populations[regimeFilter]?.champion;
    if (champion && !snaps.find(s => s.generation === champion.generation)) {
      snaps.push({
        generation: champion.generation,
        regime: champion.regime,
        score: champion.score,
        bins: Array.from(champion.bins),
        familyId: champion.familyId,
        timestamp: champion.timestamp,
      });
    }

    snaps.sort((a, b) => a.generation - b.generation);

    // Keep last 200 snapshots
    return snaps.slice(-200);
  }, [state.archive, state.populations, regimeFilter]);

  // Update ref for animation
  snapshotsRef.current = snapshots;

  // Clamp playback index when snapshots change
  useEffect(() => {
    if (playbackIdx >= snapshots.length) {
      setPlaybackIdx(Math.max(0, snapshots.length - 1));
    }
  }, [snapshots.length, playbackIdx]);

  // Playback animation
  useEffect(() => {
    if (!isPlaying) return;
    playRef.current = true;

    const animate = () => {
      if (!playRef.current) return;
      setPlaybackIdx(prev => {
        if (prev >= snapshotsRef.current.length - 1) {
          setIsPlaying(false);
          playRef.current = false;
          return prev;
        }
        setTimeout(animate, 120);
        return prev + 1;
      });
    };
    setTimeout(animate, 120);

    return () => { playRef.current = false; };
  }, [isPlaying]);

  const currentSnapshot = snapshots[playbackIdx];
  const color = REGIME_COLORS[regimeFilter];

  // Liquidity shape data for current snapshot
  const shapeData = useMemo(() => {
    if (!currentSnapshot) return [];
    return currentSnapshot.bins.map((w, i) => ({
      price: parseFloat(binPrice(i).toFixed(3)),
      weight: parseFloat(w.toFixed(4)),
    }));
  }, [currentSnapshot]);

  // Score trajectory
  const trajectoryData = useMemo(() => {
    return snapshots.map((s, i) => ({
      idx: i,
      gen: s.generation,
      score: parseFloat(s.score.toFixed(3)),
      family: s.familyId,
    }));
  }, [snapshots]);

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No evolution history yet. The engine needs to run for a while to collect snapshots.
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-bold text-foreground">Evolution Replay</h3>
        </div>
        <select
          value={regimeFilter}
          onChange={e => { setRegimeFilter(e.target.value as RegimeId); setPlaybackIdx(0); }}
          className="text-[10px] px-2 py-1 rounded border border-border bg-background"
        >
          <option value="low-vol">Low Volatility</option>
          <option value="high-vol">High Volatility</option>
          <option value="jump-diffusion">Jump Diffusion</option>
        </select>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setPlaybackIdx(0)}>
          <SkipBack className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPlaybackIdx(snapshots.length - 1)}>
          <SkipForward className="w-3 h-3" />
        </Button>
        <div className="flex-1 px-2">
          <Slider
            value={[playbackIdx]}
            max={Math.max(0, snapshots.length - 1)}
            step={1}
            onValueChange={v => setPlaybackIdx(v[0])}
          />
        </div>
        <span className="text-[9px] font-mono text-muted-foreground whitespace-nowrap">
          {playbackIdx + 1} / {snapshots.length}
        </span>
      </div>

      {/* Current Info */}
      {currentSnapshot && (
        <div className="flex items-center gap-4 text-[10px]">
          <span className="text-muted-foreground">Gen <span className="font-mono font-bold text-foreground">{currentSnapshot.generation}</span></span>
          <span className="text-muted-foreground">Score <span className="font-mono font-bold text-foreground">{currentSnapshot.score.toFixed(3)}</span></span>
          <span className="text-muted-foreground">Family <span className="font-bold text-foreground">{currentSnapshot.familyId}</span></span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Morphing Liquidity Shape */}
        <div className="surface-elevated rounded-xl p-4">
          <h4 className="text-[10px] font-semibold text-foreground mb-2">Liquidity Shape</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={shapeData}>
                <defs>
                  <linearGradient id="replayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="price" tick={{ fontSize: 7, fill: chartColors.tick }} tickCount={5} />
                <YAxis tick={{ fontSize: 7, fill: chartColors.tick }} width={30} />
                <Tooltip
                  contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 9, color: chartColors.tooltipText }}
                />
                <Area type="monotone" dataKey="weight" stroke={color} fill="url(#replayGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score Trajectory */}
        <div className="surface-elevated rounded-xl p-4">
          <h4 className="text-[10px] font-semibold text-foreground mb-2">Score Trajectory</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajectoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="gen" tick={{ fontSize: 7, fill: chartColors.tick }} />
                <YAxis tick={{ fontSize: 7, fill: chartColors.tick }} width={40} />
                <Tooltip
                  contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 9, color: chartColors.tooltipText }}
                  formatter={(value: number) => [value.toFixed(3), "Score"]}
                />
                <Line
                  type="monotone" dataKey="score" stroke={color} dot={false} strokeWidth={1.5}
                />
                {/* Current position marker */}
                {trajectoryData[playbackIdx] && (
                  <Line
                    data={[trajectoryData[playbackIdx]]}
                    type="monotone" dataKey="score"
                    stroke={color}
                    dot={{ r: 5, fill: color, strokeWidth: 2, stroke: "white" }}
                    strokeWidth={0}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
