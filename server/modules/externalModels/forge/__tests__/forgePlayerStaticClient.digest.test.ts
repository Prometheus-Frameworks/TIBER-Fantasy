import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  ForgePlayerStaticClient,
  computeForgePlayerStaticRowsDigest,
} from '../forgePlayerStaticClient';
import { ForgePlayerStaticIntegrationError } from '../forgePlayerStaticTypes';

const ROWS = [
  {
    schema_version: 'forge_player_static_v1',
    player_id: 'tiber-data-player-2025-example',
    player_name: 'Example Player',
    position: 'WR',
    team: 'IND',
    forge_alpha: 71.2,
    provenance: { score_source: 'player_specific' },
  },
];

function artifactWithDigest() {
  return {
    schema_version: 'forge_player_static_v1',
    artifact_type: 'FORGE_PLAYER_STATIC_V1',
    content_digest: {
      algorithm: 'sha256',
      scope: 'rows',
      canonicalization: 'json_sorted_keys_no_whitespace_v1',
      value: computeForgePlayerStaticRowsDigest(ROWS),
    },
    rows: ROWS,
  };
}

describe('ForgePlayerStaticClient content digest verification', () => {
  let dir: string;
  let artifactPath: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-static-digest-'));
    artifactPath = path.join(dir, 'forge_player_static_v1.json');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function writeArtifact(artifact: unknown) {
    await fs.writeFile(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');
  }

  it('verifies a matching digest and reports digest_verified', async () => {
    await writeArtifact(artifactWithDigest());
    const client = new ForgePlayerStaticClient({ artifactPath, enabled: true });
    const result = await client.loadPromotedArtifact();
    expect(result.integrity).toBe('digest_verified');
  });

  it('fails closed when rows are altered after the digest was stamped', async () => {
    const artifact = artifactWithDigest();
    artifact.rows = [{ ...ROWS[0], forge_alpha: 99.9 }];
    await writeArtifact(artifact);
    const client = new ForgePlayerStaticClient({ artifactPath, enabled: true });
    await expect(client.loadPromotedArtifact()).rejects.toMatchObject({
      code: 'invalid_payload',
      state: 'malformed',
      status: 502,
    });
  });

  it('fails closed on a substituted artifact whose digest value is wrong', async () => {
    const artifact = artifactWithDigest();
    artifact.content_digest.value = 'a'.repeat(64);
    await writeArtifact(artifact);
    const client = new ForgePlayerStaticClient({ artifactPath, enabled: true });
    await expect(client.loadPromotedArtifact()).rejects.toBeInstanceOf(
      ForgePlayerStaticIntegrationError,
    );
  });

  it('fails closed on an unsupported digest declaration', async () => {
    const artifact = artifactWithDigest();
    (artifact.content_digest as Record<string, unknown>).algorithm = 'md5';
    await writeArtifact(artifact);
    const client = new ForgePlayerStaticClient({ artifactPath, enabled: true });
    await expect(client.loadPromotedArtifact()).rejects.toMatchObject({
      code: 'invalid_payload',
    });
  });

  it('accepts a digest-free legacy artifact and reports digest_missing', async () => {
    const { content_digest: _omitted, ...legacy } = artifactWithDigest();
    await writeArtifact(legacy);
    const client = new ForgePlayerStaticClient({ artifactPath, enabled: true });
    const result = await client.loadPromotedArtifact();
    expect(result.integrity).toBe('digest_missing');
  });

  it('keeps non-object shape rejection with the adapter and does not emit the object-only legacy warning', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      for (const payload of [null, [], 'not-an-artifact']) {
        await writeArtifact(payload);
        const client = new ForgePlayerStaticClient({ artifactPath, enabled: true });
        const result = await client.loadPromotedArtifact();
        expect(result.integrity).toBe('digest_missing');
      }
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it.each(['players', 'data'] as const)(
    'leaves a digest-free legacy %s container for the adapter to consume',
    async (container) => {
      await writeArtifact({
        artifact_type: 'FORGE_PLAYER_STATIC_V1',
        [container]: ROWS,
      });
      const client = new ForgePlayerStaticClient({ artifactPath, enabled: true });
      const result = await client.loadPromotedArtifact();
      expect(result.integrity).toBe('digest_missing');
      expect(result.payload).toEqual(expect.objectContaining({ [container]: ROWS }));
    },
  );

  it.each(['players', 'data'] as const)(
    'rejects a present rows-scoped digest when only %s exists',
    async (container) => {
      await writeArtifact({
        artifact_type: 'FORGE_PLAYER_STATIC_V1',
        [container]: ROWS,
        content_digest: artifactWithDigest().content_digest,
      });
      const client = new ForgePlayerStaticClient({ artifactPath, enabled: true });
      await expect(client.loadPromotedArtifact()).rejects.toMatchObject({
        code: 'invalid_payload',
        state: 'malformed',
      });
    },
  );

  it('rejects an uppercase digest value as an unsupported declaration', async () => {
    const artifact = artifactWithDigest();
    artifact.content_digest.value = artifact.content_digest.value.toUpperCase();
    await writeArtifact(artifact);
    const client = new ForgePlayerStaticClient({ artifactPath, enabled: true });
    await expect(client.loadPromotedArtifact()).rejects.toMatchObject({
      code: 'invalid_payload',
      state: 'malformed',
    });
  });

  it('digest recomputation is key-order independent (canonicalization)', () => {
    const reordered = [
      {
        provenance: { score_source: 'player_specific' },
        team: 'IND',
        position: 'WR',
        player_name: 'Example Player',
        player_id: 'tiber-data-player-2025-example',
        forge_alpha: 71.2,
        schema_version: 'forge_player_static_v1',
      },
    ];
    expect(computeForgePlayerStaticRowsDigest(reordered)).toBe(
      computeForgePlayerStaticRowsDigest(ROWS),
    );
  });
});
