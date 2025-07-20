import axios from 'axios';
import * as cheerio from 'cheerio';
import Fuse from 'fuse.js';
import fs from 'fs';
import path from 'path';

interface PlayerProjection {
  player_name: string;
  position: string;
  team: string;
  projected_fpts: number;
  receptions?: number;
  birthdate?: string;
  // Advanced metrics for multipliers
  yprr?: number; // Yards per route run
  first_down_rr?: number; // 1D/RR
  cpoe?: number; // Completion % over expected
  oasis_score?: number; // OASIS team environment score
}

interface LeagueSettings {
  format: 'standard' | 'ppr' | 'half-ppr';
  num_teams: number;
  starters: { QB: number; RB: number; WR: number; TE: number; FLEX: number };
  is_superflex: boolean;
  is_te_premium: boolean;
  // Advanced multiplier weights
  oasis_weight?: number;
  yprr_weight?: number;
  first_down_weight?: number;
  cpoe_weight?: number;
}

// In-memory cache
const cache = { projections: null as PlayerProjection[] | null, lastFetch: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Fetch and aggregate projections
export async function fetchAggregatedProjections(): Promise<PlayerProjection[]> {
  if (cache.projections && Date.now() - cache.lastFetch < CACHE_TTL) {
    return cache.projections;
  }

  console.log('🔄 Fetching projections from external sources...');
  
  const sources = [
    { url: 'https://fantasy.espn.com/football/players/projections', parser: parseESPN },
    { url: 'https://www.draftsharks.com/rankings', parser: parseDraftSharks },
  ];

  let allProjections: { [key: string]: { fpts: number[]; pos: string; team: string; recs: number[]; birthdate?: string } } = {};

  for (const source of sources) {
    try {
      console.log(`📡 Fetching from ${source.url}...`);
      const { data } = await axios.get(source.url, { timeout: 5000 });
      const $ = cheerio.load(data);
      const projections = source.parser($);
      projections.forEach((p: PlayerProjection) => {
        const key = `${p.player_name.toLowerCase()}-${p.position.toLowerCase()}`;
        if (!allProjections[key]) {
          allProjections[key] = { fpts: [], pos: p.position, team: p.team, recs: [], birthdate: p.birthdate };
        }
        allProjections[key].fpts.push(p.projected_fpts);
        if (p.receptions) allProjections[key].recs.push(p.receptions);
      });
      console.log(`✅ Parsed ${projections.length} projections from ${source.url}`);
    } catch (error: any) {
      console.error(`❌ Fetch error from ${source.url}:`, error.message);
    }
  }

  if (Object.keys(allProjections).length === 0) {
    console.log('⚠️ No external data fetched, using fallback projections');
    return loadFallbackProjections();
  }

  const aggregated = Object.entries(allProjections).map(([key, val]) => {
    const [name, pos] = key.split('-');
    const avgFpts = val.fpts.reduce((sum, f) => sum + f, 0) / val.fpts.length || 0;
    const avgRecs = val.recs.reduce((sum, r) => sum + r, 0) / val.recs.length || 0;
    return { 
      player_name: name, 
      position: pos.toUpperCase(), 
      team: val.team, 
      projected_fpts: avgFpts, 
      receptions: avgRecs, 
      birthdate: val.birthdate 
    };
  });

  // Remove duplicates using fuzzy matching
  const fuse = new Fuse(aggregated, { keys: ['player_name', 'position'], threshold: 0.3 });
  const unique = aggregated.filter((p, i) => {
    const matches = fuse.search({ player_name: p.player_name, position: p.position }).filter(m => m.refIndex !== i);
    if (matches.length) {
      matches.forEach(m => {
        aggregated[m.refIndex].projected_fpts = (aggregated[m.refIndex].projected_fpts + p.projected_fpts) / 2;
      });
      return false;
    }
    return true;
  });

  cache.projections = unique;
  cache.lastFetch = Date.now();
  console.log(`✅ Cached ${unique.length} unique projections`);
  return unique;
}

// Parsers (simplified placeholders)
function parseESPN($: cheerio.Root): PlayerProjection[] {
  const projections: PlayerProjection[] = [];
  // ESPN parsing would go here - for now return empty to trigger fallback
  return projections;
}

function parseDraftSharks($: cheerio.Root): PlayerProjection[] {
  const projections: PlayerProjection[] = [];
  // DraftSharks parsing would go here - for now return empty to trigger fallback
  return projections;
}

// Fallback if fetch fails
export function loadFallbackProjections(): PlayerProjection[] {
  try {
    const projectionsPath = path.join(process.cwd(), 'projections.json');
    const data = fs.readFileSync(projectionsPath, 'utf8');
    const projections = JSON.parse(data);
    console.log(`📁 Loaded ${projections.length} fallback projections from projections.json`);
    return projections;
  } catch (error) {
    console.error('❌ Failed to load fallback projections:', error);
    return [];
  }
}

// Age calculation
function calculateAge(birthdateStr: string): number {
  const birthdate = new Date(birthdateStr);
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const m = today.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) {
    age--;
  }
  return age;
}

// Fallback age by position
function getFallbackAge(pos: string): number {
  const fallbacks: { [key: string]: number } = { 
    WR: 25, 
    RB: 24, 
    TE: 26, 
    QB: 28 
  };
  return fallbacks[pos] || 25;
}

// Age penalties by position
const agePenalties: { [key: string]: { [key: string]: number } } = {
  WR: { '27': 0.03, '28': 0.05, '29': 0.07, '30': 0.10, '31': 0.15, '32+': 0.20 },
  RB: { '26': 0.05, '27': 0.08, '28': 0.12, '29': 0.18, '30+': 0.25 },
  TE: { '29': 0.05, '30': 0.08, '31': 0.10, '32+': 0.15 },
  QB: { '35': 0.05, '37': 0.10, '40+': 0.15 }
};

