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

    /* ── persistent state for the animated trade ── */
    let tradeState: 'idle' | 'incoming' | 'impact' | 'sliding' | 'recovering' = 'idle';
    let tradeDirection = 0; // 0=top-right, 1=top, 2=top-left, 3=right, 4=bottom-right
    let tradeTimer = 0;
    let impactX = 0;
    let impactProgress = 0;
    let curveOffset = 0; // Temporary curve displacement from trade impact
    let nextTradeDelay = Math.random() * 40 + 20; // frames until next trade

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
      const tradeFg = isDark
        ? (a: number) => `rgba(255, 180, 100, ${a})`
        : (a: number) => `rgba(200, 100, 30, ${a})`;
      const impactFg = isDark
        ? (a: number) => `rgba(255, 120, 80, ${a})`
        : (a: number) => `rgba(220, 80, 40, ${a})`;
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

      /* ── base invariant k and liquidity ── */
      const baseK = 1.0 + 0.15 * Math.sin(t * 0.35);
      const liqCenter = 1.0 + 0.4 * Math.sin(t * 0.22);
      const liqWidth = 0.55 + 0.15 * Math.cos(t * 0.3);

      /* ── trade animation state machine ── */
      if (!reduceMotion) {
        tradeTimer++;
        
        if (tradeState === 'idle' && tradeTimer > nextTradeDelay) {
          tradeState = 'incoming';
          tradeTimer = 0;
          impactX = 0.15 + Math.random() * 0.7; // Wider range of impact positions
          impactProgress = 0;
          // Randomize entry direction: 0=top-right, 1=top, 2=top-left, 3=right, 4=bottom-right
          tradeDirection = Math.floor(Math.random() * 5);
        } else if (tradeState === 'incoming') {
          impactProgress = Math.min(1, impactProgress + 0.08); // 2x faster approach
          if (impactProgress >= 1) {
            tradeState = 'impact';
            tradeTimer = 0;
            curveOffset = 0.15 + Math.random() * 0.1;
          }
        } else if (tradeState === 'impact') {
          if (tradeTimer > 5) { // Shorter flash
            tradeState = 'sliding';
            tradeTimer = 0;
          }
        } else if (tradeState === 'sliding') {
          impactProgress = Math.min(1, tradeTimer / 18); // Faster slide
          if (impactProgress >= 1) {
            tradeState = 'recovering';
            tradeTimer = 0;
          }
        } else if (tradeState === 'recovering') {
          curveOffset *= 0.88; // Faster recovery
          if (curveOffset < 0.005) {
            tradeState = 'idle';
            tradeTimer = 0;
            curveOffset = 0;
            nextTradeDelay = Math.random() * 30 + 15; // Shorter gaps between trades
          }
        }
      }

      /* ── apply trade impact to k ── */
      const k = baseK * (1 + curveOffset * 0.3);

      /* map impact position to screen coordinates */
      const xMin = 0.18;
      const xMax = 3.5;
      const tradeScreenX = impactX * usableCols;
      const tradeWorldX = xMin + impactX * (xMax - xMin);
      const tradeWorldY = ammCurve(tradeWorldX, k);
      const yMin = k / xMax;
      const yMax = k / xMin;

      for (let ci = 0; ci < usableCols; ci++) {
        const xFrac = ci / (usableCols - 1);
        const x = xMin + xFrac * (xMax - xMin);
        
        /* Apply local curve displacement near impact point */
        let localOffset = 0;
        if (tradeState === 'sliding' || tradeState === 'recovering') {
          const distFromImpact = Math.abs(xFrac - impactX);
          const falloff = Math.exp(-distFromImpact * distFromImpact * 20);
          localOffset = curveOffset * falloff * 0.5;
        }
        
        const y = ammCurve(x, k * (1 + localOffset));

        const yNorm = Math.min(1, Math.max(0, (y - yMin) / (yMax - yMin)));
        const curveRow = Math.round(padTop + usableRows * (1 - yNorm));

        const liq = liquidityBump(x, liqCenter, liqWidth);

        for (let ri = 0; ri < usableRows; ri++) {
          const row = padTop + ri;
          const col = padLeft + ci;

          let intensity = 0;
          let isTradeElement = false;
          let isImpactZone = false;

          /* ── liquidity heat beneath the curve ── */
          const cellYNorm = 1 - ri / (usableRows - 1);
          const cellY = yMin + cellYNorm * (yMax - yMin);
          if (cellY <= y) {
            const depth = liq * 0.32;
            intensity = Math.max(intensity, depth);
          }

          /* ── the curve itself ── */
          const distToCurve = Math.abs(row - curveRow);
          if (distToCurve === 0) intensity = Math.max(intensity, 0.96);
          else if (distToCurve === 1) intensity = Math.max(intensity, 0.62);
          else if (distToCurve === 2) intensity = Math.max(intensity, 0.28);

          /* ── incoming trade projectile ── */
          if (tradeState === 'incoming') {
            const targetRow = Math.round(padTop + usableRows * (1 - Math.min(1, Math.max(0, (tradeWorldY - yMin) / (yMax - yMin)))));
            const targetCol = padLeft + Math.round(tradeScreenX);
            // Entry point depends on direction
            let startCol: number, startRow: number;
            if (tradeDirection === 0) { startCol = padLeft + usableCols + 5; startRow = padTop - 5; }
            else if (tradeDirection === 1) { startCol = targetCol; startRow = padTop - 8; }
            else if (tradeDirection === 2) { startCol = padLeft - 5; startRow = padTop - 5; }
            else if (tradeDirection === 3) { startCol = padLeft + usableCols + 8; startRow = targetRow; }
            else { startCol = padLeft + usableCols + 5; startRow = padTop + usableRows + 5; }
            const currentCol = startCol + (targetCol - startCol) * impactProgress;
            const currentRow = startRow + (targetRow - startRow) * impactProgress;
            
            const dx = Math.abs(col - currentCol);
            const dy = Math.abs(row - currentRow);
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 3) {
              isTradeElement = true;
              intensity = Math.max(intensity, 1 - dist / 3);
            }
            // Trail
            if (impactProgress > 0.1) {
              const trailT = impactProgress - 0.15;
              if (trailT > 0) {
                const trailCol = startCol + (targetCol - startCol) * trailT;
                const trailRow = startRow + (targetRow - startRow) * trailT;
                const tdx = Math.abs(col - trailCol);
                const tdy = Math.abs(row - trailRow);
                const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
                if (tdist < 2) {
                  isTradeElement = true;
                  intensity = Math.max(intensity, 0.4 * (1 - tdist / 2));
                }
              }
            }
          }

          /* ── impact flash ── */
          if (tradeState === 'impact') {
            const targetRow = Math.round(padTop + usableRows * (1 - Math.min(1, Math.max(0, (tradeWorldY - yMin) / (yMax - yMin)))));
            const dx = Math.abs(col - (padLeft + Math.round(tradeScreenX)));
            const dy = Math.abs(row - targetRow);
            const dist = Math.sqrt(dx * dx + dy * dy);
            const flashRadius = 4 + tradeTimer * 0.5;
            if (dist < flashRadius) {
              isImpactZone = true;
              intensity = Math.max(intensity, 0.9 * (1 - dist / flashRadius));
            }
          }

          if (intensity < 0.06) continue;

          const charIndex = Math.min(
            chars.length - 1,
            Math.floor(intensity * (chars.length - 1)),
          );

          if (isImpactZone) {
            context.fillStyle = impactFg(0.3 + intensity * 0.7);
          } else if (isTradeElement) {
            context.fillStyle = tradeFg(0.3 + intensity * 0.7);
          } else {
            // Highlight curve near impact during sliding
            const nearImpact = tradeState === 'sliding' || tradeState === 'recovering';
            const distFromImpactCol = Math.abs(ci - Math.round(tradeScreenX));
            if (nearImpact && distToCurve <= 1 && distFromImpactCol < 6) {
              const glow = Math.max(0, 1 - distFromImpactCol / 6) * curveOffset * 3;
              context.fillStyle = accentFg(0.08 + intensity * 0.62 + glow * 0.4);
            } else {
              context.fillStyle = fg(0.08 + intensity * 0.62);
            }
          }
          
          context.fillText(
            chars[charIndex],
            col * stepX,
            row * stepY + stepY / 2,
          );
        }
      }

      /* ── axis labels ── */
      context.fillStyle = labelColor;
      context.fillText('reserve x →', (padLeft + 1) * stepX, (rows - 1) * stepY + stepY / 2);
      const yLabel = 'reserve y';
      for (let i = 0; i < yLabel.length; i++) {
        context.fillText(
          yLabel[i],
          stepX,
          (padTop + 1 + i) * stepY + stepY / 2,
        );
      }

      /* ── title label with trade indicator ── */
      context.fillStyle = labelColor;
      const formula = 'x · y = k';
      context.fillText(formula, (padLeft + usableCols - 10) * stepX, (padTop - 1) * stepY + stepY / 2);
      
      // Trade status indicator
      if (tradeState !== 'idle') {
        const statusX = (padLeft + usableCols - 18) * stepX;
        const statusY = (padTop - 1) * stepY + stepY / 2;
        if (tradeState === 'incoming') {
          context.fillStyle = isDark ? 'rgba(255, 180, 100, 0.7)' : 'rgba(200, 100, 30, 0.7)';
          context.fillText('TRADE →', statusX, statusY);
        } else if (tradeState === 'impact') {
          context.fillStyle = isDark ? 'rgba(255, 120, 80, 0.9)' : 'rgba(220, 80, 40, 0.9)';
          context.fillText('IMPACT!', statusX, statusY);
        } else if (tradeState === 'sliding' || tradeState === 'recovering') {
          context.fillStyle = isDark ? 'rgba(120, 200, 160, 0.7)' : 'rgba(20, 120, 80, 0.7)';
          context.fillText('slippage', statusX, statusY);
        }
      }
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
