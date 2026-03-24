import { getAtlasDb, ensureAtlasTables } from '../_lib/db.js';
import { sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });

  const { pool, error } = getAtlasDb();
  if (!pool) return sendJson(res, 503, { status: 'unreachable', error });

  try {
    await ensureAtlasTables(pool);
    const updated = await pool.query(`
      UPDATE atlas_state
      SET total_generations = total_generations + 1, updated_at = NOW()
      WHERE id = 'global'
      RETURNING total_generations;
    `);
    return sendJson(res, 200, { success: true, generation: updated.rows[0]?.total_generations ?? 0 });
  } catch (err) {
    return sendJson(res, 500, { error: err instanceof Error ? err.message : 'Atlas generation failure' });
  }
}
