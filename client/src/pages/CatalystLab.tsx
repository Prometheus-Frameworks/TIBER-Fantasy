import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CatalystPlayer, CatalystPosition } from '@shared/types/catalyst';
import { CatalystControls } from '@/components/catalyst/CatalystControls';
import { CatalystDetailPanel } from '@/components/catalyst/CatalystDetailPanel';
import { CatalystTable } from '@/components/catalyst/CatalystTable';
import { CatalystYoYPanel } from '@/components/catalyst/CatalystYoYPanel';
import { type SortKey } from '@/components/catalyst/utils';
import {
  fetchCatalystBatch,
  fetchCatalystPlayer,
  fetchCatalystYoY,
  getErrorMessage,
  hasCatalystPlayer,
  hasCatalystPlayerDetail,
} from '@/lib/catalystApi';
import { downloadCatalystCsv } from '@/lib/exportCatalystCsv';

export default function CatalystLab() {
  const [position, setPosition] = useState<CatalystPosition>('QB');
  const [season, setSeason] = useState<number>(2025);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('alpha');
  const [sortAsc, setSortAsc] = useState(false);
  const [yoyOpen, setYoyOpen] = useState(true);

  const batchQuery = useQuery({
    queryKey: ['/api/catalyst/batch', position, season],
    queryFn: () => fetchCatalystBatch(position, season),
  });

  const playerQuery = useQuery({
    queryKey: ['/api/catalyst/player', selectedPlayer, season],
    queryFn: () => fetchCatalystPlayer(selectedPlayer!, season),
    enabled: !!selectedPlayer,
  });

  const yoyQuery = useQuery({
    queryKey: ['/api/catalyst/yoy', position],
    queryFn: () => fetchCatalystYoY(position),
  });

  const players = useMemo(() => {
    const rows = Array.isArray(batchQuery.data?.players)
      ? batchQuery.data.players.filter(hasCatalystPlayer)
      : [];

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

  const detail = hasCatalystPlayerDetail(playerQuery.data) ? playerQuery.data : null;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
      return;
    }
    setSortKey(key);
    setSortAsc(false);
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">CATALYST Lab</h1>
        <p className="text-sm text-gray-600 max-w-3xl">
          Contextual Adaptive Tactical Leverage Yield Score — identifies clutch performers vs garbage-time stat padders using EPA production weighted by win probability, opponent quality, game script, and recency.
        </p>
      </div>

      <CatalystControls
        position={position}
        season={season}
        playerCount={players.length}
        isLoading={batchQuery.isLoading}
        isError={batchQuery.isError}
        onPositionChange={(nextPosition) => { setPosition(nextPosition); setSelectedPlayer(null); }}
        onSeasonChange={(nextSeason) => { setSeason(nextSeason); setSelectedPlayer(null); }}
        onExport={() => downloadCatalystCsv(position, season, players)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <CatalystTable
          players={players}
          selectedPlayer={selectedPlayer}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSort={handleSort}
          onSelectPlayer={setSelectedPlayer}
          batchError={batchQuery.isError ? getErrorMessage(batchQuery.error) : undefined}
          isLoading={batchQuery.isLoading}
        />

        <CatalystDetailPanel
          selectedPlayer={selectedPlayer}
          detail={detail}
          isLoading={playerQuery.isLoading}
          errorMessage={playerQuery.isError ? getErrorMessage(playerQuery.error) : undefined}
          malformedPayload={!!selectedPlayer && !!playerQuery.data && !detail}
        />
      </div>

      <CatalystYoYPanel
        position={position}
        yoyOpen={yoyOpen}
        onToggle={() => setYoyOpen(!yoyOpen)}
        data={yoyQuery.data}
        isLoading={yoyQuery.isLoading}
        errorMessage={yoyQuery.isError ? getErrorMessage(yoyQuery.error) : undefined}
      />
    </div>
  );
}
