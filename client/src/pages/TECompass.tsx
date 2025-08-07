import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, Target, Shield, DollarSign, AlertCircle } from 'lucide-react';

interface TECompassData {
  name: string;
  team: string;
  position: string;
  age: number;
  rookie_status: string;
  compass: {
    north: number;
    east: number;
    south: number;
    west: number;
    score: number;
    tier: string;
  };
  dynastyScore: number;
  games_played: number;
  targets: number;
  receptions: number;
  receiving_yards: number;
  receiving_touchdowns: number;
  red_zone_targets: number;
  pff_receiving_grade: number;
  pff_pass_blocking_grade: number;
  notes: string;
}

interface TECompassResponse {
  position: string;
  algorithm: string;
  source: string;
  rankings: TECompassData[];
  metadata: {
    methodology: string;
    weights: {
      north: string;
      east: string;
      south: string;
      west: string;
    };
    totalPlayers: number;
    lastUpdated: string;
  };
}

const getTierColor = (tier: string) => {
  switch (tier) {
    case 'Elite': return 'bg-purple-500';
    case 'Excellent': return 'bg-blue-500';
    case 'Solid': return 'bg-green-500';
    case 'Decent': return 'bg-yellow-500';
    default: return 'bg-gray-500';
  }
};

const getScoreColor = (score: number) => {
  if (score >= 8.5) return 'text-purple-600 font-bold';
  if (score >= 7.5) return 'text-blue-600 font-semibold';
  if (score >= 6.5) return 'text-green-600 font-semibold';
  if (score >= 5.5) return 'text-yellow-600';
  return 'text-gray-600';
};

const getCompassIcon = (direction: string) => {
  switch (direction) {
    case 'north': return <TrendingUp className="w-4 h-4 text-red-500" />;
    case 'east': return <Target className="w-4 h-4 text-blue-500" />;
    case 'south': return <Shield className="w-4 h-4 text-green-500" />;
    case 'west': return <DollarSign className="w-4 h-4 text-yellow-500" />;
    default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
  }
};

const getDirectionLabel = (direction: string) => {
  switch (direction) {
    case 'north': return 'Volume/Talent';
    case 'east': return 'Environment';
    case 'south': return 'Risk';
    case 'west': return 'Value';
    default: return direction;
  }
};

export default function TECompass() {
  const [teData, setTeData] = useState<TECompassResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTECompassData();
  }, []);

  const fetchTECompassData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/compass/te');
      if (!response.ok) {
        throw new Error('Failed to fetch TE compass data');
      }
      const data = await response.json();
      setTeData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const filteredTEs = teData?.rankings.filter(te =>
    te.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    te.team.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading TE Player Compass...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-red-600">Error: {error}</div>
            <Button onClick={fetchTECompassData} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">TE Player Compass</h1>
        <p className="text-gray-600">4-Directional Dynasty Evaluation System</p>
        <div className="text-sm text-gray-500">
          Analyzing {teData?.metadata.totalPlayers || 0} Tight Ends
        </div>
      </div>

      {/* Methodology Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            TE Compass Methodology
          </CardTitle>
          <CardDescription>
            Equal 25% weighting across four directional components with TE-specific factors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
              {getCompassIcon('north')}
              <div>
                <div className="font-semibold">NORTH</div>
                <div className="text-sm text-gray-600">Volume/Talent</div>
                <div className="text-xs text-gray-500">Red zone targets, receptions, efficiency</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              {getCompassIcon('east')}
              <div>
                <div className="font-semibold">EAST</div>
                <div className="text-sm text-gray-600">Environment</div>
                <div className="text-xs text-gray-500">Offense scheme, blocking grade impact</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
              {getCompassIcon('south')}
              <div>
                <div className="font-semibold">SOUTH</div>
                <div className="text-sm text-gray-600">Risk</div>
                <div className="text-xs text-gray-500">Age penalties, injury history</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
              {getCompassIcon('west')}
              <div>
                <div className="font-semibold">WEST</div>
                <div className="text-sm text-gray-600">Value</div>
                <div className="text-xs text-gray-500">Positional scarcity premium</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search tight ends by name or team..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* TE Rankings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTEs.map((te, index) => (
          <Card key={te.name} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{te.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    {te.team} • Age {te.age}
                    {te.rookie_status === 'Rookie' && (
                      <Badge variant="outline" className="text-xs">Rookie</Badge>
                    )}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getScoreColor(te.compass.score)}`}>
                    {te.compass.score.toFixed(1)}
                  </div>
                  <Badge className={`${getTierColor(te.compass.tier)} text-white`}>
                    {te.compass.tier}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Compass Directions */}
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(te.compass)
                  .filter(([key]) => ['north', 'east', 'south', 'west'].includes(key))
                  .map(([direction, score]) => (
                    <div key={direction} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      {getCompassIcon(direction)}
                      <div className="flex-1">
                        <div className="text-xs text-gray-600">{getDirectionLabel(direction)}</div>
                        <div className="font-semibold">{(score as number).toFixed(1)}</div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Targets:</span> {te.targets}
                </div>
                <div>
                  <span className="text-gray-600">Receptions:</span> {te.receptions}
                </div>
                <div>
                  <span className="text-gray-600">Yards:</span> {te.receiving_yards}
                </div>
                <div>
                  <span className="text-gray-600">TDs:</span> {te.receiving_touchdowns}
                </div>
                <div>
                  <span className="text-gray-600">RZ Targets:</span> {te.red_zone_targets}
                </div>
                <div>
                  <span className="text-gray-600">Games:</span> {te.games_played}
                </div>
              </div>

              {/* PFF Grades */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-blue-50 rounded">
                  <div className="text-xs text-gray-600">PFF Receiving</div>
                  <div className="font-semibold">{te.pff_receiving_grade.toFixed(1)}</div>
                </div>
                <div className="p-2 bg-green-50 rounded">
                  <div className="text-xs text-gray-600">PFF Blocking</div>
                  <div className="font-semibold">{te.pff_pass_blocking_grade.toFixed(1)}</div>
                </div>
              </div>

              {/* Notes */}
              {te.notes && (
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  {te.notes}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTEs.length === 0 && searchTerm && (
        <div className="text-center py-8">
          <p className="text-gray-500">No tight ends found matching "{searchTerm}"</p>
        </div>
      )}
    </div>
  );
}