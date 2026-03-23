export interface DataLabPlayerCarryContext {
  playerId?: string | null;
  playerName?: string | null;
  team?: string | null;
  season?: string | null;
}

export interface PromotedDataLabModuleDefinition {
  id: 'command-center' | 'player-research' | 'team-research' | 'breakout-signals' | 'role-opportunity' | 'age-curves' | 'point-scenarios';
  title: string;
  subtitle: string;
  path: string;
  color: string;
  whatItIsFor: string;
  whenToUse: string;
  alongside: string;
  dependencySummary: string;
  dependencies: string[];
}

export interface PromotedModuleOperatorDetails {
  state: 'misconfigured' | 'no_data' | 'contract_error' | 'dependency_unavailable';
  dependencySummary: string;
  configuredSource: string | null;
  recommendedAction: string;
  readOnlyMessage: string;
}

export const PROMOTED_DATA_LAB_MODULES: PromotedDataLabModuleDefinition[] = [
  {
    id: 'command-center',
    title: 'Data Lab Command Center',
    subtitle: 'Promoted research front door',
    path: '/tiber-data-lab/command-center',
    color: '#111827',
    whatItIsFor: 'Start with the top promoted signals across modules before deciding which lab or workspace to inspect next.',
    whenToUse: 'Use when you want the fastest triage view of what matters right now without opening every promoted surface manually.',
    alongside: 'Best used before Player Research, Team Research, or any single promoted lab so you can choose the next click intentionally.',
    dependencySummary: 'Depends on the four promoted read-only lab adapters and only synthesizes their exported outputs into one summary layer.',
    dependencies: ['WR Breakout Lab adapter', 'Role & Opportunity Lab adapter', 'Age Curve / ARC adapter', 'Point Scenario Lab adapter'],
  },
  {
    id: 'player-research',
    title: 'Player Research Workspace',
    subtitle: 'Cross-model player synthesis',
    path: '/tiber-data-lab/player-research',
    color: '#111827',
    whatItIsFor: 'Inspect one player across all promoted read-only model outputs without opening four separate labs.',
    whenToUse: 'Use when you want the first cross-model synthesis pass before diving into any one lab in detail.',
    alongside: 'Best used as the hub for player-centric research, then followed by the deeper promoted lab pages as needed.',
    dependencySummary: 'Depends on the four promoted lab adapters already being available for the selected player and season.',
    dependencies: ['WR Breakout Lab adapter', 'Role & Opportunity Lab adapter', 'Age Curve / ARC adapter', 'Point Scenario Lab adapter'],
  },
  {
    id: 'team-research',
    title: 'Team Research Workspace',
    subtitle: 'Cross-model team synthesis',
    path: '/tiber-data-lab/team-research',
    color: '#1d4ed8',
    whatItIsFor: 'Inspect one offensive environment across the promoted read-only model surfaces without turning TIBER into a local team dashboard or rescoring layer.',
    whenToUse: 'Use when you want the whole picture for one team before drilling into any one player or promoted lab page.',
    alongside: 'Best paired with Player Research so you can move from team environment to individual player synthesis in one promoted workflow.',
    dependencySummary: 'Depends on the promoted lab adapters plus canonical team context already being available for the selected team and season.',
    dependencies: ['WR Breakout Lab adapter', 'Role & Opportunity Lab adapter', 'Age Curve / ARC adapter', 'Point Scenario Lab adapter'],
  },
  {
    id: 'breakout-signals',
    title: 'WR Breakout Lab',
    subtitle: 'Signal validation context',
    path: '/tiber-data-lab/breakout-signals',
    color: '#f97316',
    whatItIsFor: 'Validate promoted WR breakout candidates, signal-card rankings, and recipe context without rescoring locally.',
    whenToUse: 'Use when you need a fast breakout screen before checking role or developmental context.',
    alongside: 'Best paired with Role & Opportunity for deployment context, ARC for developmental timing, and Team Research for roster-wide environment framing.',
    dependencySummary: 'Depends on promoted Signal-Validation-Model WR exports being readable from the configured export directory.',
    dependencies: ['wr_player_signal_cards_{season}.csv', 'wr_best_recipe_summary.json'],
  },
  {
    id: 'role-opportunity',
    title: 'Role & Opportunity Lab',
    subtitle: 'Usage and deployment context',
    path: '/tiber-data-lab/role-opportunity',
    color: '#0f766e',
    whatItIsFor: 'Inspect how a player is being deployed through role, route, target, air-yard, and snap-share context.',
    whenToUse: 'Use when you want to understand whether volume and alignment support the rest of the player case.',
    alongside: 'Best paired with Breakout Lab for signal strength, ARC for age/career-stage context, and Team Research for environment context.',
    dependencySummary: 'Depends on either the Role-and-opportunity-model compatibility API or a promoted exported artifact path.',
    dependencies: ['Role-and-opportunity-model API', 'ROLE_OPPORTUNITY_EXPORTS_PATH artifact fallback'],
  },
  {
    id: 'age-curves',
    title: 'Age Curve / ARC Lab',
    subtitle: 'Developmental timing context',
    path: '/tiber-data-lab/age-curves',
    color: '#7c3aed',
    whatItIsFor: 'Frame a player by age, career stage, peer bucket, and expected-vs-actual production context.',
    whenToUse: 'Use when you need to pressure-test whether current production lines up with developmental timing.',
    alongside: 'Best paired with Breakout Lab for breakout validation, Role & Opportunity for current deployment, and Team Research for roster-level synthesis.',
    dependencySummary: 'Depends on either ARC compatibility payloads or a promoted age-curve artifact path.',
    dependencies: ['ARC compatibility endpoint', 'AGE_CURVE_EXPORTS_PATH artifact fallback'],
  },
  {
    id: 'point-scenarios',
    title: 'Point Scenario Lab',
    subtitle: 'Scenario-based point context',
    path: '/tiber-data-lab/point-scenarios',
    color: '#2563eb',
    whatItIsFor: 'Inspect how promoted scenario assumptions move baseline point projections without rebuilding projection logic locally.',
    whenToUse: 'Use when you need contingency-aware point outcomes before making a final decision or ranking adjustment elsewhere.',
    alongside: 'Best paired with Breakout Lab, Role & Opportunity, ARC, and Team Research for a complete promoted workflow.',
    dependencySummary: 'Depends on either Point-prediction-Model scenario payloads or a promoted point-scenario artifact path.',
    dependencies: ['Point-prediction-Model API', 'POINT_SCENARIO_EXPORTS_PATH artifact fallback'],
  },
];

