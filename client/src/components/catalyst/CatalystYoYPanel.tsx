import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CatalystPosition, CatalystYoYResponse } from '@shared/types/catalyst';
import { getTier, num } from './utils';

interface Props {
  position: CatalystPosition;
  yoyOpen: boolean;
  onToggle: () => void;
  data?: CatalystYoYResponse;
  isLoading: boolean;
  errorMessage?: string;
}

export function CatalystYoYPanel({ position, yoyOpen, onToggle, data, isLoading, errorMessage }: Props) {
  const baseSeason = data?.base_season ?? 2024;
  const comparisonSeason = data?.comparison_season ?? 2025;

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div>
          <span className="font-semibold text-sm">{baseSeason} → {comparisonSeason} Signal Validation</span>
          <span className="ml-2 text-xs text-gray-500">Did the {baseSeason} CATALYST leaders stay clutch in {comparisonSeason}?</span>
        </div>
        {yoyOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {yoyOpen && (
        <div className="border-t">
          <div className="px-4 py-2 bg-gray-50 border-b">
            <p className="text-xs text-gray-500">
              Top {position}s ranked by their {baseSeason} CATALYST Alpha score, showing their {comparisonSeason} performance — validating the clutch signal as a forward indicator.
            </p>
          </div>

          {isLoading && <div className="p-6 text-center text-sm text-gray-400">Loading comparison data...</div>}

          {errorMessage && (
            <div className="p-6 text-center text-sm text-red-700 bg-red-50 border-b">
              Failed to load YoY validation data. {errorMessage}
            </div>
          )}

          {data && !errorMessage && (
            <div className="overflow-auto" style={{ maxHeight: '50vh' }}>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left sticky top-0">
                  <tr>
                    <th className="p-2 text-right w-10 text-gray-500 font-medium">#</th>
                    <th className="p-2 text-gray-500 font-medium">Player</th>
                    <th className="p-2 text-gray-500 font-medium">{baseSeason} Team</th>
                    <th className="p-2 text-right text-gray-500 font-medium">{baseSeason} Alpha</th>
                    <th className="p-2 text-right text-gray-500 font-medium">{comparisonSeason} Alpha</th>
                    <th className="p-2 text-right text-gray-500 font-medium">Change</th>
                    <th className="p-2 text-gray-500 font-medium">{comparisonSeason} Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {data.players.map((p, i) => {
                    const t24 = p.alpha_2024 != null ? getTier(p.alpha_2024) : null;
                    const t25 = p.alpha_2025 != null ? getTier(p.alpha_2025) : null;
                    const deltaColor = p.delta == null ? 'text-gray-400' : p.delta >= 5 ? 'text-emerald-600' : p.delta <= -5 ? 'text-red-500' : 'text-gray-500';
                    const deltaSign = p.delta == null ? '—' : p.delta > 0 ? `+${p.delta.toFixed(1)}` : p.delta.toFixed(1);

                    return (
                      <tr key={p.gsis_id} className="border-t hover:bg-gray-50">
                        <td className="p-2 text-right text-gray-400 tabular-nums">{i + 1}</td>
                        <td className="p-2 font-medium">{p.player_name}</td>
                        <td className="p-2 text-gray-500">{p.team_2024}</td>
                        <td className="p-2 text-right">{t24 && <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t24.bg} ${t24.text}`}>{p.alpha_2024 != null ? num(p.alpha_2024, 0) : '—'}</span>}</td>
                        <td className="p-2 text-right">
                          {t25 ? <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t25.bg} ${t25.text}`}>{p.alpha_2025 != null ? num(p.alpha_2025, 0) : '—'}</span> : <span className="text-xs text-gray-400">No data</span>}
                        </td>
                        <td className={`p-2 text-right tabular-nums text-sm font-semibold ${deltaColor}`}>{deltaSign}</td>
                        <td className="p-2">{t25 ? <span className={`text-xs font-medium ${t25.color}`}>{t25.label}</span> : <span className="text-xs text-gray-400">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
