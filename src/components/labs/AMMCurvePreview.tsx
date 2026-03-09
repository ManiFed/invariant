import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useChartTheme } from "@/hooks/use-chart-theme";
import {
  type AMMDesign,
  evaluateAMMCurve,
  compileAMMDesign,
} from "@/lib/amm-blocks";

interface Props {
  design: AMMDesign;
  k?: number;
  showBaseline?: boolean;
}

export default function AMMCurvePreview({ design, k = 10000, showBaseline = true }: Props) {
  const chartTheme = useChartTheme();

  const { curveData, baselineData, compiled } = useMemo(() => {
    const curveData = evaluateAMMCurve(design, k, 100);
    
    // Baseline: constant product x * y = k
    const baselineData = curveData.map((p) => ({
      x: p.x,
      y: k / p.x,
    }));

    const compiled = compileAMMDesign(design);

    return { curveData, baselineData, compiled };
  }, [design, k]);

  // Find reasonable axis bounds
  const maxX = curveData.length > 0 ? Math.max(...curveData.map((p) => p.x)) : 200;
  const maxY = curveData.length > 0 ? Math.max(...curveData.map((p) => p.y)) : 200;

  return (
    <div className="h-full flex flex-col">
      {/* Formula display */}
      <div className="surface-elevated rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-foreground">
            Compiled Formula
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            {compiled.curveType}
          </span>
        </div>
        <div className="font-mono text-xs text-foreground bg-secondary rounded-lg p-2 border border-border overflow-x-auto">
          {compiled.formula}
        </div>
        {compiled.feeLogic && (
          <p className="text-[9px] text-muted-foreground mt-1.5">
            Fee: {compiled.feeLogic}
          </p>
        )}
      </div>

      {/* Curve chart */}
      <div className="flex-1 surface-elevated rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-foreground">
            Curve Visualization
          </span>
          <span className="text-[9px] text-muted-foreground">
            k = {k.toLocaleString()}
          </span>
        </div>

        <div className="h-[calc(100%-24px)]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 10, right: 10, bottom: 20, left: 40 }}>
              <XAxis
                dataKey="x"
                type="number"
                domain={[0, maxX]}
                tick={{ fontSize: 9, fill: chartTheme.text }}
                axisLine={{ stroke: chartTheme.grid }}
                tickLine={{ stroke: chartTheme.grid }}
                label={{ value: "Reserve X", position: "bottom", fontSize: 9, fill: chartTheme.text }}
              />
              <YAxis
                type="number"
                domain={[0, maxY * 1.1]}
                tick={{ fontSize: 9, fill: chartTheme.text }}
                axisLine={{ stroke: chartTheme.grid }}
                tickLine={{ stroke: chartTheme.grid }}
                label={{ value: "Reserve Y", angle: -90, position: "left", fontSize: 9, fill: chartTheme.text }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: chartTheme.background,
                  border: `1px solid ${chartTheme.grid}`,
                  borderRadius: 8,
                  fontSize: 10,
                }}
                labelStyle={{ color: chartTheme.text }}
                formatter={(value: number) => [value.toFixed(2), ""]}
                labelFormatter={(x) => `x = ${Number(x).toFixed(2)}`}
              />

              {/* Baseline (constant product) */}
              {showBaseline && baselineData.length > 0 && (
                <Line
                  data={baselineData}
                  dataKey="y"
                  type="monotone"
                  stroke={chartTheme.grid}
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  dot={false}
                  name="Baseline (xy=k)"
                />
              )}

              {/* User's curve */}
              {curveData.length > 0 && (
                <Line
                  data={curveData}
                  dataKey="y"
                  type="monotone"
                  stroke={chartTheme.primary}
                  strokeWidth={2}
                  dot={false}
                  name="Your Curve"
                />
              )}

              {/* Reference lines at √k */}
              <ReferenceLine
                x={Math.sqrt(k)}
                stroke={chartTheme.accent}
                strokeDasharray="2 2"
                strokeOpacity={0.5}
              />
              <ReferenceLine
                y={Math.sqrt(k)}
                stroke={chartTheme.accent}
                strokeDasharray="2 2"
                strokeOpacity={0.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="surface-elevated rounded-lg p-2 text-center">
          <p className="text-[8px] text-muted-foreground uppercase">Type</p>
          <p className="text-[10px] font-semibold text-foreground capitalize">
            {compiled.curveType.replace("-", " ")}
          </p>
        </div>
        <div className="surface-elevated rounded-lg p-2 text-center">
          <p className="text-[8px] text-muted-foreground uppercase">Blocks</p>
          <p className="text-[10px] font-semibold text-foreground">
            {design.blocks.length}
          </p>
        </div>
        <div className="surface-elevated rounded-lg p-2 text-center">
          <p className="text-[8px] text-muted-foreground uppercase">Points</p>
          <p className="text-[10px] font-semibold text-foreground">
            {curveData.length}
          </p>
        </div>
      </div>
    </div>
  );
}
