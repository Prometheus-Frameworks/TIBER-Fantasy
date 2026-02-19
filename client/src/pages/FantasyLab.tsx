import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

type Position = 'RB' | 'WR' | 'TE';
type ViewMode = 'FIRE' | 'DELTA';

const seasons = [2025, 2024, 2023];
const weeks = Array.from({ length: 18 }, (_, i) => i + 1);

function num(v: unknown, digits = 1): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return v.toFixed(digits);
}

export default function FantasyLab() {
  const [season, setSeason] = useState(2025);
  const [week, setWeek] = useState(14);
  const [position, setPosition] = useState<Position>('RB');
  const [view, setView] = useState<ViewMode>('FIRE');

  const weekMetaQuery = useQuery<{ metadata?: { weeksReturned?: { max?: number } } }>({
    queryKey: [`/api/fantasy-lab/weekly?season=${season}&limit=1`],
  });

  useEffect(() => {
    const maxWeek = weekMetaQuery.data?.metadata?.weeksReturned?.max;
    if (typeof maxWeek === 'number' && maxWeek >= 1 && maxWeek <= 18) {
      setWeek(maxWeek);
    }
  }, [weekMetaQuery.data]);

  const fireQuery = useQuery<any>({
    queryKey: [`/api/fire/eg/batch?season=${season}&week=${week}&position=${position}`],
  });

  const deltaQuery = useQuery<any>({
    queryKey: [`/api/delta/eg/batch?season=${season}&week=${week}&position=${position}&limit=200`],
  });

  const fireRows = useMemo(() => {
    const rows = (fireQuery.data?.data || []) as any[];
    return [...rows].sort((a, b) => (b.fireScore ?? -1) - (a.fireScore ?? -1));
  }, [fireQuery.data]);

  const deltaRows = useMemo(() => {
    const rows = (deltaQuery.data?.data || []) as any[];
    return [...rows].sort((a, b) => Math.abs(b?.delta?.rankZ ?? 0) - Math.abs(a?.delta?.rankZ ?? 0));
  }, [deltaQuery.data]);

  const isLoading = view === 'FIRE' ? fireQuery.isLoading : deltaQuery.isLoading;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Fantasy Lab</h1>
        <p className="text-sm text-gray-600">FIRE engine + FORGE/FIRE Hybrid Delta (RB/WR/TE only).</p>
        <p className="text-xs text-amber-700 mt-1">QB FIRE not available yet (QB xFP gap).</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-3">
        <select value={season} onChange={(e) => setSeason(Number(e.target.value))} className="border rounded px-2 py-1">
          {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={week} onChange={(e) => setWeek(Number(e.target.value))} className="border rounded px-2 py-1">
          {weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
        </select>

        <div className="flex border rounded overflow-hidden">
          {(['RB', 'WR', 'TE'] as Position[]).map((p) => (
            <button key={p} onClick={() => setPosition(p)} className={`px-3 py-1 text-sm ${position === p ? 'bg-orange-600 text-white' : 'bg-white'}`}>{p}</button>
          ))}
        </div>

        <div className="flex border rounded overflow-hidden">
          {(['FIRE', 'DELTA'] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1 text-sm ${view === v ? 'bg-slate-900 text-white' : 'bg-white'}`}>{v}</button>
          ))}
        </div>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading...</div>}

      {!isLoading && view === 'FIRE' && (
        <div className="bg-white border rounded-lg overflow-auto">
          {!fireRows.length ? (
            <div className="p-4 text-sm text-gray-500">No eligible players for this filter/window.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2">Player</th><th className="p-2">Team</th><th className="p-2">FIRE</th><th className="p-2">Opp</th><th className="p-2">Role</th><th className="p-2">Conv</th><th className="p-2">xfp_R</th><th className="p-2">xfpgoe_R</th><th className="p-2">snaps_R</th>
                </tr>
              </thead>
              <tbody>
                {fireRows.map((r) => (
                  <tr key={r.playerId} className="border-t">
                    <td className="p-2">{r.playerName || r.playerId}</td>
                    <td className="p-2">{r.team || '—'}</td>
                    <td className="p-2 font-semibold">{num(r.fireScore)}</td>
                    <td className="p-2">{num(r.pillars?.opportunity)}</td>
                    <td className="p-2">{num(r.pillars?.role)}</td>
                    <td className="p-2">{num(r.pillars?.conversion)}</td>
                    <td className="p-2">{num(r.raw?.xfp_R, 2)}</td>
                    <td className="p-2">{num(r.raw?.xfpgoe_R, 2)}</td>
                    <td className="p-2">{num(r.raw?.snaps_R, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!isLoading && view === 'DELTA' && (
        <div className="bg-white border rounded-lg overflow-auto">
          {!deltaRows.length ? (
            <div className="p-4 text-sm text-gray-500">No eligible players for this filter/window.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2">Player</th><th className="p-2">Team</th><th className="p-2">Alpha</th><th className="p-2">FIRE</th><th className="p-2">Display Delta (pct)</th><th className="p-2">Rank Delta (z)</th><th className="p-2">Badge</th>
                </tr>
              </thead>
              <tbody>
                {deltaRows.map((r) => (
                  <tr key={r.playerId} className="border-t">
                    <td className="p-2">{r.playerName || r.playerId}</td>
                    <td className="p-2">{r.team || '—'}</td>
                    <td className="p-2">{num(r.forge?.alpha)}</td>
                    <td className="p-2">{num(r.fire?.score)}</td>
                    <td className="p-2">{num(r.delta?.displayPct)}</td>
                    <td className="p-2">{num(r.delta?.rankZ, 2)}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs ${r.delta?.direction === 'BUY_LOW' ? 'bg-green-100 text-green-700' : r.delta?.direction === 'SELL_HIGH' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{r.delta?.direction}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
