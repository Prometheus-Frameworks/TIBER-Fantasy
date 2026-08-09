import { adaptForgePlayerStaticArtifact } from '../forgePlayerStaticAdapter';
import fs from 'fs';
import path from 'path';
import { ForgePlayerStaticClient } from '../forgePlayerStaticClient';
import { ForgePlayerStaticService } from '../forgePlayerStaticService';
import { ForgePlayerStaticIntegrationError } from '../forgePlayerStaticTypes';

const validPayload = {
  generated_at: '2026-06-07T00:00:00.000Z',
  meta: { artifact_id: 'FORGE_PLAYER_STATIC_V1', contract_version: 'v1' },
  rows: [
    {
      player_id: 'tdp:player:1',
      player_name: 'Specific Player',
      position: 'WR',
      score: { alpha: 74.2, confidence: 0.92 },
      provenance: { score_source: 'player_specific' },
    },
    {
      player_id: 'tdp:player:2',
      player_name: 'Baseline Player',
      position: 'RB',
      alpha: 15,
      provenance: { score_source: 'generated_baseline' },
    },
  ],
};

describe('FORGE_PLAYER_STATIC_V1 adapter', () => {
  it('consumes valid player-specific and generated-baseline rows with separate semantics', () => {
    const lookup = adaptForgePlayerStaticArtifact(validPayload, '/tmp/forge_player_static_v1.json');

    expect(lookup.artifact).toEqual(expect.objectContaining({
      state: 'available',
      available: true,
      rowCount: 2,
      playerSpecificCount: 1,
      generatedBaselineCount: 1,
    }));
    expect(lookup.rowsByPlayerId.get('tdp:player:1')).toEqual(expect.objectContaining({
      scoreSource: 'player_specific',
      isPlayerSpecificEvidence: true,
      isGeneratedBaselineVisibility: false,
      alpha: 74.2,
    }));
    expect(lookup.rowsByPlayerId.get('tdp:player:2')).toEqual(expect.objectContaining({
      scoreSource: 'generated_baseline',
      isPlayerSpecificEvidence: false,
      isGeneratedBaselineVisibility: true,
      alpha: 15,
    }));
  });


  it('normalizes the real FORGE_PLAYER_STATIC_V1 promoted row shape', () => {
    const lookup = adaptForgePlayerStaticArtifact({
      artifact_type: 'forge_player_static',
      schema_version: '1.0.0',
      generated_at: '2026-06-07T00:00:00.000Z',
      rows: [
        {
          player_id: 'tdp:player:real-specific',
          player_name: 'Real Specific Player',
          position: 'WR',
          forge_alpha: 81.6,
          forge_tier: 'T2',
          confidence: { score: 0.88 },
          provenance: { score_source: 'player_specific' },
        },
        {
          player_id: 'tdp:player:real-baseline',
          player_name: 'Real Baseline Player',
          position: 'RB',
          forge_alpha: 15,
          forge_tier: 'BASELINE',
          confidence: { score: 0.1 },
          provenance: { score_source: 'generated_baseline' },
        },
      ],
    }, '/tmp/forge_player_static_v1.json');

    expect(lookup.artifact).toEqual(expect.objectContaining({
      state: 'available',
      contractVersion: '1.0.0',
      playerSpecificCount: 1,
      generatedBaselineCount: 1,
    }));
    expect(lookup.rowsByPlayerId.get('tdp:player:real-specific')).toEqual(expect.objectContaining({
      alpha: 81.6,
      tier: 'T2',
      confidence: 0.88,
      scoreSource: 'player_specific',
      isPlayerSpecificEvidence: true,
      isGeneratedBaselineVisibility: false,
    }));
    expect(lookup.rowsByPlayerId.get('tdp:player:real-baseline')).toEqual(expect.objectContaining({
      alpha: 15,
      tier: 'BASELINE',
      confidence: 0.1,
      scoreSource: 'generated_baseline',
      isPlayerSpecificEvidence: false,
      isGeneratedBaselineVisibility: true,
    }));
  });

  it('keeps root generated_at separate and never substitutes promoted_at or metadata clocks', () => {
    const lookup = adaptForgePlayerStaticArtifact({
      artifact_type: 'FORGE_PLAYER_STATIC_V1',
      schema_version: 'forge_player_static_v1',
      promoted_at: '2026-08-01T00:00:00.000Z',
      meta: { generated_at: '2026-07-31T00:00:00.000Z' },
      rows: [
        { player_id: 'tdp:player:clock', alpha: 70, provenance: { score_source: 'player_specific' } },
      ],
    }, '/tmp/promoted-only.json');

    expect(lookup.artifact.generatedAt).toBeNull();
    expect(lookup.artifact.generatedAtSource).toBeNull();
    expect(lookup.artifact.promotedAt).toBe('2026-08-01T00:00:00.000Z');
    // The generic helper may observe promoted_at, but the named Team Direction
    // policy receives generatedAt=null and therefore rejects it.
    expect(lookup.artifact.freshness?.timestamp).toBe('2026-08-01T00:00:00.000Z');
  });

  it.each([
    ['camelCase alias only', { generatedAt: '2026-08-01T00:00:00.000Z' }],
    ['malformed generated_at plus valid alias', { generated_at: 1234, generatedAt: '2026-08-01T00:00:00.000Z' }],
  ])('does not label %s as root generated_at provenance', (_label, clocks) => {
    const lookup = adaptForgePlayerStaticArtifact({
      artifact_type: 'FORGE_PLAYER_STATIC_V1',
      schema_version: 'forge_player_static_v1',
      ...clocks,
      rows: [
        { player_id: 'tdp:player:clock-alias', alpha: 70, provenance: { score_source: 'player_specific' } },
      ],
    }, '/tmp/alias-clock.json');

    expect(lookup.artifact.generatedAt).toBeNull();
    expect(lookup.artifact.generatedAtSource).toBeNull();
  });

  it('defaults to the bundled deploy-safe forge_player_static artifact path', () => {
    const client = new ForgePlayerStaticClient();

    const defaultPath = path.join(
      process.cwd(),
      'server',
      'artifacts',
      'external',
      'forge',
      'forge_player_static_v1.json',
    );
    expect(client.getConfig().artifactPath).toBe(defaultPath);
    expect(client.getConfig().sourcePath).toBe(defaultPath);
  });

  it('guards the bundled snapshot identity and promoted row counts', () => {
    const bundledPath = path.join(
      process.cwd(),
      'server',
      'artifacts',
      'external',
      'forge',
      'forge_player_static_v1.json',
    );
    const payload = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
    const lookup = adaptForgePlayerStaticArtifact(payload, bundledPath);

    expect(payload).toEqual(expect.objectContaining({
      artifact_type: 'FORGE_PLAYER_STATIC_V1',
      schema_version: 'forge_player_static_v1',
      row_count: 50,
      score_source_policy: expect.objectContaining({
        generated_baseline: expect.any(String),
      }),
      consumer_manifest: expect.objectContaining({
        evidence_gate: expect.any(Object),
      }),
      content_digest: expect.objectContaining({
        algorithm: 'sha256',
        scope: 'rows',
      }),
      source_artifacts: ['data/source-backed/forge_player_weekly_ppr_2025.cohort.v1.json'],
    }));
    expect(lookup.artifact).toEqual(expect.objectContaining({
      available: true,
      rowCount: 50,
      playerSpecificCount: 50,
      generatedBaselineCount: 0,
    }));
    expect(payload.rows.some((row: any) => row?.components && typeof row.components === 'object')).toBe(true);
    // Rows are keyed by GSIS player id, matching the promoted identity crosswalk.
    expect(lookup.rowsByPlayerId.get('00-0039075')).toEqual(expect.objectContaining({
      alpha: 97.9,
      tier: 'elite',
      scoreSource: 'player_specific',
      isPlayerSpecificEvidence: true,
    }));
    expect(lookup.rowsByPlayerId.get('00-0033280')).toEqual(expect.objectContaining({
      alpha: 100,
      tier: 'elite',
      scoreSource: 'player_specific',
      isPlayerSpecificEvidence: true,
      isGeneratedBaselineVisibility: false,
      provenance: expect.objectContaining({
        source_artifacts: expect.arrayContaining([
          'data/source-backed/forge_player_weekly_ppr_2025.cohort.v1.json',
        ]),
      }),
    }));
    // Legacy tiber-data-* identifiers are no longer a vocabulary this artifact speaks.
    expect(lookup.rowsByPlayerId.get('tiber-data-player-2025-puka-nacua')).toBeUndefined();
    expect(Array.from(lookup.rowsByPlayerId.values()).filter((row) => row.isGeneratedBaselineVisibility)).toHaveLength(0);
  });

  it('reports the attempted JSON source path when configured with an artifact directory', () => {
    const client = new ForgePlayerStaticClient({ artifactPath: '/tmp/forge-player-static-dir' });

    expect(client.getConfig().artifactPath).toBe('/tmp/forge-player-static-dir');
    expect(client.getConfig().sourcePath).toBe('/tmp/forge-player-static-dir/forge_player_static_v1.json');
  });

  it('fails closed on duplicate canonical player IDs', () => {
    expect(() => adaptForgePlayerStaticArtifact({
      meta: { artifact_id: 'FORGE_PLAYER_STATIC_V1' },
      rows: [
        { player_id: 'tdp:player:1', alpha: 70, provenance: { score_source: 'player_specific' } },
        { player_id: 'tdp:player:1', alpha: 71, provenance: { score_source: 'player_specific' } },
      ],
    }, '/tmp/dup.json')).toThrow(/duplicate player ID/);
  });

  it('treats unknown score_source rows as non-evidence and non-baseline visibility', () => {
    const lookup = adaptForgePlayerStaticArtifact({
      meta: { artifact_id: 'FORGE_PLAYER_STATIC_V1' },
      rows: [
        { player_id: 'tdp:player:3', alpha: 88, provenance: { score_source: 'experimental_source' } },
      ],
    }, '/tmp/unknown.json');

    expect(lookup.artifact.nonEvidenceCount).toBe(1);
    expect(lookup.rowsByPlayerId.get('tdp:player:3')).toEqual(expect.objectContaining({
      scoreSource: 'unknown',
      isPlayerSpecificEvidence: false,
      isGeneratedBaselineVisibility: false,
    }));
  });

  it('fails closed through service state when the artifact is missing', async () => {
    const service = new ForgePlayerStaticService({
      getConfig: jest.fn().mockReturnValue({ enabled: true, configured: true, artifactPath: '/tmp/missing_static_dir', sourcePath: '/tmp/missing_static_dir/forge_player_static_v1.json' }),
      loadPromotedArtifact: jest.fn().mockRejectedValue(new ForgePlayerStaticIntegrationError(
        'not_found',
        'missing',
        404,
        'missing',
      )),
    } as any);

    const lookup = await service.getLookup();
    expect(lookup.artifact).toEqual(expect.objectContaining({
      available: false,
      state: 'missing',
      rowCount: 0,
      sourcePath: '/tmp/missing_static_dir/forge_player_static_v1.json',
    }));
    expect(lookup.rowsByPlayerId.size).toBe(0);
  });
});
