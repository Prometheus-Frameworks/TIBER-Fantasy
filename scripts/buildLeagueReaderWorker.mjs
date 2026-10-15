import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const output = process.argv[2];
if (!output) throw new Error('Supply an absolute worker output path');
if (!output.startsWith('/')) throw new Error('Output path must be absolute');
await mkdir(dirname(output), { recursive: true });
const result = await build({ entryPoints: ['server/mcp/leagueReaderWorker.ts'], outfile: resolve(output),
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', minify: true, metafile: true,
  alias: { '@shared': resolve('shared') }, legalComments: 'eof' });
const unexpected = Object.keys(result.metafile.inputs).filter(p => /historicalEvidence|server\/db|schema\.ts|dotenv|draftReviewService/.test(p));
if (unexpected.length) throw new Error(`Worker isolation failed: ${unexpected.join(', ')}`);
await writeFile(`${output}.meta.json`, JSON.stringify(result.metafile));
console.log(`Built isolated league reader: ${Object.keys(result.metafile.inputs).length} modules`);
