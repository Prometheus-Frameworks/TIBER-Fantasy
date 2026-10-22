import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { mkdir, writeFile, readFile, realpath, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const output = process.argv[2];
if (!output) throw new Error('Supply an absolute worker output path');
if (!output.startsWith('/')) throw new Error('Output path must be absolute');
// Private input is opt-in and never accepted by CI. Default/public builds retain null.
const flags = process.argv.slice(3);
let privateInput;
if (flags.length) {
  const ci = ['CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'BUILDKITE', 'CIRCLECI', 'TF_BUILD', 'JENKINS_URL', 'TEAMCITY_VERSION'].some(k => process.env[k]);
  if (ci || flags.length !== 5 || flags[0] !== '--owner-private' || flags[1] !== '--role-evidence' || flags[3] !== '--sha256') throw new Error('Private build refused');
  const input = resolve(flags[2]);
  const repo = await realpath('.');
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  const realInput = await realpath(input);
  const realOutputParent = await realpath(dirname(output));
  if (!flags[2].startsWith('/') || realInput === repo || realInput.startsWith(repo + '/') || realOutputParent === repo || realOutputParent.startsWith(repo + '/')) throw new Error('Private input/output must be outside repository');
  try { await lstat(output); throw new Error('Private output already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  process.umask(0o077);
  privateInput = await readFile(input);
  // Independent fixed pin: a caller-supplied digest alone cannot authenticate a substituted input.
  const preparedSha256 = 'd5d4cb469fc0bed4b5df1576a424c21b102844a7d9bd7b937e240e53666c1083';
  if (flags[4] !== preparedSha256 || createHash('sha256').update(privateInput).digest('hex') !== preparedSha256) throw new Error('Private input pin mismatch');
  const { createRoleTools } = await import('../server/modules/roleEvidence/roleHistory.ts');
  if (createRoleTools(JSON.parse(privateInput.toString('utf8')), true).capability.status !== 'available') throw new Error('Invalid private artifact');
}
await mkdir(dirname(output), { recursive: true });
let result;
try { result = await build({ entryPoints: ['server/mcp/leagueReaderWorker.ts'], outfile: resolve(output),
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', minify: true, metafile: true,
  alias: { '@shared': resolve('shared') }, legalComments: 'eof',
  logLevel: 'silent', plugins: privateInput ? [{ name: 'owner-private-role-input', setup(build) {
    build.onLoad({ filter: /\/roleEvidence\/privateRoleEvidence\.ts$/ }, () => ({
      contents: `export default JSON.parse(${JSON.stringify(privateInput.toString('utf8'))});`, loader: 'ts',
    }));
  } }] : [] }); } catch (error) {
  if (privateInput) throw new Error('Private Worker build failed; diagnostics withheld');
  throw error;
}
const unexpected = Object.keys(result.metafile.inputs).filter(p => /historicalEvidence|server\/db|schema\.ts|dotenv|draftReviewService/.test(p));
if (unexpected.length) throw new Error(`Worker isolation failed: ${unexpected.join(', ')}`);
await writeFile(`${output}.meta.json`, JSON.stringify(result.metafile), { mode: 0o600 });
if (privateInput) {
  const { chmod } = await import('node:fs/promises');
  await chmod(output, 0o600);
}
const bytes = await readFile(output);
console.log(JSON.stringify({ status: 'built', modules: Object.keys(result.metafile.inputs).length,
  privateInput: Boolean(privateInput), bytes: bytes.length, gzipBytes: gzipSync(bytes).length,
  sha256: createHash('sha256').update(bytes).digest('hex') }));
