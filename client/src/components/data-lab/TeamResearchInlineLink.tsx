import { Link } from 'wouter';
import { ArrowUpRight } from 'lucide-react';
import { buildTeamResearchHref } from '@/lib/teamResearch';

interface TeamResearchInlineLinkProps {
  season: string;
  team: string;
  compact?: boolean;
}

export function TeamResearchInlineLink({ season, team, compact = false }: TeamResearchInlineLinkProps) {
  const href = buildTeamResearchHref({ season, team });

  return (
    <Link
      href={href}
      className={compact
        ? 'inline-flex items-center gap-1 text-[10px] font-semibold text-violet-300 transition-colors hover:text-violet-200 sm:text-xs'
        : 'inline-flex items-center gap-1 text-xs font-semibold text-violet-300 transition-colors hover:text-violet-200'}
      data-testid={`link-team-research-${team}`}
    >
      Research
      <ArrowUpRight className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
    </Link>
  );
}
