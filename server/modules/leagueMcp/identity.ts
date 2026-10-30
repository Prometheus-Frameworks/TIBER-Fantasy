import { directoryEntry } from '../draftReview/leagueAvailability';

export const SKILL_POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;
export const normalizedName = (name: string) => name.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Exact directory resolution shared by the personal tools: an all-digit query must equal the Sleeper ID;
 * any other query must equal the normalized full name. No fuzzy, partial or cross-provider matching.
 * Callers require exactly one match; more than one is ambiguous, none is not found.
 */
export function matchDirectoryEntries(entries: Array<[string, unknown]>, query: string): Array<[string, unknown]> {
  return entries.filter(([id, raw]) => {
    const p = directoryEntry.safeParse(raw);
    if (!p.success || (p.data.player_id != null && p.data.player_id !== id)) return false;
    const name = p.data.full_name ?? [p.data.first_name, p.data.last_name].filter(Boolean).join(' ');
    return /^\d+$/.test(query) ? query === id : normalizedName(name) === normalizedName(query);
  });
}
