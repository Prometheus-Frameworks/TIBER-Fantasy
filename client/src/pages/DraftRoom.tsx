import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Users, 
  Plus, 
  Trophy, 
  Target, 
  Clock, 
  ChevronRight,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle
} from "lucide-react";

interface Player {
  name: string;
  position: string;
  team: string;
  age: number | null;
  adjustedDynastyValue: number;
  overallADP: number;
  valueDiscrepancy: number;
  valueGrade: string;
  suggestedDraftTier: number;
}

interface DraftTeam {
  id: number;
  name: string;
  owner: string;
  roster: Player[];
  totalValue: number;
  currentPick?: number;
}

export default function DraftRoom() {
  const [teams, setTeams] = useState<DraftTeam[]>([]);
  const [currentPickOverall, setCurrentPickOverall] = useState(1);
  const [currentPickTeam, setCurrentPickTeam] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [draftStarted, setDraftStarted] = useState(false);

  // Fetch available players
  const { data: availablePlayers = [] } = useQuery({
    queryKey: ["/api/players/with-dynasty-value?limit=200"],
  });

  // Initialize draft teams
  useEffect(() => {
    if (teams.length === 0) {
      const initialTeams: DraftTeam[] = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        name: `Team ${i + 1}`,
        owner: `Owner ${i + 1}`,
        roster: [],
        totalValue: 0,
        currentPick: undefined
      }));
      setTeams(initialTeams);
    }
  }, [teams.length]);

  const getGradeTooltip = (grade: string, discrepancy: number, playerName: string) => {
    const baseTooltips = {
      STEAL: "Massive value vs ADP - High priority target",
      VALUE: "Good value vs ADP - Solid draft pick", 
      FAIR: "Fairly valued by market - Draft at ADP",
      OVERVALUED: "Market price exceeds value - Consider alternatives",
      AVOID: "Consensus cost outweighs return - High risk pick"
    };

    const baseTooltip = baseTooltips[grade as keyof typeof baseTooltips] || "Unknown grade";
    
    if (Math.abs(discrepancy) > 15) {
      const extremeRationale = discrepancy > 15 
        ? `${playerName} shows exceptional value with +${discrepancy.toFixed(1)} discrepancy - analytics heavily favor this pick`
        : `${playerName} appears significantly overvalued with ${discrepancy.toFixed(1)} discrepancy - market may be pricing in factors not reflected in current metrics`;
      return `${baseTooltip}\n\n${extremeRationale}`;
    }
    
    return baseTooltip;
  };

  const getGradeBadge = (grade: string, discrepancy: number, playerName: string) => {
    const gradeColors = {
      STEAL: "bg-green-500 text-white hover:bg-green-600",
      VALUE: "bg-yellow-500 text-black hover:bg-yellow-600", 
      FAIR: "bg-gray-500 text-white hover:bg-gray-600",
      OVERVALUED: "bg-orange-500 text-white hover:bg-orange-600",
      AVOID: "bg-red-500 text-white hover:bg-red-600"
    };
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={`${gradeColors[grade as keyof typeof gradeColors] || "bg-gray-300"} cursor-help transition-colors`}>
              {grade}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs p-3">
            <div className="space-y-2">
              <p className="font-medium">{grade} Grade</p>
              <p className="text-sm whitespace-pre-line">
                {getGradeTooltip(grade, discrepancy, playerName)}
              </p>
              <div className="text-xs text-gray-500">
                Value Discrepancy: {discrepancy > 0 ? '+' : ''}{discrepancy.toFixed(1)}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const filteredPlayers = availablePlayers.filter((player: Player) => {
    if (!draftStarted) return false;
    
    // Filter out already drafted players
    const isDrafted = teams.some(team => 
      team.roster.some(p => p.name === player.name)
    );
    if (isDrafted) return false;

    // Apply search and position filters
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPosition = !positionFilter || player.position === positionFilter;
    
    return matchesSearch && matchesPosition;
  });

  const draftPlayer = (player: Player) => {
    if (!draftStarted) return;
    
    const updatedTeams = teams.map((team, index) => {
      if (index === currentPickTeam) {
        const newRoster = [...team.roster, player];
        const newTotalValue = newRoster.reduce((sum, p) => sum + p.adjustedDynastyValue, 0);
        return {
          ...team,
          roster: newRoster,
          totalValue: newTotalValue
        };
      }
      return team;
    });

    setTeams(updatedTeams);
    setSelectedPlayer(null);

    // Advance to next pick
    const nextPickOverall = currentPickOverall + 1;
    const nextPickTeam = nextPickOverall <= 12 
      ? (currentPickTeam + 1) % 12
      : nextPickOverall <= 24
      ? 11 - ((nextPickOverall - 13) % 12)  // Snake draft reversal
      : (currentPickTeam + 1) % 12;

    setCurrentPickOverall(nextPickOverall);
    setCurrentPickTeam(nextPickTeam);
  };

  const startDraft = () => {
    setDraftStarted(true);
    setCurrentPickOverall(1);
    setCurrentPickTeam(0);
  };

  const resetDraft = () => {
    setDraftStarted(false);
    setCurrentPickOverall(1);
    setCurrentPickTeam(0);
    setTeams(teams.map(team => ({ ...team, roster: [], totalValue: 0 })));
  };

  const getCurrentRound = () => Math.ceil(currentPickOverall / 12);
  const getCurrentPickInRound = () => ((currentPickOverall - 1) % 12) + 1;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Banner */}
      <div className="draft-room-banner">
        <h2>Draft Helper (Beta)</h2>
        <p>Here's how your draft looks through Signal's lens.<br />
        You decide what to do with it.</p>
        <p><em>60% of the time, it works every time.</em></p>
        <p>This isn't a draft guide. It's a reflection.</p>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Draft Helper (Beta)
          </h1>
          <p className="text-gray-600">12-team dynasty startup draft simulation</p>
        </div>
        
        <div className="flex gap-3">
          {!draftStarted ? (
            <Button onClick={startDraft} size="lg" className="bg-green-600 hover:bg-green-700">
              <Trophy className="h-4 w-4 mr-2" />
              Start Draft
            </Button>
          ) : (
            <Button onClick={resetDraft} variant="outline" size="lg">
              Reset Draft
            </Button>
          )}
        </div>
      </div>

      {draftStarted && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Draft Status */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Draft Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <label className="text-sm font-medium text-blue-800">Current Pick</label>
                    <p className="text-2xl font-bold text-blue-900">#{currentPickOverall}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <label className="text-sm font-medium text-green-800">Round</label>
                    <p className="text-2xl font-bold text-green-900">{getCurrentRound()}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <label className="text-sm font-medium text-purple-800">Pick in Round</label>
                    <p className="text-2xl font-bold text-purple-900">{getCurrentPickInRound()}</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <label className="text-sm font-medium text-orange-800">On the Clock</label>
                    <p className="text-lg font-bold text-orange-900">{teams[currentPickTeam]?.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Available Players */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Available Players
                </CardTitle>
                <div className="flex gap-3 mt-4">
                  <Input
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={positionFilter} onValueChange={setPositionFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All</SelectItem>
                      <SelectItem value="QB">QB</SelectItem>
                      <SelectItem value="RB">RB</SelectItem>
                      <SelectItem value="WR">WR</SelectItem>
                      <SelectItem value="TE">TE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredPlayers.slice(0, 50).map((player: Player) => (
                    <div 
                      key={player.name}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedPlayer?.name === player.name 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{player.name}</span>
                          <span className="text-sm text-gray-600">{player.position}</span>
                          <span className="text-sm text-gray-500">{player.team}</span>
                          {getGradeBadge(player.valueGrade, player.valueDiscrepancy, player.name)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <span>Dynasty: {player.adjustedDynastyValue.toFixed(1)}</span>
                          <span>ADP: {player.overallADP.toFixed(1)}</span>
                          <span className={player.valueDiscrepancy >= 0 ? 'text-green-600' : 'text-red-600'}>
                            Δ{player.valueDiscrepancy > 0 ? '+' : ''}{player.valueDiscrepancy.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      {selectedPlayer?.name === player.name && (
                        <Button 
                          onClick={(e) => {
                            e.stopPropagation();
                            draftPlayer(player);
                          }}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Draft
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Leaderboard */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Team Values
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teams
                    .sort((a, b) => b.totalValue - a.totalValue)
                    .map((team, index) => (
                      <div 
                        key={team.id}
                        className={`p-3 rounded-lg border ${
                          team.id === teams[currentPickTeam]?.id 
                            ? 'bg-blue-50 border-blue-300' 
                            : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{team.name}</span>
                              {team.id === teams[currentPickTeam]?.id && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  On Clock
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              {team.roster.length} players
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">
                              {team.totalValue.toFixed(1)}
                            </div>
                            <div className="text-xs text-gray-500">
                              #{index + 1}
                            </div>
                          </div>
                        </div>
                        
                        {team.roster.length > 0 && (
                          <div className="mt-2 text-xs">
                            <div className="text-gray-600 mb-1">Recent picks:</div>
                            {team.roster.slice(-2).map((player, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <span>{player.name} ({player.position})</span>
                                <span className="font-medium">{player.adjustedDynastyValue.toFixed(1)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!draftStarted && (
        <div className="text-center py-12">
          <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Ready to Begin</h2>
          <p className="text-gray-600 mb-6">
            Start your 12-team dynasty startup draft with Signal value tracking
          </p>
          <Button onClick={startDraft} size="lg" className="bg-green-600 hover:bg-green-700">
            <Trophy className="h-5 w-5 mr-2" />
            Start Draft Helper
          </Button>
        </div>
      )}
    </div>
  );
}