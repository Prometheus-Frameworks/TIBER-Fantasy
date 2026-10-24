import { build } from 'esbuild';
import { resolve, dirname, basename, join } from 'node:path';
import { mkdir, writeFile, readFile, realpath, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const output = process.argv[2];
if (!output) throw new Error('Supply an absolute worker output path');
if (!output.startsWith('/')) throw new Error('Output path must be absolute');
const target = resolve(output);
// Private input is opt-in and never accepted by CI. Default/public builds retain null.
const flags = process.argv.slice(3);
let privateInput, privateRelease;
if (flags.length) {
  const ci = ['CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'BUILDKITE', 'CIRCLECI', 'TF_BUILD', 'JENKINS_URL', 'TEAMCITY_VERSION'].some(k => process.env[k]);
  if (ci || flags.length !== 5 || flags[0] !== '--owner-private' || flags[1] !== '--role-evidence' || flags[3] !== '--sha256') throw new Error('Private build refused');
  const input = resolve(flags[2]);
  const repo = await realpath('.');
  const inside = path => path === repo || path.startsWith(repo + '/') || path === process.cwd() || path.startsWith(process.cwd() + '/');
  // Canonical future destination through its nearest existing ancestor; creates nothing.
  const future = async path => {
    const missing = [];
    for (let at = path; ; at = dirname(at)) {
      try { return join(await realpath(at), ...missing.reverse()); } catch (error) {
        if (error.code !== 'ENOENT' || dirname(at) === at) throw error;
        // An existing but unresolvable entry (dangling link) is never a safe future directory.
        if (await lstat(at).then(() => true, () => false)) throw new Error('Private output path unresolvable');
        missing.push(basename(at));
      }
    }
  };
  const realInput = await realpath(input);
  if (!flags[2].startsWith('/') || inside(input) || inside(realInput) || inside(target) || inside(await future(dirname(target)))) throw new Error('Private input/output must be outside repository');
  try { await lstat(target); throw new Error('Private output already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  privateInput = await readFile(input);
  // Independent fixed pin: a caller-supplied digest alone cannot authenticate a substituted input.
  const preparedSha256 = 'd5d4cb469fc0bed4b5df1576a424c21b102844a7d9bd7b937e240e53666c1083';
  if (flags[4] !== preparedSha256 || createHash('sha256').update(privateInput).digest('hex') !== preparedSha256) throw new Error('Private input pin mismatch');
  const { createRoleTools } = await import('../server/modules/roleEvidence/roleHistory.ts');
  const prepared = JSON.parse(privateInput.toString('utf8'));
  const reader = createRoleTools(prepared, true);
  if (!reader.initialize() || reader.capability.status !== 'available') throw new Error('Invalid private artifact');
  privateRelease = reader.capability.release;
  // Only now, after paths, pin and artifact are accepted, create the destination; then recheck it.
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  if (inside(await realpath(dirname(target)))) throw new Error('Private input/output must be outside repository');
  process.umask(0o077);
}
await mkdir(dirname(target), { recursive: true });
let result;
try { result = await build({ entryPoints: ['server/mcp/leagueReaderWorker.ts'], outfile: target,
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', minify: true, metafile: true,
  alias: { '@shared': resolve('shared') }, legalComments: 'eof',
  logLevel: 'silent', plugins: privateInput ? [{ name: 'owner-private-role-input', setup(build) {
    // Module scope holds only the immutable text and validated release; the full parse is deferred.
    build.onLoad({ filter: /\/roleEvidence\/privateRoleEvidence\.ts$/ }, () => ({
      contents: `const text = ${JSON.stringify(privateInput.toString('utf8'))};\nexport default { release: ${JSON.stringify(privateRelease)}, load: () => JSON.parse(text) };`, loader: 'ts',
    }));
  } }] : [] }); } catch (error) {
  if (privateInput) throw new Error('Private Worker build failed; diagnostics withheld');
  throw error;
}
const unexpected = Object.keys(result.metafile.inputs).filter(p => /historicalEvidence|server\/db|schema\.ts|dotenv|draftReviewService/.test(p));
if (unexpected.length) throw new Error(`Worker isolation failed: ${unexpected.join(', ')}`);
await writeFile(`${target}.meta.json`, JSON.stringify(result.metafile), { mode: 0o600 });
if (privateInput) {
  const { chmod } = await import('node:fs/promises');
  await chmod(target, 0o600);
}
const bytes = await readFile(target);
console.log(JSON.stringify({ status: 'built', modules: Object.keys(result.metafile.inputs).length,
  privateInput: Boolean(privateInput), bytes: bytes.length, gzipBytes: gzipSync(bytes).length,
  sha256: createHash('sha256').update(bytes).digest('hex') }));
