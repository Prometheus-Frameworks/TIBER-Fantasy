import { useState, useTransition, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { usePlayerPool, nameOf } from "@/hooks/usePlayerPool";
import { api, type RedraftPlayer as ApiRedraftPlayer } from "@/lib/redraftApi";
import { 
  Search,
  ArrowRight,
  Target
} from "lucide-react";

// Tab definitions exactly as specified
const TABS = [
  { key: "ALL", label: "All Positions" },
  { key: "QB", label: "Quarterback" },
  { key: "RB", label: "Running Back" },
  { key: "WR", label: "Wide Receiver" },
  { key: "TE", label: "Tight End" },
  { key: "WAV", label: "Waivers" },
  { key: "TRADE", label: "Trade Analyzer" },
];

type RedraftPlayer = ApiRedraftPlayer;

// Custom TabBar component with query param routing
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

// Hook to parse and update URL search params
function useSearchParams() {
  const [location, setLocation] = useLocation();
  
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  
  const setSearchParams = (newParams: URLSearchParams) => {
    const newUrl = `${location.split('?')[0]}?${newParams.toString()}`;
    setLocation(newUrl);
  };
  
  return [searchParams, setSearchParams] as const;
}

// Shared rankings loader function - exactly as specified
async function loadRankings(pos: string): Promise<any[]> {
  if (pos === "ALL") {
    const [qb, rb, wr, te] = await Promise.all([
      api.redraftRankings({ pos: "QB", season: "2025", limit: 50 }),
      api.redraftRankings({ pos: "RB", season: "2025", limit: 50 }),
      api.redraftRankings({ pos: "WR", season: "2025", limit: 50 }),
      api.redraftRankings({ pos: "TE", season: "2025", limit: 50 }),
    ]);
    
    // Merge all positions - should be ~200 rows total
    return [
      ...(qb.data || []),
      ...(rb.data || []),
      ...(wr.data || []),
      ...(te.data || [])
    ];
  }
  
  const result = await api.redraftRankings({ pos, season: "2025", limit: 50 });
  return result.data || [];
}

// Search function - parallel for ALL, single for specific positions
async function searchPlayers(search: string, pos: string): Promise<any[]> {
  if (pos === "ALL") {
    // For ALL, search across all positions in parallel and merge
    const results = await Promise.all([
      fetch(`/api/redraft/rankings?search=${search}&pos=QB&limit=50`).then(r => r.json()),
      fetch(`/api/redraft/rankings?search=${search}&pos=RB&limit=50`).then(r => r.json()),
      fetch(`/api/redraft/rankings?search=${search}&pos=WR&limit=50`).then(r => r.json()),
      fetch(`/api/redraft/rankings?search=${search}&pos=TE&limit=50`).then(r => r.json()),
    ]);
    
    return results.flatMap(result => result.data || []);
  }
  
  // Single position search
  const response = await fetch(`/api/redraft/rankings?search=${search}&pos=${pos}&limit=50`);
  const data = await response.json();
  return data.data || [];
}

// Player row component with exact layout specification
function PlayerRow({ player, index }: { player: any; index: number }) {
  const playerName = player.name || nameOf(player.id);
  
  return (
    <div className="flex items-center justify-between p-3 border-b hover:bg-gray-50 dark:hover:bg-gray-800">
      <div className="flex items-center space-x-3">
        <Badge variant="outline" className="w-8 h-8 flex items-center justify-center text-xs">
          #{index + 1}
        </Badge>
        <div>
          <div className="font-semibold text-sm" style={{ textTransform: 'capitalize' }}>
            {playerName}
          </div>
          <div className="text-xs text-gray-500">
            {player.team} • {player.pos}
          </div>
        </div>
      </div>
      <a
        href={`/player-compass?id=${player.id}`}
        className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
      >
        <span>View</span>
        <ArrowRight className="h-3 w-3" />
      </a>
    </div>
  );
}

// RankingsList component for ALL and individual position tabs
function RankingsList({ pos }: { pos: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  
  // Load initial rankings
  const { data: rankings = [], isLoading: rankingsLoading } = useQuery({
    queryKey: ['rankings', pos],
    queryFn: () => loadRankings(pos),
    staleTime: 5 * 60 * 1000,
  });
  
  // Search with min 2 chars
  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ['search', pos, searchQuery],
    queryFn: () => searchPlayers(searchQuery, pos),
    enabled: searchQuery.length >= 2,
    staleTime: 2 * 60 * 1000,
  });
  
  // Use search results if searching, otherwise use rankings
  const players = searchQuery.length >= 2 ? searchResults : rankings;
  const isLoading = searchQuery.length >= 2 ? searchLoading : rankingsLoading;
  
  // Cap display to 100 items for UI performance
  const displayPlayers = useMemo(() => players.slice(0, 100), [players]);
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    startTransition(() => {
      setSearchQuery(value);
    });
  };
  
  return (
    <div className="space-y-4">
      {/* Search Box */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder={`Search ${pos === 'ALL' ? 'players' : pos + 's'}... (min 2 chars)`}
          onChange={handleSearch}
          className="pl-9"
        />
      </div>
      
      {/* Player List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {pos === 'ALL' ? 'All Positions' : pos} Rankings
            {isLoading && <span className="text-sm text-gray-500 ml-2">Loading...</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            {displayPlayers.map((player, index) => (
              <PlayerRow key={player.id} player={player} index={index} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Waivers component - same loader, slice 51-200
function WaiversList() {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Load rankings to get extended list for waivers (ranks 51-200)
  const { data: allRankings = [] } = useQuery({
    queryKey: ['waivers'],
    queryFn: async () => {
      // Get extended rankings list to slice 51-200
      const response = await fetch('/api/redraft/rankings?pos=WR&limit=200');
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
  
  // Get ranks 51-200 for waivers
  const waiverPlayers = useMemo(() => {
    const extended = allRankings.slice(50, 200); // ranks 51-200
    return searchQuery.length >= 2 
      ? extended.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()))
      : extended;
  }, [allRankings, searchQuery]);
  
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search waiver candidates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Waiver Wire (Ranks 51-200)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            {waiverPlayers.map((player, index) => (
              <PlayerRow key={player.id} player={player} index={index + 50} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Trade Analyzer shell with two selectors + placeholder button
function TradeAnalyzerShell() {
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  
  const { data: playerPool = [] } = usePlayerPool();
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Trade Analyzer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Player 1</label>
              <Select value={player1} onValueChange={setPlayer1}>
                <SelectTrigger>
                  <SelectValue placeholder="Select first player" />
                </SelectTrigger>
                <SelectContent>
                  {playerPool.slice(0, 50).map((player: any) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name} ({player.pos})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Player 2</label>
              <Select value={player2} onValueChange={setPlayer2}>
                <SelectTrigger>
                  <SelectValue placeholder="Select second player" />
                </SelectTrigger>
                <SelectContent>
                  {playerPool.slice(0, 50).map((player: any) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name} ({player.pos})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button 
            className="w-full" 
            disabled
            variant="outline"
          >
            Analyze Trade (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Dev footer component
function DevFooter({ rows, pos, q }: { rows: number; pos: string; q: string }) {
  if (import.meta.env.MODE !== 'development') return null;
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black text-white text-xs p-2 font-mono">
      rows: {rows} • pos: {pos} • q: "{q}"
    </div>
  );
}

// Main RedraftHub component
export default function RedraftHub() {
  const [sp, setSP] = useSearchParams();
  const pos = sp.get("pos") ?? "ALL";
  
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    n.set(k, v);
    setSP(n);
  };
  
  const [searchQuery, setSearchQuery] = useState("");
  
  // Track current data for dev footer
  const { data: currentData = [] } = useQuery({
    queryKey: ['rankings', pos],
    queryFn: () => loadRankings(pos),
    staleTime: 5 * 60 * 1000,
  });
  
  // Render content based on current tab
  const renderContent = () => {
    switch (pos) {
      case "WAV":
        return <WaiversList />;
      case "TRADE":
        return <TradeAnalyzerShell />;
      default:
        return <RankingsList pos={pos} />;
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
      
      {/* Dev Footer */}
      <DevFooter 
        rows={currentData.length} 
        pos={pos} 
        q={searchQuery}
      />
    </div>
  );
}