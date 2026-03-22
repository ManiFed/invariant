import { getAtlasDb, ensureAtlasTables } from '../_lib/db.js';
import { sendJson } from '../_lib/http.js';

export default async function handler(_req, res) {
  const { pool, error } = getAtlasDb();
  if (!pool) return sendJson(res, 503, { status: 'unreachable', error });

  try {
    await ensureAtlasTables(pool);
    return sendJson(res, 200, { status: 'connected' });
  } catch (err) {
    return sendJson(res, 500, { status: 'unreachable', error: err instanceof Error ? err.message : 'Atlas status failure' });
  }
}
