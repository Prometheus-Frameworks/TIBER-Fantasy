import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import EnhancedPlayerCard from './EnhancedPlayerCard';

interface PlayerSearchResult {
  canonicalId: string;
  fullName: string;
  position: string;
  nflTeam: string;
  confidence: number;
  matchReason: string;
}

interface SearchResponse {
  success: boolean;
  data: {
    results: PlayerSearchResult[];
    totalFound: number;
  };
}

export default function PlayerSearchBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Search players API
  const { data: searchResults, isLoading } = useQuery<SearchResponse>({
    queryKey: ['/api/player-identity/search', searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ name: searchQuery, limit: '3' });
      const res = await fetch(`/api/player-identity/search?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: searchQuery.length >= 2,
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setSelectedPlayer(null);
    if (value.length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelectPlayer = (player: PlayerSearchResult) => {
    setSelectedPlayer(player);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearchQuery('');
    setSelectedPlayer(null);
    setIsOpen(false);
  };

  const players = searchResults?.data?.results || [];

  return (
    <div className="relative w-full" ref={wrapperRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search players..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2 bg-[#1e2330] border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          data-testid="input-player-search"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
            data-testid="button-clear-search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && searchQuery.length >= 2 && (
        <div className="absolute top-full mt-2 w-full bg-[#1e2330] border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-400">
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : players.length > 0 ? (
            <div className="py-2">
              {players.map((player) => (
                <button
                  key={player.canonicalId}
                  onClick={() => handleSelectPlayer(player)}
                  className="w-full px-4 py-3 hover:bg-[#141824] transition-colors text-left flex items-center justify-between group"
                  data-testid={`player-result-${player.canonicalId}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-bold text-white text-sm">
                      {player.position}
                    </div>
                    <div>
                      <div className="text-gray-100 font-medium group-hover:text-blue-400 transition-colors">
                        {player.fullName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {player.nflTeam} • {player.position}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 group-hover:text-gray-500">
                    {player.matchReason}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-400" data-testid="no-results">
              No players found
            </div>
          )}
        </div>
      )}

      {/* Selected Player Card */}
      {selectedPlayer && (
        <div className="absolute top-full mt-2 w-full md:w-[800px] z-50">
          <EnhancedPlayerCard player={selectedPlayer} onClose={handleClear} />
        </div>
      )}
    </div>
  );
}
