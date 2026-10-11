import { deriveWaiverSettings, waiverCandidatesSchema, type WaiverCandidates } from '../../../shared/teamWaiverContext';
import { readLeagueAvailability, directoryEntry, display } from './unrosteredTes';
const teams = new Set('ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' '));
const positions = new Set(['QB', 'RB', 'WR', 'TE']);
export async function buildWaiverCandidates(rawInput: string): Promise<WaiverCandidates> {
  const { input, league, rosters, rostered, entries, leagueRead, rosterRead, directory } = await readLeagueAvailability(rawInput);
  const candidates = [];
  for (const [id, raw] of entries) {
    const p = directoryEntry.parse(raw);
    if (!p.position || !positions.has(p.position) || p.active !== true || !p.team || !teams.has(p.team)) continue;
    if (!/^\d{1,24}$/.test(id) || (p.player_id != null && p.player_id !== id)) throw new Error('Ambiguous player identity');
    if (rostered.has(id)) continue;
    candidates.push({ player_id: id, name: display(p.full_name) ?? display([p.first_name, p.last_name].filter(Boolean).join(' ')) ?? `Sleeper player ${id}`, position: p.position, team: p.team, status: display(p.status), active: true });
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name, 'en') || a.player_id.localeCompare(b.player_id, 'en'));
  const selectedRoster = rosterRead.value.find(r => r.roster_id === input.rosterId)!;
  return waiverCandidatesSchema.parse({
    schema_version: 'tiber_team_waiver_candidates_v1', status: 'available', input, season: league.season,
    observations: { league_received_at: leagueRead.receivedAt, rosters_received_at: rosterRead.receivedAt, directory_fetched_at: new Date(directory.fetchedAt).toISOString(), directory_source_updated_at: null, directory_cache_max_age_hours: 24, expected_rosters: league.total_rosters, received_rosters: rosters.length, source_urls: [`https://api.sleeper.app/v1/league/${input.leagueId}`, `https://api.sleeper.app/v1/league/${input.leagueId}/rosters`, 'https://api.sleeper.app/v1/players/nfl'] },
    derivation: 'active_current_nfl_team_skill_players_minus_all_league_membership', claim_eligibility: 'unknown',
    waiver_settings: deriveWaiverSettings(leagueRead.value.settings, selectedRoster.settings), candidates,
  });
}
