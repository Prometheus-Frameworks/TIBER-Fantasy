#!/usr/bin/env tsx
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

interface PlayerEntry {
  id: string;
  name: string;
  team: string;
  pos: string;
  aliases: string[];
}

interface PlayerIndex {
  [id: string]: {
    name: string;
    team: string;
    pos: string;
  };
}

// Common nickname mappings
const NICKNAMES: Record<string, string[]> = {
  'Ja\'Marr Chase': ['chase', 'jamarr', 'jamar'],
  'Justin Jefferson': ['jefferson', 'jj', 'griddy'],
  'CeeDee Lamb': ['lamb', 'ceedee', 'cd'],
  'Amon-Ra St. Brown': ['arsb', 'st-brown', 'amon-ra'],
  'A.J. Brown': ['aj', 'brown'],
  'Marvin Harrison Jr.': ['mhj', 'harrison', 'marvin'],
  'DeAndre Hopkins': ['nuk', 'hopkins', 'deandre'],
  'Jaxon Smith-Njigba': ['jsn', 'smith-njigba'],
  'Tyreek Hill': ['cheetah', 'hill', 'tyreek'],
  'Cooper Kupp': ['kupp', 'cooper'],
  'Mike Evans': ['evans', 'mike'],
  'Stefon Diggs': ['diggs', 'stefon'],
  'Tee Higgins': ['higgins', 'tee'],
  'DJ Moore': ['moore', 'dj'],
  'Jaylen Waddle': ['waddle', 'jaylen'],
  'Calvin Ridley': ['ridley', 'calvin'],
  'Terry McLaurin': ['mclaurin', 'terry', 'scary terry'],
  'Michael Pittman Jr.': ['pittman', 'michael'],
  'Brandon Aiyuk': ['aiyuk', 'brandon'],
  'Jerry Jeudy': ['jeudy', 'jerry'],
  'Rome Odunze': ['odunze', 'rome'],
  'Ladd McConkey': ['mcconkey', 'ladd'],
  'Xavier Worthy': ['worthy', 'xavier'],
  'Jordan Addison': ['addison', 'jordan'],
  'Zay Flowers': ['flowers', 'zay'],
  'Tank Dell': ['dell', 'tank'],
  'Christian Watson': ['watson', 'christian']
};

