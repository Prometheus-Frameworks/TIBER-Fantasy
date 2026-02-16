export const MIN_TOTAL_PLAYS = 50;
export const MEANINGFUL_BUCKET_PCT = 0.10;
export const ELEVEN_ONLY_THRESHOLD = 0.80;
export const HEAVY_THRESHOLD = 0.50;

export type PersonnelEveryDownGrade =
  | 'FULL_TIME'
  | '11_ONLY'
  | 'HEAVY_ONLY'
  | 'ROTATIONAL'
  | 'LOW_SAMPLE';

export interface ClassificationInput {
  totalPlaysCounted: number;
  elevenPct: number;
  twelvePct: number;
  thirteenPct: number;
  minTotalPlays?: number;
}

export function classifyPersonnelDependency(input: ClassificationInput): PersonnelEveryDownGrade {
  const minTotalPlays = input.minTotalPlays ?? MIN_TOTAL_PLAYS;
  const heavyPct = input.twelvePct + input.thirteenPct;

  if (input.totalPlaysCounted < minTotalPlays) {
    return 'LOW_SAMPLE';
  }

  if (input.elevenPct >= MEANINGFUL_BUCKET_PCT && heavyPct >= MEANINGFUL_BUCKET_PCT) {
    return 'FULL_TIME';
  }

  if (input.elevenPct >= ELEVEN_ONLY_THRESHOLD && heavyPct < MEANINGFUL_BUCKET_PCT) {
    return '11_ONLY';
  }

  if (heavyPct >= HEAVY_THRESHOLD && input.elevenPct < 0.30) {
    return 'HEAVY_ONLY';
  }

  return 'ROTATIONAL';
}
