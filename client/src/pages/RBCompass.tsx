import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, TrendingDown, Target, Users } from 'lucide-react';

interface RBCompassData {
  player_name: string;
  team: string;
  age: number;
  compass_scores: {
    north: number;
    east: number;
    south: number;
    west: number;
    final_score: number;
    tier: string;
  };
  season_stats: {
    total_carries: number;
    yac_per_attempt: number;
    breakaway_rate: number;
    fumble_rate: number;
  };
}

interface RBCompassResponse {
  total_players: number;
  rb_compass: RBCompassData[];
  methodology: {
    north: string;
    east: string;
    south: string;
    west: string;
  };
}

const getTierColor = (tier: string) => {
  switch (tier) {
    case 'Elite': return 'bg-purple-500';
    case 'Solid': return 'bg-blue-500';
    case 'Depth': return 'bg-green-500';
    case 'Bench': return 'bg-yellow-500';
    default: return 'bg-gray-500';
  }
};

const getScoreColor = (score: number) => {
  if (score >= 7.5) return 'text-purple-600';
  if (score >= 6.5) return 'text-blue-600';
  if (score >= 5.5) return 'text-green-600';
  if (score >= 4.5) return 'text-yellow-600';
  return 'text-gray-600';
};

export default function RBCompass() {
  const [rbData, setRbData] = useState<RBCompassResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchRBCompassData();
  }, []);

  const fetchRBCompassData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rb-compass');
      if (!response.ok) {
        throw new Error('Failed to fetch RB compass data');
      }
      const data = await response.json();
      setRbData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const filteredRBs = rbData?.rb_compass.filter(rb =>
    rb.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rb.team.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading RB Player Compass...</div>
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
            <Button onClick={fetchRBCompassData} className="mt-4">
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
        <h1 className="text-3xl font-bold">RB Player Compass</h1>
        <p className="text-gray-600">4-Directional Dynasty Evaluation System</p>
        <div className="text-sm text-gray-500">
          Analyzing {rbData?.total_players || 0} Running Backs
        </div>
      </div>

      {/* Methodology Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Compass Methodology
          </CardTitle>
          <CardDescription>
            Equal 25% weighting across all four directions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong className="text-purple-600">🧭 NORTH (Volume/Talent):</strong>
              <p className="text-gray-600 mt-1">{rbData?.methodology.north}</p>
            </div>
            <div>
              <strong className="text-blue-600">🧭 EAST (Environment):</strong>
              <p className="text-gray-600 mt-1">{rbData?.methodology.east}</p>
            </div>
            <div>
              <strong className="text-red-600">🧭 SOUTH (Risk):</strong>
              <p className="text-gray-600 mt-1">{rbData?.methodology.south}</p>
            </div>
            <div>
              <strong className="text-green-600">🧭 WEST (Value):</strong>
              <p className="text-gray-600 mt-1">{rbData?.methodology.west}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search RBs by name or team..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* RB Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredRBs.map((rb, index) => (
          <Card key={rb.player_name} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{rb.player_name}</CardTitle>
                  <CardDescription>
                    {rb.team} • Age {rb.age} • #{index + 1} Overall
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getScoreColor(rb.compass_scores.final_score)}`}>
                    {rb.compass_scores.final_score}
                  </div>
                  <Badge className={getTierColor(rb.compass_scores.tier)}>
                    {rb.compass_scores.tier}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Compass Scores */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center">
                  <div className="text-purple-600 font-semibold">{rb.compass_scores.north}</div>
                  <div className="text-xs text-gray-500">NORTH</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-600 font-semibold">{rb.compass_scores.east}</div>
                  <div className="text-xs text-gray-500">EAST</div>
                </div>
                <div className="text-center">
                  <div className="text-red-600 font-semibold">{rb.compass_scores.south}</div>
                  <div className="text-xs text-gray-500">SOUTH</div>
                </div>
                <div className="text-center">
                  <div className="text-green-600 font-semibold">{rb.compass_scores.west}</div>
                  <div className="text-xs text-gray-500">WEST</div>
                </div>
              </div>

              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div>Carries: {rb.season_stats.total_carries}</div>
                <div>YAC/Att: {rb.season_stats.yac_per_attempt}</div>
                <div>Breakaway: {Math.round(rb.season_stats.breakaway_rate * 100)}%</div>
                <div>Fumble Rate: {(rb.season_stats.fumble_rate * 1000).toFixed(1)}‰</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRBs.length === 0 && searchTerm && (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            No RBs found matching "{searchTerm}"
          </CardContent>
        </Card>
      )}
    </div>
  );
}