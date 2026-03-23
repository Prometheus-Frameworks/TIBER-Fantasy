import { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface PromotedModuleStateCardProps {
  icon: LucideIcon;
  accentClassName: string;
  accentTextClassName: string;
  title: string;
  message: string;
  hints?: string[];
  mode: 'loading' | 'empty' | 'error';
}

export function PromotedModuleStateCard({
  icon: Icon,
  accentClassName,
  accentTextClassName,
  title,
  message,
  hints = [],
  mode,
}: PromotedModuleStateCardProps) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-[#fafafa] px-6 py-10 text-center">
      <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ${accentClassName}`}>
        <Icon className={`h-5 w-5 ${accentTextClassName}`} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Badge className="border-0 bg-gray-900 text-white">Promoted module system</Badge>
        <Badge variant="secondary" className="border-0 bg-gray-100 text-gray-600">
          Read-only model surface
        </Badge>
        <Badge variant="secondary" className="border-0 bg-white text-gray-600">
          {mode === 'loading' ? 'Loading state' : mode === 'error' ? 'Operator-visible issue' : 'Empty state'}
        </Badge>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-gray-500">{message}</p>
      {mode === 'loading' ? (
        <div className="mx-auto mt-5 max-w-3xl space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}
      {hints.length > 0 ? (
        <div className="mx-auto mt-5 max-w-2xl rounded-lg border border-gray-200 bg-white p-4 text-left">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            Operator hints
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
            {hints.map((hint) => (
              <li key={hint} className="flex gap-2">
                <span className={`mt-[7px] h-1.5 w-1.5 rounded-full ${accentClassName}`} aria-hidden />
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
