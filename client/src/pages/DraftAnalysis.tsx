import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Search, Filter } from "lucide-react";
import { Link } from "wouter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  rank?: number; // Dynasty rank derived from sorted adjustedDynastyValue
}

export default function DraftAnalysis() {
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [sortField, setSortField] = useState<"rank" | "adjustedDynastyValue" | "valueDiscrepancy">("rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["/api/players/with-dynasty-value?limit=200"],
  });

  // Get unique teams for filter dropdown
  const uniqueTeams = useMemo(() => {
    const teams = [...new Set(players.map((p: Player) => p.team).filter(Boolean))];
    return teams.sort();
  }, [players]);

  // Filter and sort players with rank injection
  const filteredPlayers = useMemo(() => {
    // First, add rank to all players based on adjustedDynastyValue (higher value = better rank)
    const playersWithRank = [...players]
      .sort((a: Player, b: Player) => (b.adjustedDynastyValue || 0) - (a.adjustedDynastyValue || 0))
      .map((player: Player, index: number) => ({
        ...player,
        rank: index + 1 // Dynasty rank (1 = best)
      }));

    // Apply filters
    let filtered = playersWithRank.filter((player: Player) => {
      // Search term filter
      if (searchTerm && !player.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Position filter
      if (positionFilter !== "ALL" && player.position !== positionFilter) {
        return false;
      }
      
      // Grade filter
      if (gradeFilter !== "ALL" && player.valueGrade !== gradeFilter) {
        return false;
      }
      
      // Team filter
      if (teamFilter !== "ALL" && player.team !== teamFilter) {
        return false;
      }
      
      return true;
    });

    // Sort filtered players
    filtered.sort((a: Player, b: Player) => {
      let aVal: number, bVal: number;
      
      if (sortField === "rank") {
        aVal = a.rank || 999;
        bVal = b.rank || 999;
      } else {
        aVal = a[sortField] || 0;
        bVal = b[sortField] || 0;
      }
      
      if (sortDirection === "desc") {
        return bVal - aVal;
      } else {
        return aVal - bVal;
      }
    });

    return filtered;
  }, [players, searchTerm, positionFilter, gradeFilter, teamFilter, sortField, sortDirection]);

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

  const handleSort = (field: "rank" | "adjustedDynastyValue" | "valueDiscrepancy") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      // Default sort direction based on field type
      setSortDirection(field === "rank" ? "asc" : "desc");
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setPositionFilter("ALL");
    setGradeFilter("ALL");
    setTeamFilter("ALL");
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Dynasty Draft Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Positions</SelectItem>
                <SelectItem value="QB">QB</SelectItem>
                <SelectItem value="RB">RB</SelectItem>
                <SelectItem value="WR">WR</SelectItem>
                <SelectItem value="TE">TE</SelectItem>
              </SelectContent>
            </Select>

            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Grades</SelectItem>
                <SelectItem value="STEAL">STEAL</SelectItem>
                <SelectItem value="VALUE">VALUE</SelectItem>
                <SelectItem value="FAIR">FAIR</SelectItem>
                <SelectItem value="OVERVALUED">OVERVALUED</SelectItem>
                <SelectItem value="AVOID">AVOID</SelectItem>
              </SelectContent>
            </Select>

            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Teams</SelectItem>
                {uniqueTeams.map((team) => (
                  <SelectItem key={team} value={team}>{team}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={clearFilters}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Clear
            </Button>
          </div>

          {/* Results Summary */}
          <div className="mb-4 text-sm text-gray-600">
            Showing {filteredPlayers.length} of {players.length} players
          </div>

          {/* Players Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th 
                    className="border border-gray-200 px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("rank")}
                  >
                    <div className="flex items-center gap-1">
                      Rank
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </th>
                  <th className="border border-gray-200 px-4 py-2 text-left">Name</th>
                  <th className="border border-gray-200 px-4 py-2 text-left">Pos</th>
                  <th className="border border-gray-200 px-4 py-2 text-left">Team</th>
                  <th className="border border-gray-200 px-4 py-2 text-left">Age</th>
                  <th 
                    className="border border-gray-200 px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("adjustedDynastyValue")}
                  >
                    <div className="flex items-center gap-1">
                      Dynasty Value
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </th>
                  <th className="border border-gray-200 px-4 py-2 text-left">ADP</th>
                  <th 
                    className="border border-gray-200 px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("valueDiscrepancy")}
                  >
                    <div className="flex items-center gap-1">
                      Discrepancy
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </th>
                  <th className="border border-gray-200 px-4 py-2 text-left">Grade</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player: Player, index: number) => (
                  <tr key={`${player.name}-${player.position}`} className="hover-lift cursor-pointer">
                    <td className="border border-gray-200 px-4 py-2 font-bold text-center">
                      {player.rank}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 font-medium">
                      <Link 
                        href={`/player/${player.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {player.name}
                      </Link>
                    </td>
                    <td className="border border-gray-200 px-4 py-2">{player.position}</td>
                    <td className="border border-gray-200 px-4 py-2">{player.team}</td>
                    <td className="border border-gray-200 px-4 py-2">{player.age || 'N/A'}</td>
                    <td className="border border-gray-200 px-4 py-2">{player.adjustedDynastyValue?.toFixed(1)}</td>
                    <td className="border border-gray-200 px-4 py-2">{player.overallADP?.toFixed(1)}</td>
                    <td className="border border-gray-200 px-4 py-2">
                      <span className={player.valueDiscrepancy >= 0 ? "text-green-600" : "text-red-600"}>
                        {player.valueDiscrepancy > 0 ? '+' : ''}{player.valueDiscrepancy?.toFixed(1)}
                      </span>
                    </td>
                    <td className="border border-gray-200 px-4 py-2">
                      {getGradeBadge(player.valueGrade, player.valueDiscrepancy, player.name)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPlayers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No players match your current filters
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}