import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

type Position = 'QB' | 'RB' | 'WR' | 'TE';

function num(v: unknown, digits = 1): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return v.toFixed(digits);
}

function catalystColor(alpha: number): string {
  if (alpha >= 65) return 'text-emerald-700';
  if (alpha >= 45) return 'text-gray-800';
  return 'text-red-600';
}

function catalystBg(alpha: number): string {
  if (alpha >= 65) return 'bg-emerald-100 text-emerald-800';
  if (alpha >= 45) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-700';
}

function barWidth(value: number, max: number): string {
  return `${Math.min(100, Math.max(0, (value / max) * 100))}%`;
}

interface CatalystPlayer {
  gsis_id: string;
  player_name: string;
  position: string;
  team: string;
  catalyst_raw: number;
  catalyst_alpha: number;
  components: {
    leverage_factor: number;
    opponent_factor: number;
    script_factor: number;
    recency_factor: number;
    base_epa_sum: number;
    weighted_epa_sum: number;
    play_count: number;
    avg_leverage: number;
  };
}

interface CatalystPlayerDetail extends CatalystPlayer {
  season: number;
  weekly: {
    week: number;
    catalyst_raw: number;
    catalyst_alpha: number;
    components: CatalystPlayer['components'];
  }[];
}

type SortKey = 'alpha' | 'raw' | 'plays' | 'leverage' | 'opponent' | 'script' | 'name';

