// Test the consensus bubble generator implementation
const testData = [
  {
    player_id: "WR001",
    player_name: "Justin Jefferson", 
    position: "WR",
    team: "MIN",
    average_rank: 2.1,
    standard_deviation: 1.2,
    min_rank: 1,
    max_rank: 4,
    rank_count: 5
  },
  {
    player_id: "WR002", 
    player_name: "CeeDee Lamb",
    position: "WR", 
    team: "DAL",
    average_rank: 2.9,
    standard_deviation: 2.1,
    min_rank: 1,
    max_rank: 6,
    rank_count: 5
  },
  {
    player_id: "WR003",
    player_name: "Amon-Ra St. Brown", 
    position: "WR",
    team: "DET", 
    average_rank: 4.4,
    standard_deviation: 1.8,
    min_rank: 2,
    max_rank: 7,
    rank_count: 5
  },
  {
    player_id: "WR004",
    player_name: "Puka Nacua",
    position: "WR",
    team: "LAR",
    average_rank: 6.0,
    standard_deviation: 3.2,
    min_rank: 3, 
    max_rank: 10,
    rank_count: 5
  },
  {
    player_id: "WR005",
    player_name: "Terry McLaurin",
    position: "WR", 
    team: "WAS",
    average_rank: 6.7,
    standard_deviation: 2.8,
    min_rank: 4,
    max_rank: 9,
    rank_count: 5
  }
];

function generateTierBubbles(playerRankings, rankDiffThreshold = 1.5, stdDevThreshold = 5.0) {
  // Sort players by average rank
  const sortedPlayers = [...playerRankings].sort((a, b) => a.average_rank - b.average_rank);
  
  const bubbles = [];
  let currentBubble = [];
  let lastAvgRank = null;
  let tierNumber = 1;

  for (const player of sortedPlayers) {
    const avgRank = player.average_rank;
    const stdDev = player.standard_deviation;

    if (currentBubble.length === 0) {
      // Start first bubble
      currentBubble.push(player);
      lastAvgRank = avgRank;
      continue;
    }

    const avgDiff = Math.abs(avgRank - (lastAvgRank || 0));

    if (avgDiff <= rankDiffThreshold && stdDev <= stdDevThreshold) {
      // Keep player in current bubble
      currentBubble.push(player);
      lastAvgRank = avgRank;
    } else {
      // Close current bubble and start new one
      if (currentBubble.length > 0) {
        bubbles.push({
          tier_number: tierNumber,
          players: currentBubble.map(p => ({...p}))
        });
        tierNumber++;
      }
      currentBubble = [player];
      lastAvgRank = avgRank;
    }
  }

  // Append final bubble
  if (currentBubble.length > 0) {
    bubbles.push({
      tier_number: tierNumber,
      players: currentBubble.map(p => ({...p}))
    });
  }

  return bubbles;
}

// Test the algorithm
console.log("🧪 Testing Tier Bubble Generator");
console.log("================================");

const result = generateTierBubbles(testData);

result.forEach(bubble => {
  console.log(`\n📦 Tier ${bubble.tier_number}:`);
  bubble.players.forEach(player => {
    console.log(`  - ${player.player_name} (${player.average_rank} avg, ${player.standard_deviation} std)`);
  });
});

console.log(`\n✅ Generated ${result.length} tier bubbles from ${testData.length} players`);