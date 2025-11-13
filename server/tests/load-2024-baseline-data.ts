import { db } from '../infra/db';
import { chunks } from '../../shared/schema';
import { generateEmbedding } from '../services/geminiEmbeddings';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ChunkData {
  content: string;
  metadata: any;
}

// Helper to extract JSON array from file (handles trailing content)
function extractJSONArray(content: string): any[] {
  // Find the matching closing bracket for the first opening bracket
  let depth = 0;
  let startIndex = content.indexOf('[');
  
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '[') depth++;
    if (content[i] === ']') depth--;
    if (depth === 0) {
      // Found the closing bracket
      return JSON.parse(content.substring(startIndex, i + 1));
    }
  }
  
  throw new Error('Could not find complete JSON array in file');
}

// Load data from files
const rbWrTeContent = readFileSync(join(__dirname, '../../attached_assets/Pasted--content-name-Saquon-Barkley-rush-yds-2005-rush-td-13-ypc-5-8--1763040820861_1763040820863.txt'), 'utf-8');
const rbWrTeData: ChunkData[] = extractJSONArray(rbWrTeContent);

const patternContent = readFileSync(join(__dirname, '../../attached_assets/Pasted--content-Historical-pattern-2017-2024-Snap-share-80-correlates-with-top-12-finis-1763040891170_1763040891171.txt'), 'utf-8');
const patternData: ChunkData[] = extractJSONArray(patternContent);

// Elite baseline summaries (from handoff doc)
const eliteBaselineSummaries: ChunkData[] = [
  {
    content: "2024 Elite Baseline for RB: Snap share 78%, YPC 4.5, touches per game 20.5, route participation 25%. Sample: Saquon Barkley, Derrick Henry, Jahmyr Gibbs. Working assumption based on top-12 finishers in 2024.",
    metadata: {
      season: 2024,
      type: "elite_baseline_summary",
      position: "RB",
      data_source: "grok_aggregated",
      epistemic_status: "historical_data",
      applicable_to: ["rb"]
    }
  },
  {
    content: "2024 Elite Baseline for WR: Snap share 85%, YPT 7.8, targets per game 9.5, route participation 88%. Sample: Ja'Marr Chase, Justin Jefferson, Amon-Ra St. Brown. Working assumption based on top-12 finishers in 2024.",
    metadata: {
      season: 2024,
      type: "elite_baseline_summary",
      position: "WR",
      data_source: "grok_aggregated",
      epistemic_status: "historical_data",
      applicable_to: ["wr"]
    }
  },
  {
    content: "2024 Elite Baseline for TE: Snap share 75%, YPT 6.5, targets per game 7.0, route participation 65%. Sample: Brock Bowers, George Kittle, Trey McBride. Working assumption based on top-12 finishers in 2024.",
    metadata: {
      season: 2024,
      type: "elite_baseline_summary",
      position: "TE",
      data_source: "grok_aggregated",
      epistemic_status: "historical_data",
      applicable_to: ["te"]
    }
  }
];

function formatRBStatsForHuman(stats: any): string {
  const rushStats = `${stats.name} - 2024 season: ${stats.rush_yds} rushing yards, ${stats.rush_td} rushing TDs, ${stats.ypc} YPC`;
  const recStats = `${stats.targets} targets, ${stats.rec_yds} receiving yards, ${stats.rec_td} receiving TDs`;
  const teamInfo = `(${stats.gp} games, ${stats.tm})`;
  return `${rushStats}, ${recStats} ${teamInfo}`;
}

function formatWRStatsForHuman(stats: any): string {
  return `${stats.name} - 2024 season: ${stats.rec} receptions, ${stats.rec_yds} receiving yards, ${stats.rec_td} TDs (${stats.gp} games, ${stats.tm})`;
}

function formatTEStatsForHuman(stats: any): string {
  return `${stats.name} - 2024 season: ${stats.rec} receptions, ${stats.rec_yds} receiving yards, ${stats.rec_td} TDs (${stats.gp} games, ${stats.tm})`;
}

async function loadAllData() {
  console.log('🏈 Starting 2024 Baseline Data Integration...\n');
  
  try {
    let totalInserted = 0;
    
    // Load player baseline stats (RB/WR/TE)
    console.log('📊 Loading Player Baseline Stats (RB/WR/TE)...');
    
    for (const chunk of rbWrTeData) {
      const stats = JSON.parse(chunk.content);
      const position = chunk.metadata.position;
      
      // Format based on position
      let humanReadable: string;
      if (position === 'RB') {
        humanReadable = formatRBStatsForHuman(stats);
      } else if (position === 'WR') {
        humanReadable = formatWRStatsForHuman(stats);
      } else if (position === 'TE') {
        humanReadable = formatTEStatsForHuman(stats);
      } else {
        console.warn(`⚠️  Unknown position: ${position}, skipping ${stats.name}`);
        continue;
      }
      
      console.log(`  Processing: ${stats.name} (${position})...`);
      
      // Generate embedding
      const embedding = await generateEmbedding(humanReadable);
      
      // Insert into database
      await db.insert(chunks).values({
        content: humanReadable,
        embedding,
        metadata: chunk.metadata
      });
      
      totalInserted++;
    }
    
    console.log(`\n✅ Successfully inserted ${totalInserted} player baseline chunks\n`);
    
    // Load historical pattern chunks
    console.log('📚 Loading Historical Pattern Chunks...');
    let patternCount = 0;
    
    for (const pattern of patternData) {
      console.log(`  Processing pattern: ${pattern.content.substring(0, 80)}...`);
      
      // Generate embedding
      const embedding = await generateEmbedding(pattern.content);
      
      // Insert into database with enhanced metadata
      await db.insert(chunks).values({
        content: pattern.content,
        embedding,
        metadata: {
          ...pattern.metadata,
          type: 'historical_pattern',
          source: 'grok_nflverse_analysis',
          seasons: '2017-2024',
          data_source: 'nflverse_aggregated'
        }
      });
      
      patternCount++;
    }
    
    console.log(`\n✅ Successfully inserted ${patternCount} historical pattern chunks\n`);
    
    // Load elite baseline summaries
    console.log('🏆 Loading Elite Baseline Summaries...');
    let summaryCount = 0;
    
    for (const summary of eliteBaselineSummaries) {
      console.log(`  Processing: ${summary.metadata.position} elite baseline...`);
      
      // Generate embedding
      const embedding = await generateEmbedding(summary.content);
      
      // Insert into database
      await db.insert(chunks).values({
        content: summary.content,
        embedding,
        metadata: summary.metadata
      });
      
      summaryCount++;
    }
    
    console.log(`\n✅ Successfully inserted ${summaryCount} elite baseline summary chunks\n`);
    
    // Final summary
    console.log('═'.repeat(60));
    console.log('📊 2024 Baseline Data Integration Complete!');
    console.log(`  Player Stats (RB/WR/TE): ${totalInserted} chunks`);
    console.log(`  Historical Patterns: ${patternCount} chunks`);
    console.log(`  Elite Baselines: ${summaryCount} chunks`);
    console.log(`  Total New Chunks: ${totalInserted + patternCount + summaryCount}`);
    console.log(`  (Plus 10 QB chunks loaded earlier)`);
    console.log('═'.repeat(60));
    
  } catch (error) {
    console.error('❌ Loading failed with error:', error);
    throw error;
  }
}

// Run the loader
loadAllData()
  .then(() => {
    console.log('\n✅ All 2024 baseline data loaded successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Loader failed:', error);
    process.exit(1);
  });
