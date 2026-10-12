import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Reuse the Sites starter's Wrangler-owned esbuild; no test install or browser.
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('wrangler/package.json'))('esbuild');
const scratch = await mkdtemp(join(tmpdir(), 'tiber-trade-tests-'));
try {
  const output = join(scratch, 'pilot.test.cjs');
  await esbuild.build({ entryPoints: ['tests/pilot.test.tsx'], outfile: output, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'bundle', external: ['node:*'], logLevel: 'error' });
  const run = spawnSync(process.execPath, ['--test', output], { stdio: 'inherit' });
  process.exitCode = run.status ?? 1;
} finally { await rm(scratch, { recursive: true, force: true }); }