export function getPromotedModuleDefinition(moduleId: PromotedDataLabModuleDefinition['id']): PromotedDataLabModuleDefinition | null {
  return PROMOTED_DATA_LAB_MODULES.find((candidate) => candidate.id === moduleId) ?? null;
}

export function buildPromotedModuleHref(moduleId: PromotedDataLabModuleDefinition['id'], context?: DataLabPlayerCarryContext): string {
  const module = getPromotedModuleDefinition(moduleId);
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
  if (context?.team) {
    params.set('team', context.team);
  }
  if (context?.season) {
    params.set('season', context.season);
  }

  const query = params.toString();
  return query ? `${module.path}?${query}` : module.path;
}

export function readDataLabPlayerCarryParams(search: string): DataLabPlayerCarryContext {
  const params = new URLSearchParams(search);

  return {
    playerId: params.get('playerId')?.trim() || null,
    playerName: params.get('playerName')?.trim() || null,
    team: params.get('team')?.trim() || null,
    season: params.get('season')?.trim() || null,
  };
}

export function buildPromotedModuleNavigationLabel(moduleId: PromotedDataLabModuleDefinition['id']): string {
  if (moduleId === 'command-center') {
    return 'Go to command center';
  }
  if (moduleId === 'player-research') {
    return 'Go to player research';
  }
  if (moduleId === 'team-research') {
    return 'Go to team research';
  }
  return 'Go to module';
}

export function formatPromotedModuleProvenance(options: { provider?: string | null; mode?: 'api' | 'artifact' | null; location?: string | null }): string {
  const parts = [options.provider ?? 'Unknown upstream'];
  if (options.mode) {
    parts.push(options.mode === 'artifact' ? 'artifact export' : 'upstream API');
  }
  if (options.location) {
    parts.push(options.location);
  }
  return parts.join(' · ');
}

export function appendPromotedModuleOperatorHints(baseHints: string[], operator?: PromotedModuleOperatorDetails | null): string[] {
  if (!operator) {
    return baseHints;
  }

  const extraHints = [
    operator.dependencySummary,
    operator.configuredSource ? `Configured source: ${operator.configuredSource}` : null,
    operator.recommendedAction,
    operator.readOnlyMessage,
  ].filter((hint): hint is string => Boolean(hint));

  return Array.from(new Set([...baseHints, ...extraHints]));
}
