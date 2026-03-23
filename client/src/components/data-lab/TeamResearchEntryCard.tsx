import { Link } from 'wouter';
import { ArrowUpRight, Layers3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buildTeamResearchHref } from '@/lib/teamResearch';

interface TeamResearchEntryCardProps {
  season: string;
  team?: string | null;
}

export function TeamResearchEntryCard({ season, team = null }: TeamResearchEntryCardProps) {
  const href = buildTeamResearchHref({ season, team: team ?? undefined });

  return (
    <section
      className="rounded-xl border border-violet-500/20 bg-[#141824] p-4 shadow-[0_0_0_1px_rgba(139,92,246,0.08)]"
      data-testid="team-research-entry-card"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-violet-500/15 text-violet-200 hover:bg-violet-500/15">Team Research</Badge>
            <Badge variant="outline" className="border-slate-700 bg-transparent text-slate-300">Read only</Badge>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-[#0f1420] px-2.5 py-1 text-[11px] font-medium text-slate-300">
              <Layers3 className="h-3.5 w-3.5" />
              Promoted Data Lab context
            </span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-white">Inline team research is available here</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {team
              ? `Open the fuller Team Research Workspace for ${team} or keep using this page for the lighter inline summary.`
              : 'Select a team above to surface a compact promoted summary here, or jump straight into the full Team Research Workspace.'}
          </p>
        </div>

        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/40 hover:bg-violet-500/15"
          data-testid="link-team-research-entry"
        >
          {team ? `Open ${team} Team Research` : 'Open Team Research'}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
