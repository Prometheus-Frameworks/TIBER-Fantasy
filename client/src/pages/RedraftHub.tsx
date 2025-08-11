import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { usePlayerPool, nameOf } from "@/hooks/usePlayerPool";
import { 
  Users, 
  TrendingUp, 
  Search,
  Filter,
  Trophy,
  Target,
  Clock,
  Zap
} from "lucide-react";

const TABS = [
  { key: "ALL", label: "All Positions" },
  { key: "QB", label: "Quarterback" },
  { key: "RB", label: "Running Back" },
  { key: "WR", label: "Wide Receiver" },
  { key: "TE", label: "Tight End" },
  { key: "WAV", label: "Waivers" },
  { key: "TRADE", label: "Trade Analyzer" },
];

// Custom TabBar component that works with URL params
function TabBar({ tabs, active, onSelect }: {
  tabs: typeof TABS;
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onSelect(tab.key)}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            active === tab.key
              ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// Hook to parse and update URL search params with wouter
function useSearchParams() {
  const [location, setLocation] = useLocation();
  
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  
  const setSearchParams = (newParams: URLSearchParams, options?: { replace?: boolean }) => {
    const newUrl = `${location.split('?')[0]}?${newParams.toString()}`;
    setLocation(newUrl);
  };
  
  return [searchParams, setSearchParams] as const;
}

interface RedraftPlayer {
  id: string;
  name: string;
  team: string;
  pos: string;
  adp?: number;
  projPoints?: number;
  vorp?: number;
  tier?: string;
}

// Position-specific redraft rankings
function useRedraftRankings(position?: string) {
  return useQuery({
    queryKey: ['/api/redraft/rankings', position],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (position && position !== 'ALL') params.append('pos', position);
      params.append('season', '2025');
      params.append('limit', '100');
      
      const response = await fetch(`/api/redraft/rankings?${params}`);
      const data = await response.json();
      return data.data || [];
    },
  });
}

