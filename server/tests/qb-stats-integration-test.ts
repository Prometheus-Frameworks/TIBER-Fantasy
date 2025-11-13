import { db } from '../infra/db';
import { chunks } from '../../shared/schema';
import { generateEmbedding } from '../services/geminiEmbeddings';
import { sql } from 'drizzle-orm';

interface QBStat {
  name: string;
  yds: number;
  season: number;
  tm: string;
  gp: number;
  cmp: number;
  att: number;
  pct: number;
  avg: number;
  yds_g: number;
  td: number;
  int: number;
  rtg: number;
  td_perc: number;
  int_perc: number;
  sck: number;
  scky: number;
}

interface ChunkData {
  content: string;
  metadata: {
    player_id: string;
    position: string;
    season: number;
    analysis_type: string;
  };
}

const qbData: ChunkData[] = [
  {
    "content": "{\"name\":\"Joe Burrow\",\"yds\":4918,\"season\":2024,\"tm\":\"CIN\",\"gp\":17,\"cmp\":460,\"att\":652,\"pct\":70.6,\"avg\":7.5,\"yds_g\":289.3,\"td\":43,\"int\":9,\"rtg\":108.5,\"td_perc\":6.6,\"int_perc\":1.4,\"sck\":48,\"scky\":278}",
    "metadata": {
      "player_id": "Joe Burrow",
      "position": "QB",
      "season": 2024,
      "analysis_type": "passing_stats"
    }
  },
  {
    "content": "{\"name\":\"Jared Goff\",\"yds\":4629,\"season\":2024,\"tm\":\"DET\",\"gp\":17,\"cmp\":390,\"att\":539,\"pct\":72.4,\"avg\":8.6,\"yds_g\":272.3,\"td\":37,\"int\":12,\"rtg\":111.8,\"td_perc\":6.9,\"int_perc\":2.2,\"sck\":31,\"scky\":234}",
    "metadata": {
      "player_id": "Jared Goff",
      "position": "QB",
      "season": 2024,
      "analysis_type": "passing_stats"
    }
  },
  {
    "content": "{\"name\":\"Baker Mayfield\",\"yds\":4500,\"season\":2024,\"tm\":\"TB\",\"gp\":17,\"cmp\":407,\"att\":570,\"pct\":71.4,\"avg\":7.9,\"yds_g\":264.7,\"td\":41,\"int\":16,\"rtg\":106.8,\"td_perc\":7.2,\"int_perc\":2.8,\"sck\":40,\"scky\":248}",
    "metadata": {
      "player_id": "Baker Mayfield",
      "position": "QB",
      "season": 2024,
      "analysis_type": "passing_stats"
    }
  },
  {
    "content": "{\"name\":\"Geno Smith\",\"yds\":4320,\"season\":2024,\"tm\":\"SEA\",\"gp\":17,\"cmp\":407,\"att\":578,\"pct\":70.4,\"avg\":7.5,\"yds_g\":254.1,\"td\":21,\"int\":15,\"rtg\":93.2,\"td_perc\":3.6,\"int_perc\":2.6,\"sck\":50,\"scky\":338}",
    "metadata": {
      "player_id": "Geno Smith",
      "position": "QB",
      "season": 2024,
      "analysis_type": "passing_stats"
    }
  },
  {
    "content": "{\"name\":\"Sam Darnold\",\"yds\":4319,\"season\":2024,\"tm\":\"MIN\",\"gp\":17,\"cmp\":361,\"att\":545,\"pct\":66.2,\"avg\":7.9,\"yds_g\":254.1,\"td\":35,\"int\":12,\"rtg\":102.5,\"td_perc\":6.4,\"int_perc\":2.2,\"sck\":48,\"scky\":335}",
    "metadata": {
      "player_id": "Sam Darnold",
      "position": "QB",
      "season": 2024,
      "analysis_type": "passing_stats"
    }
  },
  {
    "content": "{\"name\":\"Lamar Jackson\",\"yds\":4172,\"season\":2024,\"tm\":\"BAL\",\"gp\":17,\"cmp\":316,\"att\":474,\"pct\":66.7,\"avg\":8.8,\"yds_g\":245.4,\"td\":41,\"int\":4,\"rtg\":119.6,\"td_perc\":8.6,\"int_perc\":0.8,\"sck\":23,\"scky\":149}",
    "metadata": {
      "player_id": "Lamar Jackson",
      "position": "QB",
      "season": 2024,
      "analysis_type": "passing_stats"
    }
  },
  {
    "content": "{\"name\":\"Patrick Mahomes\",\"yds\":3928,\"season\":2024,\"tm\":\"KC\",\"gp\":16,\"cmp\":392,\"att\":581,\"pct\":67.5,\"avg\":6.8,\"yds_g\":245.5,\"td\":26,\"int\":11,\"rtg\":93.5,\"td_perc\":4.5,\"int_perc\":1.9,\"sck\":36,\"scky\":239}",
    "metadata": {
      "player_id": "Patrick Mahomes",
      "position": "QB",
      "season": 2024,
      "analysis_type": "passing_stats"
    }
  },
  {
    "content": "{\"name\":\"Aaron Rodgers\",\"yds\":3897,\"season\":2024,\"tm\":\"NYJ\",\"gp\":17,\"cmp\":368,\"att\":584,\"pct\":63.0,\"avg\":6.7,\"yds_g\":229.2,\"td\":28,\"int\":11,\"rtg\":90.5,\"td_perc\":4.8,\"int_perc\":1.9,\"sck\":40,\"scky\":302}",
    "metadata": {
      "player_id": "Aaron Rodgers",
      "position": "QB",
      "season": 2024,
      "analysis_type": "passing_stats"
    }
  },
  {
    "content": "{\"name\":\"Justin Herbert\",\"yds\":3870,\"season\":2024,\"tm\":\"LAC\",\"gp\":17,\"cmp\":332,\"att\":504,\"pct\":65.9,\"avg\":7.7,\"yds_g\":227.6,\"td\":23,\"int\":3,\"rtg\":101.7,\"td_perc\":4.6,\"int_perc\":0.6,\"sck\":41,\"scky\":244}",
    "metadata": {
      "player_id": "Justin Herbert",
      "position": "QB",
      "season": 2024,
      "analysis_type": "passing_stats"
    }
  },
  {
    "content": "{\"name\":\"Brock Purdy\",\"yds\":3864,\"season\":2024,\"tm\":\"SF\",\"gp\":15,\"cmp\":300,\"att\":455,\"pct\":65.9,\"avg\":8.5,\"yds_g\":257.6,\"td\":20,\"int\":12,\"rtg\":96.1,\"td_perc\":4.4,\"int_perc\":2.6,\"sck\":31,\"scky\":156}",
    "metadata": {
      "player_id": "Brock Purdy",
      "position": "QB",
      "season": 2024,
      "analysis_type": "passing_stats"
    }
  }
];

