import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Plus, Trash2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid,
} from "recharts";

/* ─── Types ─── */
export interface Keyframe {
  id: string;
  t: number;
  weightA: number;
  weightB: number;
  feeRate: number;
  amplification: number;
}

export interface TimeSnapshot {
  t: number;
  x: number;
  y: number;
  price: number;
  weightA: number;
  weightB: number;
  feeRate: number;
  amp: number;
}

/* ─── Interpolation ─── */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function interpolateParams(keyframes: Keyframe[], t: number): { weightA: number; weightB: number; feeRate: number; amplification: number } {
  if (keyframes.length === 0) return { weightA: 0.5, weightB: 0.5, feeRate: 0.003, amplification: 10 };
  if (keyframes.length === 1) return keyframes[0];
  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  if (t <= sorted[0].t) return sorted[0];
  if (t >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1];
  let left = sorted[0], right = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].t && t <= sorted[i + 1].t) { left = sorted[i]; right = sorted[i + 1]; break; }
  }
  const progress = right.t === left.t ? 0 : (t - left.t) / (right.t - left.t);
  return { weightA: lerp(left.weightA, right.weightA, progress), weightB: lerp(left.weightB, right.weightB, progress), feeRate: lerp(left.feeRate, right.feeRate, progress), amplification: lerp(left.amplification, right.amplification, progress) };
}

export function computeCurveAtTime(wA: number, wB: number, k: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 1; i <= 50; i++) {
    const x = i * 4;
    const y = Math.pow(k / Math.pow(x, wA), 1 / wB);
    if (y > 0 && y < k * 10 && isFinite(y)) pts.push({ x, y: parseFloat(y.toFixed(2)) });
  }
  return pts;
}

export function computeTimeline(keyframes: Keyframe[], reserveX: number, reserveY: number): TimeSnapshot[] {
  const k = Math.pow(reserveX, 0.5) * Math.pow(reserveY, 0.5) * 100;
  const snaps: TimeSnapshot[] = [];
  for (let t = 0; t <= 100; t += 1) {
    const params = interpolateParams(keyframes, t);
    const x = reserveX * (1 + 0.3 * Math.sin(t * 0.1));
    const yCalc = Math.pow(k / Math.pow(x, params.weightA), 1 / params.weightB);
    const price = isFinite(yCalc / x) ? yCalc / x : 1;
    snaps.push({ t, x: parseFloat(x.toFixed(2)), y: parseFloat((isFinite(yCalc) && yCalc > 0 ? yCalc : reserveY).toFixed(2)), price: parseFloat(price.toFixed(4)), weightA: parseFloat(params.weightA.toFixed(4)), weightB: parseFloat(params.weightB.toFixed(4)), feeRate: parseFloat(params.feeRate.toFixed(4)), amp: parseFloat(params.amplification.toFixed(2)) });
  }
  return snaps;
}

