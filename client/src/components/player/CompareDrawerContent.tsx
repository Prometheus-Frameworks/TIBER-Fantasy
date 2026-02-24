import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { computePulse, computeTrendDeltas, getTopDrivers, formatWeekRange, getDeltaArrow, getPulseColor, type WeekData } from '@/lib/pulseUtils';

export interface CompareTarget {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
}

interface CompareDrawerContentProps {
  basePlayer: { playerId: string; name: string; team: string; position: string };
  comparePlayer: CompareTarget;
  season: number;
  week: number;
  mode: 'weekly' | 'season';
}

interface ForgeEgResponse {
  success: boolean;
  score?: {
    alpha: number;
    tier: string;
    pillars: {
      volume: number;
      efficiency: number;
      teamContext: number;
      stability: number;
    };
  };
  reason?: string;
}

interface CompareWeekSeriesResponse {
  success: boolean;
  data?: {
    weeks: Array<{
      week: number;
      missing: boolean;
      snapPct: number | null;
      routes: number | null;
      targets: number | null;
      carries: number | null;
      airYards: number | null;
    }>;
  };
}

export default function CompareDrawerContent({ basePlayer, comparePlayer, season, week, mode }: CompareDrawerContentProps) {
  const forgeMode = mode === 'season' ? 'dynasty' : 'redraft';
  const [showTrends, setShowTrends] = useState(true);

  const { data: baseForge, isLoading: baseLoading } = useQuery<ForgeEgResponse>({
    queryKey: ['/api/forge/eg/player', basePlayer.playerId, basePlayer.position, forgeMode],
    queryFn: async () => {
      const res = await fetch(`/api/forge/eg/player/${basePlayer.playerId}?position=${basePlayer.position}&mode=${forgeMode}`);
      if (!res.ok) return { success: false, reason: 'Failed to load' };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: compareForge, isLoading: compareLoading } = useQuery<ForgeEgResponse>({
    queryKey: ['/api/forge/eg/player', comparePlayer.playerId, comparePlayer.position, forgeMode],
    queryFn: async () => {
      const res = await fetch(`/api/forge/eg/player/${comparePlayer.playerId}?position=${comparePlayer.position}&mode=${forgeMode}`);
      if (!res.ok) return { success: false, reason: 'Failed to load' };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: baseWeekSeries, isLoading: baseWeeksLoading } = useQuery<CompareWeekSeriesResponse>({
    queryKey: ['/api/player-identity/player', basePlayer.playerId, 'week-series', season],
    queryFn: async () => {
      const res = await fetch(`/api/player-identity/player/${basePlayer.playerId}/week-series?season=${season}&metricSet=usage`);
      if (!res.ok) return { success: false };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: compareWeekSeries, isLoading: compareWeeksLoading } = useQuery<CompareWeekSeriesResponse>({
    queryKey: ['/api/player-identity/player', comparePlayer.playerId, 'week-series', season],
    queryFn: async () => {
      const res = await fetch(`/api/player-identity/player/${comparePlayer.playerId}/week-series?season=${season}&metricSet=usage`);
      if (!res.ok) return { success: false };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = baseLoading || compareLoading;

  const metrics = [
    { key: 'alpha', label: 'Alpha Score', format: (v: number) => v.toFixed(0) },
    { key: 'volume', label: 'Volume', format: (v: number) => v.toFixed(0), pillar: true },
    { key: 'efficiency', label: 'Efficiency', format: (v: number) => v.toFixed(0), pillar: true },
    { key: 'teamContext', label: 'Team Context', format: (v: number) => v.toFixed(0), pillar: true },
    { key: 'stability', label: 'Stability', format: (v: number) => v.toFixed(0), pillar: true },
  ];

  const getValue = (data: ForgeEgResponse | undefined, key: string, isPillar: boolean) => {
    if (!data?.success || !data.score) return null;
    if (isPillar) return (data.score.pillars as Record<string, number>)[key] ?? null;
    if (key === 'alpha') return data.score.alpha;
    return null;
  };

  const getDiff = (base: number | null, comp: number | null) => {
    if (base === null || comp === null) return null;
    return base - comp;
  };

  return (
    <div className="p-4 space-y-4">
      {/* Player Headers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Base Player</p>
          <p className="text-sm font-semibold text-white">{basePlayer.name}</p>
          <p className="text-[10px] text-gray-500">{basePlayer.team} · {basePlayer.position}</p>
        </div>
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Compare To</p>
          <p className="text-sm font-semibold text-white">{comparePlayer.playerName}</p>
          <p className="text-[10px] text-gray-500">{comparePlayer.team} · {comparePlayer.position}</p>
        </div>
      </div>

      {/* Tier Comparison */}
      {!isLoading && baseForge?.score && compareForge?.score && (
        <div className="flex justify-center gap-8 py-2 border-y border-gray-800/50">
          <div className="text-center">
            <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
              {baseForge.score.tier}
            </Badge>
          </div>
          <div className="text-xs text-gray-500 self-center">vs</div>
          <div className="text-center">
            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
              {compareForge.score.tier}
            </Badge>
          </div>
        </div>
      )}

      {/* Metrics Table */}
      <div className="bg-[#141824] rounded-lg overflow-hidden border border-gray-800/50">
        <div className="grid grid-cols-4 text-xs font-medium text-gray-400 bg-gray-800/30 p-2">
          <div>Metric</div>
          <div className="text-center text-purple-400">{basePlayer.name.split(' ')[1] || 'Base'}</div>
          <div className="text-center text-cyan-400">{comparePlayer.playerName.split(' ')[1] || 'Comp'}</div>
          <div className="text-center">Diff</div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full bg-gray-800/50" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-800/30">
            {metrics.map(({ key, label, format, pillar }) => {
              const baseVal = getValue(baseForge, key, !!pillar);
              const compVal = getValue(compareForge, key, !!pillar);
              const diff = getDiff(baseVal, compVal);

              return (
                <div key={key} className="grid grid-cols-4 text-sm p-2 items-center">
                  <div className="text-gray-400 text-xs">{label}</div>
                  <div className="text-center text-white font-mono">
                    {baseVal !== null ? format(baseVal) : '-'}
                  </div>
                  <div className="text-center text-white font-mono">
                    {compVal !== null ? format(compVal) : '-'}
                  </div>
                  <div className={`text-center font-mono text-xs ${
                    diff === null ? 'text-gray-500' : diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {diff !== null ? (diff > 0 ? '+' : '') + diff.toFixed(0) : '-'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trends Section */}
      <div className="bg-[#141824] rounded-lg overflow-hidden border border-gray-800/50">
        <button
          onClick={() => setShowTrends(!showTrends)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-800/20 transition-colors"
          data-testid="button-toggle-trends"
        >
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-purple-400" />
            <span className="text-sm font-medium text-white">Trends</span>
            <span className="text-xs text-gray-500">3W Pulse + Deltas</span>
          </div>
          {showTrends ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>

        {showTrends && (
          <div className="px-3 pb-3 space-y-3">
            {(baseWeeksLoading || compareWeeksLoading) ? (
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-20 w-full bg-gray-800/50" />
                <Skeleton className="h-20 w-full bg-gray-800/50" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { player: basePlayer, weeks: baseWeekSeries?.data?.weeks || [], color: 'purple' },
                  { player: { playerId: comparePlayer.playerId, name: comparePlayer.playerName, position: comparePlayer.position, team: comparePlayer.team }, weeks: compareWeekSeries?.data?.weeks || [], color: 'cyan' }
                ].map(({ player, weeks, color }) => {
                  const weekData = weeks as WeekData[];
                  const pulse = computePulse(weekData, player.position, week);
                  const deltas = computeTrendDeltas(weekData, player.position, week);
                  const drivers = pulse.status === 'success' ? getTopDrivers(pulse.components) : [];

                  const pulseTooltip = pulse.status === 'success'
                    ? `${formatWeekRange(pulse.windowAWeeks)} vs ${formatWeekRange(pulse.windowBWeeks)}\nScore: ${pulse.pulseScore.toFixed(2)}${pulse.fallbackNote ? '\n' + pulse.fallbackNote : ''}`
                    : pulse.status === 'not_enough_weeks' ? 'Need 6+ non-missing weeks' : 'Insufficient metric data';

                  const driversTooltip = drivers.map(d => {
                    const sign = d.delta >= 0 ? '+' : '';
                    return `${d.name}: Δ ${sign}${d.delta.toFixed(1)} (contrib=${d.contribution >= 0 ? '+' : ''}${d.contribution.toFixed(2)})`;
                  }).join('\n') + (pulse.fallbackNote ? '\n' + pulse.fallbackNote : '');

                  const borderColor = color === 'purple' ? 'border-purple-500/30' : 'border-cyan-500/30';
                  const bgColor = color === 'purple' ? 'bg-purple-500/5' : 'bg-cyan-500/5';

                  return (
                    <div key={player.playerId} className={`${bgColor} ${borderColor} border rounded-lg p-2 space-y-2`}>
                      <div className="text-[10px] text-gray-400 text-center truncate">{player.name.split(' ')[1] || player.name}</div>

                      {/* Pulse */}
                      <div className="text-center" title={pulseTooltip}>
                        {pulse.status === 'success' ? (
                          <div className="flex items-center justify-center gap-1">
                            {pulse.classification === 'Up' && <TrendingUp size={12} className="text-green-400" />}
                            {pulse.classification === 'Down' && <TrendingDown size={12} className="text-red-400" />}
                            {pulse.classification === 'Flat' && <span className="text-gray-400 text-xs">→</span>}
                            <span className={`text-xs font-semibold ${getPulseColor(pulse.classification)}`}>{pulse.classification}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </div>

                      {/* Drivers */}
                      {drivers.length > 0 && (
                        <div className="text-[9px] text-gray-500 text-center font-mono" title={driversTooltip}>
                          {drivers.map((d, idx) => {
                            const { arrow, color: arrowColor } = getDeltaArrow(d.delta);
                            return (
                              <span key={d.name}>
                                {idx > 0 && ', '}
                                <span className="text-gray-400">{d.name}</span>
                                <span className={arrowColor}>{arrow}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Trend Deltas */}
                      {deltas.status === 'success' && deltas.priorWeek && (
                        <div className="text-[9px] text-gray-600 text-center" title={`Wk${deltas.priorWeek} → Wk${deltas.currentWeek}${deltas.fallbackNote ? '\n' + deltas.fallbackNote : ''}`}>
                          {deltas.deltas.slice(0, 3).map((d, idx) => {
                            const { color: deltaColor } = getDeltaArrow(d.value);
                            return (
                              <span key={d.metric}>
                                {idx > 0 && ' · '}
                                <span className="text-gray-500">{d.metric === 'Snap%' ? 'Sn' : d.metric.slice(0, 3)}</span>
                                <span className={deltaColor}>{d.display}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Note */}
      <p className="text-[10px] text-gray-600 text-center">
        {forgeMode.charAt(0).toUpperCase() + forgeMode.slice(1)} mode • Season {season}
      </p>
    </div>
  );
}
