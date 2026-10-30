import type { WaiverCandidates } from '../../../shared/teamWaiverContext';
import { readLeagueAvailabilityForSelection } from './leagueAvailability';
import { compileWaiverCandidates } from './waiverCandidateCompiler';
export async function buildWaiverCandidates(rawInput: string): Promise<WaiverCandidates> {
  const { parseSleeperRosterUrl } = await import('./draftReviewService');
  return compileWaiverCandidates(await readLeagueAvailabilityForSelection(parseSleeperRosterUrl(rawInput)));
}