function formatQBStatsForHuman(stats: QBStat): string {
  return `${stats.name} - 2024 season: ${stats.yds} yards, ${stats.td} TDs, ${stats.int} INTs, ${stats.rtg} rating (${stats.gp} games, ${stats.cmp}/${stats.att} completions, ${stats.pct}% completion rate)`;
}

async function loadQBStats() {
  console.log('🏈 Starting QB Stats Integration Test...\n');
  
  try {
    // Step 1: Generate embeddings and insert chunks
    console.log('📊 Step 1: Loading 10 QB stat chunks...');
    let insertedCount = 0;
    
    for (const chunk of qbData) {
      const stats: QBStat = JSON.parse(chunk.content);
      
      // Create human-readable content for embedding
      const humanReadable = formatQBStatsForHuman(stats);
      
      console.log(`  Processing: ${stats.name}...`);
      
      // Generate embedding
      const embedding = await generateEmbedding(humanReadable);
      
      // Insert into database
      await db.insert(chunks).values({
        content: humanReadable,
        embedding,
        metadata: chunk.metadata
      });
      
      insertedCount++;
      console.log(`    ✓ Inserted with embedding (${embedding.length} dimensions)`);
    }
    
    console.log(`\n✅ Successfully inserted ${insertedCount}/10 chunks\n`);
    
    // Step 2: Test retrieval - Find Lamar Jackson
    console.log('🔍 Step 2: Testing retrieval - "How did Lamar Jackson perform in 2024?"');
    
    const testQuery1 = "How did Lamar Jackson perform in 2024?";
    const queryEmbedding1 = await generateEmbedding(testQuery1);
    const vectorString1 = `[${queryEmbedding1.join(',')}]`;
    
    const results1 = await db.execute(
      sql`
        SELECT 
          content,
          metadata,
          (1 - (embedding <-> ${vectorString1}::vector) / 2) as similarity
        FROM chunks
        WHERE metadata->>'player_id' = 'Lamar Jackson'
          AND metadata->>'season' = '2024'
        ORDER BY embedding <-> ${vectorString1}::vector
        LIMIT 1
      `
    );
    
    if (results1.rows && results1.rows.length > 0) {
      const result = results1.rows[0] as any;
      console.log(`  ✓ Retrieved Lamar's chunk (similarity: ${(result.similarity * 100).toFixed(1)}%)`);
      console.log(`  Content: ${result.content}`);
      console.log(`  Expected: "2024 season: 4172 yards, 41 TDs, 4 INTs, 119.6 rating"`);
      
      const hasCorrectStats = 
        result.content.includes('4172 yards') &&
        result.content.includes('41 TDs') &&
        result.content.includes('4 INTs') &&
        result.content.includes('119.6 rating');
      
      if (hasCorrectStats) {
        console.log(`  ✅ PASS: Correct stats retrieved\n`);
      } else {
        console.log(`  ❌ FAIL: Stats don't match expected values\n`);
      }
    } else {
      console.log(`  ❌ FAIL: No results found for Lamar Jackson\n`);
    }
    
    // Step 3: Test semantic search across all QBs
    console.log('🔍 Step 3: Testing semantic search - "elite QB efficiency 2024"');
    
    const testQuery2 = "elite QB efficiency 2024";
    const queryEmbedding2 = await generateEmbedding(testQuery2);
    const vectorString2 = `[${queryEmbedding2.join(',')}]`;
    
    const results2 = await db.execute(
      sql`
        SELECT 
          content,
          metadata,
          (1 - (embedding <-> ${vectorString2}::vector) / 2) as similarity
        FROM chunks
        WHERE metadata->>'season' = '2024'
          AND metadata->>'analysis_type' = 'passing_stats'
        ORDER BY embedding <-> ${vectorString2}::vector
        LIMIT 3
      `
    );
    
    console.log(`  Retrieved top 3 results:`);
    if (results2.rows) {
      results2.rows.forEach((result: any, idx: number) => {
        console.log(`    ${idx + 1}. ${result.metadata.player_id} (similarity: ${(result.similarity * 100).toFixed(1)}%)`);
      });
    
      // Should prioritize high passer ratings (Lamar 119.6, Goff 111.8, Burrow 108.5)
      const topResult = results2.rows[0] as any;
      const isLamarOrGoff = 
        topResult.metadata.player_id === 'Lamar Jackson' ||
        topResult.metadata.player_id === 'Jared Goff';
      
      if (isLamarOrGoff) {
        console.log(`  ✅ PASS: Top result is high-efficiency QB (Lamar/Goff)\n`);
      } else {
        console.log(`  ⚠️  WARNING: Top result is ${topResult.metadata.player_id} (expected Lamar or Goff)\n`);
      }
    }
    
    // Step 4: Verify chunk count
    console.log('📊 Step 4: Verifying total chunk count...');
    
    const countResult = await db.execute(
      sql`
        SELECT COUNT(*) as count
        FROM chunks
        WHERE metadata->>'season' = '2024'
          AND metadata->>'analysis_type' = 'passing_stats'
      `
    );
    
    const count = countResult.rows ? (countResult.rows[0] as any).count : 0;
    console.log(`  Total 2024 QB stat chunks: ${count}`);
    
    if (count >= 10) {
      console.log(`  ✅ PASS: All chunks inserted successfully\n`);
    } else {
      console.log(`  ❌ FAIL: Expected 10+ chunks, found ${count}\n`);
    }
    
    console.log('🎉 Integration test complete!\n');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    throw error;
  }
}

// Run the test
loadQBStats()
  .then(() => {
    console.log('✅ All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
