/**
 * Name Fingerprint Utility
 * 
 * Generates normalized "fingerprints" for player names to enable
 * accurate duplicate detection across data sources.
 * 
 * NORMALIZATION RULES (v0.2):
 * 1. Convert to lowercase
 * 2. Remove apostrophes: "Ja'Marr" -> "jamarr"
 * 3. Remove hyphens: "Smith-Schuster" -> "smithschuster"
 * 4. Remove periods: "T.J." -> "tj"
 * 5. Remove suffixes: Jr, Sr, II, III, IV, V
 * 6. Collapse whitespace to single space
 * 7. Trim leading/trailing whitespace
 * 
 * EXAMPLES:
 * - "Ja'Marr Chase Jr." -> "jamarr chase"
 * - "JaMarr Chase" -> "jamarr chase"
 * - "T.J. Watt" -> "tj watt"
 * - "Odell Beckham Jr." -> "odell beckham"
 * - "Henry Ruggs III" -> "henry ruggs"
 * - "DeVonta Smith" -> "devonta smith"
 * - "D.K. Metcalf" -> "dk metcalf"
 */

const SUFFIX_PATTERN = /\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i;
const PUNCTUATION_PATTERN = /['\-\.]/g;
const WHITESPACE_PATTERN = /\s+/g;

/**
 * Generate a normalized name fingerprint for duplicate matching.
 * 
 * @param fullName - The player's full name from any data source
 * @returns Normalized fingerprint string for comparison
 * 
 * @example
 * generateNameFingerprint("Ja'Marr Chase Jr.") // "jamarr chase"
 * generateNameFingerprint("JaMarr Chase")      // "jamarr chase"
 */
export function generateNameFingerprint(fullName: string | null | undefined): string {
  if (!fullName) return '';
  
  return fullName
    .toLowerCase()
    .replace(SUFFIX_PATTERN, '')       // Remove Jr, Sr, II, III, IV, V
    .replace(PUNCTUATION_PATTERN, '')  // Remove apostrophes, hyphens, periods
    .replace(WHITESPACE_PATTERN, ' ')  // Collapse whitespace
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching when exact fingerprint match fails.
 * 
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance (lower = more similar)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate fuzzy match similarity between two names.
 * 
 * @param name1 - First name (will be fingerprinted)
 * @param name2 - Second name (will be fingerprinted)
 * @returns Similarity score 0.0-1.0 (1.0 = exact match)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const fp1 = generateNameFingerprint(name1);
  const fp2 = generateNameFingerprint(name2);
  
  if (fp1 === fp2) return 1.0;
  if (!fp1 || !fp2) return 0.0;
  
  const distance = levenshteinDistance(fp1, fp2);
  const maxLength = Math.max(fp1.length, fp2.length);
  const similarity = 1 - (distance / maxLength);
  
  return Math.max(0, similarity);
}

/**
 * Match confidence thresholds for identity consolidation.
 * These values determine when to auto-merge vs flag for review.
 */
export const MATCH_THRESHOLDS = {
  AUTO_MERGE: 0.92,      // 92%+ similarity = auto-merge
  REVIEW_MIN: 0.80,      // 80-92% = flag for manual review
  SKIP: 0.80,            // <80% = skip (too risky)
} as const;

/**
 * Determine match action based on similarity score.
 * 
 * @param similarity - Similarity score from calculateNameSimilarity
 * @returns 'auto_merge' | 'review' | 'skip'
 */
export function getMatchAction(similarity: number): 'auto_merge' | 'review' | 'skip' {
  if (similarity >= MATCH_THRESHOLDS.AUTO_MERGE) return 'auto_merge';
  if (similarity >= MATCH_THRESHOLDS.REVIEW_MIN) return 'review';
  return 'skip';
}

/**
 * Check if two team arrays have any overlap.
 * Used for mid-season trade handling.
 * 
 * @param teams1 - First team history array
 * @param teams2 - Second team history array
 * @returns true if any team appears in both arrays
 */
export function hasTeamOverlap(
  teams1: string[] | null | undefined,
  teams2: string[] | null | undefined
): boolean {
  if (!teams1 || !teams2 || teams1.length === 0 || teams2.length === 0) {
    return false;
  }
  
  const set1 = new Set(teams1.map(t => t.toUpperCase()));
  return teams2.some(t => set1.has(t.toUpperCase()));
}

/**
 * Calculate data completeness score for merge direction.
 * Higher score = more complete data = should be survivor.
 * 
 * @param player - Player identity map record
 * @returns Completeness score (higher = more complete)
 */
export function calculateDataCompleteness(player: {
  sleeperId?: string | null;
  espnId?: string | null;
  yahooId?: string | null;
  rotowireId?: string | null;
  fantasyDataId?: string | null;
  fantasyprosId?: string | null;
  mysportsfeedsId?: string | null;
  nflDataPyId?: string | null;
}): number {
  let score = 0;
  
  // Count non-null external IDs (1 point each)
  if (player.sleeperId) score++;
  if (player.espnId) score++;
  if (player.yahooId) score++;
  if (player.rotowireId) score++;
  if (player.fantasyDataId) score++;
  if (player.fantasyprosId) score++;
  if (player.mysportsfeedsId) score++;
  if (player.nflDataPyId) score++;
  
  return score;
}
