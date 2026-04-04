export type Position = 'QB' | 'RB' | 'WR' | 'TE';

export interface TiersApiPlayer {
  playerId: string;
  playerName: string;
  position: Position;
  nflTeam?: string | null;
  rank: number;
  alpha: number;
  rawAlpha?: number | null;
  tier: 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
  tierNumeric: number;
  subscores: {
    volume?: number | null;
    efficiency?: number | null;
    teamContext?: number | null;
    stability?: number | null;
    dynastyContext?: number | null;
  };
  trajectory?: 'rising' | 'flat' | 'declining' | null;
  confidence?: number | null;
  gamesPlayed?: number | null;
  footballLensIssues?: string[] | null;
  lensAdjustment?: number | null;
  productionStats?: {
    targets?: number | null;
    touches?: number | null;
  };
}

export interface RankingsV2Item {
  rank: number;
  playerId: string;
  playerName: string;
  position?: string | null;
  team?: string | null;
  tier?: string | null;
  score?: number | null;
  value?: number | null;
  explanation?: {
    pillarNotes?: Array<{ pillar: string; note?: string | null }> | null;
  } | null;
  trust?: {
    confidence?: number | null;
    sampleNote?: string | null;
    stabilityNote?: string | null;
  } | null;
}

function parsePillarValue(item: RankingsV2Item, pillar: string): number | null {
  const note = item.explanation?.pillarNotes?.find((p) => p.pillar === pillar)?.note;
  if (!note) return null;
  const numeric = Number(note);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseGamesPlayed(sampleNote?: string | null): number | null {
  if (!sampleNote) return null;
  const match = sampleNote.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function parseTrajectory(stabilityNote?: string | null): 'rising' | 'flat' | 'declining' | null {
  if (!stabilityNote) return null;
  if (stabilityNote.includes('rising')) return 'rising';
  if (stabilityNote.includes('declining')) return 'declining';
  if (stabilityNote.includes('flat')) return 'flat';
  return null;
}

function asTier(tier?: string | null): 'T1' | 'T2' | 'T3' | 'T4' | 'T5' {
  if (tier === 'T1' || tier === 'T2' || tier === 'T3' || tier === 'T4' || tier === 'T5') return tier;
  return 'T5';
}

export function mapRankingsV2ItemsToTiersPlayers(items: RankingsV2Item[]): TiersApiPlayer[] {
  return items.map((item, idx) => {
    const tier = asTier(item.tier);
    return {
      playerId: item.playerId,
      playerName: item.playerName,
      position: (item.position as Position) || 'WR',
      nflTeam: item.team ?? null,
      rank: item.rank ?? idx + 1,
      alpha: item.score ?? 0,
      rawAlpha: item.value ?? null,
      tier,
      tierNumeric: Number(tier.slice(1)),
      subscores: {
        volume: parsePillarValue(item, 'volume'),
        efficiency: parsePillarValue(item, 'efficiency'),
        teamContext: parsePillarValue(item, 'team_context'),
        stability: parsePillarValue(item, 'stability'),
      },
      trajectory: parseTrajectory(item.trust?.stabilityNote),
      confidence: item.trust?.confidence ?? null,
      gamesPlayed: parseGamesPlayed(item.trust?.sampleNote),
      footballLensIssues: [],
      lensAdjustment: null,
      productionStats: {},
    };
  });
}
