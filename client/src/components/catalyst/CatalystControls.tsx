import { Download } from 'lucide-react';
import type { CatalystPosition } from '@shared/types/catalyst';

interface Props {
  position: CatalystPosition;
  season: number;
  playerCount: number;
  isLoading: boolean;
  isError: boolean;
  onPositionChange: (position: CatalystPosition) => void;
  onSeasonChange: (season: number) => void;
  onExport: () => void;
}

export function CatalystControls({
  position,
  season,
  playerCount,
  isLoading,
  isError,
  onPositionChange,
  onSeasonChange,
  onExport,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-3">
      <div className="flex border rounded overflow-hidden">
        {(['QB', 'RB', 'WR', 'TE'] as CatalystPosition[]).map((p) => (
          <button
            key={p}
            onClick={() => onPositionChange(p)}
            className={`px-3 py-1 text-sm ${position === p ? 'bg-orange-600 text-white' : 'bg-white hover:bg-gray-50'}`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex border rounded overflow-hidden">
        {[2024, 2025].map((y) => (
          <button
            key={y}
            onClick={() => onSeasonChange(y)}
            className={`px-3 py-1 text-sm ${season === y ? 'bg-gray-800 text-white' : 'bg-white hover:bg-gray-50'}`}
          >
            {y}
          </button>
        ))}
      </div>

      <span className="text-xs text-gray-500">{season} Season</span>
      {isLoading && <span className="text-xs text-gray-400">Loading...</span>}
      {isError && <span className="text-xs text-red-600">Failed to load list.</span>}
      <span className="text-xs text-gray-400">{playerCount} players</span>
      <button
        onClick={onExport}
        disabled={playerCount === 0}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export CSV
      </button>
    </div>
  );
}