export default function CatalystLab() {
  const [position, setPosition] = useState<Position>('QB');
  const [season] = useState(2024);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('alpha');
  const [sortAsc, setSortAsc] = useState(false);

  const batchQuery = useQuery<{ players: CatalystPlayer[] }>({
    queryKey: ['/api/catalyst/batch', position, season],
    queryFn: async () => {
      const res = await fetch(`/api/catalyst/batch?position=${position}&season=${season}&limit=200`);
      return res.json();
    },
  });

  const playerQuery = useQuery<CatalystPlayerDetail>({
    queryKey: ['/api/catalyst/player', selectedPlayer, season],
    queryFn: async () => {
      const res = await fetch(`/api/catalyst/player/${selectedPlayer}?season=${season}`);
      return res.json();
    },
    enabled: !!selectedPlayer,
  });

  const players = useMemo(() => {
    const rows = batchQuery.data?.players || [];
    const sorted = [...rows];
    const sortFns: Record<SortKey, (a: CatalystPlayer, b: CatalystPlayer) => number> = {
      alpha: (a, b) => a.catalyst_alpha - b.catalyst_alpha,
      raw: (a, b) => a.catalyst_raw - b.catalyst_raw,
      plays: (a, b) => a.components.play_count - b.components.play_count,
      leverage: (a, b) => a.components.avg_leverage - b.components.avg_leverage,
      opponent: (a, b) => a.components.opponent_factor - b.components.opponent_factor,
      script: (a, b) => a.components.script_factor - b.components.script_factor,
      name: (a, b) => a.player_name.localeCompare(b.player_name),
    };
    sorted.sort((a, b) => {
      const result = sortFns[sortKey](a, b);
      return sortAsc ? result : -result;
    });
    return sorted;
  }, [batchQuery.data, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span className="ml-1 text-orange-600">{sortAsc ? '▲' : '▼'}</span>;
  };

  const detail = playerQuery.data;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">CATALYST Lab</h1>
        <p className="text-sm text-gray-600">
          Contextual Adaptive Tactical Leverage Yield Score — identifies clutch performers vs garbage-time stat padders using EPA production weighted by win probability, opponent quality, game script, and recency.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-3">
        <div className="flex border rounded overflow-hidden">
          {(['QB', 'RB', 'WR', 'TE'] as Position[]).map((p) => (
            <button key={p} onClick={() => { setPosition(p); setSelectedPlayer(null); }} className={`px-3 py-1 text-sm ${position === p ? 'bg-orange-600 text-white' : 'bg-white hover:bg-gray-50'}`}>{p}</button>
          ))}
        </div>
        <span className="text-xs text-gray-500">{season} Season</span>
        {batchQuery.isLoading && <span className="text-xs text-gray-400">Loading...</span>}
        <span className="ml-auto text-xs text-gray-400">{players.length} players</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border rounded-lg overflow-auto" style={{ maxHeight: '70vh' }}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left sticky top-0 z-10">
              <tr>
                <th className="p-2 text-right w-12 cursor-pointer" onClick={() => handleSort('alpha')}>#</th>
                <th className="p-2 cursor-pointer" onClick={() => handleSort('name')}>Player{sortIndicator('name')}</th>
                <th className="p-2">Team</th>
                <th className="p-2 text-right cursor-pointer" onClick={() => handleSort('alpha')}>Alpha{sortIndicator('alpha')}</th>
                <th className="p-2 text-right cursor-pointer" onClick={() => handleSort('raw')}>Raw{sortIndicator('raw')}</th>
                <th className="p-2 text-right cursor-pointer" onClick={() => handleSort('plays')}>Plays{sortIndicator('plays')}</th>
                <th className="p-2 text-right cursor-pointer" onClick={() => handleSort('leverage')}>Avg Leverage{sortIndicator('leverage')}</th>
                <th className="p-2 text-right cursor-pointer" onClick={() => handleSort('opponent')}>Opp Factor{sortIndicator('opponent')}</th>
                <th className="p-2 text-right cursor-pointer" onClick={() => handleSort('script')}>Script{sortIndicator('script')}</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr
                  key={p.gsis_id}
                  className={`border-t cursor-pointer ${selectedPlayer === p.gsis_id ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                  onClick={() => setSelectedPlayer(p.gsis_id)}
                >
                  <td className="p-2 text-right text-gray-400 tabular-nums">{i + 1}</td>
                  <td className="p-2 font-medium">{p.player_name}</td>
                  <td className="p-2 text-gray-600">{p.team}</td>
                  <td className="p-2 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${catalystBg(p.catalyst_alpha)}`}>
                      {num(p.catalyst_alpha, 0)}
                    </span>
                  </td>
                  <td className={`p-2 text-right tabular-nums ${catalystColor(p.catalyst_alpha)}`}>{num(p.catalyst_raw, 3)}</td>
                  <td className="p-2 text-right tabular-nums">{p.components.play_count}</td>
                  <td className="p-2 text-right tabular-nums">{num(p.components.avg_leverage, 2)}</td>
                  <td className="p-2 text-right tabular-nums">{num(p.components.opponent_factor, 3)}</td>
                  <td className="p-2 text-right tabular-nums">{num(p.components.script_factor, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          {!selectedPlayer && (
            <div className="bg-white border rounded-lg p-6 text-center text-gray-400 text-sm">
              Click a player to see weekly breakdown and component details.
            </div>
          )}

          {selectedPlayer && playerQuery.isLoading && (
            <div className="bg-white border rounded-lg p-6 text-center text-gray-400 text-sm">
              Loading player detail...
            </div>
          )}

          {detail && (
            <>
              <div className="bg-white border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{detail.player_name}</h2>
                    <p className="text-xs text-gray-500">{detail.team} · {detail.position} · {detail.season}</p>
                  </div>
                  <div className={`text-3xl font-bold ${catalystColor(detail.catalyst_alpha)}`}>
                    {num(detail.catalyst_alpha, 0)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Raw Score</div>
                    <div className="font-mono font-semibold">{num(detail.catalyst_raw, 4)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Total Plays</div>
                    <div className="font-mono font-semibold">{detail.components.play_count}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Base EPA</div>
                    <div className="font-mono font-semibold">{num(detail.components.base_epa_sum, 1)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Weighted EPA</div>
                    <div className="font-mono font-semibold">{num(detail.components.weighted_epa_sum, 1)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Component Factors</div>
                  {[
                    { label: 'Leverage', value: detail.components.avg_leverage, max: 5, desc: 'Win probability swing amplifier' },
                    { label: 'Opponent', value: detail.components.opponent_factor, max: 2, desc: 'Defense quality adjustment' },
                    { label: 'Game Script', value: detail.components.script_factor, max: 1.5, desc: 'Trailing/competitive boost' },
                    { label: 'Recency', value: detail.components.recency_factor, max: 1, desc: 'Recent weeks weighted more' },
                  ].map((comp) => (
                    <div key={comp.label} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700">{comp.label}</span>
                        <span className="font-mono">{num(comp.value, 3)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full transition-all"
                          style={{ width: barWidth(comp.value, comp.max) }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-400">{comp.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {detail.weekly && detail.weekly.length > 0 && (
                <div className="bg-white border rounded-lg overflow-auto" style={{ maxHeight: '40vh' }}>
                  <div className="px-3 py-2 border-b text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Weekly Breakdown
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-left sticky top-0">
                      <tr>
                        <th className="p-2">Week</th>
                        <th className="p-2 text-right">Alpha</th>
                        <th className="p-2 text-right">Raw</th>
                        <th className="p-2 text-right">Plays</th>
                        <th className="p-2 text-right">Leverage</th>
                        <th className="p-2 text-right">Opp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.weekly.map((w) => (
                        <tr key={w.week} className="border-t hover:bg-gray-50">
                          <td className="p-2 font-medium">W{w.week}</td>
                          <td className="p-2 text-right">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${catalystBg(w.catalyst_alpha)}`}>
                              {num(w.catalyst_alpha, 0)}
                            </span>
                          </td>
                          <td className={`p-2 text-right tabular-nums ${catalystColor(w.catalyst_alpha)}`}>{num(w.catalyst_raw, 3)}</td>
                          <td className="p-2 text-right tabular-nums">{w.components.play_count}</td>
                          <td className="p-2 text-right tabular-nums">{num(w.components.avg_leverage, 2)}</td>
                          <td className="p-2 text-right tabular-nums">{num(w.components.opponent_factor, 3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
