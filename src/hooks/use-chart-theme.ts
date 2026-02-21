import { useTheme } from "next-themes";
import { useMemo } from "react";

export const useChartColors = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return useMemo(() => ({
    grid: isDark ? "hsl(0, 0%, 15%)" : "hsl(0, 0%, 90%)",
    tick: isDark ? "hsl(0, 0%, 50%)" : "hsl(0, 0%, 45%)",
    tooltipBg: isDark ? "hsl(0, 0%, 7%)" : "hsl(0, 0%, 100%)",
    tooltipBorder: isDark ? "hsl(0, 0%, 15%)" : "hsl(0, 0%, 90%)",
    line: isDark ? "hsl(0, 0%, 80%)" : "hsl(0, 0%, 15%)",
    green: isDark ? "hsl(142, 72%, 45%)" : "hsl(142, 72%, 38%)",
    red: isDark ? "hsl(0, 72%, 55%)" : "hsl(0, 72%, 50%)",
    gray: isDark ? "hsl(0, 0%, 45%)" : "hsl(0, 0%, 55%)",
    greenLight: isDark ? "hsl(142, 50%, 55%)" : "hsl(142, 50%, 50%)",
    // For multi-series charts
    series: isDark
      ? ["hsl(0, 0%, 80%)", "hsl(142, 72%, 45%)", "hsl(0, 72%, 55%)", "hsl(0, 0%, 50%)", "hsl(142, 50%, 55%)"]
      : ["hsl(0, 0%, 15%)", "hsl(142, 72%, 38%)", "hsl(0, 72%, 50%)", "hsl(0, 0%, 50%)", "hsl(142, 50%, 45%)"],
  }), [isDark]);
};
