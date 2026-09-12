import { z } from 'zod';
import { sleeperClient } from '../../integrations/sleeperClient';
import { DraftReviewInputError, getDraftReviewPlayerDirectory, parseSleeperRosterUrl } from './draftReviewService';
import { matchupSchema, type TeamMatchup } from '../../../shared/draftReviewMatchup';
const id = z.string().regex(/^(?:\d{1,24}|[A-Z]{2,3})$/);
const score = z.number().finite().min(-1000000).max(1000000);
const rowsSchema = z.array(z.object({ roster_id: z.number().int().positive(), matchup_id: z.number().int().nullable(), points: score, custom_points: score.nullish(), players: z.array(id).max(256), starters: z.array(id).max(32), players_points: z.record(id, score).optional() })).max(64);
const label = (value: unknown, fallback = '') => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120) : fallback;
export async function buildWeeklyMatchup(raw: string, season: string, week: number): Promise<TeamMatchup> {
  const input = parseSleeperRosterUrl(raw);
  if (!/^\d{4}$/.test(season) || !Number.isInteger(week) || week < 1 || week > 18) throw new DraftReviewInputError('A season and week from 1 to 18 are required.');
  const [league, rosterRaw, usersRaw, matchups, directory] = await Promise.all([
    sleeperClient.getLeague(input.leagueId), sleeperClient.getLeagueRosters(input.leagueId), sleeperClient.getLeagueUsers(input.leagueId), sleeperClient.getLeagueMatchups(input.leagueId, week), getDraftReviewPlayerDirectory(),
  ]);
  const rosters = z.array(z.object({ roster_id: z.number().int().positive(), owner_id: z.string().nullable() })).max(64).parse(rosterRaw);
  const users = z.array(z.object({ user_id: z.string(), display_name: z.string().nullish(), metadata: z.object({ team_name: z.string().nullish() }).passthrough().nullish() })).max(128).parse(usersRaw);
  const rows = rowsSchema.parse(matchups);
  const total = league.total_rosters;
  if (league.league_id !== input.leagueId || league.season !== season || !Number.isInteger(total) || total! < 2 || total! > 64 || rosters.length !== total || rows.length !== total
    || new Set(rosters.map(r => r.roster_id)).size !== total || new Set(rows.map(r => r.roster_id)).size !== total || rows.some(r => !rosters.some(x => x.roster_id === r.roster_id))) throw new Error('Incomplete scope');
  if (league.settings?.best_ball === 1) throw new Error('Unsupported best ball');
  const own = rows.find(r => r.roster_id === input.rosterId);
  const pair = own && own.matchup_id !== null ? rows.filter(r => r.matchup_id === own.matchup_id) : [];
  if (!own || pair.length !== 2) throw new Error('No ordinary head-to-head matchup');
  const other = pair.find(r => r.roster_id !== own.roster_id)!;
  const slots = z.array(z.string().max(32)).max(64).parse(league.roster_positions).filter(s => !['BN', 'IR', 'TAXI'].includes(s));
  if (!slots.length || slots.length > 32 || !directory.players || typeof directory.players !== 'object' || Array.isArray(directory.players)) throw new Error('Missing roster configuration');
  function side(row: typeof own & {}) {
    const nonempty = row.starters.filter(p => p !== '0');
    if (row.starters.length !== slots.length || new Set(nonempty).size !== nonempty.length || nonempty.some(p => !row.players.includes(p))) throw new Error('Invalid weekly starters');
    const owner = rosters.find(r => r.roster_id === row.roster_id)?.owner_id;
    const user = users.find(u => u.user_id === owner);
    return { roster_id: row.roster_id, name: label(user?.metadata?.team_name || user?.display_name, `Roster ${row.roster_id}`), points: row.custom_points ?? row.points, custom_points: row.custom_points ?? null,
      starters: row.starters.map((playerId, index) => {
        const p = directory.players[playerId];
        return { slot: slots[index], player_id: playerId === '0' ? null : playerId, name: playerId === '0' ? 'Empty slot' : label(p?.full_name || [p?.first_name, p?.last_name].filter(Boolean).join(' '), playerId) || playerId,
          position: label(p?.position) || null, team: label(p?.team) || null, status: label(p?.status) || null, injury_status: label(p?.injury_status) || null, points: playerId === '0' ? null : row.players_points?.[playerId] ?? null };
      }) };
  }
  const you = side(own), opponent = side(other);
  const shared: TeamMatchup['derived']['shared_offense'] = [];
  // Current directory affiliations cannot establish a historical week's relationships.
  if (league.settings?.leg === week) for (const a of you.starters) for (const b of opponent.starters) {
    if (a.team && /^[A-Z]{2,3}$/.test(a.team) && a.team === b.team && ((a.position === 'QB' && ['WR', 'TE'].includes(b.position ?? '')) || (b.position === 'QB' && ['WR', 'TE'].includes(a.position ?? '')))) shared.push({ team: a.team, your_player: a.name, opponent_player: b.name });
  }
  const base = `https://api.sleeper.app/v1/league/${input.leagueId}`;
  return matchupSchema.parse({ schema_version: 'tiber_team_matchup_v1', input, season, week, observed: { you, opponent }, derived: { score_margin: Math.round((you.points - opponent.points) * 100) / 100, shared_offense: shared },
    unavailable: ['Game timing and final/live status', 'Players remaining and lineup locks', 'Win probability and projections', 'Current role and verified playing eligibility'],
    provenance: { received_at: new Date().toISOString(), directory_fetched_at: new Date(directory.fetchedAt).toISOString(), source_urls: [base, `${base}/rosters`, `${base}/users`, `${base}/matchups/${week}`, 'https://api.sleeper.app/v1/players/nfl'],
      disclosures: ['Public Sleeper observations; scores may be corrected. Custom team score overrides are honored; player points may not sum to the team score.', 'Reads are not an atomic snapshot. Receipt time is completion of these reads, not a provider update time.', 'Player directory may be cached for 24 hours. Team affiliations and status are directory observations, not historical affiliations or clearance to play.', 'Zero points do not establish whether a player has played. Shared QB/receiver offense is a deterministic relationship, not a forecast or quantified correlation.', 'Shared offense relationships are shown only when the selected week equals the league leg. Historical statistics and forecasts are not included.'] } });
}