function generateId(name: string): string {
  return name
    .toLowerCase()
    .normalize()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateAliases(name: string, team: string): string[] {
  const aliases: string[] = [];
  
  // Add custom nicknames if available
  if (NICKNAMES[name]) {
    aliases.push(...NICKNAMES[name]);
  }
  
  // Split name into parts
  const nameParts = name.toLowerCase().split(/\s+/);
  aliases.push(...nameParts);
  
  // Add team variations
  aliases.push(team.toLowerCase());
  
  // Team city/name mappings
  const teamMappings: Record<string, string[]> = {
    'CIN': ['cincinnati', 'bengals'],
    'MIN': ['minnesota', 'vikings'],
    'DAL': ['dallas', 'cowboys'],
    'NYG': ['giants', 'new-york'],
    'DET': ['detroit', 'lions'],
    'LAR': ['rams', 'los-angeles'],
    'PHI': ['philadelphia', 'eagles'],
    'NYJ': ['jets', 'new-york'],
    'ARI': ['arizona', 'cardinals'],
    'HOU': ['houston', 'texans'],
    'LV': ['raiders', 'las-vegas'],
    'MIA': ['miami', 'dolphins'],
    'SEA': ['seattle', 'seahawks'],
    'NO': ['saints', 'new-orleans'],
    'TB': ['tampa', 'buccaneers'],
    'CHI': ['chicago', 'bears'],
    'TEN': ['titans', 'tennessee'],
    'BUF': ['buffalo', 'bills'],
    'WAS': ['washington', 'commanders'],
    'CAR': ['carolina', 'panthers'],
    'IND': ['indianapolis', 'colts'],
    'SF': ['49ers', 'san-francisco'],
    'DEN': ['denver', 'broncos'],
    'CLE': ['cleveland', 'browns'],
    'LAC': ['chargers', 'los-angeles'],
    'KC': ['chiefs', 'kansas-city'],
    'BAL': ['baltimore', 'ravens'],
    'JAX': ['jacksonville', 'jaguars'],
    'ATL': ['atlanta', 'falcons'],
    'GB': ['packers', 'green-bay']
  };
  
  if (teamMappings[team]) {
    aliases.push(...teamMappings[team]);
  }
  
  // Remove duplicates and empty strings
  return [...new Set(aliases.filter(a => a && a.length > 0))];
}

async function fetchFromEndpoint(endpoint: string, label: string): Promise<PlayerEntry[]> {
  try {
    console.log(`🔍 Fetching ${label} from ${endpoint}`);
    const response = await axios.get(`http://localhost:5000${endpoint}`, {
      timeout: 10000
    });
    
    const data = response.data;
    const players: PlayerEntry[] = [];
    
    // Handle different response structures
    let rawPlayers: any[] = [];
    if (data.players) rawPlayers = data.players;
    else if (data.data) rawPlayers = Array.isArray(data.data) ? data.data : [data.data];
    else if (data.rookies) rawPlayers = data.rookies;
    else if (Array.isArray(data)) rawPlayers = data;
    
    console.log(`📊 Raw players from ${label}: ${rawPlayers.length}`);
    
    for (const player of rawPlayers) {
      const name = player.player_name || player.name || '';
      const team = player.team || '';
      const pos = player.position || player.pos || 'WR';
      
      if (name && team) {
        const id = generateId(name);
        const aliases = generateAliases(name, team);
        
        players.push({
          id,
          name,
          team: team.toUpperCase(),
          pos: pos.toUpperCase(),
          aliases
        });
      }
    }
    
    console.log(`✅ Processed ${players.length} valid players from ${label}`);
    return players;
    
  } catch (error) {
    console.warn(`⚠️  Failed to fetch ${label}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

async function buildPlayerPool(): Promise<void> {
  console.log('🏗️  Building canonical player pool from real endpoints...');
  
  const allPlayers: PlayerEntry[] = [];
  const seenIds = new Set<string>();
  
  // Define endpoints to aggregate
  const endpoints = [
    { url: '/api/redraft/rankings?pos=WR&season=2025&limit=100', label: 'Redraft Rankings' },
    { url: '/api/dynasty/rankings?pos=WR&season=2025&limit=100', label: 'Dynasty Rankings' },
    { url: '/api/rankings?position=WR&limit=100', label: 'VORP Rankings' },
    { url: '/api/wr?limit=100', label: 'WR CSV Data' },
    { url: '/api/rookies', label: 'Rookie Evaluations' },
    { url: '/api/usage-leaders?limit=50', label: 'Usage Leaders' },
    { url: '/api/compass/wr', label: 'WR Compass' }
  ];
  
  // Fetch from all endpoints
  for (const endpoint of endpoints) {
    const players = await fetchFromEndpoint(endpoint.url, endpoint.label);
    
    for (const player of players) {
      if (!seenIds.has(player.id)) {
        seenIds.add(player.id);
        allPlayers.push(player);
      }
    }
  }
  
  // Sort by position, then by name
  allPlayers.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos.localeCompare(b.pos);
    return a.name.localeCompare(b.name);
  });
  
  // Build index for fast lookups
  const playerIndex: PlayerIndex = {};
  for (const player of allPlayers) {
    playerIndex[player.id] = {
      name: player.name,
      team: player.team,
      pos: player.pos
    };
  }
  
  // Count by position
  const positionCounts: Record<string, number> = {};
  for (const player of allPlayers) {
    positionCounts[player.pos] = (positionCounts[player.pos] || 0) + 1;
  }
  
  // Write files to workspace data directory  
  const dataDir = join(process.cwd(), 'data');
  const poolPath = join(dataDir, 'player_pool.json');
  const indexPath = join(dataDir, 'player_index.json');
  
  writeFileSync(poolPath, JSON.stringify(allPlayers, null, 2));
  writeFileSync(indexPath, JSON.stringify(playerIndex, null, 2));
  
  console.log('\n✅ Player pool built successfully!');
  console.log(`📂 Wrote ${allPlayers.length} players to player_pool.json`);
  console.log(`🗂️  Wrote ${Object.keys(playerIndex).length} entries to player_index.json`);
  
  console.log('\n📊 Position breakdown:');
  Object.entries(positionCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([pos, count]) => {
      console.log(`  ${pos}: ${count} players`);
    });
  
  console.log('\n🎯 Sample entries:');
  allPlayers.slice(0, 5).forEach(p => {
    console.log(`  ${p.id} → ${p.name} (${p.team}, ${p.pos}) [${p.aliases.slice(0,3).join(', ')}...]`);
  });
}

// Run if called directly (ESM compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  buildPlayerPool().catch(console.error);
}

export { buildPlayerPool };