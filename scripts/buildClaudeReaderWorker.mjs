// League-only build of the Claude admission Worker. Private ROP input is never accepted here;
// moving private data to a second host requires its own separate authorization.
import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
if (args.length !== 1 || !args[0].startsWith('/')) throw new Error('Usage: buildClaudeReaderWorker.mjs /absolute/output.mjs (no other flags; private input refused)');
const target = resolve(args[0]);
await mkdir(dirname(target), { recursive: true });
const result = await build({ entryPoints: ['server/mcp/claudeAdmissionWorker.ts'], outfile: target,
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', minify: true, metafile: true,
  alias: { '@shared': resolve('shared') }, legalComments: 'eof', logLevel: 'silent' });
const unexpected = Object.keys(result.metafile.inputs).filter(p => /historicalEvidence|server\/db|schema\.ts|dotenv|draftReviewService/.test(p));
if (unexpected.length) throw new Error(`Worker isolation failed: ${unexpected.join(', ')}`);
await writeFile(`${target}.meta.json`, JSON.stringify(result.metafile));
const bytes = await readFile(target);
console.log(JSON.stringify({ status: 'built', entry: 'claudeAdmissionWorker', modules: Object.keys(result.metafile.inputs).length,
  privateInput: false, bytes: bytes.length, gzipBytes: gzipSync(bytes).length,
  sha256: createHash('sha256').update(bytes).digest('hex') }));
