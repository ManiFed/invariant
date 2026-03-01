/**
 * Forecasting scoring utilities.
 * Brier score, log score, calibration metrics, and skill profile calculations.
 */

export interface Forecast {
  id: string;
  question: string;
  description: string;
  category: string;
  probability: number; // 0-1
  resolutionDate: string;
  resolved: boolean;
  outcome?: boolean; // true = yes, false = no
  createdAt: string;
  updatedAt: string;
  revisions: { probability: number; timestamp: string }[];
}

export interface SkillProfile {
  avgBrierScore: number;
  calibrationError: number;
  overconfidenceIndex: number;
  updateResponsiveness: number;
  resolvedForecasts: number;
  totalForecasts: number;
  tier: SkillTier;
  brierHistory: number[];
}

export type SkillTier = "Novice" | "Apprentice" | "Practitioner" | "Expert" | "Superforecaster";

/** Brier score: (probability - outcome)^2. Lower is better. Range [0, 1]. */
export function brierScore(probability: number, outcome: boolean): number {
  const o = outcome ? 1 : 0;
  return (probability - o) ** 2;
}

/** Log score: -log2(p) if outcome=true, -log2(1-p) if outcome=false. Lower is better. */
export function logScore(probability: number, outcome: boolean): number {
  const p = Math.max(0.001, Math.min(0.999, probability));
  return outcome ? -Math.log2(p) : -Math.log2(1 - p);
}

/**
 * Compute calibration buckets.
 * Groups forecasts into buckets by predicted probability,
 * then compares predicted vs actual frequency.
 */
export function calibrationBuckets(
  forecasts: { probability: number; outcome: boolean }[],
  numBuckets = 10,
): { predicted: number; actual: number; count: number }[] {
  const buckets: { sum: number; outcomes: number; count: number }[] = Array.from(
    { length: numBuckets },
    () => ({ sum: 0, outcomes: 0, count: 0 }),
  );

  for (const f of forecasts) {
    const idx = Math.min(numBuckets - 1, Math.floor(f.probability * numBuckets));
    buckets[idx].sum += f.probability;
    buckets[idx].outcomes += f.outcome ? 1 : 0;
    buckets[idx].count += 1;
  }

  return buckets
    .filter((b) => b.count > 0)
    .map((b) => ({
      predicted: b.sum / b.count,
      actual: b.outcomes / b.count,
      count: b.count,
    }));
}

/** Mean absolute calibration error across buckets. */
export function calibrationError(
  forecasts: { probability: number; outcome: boolean }[],
): number {
  const buckets = calibrationBuckets(forecasts);
  if (buckets.length === 0) return 0;
  const totalCount = buckets.reduce((s, b) => s + b.count, 0);
  return buckets.reduce(
    (s, b) => s + (b.count / totalCount) * Math.abs(b.predicted - b.actual),
    0,
  );
}

/** Overconfidence index: average of (predicted - 0.5) vs actual resolution bias. */
export function overconfidenceIndex(
  forecasts: { probability: number; outcome: boolean }[],
): number {
  if (forecasts.length === 0) return 0;
  let overconfidentCount = 0;
  for (const f of forecasts) {
    const confident = Math.abs(f.probability - 0.5);
    const correct = f.outcome ? f.probability > 0.5 : f.probability < 0.5;
    if (confident > 0.2 && !correct) overconfidentCount++;
  }
  return overconfidentCount / forecasts.length;
}

/** Update responsiveness: average magnitude of probability revisions. */
export function updateResponsiveness(forecasts: Forecast[]): number {
  let totalUpdates = 0;
  let totalMagnitude = 0;
  for (const f of forecasts) {
    if (f.revisions.length > 1) {
      for (let i = 1; i < f.revisions.length; i++) {
        totalUpdates++;
        totalMagnitude += Math.abs(f.revisions[i].probability - f.revisions[i - 1].probability);
      }
    }
  }
  return totalUpdates > 0 ? totalMagnitude / totalUpdates : 0;
}

/** Determine skill tier based on Brier score and number of resolved forecasts. */
export function getSkillTier(avgBrier: number, resolved: number): SkillTier {
  if (resolved < 10) return "Novice";
  if (resolved < 25 || avgBrier > 0.25) return "Apprentice";
  if (resolved < 50 || avgBrier > 0.18) return "Practitioner";
  if (resolved < 100 || avgBrier > 0.12) return "Expert";
  return "Superforecaster";
}

/** Compute full skill profile from a set of forecasts. */
export function computeSkillProfile(forecasts: Forecast[]): SkillProfile {
  const resolved = forecasts.filter((f) => f.resolved && f.outcome !== undefined);
  const pairs = resolved.map((f) => ({
    probability: f.probability,
    outcome: f.outcome!,
  }));

  const briers = resolved.map((f) => brierScore(f.probability, f.outcome!));
  const avgBrier = briers.length > 0 ? briers.reduce((a, b) => a + b, 0) / briers.length : 0.25;

  return {
    avgBrierScore: avgBrier,
    calibrationError: calibrationError(pairs),
    overconfidenceIndex: overconfidenceIndex(pairs),
    updateResponsiveness: updateResponsiveness(forecasts),
    resolvedForecasts: resolved.length,
    totalForecasts: forecasts.length,
    tier: getSkillTier(avgBrier, resolved.length),
    brierHistory: briers,
  };
}
