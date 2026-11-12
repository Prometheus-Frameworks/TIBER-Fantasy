/**
 * Regenerate docs/prototypes/architecture-lab/EVIDENCE_MATRIX.md from the fixture (TIBER-Fantasy #434).
 *   npx tsx scripts/architecture-lab/writeEvidenceMatrix.ts
 */
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { ARCHITECTURE_GRAPH } from '../../client/src/pages/architectureLab/graphFixture';
import { renderEvidenceMatrixMarkdown } from '../../client/src/pages/architectureLab/graphLogic';

const out = path.join(process.cwd(), 'docs', 'prototypes', 'architecture-lab', 'EVIDENCE_MATRIX.md');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, renderEvidenceMatrixMarkdown(ARCHITECTURE_GRAPH));
console.log(`wrote ${out}`);
