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
      return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    case 'empty_dataset':
      return 'bg-amber-50 border-amber-200 text-amber-700';
    case 'available_other_seasons':
      return 'bg-blue-50 border-blue-200 text-blue-700';
    case 'disabled_by_env_config':
      return 'bg-slate-100 border-slate-200 text-slate-700';
    case 'missing_export_artifact':
      return 'bg-orange-50 border-orange-200 text-orange-700';
    default:
      return 'bg-red-50 border-red-200 text-red-700';
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
