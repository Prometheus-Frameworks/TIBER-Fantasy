import fs from 'fs';
import path from 'path';

export interface RBProjection {
  player: string;
  team: string;
  adp: number;
  points: number;
  rush_yds: number;
  rec_yards: number;
  receptions: number;
  rush_tds: number;
  rec_tds: number;
}

// Load RB projections from JSON file
let rbProjectionsCache: RBProjection[] | null = null;

function loadRBProjections(): RBProjection[] {
  if (rbProjectionsCache) {
    return rbProjectionsCache;
  }

  try {
    const filePath = path.join(process.cwd(), 'server', 'data', 'rb_projections_2025.json');
    console.log(`🔍 Loading RB projections from: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    rbProjectionsCache = JSON.parse(fileContent) as RBProjection[];
    console.log(`📊 Loaded ${rbProjectionsCache.length} RB projections from static dataset`);
    return rbProjectionsCache;
  } catch (error) {
    console.error('❌ Error loading RB projections:', error);
    console.error('❌ File path attempted:', path.join(process.cwd(), 'server', 'data', 'rb_projections_2025.json'));
    return [];
  }
}

export function getAllRBProjections(): RBProjection[] {
  return loadRBProjections();
}

export function getRBProjectionByName(playerName: string): RBProjection | null {
  const projections = loadRBProjections();
  
  // Normalize player name for matching (handle different formats)
  const normalizedSearch = playerName.toLowerCase()
    .replace(/[.\s]/g, '')  // Remove dots and spaces
    .replace(/'/g, '');     // Remove apostrophes
  
  const player = projections.find(p => {
    const normalizedPlayer = p.player.toLowerCase()
      .replace(/[.\s]/g, '')
      .replace(/'/g, '');
    return normalizedPlayer === normalizedSearch;
  });
  
  if (player) {
    console.log(`🎯 Found RB projection: ${player.player} - ${player.points} pts`);
  } else {
    console.log(`❌ RB projection not found: ${playerName}`);
  }
  
  return player || null;
}

// Convert RB projection to standard PlayerProjection format
export function convertToPlayerProjection(rbProj: RBProjection) {
  return {
    player_name: rbProj.player,
    position: 'RB',
    team: rbProj.team,
    projected_fpts: rbProj.points,
    receptions: rbProj.receptions,
    birthdate: null // Not available in RB dataset
  };
}