import { Link } from 'wouter';
import { AlertTriangle, ArrowUpRight, CircleOff, FlaskConical, Layers3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buildTeamResearchHref, formatNumber, formatPercent, formatSignedNumber } from '@/lib/teamResearch';
import type { TeamResearchResponse } from '@/lib/teamResearch';

type TeamResearchSummaryItem = {
  label: string;
  value: string;
  note?: string;
};

interface TeamResearchSummaryBlockProps {
  season: string;
  team: string;
  data: TeamResearchResponse['data'] | null;
  isLoading?: boolean;
  errorMessage?: string | null;
}

function TeamResearchSummaryRow({ item }: { item: TeamResearchSummaryItem }) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-[#0f1420] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{item.value}</div>
      {item.note ? <p className="mt-2 text-xs leading-5 text-slate-400">{item.note}</p> : null}
    </div>
  );
}

function joinNames(names: string[], fallback = 'No named players'): string {
  const unique = Array.from(new Set(names.filter(Boolean)));
  if (!unique.length) {
    return fallback;
  }

  return unique.slice(0, 3).join(', ');
}

function buildSummaryItems(data: TeamResearchResponse['data'] | null): TeamResearchSummaryItem[] {
  if (!data?.selectedTeam) {
    return [];
  }

  const items: TeamResearchSummaryItem[] = [];
  const offensiveContext = data.sections.offensiveContext.summary;
  const roleOpportunity = data.sections.roleOpportunity.summary;
  const breakoutSignals = data.sections.breakoutSignals.summary;
  const pointScenarios = data.sections.pointScenarios.summary;
  const ageCurves = data.sections.ageCurves.summary;

  if (offensiveContext) {
    const contextParts = [
      offensiveContext.promotedPlayerCount > 0 ? `${offensiveContext.promotedPlayerCount} promoted players` : null,
      offensiveContext.breakoutCandidateCount > 0 ? `${offensiveContext.breakoutCandidateCount} breakout flags` : null,
      offensiveContext.positionsCovered.length ? offensiveContext.positionsCovered.join('/') : null,
    ].filter(Boolean);

    if (contextParts.length > 0) {
      items.push({
        label: 'Offensive environment',
        value: contextParts.join(' · '),
        note:
          offensiveContext.notes[0] ??
          (offensiveContext.topPlayers.length
            ? `Top promoted names: ${joinNames(offensiveContext.topPlayers)}.`
            : 'Promoted environment context surfaced from Team Research.'),
      });
    }
  }

  if (roleOpportunity) {
    const leadNames = joinNames(roleOpportunity.keyPlayers.map((player) => player.playerName), 'Role concentration view');
    const usageParts = [
      roleOpportunity.avgTargetShare != null ? `Avg target ${formatPercent(roleOpportunity.avgTargetShare)}` : null,
      roleOpportunity.avgRouteParticipation != null ? `Route ${formatPercent(roleOpportunity.avgRouteParticipation)}` : null,
      roleOpportunity.avgUsageRate != null ? `Usage ${formatPercent(roleOpportunity.avgUsageRate)}` : null,
    ].filter(Boolean);

    if (usageParts.length > 0 || roleOpportunity.playerCount > 0) {
      items.push({
        label: 'Role concentration',
        value: usageParts.length ? usageParts.join(' · ') : `${roleOpportunity.playerCount} promoted role rows`,
        note:
          roleOpportunity.keyPlayers.length > 0
            ? `Key role/opportunity names: ${leadNames}.`
            : `Promoted role/opportunity coverage for ${roleOpportunity.playerCount} roster spots.`,
      });
    }
  }

  if (breakoutSignals) {
    const breakoutNames = joinNames(breakoutSignals.players.map((player) => player.playerName), 'No breakout names listed');
    const breakoutParts = [
      breakoutSignals.candidateCount > 0 ? `${breakoutSignals.candidateCount} candidates` : null,
      breakoutSignals.topSignalScore != null ? `Top score ${formatNumber(breakoutSignals.topSignalScore, 1)}` : null,
      breakoutSignals.bestRecipeName ?? null,
    ].filter(Boolean);

    if (breakoutParts.length > 0) {
      items.push({
        label: 'Breakout watch',
        value: breakoutParts.join(' · '),
        note:
          breakoutSignals.players.length > 0
            ? `Notable roster names: ${breakoutNames}.`
            : 'Promoted breakout context is available from the Team Research workspace.',
      });
    }
  }

  if (pointScenarios) {
    const scenarioNames = joinNames(pointScenarios.players.map((player) => player.playerName), 'Scenario coverage available');
    const scenarioParts = [
      pointScenarios.totalScenarioCount > 0 ? `${pointScenarios.totalScenarioCount} scenarios` : null,
      pointScenarios.maxDelta != null ? `Max Δ ${formatSignedNumber(pointScenarios.maxDelta, 1)}` : null,
    ].filter(Boolean);

    if (scenarioParts.length > 0) {
      items.push({
        label: 'Scenario note',
        value: scenarioParts.join(' · '),
        note:
          pointScenarios.players.length > 0
            ? `Most affected promoted names: ${scenarioNames}.`
            : 'Optional scenario context surfaced from promoted Team Research outputs.',
      });
    }
  }

  if (ageCurves) {
    const developmentalNames = ageCurves.players
      .map((player) => [player.playerName, player.trajectoryLabel].filter(Boolean).join(' — '))
      .filter(Boolean);

    if (ageCurves.playerCount > 0 || developmentalNames.length > 0) {
      items.push({
        label: 'Developmental cue',
        value: ageCurves.playerCount > 0 ? `${ageCurves.playerCount} promoted ARC snapshots` : 'ARC context available',
        note:
          developmentalNames.length > 0
            ? developmentalNames.slice(0, 2).join(' · ')
            : 'Lightweight developmental context surfaced from promoted Team Research outputs.',
      });
    }
  }

  return items.slice(0, 5);
}

