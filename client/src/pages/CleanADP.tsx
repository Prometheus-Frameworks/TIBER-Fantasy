import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, TrendingDown } from "lucide-react";

interface ADPPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  adp: number;
  ownership: number;
  adpTrend: number;
  isRising: boolean;
  isFalling: boolean;
}

interface ADPData {
  players: ADPPlayer[];
  totalDrafts: number;
  lastUpdated: string;
}

export default function CleanADP() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("ALL");

  const { data: adpData, isLoading } = useQuery<ADPData>({
    queryKey: ['/api/adp/sleeper', 'superflex'],
  });

  const filteredPlayers = adpData?.players?.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = selectedPosition === "ALL" || player.position === selectedPosition;
    return matchesSearch && matchesPosition;
  }) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/3"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            {[...Array(15)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Clean Header */}
      <div className="bg-white border-b border-slate-200 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Dynasty ADP Rankings</h1>
          <p className="text-slate-600 text-sm">
            Based on {adpData?.totalDrafts?.toLocaleString()} recent Sleeper dynasty drafts
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            {['ALL', 'QB', 'RB', 'WR', 'TE'].map((pos) => (
              <Button
                key={pos}
                variant={selectedPosition === pos ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPosition(pos)}
                className={selectedPosition === pos ? 
                  "bg-blue-600 hover:bg-blue-700 text-white" : 
                  "border-slate-300 text-slate-700 hover:bg-slate-100"
                }
              >
                {pos}
              </Button>
            ))}
          </div>
        </div>

        {/* Players Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {/* Table Header */}
          <div className="bg-slate-50 border-b border-slate-200 p-4">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-slate-600">
              <div className="col-span-1">ADP</div>
              <div className="col-span-5">Player</div>
              <div className="col-span-2">Position</div>
              <div className="col-span-2">Ownership</div>
              <div className="col-span-2">Trend</div>
            </div>
          </div>

          {/* Player Rows */}
          <div className="divide-y divide-slate-100">
            {filteredPlayers.slice(0, 100).map((player, index) => (
              <div 
                key={player.id} 
                className="p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* ADP */}
                  <div className="col-span-1">
                    <span className="text-lg font-bold text-slate-900">
                      {player.adp.toFixed(1)}
                    </span>
                  </div>

                  {/* Player Name & Team */}
                  <div className="col-span-5">
                    <div className="font-medium text-slate-900">{player.name}</div>
                    <div className="text-sm text-slate-500">{player.team}</div>
                  </div>

                  {/* Position */}
                  <div className="col-span-2">
                    <Badge 
                      variant="outline" 
                      className={
                        player.position === 'QB' ? 'border-red-300 text-red-700 bg-red-50' :
                        player.position === 'RB' ? 'border-green-300 text-green-700 bg-green-50' :
                        player.position === 'WR' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                        'border-purple-300 text-purple-700 bg-purple-50'
                      }
                    >
                      {player.position}
                    </Badge>
                  </div>

                  {/* Ownership */}
                  <div className="col-span-2">
                    <div className="text-slate-900 font-medium">
                      {player.ownership.toFixed(1)}%
                    </div>
                  </div>

                  {/* Trend */}
                  <div className="col-span-2 flex items-center gap-2">
                    {player.isRising && (
                      <>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 text-xs">
                          Rising
                        </Badge>
                      </>
                    )}
                    {player.isFalling && (
                      <>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50 text-xs">
                          Falling
                        </Badge>
                      </>
                    )}
                    {!player.isRising && !player.isFalling && (
                      <span className="text-slate-400 text-sm">Stable</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-slate-500">
          Last updated: {adpData?.lastUpdated ? new Date(adpData.lastUpdated).toLocaleString() : 'Unknown'}
        </div>
      </div>
    </div>
  );
}