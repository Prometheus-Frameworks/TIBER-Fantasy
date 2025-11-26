import fs from 'fs';
import path from 'path';
import { getForgeBatch } from './forgeGateway';
import type { ForgePosition, ForgeScore } from './types';

export interface ForgeSnapshotOptions {
  season?: number;
  week?: number;
  position?: ForgePosition | 'ALL';
  limit?: number;
}

export interface ForgeSnapshotMeta {
  season: number;
  week: number;
  position: ForgePosition | 'ALL';
  limit: number;
  count: number;
  scoredAt: string;
  filePath: string;
}

export async function createForgeSnapshot(
  opts: ForgeSnapshotOptions = {}
): Promise<ForgeSnapshotMeta> {
  const season = opts.season ?? 2024;
  const week = opts.week ?? 17;
  const position = opts.position ?? 'ALL';
  const limit = opts.limit ?? 500;

  const { scores, meta } = await getForgeBatch({
    season,
    week,
    position: position === 'ALL' ? undefined : position,
    limit,
  });

  const snapshotDir = path.join(process.cwd(), 'data', 'forge');
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `forge_${season}_w${week}_${position.toLowerCase()}_${timestamp}.json`;
  const filePath = path.join(snapshotDir, filename);

  const payload = {
    meta: {
      ...meta,
      position,
      limit,
      count: scores.length,
      snapshotGeneratedAt: new Date().toISOString(),
    },
    scores: scores as ForgeScore[],
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

  return {
    season,
    week,
    position,
    limit,
    count: scores.length,
    scoredAt: meta.scoredAt,
    filePath,
  };
}
