// MAP-Elites: Quality-Diversity Algorithm
// Maintains a grid of diverse high-quality solutions indexed by behavioral features.
// Each cell stores the best-scoring candidate with those features.

import type { Candidate, FeatureDescriptor, RegimeId } from "./discovery-engine";

export interface MAPElitesGrid {
  /** 2D grid indexed by [entropyBucket][peakConcentrationBucket] */
  cells: (Candidate | null)[][];
  /** Grid dimensions */
  rows: number;
  cols: number;
  /** Total occupied cells */
  occupied: number;
  /** Best candidate across all cells */
  bestCandidate: Candidate | null;
  /** Coverage: occupied/total */
  coverage: number;
  /** Feature axis labels */
  rowAxis: string;
  colAxis: string;
}

export interface MAPElitesConfig {
  rows: number;
  cols: number;
  /** Feature ranges for binning */
  entropyRange: [number, number];
  peakConcentrationRange: [number, number];
}

const DEFAULT_CONFIG: MAPElitesConfig = {
  rows: 12,
  cols: 12,
  entropyRange: [2.0, 6.0],    // Shannon entropy of bin distribution
  peakConcentrationRange: [1.0, 20.0], // Peak concentration ratio
};

/**
 * Create an empty MAP-Elites grid.
 */
export function createMAPElitesGrid(config: MAPElitesConfig = DEFAULT_CONFIG): MAPElitesGrid {
  const cells: (Candidate | null)[][] = Array.from(
    { length: config.rows },
    () => new Array(config.cols).fill(null)
  );
  return {
    cells,
    rows: config.rows,
    cols: config.cols,
    occupied: 0,
    bestCandidate: null,
    coverage: 0,
    rowAxis: "Entropy",
    colAxis: "Peak Concentration",
  };
}

/**
 * Map a candidate's features to grid coordinates.
 */
export function featuresToCell(
  features: FeatureDescriptor,
  config: MAPElitesConfig = DEFAULT_CONFIG,
): { row: number; col: number } {
  const [eMin, eMax] = config.entropyRange;
  const [pMin, pMax] = config.peakConcentrationRange;

  const entropyNorm = Math.max(0, Math.min(1, (features.entropy - eMin) / (eMax - eMin)));
  const peakNorm = Math.max(0, Math.min(1, (features.peakConcentration - pMin) / (pMax - pMin)));

  const row = Math.min(Math.floor(entropyNorm * config.rows), config.rows - 1);
  const col = Math.min(Math.floor(peakNorm * config.cols), config.cols - 1);

  return { row, col };
}

/**
 * Try to insert a candidate into the grid.
 * Returns true if the candidate was inserted (new cell or better score).
 */
export function insertCandidate(
  grid: MAPElitesGrid,
  candidate: Candidate,
  config: MAPElitesConfig = DEFAULT_CONFIG,
): boolean {
  const { row, col } = featuresToCell(candidate.features, config);
  const existing = grid.cells[row][col];

  if (!existing || candidate.score < existing.score) {
    const wasEmpty = !existing;
    grid.cells[row][col] = candidate;

    if (wasEmpty) {
      grid.occupied++;
      grid.coverage = grid.occupied / (grid.rows * grid.cols);
    }

    if (!grid.bestCandidate || candidate.score < grid.bestCandidate.score) {
      grid.bestCandidate = candidate;
    }

    return true;
  }

  return false;
}

/**
 * Build a MAP-Elites grid from an archive of candidates.
 */
export function buildGridFromArchive(
  archive: Candidate[],
  config: MAPElitesConfig = DEFAULT_CONFIG,
): MAPElitesGrid {
  const grid = createMAPElitesGrid(config);
  for (const candidate of archive) {
    insertCandidate(grid, candidate, config);
  }
  return grid;
}

/**
 * Select a parent from the grid for mutation.
 * Prefers under-explored regions (cells with fewer neighbors occupied).
 */
export function selectParent(grid: MAPElitesGrid): Candidate | null {
  const occupied: { row: number; col: number; candidate: Candidate; neighborCount: number }[] = [];

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const candidate = grid.cells[r][c];
      if (!candidate) continue;

      // Count occupied neighbors
      let neighborCount = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < grid.rows && nc >= 0 && nc < grid.cols && grid.cells[nr][nc]) {
            neighborCount++;
          }
        }
      }

      occupied.push({ row: r, col: c, candidate, neighborCount });
    }
  }

  if (occupied.length === 0) return null;

  // Weight selection toward cells with fewer neighbors (more isolated = under-explored)
  const maxNeighbors = 8;
  const weights = occupied.map(o => maxNeighbors - o.neighborCount + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;

  for (let i = 0; i < occupied.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return occupied[i].candidate;
  }

  return occupied[occupied.length - 1].candidate;
}

/**
 * Get grid statistics for visualization.
 */
export function getGridStats(grid: MAPElitesGrid): {
  occupancyMap: number[][];
  scoreMap: (number | null)[][];
  regimeMap: (RegimeId | null)[][];
  qualityDistribution: { row: number; col: number; score: number; regime: RegimeId }[];
} {
  const occupancyMap: number[][] = Array.from(
    { length: grid.rows },
    () => new Array(grid.cols).fill(0)
  );
  const scoreMap: (number | null)[][] = Array.from(
    { length: grid.rows },
    () => new Array(grid.cols).fill(null)
  );
  const regimeMap: (RegimeId | null)[][] = Array.from(
    { length: grid.rows },
    () => new Array(grid.cols).fill(null)
  );
  const qualityDistribution: { row: number; col: number; score: number; regime: RegimeId }[] = [];

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const candidate = grid.cells[r][c];
      if (candidate) {
        occupancyMap[r][c] = 1;
        scoreMap[r][c] = candidate.score;
        regimeMap[r][c] = candidate.regime;
        qualityDistribution.push({ row: r, col: c, score: candidate.score, regime: candidate.regime });
      }
    }
  }

  return { occupancyMap, scoreMap, regimeMap, qualityDistribution };
}
