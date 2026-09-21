/** Test-only child process; never selected by the production entry point. */
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { startTeamStdio } from '../teamStdioServer';
import { parseSleeperRosterUrl } from '../../modules/draftReview/draftReviewService';
import type { TeamToolDependencies } from '../../modules/draftReview/mcp/teamToolDefinitions';

const forbidden = (): never => { throw new Error('Network/listener forbidden in synthetic process'); };
globalThis.fetch = forbidden;
net.Socket.prototype.connect = forbidden;
net.Server.prototype.listen = forbidden;
http.request = forbidden; https.request = forbidden;

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
