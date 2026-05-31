export type PromotedModelOperationalStatus =
  | 'ready'
  | 'available_other_seasons'
  | 'missing_export_artifact'
  | 'upstream_unavailable'
  | 'disabled_by_env_config'
  | 'empty_dataset';

export interface PromotedModelStatusResponse {
  success: true;
  data: {
    season: number | null;
    statuses: Array<{
      moduleId: 'command-center' | 'player-research' | 'team-research' | 'breakout-signals' | 'role-opportunity' | 'age-curves' | 'point-scenarios';
      title: string;
      route: string;
      status: PromotedModelOperationalStatus;
      detail: string;
      availableSeasons: number[];
      readOnly: true;
      checks: string[];
    }>;
  };
  meta: {
    module: 'data-lab-promoted-status';
    adapter: string;
    readOnly: true;
    fetchedAt: string;
  };
}

export interface PromotedModelStatusApiError {
  success: false;
  error: string;
}

export function getPromotedStatusTone(status: PromotedModelOperationalStatus): string {
  switch (status) {
    case 'ready':
      return 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400';
    case 'empty_dataset':
      return 'bg-amber-900/30 border-amber-700/50 text-amber-400';
    case 'available_other_seasons':
      return 'bg-blue-900/30 border-blue-700/50 text-blue-400';
    case 'disabled_by_env_config':
      return 'bg-slate-800 border-slate-600/50 text-slate-400';
    case 'missing_export_artifact':
      return 'bg-orange-900/30 border-orange-700/50 text-orange-400';
    default:
      return 'bg-red-900/30 border-red-700/50 text-red-400';
  }
}

export function getPromotedStatusLabel(status: PromotedModelOperationalStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'missing_export_artifact':
      return 'Missing export artifact';
    case 'available_other_seasons':
      return 'Available other season(s)';
    case 'upstream_unavailable':
      return 'Upstream unavailable';
    case 'disabled_by_env_config':
      return 'Disabled by env/config';
    case 'empty_dataset':
      return 'Empty dataset';
    default:
      return status;
  }
}