// VORP calculation with tiers and mode
export async function calculateVORP(
  settings: LeagueSettings, 
  mode: string = 'redraft'
): Promise<{ vorpMap: { [key: string]: number }, tiers: any[], players: PlayerProjection[] }> {
  
  let projections = await fetchAggregatedProjections();
  if (!projections.length) {
    projections = loadFallbackProjections();
  }

  console.log(`🧮 Calculating VORP for ${projections.length} players in ${mode} mode`);

  // Dynasty mode applies age decay
  if (mode === 'dynasty') {
    projections = projections.map(p => {
      const age = p.birthdate ? calculateAge(p.birthdate) : getFallbackAge(p.position);
      if (!p.birthdate) {
        console.warn(`⚠️ Missing birthdate for ${p.player_name} - using fallback age ${age}`);
      }
      
      const penalties = agePenalties[p.position] || {};
      let penaltyPct = 0;
      
      for (const [ageKey, pct] of Object.entries(penalties)) {
        if (ageKey.endsWith('+') && age >= parseInt(ageKey.slice(0, -1))) {
          penaltyPct = pct;
        } else if (age === parseInt(ageKey)) {
          penaltyPct = pct;
        }
      }
      
      const originalFpts = p.projected_fpts;
      p.projected_fpts *= (1 - penaltyPct);
      
      if (penaltyPct > 0) {
        console.log(`🎂 Age penalty for ${p.player_name} (${age}): ${(penaltyPct * 100).toFixed(1)}% (${originalFpts.toFixed(1)} → ${p.projected_fpts.toFixed(1)})`);
      }
      
      return p;
    });
  }

  // Calculate replacement levels for each position
  const positionGroups: { [key: string]: PlayerProjection[] } = {
    QB: projections.filter(p => p.position === 'QB'),
    RB: projections.filter(p => p.position === 'RB'),
    WR: projections.filter(p => p.position === 'WR'),
    TE: projections.filter(p => p.position === 'TE')
  };

  // Sort each position by projected points
  Object.keys(positionGroups).forEach(pos => {
    positionGroups[pos].sort((a, b) => b.projected_fpts - a.projected_fpts);
  });

  // Calculate replacement levels
  const replacementLevels: { [key: string]: number } = {
    QB: getReplacementLevel(positionGroups.QB, settings.starters.QB * settings.num_teams + (settings.is_superflex ? settings.starters.QB * settings.num_teams : 0)),
    RB: getReplacementLevel(positionGroups.RB, (settings.starters.RB + Math.floor(settings.starters.FLEX * 0.4)) * settings.num_teams),
    WR: getReplacementLevel(positionGroups.WR, (settings.starters.WR + Math.floor(settings.starters.FLEX * 0.5)) * settings.num_teams),
    TE: getReplacementLevel(positionGroups.TE, settings.starters.TE * settings.num_teams)
  };

  console.log('📊 Replacement levels:', replacementLevels);

  // Calculate VORP for each player
  const vorpMap: { [key: string]: number } = {};
  
  projections.forEach(p => {
    const replacementLevel = replacementLevels[p.position] || 0;
    const vorp = Math.max(0, p.projected_fpts - replacementLevel);
    vorpMap[p.player_name] = parseFloat(vorp.toFixed(2));
  });

  // Generate tier breaks based on VORP drops
  const sortedPlayers = projections
    .sort((a, b) => vorpMap[b.player_name] - vorpMap[a.player_name])
    .filter(p => vorpMap[p.player_name] > 0); // Only include players above replacement

  const tiers = [];
  let currentTier = [sortedPlayers[0]];
  let tierNum = 1;

  for (let i = 1; i < sortedPlayers.length; i++) {
    const currentVorp = vorpMap[sortedPlayers[i-1].player_name];
    const nextVorp = vorpMap[sortedPlayers[i].player_name];
    const drop = currentVorp > 0 ? (currentVorp - nextVorp) / currentVorp : 0;
    
    if (drop > 0.15 && currentTier.length >= 2) { // Minimum 2 players per tier
      tiers.push({ 
        tier: tierNum++, 
        players: currentTier.map(p => ({ ...p, vorp: vorpMap[p.player_name] })),
        avgVorp: currentTier.reduce((sum, p) => sum + vorpMap[p.player_name], 0) / currentTier.length
      });
      currentTier = [sortedPlayers[i]];
    } else {
      currentTier.push(sortedPlayers[i]);
    }
  }
  
  if (currentTier.length) {
    tiers.push({ 
      tier: tierNum, 
      players: currentTier.map(p => ({ ...p, vorp: vorpMap[p.player_name] })),
      avgVorp: currentTier.reduce((sum, p) => sum + vorpMap[p.player_name], 0) / currentTier.length
    });
  }

  console.log(`🏆 Generated ${tiers.length} tiers`);

  return { vorpMap, tiers, players: projections };
}

function getReplacementLevel(players: PlayerProjection[], starterCount: number): number {
  if (players.length === 0) return 0;
  
  // Replacement level is the player around the starter threshold + bench depth
  const replacementIndex = Math.min(
    starterCount + Math.floor(starterCount * 0.5), 
    players.length - 1
  );
  
  return players[replacementIndex]?.projected_fpts || 0;
}

// Clear cache function for testing
export function clearProjectionsCache(): void {
  cache.projections = null;
  cache.lastFetch = 0;
  console.log('🗑️ Projections cache cleared');
}