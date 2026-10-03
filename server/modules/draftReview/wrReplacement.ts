import { z } from 'zod';
import { sleeperClient } from '../../integrations/sleeperClient';
import { getDraftReviewPlayerDirectory, parseSleeperRosterUrl, DraftReviewInputError } from './draftReviewService';
import { wrReplacementSchema } from '../../../shared/wrReplacement';
const id = z.string().regex(/^(?:\d{1,24}|[A-Z]{2,3})$/);
const members = z.array(id).max(256);
const rosterSchema = z.object({ roster_id: z.number().int().positive(), league_id: z.string().optional(), players: members, starters: z.array(z.union([id, z.literal('')])).max(64).nullish(), reserve: members.nullish(), taxi: members.nullish() });
const playerSchema = z.object({ player_id: z.string().nullish(), full_name: z.string().nullish(), first_name: z.string().nullish(), last_name: z.string().nullish(), position: z.string().nullish(), team: z.string().nullish(), status: z.string().nullish(), injury_status: z.string().nullish(), active: z.boolean().nullish() });
const display = (s: string | null | undefined) => s?.replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, '').trim().slice(0,120) || null;
export async function buildWrReplacement(raw: string, target: string) {
  const input = parseSleeperRosterUrl(raw);
  if (!/^\d{1,24}$/.test(target)) throw new DraftReviewInputError('An exact WR player ID is required.');
  const [leagueRaw, rostersRaw, directory] = await Promise.all([sleeperClient.getLeague(input.leagueId), sleeperClient.getLeagueRosters(input.leagueId), getDraftReviewPlayerDirectory()]);
  const league = z.object({ league_id: z.string(), season: z.string().regex(/^\d{4}$/), total_rosters: z.number().int().min(1).max(64) }).parse(leagueRaw);
  const rosters = z.array(rosterSchema).max(64).parse(rostersRaw);
  if (league.league_id !== input.leagueId || rosters.length !== league.total_rosters || new Set(rosters.map(r => r.roster_id)).size !== rosters.length || rosters.some(r => r.league_id !== undefined && r.league_id !== input.leagueId)) throw new Error('Incomplete league membership');
  const own = rosters.find(r => r.roster_id === input.rosterId);
  if (!own || !own.players.includes(target) || !own.starters?.includes(target)) throw new Error('Target no longer in starting roster');
  const union = (r: typeof own) => Array.from(new Set([...r.players, ...(r.starters ?? []), ...(r.reserve ?? []), ...(r.taxi ?? [])].filter(p => p !== '0' && p !== '')));
  const ownIds = union(own);
  const allIds = rosters.flatMap(union);
  if (new Set(allIds).size !== allIds.length) throw new Error('Conflicting league membership');
  const rostered = new Set(allIds);
  const excluded = new Set([...(own.starters ?? []), ...(own.reserve ?? []), ...(own.taxi ?? [])]);
  if (!directory.players || typeof directory.players !== 'object' || Array.isArray(directory.players)) throw new Error('Directory unavailable');
  const entries = Object.entries(directory.players);
  if (!entries.length || entries.length > 50000) throw new Error('Directory size unsupported');
  const players = entries.map(([key, raw]) => {
    const p = playerSchema.parse(raw);
    if (p.position !== 'WR') return null;
    if (!/^\d{1,24}$/.test(key) || (p.player_id != null && p.player_id !== key)) throw new Error('WR identity conflict');
    return { player_id: key, name: display(p.full_name) ?? display([p.first_name,p.last_name].filter(Boolean).join(' ')) ?? `Sleeper player ${key}`, position: 'WR' as const, team: display(p.team), status: display(p.status), injury_status: display(p.injury_status), active: p.active ?? null };
  }).filter((p): p is NonNullable<typeof p> => p !== null);
  const subject = players.find(p => p.player_id === target);
  if (!subject) throw new Error('WR target missing');
  const sorted = players.sort((a,b) => a.name.localeCompare(b.name,'en') || a.player_id.localeCompare(b.player_id));
  const base = `https://api.sleeper.app/v1/league/${input.leagueId}`;
  const result = wrReplacementSchema.parse({ schema_version: 'tiber_wr_replacement_v1', input: {...input, target_player_id:target}, season:league.season, target:subject, roster_player_ids:ownIds,
    bench:sorted.filter(p=> own.players.includes(p.player_id) && !excluded.has(p.player_id)), unrostered:sorted.filter(p=>!rostered.has(p.player_id)),
    observations:{received_at:new Date().toISOString(),directory_fetched_at:new Date(directory.fetchedAt).toISOString(),source_urls:[base,`${base}/rosters`,'https://api.sleeper.app/v1/players/nfl'],directory_cache_max_age_hours:24},forecast:{status:'unavailable',fabricated_values:false},claim_eligibility:'unknown',lineup_locks:'unknown' });
  if (Buffer.byteLength(JSON.stringify(result),'utf8')>750000) throw new Error('Response too large');
  return result;
}
