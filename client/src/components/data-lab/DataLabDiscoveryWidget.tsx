import { ArrowUpRight, Compass, Microscope } from 'lucide-react';
import { Link } from 'wouter';
import { buildDataLabCommandCenterHref, DataLabCommandCenterResponse, getCommandCenterStateLabel } from '@/lib/dataLabCommandCenter';

interface DataLabDiscoveryWidgetProps {
  season: string;
  data: DataLabCommandCenterResponse['data'] | null;
  isLoading?: boolean;
  fallbackSummary: {
    playersTracked: number;
    avgPpg: number;
    t1Count: number;
    topScorerName: string | null;
    topScorerPpg: number | null;
  };
}

export function DataLabDiscoveryWidget({
  season,
  data,
  isLoading = false,
  fallbackSummary,
}: DataLabDiscoveryWidgetProps) {
  const commandCenterHref = buildDataLabCommandCenterHref({ season });
  const priorities = data?.priorities.slice(0, 2) ?? [];
  const teamHighlights = data?.sections.teamEnvironments.items.slice(0, 2) ?? [];
  const breakoutHighlights = data?.sections.breakoutCandidates.items.slice(0, 2) ?? [];

  return (
    <div className="insight-card accent-left" data-testid="data-lab-discovery-widget">
      <div className="insight-header">
        <span className="insight-tag breakout">Data Lab</span>
        <span className="insight-time">Read only</span>
      </div>

      <div className="insight-title">Research worth opening from the normal flow</div>
      <div className="insight-body">
        {isLoading
          ? 'Loading the promoted research front door so you can jump into the strongest current player and team signals without opening the full lab first.'
          : data
          ? `${getCommandCenterStateLabel(data.state)}. Use these promoted summaries as lightweight discovery hooks into Player Research, Team Research, and the Command Center.`
          : fallbackSummary.topScorerName
          ? `${fallbackSummary.topScorerName} currently leads this board at ${fallbackSummary.topScorerPpg?.toFixed(1) ?? '—'} PPG. Open the Command Center to see promoted read-only player and team research starting points.`
          : 'Open the Command Center to find promoted read-only player and team research starting points.'}
      </div>
      <div className="insight-source">Source: Promoted Data Lab adapters · read-only framing</div>

      <div className="mt-4 space-y-3">
        {priorities.length > 0 ? (
          priorities.map((priority) => (
            <div key={priority.id} className="rounded-lg border border-[rgba(226,100,13,0.16)] bg-[rgba(226,100,13,0.05)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    {priority.moduleTitle}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{priority.title}</div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">{priority.reason}</div>
                </div>
                <a href={priority.primaryAction.href} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ember)] hover:opacity-80">
                  Open
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))
        ) : null}

        {priorities.length === 0 && breakoutHighlights.length > 0 ? (
          <div className="rounded-lg border border-[rgba(226,100,13,0.16)] bg-[rgba(226,100,13,0.05)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Top breakout candidates</div>
            <ul className="mt-2 space-y-1.5 text-sm text-[var(--text-secondary)]">
              {breakoutHighlights.map((item) => (
                <li key={`${item.playerId ?? item.playerName}-${item.team ?? 'na'}`}>
                  <a href={item.links.playerResearchHref} className="font-semibold text-[var(--text-primary)] hover:text-[var(--ember)]">{item.playerName}</a>
                  <span>{item.team ? ` · ${item.team}` : ''}</span>
                  <span>{item.finalSignalScore != null ? ` · score ${item.finalSignalScore.toFixed(1)}` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {teamHighlights.length > 0 ? (
          <div className="rounded-lg border border-[rgba(17,24,39,0.08)] bg-[rgba(17,24,39,0.03)] p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              <Compass className="h-3.5 w-3.5" />
              Teams worth deeper research
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-[var(--text-secondary)]">
              {teamHighlights.map((item) => (
                <li key={item.team}>
                  <a href={item.links.teamResearchHref} className="font-semibold text-[var(--text-primary)] hover:text-[var(--ember)]">{item.teamName}</a>
                  <span>{` · ${item.breakoutCandidateCount} breakout / ${item.rolePlayerCount} role / ${item.scenarioPlayerCount} scenario hooks`}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={commandCenterHref} className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1f2937]" data-testid="link-widget-command-center">
          <Microscope className="h-3.5 w-3.5" />
          Open Command Center
        </Link>
      </div>

      <div className="insight-metrics">
        <div>
          <div className="insight-metric-label">Players</div>
          <div className="insight-metric-value">{fallbackSummary.playersTracked}</div>
        </div>
        <div>
          <div className="insight-metric-label">Avg PPG</div>
          <div className="insight-metric-value" style={{ color: 'var(--ember)' }}>{fallbackSummary.avgPpg}</div>
        </div>
        <div>
          <div className="insight-metric-label">Elite</div>
          <div className="insight-metric-value">{fallbackSummary.t1Count}</div>
        </div>
      </div>
    </div>
  );
}
