import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export function offlineEnvironment() {
  return { PATH: dirname(process.execPath), LANG: 'C', TZ: 'UTC', TIBER_WEEKLY_EVIDENCE_OFFLINE: '1' };
}

// No arbitrary source path, env override, or automatic package acquisition.
const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked && (process.argv.length !== 3 || process.argv[2] !== '--offline')) {
  process.stderr.write('Usage: node scripts/runWeeklyEvidenceOffline.mjs --offline\n');
  process.exitCode = 2;
} else if (invoked) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  // Loader mode avoids tsx CLI's auxiliary IPC listener; stdio is the sole transport.
  const child = spawn(process.execPath, ['--import', resolve(root, 'node_modules/tsx/dist/loader.mjs'), resolve(root, 'server/mcp/weeklyEvidenceServer.ts')], {
    cwd: root, stdio: 'inherit',
    env: offlineEnvironment(),
  });
  child.on('error', () => { process.stderr.write('weekly_evidence_launch_failed\n'); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
}
