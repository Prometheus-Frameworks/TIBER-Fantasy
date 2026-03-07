import type { CatalystPlayer } from '@shared/types/catalyst';
import { getTier, num, type SortKey } from './utils';

interface Props {
  players: CatalystPlayer[];
  selectedPlayer: string | null;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  onSelectPlayer: (playerId: string) => void;
  batchError?: string;
  isLoading: boolean;
}

export function CatalystTable({
  players,
  selectedPlayer,
  sortKey,
  sortAsc,
  onSort,
  onSelectPlayer,
  batchError,
  isLoading,
}: Props) {
  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span className="ml-1 text-orange-600">{sortAsc ? '▲' : '▼'}</span>;
  };

  return (
    <div className="lg:col-span-2 bg-white border rounded-lg overflow-auto" style={{ maxHeight: '70vh' }}>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left sticky top-0 z-10">
          <tr>
            <th className="p-2 text-right w-12 cursor-pointer" onClick={() => onSort('alpha')}>#</th>
            <th className="p-2 cursor-pointer" onClick={() => onSort('name')}>Player{sortIndicator('name')}</th>
            <th className="p-2">Team</th>
            <th className="p-2 text-right cursor-pointer" onClick={() => onSort('alpha')}>Alpha{sortIndicator('alpha')}</th>
            <th className="p-2 text-right">Tier</th>
            <th className="p-2 text-right cursor-pointer" onClick={() => onSort('plays')}>Plays{sortIndicator('plays')}</th>
            <th className="p-2 text-right cursor-pointer" onClick={() => onSort('leverage')}>Leverage{sortIndicator('leverage')}</th>
            <th className="p-2 text-right cursor-pointer" onClick={() => onSort('opponent')}>Opp{sortIndicator('opponent')}</th>
            <th className="p-2 text-right cursor-pointer" onClick={() => onSort('script')}>Script{sortIndicator('script')}</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => {
            const tier = getTier(p.catalyst_alpha);
            return (
              <tr
                key={p.gsis_id}
                className={`border-t cursor-pointer ${selectedPlayer === p.gsis_id ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                onClick={() => onSelectPlayer(p.gsis_id)}
              >
                <td className="p-2 text-right text-gray-400 tabular-nums">{i + 1}</td>
                <td className="p-2 font-medium">{p.player_name}</td>
                <td className="p-2 text-gray-600">{p.team}</td>
                <td className="p-2 text-right">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${tier.bg} ${tier.text}`}>
                    {num(p.catalyst_alpha, 0)}
                  </span>
                </td>
                <td className="p-2 text-right">
                  <span className={`text-xs font-medium ${tier.color}`}>{tier.short}</span>
                </td>
                <td className="p-2 text-right tabular-nums">{p.components.play_count}</td>
                <td className="p-2 text-right tabular-nums">{num(p.components.avg_leverage, 2)}</td>
                <td className="p-2 text-right tabular-nums">{num(p.components.opponent_factor, 3)}</td>
                <td className="p-2 text-right tabular-nums">{num(p.components.script_factor, 3)}</td>
              </tr>
            );
          })}
          {batchError && (
            <tr>
              <td colSpan={9} className="p-4 text-center text-sm text-red-600 bg-red-50 border-t">
                Unable to load CATALYST batch data. {batchError}
              </td>
            </tr>
          )}
          {!isLoading && !batchError && players.length === 0 && (
            <tr>
              <td colSpan={9} className="p-4 text-center text-sm text-gray-500 border-t">No players returned for this selection.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
