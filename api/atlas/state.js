import { getAtlasDb, ensureAtlasTables } from '../_lib/db.js';
import { sendJson } from '../_lib/http.js';

export default async function handler(_req, res) {
  const { pool, error } = getAtlasDb();
  if (!pool) return sendJson(res, 503, { status: 'unreachable', error });

  try {
    await ensureAtlasTables(pool);
    const state = await pool.query("SELECT * FROM atlas_state WHERE id = 'global' LIMIT 1");
    const archived = await pool.query(`
      SELECT * FROM atlas_candidates
      WHERE is_archived = TRUE
      ORDER BY created_at DESC
      LIMIT 5000
    `);

    const regimes = ['low-vol', 'high-vol', 'jump-diffusion', 'regime-shift'];
    const populations = {};
    for (const regime of regimes) {
      const pop = await pool.query(
        'SELECT * FROM atlas_candidates WHERE regime = $1 AND is_population = TRUE ORDER BY score ASC',
        [regime],
      );
      populations[regime] = pop.rows;
    }

    return sendJson(res, 200, {
      state: {
        globalState: state.rows[0] ?? null,
        archivedRows: archived.rows,
        populations,
      },
    });
  } catch (err) {
    return sendJson(res, 500, { error: err instanceof Error ? err.message : 'Atlas state failure' });
  }
}
