import { Fragment, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ChevronDown, ChevronUp, FlaskConical, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BREAKOUT_SIGNAL_COLUMNS,
  BreakoutRecipeSummary,
  BreakoutSignalRow,
  formatSignalValue,
  buildBestRecipeBadge,
} from '@/lib/breakoutSignals';

interface BreakoutSignalsViewProps {
  season: string;
  availableSeasons: number[];
  rows: BreakoutSignalRow[];
  bestRecipeSummary: BreakoutRecipeSummary | null;
  isLoading: boolean;
  errorMessage?: string | null;
  onSeasonChange: (season: string) => void;
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</div>
      <div className="mt-1 text-sm text-gray-700 break-words">{value ?? '—'}</div>
    </div>
  );
}

function BestRecipeCard({ summary }: { summary: BreakoutRecipeSummary }) {
  const badgeLines = buildBestRecipeBadge(summary);

  return (
    <Card className="border border-[#e2640d]/20 bg-gradient-to-r from-[#fff7f1] to-white shadow-sm">
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-[#e2640d] text-white">Best Recipe</Badge>
            {badgeLines.slice(1).map((line) => (
              <Badge key={line} variant="secondary" className="border-0 bg-[#e2640d]/10 text-[#e2640d]">
                {line}
              </Badge>
            ))}
          </div>
          <div className="text-lg font-semibold text-gray-900">{summary.bestRecipeName}</div>
          <div className="mt-1 text-sm text-gray-500">
            {summary.summary ?? 'Signal-Validation-Model promoted this recipe as the current WR breakout leader.'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm md:min-w-[220px]">
          <div className="rounded-md bg-[#fafafa] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Season</div>
            <div className="mt-1 font-mono text-gray-700">{summary.season ?? '—'}</div>
          </div>
          <div className="rounded-md bg-[#fafafa] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Candidates</div>
            <div className="mt-1 font-mono text-gray-700">{summary.candidateCount ?? '—'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-[#fafafa] px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
        <FlaskConical className="h-5 w-5 text-[#e2640d]" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-gray-900">WR Breakout Lab unavailable</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-gray-500">{message}</p>
    </div>
  );
}

export function BreakoutSignalsView({
  season,
  availableSeasons,
  rows,
  bestRecipeSummary,
  isLoading,
  errorMessage,
  onSeasonChange,
}: BreakoutSignalsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter((row) => {
      const combined = [row.playerName, row.team ?? '', row.bestRecipeName ?? '', row.breakoutLabelDefault ?? '']
        .join(' ')
        .toLowerCase();
      return combined.includes(query);
    });
  }, [rows, searchQuery]);

  return (
    <div className="max-w-[1460px] mx-auto px-6 py-8 bg-white min-h-screen">
      <div className="mb-6">
        <Link href="/tiber-data-lab" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#e2640d] transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Data Lab
        </Link>

        <div className="flex flex-wrap items-center gap-3 mb-1">
          <FlaskConical className="h-6 w-6 text-[#e2640d]" />
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
            WR Breakout Lab
          </h1>
          <Badge className="border-0 bg-[#e2640d]/10 text-[#e2640d]">Signal Validation</Badge>
          <Badge variant="secondary" className="border-0 bg-gray-100 text-gray-600">Read only</Badge>
        </div>
        <p className="max-w-3xl text-sm text-gray-500">
          Promoted Signal-Validation-Model outputs rendered inside TIBER Data Lab. TIBER is displaying exported signal cards and recipe context, not recomputing scores.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={season} onValueChange={onSeasonChange}>
            <SelectTrigger className="w-[120px] bg-[#f4f4f4] border-gray-200">
              <SelectValue placeholder="Season" />
            </SelectTrigger>
            <SelectContent>
              {availableSeasons.map((availableSeason) => (
                <SelectItem key={availableSeason} value={String(availableSeason)}>
                  {availableSeason}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="rounded-md border border-gray-200 bg-[#fafafa] px-3 py-2 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">Model contract:</span> Signal-Validation-Model export → TIBER adapter → Data Lab table
          </div>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search player, team, recipe..."
            className="w-full rounded-md border border-gray-200 bg-[#f4f4f4] py-2 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#e2640d]/30"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-[420px] w-full rounded-xl" />
        </div>
      ) : errorMessage ? (
        <EmptyState message={errorMessage} />
      ) : !bestRecipeSummary ? (
        <EmptyState message="The export loaded without a usable best-recipe summary, so TIBER is holding the module back." />
      ) : rows.length === 0 ? (
        <EmptyState message="The selected export is valid, but it currently contains no WR candidates to display." />
      ) : (
        <div className="space-y-4">
          <BestRecipeCard summary={bestRecipeSummary} />

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#fafafa]">
                  <tr>
                    {BREAKOUT_SIGNAL_COLUMNS.map((column) => (
                      <th
                        key={column.key}
                        className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500"
                      >
                        {column.label}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Detail
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredRows.map((row) => {
                    const detailKey = row.playerId ?? row.playerName;
                    const isExpanded = expandedPlayer === detailKey;
                    return (
                      <Fragment key={detailKey}>
                        <tr key={detailKey} className="align-top hover:bg-[#fffaf6]">
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{row.candidateRank ?? '—'}</td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-gray-900">{row.playerName}</div>
                            <div className="text-xs text-gray-400">{row.team ?? '—'} · {row.season ?? '—'}</div>
                          </td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.finalSignalScore)}</td>
                          <td className="px-3 py-3 text-sm text-gray-700">{row.bestRecipeName ?? '—'}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.usage)}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.efficiency)}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.development)}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.stability)}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.cohort)}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.role)}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.penalty)}</td>
                          <td className="px-3 py-3 text-sm text-gray-700">
                            <div>{row.breakoutLabelDefault ?? '—'}</div>
                            {row.breakoutContext && (
                              <div className="mt-1 max-w-xs text-xs text-gray-400">{row.breakoutContext}</div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:border-[#e2640d]/40 hover:text-[#e2640d]"
                              onClick={() => setExpandedPlayer(isExpanded ? null : detailKey)}
                            >
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              Fields
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${detailKey}-details`} className="bg-[#fcfcfc]">
                            <td colSpan={BREAKOUT_SIGNAL_COLUMNS.length + 1} className="px-4 py-4">
                              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Full signal card fields</div>
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                {Object.entries(row.rawFields).map(([field, value]) => (
                                  <DetailField key={field} label={field} value={value} />
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 bg-[#fafafa] px-4 py-3 text-xs text-gray-500">
              Showing {filteredRows.length} of {rows.length} exported WR signal cards.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
