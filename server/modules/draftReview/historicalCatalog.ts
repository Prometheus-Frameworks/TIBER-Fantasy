import { historicalCatalogSchema } from '../../../shared/teamHistoricalData';
import { historicalCatalogEvidence } from './historicalEvidence';
import { getDraftReviewPlayerDirectory } from './draftReviewService';
import { directoryEntry, display } from './unrosteredTes';

export async function buildHistoricalCatalog() {
  const evidence = historicalCatalogEvidence();
  let directory: Awaited<ReturnType<typeof getDraftReviewPlayerDirectory>> | null = null;
  if (evidence.status === 'available') {
    try { directory = await getDraftReviewPlayerDirectory(); } catch { /* ID labels preserve history when the directory is down. */ }
  }
  return historicalCatalogSchema.parse({
    schema_version: 'tiber_team_historical_catalog_v1', evidence,
    labels: evidence.players.map(p => {
      const entry = directoryEntry.safeParse(directory?.players[p.player_id]);
      const label = entry.success && (!entry.data.player_id || entry.data.player_id === p.player_id)
        ? display(entry.data.full_name) ?? display([entry.data.first_name, entry.data.last_name].filter(Boolean).join(' ')) : null;
      return { player_id: p.player_id, name: label?.slice(0, 160) || `Sleeper player ${p.player_id}` };
    }),
    directory: { fetched_at: directory ? new Date(directory.fetchedAt).toISOString() : null, source_updated_at: null,
      source_url: 'https://api.sleeper.app/v1/players/nfl', reason: directory ? null : 'Name directory unavailable; use player IDs. This does not remove historical evidence.' },
  });
}
