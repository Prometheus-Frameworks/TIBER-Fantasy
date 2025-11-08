// server/scripts/validateRankings.ts
// Run this to verify rankings are showing correct players

import { db } from '../infra/db';
import { players } from '../../shared/schema';
import { eq, and, desc, sql, isNotNull } from 'drizzle-orm';

async function validateRankings() {
  console.log('🔍 Validating Fantasy Rankings Data\n');

  try {
    // Check total player count
    const allPlayers = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(players);
    
    console.log(`Total players in database: ${allPlayers[0].count}`);

    // Check fantasy-relevant players
    const fantasyPlayers = await db
      .select({
        position: players.position,
        count: sql<number>`COUNT(*)`,
      })
      .from(players)
      .where(
        and(
          eq(players.active, true),
          sql`${players.position} IN ('QB', 'RB', 'WR', 'TE')`,
          isNotNull(players.team),
          sql`${players.team} != ''`
        )
      )
      .groupBy(players.position);

    console.log('\n📊 Fantasy-Relevant Players by Position:');
    fantasyPlayers.forEach(stat => {
      console.log(`  ${stat.position}: ${stat.count}`);
    });

    // Get top 10 players
    const top10 = await db
      .select({
        name: players.name,
        position: players.position,
        team: players.team,
        avgPoints: players.avgPoints,
      })
      .from(players)
      .where(
        and(
          eq(players.active, true),
          sql`${players.position} IN ('QB', 'RB', 'WR', 'TE')`,
          isNotNull(players.team)
        )
      )
      .orderBy(desc(players.avgPoints))
      .limit(10);

    console.log('\n🏆 Top 10 Players (Preview):');
    top10.forEach((player, idx) => {
      console.log(`  ${idx + 1}. ${player.name} (${player.position}, ${player.team}) - Avg: ${player.avgPoints}`);
    });

    // Check for problem cases
    const problemPlayers = await db
      .select({
        name: players.name,
        position: players.position,
        team: players.team,
        active: players.active,
      })
      .from(players)
      .where(
        and(
          eq(players.active, true),
          sql`${players.position} IN ('QB', 'RB', 'WR', 'TE')`,
          sql`(${players.team} IS NULL OR ${players.team} = '')`
        )
      )
      .limit(10);

    if (problemPlayers.length > 0) {
      console.log('\n⚠️  Players missing team assignment:');
      problemPlayers.forEach(player => {
        console.log(`  - ${player.name} (${player.position})`);
      });
    }

    // Validate no practice squad players
    const suspiciousNames = [
      'Trenton Irwin',
      'Chris Myarick', 
      'Malik Taylor',
      'Laquon Treadwell',
      'Raheem Mostert'
    ];

    console.log('\n🔍 Checking for problem players...');
    for (const name of suspiciousNames) {
      const found = await db
        .select()
        .from(players)
        .where(sql`${players.name} ILIKE ${`%${name}%`}`)
        .limit(1);

      if (found.length > 0 && found[0].active) {
        console.log(`  ❌ Found: ${found[0].name} (${found[0].position}, ${found[0].team || 'NO TEAM'})`);
      } else {
        console.log(`  ✅ Not in rankings: ${name}`);
      }
    }

    console.log('\n✅ Validation complete!\n');

  } catch (error) {
    console.error('❌ Validation error:', error);
    process.exit(1);
  }
}

// Run validation
validateRankings()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
