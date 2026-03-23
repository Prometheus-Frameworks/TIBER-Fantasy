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
  const hasCarryContext = Boolean(playerContext?.playerId || playerContext?.playerName);

  return (
    <div className="rounded-xl border border-gray-200 bg-[#fafafa] p-4 md:p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{heading}</div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-0 bg-gray-900 text-white">Promoted module system</Badge>
          <Badge variant="secondary" className="border-0 bg-gray-100 text-gray-600">Read only</Badge>
          {hasCarryContext ? (
            <Badge variant="secondary" className="border-0 bg-white text-gray-700">
              Carrying {playerContext?.playerName ?? playerContext?.playerId}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {relatedModules.map((module) => (
          <Link
            key={module.id}
            href={buildPromotedModuleHref(module.id, playerContext ?? undefined)}
            className="group rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">{module.title}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-gray-400">{module.subtitle}</div>
              </div>
              <ArrowUpRight className="mt-0.5 h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-600" />
            </div>
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              <p><span className="font-semibold text-gray-700">What it is for:</span> {module.whatItIsFor}</p>
              <p><span className="font-semibold text-gray-700">When to use:</span> {module.whenToUse}</p>
              <p><span className="font-semibold text-gray-700">Dependency:</span> {module.dependencySummary}</p>
            </div>
            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{buildPromotedModuleNavigationLabel(module.id)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
