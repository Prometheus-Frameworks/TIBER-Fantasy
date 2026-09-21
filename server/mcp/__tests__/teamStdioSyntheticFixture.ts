/** Test-only child process; never selected by the production entry point. */
import type { TeamToolDependencies } from '../../modules/draftReview/mcp/teamToolDefinitions';

await import('./teamIsolationGuards');
const { startTeamStdio } = await import('../teamStdioServer');
const { parseSleeperRosterUrl } = await import('../../modules/draftReview/draftReviewService');

const deps = {
  sourceMode: 'synthetic', parseRosterUrl: parseSleeperRosterUrl,
  readRoster: async () => ({
    status: 'available', fixture: true,
    observed: { current_roster: [{ player_id: '101' }, { player_id: '202' }] },
    provenance: { source_updated_at: null }, forecast: { status: 'unavailable' },
  }),
  readEvidence: (ids: string[]) => ({
    status: 'unavailable', fixture: true,
    players: ids.map(player_id => ({ player_id, status: 'unavailable' })),
  }),
} as unknown as TeamToolDependencies;
await startTeamStdio(deps);
console.log('synthetic diagnostic redirected to stderr');
