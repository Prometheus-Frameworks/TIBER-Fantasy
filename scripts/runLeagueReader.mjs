import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length !== 1 || !['--source-disabled', '--public-sleeper'].includes(args[0])) {
  process.stderr.write('Choose --source-disabled or explicitly opt into --public-sleeper.\n'); process.exit(2);
}
if (!existsSync(resolve(root, 'node_modules/tsx'))) { process.stderr.write('Installed locked dependencies required.\n'); process.exit(2); }
const child = spawn(process.execPath, ['--import', 'tsx', resolve(root, 'server/mcp/leagueReaderStdio.ts')], {
  cwd: root, stdio: 'inherit', env: { PATH: dirname(process.execPath), LANG: process.env.LANG || 'C.UTF-8',
    TZ: 'UTC', TIBER_LEAGUE_SOURCE: args[0] === '--public-sleeper' ? 'public-sleeper' : 'disabled' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => { process.stderr.write('League reader startup unavailable.\n'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
