import { ArrowUpRight, Microscope, Radar } from 'lucide-react';
import { Link } from 'wouter';
import { buildDataLabCommandCenterHref } from '@/lib/dataLabCommandCenter';
import { buildPlayerResearchHref } from '@/lib/playerResearch';
import { buildTeamResearchHref } from '@/lib/teamResearch';

interface CoreResearchQuickLinksProps {
  season: string;
  playerId?: string | null;
  playerName?: string | null;
  team?: string | null;
  showCommandCenter?: boolean;
  compact?: boolean;
  className?: string;
}

function linkClassName(compact: boolean) {
  return compact
    ? 'inline-flex items-center gap-1 rounded-full border border-gray-700/70 bg-gray-900/60 px-2 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-[#e2640d]/60 hover:text-white'
    : 'inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-[#e2640d]/50 hover:text-gray-900';
}

export function CoreResearchQuickLinks({
  season,
  playerId,
  playerName,
  team,
  showCommandCenter = false,
  compact = false,
  className = '',
}: CoreResearchQuickLinksProps) {
  const playerHref = playerId
    ? buildPlayerResearchHref({ season, playerId, playerName: playerName ?? undefined })
    : null;
  const teamHref = team
    ? buildTeamResearchHref({ season, team })
    : null;
  const commandCenterHref = buildDataLabCommandCenterHref({ season });

  if (!playerHref && !teamHref && !showCommandCenter) {
    return null;
  }

  return (
    <div className={className} data-testid="core-research-quick-links">
      <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'mt-3'}`}>
        <span className={`inline-flex items-center gap-1 ${compact ? 'text-[10px]' : 'text-[11px]'} font-semibold uppercase tracking-[0.18em] text-gray-500`}>
          <Microscope className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          Research
        </span>

        {playerHref ? (
          <Link href={playerHref} className={linkClassName(compact)} data-testid="link-player-research">
            Player Research
            <ArrowUpRight className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </Link>
        ) : null}

        {teamHref ? (
          <Link href={teamHref} className={linkClassName(compact)} data-testid="link-team-research">
            Team Research
            <ArrowUpRight className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </Link>
        ) : null}

        {showCommandCenter ? (
          <Link href={commandCenterHref} className={linkClassName(compact)} data-testid="link-command-center">
            <Radar className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            Command Center
          </Link>
        ) : null}
      </div>
      <p className={`mt-2 ${compact ? 'text-[11px]' : 'text-xs'} text-gray-500`}>
        Promoted Data Lab outputs only — read-only discovery links, no rescoring.
      </p>
    </div>
  );
}