/* ─── Playback Controls ─── */
export function PlaybackControls({ time, isPlaying, speed, onTimeChange, onTogglePlay, onSpeedChange, onReset, onStepForward }: {
  time: number; isPlaying: boolean; speed: number; onTimeChange: (t: number) => void; onTogglePlay: () => void; onSpeedChange: (s: number) => void; onReset: () => void; onStepForward: () => void;
}) {
  return (
    <div className="p-3 rounded-lg bg-secondary border border-border space-y-2">
      <div className="flex items-center gap-2">
        <button onClick={onReset} className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors"><SkipBack className="w-3.5 h-3.5" /></button>
        <button onClick={onTogglePlay} className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity">{isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}</button>
        <button onClick={onStepForward} className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors"><SkipForward className="w-3.5 h-3.5" /></button>
        <div className="flex-1"><Slider min={0} max={100} step={1} value={[time]} onValueChange={([v]) => onTimeChange(v)} /></div>
        <span className="text-[10px] font-mono text-foreground w-10 text-right">t={Math.round(time)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-muted-foreground">Speed:</span>
        {[0.5, 1, 2, 5].map(s => (
          <button key={s} onClick={() => onSpeedChange(s)} className={`px-2 py-0.5 rounded text-[9px] font-mono transition-all ${speed === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-background"}`}>{s}x</button>
        ))}
      </div>
    </div>
  );
}

/* ─── Timeline Editor ─── */
export function TimelineEditor({ keyframes, onChange, currentTime }: {
  keyframes: Keyframe[]; onChange: (kfs: Keyframe[]) => void; currentTime: number;
}) {
  const addKeyframe = () => {
    onChange([...keyframes, { id: String(Date.now()), t: Math.round(currentTime), weightA: 0.5, weightB: 0.5, feeRate: 0.003, amplification: 10 }].sort((a, b) => a.t - b.t));
  };
  const updateKeyframe = (id: string, field: keyof Keyframe, value: number) => {
    onChange(keyframes.map(kf => kf.id === id ? { ...kf, [field]: value } : kf));
  };
  const removeKeyframe = (id: string) => {
    if (keyframes.length <= 1) return;
    onChange(keyframes.filter(kf => kf.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground">Parameter Timeline</h3>
        <button onClick={addKeyframe} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"><Plus className="w-3 h-3" /> Add Keyframe</button>
      </div>
      <div className="relative h-8 rounded-lg bg-secondary border border-border overflow-hidden">
        <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-10" style={{ left: `${currentTime}%` }} />
        {keyframes.map(kf => <div key={kf.id} className="absolute top-1 bottom-1 w-2 rounded-full bg-chart-2 border border-background cursor-pointer hover:scale-125 transition-transform" style={{ left: `calc(${kf.t}% - 4px)` }} title={`t=${kf.t}`} />)}
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {keyframes.map((kf, i) => (
          <div key={kf.id} className="p-2 rounded-lg bg-background border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-chart-2 font-bold">Keyframe {i + 1} — t={kf.t}</span>
              {keyframes.length > 1 && <button onClick={() => removeKeyframe(kf.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3 h-3" /></button>}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div><label className="text-[8px] text-muted-foreground">Time (0–100)</label><input type="number" min={0} max={100} value={kf.t} onChange={e => updateKeyframe(kf.id, "t", Number(e.target.value))} className="w-full px-1.5 py-0.5 text-[9px] font-mono bg-secondary rounded border border-border text-foreground" /></div>
              <div><label className="text-[8px] text-muted-foreground">Weight A</label><input type="number" step={0.05} min={0.01} max={0.99} value={kf.weightA} onChange={e => updateKeyframe(kf.id, "weightA", Number(e.target.value))} className="w-full px-1.5 py-0.5 text-[9px] font-mono bg-secondary rounded border border-border text-foreground" /></div>
              <div><label className="text-[8px] text-muted-foreground">Weight B</label><input type="number" step={0.05} min={0.01} max={0.99} value={kf.weightB} onChange={e => updateKeyframe(kf.id, "weightB", Number(e.target.value))} className="w-full px-1.5 py-0.5 text-[9px] font-mono bg-secondary rounded border border-border text-foreground" /></div>
              <div><label className="text-[8px] text-muted-foreground">Fee Rate</label><input type="number" step={0.001} min={0} max={0.1} value={kf.feeRate} onChange={e => updateKeyframe(kf.id, "feeRate", Number(e.target.value))} className="w-full px-1.5 py-0.5 text-[9px] font-mono bg-secondary rounded border border-border text-foreground" /></div>
              <div className="col-span-2"><label className="text-[8px] text-muted-foreground">Amplification</label><input type="number" step={1} min={1} max={1000} value={kf.amplification} onChange={e => updateKeyframe(kf.id, "amplification", Number(e.target.value))} className="w-full px-1.5 py-0.5 text-[9px] font-mono bg-secondary rounded border border-border text-foreground" /></div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-2.5 rounded-lg bg-secondary border border-border space-y-1">
        <p className="text-[9px] text-muted-foreground">Time-Dependent Expression</p>
        <p className="text-[10px] font-mono text-foreground">x^w₁(t) · y^w₂(t) = k</p>
        <p className="text-[8px] text-muted-foreground">w₁(t) and w₂(t) interpolate between keyframes. Fee rate and amplification also vary.</p>
      </div>
    </div>
  );
}

/* ─── Time-Variance Visualization Panel ─── */
export function TimeVariancePanel() {
  const [keyframes, setKeyframes] = useState<Keyframe[]>([
    { id: "1", t: 0, weightA: 0.5, weightB: 0.5, feeRate: 0.003, amplification: 10 },
    { id: "2", t: 50, weightA: 0.7, weightB: 0.3, feeRate: 0.005, amplification: 50 },
    { id: "3", t: 100, weightA: 0.5, weightB: 0.5, feeRate: 0.003, amplification: 10 },
  ]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const reserveX = 1000, reserveY = 1000;
  const [vizMode, setVizMode] = useState<"curve" | "params" | "price" | "snapshot">("curve");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => { const next = prev + speed * 0.5; if (next >= 100) { setIsPlaying(false); return 100; } return next; });
      }, 50);
    } else { if (intervalRef.current) clearInterval(intervalRef.current); }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, speed]);

  const currentParams = useMemo(() => interpolateParams(keyframes, currentTime), [keyframes, currentTime]);
  const k = 10000;
  const curveData = useMemo(() => computeCurveAtTime(currentParams.weightA, currentParams.weightB, k), [currentParams]);
  const timeline = useMemo(() => computeTimeline(keyframes, reserveX, reserveY), [keyframes, reserveX, reserveY]);
  const currentSnap = timeline[Math.min(Math.round(currentTime), timeline.length - 1)] || timeline[0];

  const tooltipStyle = { backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "10px", color: "hsl(var(--foreground))" };

  return (
    <div className="space-y-6">
      {/* Playback + Status */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <PlaybackControls time={currentTime} isPlaying={isPlaying} speed={speed} onTimeChange={setCurrentTime} onTogglePlay={() => setIsPlaying(p => !p)} onSpeedChange={setSpeed} onReset={() => { setCurrentTime(0); setIsPlaying(false); }} onStepForward={() => setCurrentTime(prev => Math.min(100, prev + 5))} />
          <TimelineEditor keyframes={keyframes} onChange={setKeyframes} currentTime={currentTime} />
        </div>
        <div className="space-y-4">
          <div className="flex gap-1.5 flex-wrap">
            {(["curve", "params", "price", "snapshot"] as const).map(m => (
              <button key={m} onClick={() => setVizMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${vizMode === m ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"}`}>
                {m === "curve" ? "Invariant Curve" : m === "params" ? "Parameters" : m === "price" ? "Price Over Time" : "Snapshot"}
              </button>
            ))}
          </div>

          {vizMode === "curve" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-foreground">Invariant Curve at t={Math.round(currentTime)}</h3>
                <span className="text-[9px] font-mono text-muted-foreground">x^{currentParams.weightA.toFixed(2)} · y^{currentParams.weightB.toFixed(2)} = k</span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curveData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="x" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} />
                    <Line type="monotone" dataKey="y" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {vizMode === "params" && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-foreground">Parameter Evolution Over Time</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="t" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} />
                    <Line type="monotone" dataKey="weightA" name="Weight A" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="weightB" name="Weight B" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="feeRate" name="Fee Rate" stroke="hsl(var(--chart-3))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <h3 className="text-xs font-bold text-foreground">Amplification Over Time</h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="t" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} />
                    <Area type="monotone" dataKey="amp" name="Amplification" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {vizMode === "price" && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-foreground">Price Evolution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="t" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} />
                    <Line type="monotone" dataKey="price" name="Price (Y/X)" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] font-bold text-foreground mb-2">Reserves Over Time</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="t" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} />
                    <Line type="monotone" dataKey="x" name="Reserve X" stroke="hsl(var(--chart-2))" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="y" name="Reserve Y" stroke="hsl(var(--chart-3))" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {vizMode === "snapshot" && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-foreground">Snapshot at t={Math.round(currentTime)}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Reserve X", value: currentSnap?.x?.toFixed(2) ?? "—" },
                  { label: "Reserve Y", value: currentSnap?.y?.toFixed(2) ?? "—" },
                  { label: "Price (Y/X)", value: currentSnap?.price?.toFixed(4) ?? "—" },
                  { label: "Weight A", value: currentParams.weightA.toFixed(4) },
                  { label: "Weight B", value: currentParams.weightB.toFixed(4) },
                  { label: "Fee Rate", value: `${(currentParams.feeRate * 100).toFixed(2)}%` },
                  { label: "Amplification", value: currentParams.amplification.toFixed(1) },
                  { label: "Time", value: `${Math.round(currentTime)} / 100` },
                  { label: "Keyframes", value: String(keyframes.length) },
                ].map((m, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary border border-border">
                    <p className="text-[9px] text-muted-foreground mb-0.5">{m.label}</p>
                    <p className="text-sm font-mono font-semibold text-foreground">{m.value}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-secondary border border-border">
                <p className="text-[9px] text-muted-foreground mb-1">Current Expression</p>
                <p className="text-xs font-mono text-foreground">x^{currentParams.weightA.toFixed(3)} · y^{currentParams.weightB.toFixed(3)} = k | fee={currentParams.feeRate.toFixed(4)} | A={currentParams.amplification.toFixed(1)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