function getAvailabilityLabel(data: TeamResearchResponse['data'] | null): string {
  switch (data?.state) {
    case 'ready':
      return 'Promoted team research available';
    case 'partial':
      return 'Partial promoted coverage';
    case 'empty':
      return 'Research available in Data Lab';
    case 'error':
      return 'Research system unavailable';
    default:
      return 'Research available in Data Lab';
  }
}

export function TeamResearchSummaryBlock({
  season,
  team,
  data,
  isLoading = false,
  errorMessage = null,
}: TeamResearchSummaryBlockProps) {
  const teamResearchHref = buildTeamResearchHref({ season, team });
  const summaryItems = buildSummaryItems(data);
  const hasSummary = summaryItems.length > 0;
  const isUnavailable = Boolean(errorMessage) || data?.state === 'error';
  const teamLabel = data?.selectedTeam?.teamName ?? team;

  return (
    <section
      className="rounded-xl border border-violet-500/20 bg-[#141824] p-4 shadow-[0_0_0_1px_rgba(139,92,246,0.08)]"
      data-testid="team-research-summary"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-violet-500/15 text-violet-200 hover:bg-violet-500/15">Team Research Summary</Badge>
            <Badge variant="outline" className="border-slate-700 bg-transparent text-slate-300">Read only</Badge>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-[#0f1420] px-2.5 py-1 text-[11px] font-medium text-slate-300">
              <Layers3 className="h-3.5 w-3.5" />
              {getAvailabilityLabel(data)}
            </span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-white">Inline promoted team context</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Lightweight Team Research context for {teamLabel} from promoted Data Lab outputs only. This block stays read only and does not run new team scoring on the page.
          </p>
        </div>

        <Link
          href={teamResearchHref}
          className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/40 hover:bg-violet-500/15"
          data-testid="link-open-team-research"
        >
          Open Team Research
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 rounded-lg border border-slate-700/60 bg-[#0f1420] px-3 py-3 text-sm text-slate-400">
          Loading promoted team summary…
        </div>
      ) : null}

      {!isLoading && isUnavailable ? (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-100" data-testid="team-research-summary-unavailable">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <div className="font-semibold">Research system unavailable</div>
              <p className="mt-1 text-red-100/85">
                {errorMessage ?? data?.warnings[0] ?? 'Promoted Team Research could not be loaded right now. You can retry from the full Data Lab workspace.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!isLoading && !isUnavailable && hasSummary ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {summaryItems.map((item) => (
            <TeamResearchSummaryRow key={`${item.label}-${item.value}`} item={item} />
          ))}
        </div>
      ) : null}

      {!isLoading && !isUnavailable && !hasSummary ? (
        <div className="mt-4 rounded-lg border border-slate-700/60 bg-[#0f1420] px-3 py-3 text-sm text-slate-300" data-testid="team-research-summary-empty">
          <div className="flex items-start gap-2">
            <CircleOff className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
            <div>
              <div className="font-semibold text-white">Research available in Data Lab</div>
              <p className="mt-1 text-slate-400">
                No promoted summary rows are available on this page yet for {teamLabel}. Open Team Research for the fuller read-only workspace.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!isLoading && !isUnavailable && data?.warnings.length ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs text-amber-100/90">
          <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{data.warnings[0]}</span>
        </div>
      ) : null}
    </section>
  );
}
