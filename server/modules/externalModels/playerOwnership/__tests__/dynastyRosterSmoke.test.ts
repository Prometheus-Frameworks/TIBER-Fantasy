import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { PlayerOwnershipClient } from '../playerOwnershipClient';
import { PlayerOwnershipService } from '../playerOwnershipService';
import { runDynastyRosterSmokeTest, formatSmokeReportMarkdown } from '../dynastyRosterSmokeHelper';
import { DYNASTY_ROSTER_SMOKE_2026, DYNASTY_ROSTER_SMOKE_PLAYER_COUNT } from './fixtures/dynastyRosterSmoke2026';

const SOURCE_REF = {
  source_name: 'fixture_source',
  source_url: null,
  observed_at: '2026-05-23T13:00:00.000Z',
  source_updated_at: null,
  confidence: 'fixture',
  notes: 'fixture row',
};

function buildArtifact(players: unknown[]) {
  return {
    contract_version: 'player_ownership_v0',
    generated_at: '2026-05-23T13:00:00.000Z',
    players,
  };
}

async function createService(payload: unknown, eventsDir: string | null = null) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dynasty-smoke-'));
  const artifactPath = path.join(tempDir, 'player_ownership_latest.json');
  await fs.writeFile(artifactPath, JSON.stringify(payload), 'utf8');
  const client = new PlayerOwnershipClient({ latestArtifactPath: artifactPath, eventsDir });
  const service = new PlayerOwnershipService(client);
  return { service, tempDir };
}

