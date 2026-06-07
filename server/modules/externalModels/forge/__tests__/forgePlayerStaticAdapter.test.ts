import { adaptForgePlayerStaticArtifact } from '../forgePlayerStaticAdapter';
import { ForgePlayerStaticService } from '../forgePlayerStaticService';
import { ForgePlayerStaticIntegrationError } from '../forgePlayerStaticTypes';

const validPayload = {
  meta: { artifact_id: 'FORGE_PLAYER_STATIC_V1', contract_version: 'v1', generated_at: '2026-06-07T00:00:00.000Z' },
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
      getConfig: jest.fn().mockReturnValue({ enabled: true, configured: true, artifactPath: '/tmp/missing_static.json' }),
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
    }));
    expect(lookup.rowsByPlayerId.size).toBe(0);
  });
});
