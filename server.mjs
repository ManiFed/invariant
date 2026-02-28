import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, process.env.DIST_DIR || 'dist');
const port = Number(process.env.PORT || 4173);

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

let pool = null;
if (DATABASE_URL) {
  try {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  } catch (error) {
    console.warn('pg package not installed; Atlas PostgreSQL API disabled.');
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  createReadStream(filePath).pipe(res);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
  return true;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

async function ensureAtlasTables() {
  if (!pool) return false;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS atlas_state (
      id TEXT PRIMARY KEY,
      total_generations INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
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
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_atlas_candidates_flags
    ON atlas_candidates (is_archived, is_population, regime, created_at DESC);
  `);
  await pool.query(`
    INSERT INTO atlas_state (id, total_generations)
    VALUES ('global', 0)
    ON CONFLICT (id) DO NOTHING;
  `);
  return true;
}

async function handleAtlasApi(req, res, pathname) {
  if (!pool) return sendJson(res, 503, { status: 'unreachable', error: 'DATABASE_URL is not configured' });

  try {
    if (pathname === '/api/atlas/status' && req.method === 'GET') {
      await ensureAtlasTables();
      return sendJson(res, 200, { status: 'connected' });
    }

    if (pathname === '/api/atlas/state' && req.method === 'GET') {
      await ensureAtlasTables();
      const state = await pool.query(`SELECT * FROM atlas_state WHERE id = 'global' LIMIT 1`);
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
          `SELECT * FROM atlas_candidates WHERE regime = $1 AND is_population = TRUE ORDER BY score ASC`,
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
    }

    if (pathname === '/api/atlas/generate' && req.method === 'POST') {
      await ensureAtlasTables();
      const updated = await pool.query(`
        UPDATE atlas_state
        SET total_generations = total_generations + 1, updated_at = NOW()
        WHERE id = 'global'
        RETURNING total_generations;
      `);
      return sendJson(res, 200, { success: true, generation: updated.rows[0]?.total_generations ?? 0 });
    }

    if (pathname === '/api/atlas/backup' && req.method === 'POST') {
      await ensureAtlasTables();
      const body = await readJsonBody(req);
      const totalGenerations = Number(body.totalGenerations ?? 0);
      const archive = Array.isArray(body.archive) ? body.archive : [];
      const populations = body.populations && typeof body.populations === 'object' ? body.populations : {};

      await pool.query('BEGIN');
      await pool.query(`UPDATE atlas_state SET total_generations = $1, updated_at = NOW() WHERE id = 'global'`, [totalGenerations]);
      await pool.query(`DELETE FROM atlas_candidates WHERE is_archived = TRUE OR is_population = TRUE`);

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
    }

    return false;
  } catch (error) {
    try { await pool.query('ROLLBACK'); } catch {}
    return sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unknown atlas API error' });
  }
}

async function handleAiApi(req, res, pathname) {
  if (pathname !== '/api/ai/chat' || req.method !== 'POST') return false;
  if (!OPENROUTER_API_KEY) {
    return sendJson(res, 503, { error: 'OPENROUTER_API_KEY is not configured' });
  }

  try {
    const { messages = [], context } = await readJsonBody(req);
    const system = {
      role: 'system',
      content: [
        'You are Ammy, a concise AMM learning assistant.',
        context ? `Context: ${context}` : '',
      ].filter(Boolean).join('\n'),
    };

    const upstream = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        stream: true,
        messages: [system, ...messages],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      return sendJson(res, 502, { error: `OpenRouter request failed with ${upstream.status}` });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    for await (const chunk of upstream.body) {
      res.write(chunk);
    }
    res.end();
    return true;
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : 'AI chat failure' });
  }
}

const server = createServer(async (req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const normalized = path.normalize(requestPath).replace(/^([.][.][/\\])+/, '');
  const candidatePath = path.join(distDir, normalized);

  const aiHandled = await handleAiApi(req, res, requestPath);
  if (aiHandled) return;
  const atlasHandled = await handleAtlasApi(req, res, requestPath);
  if (atlasHandled) return;

  try {
    const candidateStat = await stat(candidatePath);
    if (candidateStat.isFile()) return sendFile(res, candidatePath);
  } catch {
    // Fallback to SPA index.html.
  }

  const spaEntrypoints = ['index.html', 'forecasting.html'];
  const entrypoint = spaEntrypoints
    .map((filename) => path.join(distDir, filename))
    .find((filename) => existsSync(filename));

  if (!entrypoint) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('No SPA entrypoint found in dist directory. Run the corresponding build command before starting the server.');
    return;
  }

  sendFile(res, entrypoint);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
