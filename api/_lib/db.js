import { Pool } from 'pg';

import { DATABASE_URL } from './env.js';

let pool;
let dbInitError = '';

export function getAtlasDb() {
  if (!DATABASE_URL) {
    return { pool: null, error: 'DATABASE_URL is not configured' };
  }

  if (!pool) {
    try {
      pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    } catch (error) {
      dbInitError = error instanceof Error ? error.message : String(error);
      return { pool: null, error: dbInitError };
    }
  }

  return { pool, error: dbInitError };
}

export async function ensureAtlasTables(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS atlas_state (
      id TEXT PRIMARY KEY,
      total_generations INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS atlas_candidates (
      id BIGSERIAL PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      regime TEXT NOT NULL,
      generation INTEGER NOT NULL,
      bins DOUBLE PRECISION[] NOT NULL,
      family_id TEXT,
      family_params JSONB,
      source TEXT,
      pool_type TEXT,
      asset_count INTEGER,
      adaptive_profile JSONB,
      metrics JSONB NOT NULL,
      features JSONB NOT NULL,
      stability DOUBLE PRECISION NOT NULL,
      score DOUBLE PRECISION NOT NULL,
      is_population BOOLEAN NOT NULL DEFAULT FALSE,
      is_archived BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_atlas_candidates_flags
    ON atlas_candidates (is_archived, is_population, regime, created_at DESC);
  `);
  await db.query(`
    INSERT INTO atlas_state (id, total_generations)
    VALUES ('global', 0)
    ON CONFLICT (id) DO NOTHING;
  `);
}
