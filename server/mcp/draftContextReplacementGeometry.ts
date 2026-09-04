export type StarterConfig = {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
};

export type FlexAllocation = {
  RB: number;
  WR: number;
  TE: number;
};

export const DEFAULT_REPLACEMENT_BUFFER = 0.1;
export const DEFAULT_FLEX_ALLOCATION = { RB: 0.35, WR: 0.5, TE: 0.15 } as const;

function normalizeFlexAllocation(configured?: FlexAllocation): FlexAllocation {
  const raw = configured ?? DEFAULT_FLEX_ALLOCATION;
  const total = raw.RB + raw.WR + raw.TE;

  if (total <= 0) {
    return { ...DEFAULT_FLEX_ALLOCATION };
  }

  return {
    RB: raw.RB / total,
    WR: raw.WR / total,
    TE: raw.TE / total,
  };
}

export function calculateReplacementGeometry(
  teams: number,
  starters: StarterConfig,
  configuredFlexAllocation?: FlexAllocation,
  replacementBuffer = DEFAULT_REPLACEMENT_BUFFER,
) {
  const flexAllocation = normalizeFlexAllocation(configuredFlexAllocation);
  const flexSlots = teams * starters.FLEX;
  const starterDemand = {
    QB: teams * starters.QB,
    RB: teams * starters.RB + flexSlots * flexAllocation.RB,
    WR: teams * starters.WR + flexSlots * flexAllocation.WR,
    TE: teams * starters.TE + flexSlots * flexAllocation.TE,
  };

  const replacementRank = {
    QB: Math.max(1, Math.ceil(starterDemand.QB * (1 + replacementBuffer))),
    RB: Math.max(1, Math.ceil(starterDemand.RB * (1 + replacementBuffer))),
    WR: Math.max(1, Math.ceil(starterDemand.WR * (1 + replacementBuffer))),
    TE: Math.max(1, Math.ceil(starterDemand.TE * (1 + replacementBuffer))),
  };

  return {
    flexAllocation,
    flexSlots,
    starterDemand,
    replacementBuffer,
    replacementRank,
  };
}
