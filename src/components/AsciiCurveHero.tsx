import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

const chars = ' .,:-=+*#%@';

/**
 * Constant-product AMM curve: x * y = k
 * Given x, returns y = k / x
 */
const ammCurve = (x: number, k: number) => k / x;

/**
 * Concentrated liquidity envelope — Gaussian bump centered on a price.
 * Used to render a "liquidity heat" layer behind the curve.
 */
const liquidityBump = (x: number, center: number, width: number) => {
  const z = (x - center) / width;
  return Math.exp(-0.5 * z * z);
};

export function AsciiCurveHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    let frameId = 0;

    /* ── persistent state for the animated trade marker ── */
    let tradeProgress = 0; // 0 → 1 along curve
    let tradeDir = 1;

    const draw = (time = 0) => {
      const isDark = document.documentElement.classList.contains('dark');
      const { width, height } = canvas;
      const bg = isDark ? '#0a0a0a' : '#fafafa';
      const fg = isDark
        ? (a: number) => `rgba(210, 225, 255, ${a})`
        : (a: number) => `rgba(10, 10, 30, ${a})`;
      const accentFg = isDark
        ? (a: number) => `rgba(120, 200, 160, ${a})`
        : (a: number) => `rgba(20, 120, 80, ${a})`;
      const labelColor = isDark
        ? 'rgba(160, 180, 210, 0.50)'
        : 'rgba(80, 90, 110, 0.50)';

      context.fillStyle = bg;
      context.fillRect(0, 0, width, height);
      context.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace';
      context.textBaseline = 'middle';

      const stepX = 9;
      const stepY = 14;
      const cols = Math.max(10, Math.floor(width / stepX));
      const rows = Math.max(10, Math.floor(height / stepY));
      const padTop = 3;
      const padBot = 3;
      const padLeft = 2;
      const padRight = 2;
      const usableCols = cols - padLeft - padRight;
      const usableRows = rows - padTop - padBot;

      const t = time * 0.00025;

      /* ── animated invariant k and liquidity center ── */
      const k = 1.0 + 0.3 * Math.sin(t * 0.35);
      const liqCenter = 1.0 + 0.4 * Math.sin(t * 0.22);
      const liqWidth = 0.55 + 0.15 * Math.cos(t * 0.3);

      /* ── trade marker slides along curve ── */
      if (!reduceMotion) {
        tradeProgress += tradeDir * 0.0024;
        if (tradeProgress > 1) {
          tradeProgress = 1;
          tradeDir = -1;
        }
        if (tradeProgress < 0) {
          tradeProgress = 0;
          tradeDir = 1;
        }
      }

      /* map trade progress to x-domain */
      const xMin = 0.18;
      const xMax = 3.5;
      const tradeX = xMin + tradeProgress * (xMax - xMin);
      const tradeY = ammCurve(tradeX, k);

      for (let ci = 0; ci < usableCols; ci++) {
        const xFrac = ci / (usableCols - 1); // 0-1
        const x = xMin + xFrac * (xMax - xMin);
        const y = ammCurve(x, k); // reserve-y

        /* Map y → row.  y ranges roughly from k/xMax to k/xMin.
           We want high y at top (small row index). */
        const yMin = k / xMax;
        const yMax = k / xMin;
        const yNorm = Math.min(1, Math.max(0, (y - yMin) / (yMax - yMin)));
        const curveRow = Math.round(padTop + usableRows * (1 - yNorm));

        /* liquidity heat for this column */
        const liq = liquidityBump(x, liqCenter, liqWidth);

        for (let ri = 0; ri < usableRows; ri++) {
          const row = padTop + ri;
          const col = padLeft + ci;

          let intensity = 0;

          /* ── liquidity heat beneath the curve ── */
          const cellYNorm = 1 - ri / (usableRows - 1); // 0 = bottom, 1 = top
          const cellY = yMin + cellYNorm * (yMax - yMin);
          if (cellY <= y) {
            // below curve = "reserve area"
            const depth = liq * 0.32;
            intensity = Math.max(intensity, depth);
          }

          /* ── the curve itself ── */
          const distToCurve = Math.abs(row - curveRow);
          if (distToCurve === 0) intensity = Math.max(intensity, 0.96);
          else if (distToCurve === 1) intensity = Math.max(intensity, 0.62);
          else if (distToCurve === 2) intensity = Math.max(intensity, 0.28);

          /* ── trade marker glow ── */
          const dxTrade = Math.abs(ci - Math.round((tradeX - xMin) / (xMax - xMin) * (usableCols - 1)));
          const tradeRowNorm = Math.min(1, Math.max(0, (tradeY - yMin) / (yMax - yMin)));
          const tradeRow = Math.round(padTop + usableRows * (1 - tradeRowNorm));
          const dyTrade = Math.abs(row - tradeRow);
          const tradeDist = Math.sqrt(dxTrade * dxTrade + dyTrade * dyTrade);
          const isTradeZone = tradeDist < 4;

          if (intensity < 0.06 && !isTradeZone) continue;

          const charIndex = Math.min(
            chars.length - 1,
            Math.floor(intensity * (chars.length - 1)),
          );

          if (isTradeZone && tradeDist < 2.5) {
            /* trade dot gets accent color */
            const glow = Math.max(0, 1 - tradeDist / 2.5);
            const tradeCharIdx = Math.min(chars.length - 1, Math.floor(glow * (chars.length - 1)));
            context.fillStyle = accentFg(0.25 + glow * 0.7);
            context.fillText(
              chars[tradeCharIdx],
              col * stepX,
              row * stepY + stepY / 2,
            );
          } else {
            context.fillStyle = fg(0.08 + intensity * 0.62);
            context.fillText(
              chars[charIndex],
              col * stepX,
              row * stepY + stepY / 2,
            );
          }
        }
      }

      /* ── axis labels ── */
      context.fillStyle = labelColor;
      context.fillText('reserve x →', (padLeft + 1) * stepX, (rows - 1) * stepY + stepY / 2);
      // vertical label letter-by-letter
      const yLabel = 'reserve y';
      for (let i = 0; i < yLabel.length; i++) {
        context.fillText(
          yLabel[i],
          stepX,
          (padTop + 1 + i) * stepY + stepY / 2,
        );
      }

      /* ── title label ── */
      context.fillStyle = labelColor;
      context.fillText('x · y = k', (padLeft + usableCols - 10) * stepX, (padTop - 1) * stepY + stepY / 2);
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw(performance.now());
    };

    resize();
    window.addEventListener('resize', resize);

    if (!reduceMotion) {
      frameId = window.requestAnimationFrame(function loop(now) {
        draw(now);
        frameId = window.requestAnimationFrame(loop);
      });
    }

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(frameId);
    };
  }, [resolvedTheme]);

  return (
    <div className="relative h-[68vh] min-h-[420px] overflow-hidden rounded-2xl border border-border bg-background">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
