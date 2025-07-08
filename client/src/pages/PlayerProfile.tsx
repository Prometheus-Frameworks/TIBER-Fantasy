import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Target, Award, BarChart3 } from "lucide-react";
import { Link } from "wouter";

interface PlayerData {
  name: string;
  position: string;
  team: string;
  age: number | null;
  adjustedDynastyValue: number;
  overallADP: number;
  positionalADP?: string;
  valueDiscrepancy: number;
  valueGrade: string;
  suggestedDraftTier: number;
}

export default function PlayerProfile() {
  const { id } = useParams();
  
  // Fetch player data by searching for the player name
  const { data: players = [], isLoading, error } = useQuery({
    queryKey: ["/api/players/with-dynasty-value?limit=500"],
  });

  // Find the specific player by converting URL-safe name back to actual name
  const playerName = id?.replace(/-/g, ' ') || '';
  const player = players.find((p: PlayerData) => 
    p.name.toLowerCase() === playerName.toLowerCase()
  );

  const getGradeBadge = (grade: string) => {
    const gradeColors = {
      STEAL: "bg-green-500 text-white",
      VALUE: "bg-yellow-500 text-black", 
      FAIR: "bg-gray-500 text-white",
      OVERVALUED: "bg-orange-500 text-white",
      AVOID: "bg-red-500 text-white"
    };
    
    return (
      <Badge className={gradeColors[grade as keyof typeof gradeColors] || "bg-gray-300"}>
        {grade}
      </Badge>
    );
  };

  const getGradeDescription = (grade: string) => {
    const descriptions = {
      STEAL: "Significantly undervalued - priority draft target",
      VALUE: "Moderately undervalued - good draft value",
      FAIR: "Fairly valued by the market",
      OVERVALUED: "Moderately overvalued - draft carefully",
      AVOID: "Significantly overvalued - avoid drafting"
    };
    return descriptions[grade as keyof typeof descriptions] || "Unknown grade";
  };

  const getTierDescription = (tier: number) => {
    const tiers = {
      1: "Tier 1 - Elite Targets (STEAL RB/WR)",
      2: "Tier 2 - Strong Targets (STEAL QB/TE)",
      3: "Tier 3 - Value Picks",
      4: "Tier 4 - Fair Value",
      5: "Tier 5 - Overvalued",
      6: "Tier 6 - Avoid"
    };
    return tiers[tier as keyof typeof tiers] || `Tier ${tier}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link href="/draft-analysis">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Analysis
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <h2 className="text-xl font-semibold mb-2">Player Not Found</h2>
              <p className="text-gray-600 mb-4">
                Could not find player data for "{playerName}"
              </p>
              <Link href="/draft-analysis">
                <Button>Return to Draft Analysis</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/draft-analysis">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Analysis
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{player.name}</h1>
          <p className="text-gray-600">{player.position} • {player.team}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Player Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Player Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Position</label>
                <p className="text-lg font-semibold">{player.position}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Team</label>
                <p className="text-lg font-semibold">{player.team}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Age</label>
                <p className="text-lg font-semibold">{player.age || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Draft Tier</label>
                <p className="text-sm text-gray-700">{getTierDescription(player.suggestedDraftTier)}</p>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <label className="text-sm font-medium text-gray-600">Value Grade</label>
              <div className="flex items-center gap-3 mt-1">
                {getGradeBadge(player.valueGrade)}
                <span className="text-sm text-gray-600">
                  {getGradeDescription(player.valueGrade)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dynasty Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Dynasty Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <label className="text-sm font-medium text-blue-800">Adjusted Dynasty Value</label>
                <p className="text-2xl font-bold text-blue-900">{player.adjustedDynastyValue.toFixed(1)}</p>
                <p className="text-xs text-blue-700">Age-adjusted dynasty score</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="text-sm font-medium text-gray-700">Overall ADP</label>
                  <p className="text-xl font-bold text-gray-900">{player.overallADP.toFixed(1)}</p>
                  <p className="text-xs text-gray-600">Market draft position</p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="text-sm font-medium text-gray-700">Positional ADP</label>
                  <p className="text-xl font-bold text-gray-900">
                    {player.positionalADP || `${player.position}${Math.floor(player.overallADP/4) + 1}`}
                  </p>
                  <p className="text-xs text-gray-600">Position ranking</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Value Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Value Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-red-50 p-4 rounded-lg">
              <label className="text-sm font-medium text-gray-700">Value Discrepancy</label>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${
                  player.valueDiscrepancy >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {player.valueDiscrepancy > 0 ? '+' : ''}{player.valueDiscrepancy.toFixed(1)}
                </span>
                <span className="text-sm text-gray-600">points</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {player.valueDiscrepancy >= 0 
                  ? 'Dynasty value exceeds market price' 
                  : 'Market price exceeds dynasty value'
                }
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Market Value:</span>
                <span className="font-medium ml-2">{(100 - player.overallADP * 2).toFixed(1)}</span>
              </div>
              <div>
                <span className="text-gray-600">Our Value:</span>
                <span className="font-medium ml-2">{player.adjustedDynastyValue.toFixed(1)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dynasty Trend Chart Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Dynasty Value Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="font-medium text-gray-700 mb-2">Dynasty Trend Chart</h3>
              <p className="text-sm text-gray-500 mb-4">
                Historical dynasty value progression over time
              </p>
              <div className="bg-white p-4 rounded border-2 border-dashed border-gray-300">
                <p className="text-xs text-gray-400">
                  Chart will show {player.name}'s dynasty value changes across multiple seasons,
                  tracking age decay, performance improvements, and market perception shifts.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Draft Strategy */}
      <Card>
        <CardHeader>
          <CardTitle>Draft Strategy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Recommendation</h3>
            {player.valueGrade === 'STEAL' && (
              <p className="text-blue-800">
                <strong>Priority Target:</strong> {player.name} is significantly undervalued with a +{player.valueDiscrepancy.toFixed(1)} 
                discrepancy. Target in {getTierDescription(player.suggestedDraftTier)} of your draft.
              </p>
            )}
            {player.valueGrade === 'VALUE' && (
              <p className="text-blue-800">
                <strong>Good Value:</strong> {player.name} offers solid value with a +{player.valueDiscrepancy.toFixed(1)} 
                discrepancy. Consider targeting in middle rounds.
              </p>
            )}
            {player.valueGrade === 'FAIR' && (
              <p className="text-blue-800">
                <strong>Market Price:</strong> {player.name} is fairly valued by the market. 
                Draft at ADP if fits your roster construction.
              </p>
            )}
            {player.valueGrade === 'OVERVALUED' && (
              <p className="text-orange-800">
                <strong>Proceed Carefully:</strong> {player.name} may be overvalued with a {player.valueDiscrepancy.toFixed(1)} 
                discrepancy. Consider waiting or targeting other options.
              </p>
            )}
            {player.valueGrade === 'AVOID' && (
              <p className="text-red-800">
                <strong>Avoid:</strong> {player.name} is significantly overvalued with a {player.valueDiscrepancy.toFixed(1)} 
                discrepancy. Look for better value elsewhere.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}