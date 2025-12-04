/**
 * Player Name Detector v1.0
 * 
 * Extracts player names from user messages and resolves to canonical IDs.
 * Uses Fuse.js for fuzzy matching to handle variations like:
 * - "Rashee Rice" vs "rashee rice"
 * - "Ja'Marr Chase" vs "Jamarr Chase"
 * - "CeeDee Lamb" vs "CD Lamb"
 */

import { db } from '../infra/db';
import { playerIdentityMap } from '@shared/schema';
import { inArray, isNotNull, eq, and } from 'drizzle-orm';
import Fuse from 'fuse.js';

interface PlayerMatch {
  canonicalId: string;
  fullName: string;
  position: string;
  team: string | null;
  score: number; // 0 = perfect match, higher = worse
}

interface DetectionResult {
  players: PlayerMatch[];
  primaryPlayer: PlayerMatch | null; // Best match if any
}

// Player cache item type
interface PlayerCacheItem {
  canonicalId: string;
  fullName: string;
  nameFingerprint: string | null;
  position: string;
  team: string | null;
}

// Cache player list to avoid repeated DB queries
let playerCache: PlayerCacheItem[] | null = null;
let fuseIndex: Fuse<PlayerCacheItem> | null = null;
let cacheExpiry: number = 0;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load and cache player names for detection
 */
async function loadPlayerCache(): Promise<void> {
  const now = Date.now();
  
  if (playerCache && fuseIndex && now < cacheExpiry) {
    return; // Cache still valid
  }
  
  console.log('[PlayerDetector] Loading player cache...');
  
  const players = await db
    .select({
      canonicalId: playerIdentityMap.canonicalId,
      fullName: playerIdentityMap.fullName,
      nameFingerprint: playerIdentityMap.nameFingerprint,
      position: playerIdentityMap.position,
      team: playerIdentityMap.nflTeam,
    })
    .from(playerIdentityMap)
    .where(
      and(
        inArray(playerIdentityMap.position, ['QB', 'RB', 'WR', 'TE']),
        eq(playerIdentityMap.isActive, true)
      )
    );
  
  playerCache = players;
  cacheExpiry = now + CACHE_TTL_MS;
  
  // Build Fuse index for fuzzy matching
  fuseIndex = new Fuse(players, {
    keys: [
      { name: 'fullName', weight: 1.0 },
      { name: 'nameFingerprint', weight: 0.8 },
    ],
    threshold: 0.3, // 0 = exact, 1 = match anything
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 3,
  });
  
  console.log(`[PlayerDetector] Cached ${players.length} skill position players`);
}

/**
 * Normalize text for matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '') // Remove apostrophes: Ja'Marr -> JaMarr
    .replace(/[^a-z0-9\s]/g, '') // Remove non-alphanumeric
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract potential player name candidates from message
 * Looks for sequences of 2-4 capitalized words or known patterns
 */
function extractNameCandidates(message: string): string[] {
  const candidates: string[] = [];
  
  // Pattern 1: Two or more capitalized consecutive words
  const capitalPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z']+)+)\b/g;
  let match;
  while ((match = capitalPattern.exec(message)) !== null) {
    candidates.push(match[1]);
  }
  
  // Pattern 2: Common fantasy phrases like "about [name]", "on [name]"
  const phrasePatterns = [
    /(?:about|on|for|regarding|analyze|tell me about|what about)\s+([A-Za-z']+\s+[A-Za-z']+)/gi,
    /([A-Za-z']+\s+[A-Za-z']+)(?:'s|\s+is|\s+has|\s+looks|\s+trending)/gi,
  ];
  
  for (const pattern of phrasePatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(message)) !== null) {
      candidates.push(match[1]);
    }
  }
  
  // Pattern 3: Just try the whole normalized message as a search
  // (for queries like "rashee rice" without capitalization)
  if (candidates.length === 0) {
    const words = message.split(/\s+/).filter(w => w.length >= 3);
    for (let i = 0; i < words.length - 1; i++) {
      candidates.push(`${words[i]} ${words[i + 1]}`);
      if (i < words.length - 2) {
        candidates.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }
  }
  
  return Array.from(new Set(candidates)); // Dedupe
}

/**
 * Detect player names in a message and return canonical IDs
 */
export async function detectPlayers(message: string): Promise<DetectionResult> {
  await loadPlayerCache();
  
  if (!fuseIndex || !playerCache) {
    return { players: [], primaryPlayer: null };
  }
  
  const candidates = extractNameCandidates(message);
  const allMatches: PlayerMatch[] = [];
  const seenIds = new Set<string>();
  
  // Also try searching the normalized full message
  const normalizedMessage = normalizeText(message);
  
  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized.length < 4) continue; // Skip too-short candidates
    
    const results = fuseIndex.search(normalized, { limit: 3 });
    
    for (const result of results) {
      if (result.score !== undefined && result.score < 0.4) { // Good match
        const player = result.item;
        
        if (!seenIds.has(player.canonicalId)) {
          seenIds.add(player.canonicalId);
          allMatches.push({
            canonicalId: player.canonicalId,
            fullName: player.fullName,
            position: player.position,
            team: player.team,
            score: result.score,
          });
        }
      }
    }
  }
  
  // Sort by match quality (lower score = better)
  allMatches.sort((a, b) => a.score - b.score);
  
  return {
    players: allMatches,
    primaryPlayer: allMatches[0] ?? null,
  };
}

/**
 * Quick check if message likely contains a player name
 */
export async function containsPlayerName(message: string): Promise<boolean> {
  const result = await detectPlayers(message);
  return result.primaryPlayer !== null;
}

/**
 * Get the most likely player canonical ID from a message
 */
export async function getPrimaryPlayerId(message: string): Promise<string | null> {
  const result = await detectPlayers(message);
  return result.primaryPlayer?.canonicalId ?? null;
}

/**
 * Clear the cache (for testing or after bulk imports)
 */
export function clearPlayerCache(): void {
  playerCache = null;
  fuseIndex = null;
  cacheExpiry = 0;
  console.log('[PlayerDetector] Cache cleared');
}
