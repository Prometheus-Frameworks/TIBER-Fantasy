import fs from 'node:fs/promises';
import path from 'node:path';
import { mapRookieArtifactToFantasySurface } from '../../server/modules/externalModels/rookies/rookieArtifactAdapter';

async function main() {
  const artifactPath = path.resolve(process.cwd(), 'exports/promoted/rookie-alpha/2026_rookie_alpha_predraft_v0.json');
  const payload = JSON.parse(await fs.readFile(artifactPath, 'utf8'));
  const mapped = mapRookieArtifactToFantasySurface(payload, artifactPath);

  if (mapped.season !== 2026) {
    throw new Error(`Expected season 2026, got ${mapped.season}`);
  }
  if (mapped.count <= 4) {
    throw new Error(`Expected expanded coverage above 4 players, got ${mapped.count}`);
  }

  const ids = new Set<string>();
  for (const player of mapped.players) {
    if (!player.player_id) {
      throw new Error(`Missing player_id for ${player.player_name}`);
    }
    if (ids.has(player.player_id)) {
      throw new Error(`Duplicate player_id detected: ${player.player_id}`);
    }
    ids.add(player.player_id);
  }

  console.log(`✅ Valid promoted rookie artifact. season=${mapped.season} count=${mapped.count}`);
}

main().catch((error) => {
  console.error('❌ Rookie artifact validation failed:', error);
  process.exit(1);
});
