import { Link } from 'wouter';
import { AlertTriangle, ArrowUpRight, CheckCircle2, ChevronRight, CircleOff, Layers3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PromotedModuleStateCard } from '@/components/data-lab/PromotedModuleStateCard';
import {
  DataLabCommandCenterResponse,
  formatNumber,
  formatPercent,
  formatSignedNumber,
  getCommandCenterStateLabel,
} from '@/lib/dataLabCommandCenter';

interface DataLabCommandCenterViewProps {
  season: string;
  availableSeasons: number[];
  data: DataLabCommandCenterResponse['data'] | null;
  isLoading: boolean;
  errorMessage: string | null;
  onSeasonChange: (season: string) => void;
}

function statusTone(state: 'ready' | 'partial' | 'empty' | 'error' | 'unavailable') {
  switch (state) {
    case 'ready':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'partial':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'error':
    case 'unavailable':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function statusIcon(state: 'ready' | 'partial' | 'empty' | 'error' | 'unavailable') {
  switch (state) {
    case 'ready':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'partial':
    case 'error':
    case 'unavailable':
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <CircleOff className="h-4 w-4" />;
  }
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-[#fafafa] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</div>
      <div className="mt-2 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function SectionCard({
  section,
  children,
}: {
  section: DataLabCommandCenterResponse['data']['sections'][keyof DataLabCommandCenterResponse['data']['sections']];
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(section.state)}`}>
              {statusIcon(section.state)}
              {section.state === 'ready' ? 'Ready' : section.state === 'empty' ? 'Empty' : 'Unavailable'}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-600">{section.description}</p>
          <p className="mt-2 text-sm text-gray-500">{section.message}</p>
        </div>
        <a href={section.linkHref} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900">
          Open {section.moduleTitle}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
      {children}
    </section>
  );
}

export function DataLabCommandCenterView({
  season,
  availableSeasons,
  data,
  isLoading,
  errorMessage,
  onSeasonChange,
}: DataLabCommandCenterViewProps) {
  const seasonOptions = availableSeasons.length > 0 ? availableSeasons : [Number(season)];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/tiber-data-lab" className="transition-colors hover:text-[#111827]">Data Lab</Link>
        <span>/</span>
        <span className="font-medium text-gray-600">Command Center</span>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-gray-900 text-white">Promoted module front door</Badge>
              <Badge variant="secondary" className="border-0 bg-gray-100 text-gray-700">Read only</Badge>
              {data ? (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(data.state)}`}>
                  {statusIcon(data.state)}
                  {getCommandCenterStateLabel(data.state)}
                </span>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-gray-900">Data Lab Command Center</h1>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {data?.framing.description ?? 'Read-only front door for promoted Data Lab research surfaces.'}
            </p>
            <p className="mt-2 text-sm leading-7 text-gray-500">
              {data?.framing.posture ?? 'This page synthesizes promoted outputs without inventing a unified score or recomputing model logic.'}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-[#fafafa] p-4 text-sm text-gray-600 md:max-w-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">What to do first</div>
            <p className="mt-2 leading-6">
              Use this page to decide where to click next: Player Research for a player-centric pass, Team Research for an environment pass, or one promoted lab when a single signal type is clearly leading.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl border border-gray-200 bg-[#fafafa] p-4 lg:grid-cols-[180px,1fr]">
          <label className="block">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Season</div>
            <select value={season} onChange={(event) => onSeasonChange(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none">
              {seasonOptions.map((option) => (
                <option key={option} value={String(option)}>{option}</option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-white bg-white px-4 py-3 text-sm text-gray-600">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Operator posture</div>
            <div className="mt-2">Inspect promoted read-only outputs.</div>
            <div>No write actions, no rescoring, and no synthetic unified score.</div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6">
          <PromotedModuleStateCard
            icon={Layers3}
            accentClassName="bg-gray-100"
            accentTextClassName="text-gray-700"
            title="Loading Data Lab Command Center"
            message="Loading promoted read-only summaries across Breakout, Role & Opportunity, ARC, Point Scenarios, and quick-link context."
            mode="loading"
          />
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-6">
          <PromotedModuleStateCard
            icon={AlertTriangle}
            accentClassName="bg-red-50"
            accentTextClassName="text-red-700"
            title="Data Lab Command Center unavailable"
            message={errorMessage}
            mode="error"
          />
        </div>
      ) : null}

      {data && !isLoading && !errorMessage ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <SummaryStat label="Season" value={data.season != null ? String(data.season) : '—'} />
            <SummaryStat label="Sections ready" value={String(Object.values(data.sections).filter((section) => section.state === 'ready').length)} />
            <SummaryStat label="Module strip" value={`${data.moduleStatuses.filter((module) => module.state === 'ready').length} ready`} />
            <SummaryStat label="Workspace state" value={getCommandCenterStateLabel(data.state)} />
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Promoted module status</div>
                <h2 className="mt-1 text-lg font-semibold text-gray-900">Ready / empty / unavailable at a glance</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data.moduleStatuses.map((status) => (
                <a key={status.moduleId} href={status.href} className="rounded-xl border border-gray-200 bg-[#fafafa] p-4 transition-colors hover:border-gray-300">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-900">{status.title}</div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(status.state)}`}>
                      {statusIcon(status.state)}
                      {status.state}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{status.detail}</p>
                </a>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">What should I look at first?</div>
                <h2 className="mt-1 text-lg font-semibold text-gray-900">Command Center priorities</h2>
              </div>
            </div>
            {data.priorities.length > 0 ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {data.priorities.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-200 bg-[#fafafa] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{item.moduleTitle}</div>
                        <h3 className="mt-1 text-base font-semibold text-gray-900">{item.title}</h3>
                      </div>
                      <a href={item.moduleHref} className="text-xs font-semibold text-gray-500 hover:text-gray-900">Module <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></a>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{item.reason}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={item.primaryAction.href} className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800">
                        {item.primaryAction.label}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                      {item.secondaryAction ? (
                        <a href={item.secondaryAction.href} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-gray-300 hover:text-gray-900">
                          {item.secondaryAction.label}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-600">No promoted priority cards are available yet. Check the module strip above for empty or unavailable states.</p>
            )}
          </div>

          {data.warnings.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="text-sm font-semibold text-amber-700">Partial-data warnings</div>
              <ul className="mt-2 space-y-2 text-sm text-amber-700">
                {data.warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <SectionCard section={data.sections.breakoutCandidates}>
              {data.sections.breakoutCandidates.items.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {data.sections.breakoutCandidates.items.map((item) => (
                    <div key={`${item.playerId ?? item.playerName}-breakout`} className="rounded-xl border border-gray-200 bg-[#fafafa] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-base font-semibold text-gray-900">{item.playerName}</div>
                          <div className="mt-1 text-sm text-gray-500">{[item.team, item.breakoutLabel].filter(Boolean).join(' · ') || 'WR Breakout signal'}</div>
                          {item.breakoutContext ? <p className="mt-2 text-sm leading-6 text-gray-600">{item.breakoutContext}</p> : null}
                        </div>
                        <div className="grid grid-cols-2 gap-2 md:w-52">
                          <SummaryStat label="Rank" value={item.candidateRank != null ? String(item.candidateRank) : '—'} />
                          <SummaryStat label="Signal" value={formatNumber(item.finalSignalScore, 1)} />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                        <a href={item.links.playerResearchHref} className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-white hover:bg-gray-800">Open in Player Research <ArrowUpRight className="h-3.5 w-3.5" /></a>
                        <a href={item.links.moduleHref} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-gray-700 hover:border-gray-300 hover:text-gray-900">Open breakout card <ArrowUpRight className="h-3.5 w-3.5" /></a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </SectionCard>

            <SectionCard section={data.sections.roleOpportunity}>
              {data.sections.roleOpportunity.items.length > 0 ? (
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-[#fafafa] text-left text-[11px] uppercase tracking-[0.18em] text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Player</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Target</th>
                        <th className="px-4 py-3">Route</th>
                        <th className="px-4 py-3">Next</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
                      {data.sections.roleOpportunity.items.map((item) => (
                        <tr key={`${item.playerId}-role`}>
                          <td className="px-4 py-3"><div className="font-semibold text-gray-900">{item.playerName}</div><div className="text-xs text-gray-500">{item.team} · {item.position}</div></td>
                          <td className="px-4 py-3">{item.primaryRole}</td>
                          <td className="px-4 py-3">{formatPercent(item.targetShare)}</td>
                          <td className="px-4 py-3">{formatPercent(item.routeParticipation)}</td>
                          <td className="px-4 py-3"><a href={item.links.playerResearchHref} className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8]">Open in Player Research <ArrowUpRight className="h-3.5 w-3.5" /></a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard section={data.sections.ageCurves}>
              {data.sections.ageCurves.items.length > 0 ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {data.sections.ageCurves.items.map((item) => (
                    <div key={`${item.playerId ?? item.playerName}-age`} className="rounded-xl border border-gray-200 bg-[#fafafa] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">{item.playerName}</div>
                          <div className="text-xs text-gray-500">{[item.team, item.position, item.trajectoryLabel].filter(Boolean).join(' · ')}</div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.signalDirection === 'overperformer' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {item.signalDirection === 'overperformer' ? 'Overperformer' : 'Underperformer'}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <SummaryStat label="Expected" value={formatNumber(item.expectedPpg, 1)} />
                        <SummaryStat label="Actual" value={formatNumber(item.actualPpg, 1)} />
                        <SummaryStat label="Delta" value={formatSignedNumber(item.ppgDelta, 1)} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                        <a href={item.links.playerResearchHref} className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-white hover:bg-gray-800">Open in Player Research <ArrowUpRight className="h-3.5 w-3.5" /></a>
                        <a href={item.links.moduleHref} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-gray-700 hover:border-gray-300 hover:text-gray-900">Open ARC view <ArrowUpRight className="h-3.5 w-3.5" /></a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </SectionCard>

            <SectionCard section={data.sections.pointScenarios}>
              {data.sections.pointScenarios.items.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {data.sections.pointScenarios.items.map((item) => (
                    <div key={`${item.playerId ?? item.playerName}-${item.scenarioName}`} className="rounded-xl border border-gray-200 bg-[#fafafa] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="font-semibold text-gray-900">{item.playerName}</div>
                          <div className="text-xs text-gray-500">{[item.team, item.position, item.eventType].filter(Boolean).join(' · ')}</div>
                          <p className="mt-2 text-sm leading-6 text-gray-600">{item.scenarioName}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 md:w-72">
                          <SummaryStat label="Base" value={formatNumber(item.baselineProjection, 1)} />
                          <SummaryStat label="Adj" value={formatNumber(item.adjustedProjection, 1)} />
                          <SummaryStat label="Delta" value={formatSignedNumber(item.delta, 1)} />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                        <a href={item.links.playerResearchHref} className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-white hover:bg-gray-800">Open in Player Research <ArrowUpRight className="h-3.5 w-3.5" /></a>
                        <a href={item.links.moduleHref} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-gray-700 hover:border-gray-300 hover:text-gray-900">Open scenario view <ArrowUpRight className="h-3.5 w-3.5" /></a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </SectionCard>
          </div>

          <div className="mt-6">
            <SectionCard section={data.sections.teamEnvironments}>
              {data.sections.teamEnvironments.items.length > 0 ? (
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-[#fafafa] text-left text-[11px] uppercase tracking-[0.18em] text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Team</th>
                        <th className="px-4 py-3">Breakout</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Scenario</th>
                        <th className="px-4 py-3">Next</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
                      {data.sections.teamEnvironments.items.map((item) => (
                        <tr key={item.team}>
                          <td className="px-4 py-3"><div className="font-semibold text-gray-900">{item.teamName}</div><div className="text-xs text-gray-500">{item.team} · {item.topPlayers.join(', ')}</div></td>
                          <td className="px-4 py-3">{item.breakoutCandidateCount}</td>
                          <td className="px-4 py-3">{item.rolePlayerCount}</td>
                          <td className="px-4 py-3">{formatSignedNumber(item.maxScenarioDelta, 1)}</td>
                          <td className="px-4 py-3"><a href={item.links.teamResearchHref} className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8]">Open in Team Research <ArrowUpRight className="h-3.5 w-3.5" /></a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
