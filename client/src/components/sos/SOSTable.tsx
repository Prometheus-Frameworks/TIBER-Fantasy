import { useState } from 'react';
import React from 'react';
import { TeamLogo } from "../TeamLogo";
import { tierColor } from "../../lib/sosColors";

type PlayerSample = {
  name: string;
  team: string;
  fpts: number;
};

type Row = {
  team:string;
  opponent:string;
  sos_score:number;
  tier:'green'|'yellow'|'red';
  components?: { FPA: number; EPA: number; PACE: number; RZ: number; VEN: string };
  samples?: {
    total: number;
    players: PlayerSample[];
  };
};
type Props = { items: Row[]; debug?: boolean; position?: string };

export default function SOSTable({items, debug, position = 'RB'}: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const cls = (score: number) => tierColor(score);
  
  const toggleExpanded = (team: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(team)) {
      newExpanded.delete(team);
    } else {
      newExpanded.add(team);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border rounded overflow-hidden min-w-[500px]">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2 text-sm sm:text-base">Team</th>
            <th className="p-2 text-sm sm:text-base">Opponent</th>
            <th className="p-2 text-sm sm:text-base">Ease</th>
            <th className="p-2 text-sm sm:text-base">Samples</th>
          </tr>
        </thead>
      <tbody>
        {items.map((r,i)=>(
          <React.Fragment key={i}>
            <tr className="border-t">
              <td className="p-2 font-medium">
                <div className="flex items-center gap-1 sm:gap-2">
                  <TeamLogo team={r.team} size={16} className="sm:hidden" />
                  <TeamLogo team={r.team} size={20} className="hidden sm:block" />
                  <span className="text-sm sm:text-base">{r.team}</span>
                </div>
              </td>
              <td className="p-2">
                <div className="flex items-center gap-1 sm:gap-2">
                  <TeamLogo team={r.opponent} size={14} className="sm:hidden" />
                  <TeamLogo team={r.opponent} size={18} className="hidden sm:block" />
                  <span className="text-sm sm:text-base">{r.opponent}</span>
                </div>
              </td>
              <td className={`p-2 font-semibold text-center ${cls(r.sos_score)}`}>
                <span className="text-sm sm:text-base">{r.sos_score}</span>
                {debug && r.components && (
                  <>
                    <div className="text-xs text-gray-600 mt-1 hidden sm:block">
                      FPA {r.components.FPA} | EPA {r.components.EPA} | Pace {r.components.PACE} | RZ {r.components.RZ} | Ven {r.components.VEN}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 sm:hidden">
                      <div>FPA {r.components.FPA} EPA {r.components.EPA}</div>
                      <div>Pace {r.components.PACE} RZ {r.components.RZ}</div>
                    </div>
                  </>
                )}
              </td>
              <td className="p-2">
                {r.samples ? (
                  <button 
                    onClick={() => toggleExpanded(r.team)}
                    className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                  >
                    <span className="hidden sm:inline">{expandedRows.has(r.team) ? 'Hide' : 'Show'} Players</span>
                    <span className="sm:hidden">{expandedRows.has(r.team) ? 'Hide' : 'Show'}</span>
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">No data</span>
                )}
              </td>
            </tr>
            
            {/* Expanded samples row */}
            {expandedRows.has(r.team) && r.samples && (
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td colSpan={4} className="px-3 sm:px-6 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
                    <span className="text-sm font-semibold">Total {position} FPTS vs {r.opponent}:</span>
                    <span className="text-lg sm:text-base font-bold">{Math.round(r.samples.total * 10) / 10}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:gap-3">
                    {r.samples.players.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2 border rounded px-2 sm:px-3 py-2 bg-white dark:bg-gray-700">
                        <TeamLogo team={p.team} size={16} className="sm:hidden" />
                        <TeamLogo team={p.team} size={18} className="hidden sm:block" />
                        <div className="text-sm flex-1">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 sm:hidden">{p.team}</div>
                        </div>
                        <div className="hidden sm:block text-xs text-gray-600 dark:text-gray-400">{p.team}</div>
                        <div className="font-semibold text-sm sm:text-base">{p.fpts.toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
    </div>
  );
}