import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { usePlayerPool, nameOf } from "@/hooks/usePlayerPool";
import { loadRankings, loadEnhancedRankings, loadWaivers, api, type RedraftPlayer } from "@/lib/redraftApi";
import RankingsList from "@/components/RankingsList";
import WaiversList from "@/components/WaiversList";
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
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            active === tab.key
              ? "bg-black text-white shadow-sm"
              : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
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

// Enhanced redraft rankings hook using shared loader (removed - now handled by RankingsList component)

// Usage leaders for waivers tab
function useUsageLeaders() {
  return useQuery({
    queryKey: ['usage-leaders'],
    queryFn: () => api.usageLeaders({ limit: 30 }),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Waivers data hook with position parameter
function useWaivers(position: "QB" | "RB" | "WR" | "TE" | "ALL" = "WR") {
  return useQuery({
    queryKey: ['waivers', position],
    queryFn: () => loadWaivers(position),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Player ranking card component (removed - now handled by RankingsList component)

// Position-specific tab content using reusable RankingsList component
function PositionTab({ position }: { position: "QB" | "RB" | "WR" | "TE" | "ALL" }) {
  return (
    <RankingsList 
      pos={position === "ALL" ? undefined : position as any}
      title={position === 'ALL' ? 'All Positions Rankings' : `${position} Rankings`}
      showStats={true}
      maxPlayers={100}
    />
  );
}

// Waivers tab with trending players and waiver candidates
function WaiversTab() {
  const [selectedPos, setSelectedPos] = useState<"QB" | "RB" | "WR" | "TE" | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: usageResponse } = useUsageLeaders();
  const { data: waiverPlayers, isLoading } = useWaivers(selectedPos);
  const usageData = usageResponse?.data || [];
  
  // Filter waiver players by search
  const filteredWaivers = waiverPlayers?.filter(player =>
    player.player_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.team?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  
  return (
    <div className="space-y-4">
      {/* Usage Leaders Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Trending Usage</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {usageData?.slice(0, 12).map((player: any, index: number) => (
              <div key={player.player_id || index} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <div className="font-medium text-sm">{player.player_name}</div>
                  <div className="text-xs text-gray-500">{player.team} • {player.position}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{player.usage_score}%</div>
                  <div className="text-xs text-gray-500">Usage</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Waiver Wire Candidates Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Waiver Wire Candidates</span>
            </div>
            <div className="flex items-center space-x-2">
              <Select value={selectedPos} onValueChange={(value) => setSelectedPos(value as any)}>
                <SelectTrigger className="w-24">
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
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search waiver candidates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <div className="space-y-1">
                {filteredWaivers.slice(0, 30).map((player, index) => (
                  <PlayerRankingCard
                    key={player.id || index}
                    player={player}
                    rank={index + 51} // Start ranking from 51
                    showVORP={false}
                  />
                ))}
              </div>
            </div>
          )}
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
    if (pos === "WAV") {
      const filterPos = sp.get("fpos") as "QB" | "RB" | "WR" | "TE" || "WR";
      const { data: waiverRows } = useWaivers(filterPos);
      return <WaiversList rows={waiverRows || []} title={`${filterPos} Waiver Wire`} />;
    }
    
    if (pos === "TRADE") {
      return <TradeAnalyzerTab />;
    }
    
    // All other tabs use RankingsList component
    return <PositionTab position={pos as "QB" | "RB" | "WR" | "TE" | "ALL"} />;
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