import { Link } from 'wouter';
import { AlertTriangle, ArrowUpRight, CircleOff, FlaskConical, Layers3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buildPlayerResearchHref, formatNumber, formatSignedNumber } from '@/lib/playerResearch';
import type { PlayerResearchResponse } from '@/lib/playerResearch';

type ResearchSummaryItem = {
  label: string;
  value: string;
  note?: string;
};

interface PlayerResearchSummaryBlockProps {
  season: string;
  playerId: string;
  playerName: string;
  data: PlayerResearchResponse['data'] | null;
  isLoading?: boolean;
  errorMessage?: string | null;
}

function ResearchSummaryRow({ item }: { item: ResearchSummaryItem }) {
  return (
    <div className="rounded-lg border border-gray-800/60 bg-[#0f1420] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{item.label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{item.value}</div>
      {item.note ? <p className="mt-2 text-xs leading-5 text-gray-400">{item.note}</p> : null}
    </div>
  );
}

function buildSummaryItems(data: PlayerResearchResponse['data'] | null): ResearchSummaryItem[] {
  if (!data?.selectedPlayer) {
    return [];
  }

  const items: ResearchSummaryItem[] = [];
  const breakout = data.sections.breakoutSignals.summary;
  const role = data.sections.roleOpportunity.summary;
  const ageCurve = data.sections.ageCurves.summary;
  const pointScenarios = data.sections.pointScenarios.summary;

  if (breakout) {
    const breakoutParts = [
      breakout.candidateRank != null ? `Rank #${breakout.candidateRank}` : null,
      breakout.finalSignalScore != null ? `Score ${formatNumber(breakout.finalSignalScore, 1)}` : null,
      breakout.breakoutLabel ?? null,
    ].filter(Boolean);

    if (breakoutParts.length > 0) {
      items.push({
        label: 'Breakout signal',
        value: breakoutParts.join(' · '),
        note: breakout.breakoutContext ?? 'Promoted breakout output surfaced from Data Lab.',
      });
    }

    if (breakout.bestRecipeName) {
      items.push({
        label: 'Best recipe',
        value: breakout.bestRecipeName,
        note: 'Read-only recipe framing from the promoted breakout model.',
      });
    }
  }

  if (role) {
    items.push({
      label: 'Role & opportunity',
      value: role.primaryRole,
      note: role.insights[0] ?? 'Promoted role-opportunity summary from Player Research.',
    });
  }

  if (ageCurve) {
    const ageParts = [
      ageCurve.trajectoryLabel ?? null,
      ageCurve.ppgDelta != null ? `Δ ${formatSignedNumber(ageCurve.ppgDelta, 1)} PPG` : null,
    ].filter(Boolean);

    if (ageParts.length > 0) {
      items.push({
        label: 'Age-curve outlook',
        value: ageParts.join(' · '),
        note:
          ageCurve.expectedPpg != null || ageCurve.actualPpg != null
            ? `Expected ${formatNumber(ageCurve.expectedPpg, 1)} vs actual ${formatNumber(ageCurve.actualPpg, 1)} PPG.`
            : 'Promoted ARC summary from Data Lab.',
      });
    }
  }

  if (pointScenarios) {
    const scenarioParts = [
      pointScenarios.delta != null ? `Δ ${formatSignedNumber(pointScenarios.delta, 1)}` : null,
      pointScenarios.confidenceLabel ?? pointScenarios.confidenceBand ?? null,
      pointScenarios.topScenarioNames[0] ?? null,
    ].filter(Boolean);

    if (scenarioParts.length > 0) {
      items.push({
        label: 'Point scenario',
        value: scenarioParts.join(' · '),
        note: pointScenarios.notes[0] ?? 'Promoted scenario summary from Data Lab.',
      });
    }
  }

  return items.slice(0, 5);
}

function getAvailabilityLabel(data: PlayerResearchResponse['data'] | null): string {
  switch (data?.state) {
    case 'ready':
      return 'Promoted research available';
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

export function PlayerResearchSummaryBlock({
  season,
  playerId,
  playerName,
  data,
  isLoading = false,
  errorMessage = null,
}: PlayerResearchSummaryBlockProps) {
  const playerResearchHref = buildPlayerResearchHref({ season, playerId, playerName });
  const summaryItems = buildSummaryItems(data);
  const hasSummary = summaryItems.length > 0;
  const isUnavailable = Boolean(errorMessage) || data?.state === 'error';

  return (
    <section
      className="rounded-xl border border-violet-500/20 bg-[#141824] p-4 shadow-[0_0_0_1px_rgba(139,92,246,0.08)]"
      data-testid="player-research-summary"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-violet-500/15 text-violet-200 hover:bg-violet-500/15">Research Summary</Badge>
            <Badge variant="outline" className="border-gray-700 bg-transparent text-gray-300">Read only</Badge>
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-[#0f1420] px-2.5 py-1 text-[11px] font-medium text-gray-300">
              <Layers3 className="h-3.5 w-3.5" />
              {getAvailabilityLabel(data)}
            </span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-white">Inline promoted research</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            Lightweight Player Research context from promoted Data Lab outputs only. This block does not run new scoring on the player page.
          </p>
        </div>

        <Link
          href={playerResearchHref}
          className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/40 hover:bg-violet-500/15"
          data-testid="link-open-player-research"
        >
          Open Player Research
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 rounded-lg border border-gray-800/60 bg-[#0f1420] px-3 py-3 text-sm text-gray-400">
          Loading promoted research summary…
        </div>
      ) : null}

      {!isLoading && isUnavailable ? (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-100" data-testid="player-research-summary-unavailable">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <div className="font-semibold">Research system unavailable</div>
              <p className="mt-1 text-red-100/85">
                {errorMessage ?? data?.warnings[0] ?? 'Promoted Player Research could not be loaded right now. You can retry from the full Data Lab workspace.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!isLoading && !isUnavailable && hasSummary ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summaryItems.map((item) => (
            <ResearchSummaryRow key={`${item.label}-${item.value}`} item={item} />
          ))}
        </div>
      ) : null}

      {!isLoading && !isUnavailable && !hasSummary ? (
        <div className="mt-4 rounded-lg border border-gray-800/60 bg-[#0f1420] px-3 py-3 text-sm text-gray-300" data-testid="player-research-summary-empty">
          <div className="flex items-start gap-2">
            <CircleOff className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
            <div>
              <div className="font-semibold text-white">Research available in Data Lab</div>
              <p className="mt-1 text-gray-400">
                No promoted summary rows are available on this page yet for {playerName}. Open Player Research for the fuller read-only workspace.
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
