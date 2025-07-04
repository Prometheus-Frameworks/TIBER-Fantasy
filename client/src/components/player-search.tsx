import { useState, useEffect, useRef } from "react";
import { Search, User, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Player {
  id: number;
  name: string;
  position: string;
  team: string;
  avgPoints: number;
  imageUrl?: string;
}

interface PlayerSearchProps {
  onPlayerSelect: (player: Player) => void;
  placeholder?: string;
  className?: string;
}

export function PlayerSearch({ onPlayerSelect, placeholder = "Search players...", className = "" }: PlayerSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['/api/players/search', { q: searchTerm }],
    enabled: searchTerm.length >= 2,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  }) as { data: Player[], isLoading: boolean };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || players.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < players.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : players.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && players[selectedIndex]) {
            handlePlayerSelect(players[selectedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSelectedIndex(-1);
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, players, selectedIndex]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    setIsOpen(value.length >= 2);
    setSelectedIndex(-1);
  };

  const handlePlayerSelect = (player: Player) => {
    onPlayerSelect(player);
    setSearchTerm(player.name);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'RB': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'WR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'TE': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          ref={searchRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsOpen(searchTerm.length >= 2)}
          className="pl-10 pr-4"
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {isOpen && players.length > 0 && (
        <Card 
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-y-auto shadow-lg border border-border bg-background"
        >
          <div className="p-1">
            {players.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                  index === selectedIndex 
                    ? 'bg-accent' 
                    : 'hover:bg-accent/50'
                }`}
                onClick={() => handlePlayerSelect(player)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex-shrink-0">
                  {player.imageUrl ? (
                    <img 
                      src={player.imageUrl} 
                      alt={player.name}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {player.name}
                    </span>
                    <Badge variant="secondary" className={getPositionColor(player.position)}>
                      {player.position}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {player.team}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {player.avgPoints.toFixed(1)} PPG
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isOpen && searchTerm.length >= 2 && players.length === 0 && !isLoading && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-lg border border-border bg-background">
          <div className="p-4 text-center text-muted-foreground">
            No players found for "{searchTerm}"
          </div>
        </Card>
      )}
    </div>
  );
}