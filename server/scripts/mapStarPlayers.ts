#!/usr/bin/env tsx
/**
 * Map remaining star players to Sleeper IDs
 */

import { playerIdentityService } from '../services/PlayerIdentityService';
import { db } from '../infra/db';
import { playerIdentityMap } from '@shared/schema';
import { eq } from 'drizzle-orm';

const starPlayerMappings = [
  { name: 'Sam LaPorta', sleeperId: '10859', position: 'TE', team: 'DET' },
  { name: 'Puka Nacua', sleeperId: '9493', position: 'WR', team: 'LAR' },
  { name: "De'Von Achane", sleeperId: '9226', position: 'RB', team: 'MIA' },
  { name: 'Bijan Robinson', sleeperId: '9509', position: 'RB', team: 'ATL' },
  { name: 'Jahmyr Gibbs', sleeperId: '9221', position: 'RB', team: 'DET' },
  { name: 'C.J. Stroud', sleeperId: '9758', position: 'QB', team: 'HOU' },
];

async function mapStarPlayers() {
  console.log('🌟 Mapping remaining star players...\n');

  for (const player of starPlayerMappings) {
    try {
      // Find the player in identity map
      const identityPlayer = await db
        .select()
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap.fullName, player.name))
        .limit(1);

      if (identityPlayer.length === 0) {
        console.log(`❌ ${player.name} not found in identity map`);
        continue;
      }

      const canonicalId = identityPlayer[0].canonicalId;

      // Map the Sleeper ID
      const updated = await playerIdentityService.addIdentityMapping({
        canonicalId: canonicalId,
        externalId: player.sleeperId,
        platform: 'sleeper',
        confidence: 0.98,
        overwrite: false
      });

      if (updated) {
        console.log(`✅ ${player.name} (${player.position}, ${player.team}) → Sleeper ID: ${player.sleeperId}`);
      } else {
        console.log(`⚠️  ${player.name} already mapped`);
      }
    } catch (error) {
      console.error(`❌ Error mapping ${player.name}:`, error);
    }
  }

  console.log('\n🎉 Star player mapping complete!');
  process.exit(0);
}

mapStarPlayers();