describe('Dynasty Roster Ownership Smoke Test — 2026-05-24', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })),
    );
  });

  describe('roster fixture', () => {
    it('contains exactly 26 players', () => {
      expect(DYNASTY_ROSTER_SMOKE_2026).toHaveLength(26);
      expect(DYNASTY_ROSTER_SMOKE_PLAYER_COUNT).toBe(26);
    });

    it('contains the expected quarterback names', () => {
      expect(DYNASTY_ROSTER_SMOKE_2026).toContain('Jalen Hurts');
      expect(DYNASTY_ROSTER_SMOKE_2026).toContain('Geno Smith');
      expect(DYNASTY_ROSTER_SMOKE_2026).toContain('Michael Penix');
      expect(DYNASTY_ROSTER_SMOKE_2026).toContain('Garrett Nussmeier');
    });

    it('contains the expected running back names', () => {
      expect(DYNASTY_ROSTER_SMOKE_2026).toContain('Omarion Hampton');
      expect(DYNASTY_ROSTER_SMOKE_2026).toContain('Joe Mixon');
      expect(DYNASTY_ROSTER_SMOKE_2026).toContain('Tank Bigsby');
    });

    it('contains the expected tight end names', () => {
      expect(DYNASTY_ROSTER_SMOKE_2026).toContain('Colston Loveland');
      expect(DYNASTY_ROSTER_SMOKE_2026).toContain('Dallas Goedert');
      expect(DYNASTY_ROSTER_SMOKE_2026).toContain('Juwan Johnson');
    });

    it('has no duplicate names', () => {
      const unique = new Set(DYNASTY_ROSTER_SMOKE_2026);
      expect(unique.size).toBe(DYNASTY_ROSTER_SMOKE_2026.length);
    });
  });

  describe('runDynastyRosterSmokeTest — artifact unavailable', () => {
    it('returns available=false for all 26 players when artifact is missing and does not fabricate success', async () => {
      const missingPath = path.join(os.tmpdir(), 'missing-player-ownership-latest.json');
      const client = new PlayerOwnershipClient({ latestArtifactPath: missingPath, eventsDir: null });
      const service = new PlayerOwnershipService(client);

      const report = await runDynastyRosterSmokeTest(DYNASTY_ROSTER_SMOKE_2026, service);

      expect(report.totalTested).toBe(26);
      expect(report.totalMatched).toBe(0);
      expect(report.totalUnmatched).toBe(0);
      expect(report.totalAmbiguous).toBe(0);
      expect(report.totalUnavailable).toBe(26);
      expect(report.artifactAvailable).toBe(false);
      expect(Object.keys(report.byConfidence)).toHaveLength(0);

      for (const player of report.players) {
        expect(player.available).toBe(false);
        expect(player.matched).toBe(false);
        expect(player.playerId).toBeNull();
        expect(player.confidence).toBeNull();
        expect(player.warnings.length).toBeGreaterThan(0);
        expect(player.warnings[0]).toMatch(/artifact|not found|unavailable/i);
      }
    });

    it('preserves all 26 input names in results even when artifact is missing', async () => {
      const missingPath = path.join(os.tmpdir(), 'missing-player-ownership-latest.json');
      const client = new PlayerOwnershipClient({ latestArtifactPath: missingPath, eventsDir: null });
      const service = new PlayerOwnershipService(client);

      const report = await runDynastyRosterSmokeTest(DYNASTY_ROSTER_SMOKE_2026, service);

      expect(report.players.map((p) => p.inputName)).toEqual([...DYNASTY_ROSTER_SMOKE_2026]);
    });
  });

  describe('runDynastyRosterSmokeTest — confidence semantics with fixture artifact', () => {
    it('preserves source_verified confidence for draft-backed rows', async () => {
      const { service, tempDir } = await createService(
        buildArtifact([
          {
            player_id: 'qb-jalen-hurts',
            player_name: 'Jalen Hurts',
            position: 'QB',
            football_level: 'NFL',
            current_team_id: 'nfl-phi',
            current_team_abbr: 'PHI',
            current_team_name: 'Philadelphia Eagles',
            ownership_status: 'active_roster',
            valid_from: '2026-01-01T00:00:00.000Z',
            valid_to: null,
            last_verified_at: '2026-05-01T00:00:00.000Z',
            confidence: 'source_verified',
            source_refs: [{ ...SOURCE_REF, source_name: '2026_draft_results', confidence: 'source_verified' }],
          },
        ]),
      );
      tempDirs.push(tempDir);

      const report = await runDynastyRosterSmokeTest(['Jalen Hurts'], service);

      expect(report.artifactAvailable).toBe(true);
      expect(report.totalMatched).toBe(1);
      expect(report.totalUnavailable).toBe(0);
      expect(report.byConfidence).toEqual({ source_verified: 1 });

      const player = report.players[0];
      expect(player.matched).toBe(true);
      expect(player.confidence).toBe('source_verified');
      expect(player.sourceSummary).toBe('2026_draft_results');
      expect(player.warnings).toHaveLength(0);
    });

    it('preserves provisional confidence and stale warnings for nflreadpy roster snapshot rows', async () => {
      const { service, tempDir } = await createService(
        buildArtifact([
          {
            player_id: 'wr-ladd-mcconkey',
            player_name: 'Ladd McConkey',
            position: 'WR',
            football_level: 'NFL',
            current_team_id: 'nfl-lac',
            current_team_abbr: 'LAC',
            current_team_name: 'Los Angeles Chargers',
            ownership_status: 'active_roster',
            valid_from: '2025-01-01T00:00:00.000Z',
            valid_to: null,
            last_verified_at: '2025-12-01T00:00:00.000Z',
            confidence: 'provisional',
            source_refs: [{ ...SOURCE_REF, source_name: 'nflreadpy_roster_snapshot', notes: 'stale-current-roster: last snapshot 2025-12-01' }],
          },
        ]),
      );
      tempDirs.push(tempDir);

      const report = await runDynastyRosterSmokeTest(['Ladd McConkey'], service);

      expect(report.artifactAvailable).toBe(true);
      expect(report.totalMatched).toBe(1);
      expect(report.byConfidence).toEqual({ provisional: 1 });

      const player = report.players[0];
      expect(player.matched).toBe(true);
      expect(player.confidence).toBe('provisional');
      expect(player.sourceSummary).toContain('nflreadpy_roster_snapshot');
    });

    it('reports unmatched explicitly without fabricating a result for an absent player', async () => {
      const { service, tempDir } = await createService(buildArtifact([
        {
          player_id: 'qb-jalen-hurts',
          player_name: 'Jalen Hurts',
          position: 'QB',
          football_level: 'NFL',
          current_team_id: 'nfl-phi',
          current_team_abbr: 'PHI',
          current_team_name: 'Philadelphia Eagles',
          ownership_status: 'active_roster',
          valid_from: '2026-01-01T00:00:00.000Z',
          valid_to: null,
          last_verified_at: '2026-05-01T00:00:00.000Z',
          confidence: 'source_verified',
          source_refs: [SOURCE_REF],
        },
      ]));
      tempDirs.push(tempDir);

      const report = await runDynastyRosterSmokeTest(['Jalen Hurts', 'Geno Smith'], service);

      expect(report.totalTested).toBe(2);
      expect(report.totalMatched).toBe(1);
      expect(report.totalUnmatched).toBe(1);
      expect(report.totalUnavailable).toBe(0);

      const unmatched = report.players.find((p) => p.inputName === 'Geno Smith');
      expect(unmatched).toBeDefined();
      expect(unmatched!.matched).toBe(false);
      expect(unmatched!.available).toBe(true);
      expect(unmatched!.confidence).toBeNull();
      expect(unmatched!.warnings[0]).toMatch(/No player ownership match/i);
    });

    it('does not mutate TIBER-Data rows or add TIBER-Fantasy-invented fields', async () => {
      const { service, tempDir } = await createService(
        buildArtifact([
          {
            player_id: 'te-dallas-goedert',
            player_name: 'Dallas Goedert',
            position: 'TE',
            football_level: 'NFL',
            current_team_id: 'nfl-phi',
            current_team_abbr: 'PHI',
            current_team_name: 'Philadelphia Eagles',
            ownership_status: 'active_roster',
            valid_from: '2025-09-01T00:00:00.000Z',
            valid_to: null,
            last_verified_at: '2025-12-01T00:00:00.000Z',
            confidence: 'provisional',
            source_refs: [SOURCE_REF],
          },
        ]),
      );
      tempDirs.push(tempDir);

      const report = await runDynastyRosterSmokeTest(['Dallas Goedert'], service);

      const player = report.players[0];
      expect(player.matched).toBe(true);
      expect(player.playerId).toBe('te-dallas-goedert');
      expect(player.position).toBe('TE');
      expect(player.footballLevel).toBe('NFL');
      expect(player.ownershipStatus).toBe('active_roster');
    });
  });

  describe('formatSmokeReportMarkdown', () => {
    it('marks artifact unavailable clearly in the markdown output', async () => {
      const missingPath = path.join(os.tmpdir(), 'missing-player-ownership-latest.json');
      const client = new PlayerOwnershipClient({ latestArtifactPath: missingPath, eventsDir: null });
      const service = new PlayerOwnershipService(client);

      const report = await runDynastyRosterSmokeTest(['Jalen Hurts'], service);
      const md = formatSmokeReportMarkdown(report);

      expect(md).toContain('Artifact available:** NO');
      expect(md).toContain('Artifact unavailable');
      expect(md).toContain('not fabricated');
      expect(md).not.toContain('✓ matched');
    });

    it('includes per-player table with all expected columns', async () => {
      const { service, tempDir } = await createService(
        buildArtifact([
          {
            player_id: 'wr-keon-coleman',
            player_name: 'Keon Coleman',
            position: 'WR',
            football_level: 'NFL',
            current_team_id: 'nfl-buf',
            current_team_abbr: 'BUF',
            current_team_name: 'Buffalo Bills',
            ownership_status: 'active_roster',
            valid_from: '2024-04-27T00:00:00.000Z',
            valid_to: null,
            last_verified_at: '2026-05-01T00:00:00.000Z',
            confidence: 'source_verified',
            source_refs: [{ ...SOURCE_REF, source_name: '2024_draft_results' }],
          },
        ]),
      );
      tempDirs.push(tempDir);

      const report = await runDynastyRosterSmokeTest(['Keon Coleman'], service);
      const md = formatSmokeReportMarkdown(report);

      expect(md).toContain('Keon Coleman');
      expect(md).toContain('wr-keon-coleman');
      expect(md).toContain('source_verified');
      expect(md).toContain('2024_draft_results');
      expect(md).toContain('✓ matched');
    });
  });
});
