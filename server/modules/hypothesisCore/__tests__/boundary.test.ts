import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const productionFiles = ['schemas.ts','canonicalization.ts','conformance.ts'];
const forbiddenImports = [/from ['\"](?:.*\/)?(?:storage|db|routes?|mcp|providers?|roster|occupancy)/i, /process\.env/, /\bfetch\s*\(/, /axios/, /drizzle/, /Date\.now\s*\(/, /Math\.random\s*\(/];

describe('pure-domain boundary', () => {
  it.each(productionFiles)('%s has no external-effect dependency', file => {
    const source = readFileSync(join(moduleRoot, file), 'utf8');
    for (const pattern of forbiddenImports) expect(source).not.toMatch(pattern);
  });

  it('does not export comparison, attention, persistence, provider, or activation behavior', async () => {
    const exported = new Set(Object.keys(await import('../conformance')));
    for (const forbidden of ['compare','rank','save','insert','update','delete','activate','notify','discover','fetch']) expect(exported.has(forbidden)).toBe(false);
  });
});
