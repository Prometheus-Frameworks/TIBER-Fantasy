import React, { useState, useEffect } from "react";
import { useDeepseekV3 } from "../hooks/useDeepseekV3";

export default function RankingsV3Table({mode, position}: {mode: "dynasty" | "redraft"; position?: string}) {
  const { data, meta, loading, err } = useDeepseekV3(mode, position);
  const [wrGameLogs, setWrGameLogs] = useState<any[]>([]);
  const [loadingGameLogs, setLoadingGameLogs] = useState(false);

  // Fetch WR season totals when viewing WR position
  useEffect(() => {
    if (position === "WR") {
      setLoadingGameLogs(true);
      fetch('/api/wr-game-logs/combined')
        .then(r => r.json())
        .then(response => {
          if (response.success) {
            // Combine elite WRs with additional WRs into single array
            const allWRs = [
              ...(response.elite_wrs || []),
              ...(response.additional_wrs || [])
            ];
            setWrGameLogs(allWRs);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingGameLogs(false));
    } else {
      setWrGameLogs([]);
    }
  }, [position]);

  // Helper to get WR season totals for a player
  const getWRSeasonTotals = (playerName: string) => {
    const wrData = wrGameLogs.find(wr => 
      wr.player_name?.toLowerCase() === playerName.toLowerCase()
    );
    
    if (!wrData) return null;
    
    // If it's elite WR data (from CSV), return directly
    if (wrData.is_elite) {
      return {
        fpts: wrData.total_fpts || 0,
        targets: wrData.targets || 0,
        receptions: wrData.receptions || 0,
        yards: wrData.rec_yards || 0,
        touchdowns: 0, // Not in CSV
        ypt: wrData.targets > 0 ? (wrData.rec_yards / wrData.targets).toFixed(1) : "0",
        ypc: wrData.receptions > 0 ? (wrData.rec_yards / wrData.receptions).toFixed(1) : "0"
      };
    }
    
    // If it's game logs data, calculate totals
    if (wrData.game_logs) {
      return wrData.game_logs.reduce((totals, week) => ({
        fpts: totals.fpts + (week.fantasy_points || 0),
        targets: totals.targets + (week.receiving?.targets || 0),
        receptions: totals.receptions + (week.receiving?.receptions || 0),
        yards: totals.yards + (week.receiving?.yards || 0),
        touchdowns: totals.touchdowns + (week.receiving?.touchdowns || 0),
        ypt: totals.targets > 0 ? (totals.yards / totals.targets).toFixed(1) : "0",
        ypc: totals.receptions > 0 ? (totals.yards / totals.receptions).toFixed(1) : "0"
      }), { fpts: 0, targets: 0, receptions: 0, yards: 0, touchdowns: 0, ypt: "0", ypc: "0" });
    }
    
    return null;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading DeepSeek v3…</span>
      </div>
    );
  }
  
  if (err) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded-lg">
        <h3 className="font-semibold">Error Loading Rankings</h3>
        <p className="text-sm">{err}</p>
      </div>
    );
  }
  
  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold">DeepSeek v3.1 — {mode.toUpperCase()}{position ? ` • ${position}` : ""}</h2>
        {meta.ts && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            Updated {new Date(meta.ts).toLocaleString()}
          </span>
        )}
        {meta.count && (
          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
            {meta.count} players
          </span>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-3 py-2 text-left">#</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Player</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Pos</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Team</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Age</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Tier</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Score</th>
              <th className="border border-gray-300 px-3 py-2 text-left">ADP</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Δ vs ADP</th>
              {position === "WR" && (
                <>
                  <th className="border border-gray-300 px-2 py-2 text-left bg-blue-50">FPTS</th>
                  <th className="border border-gray-300 px-2 py-2 text-left bg-blue-50">TAR</th>
                  <th className="border border-gray-300 px-2 py-2 text-left bg-blue-50">REC</th>
                  <th className="border border-gray-300 px-2 py-2 text-left bg-blue-50">YD</th>
                  <th className="border border-gray-300 px-2 py-2 text-left bg-blue-50">YPT</th>
                  <th className="border border-gray-300 px-2 py-2 text-left bg-blue-50">YPC</th>
                  <th className="border border-gray-300 px-2 py-2 text-left bg-blue-50">TD</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((r: any) => (
              <tr key={r.player_id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-3 py-2 font-mono text-sm">{r.rank}</td>
                <td className="border border-gray-300 px-3 py-2 font-semibold">{r.name}</td>
                <td className="border border-gray-300 px-3 py-2">
                  <span className={`inline-block px-2 py-1 text-xs rounded font-medium ${
                    r.pos === 'QB' ? 'bg-red-100 text-red-800' :
                    r.pos === 'RB' ? 'bg-green-100 text-green-800' :
                    r.pos === 'WR' ? 'bg-blue-100 text-blue-800' :
                    r.pos === 'TE' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {r.pos}
                  </span>
                </td>
                <td className="border border-gray-300 px-3 py-2 text-sm">{r.team}</td>
                <td className="border border-gray-300 px-3 py-2 text-sm">{r.age ?? "-"}</td>
                <td className="border border-gray-300 px-3 py-2">
                  <span className={`inline-block px-2 py-1 text-xs rounded font-medium ${
                    r.tier === 1 ? 'bg-yellow-100 text-yellow-800' :
                    r.tier === 2 ? 'bg-orange-100 text-orange-800' :
                    r.tier === 3 ? 'bg-red-100 text-red-800' :
                    r.tier === 4 ? 'bg-purple-100 text-purple-800' :
                    r.tier === 5 ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {r.tier}
                  </span>
                </td>
                <td className="border border-gray-300 px-3 py-2 font-mono text-sm">{r.score}</td>
                <td className="border border-gray-300 px-3 py-2 font-mono text-sm">{r.adp ?? "-"}</td>
                <td className="border border-gray-300 px-3 py-2 font-mono text-sm">
                  {r.delta_vs_adp !== null && (
                    <span className={`${
                      r.delta_vs_adp > 0 ? 'text-green-600' : 
                      r.delta_vs_adp < 0 ? 'text-red-600' : 
                      'text-gray-600'
                    }`}>
                      {r.delta_vs_adp > 0 ? '+' : ''}{r.delta_vs_adp}
                    </span>
                  )}
                  {r.delta_vs_adp === null && "-"}
                </td>
                {position === "WR" && (() => {
                  const seasonTotals = getWRSeasonTotals(r.name);
                  
                  return (
                    <>
                      <td className="border border-gray-300 px-2 py-2 text-sm bg-blue-25 font-mono">
                        {seasonTotals ? seasonTotals.fpts.toFixed(1) : "-"}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-sm bg-blue-25 font-mono">
                        {seasonTotals ? seasonTotals.targets : "-"}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-sm bg-blue-25 font-mono">
                        {seasonTotals ? seasonTotals.receptions : "-"}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-sm bg-blue-25 font-mono">
                        {seasonTotals ? seasonTotals.yards : "-"}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-sm bg-blue-25 font-mono">
                        {seasonTotals ? seasonTotals.ypt : "-"}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-sm bg-blue-25 font-mono">
                        {seasonTotals ? seasonTotals.ypc : "-"}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-sm bg-blue-25 font-mono">
                        {seasonTotals ? seasonTotals.touchdowns : "-"}
                      </td>
                    </>
                  );
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}