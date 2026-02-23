import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const port = Number(process.env.PORT || 4173);

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

const server = createServer(async (req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const normalized = path.normalize(requestPath).replace(/^([.][.][/\\])+/, '');
  const candidatePath = path.join(distDir, normalized);

  try {
    const candidateStat = await stat(candidatePath);
    if (candidateStat.isFile()) {
      return sendFile(res, candidatePath);
    }
  } catch {
    // Fallback to SPA index.html below.
  }

  const indexPath = path.join(distDir, 'index.html');

  if (!existsSync(indexPath)) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('dist/index.html not found. Run "npm run build" before starting the server.');
    return;
  }

  sendFile(res, indexPath);
});

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://0.0.0.0:${port}`);
});
