import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Link } from 'wouter';
import {
  getPromotedStatusLabel,
  getPromotedStatusTone,
  PromotedModelStatusApiError,
  PromotedModelStatusResponse,
} from '@/lib/dataLabPromotedStatus';

async function fetchPromotedStatus(season?: string): Promise<PromotedModelStatusResponse> {
  const params = new URLSearchParams();
  if (season) {
    params.set('season', season);
  }

  const response = await fetch(`/api/data-lab/promoted-status?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok) {
    throw payload as PromotedModelStatusApiError;
  }

  return payload as PromotedModelStatusResponse;
}

export function PromotedModelStatusPanel({ season, compact = false }: { season?: string; compact?: boolean }) {
  const query = useQuery<PromotedModelStatusResponse, PromotedModelStatusApiError>({
    queryKey: ['/api/data-lab/promoted-status', season ?? ''],
    queryFn: () => fetchPromotedStatus(season),
    retry: false,
  });

  if (query.isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="text-sm text-gray-500">Loading promoted model diagnostics…</div>
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
          <AlertTriangle className="h-4 w-4" />
          Promoted model diagnostics unavailable
        </div>
        <p className="mt-2 text-sm text-red-700">{query.error.error}</p>
      </div>
    );
  }

  const statuses = query.data?.data.statuses ?? [];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Promoted model operational status</div>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">Read-only readiness diagnostics</h3>
          {!compact ? (
            <p className="mt-2 text-sm text-gray-600">
              Honest status checks for promoted model integrations: ready, missing artifact, upstream unavailable, disabled by env/config, or empty dataset.
            </p>
          ) : null}
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Read only
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
        {statuses.map((status) => (
          <Link key={status.moduleId} href={status.route} className="rounded-xl border border-gray-200 bg-[#fafafa] p-4 transition-colors hover:border-gray-300">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold text-gray-900">{status.title}</div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPromotedStatusTone(status.status)}`}>
                {getPromotedStatusLabel(status.status)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-600">{status.detail}</p>
            {status.availableSeasons.length > 0 ? (
              <p className="mt-2 text-xs text-gray-500">
                Available seasons: {status.availableSeasons.join(', ')}
              </p>
            ) : null}
            {!compact && status.checks.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-gray-500">
                {status.checks.slice(0, 2).map((check) => (
                  <li key={check}>• {check}</li>
                ))}
              </ul>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
