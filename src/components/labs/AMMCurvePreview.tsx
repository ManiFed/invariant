import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import {
  type AMMDesign,
  type AMMBlockInstance,
  evaluateAMMCurve,
  compileAMMDesign,
} from "@/lib/amm-blocks";

interface ComparisonCurve {
  name: string;
  blocks: AMMBlockInstance[];
  color?: string;
}

interface Props {
  design: AMMDesign;
  k?: number;
  showBaseline?: boolean;
  comparisons?: ComparisonCurve[];
}

const COMPARISON_COLORS = ["#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

export default function AMMCurvePreview({ design, k = 10000, showBaseline = true, comparisons = [] }: Props) {
  const colors = useChartColors();

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

  // Generate comparison curve data
  const comparisonData = useMemo(() => {
    return comparisons.map((comp, i) => {
      const compDesign: AMMDesign = { id: `comp-${i}`, name: comp.name, blocks: comp.blocks };
      return {
        name: comp.name,
        color: comp.color || COMPARISON_COLORS[i % COMPARISON_COLORS.length],
        data: evaluateAMMCurve(compDesign, k, 100),
      };
    });
  }, [comparisons, k]);

  // Find reasonable axis bounds (including comparison curves)
  const allPoints = [
    ...curveData,
    ...comparisonData.flatMap((c) => c.data),
  ];
  const maxX = allPoints.length > 0 ? Math.max(...allPoints.map((p) => p.x)) : 200;
  const maxY = allPoints.length > 0 ? Math.max(...allPoints.map((p) => p.y)) : 200;

  // Collect all security/oracle blocks for display
  const specialBlocks = design.blocks.filter((b) => {
    const cat = b.blockId.startsWith("guard_") ? "security" : b.blockId.startsWith("oracle_") ? "oracle" : null;
    return cat !== null;
  });

  return (
    <div className="flex flex-col">
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
        {specialBlocks.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {specialBlocks.map((b) => (
              <span
                key={b.uid}
                className={`text-[8px] px-1.5 py-0.5 rounded-full border ${
                  b.blockId.startsWith("guard_")
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                }`}
              >
                {b.blockId.startsWith("guard_") ? "GUARD" : "ORACLE"}: {b.blockId.replace("guard_", "").replace("oracle_", "")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Curve chart */}
      <div className="min-h-[300px] surface-elevated rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-foreground">
            Curve Visualization
          </span>
          <div className="flex items-center gap-2">
            {comparisonData.length > 0 && (
              <span className="text-[9px] text-muted-foreground">
                +{comparisonData.length} overlay{comparisonData.length > 1 ? "s" : ""}
              </span>
            )}
            <span className="text-[9px] text-muted-foreground">
              k = {k.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 10, right: 10, bottom: 20, left: 40 }}>
              <XAxis
                dataKey="x"
                type="number"
                domain={[0, maxX]}
                tick={{ fontSize: 9, fill: colors.tick }}
                axisLine={{ stroke: colors.grid }}
                tickLine={{ stroke: colors.grid }}
                label={{ value: "Reserve X", position: "bottom", fontSize: 9, fill: colors.tick }}
              />
              <YAxis
                type="number"
                domain={[0, maxY * 1.1]}
                tick={{ fontSize: 9, fill: colors.tick }}
                axisLine={{ stroke: colors.grid }}
                tickLine={{ stroke: colors.grid }}
                label={{ value: "Reserve Y", angle: -90, position: "left", fontSize: 9, fill: colors.tick }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.tooltipBg,
                  border: `1px solid ${colors.tooltipBorder}`,
                  borderRadius: 8,
                  fontSize: 10,
                }}
                labelStyle={{ color: colors.tooltipText }}
                formatter={(value: number) => [value.toFixed(2), ""]}
                labelFormatter={(x) => `x = ${Number(x).toFixed(2)}`}
              />

              {(comparisonData.length > 0 || showBaseline) && (
                <Legend
                  verticalAlign="top"
                  height={20}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 9 }}
                />
              )}

              {/* Baseline (constant product) */}
              {showBaseline && baselineData.length > 0 && (
                <Line
                  data={baselineData}
                  dataKey="y"
                  type="monotone"
                  stroke={colors.gray}
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  dot={false}
                  name="Baseline (xy=k)"
                />
              )}

              {/* Comparison curves */}
              {comparisonData.map((comp) => (
                <Line
                  key={comp.name}
                  data={comp.data}
                  dataKey="y"
                  type="monotone"
                  stroke={comp.color}
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                  name={comp.name}
                />
              ))}

              {/* User's curve */}
              {curveData.length > 0 && (
                <Line
                  data={curveData}
                  dataKey="y"
                  type="monotone"
                  stroke={colors.green}
                  strokeWidth={2}
                  dot={false}
                  name="Your Curve"
                />
              )}

              {/* Reference lines at √k */}
              <ReferenceLine
                x={Math.sqrt(k)}
                stroke={colors.greenLight}
                strokeDasharray="2 2"
                strokeOpacity={0.5}
              />
              <ReferenceLine
                y={Math.sqrt(k)}
                stroke={colors.greenLight}
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
