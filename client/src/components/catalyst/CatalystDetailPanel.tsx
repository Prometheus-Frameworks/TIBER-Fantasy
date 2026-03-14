import type { CatalystPlayerResponse } from '@shared/types/catalyst';
import { COMPONENT_EXPLANATIONS, barWidth, getTier, num, tierDescription } from './utils';

interface Props {
  selectedPlayer: string | null;
  detail: CatalystPlayerResponse | null;
  isLoading: boolean;
  errorMessage?: string;
  malformedPayload: boolean;
}

export function CatalystDetailPanel({
  selectedPlayer,
  detail,
  isLoading,
  errorMessage,
  malformedPayload,
}: Props) {
  const tier = detail ? getTier(detail.catalyst_alpha) : null;

  return (
    <div className="space-y-4">
      {!selectedPlayer && (
        <div className="bg-white border rounded-lg p-6 text-center text-gray-400 text-sm">
          Click a player to see weekly breakdown and component details.
        </div>
      )}

      {selectedPlayer && isLoading && (
        <div className="bg-white border rounded-lg p-6 text-center text-gray-400 text-sm">
          Loading player detail...
        </div>
      )}

      {selectedPlayer && errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load player details. {errorMessage}
        </div>
      )}

      {selectedPlayer && !errorMessage && malformedPayload && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
          Player detail payload is malformed or missing required component data.
        </div>
      )}

      {detail && tier && (
        <>
          <div className="bg-white border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{detail.player_name}</h2>
                <p className="text-xs text-gray-500">{detail.team} · {detail.position} · {detail.season}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${tier.bg} ${tier.text}`}>
                  {tier.label}
                </span>
              </div>
              <div className={`text-3xl font-bold tabular-nums ${tier.color}`}>
                {num(detail.catalyst_alpha, 0)}
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded p-2">
              {tierDescription(detail.catalyst_alpha)}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded p-2"><div className="text-gray-500">Raw Score</div><div className="font-mono font-semibold">{num(detail.catalyst_raw, 3)}</div></div>
              <div className="bg-gray-50 rounded p-2"><div className="text-gray-500">Plays</div><div className="font-mono font-semibold">{detail.components.play_count}</div></div>
              <div className="bg-gray-50 rounded p-2"><div className="text-gray-500">Base EPA</div><div className="font-mono font-semibold">{num(detail.components.base_epa_sum, 1)}</div></div>
              <div className="bg-gray-50 rounded p-2"><div className="text-gray-500">Weighted EPA</div><div className="font-mono font-semibold">{num(detail.components.weighted_epa_sum, 1)}</div></div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Component Factors</div>
              {[
                { label: 'Leverage', value: detail.components.avg_leverage, max: 5 },
                { label: 'Opponent', value: detail.components.opponent_factor, max: 2 },
                { label: 'Game Script', value: detail.components.script_factor, max: 1.5 },
                { label: 'Recency', value: detail.components.recency_factor, max: 1 },
              ].map((comp) => (
                <div key={comp.label} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-700 font-medium">{comp.label}</span>
                    <span className="font-mono">{num(comp.value, 3)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: barWidth(comp.value, comp.max) }} />
                  </div>
                  <div className="text-[10px] text-gray-400">{COMPONENT_EXPLANATIONS[comp.label]}</div>
                </div>
              ))}
            </div>
          </div>

          {detail.weekly.length > 0 && (
            <div className="bg-white border rounded-lg overflow-auto" style={{ maxHeight: '40vh' }}>
              <div className="px-3 py-2 border-b text-xs font-medium text-gray-600 uppercase tracking-wide">Weekly Progression</div>
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
                  {detail.weekly.map((w) => {
                    const weeklyTier = getTier(w.catalyst_alpha);
                    return (
                      <tr key={w.week} className="border-t hover:bg-gray-50">
                        <td className="p-2 font-medium">W{w.week}</td>
                        <td className="p-2 text-right"><span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${weeklyTier.bg} ${weeklyTier.text}`}>{num(w.catalyst_alpha, 0)}</span></td>
                        <td className={`p-2 text-right tabular-nums ${weeklyTier.color}`}>{num(w.catalyst_raw, 3)}</td>
                        <td className="p-2 text-right tabular-nums">{w.components.play_count}</td>
                        <td className="p-2 text-right tabular-nums">{num(w.components.avg_leverage, 2)}</td>
                        <td className="p-2 text-right tabular-nums">{num(w.components.opponent_factor, 3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
