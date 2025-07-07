import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function FullPlayerPool() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("ALL");

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['/api/players/all'],
    queryFn: async () => {
      const response = await fetch('/api/players/all?limit=1000');
      if (!response.ok) throw new Error('Failed to fetch players');
      return response.json();
    }
  });

  const filteredPlayers = players.filter((player: any) => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = selectedPosition === "ALL" || player.position === selectedPosition;
    return matchesSearch && matchesPosition;
  });

  const playersWithADP = filteredPlayers.filter((p: any) => p.adp !== null);
  const playersMissingADP = filteredPlayers.filter((p: any) => p.adp === null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <p className="text-slate-600">Loading complete player database...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Complete Player Pool</h1>
          <p className="text-slate-600 text-sm">
            All {players.length} active NFL players • {playersWithADP.length} with ADP, {playersMissingADP.length} without ADP
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={selectedPosition} onValueChange={setSelectedPosition}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="QB">QB</SelectItem>
              <SelectItem value="RB">RB</SelectItem>
              <SelectItem value="WR">WR</SelectItem>
              <SelectItem value="TE">TE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{filteredPlayers.length}</div>
            <div className="text-sm text-slate-600">Total Players</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{playersWithADP.length}</div>
            <div className="text-sm text-slate-600">With ADP</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-orange-600">{playersMissingADP.length}</div>
            <div className="text-sm text-slate-600">Missing ADP</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round((playersWithADP.length / filteredPlayers.length) * 100)}%
            </div>
            <div className="text-sm text-slate-600">ADP Coverage</div>
          </div>
        </div>

        {/* Player List */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Player Database</h2>
          </div>
          <div className="divide-y">
            {filteredPlayers.map((player: any, index: number) => (
              <div key={player.id || index} className="p-4 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="font-medium text-slate-900">{player.name}</div>
                    <div className="text-sm text-slate-600">
                      {player.position} • {player.team}
                    </div>
                    {player.college && (
                      <div className="text-xs text-slate-500">{player.college}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      {player.adp ? (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                          ADP: {parseFloat(player.adp).toFixed(1)}
                        </span>
                      ) : (
                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                          No ADP
                        </span>
                      )}
                    </div>
                    {player.age && (
                      <div className="text-xs text-slate-500">Age: {player.age}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}