import type { WatsonReadModel } from '../../../../server/modules/draftReview/playerStateCardEvidence';

export type CardModel = WatsonReadModel;

export const TEAM_FIELD_LABELS: ReadonlyArray<[string, string]> = [
  ['attempts', 'Pass attempts'], ['completions', 'Completions'],
  ['passing_yards', 'Passing yards'], ['passing_tds', 'Passing TDs'],
  ['passing_interceptions', 'Interceptions thrown'], ['sacks_suffered', 'Sacks suffered'],
  ['carries', 'Team carries'], ['rushing_yards', 'Rushing yards'],
  ['rushing_tds', 'Rushing TDs'], ['fumbles_lost_total', 'Total lost fumbles'],
];

// Presentation formatting only. The producer-owned raw values and deltas are untouched.
export function displayCount(value: number | null): string {
  return value === null ? 'Unavailable' : String(value);
}
export function displayDelta(value: number | null): string {
  return value === null ? 'Unavailable' : value > 0 ? `+${value}` : String(value);
}
export function displayPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
export function displayPoints(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} pp`;
}
