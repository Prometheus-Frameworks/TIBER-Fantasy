export type PlayerRef = { id?: string; first?: string; last?: string; full?: string; team?: string };

const ALIASES: Record<string,string> = {
  'hollywood brown': 'marquise brown',
  'jj mccarthy': 'j.j. mccarthy',
  'kene nwangwu': 'kene ndugu nwangwu',
};

const norm = (s?: string) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function resolvePlayer(
  query: PlayerRef,
  pool: Array<{player_id?: string; first_name?: string; last_name?: string; full_name?: string; team?: string}>
) {
  const alias = ALIASES[norm(query.full)];
  const baseFull = query.full ?? `${query.first ?? ''} ${query.last ?? ''}`.trim();
  const qFull = norm(alias ?? baseFull);
  if (!qFull) return null;

  let match = pool.find(p => norm(p.full_name) === qFull);
  if (match) return match;

  const [qFirst, qLast] = qFull.split(' ');
  match = pool.find(p => norm(p.first_name) === qFirst && norm(p.last_name) === qLast);
  if (match) return match;

  const candidates = pool.filter(p => norm(p.last_name) === qLast || norm(p.full_name).includes(qLast));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1 && query.team) {
    const t = norm(query.team);
    const tMatch = candidates.find(p => norm(p.team) === t);
    if (tMatch) return tMatch;
  }
  return null;
}