// VORP rankings for value analysis
function useVORPRankings(position?: string) {
  return useQuery({
    queryKey: ['/api/analytics/vorp', position],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (position && position !== 'ALL') params.append('position', position);
      
      const response = await fetch(`/api/analytics/vorp?${params}`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });
}

// Player ranking card component
function PlayerRankingCard({ player, rank, showVORP = false }: { 
  player: RedraftPlayer; 
  rank: number; 
  showVORP?: boolean; 
}) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <Badge variant="outline" className="w-8 h-8 flex items-center justify-center text-xs">
            {rank}
          </Badge>
        </div>
        <div className="flex-grow">
          <div className="font-semibold text-sm">{nameOf(player.id)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {player.team} • {player.pos}
            {player.adp && ` • ADP ${player.adp.toFixed(1)}`}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2 text-right">
        {showVORP && player.vorp && (
          <div className="text-xs">
            <div className="font-medium">{player.vorp.toFixed(1)}</div>
            <div className="text-gray-500 dark:text-gray-400">VORP</div>
          </div>
        )}
        {player.projPoints && (
          <div className="text-xs">
            <div className="font-medium">{player.projPoints.toFixed(1)}</div>
            <div className="text-gray-500 dark:text-gray-400">Proj</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Position-specific tab content
function PositionTab({ position }: { position: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("rank");
  
  const { data: redraftData, isLoading: redraftLoading } = useRedraftRankings(position);
  const { data: vorpData, isLoading: vorpLoading } = useVORPRankings(position);
  const { data: poolPlayers } = usePlayerPool({ pos: position !== 'ALL' ? position : undefined });
  
  // Merge data sources for comprehensive view
  const mergedPlayers = poolPlayers?.map((player, index) => {
    const redraftMatch = redraftData?.find((r: any) => 
      r.player_name?.toLowerCase().includes(player.name.toLowerCase()) ||
      r.id === player.id
    );
    const vorpMatch = vorpData?.find((v: any) => 
      v.player_name?.toLowerCase().includes(player.name.toLowerCase()) ||
      v.id === player.id
    );
    
    return {
      id: player.id,
      name: player.name,
      team: player.team,
      pos: player.pos,
      adp: redraftMatch?.adp,
      projPoints: redraftMatch?.projected_points || vorpMatch?.projected_points,
      vorp: vorpMatch?.vorp,
      tier: redraftMatch?.tier || vorpMatch?.tier
    };
  }) || [];
  
  // Filter by search
  const filteredPlayers = mergedPlayers.filter(player =>
    nameOf(player.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.team.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Sort players
  const sortedPlayers = filteredPlayers.sort((a, b) => {
    switch (sortBy) {
      case 'vorp':
        return (b.vorp || 0) - (a.vorp || 0);
      case 'projected':
        return (b.projPoints || 0) - (a.projPoints || 0);
      case 'adp':
        return (a.adp || 999) - (b.adp || 999);
      default:
        return 0; // Keep original order (rank)
    }
  });
  
  const isLoading = redraftLoading || vorpLoading;
  
  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder={`Search ${position === 'ALL' ? 'players' : position + 's'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rank">Default Rank</SelectItem>
            <SelectItem value="vorp">VORP</SelectItem>
            <SelectItem value="projected">Projected Points</SelectItem>
            <SelectItem value="adp">ADP</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Stats Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div className="text-sm">
                <div className="font-semibold">{filteredPlayers.length}</div>
                <div className="text-gray-500">Players</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-green-500" />
              <div className="text-sm">
                <div className="font-semibold">
                  {filteredPlayers.filter(p => p.vorp && p.vorp > 100).length}
                </div>
                <div className="text-gray-500">Value Picks</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <div className="text-sm">
                <div className="font-semibold">
                  {Math.round(filteredPlayers.reduce((sum, p) => sum + (p.projPoints || 0), 0) / Math.max(filteredPlayers.length, 1))}
                </div>
                <div className="text-gray-500">Avg Proj</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <div className="text-sm">
                <div className="font-semibold">
                  {filteredPlayers.filter(p => p.tier && ['Elite', 'High-End'].includes(p.tier)).length}
                </div>
                <div className="text-gray-500">Elite Tier</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Player List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {position === 'ALL' ? 'All Positions' : position} Rankings
            </span>
            {isLoading && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                <span>Loading...</span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            {sortedPlayers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No players found matching your criteria</p>
              </div>
            ) : (
              <div className="space-y-1 p-4">
                {sortedPlayers.map((player, index) => (
                  <PlayerRankingCard
                    key={player.id}
                    player={player}
                    rank={index + 1}
                    showVORP={sortBy === 'vorp'}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Waivers tab with trending players
function WaiversTab() {
  const { data: usageData } = useQuery({
    queryKey: ['/api/usage-leaders'],
    queryFn: async () => {
      const response = await fetch('/api/usage-leaders?limit=30');
      const data = await response.json();
      return data.data || [];
    },
  });
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Trending on Waivers</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {usageData?.slice(0, 15).map((player: any, index: number) => (
              <div key={player.player_id || index} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{player.player_name || nameOf(player.id)}</div>
                  <div className="text-sm text-gray-500">{player.team} • {player.position}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{player.usage_rate?.toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">Usage</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Trade Analyzer placeholder
function TradeAnalyzerTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Redraft Trade Analyzer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
            <p className="text-gray-500">
              Redraft-focused trade analysis with seasonal impact evaluation
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RedraftHub() {
  const [sp, setSP] = useSearchParams();
  const pos = sp.get("pos") ?? "ALL";
  const view = sp.get("view") ?? "rankings";
  
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    n.set(k, v);
    setSP(n, { replace: true });
  };
  
  // Render content based on current tab
  const renderContent = () => {
    switch (pos) {
      case "WAV":
        return <WaiversTab />;
      case "TRADE":
        return <TradeAnalyzerTab />;
      default:
        return <PositionTab position={pos === "ALL" ? "ALL" : pos} />;
    }
  };
  
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Redraft Hub</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Complete redraft rankings, analysis, and tools for the 2025 season
        </p>
      </div>
      
      {/* Tab Navigation */}
      <TabBar 
        tabs={TABS} 
        active={pos} 
        onSelect={(k) => set("pos", k)} 
      />
      
      {/* Tab Content */}
      <div className="space-y-4">
        {renderContent()}
      </div>
    </div>
  );
}