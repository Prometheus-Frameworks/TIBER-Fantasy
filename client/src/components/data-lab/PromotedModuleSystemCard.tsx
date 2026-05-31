import { Link } from 'wouter';
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DataLabPlayerCarryContext,
  PROMOTED_DATA_LAB_MODULES,
  PromotedDataLabModuleDefinition,
  buildPromotedModuleNavigationLabel,
  buildPromotedModuleHref,
} from '@/lib/dataLabPromotedModules';

interface PromotedModuleSystemCardProps {
  currentModuleId: PromotedDataLabModuleDefinition['id'];
  playerContext?: DataLabPlayerCarryContext | null;
  heading?: string;
  description?: string;
}

export function PromotedModuleSystemCard({
  currentModuleId,
  playerContext,
  heading = 'Use alongside',
  description = 'Jump between the promoted Data Lab modules to layer breakout, role, and developmental context without leaving the product system.',
}: PromotedModuleSystemCardProps) {
  const relatedModules = PROMOTED_DATA_LAB_MODULES.filter((module) => module.id !== currentModuleId);
  const carryLabel = playerContext?.playerName ?? playerContext?.playerId ?? playerContext?.team ?? null;
  const hasCarryContext = Boolean(carryLabel);

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-4 md:p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{heading}</div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-0 bg-slate-700 text-slate-200">Promoted module system</Badge>
          <Badge variant="secondary" className="border-0 bg-slate-700/60 text-slate-400">Read only</Badge>
          {hasCarryContext ? (
            <Badge variant="secondary" className="border-0 bg-slate-800 text-slate-400">
              Carrying {carryLabel}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {relatedModules.map((module) => (
          <Link
            key={module.id}
            href={buildPromotedModuleHref(module.id, playerContext ?? undefined)}
            className="group rounded-xl border border-slate-700/40 bg-slate-800/60 p-4 transition-all hover:border-slate-600 hover:bg-slate-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">{module.title}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{module.subtitle}</div>
              </div>
              <ArrowUpRight className="mt-0.5 h-4 w-4 text-slate-600 transition-colors group-hover:text-[#e2640d]" />
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              <p><span className="font-semibold text-slate-300">What it is for:</span> {module.whatItIsFor}</p>
              <p><span className="font-semibold text-slate-300">When to use:</span> {module.whenToUse}</p>
              <p><span className="font-semibold text-slate-300">Dependency:</span> {module.dependencySummary}</p>
            </div>
            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{buildPromotedModuleNavigationLabel(module.id)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
