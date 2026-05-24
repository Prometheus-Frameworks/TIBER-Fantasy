import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { PlayerOwnershipClient } from '../playerOwnershipClient';
import { PlayerOwnershipService } from '../playerOwnershipService';

const sourceRef = {
  source_name: 'fixture_source',
  source_url: null,
  observed_at: '2026-05-23T13:00:00.000Z',
  source_updated_at: null,
  confidence: 'fixture',
  notes: 'fixture row',
};

function buildPlayer(overrides: Record<string, unknown> = {}) {
  return {
    player_id: 'wr-tee-higgins',
    player_name: 'Tee Higgins',
    position: 'WR',
    football_level: 'NFL',
    current_team_id: 'nfl-cin',
    current_team_abbr: 'CIN',
    current_team_name: 'Cincinnati Bengals',
    ownership_status: 'active_roster',
    valid_from: '2025-03-01T00:00:00.000Z',
    valid_to: null,
    last_verified_at: '2026-05-23T13:00:00.000Z',
    confidence: 'provisional',
    source_refs: [sourceRef],
    ...overrides,
  };
}

function buildArtifact(players = [buildPlayer()]) {
  return {
    contract_version: 'player_ownership_v0',
    generated_at: '2026-05-23T13:00:00.000Z',
    players,
  };
}

function buildEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: 'player-team-change-wr-tee-higgins-2026-03-14',
    event_type: 'team_change',
    player_id: 'wr-tee-higgins',
    player_name: 'Tee Higgins',
    position: 'WR',
    from_team_id: 'nfl-cin',
    from_team_abbr: 'CIN',
    from_team_name: 'Cincinnati Bengals',
    to_team_id: 'nfl-no',
    to_team_abbr: 'NO',
    to_team_name: 'New Orleans Saints',
    detected_at: '2026-03-14T18:22:00.000Z',
    effective_date: '2026-03-14',
    verification_status: 'provisional',
    confidence: 'provisional',
    source_refs: [sourceRef],
    ...overrides,
  };
}

async function createService(payload: unknown, options: { events?: unknown[]; eventsDir?: string | null } = {}) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'player-ownership-'));
  const artifactPath = path.join(tempDir, 'player_ownership_latest.json');
  await fs.writeFile(artifactPath, JSON.stringify(payload), 'utf8');

  let eventsDir = options.eventsDir;
  if (options.events) {
    eventsDir = path.join(tempDir, 'events');
    await fs.mkdir(eventsDir);
    await fs.writeFile(
      path.join(eventsDir, 'player_ownership_events_2026.jsonl'),
      `${options.events.map((event) => JSON.stringify(event)).join('\n')}\n`,
      'utf8',
    );
  }

  const service = new PlayerOwnershipService(new PlayerOwnershipClient({ latestArtifactPath: artifactPath, eventsDir }));
  return { service, tempDir, artifactPath };
}

describe('PlayerOwnershipService', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { recursive: true, force: true })));
  });

  it('returns a latest-state ownership match by player ID with recent events', async () => {
    const { service, tempDir } = await createService(buildArtifact(), { events: [buildEvent()] });
    tempDirs.push(tempDir);

    const insight = await service.getPlayerOwnershipInsight({ playerId: 'wr-tee-higgins', eventLimit: 2 });

    expect(insight).toEqual(
      expect.objectContaining({
        available: true,
        matched: true,
        matchType: 'player_id',
        playerId: 'wr-tee-higgins',
        playerName: 'Tee Higgins',
        currentTeamAbbr: 'CIN',
        ownershipStatus: 'active_roster',
      }),
    );
    expect(insight.sourceRefs[0]).toEqual(expect.objectContaining({ source_name: 'fixture_source' }));
    expect(insight.recentEvents).toHaveLength(1);
    expect(insight.recentEvents[0]).toEqual(expect.objectContaining({ event_type: 'team_change' }));
  });

  it('matches normalized names and returns explicit unknown-player states', async () => {
    const { service, tempDir } = await createService(buildArtifact(), { eventsDir: null });
    tempDirs.push(tempDir);

    const normalized = await service.getPlayerOwnershipInsight({ query: 'tee   higgins', includeEvents: false });
    const unknown = await service.getPlayerOwnershipInsight({ query: 'Unknown Player', includeEvents: false });

    expect(normalized.matched).toBe(true);
    expect(normalized.matchType).toBe('normalized_name');
    expect(unknown).toEqual(
      expect.objectContaining({
        available: true,
        matched: false,
        matchType: 'none',
      }),
    );
    expect(unknown.warnings[0]).toContain('No player ownership match');
  });

  it('returns unavailable states for missing and malformed artifacts instead of throwing', async () => {
    const missingService = new PlayerOwnershipService(
      new PlayerOwnershipClient({
        latestArtifactPath: path.join(os.tmpdir(), 'missing-player-ownership-latest.json'),
        eventsDir: null,
      }),
    );

    const missing = await missingService.getPlayerOwnershipInsight({ playerId: 'wr-tee-higgins' });
    expect(missing.available).toBe(false);
    expect(missing.warnings[0]).toContain('No player ownership latest artifact');

    const { service, tempDir } = await createService({
      contract_version: 'player_ownership_v0',
      generated_at: '2026-05-23T13:00:00.000Z',
      players: [{ player_id: 'bad-row' }],
    });
    tempDirs.push(tempDir);

    const malformed = await service.getPlayerOwnershipInsight({ playerId: 'bad-row' });
    expect(malformed.available).toBe(false);
    expect(malformed.warnings[0]).toContain('does not match');
  });

  it('handles duplicate names as ambiguous matches and missing event directories as warnings', async () => {
    const { service, tempDir } = await createService(
      buildArtifact([
        buildPlayer({ player_id: 'wr-alpha-smith', player_name: 'Alex Smith' }),
        buildPlayer({ player_id: 'qb-alpha-smith', player_name: 'Alex Smith', position: 'QB' }),
      ]),
      { eventsDir: path.join(os.tmpdir(), 'missing-player-ownership-events') },
    );
    tempDirs.push(tempDir);

    const ambiguous = await service.getPlayerOwnershipInsight({ query: 'Alex Smith' });
    expect(ambiguous.available).toBe(true);
    expect(ambiguous.matched).toBe(false);
    expect(ambiguous.warnings[0]).toContain('Ambiguous player ownership match');

    const matched = await service.getPlayerOwnershipInsight({ playerId: 'wr-alpha-smith' });
    expect(matched.matched).toBe(true);
    expect(matched.warnings[0]).toContain('events directory');
  });
});
