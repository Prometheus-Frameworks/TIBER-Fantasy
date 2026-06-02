import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { RookieArtifactClient } from '../rookieArtifactClient';

describe('RookieArtifactClient', () => {
  it('loads the requested season from the promoted rookie-alpha directory', async () => {
    const promotedDir = await mkdtemp(path.join(os.tmpdir(), 'rookie-alpha-'));
    const sourcePath = path.join(promotedDir, '2026_rookie_alpha_predraft_v0.json');
    await writeFile(sourcePath, JSON.stringify({ meta: { season: 2026 }, players: [{ name: 'Jeremiyah Love', pos: 'RB' }] }));

    try {
      const client = new RookieArtifactClient({ artifactPath: promotedDir, enabled: true });
      await expect(client.loadPromotedRookieArtifact(2026)).resolves.toEqual({
        payload: { meta: { season: 2026 }, players: [{ name: 'Jeremiyah Love', pos: 'RB' }] },
        sourcePath,
      });
    } finally {
      await rm(promotedDir, { recursive: true, force: true });
    }
  });
});
