import { TiberService } from '../services/tiberService';
import { db } from '../db';
import { bronzeNflfastrPlays, playerIdentityMap } from '../../shared/schema';
import { eq, and, lte, or, sql } from 'drizzle-orm';

const tiberService = new TiberService();

interface ActualPlayerData {
  name: string;
  nflfastrId: string;
  position: string;
  targets: number;
  receivingFirstDowns: number;
  rushes: number;
  rushingFirstDowns: number;
}

async function getActualPlayerData(nflfastrId: string): Promise<ActualPlayerData | null> {
  // Get player info
  const player = await db
    .select({
      name: playerIdentityMap.fullName,
      position: playerIdentityMap.position,
    })
    .from(playerIdentityMap)
    .where(eq(playerIdentityMap.nflDataPyId, nflfastrId))
    .limit(1);

  if (!player[0]) return null;

  // Get stats
  const stats = await db
    .select({
      targets: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.receiverPlayerId} = ${nflfastrId} THEN 1 END)`,
      receivingFirstDowns: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.receiverPlayerId} = ${nflfastrId} AND ${bronzeNflfastrPlays.firstDownPass} = true THEN 1 END)`,
      rushes: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.rusherPlayerId} = ${nflfastrId} THEN 1 END)`,
      rushingFirstDowns: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.rusherPlayerId} = ${nflfastrId} AND ${bronzeNflfastrPlays.firstDownRush} = true THEN 1 END)`,
    })
    .from(bronzeNflfastrPlays)
    .where(
      and(
        eq(bronzeNflfastrPlays.season, 2025),
        lte(bronzeNflfastrPlays.week, 6),
        or(
          eq(bronzeNflfastrPlays.receiverPlayerId, nflfastrId),
          eq(bronzeNflfastrPlays.rusherPlayerId, nflfastrId)
        )
      )
    );

  return {
    name: player[0].name,
    nflfastrId,
    position: player[0].position,
    targets: Number(stats[0]?.targets || 0),
    receivingFirstDowns: Number(stats[0]?.receivingFirstDowns || 0),
    rushes: Number(stats[0]?.rushes || 0),
    rushingFirstDowns: Number(stats[0]?.rushingFirstDowns || 0),
  };
}

function calculateExpectedRate(data: ActualPlayerData): number {
  const ROUTE_MULTIPLIERS: Record<string, number> = {
    'WR': 3.5,
    'TE': 2.8,
    'RB': 1.2,
  };

  if (data.position === 'RB') {
    // RB: First downs per touch
    const totalTouches = data.targets + data.rushes;
    const totalFirstDowns = data.receivingFirstDowns + data.rushingFirstDowns;
    return totalTouches > 0 ? totalFirstDowns / totalTouches : 0;
  } else {
    // WR/TE: First downs per route run
    const multiplier = ROUTE_MULTIPLIERS[data.position] || 3.5;
    const routesRun = data.targets * multiplier;
    return routesRun > 0 ? data.receivingFirstDowns / routesRun : 0;
  }
}

async function validateTiberActual() {
  console.log("🎯 TIBER v1.5 Accuracy Validation\n");
  console.log("Verifying TIBER calculations match NFLfastR data...\n");

  const testPlayers = [
    "00-0037247", // George Pickens
    "00-0040124", // Tetairoa McMillan
    "00-0038543", // Jaxon Smith-Njigba
    "00-0039075", // Puka Nacua
    "00-0036963", // Amon-Ra St. Brown
    "00-0036900", // Ja'Marr Chase
    "00-0036223", // Jonathan Taylor (RB test)
  ];

  let passed = 0;
  let failed = 0;

  for (const playerId of testPlayers) {
    const actualData = await getActualPlayerData(playerId);
    if (!actualData) {
      console.log(`❌ Could not find player ${playerId}`);
      failed++;
      continue;
    }

    console.log(`\n📊 ${actualData.name} (${actualData.position})`);
    console.log(`${'─'.repeat(50)}`);

    try {
      // Calculate TIBER score
      const tiberScore = await tiberService.calculateTiberScore(playerId, 6, 2025);
      
      // Calculate expected rate from raw data
      const expectedRate = calculateExpectedRate(actualData);
      const actualRate = tiberScore.metrics.firstDownRate;

      // Show data
      if (actualData.position === 'RB') {
        console.log(`Targets: ${actualData.targets}, Rushes: ${actualData.rushes}`);
        console.log(`Total Touches: ${actualData.targets + actualData.rushes}`);
        console.log(`Total 1st Downs: ${actualData.receivingFirstDowns + actualData.rushingFirstDowns}`);
      } else {
        console.log(`Targets: ${actualData.targets}`);
        const multiplier = actualData.position === 'TE' ? 2.8 : 3.5;
        console.log(`Est. Routes: ${actualData.targets * multiplier}`);
        console.log(`Receiving 1st Downs: ${actualData.receivingFirstDowns}`);
      }

      console.log(`\nExpected 1D Rate: ${(expectedRate * 100).toFixed(2)}%`);
      console.log(`TIBER Calculated:  ${(actualRate * 100).toFixed(2)}%`);
      console.log(`Difference:        ${Math.abs((actualRate - expectedRate) * 100).toFixed(2)}%`);
      
      console.log(`\nTIBER Score: ${tiberScore.tiberScore} (${tiberScore.tier})`);
      console.log(`Breakdown: 1D=${tiberScore.breakdown.firstDownScore} EPA=${tiberScore.breakdown.epaScore} Usage=${tiberScore.breakdown.usageScore} TD=${tiberScore.breakdown.tdScore} Team=${tiberScore.breakdown.teamScore}`);

      // Validation: rates should match within 0.1%
      const diff = Math.abs(actualRate - expectedRate);
      if (diff < 0.001) {
        console.log(`✅ PASS - Calculation accurate`);
        passed++;
      } else {
        console.log(`❌ FAIL - Calculation mismatch`);
        failed++;
      }

    } catch (error: any) {
      console.log(`❌ ERROR: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 VALIDATION RESULTS`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Passed: ${passed}/${testPlayers.length}`);
  console.log(`Failed: ${failed}/${testPlayers.length}`);
  console.log(`Success Rate: ${((passed / testPlayers.length) * 100).toFixed(1)}%`);

  if (passed === testPlayers.length) {
    console.log(`\n🎉 ALL TESTS PASSED - TIBER v1.5 calculations are accurate!`);
  } else if (passed >= testPlayers.length * 0.8) {
    console.log(`\n✅ MOSTLY PASSING - Minor issues found`);
  } else {
    console.log(`\n⚠️  NEEDS WORK - Calculation errors detected`);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateTiberActual()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
