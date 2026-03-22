import { getAtlasDb, ensureAtlasTables } from '../_lib/db.js';
import { readJsonBody, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });

  const { pool, error } = getAtlasDb();
  if (!pool) return sendJson(res, 503, { status: 'unreachable', error });

  try {
    await ensureAtlasTables(pool);
    const body = await readJsonBody(req);
    const totalGenerations = Number(body.totalGenerations ?? 0);
    const archive = Array.isArray(body.archive) ? body.archive : [];
    const populations = body.populations && typeof body.populations === 'object' ? body.populations : {};

    await pool.query('BEGIN');
    await pool.query("UPDATE atlas_state SET total_generations = $1, updated_at = NOW() WHERE id = 'global'", [totalGenerations]);
    await pool.query('DELETE FROM atlas_candidates WHERE is_archived = TRUE OR is_population = TRUE');

    const insertCandidate = async (candidate, flags = { is_population: false, is_archived: false }) => {
      await pool.query(
        `INSERT INTO atlas_candidates (
          candidate_id, regime, generation, bins, family_id, family_params, source, pool_type,
          asset_count, adaptive_profile, metrics, features, stability, score, is_population, is_archived, created_at
        ) VALUES (
          $1, $2, $3, $4::double precision[], $5, $6::jsonb, $7, $8,
          $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14, $15, $16, to_timestamp($17 / 1000.0)
        )`,
        [
          candidate.id,
          candidate.regime,
          candidate.generation,
          candidate.bins,
          candidate.familyId ?? null,
          JSON.stringify(candidate.familyParams ?? {}),
          candidate.source ?? null,
          candidate.poolType ?? null,
          candidate.assetCount ?? null,
          JSON.stringify(candidate.adaptiveProfile ?? null),
          JSON.stringify(candidate.metrics ?? {}),
          JSON.stringify(candidate.features ?? {}),
          candidate.stability,
          candidate.score,
          flags.is_population,
          flags.is_archived,
          candidate.timestamp ?? Date.now(),
        ],
      );
    };

    for (const candidate of archive) await insertCandidate(candidate, { is_population: false, is_archived: true });
    for (const candidates of Object.values(populations)) {
      if (!Array.isArray(candidates)) continue;
      for (const candidate of candidates) await insertCandidate(candidate, { is_population: true, is_archived: false });
    }

    await pool.query('COMMIT');
    return sendJson(res, 200, { success: true });
  } catch (err) {
    try { await pool?.query('ROLLBACK'); } catch {}
    return sendJson(res, 500, { error: err instanceof Error ? err.message : 'Atlas backup failure' });
  }
}
