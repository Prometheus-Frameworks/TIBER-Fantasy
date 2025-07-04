import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, User } from "lucide-react";
import type { Player } from "@shared/schema";

interface FantasyLineupProps {
  players: (Player & { isStarter: boolean })[];
  className?: string;
}

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'DEF', 'K'];

export default function FantasyLineup({ players, className }: FantasyLineupProps) {
  const starters = players.filter(p => p.isStarter);
  const bench = players.filter(p => !p.isStarter);

  // Group starters by position for lineup display
  const lineupSlots = [
    { position: 'QB', count: 1 },
    { position: 'RB', count: 2 },
    { position: 'WR', count: 2 },
    { position: 'TE', count: 1 },
    { position: 'FLEX', count: 1 },
    { position: 'DEF', count: 1 },
    { position: 'K', count: 1 },
  ];

  const getPlayersForPosition = (position: string, count: number) => {
    if (position === 'FLEX') {
      // FLEX can be RB/WR/TE
      const flexEligible = starters.filter(p => 
        ['RB', 'WR', 'TE'].includes(p.position) && 
        !isPlayerAlreadyUsed(p, position)
      );
      return flexEligible.slice(0, count);
    }
    
    const positionPlayers = starters.filter(p => p.position === position);
    return positionPlayers.slice(0, count);
  };

  const isPlayerAlreadyUsed = (player: Player, currentSlot: string) => {
    // Track which players are already assigned to prevent duplicates
    // This is a simplified version - in real implementation you'd track usage properly
    return false;
  };

  const getTrendIcon = (trend?: string | null) => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-600" />;
    return <Minus className="h-3 w-3 text-gray-400" />;
  };

  const getInjuryStatusColor = (status?: string | null) => {
    switch (status) {
      case 'Out': return 'bg-red-100 text-red-800 border-red-200';
      case 'Doubtful': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Questionable': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Probable': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Starting Lineup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Starting Lineup</span>
            <Badge variant="outline">Week 18</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {lineupSlots.map(({ position, count }) => {
              const playersInSlot = getPlayersForPosition(position, count);
              
              return Array.from({ length: count }, (_, index) => {
                const player = playersInSlot[index];
                const slotName = count > 1 ? `${position}${index + 1}` : position;
                
                return (
                  <div key={`${position}-${index}`} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 hover:border-gray-300 transition-colors">
                    {/* Position Badge */}
                    <div className="flex-shrink-0">
                      <div className="w-12 h-8 bg-slate-600 text-white text-xs font-bold flex items-center justify-center rounded">
                        {slotName}
                      </div>
                    </div>

                    {player ? (
                      <>
                        {/* Player Image */}
                        <div className="flex-shrink-0">
                          {player.imageUrl ? (
                            <img 
                              src={player.imageUrl} 
                              alt={player.name}
                              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling!.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center ${player.imageUrl ? 'hidden' : 'flex'}`}
                          >
                            <User className="h-6 w-6 text-gray-500" />
                          </div>
                        </div>

                        {/* Player Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-gray-900 truncate">{player.name}</h3>
                            <Badge variant="outline" className="text-xs">{player.team}</Badge>
                            {getTrendIcon(player.trend)}
                          </div>
                          <div className="flex items-center space-x-3 mt-1">
                            <span className="text-sm text-gray-600">{player.position}</span>
                            {player.injuryStatus && player.injuryStatus !== 'Healthy' && (
                              <Badge variant="outline" className={`text-xs ${getInjuryStatusColor(player.injuryStatus)}`}>
                                {player.injuryStatus}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Player Stats */}
                        <div className="flex-shrink-0 text-right">
                          <div className="text-lg font-bold text-gray-900">{player.avgPoints.toFixed(1)}</div>
                          <div className="text-xs text-gray-500">PPG</div>
                        </div>

                        {/* Projected Points */}
                        <div className="flex-shrink-0 text-right">
                          <div className="text-sm font-medium text-blue-600">{player.projectedPoints.toFixed(1)}</div>
                          <div className="text-xs text-gray-500">PROJ</div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Empty Slot */}
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-gray-400" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-gray-500 font-medium">Empty</div>
                          <div className="text-sm text-gray-400">Add a player</div>
                        </div>
                        <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                          + Add
                        </Button>
                      </>
                    )}
                  </div>
                );
              });
            })}
          </div>
        </CardContent>
      </Card>

      {/* Bench */}
      {bench.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bench</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bench.map((player) => (
                <div key={player.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                  {/* Player Image */}
                  <div className="flex-shrink-0">
                    {player.imageUrl ? (
                      <img 
                        src={player.imageUrl} 
                        alt={player.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling!.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className={`w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center ${player.imageUrl ? 'hidden' : 'flex'}`}
                    >
                      <User className="h-5 w-5 text-gray-500" />
                    </div>
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-gray-900 truncate">{player.name}</h3>
                      <Badge variant="outline" className="text-xs">{player.team}</Badge>
                      {getTrendIcon(player.trend)}
                    </div>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-sm text-gray-600">{player.position}</span>
                      {player.injuryStatus && player.injuryStatus !== 'Healthy' && (
                        <Badge variant="outline" className={`text-xs ${getInjuryStatusColor(player.injuryStatus)}`}>
                          {player.injuryStatus}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-medium text-gray-900">{player.avgPoints.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">PPG</div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm text-blue-600">{player.projectedPoints.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">PROJ</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}