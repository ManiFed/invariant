import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const scriptName = process.argv[2];

if (!scriptName) {
  console.error('Missing script name. Usage: node scripts/run-from-root.mjs <script>');
  process.exit(1);
}

let currentDir = process.cwd();
let rootDir = null;

while (true) {
  const packageJsonPath = resolve(currentDir, 'package.json');

  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      if (packageJson?.scripts?.[scriptName]) {
        rootDir = currentDir;
        break;
      }
    } catch {
      // Keep walking up if package.json is invalid.
    }
  }

  const parentDir = dirname(currentDir);
  if (parentDir === currentDir) {
    break;
  }

  currentDir = parentDir;
}

if (!rootDir) {
  console.error(
    `Could not find a parent package.json with a \"${scriptName}\" script. ` +
      'Forecast Lab currently depends on the repository-root build config. ' +
      'If this is a Railway deploy, set the service Root Directory to the repository root and use railway.forecasting.toml.'
  );
  process.exit(1);
}

const result = spawnSync('npm', ['run', scriptName], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
