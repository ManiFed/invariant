import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

const chars = ' .,:-=+*#%@';

/**
 * Perfect calibration line: predicted probability = actual frequency.
 */
const perfectCalibration = (x: number) => x;

/**
 * Overconfident forecaster curve: predictions more extreme than reality.
 * S-shaped curve that bows away from the diagonal.
 */
const overconfidentCurve = (x: number, severity: number) => {
  const centered = x - 0.5;
  return 0.5 + centered * (1 - severity * 0.6) + severity * 0.3 * Math.pow(centered, 3) * 4;
};

/**
 * Gaussian bell for scatter "dots" around the calibration curve.
 */
const gaussian = (x: number, center: number, width: number) => {
  const z = (x - center) / width;
  return Math.exp(-0.5 * z * z);
};

export function AsciiCalibrationHero() {
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
    let dotProgress = 0;

    const draw = (time = 0) => {
      const isDark = document.documentElement.classList.contains('dark');
      const { width, height } = canvas;
      const bg = isDark ? '#0a0a0a' : '#fafafa';
      const fg = isDark
        ? (a: number) => `rgba(210, 225, 255, ${a})`
        : (a: number) => `rgba(10, 10, 30, ${a})`;
      const accentFg = isDark
        ? (a: number) => `rgba(100, 180, 255, ${a})`
        : (a: number) => `rgba(20, 80, 180, ${a})`;
      const warnFg = isDark
        ? (a: number) => `rgba(255, 180, 100, ${a})`
        : (a: number) => `rgba(200, 120, 40, ${a})`;
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
      const padLeft = 4;
      const padRight = 2;
      const usableCols = cols - padLeft - padRight;
      const usableRows = rows - padTop - padBot;

      const t = time * 0.0002;

      // Animated overconfidence severity
      const severity = 0.3 + 0.25 * Math.sin(t * 0.4);

      // Moving "data point" along the curve
      if (!reduceMotion) {
        dotProgress += 0.002;
        if (dotProgress > 1) dotProgress = 0;
      }

      for (let ci = 0; ci < usableCols; ci++) {
        const xFrac = ci / (usableCols - 1);

        // Perfect calibration line row
        const perfectY = perfectCalibration(xFrac);
        const perfectRow = Math.round(padTop + usableRows * (1 - perfectY));

        // Overconfident curve row
        const overY = Math.max(0, Math.min(1, overconfidentCurve(xFrac, severity)));
        const overRow = Math.round(padTop + usableRows * (1 - overY));

        // Scatter points around the overconfident curve
        const scatterSpread = gaussian(xFrac, 0.5, 0.35) * 0.15;

        for (let ri = 0; ri < usableRows; ri++) {
          const row = padTop + ri;
          const col = padLeft + ci;

          let intensity = 0;
          let useAccent = false;
          let useWarn = false;

          // Perfect calibration line (diagonal)
          const distToPerfect = Math.abs(row - perfectRow);
          if (distToPerfect === 0) { intensity = Math.max(intensity, 0.45); useAccent = true; }
          else if (distToPerfect === 1) { intensity = Math.max(intensity, 0.2); useAccent = true; }

          // Overconfident curve
          const distToOver = Math.abs(row - overRow);
          if (distToOver === 0) { intensity = Math.max(intensity, 0.9); useWarn = !useAccent; }
          else if (distToOver === 1) { intensity = Math.max(intensity, 0.5); useWarn = !useAccent; }
          else if (distToOver === 2) { intensity = Math.max(intensity, 0.2); useWarn = !useAccent; }

          // Scatter "data cloud" around curve
          const cellYNorm = 1 - ri / (usableRows - 1);
          const scatterDist = Math.abs(cellYNorm - overY);
          if (scatterDist < scatterSpread) {
            const scatter = (1 - scatterDist / scatterSpread) * 0.25;
            if (scatter > intensity) {
              intensity = scatter;
              useWarn = true;
              useAccent = false;
            }
          }

          // Moving data point
          const dxDot = Math.abs(ci - Math.round(dotProgress * (usableCols - 1)));
          const dotY = Math.max(0, Math.min(1, overconfidentCurve(dotProgress, severity)));
          const dotRow = Math.round(padTop + usableRows * (1 - dotY));
          const dyDot = Math.abs(row - dotRow);
          const dotDist = Math.sqrt(dxDot * dxDot + dyDot * dyDot);

          if (dotDist < 3) {
            const glow = Math.max(0, 1 - dotDist / 3);
            const charIdx = Math.min(chars.length - 1, Math.floor(glow * (chars.length - 1)));
            context.fillStyle = accentFg(0.3 + glow * 0.7);
            context.fillText(chars[charIdx], col * stepX, row * stepY + stepY / 2);
            continue;
          }

          if (intensity < 0.05) continue;

          const charIndex = Math.min(
            chars.length - 1,
            Math.floor(intensity * (chars.length - 1)),
          );

          if (useAccent) {
            context.fillStyle = accentFg(0.15 + intensity * 0.55);
          } else if (useWarn) {
            context.fillStyle = warnFg(0.1 + intensity * 0.6);
          } else {
            context.fillStyle = fg(0.08 + intensity * 0.62);
          }
          context.fillText(chars[charIndex], col * stepX, row * stepY + stepY / 2);
        }
      }

      // Axis labels
      context.fillStyle = labelColor;
      context.fillText('predicted probability →', (padLeft + 1) * stepX, (rows - 1) * stepY + stepY / 2);
      const yLabel = 'actual freq';
      for (let i = 0; i < yLabel.length; i++) {
        context.fillText(yLabel[i], stepX, (padTop + 1 + i) * stepY + stepY / 2);
      }

      // Title label
      context.fillStyle = labelColor;
      context.fillText('calibration', (padLeft + usableCols - 14) * stepX, (padTop - 1) * stepY + stepY / 2);
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
