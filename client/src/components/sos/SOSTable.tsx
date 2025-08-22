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
    <table className="w-full border rounded overflow-hidden">
      <thead>
        <tr className="bg-gray-50 text-left">
          <th className="p-2">Team</th>
          <th className="p-2">Opponent</th>
          <th className="p-2">Ease</th>
          <th className="p-2">Samples</th>
        </tr>
      </thead>
      <tbody>
        {items.map((r,i)=>(
          <React.Fragment key={i}>
            <tr className="border-t">
              <td className="p-2 font-medium">
                <div className="flex items-center gap-2">
                  <TeamLogo team={r.team} size={20} />
                  <span>{r.team}</span>
                </div>
              </td>
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <TeamLogo team={r.opponent} size={18} />
                  <span>{r.opponent}</span>
                </div>
              </td>
              <td className={`p-2 font-semibold text-center ${cls(r.sos_score)}`}>
                {r.sos_score}
                {debug && r.components && (
                  <div className="text-xs text-gray-600 mt-1">
                    FPA {r.components.FPA} | EPA {r.components.EPA} | Pace {r.components.PACE} | RZ {r.components.RZ} | Ven {r.components.VEN}
                  </div>
                )}
              </td>
              <td className="p-2">
                {r.samples ? (
                  <button 
                    onClick={() => toggleExpanded(r.team)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                  >
                    {expandedRows.has(r.team) ? 'Hide' : 'Show'} Players
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">No data</span>
                )}
              </td>
            </tr>
            
            {/* Expanded samples row */}
            {expandedRows.has(r.team) && r.samples && (
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td colSpan={4} className="px-6 py-3">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-sm font-semibold">Total {position} FPTS vs {r.opponent}:</span>
                    <span className="text-base font-bold">{Math.round(r.samples.total * 10) / 10}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {r.samples.players.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2 border rounded px-3 py-2 bg-white dark:bg-gray-700">
                        <TeamLogo team={p.team} size={18} />
                        <div className="text-sm">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{p.team}</div>
                        </div>
                        <div className="ml-auto font-semibold">{p.fpts.toFixed(1)}</div>
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
  );
}