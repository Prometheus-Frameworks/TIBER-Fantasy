export interface DataLabPlayerCarryContext {
  playerId?: string | null;
  playerName?: string | null;
}

export interface PromotedDataLabModuleDefinition {
  id: 'breakout-signals' | 'role-opportunity' | 'age-curves' | 'point-scenarios';
  title: string;
  subtitle: string;
  path: string;
  color: string;
  whatItIsFor: string;
  whenToUse: string;
  alongside: string;
}

export const PROMOTED_DATA_LAB_MODULES: PromotedDataLabModuleDefinition[] = [
  {
    id: 'breakout-signals',
    title: 'WR Breakout Lab',
    subtitle: 'Signal validation context',
    path: '/tiber-data-lab/breakout-signals',
    color: '#f97316',
    whatItIsFor: 'Validate promoted WR breakout candidates, signal-card rankings, and recipe context without rescoring locally.',
    whenToUse: 'Use when you need a fast breakout screen before checking role or developmental context.',
    alongside: 'Best paired with Role & Opportunity for deployment context and ARC for developmental timing.',
  },
  {
    id: 'role-opportunity',
    title: 'Role & Opportunity Lab',
    subtitle: 'Usage and deployment context',
    path: '/tiber-data-lab/role-opportunity',
    color: '#0f766e',
    whatItIsFor: 'Inspect how a player is being deployed through role, route, target, air-yard, and snap-share context.',
    whenToUse: 'Use when you want to understand whether volume and alignment support the rest of the player case.',
    alongside: 'Best paired with Breakout Lab for signal strength and ARC for age/career-stage context.',
  },
  {
    id: 'age-curves',
    title: 'Age Curve / ARC Lab',
    subtitle: 'Developmental timing context',
    path: '/tiber-data-lab/age-curves',
    color: '#7c3aed',
    whatItIsFor: 'Frame a player by age, career stage, peer bucket, and expected-vs-actual production context.',
    whenToUse: 'Use when you need to pressure-test whether current production lines up with developmental timing.',
    alongside: 'Best paired with Breakout Lab for breakout validation and Role & Opportunity for current deployment.',
  },
  {
    id: 'point-scenarios',
    title: 'Point Scenario Lab',
    subtitle: 'Scenario-based point context',
    path: '/tiber-data-lab/point-scenarios',
    color: '#2563eb',
    whatItIsFor: 'Inspect how promoted scenario assumptions move baseline point projections without rebuilding projection logic locally.',
    whenToUse: 'Use when you need contingency-aware point outcomes before making a final decision or ranking adjustment elsewhere.',
    alongside: 'Best paired with Breakout Lab for candidate validation, Role & Opportunity for deployment context, and ARC for developmental timing.',
  },
];

export function buildPromotedModuleHref(
  moduleId: PromotedDataLabModuleDefinition['id'],
  context?: DataLabPlayerCarryContext,
): string {
  const module = PROMOTED_DATA_LAB_MODULES.find((candidate) => candidate.id === moduleId);
  if (!module) {
    return '/tiber-data-lab';
  }

  const params = new URLSearchParams();

  if (context?.playerId) {
    params.set('playerId', context.playerId);
  }

  if (context?.playerName) {
    params.set('playerName', context.playerName);
  }

  const query = params.toString();
  return query ? `${module.path}?${query}` : module.path;
}

export function readDataLabPlayerCarryParams(search: string): DataLabPlayerCarryContext {
  const params = new URLSearchParams(search);
  const playerId = params.get('playerId');
  const playerName = params.get('playerName');

  return {
    playerId: playerId?.trim() || null,
    playerName: playerName?.trim() || null,
  };
}
