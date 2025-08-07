import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, TrendingDown, Target, Users } from 'lucide-react';

interface WRCompassData {
  name: string;
  team: string;
  position: string;
  age: number;
  compass: {
    north: number;
    east: number;
    south: number;
    west: number;
    score: number;
    tier: string;
  };
  targets: number;
  receptions: number;
  receiving_yards: number;
  receiving_touchdowns: number;
  adp?: number;
}

interface WRCompassResponse {
  position: string;
  algorithm: string;
  source: string;
  rankings: WRCompassData[];
}

const getTierColor = (tier: string) => {
  switch (tier) {
    case 'Elite': return 'bg-purple-500';
    case 'High-End': return 'bg-blue-500';
    case 'Solid': return 'bg-green-500';
    case 'Upside': return 'bg-yellow-500';
    case 'Deep': return 'bg-gray-500';
    default: return 'bg-gray-500';
  }
};

const getScoreColor = (score: number) => {
  if (score >= 8.0) return 'text-purple-600';
  if (score >= 7.0) return 'text-blue-600';
  if (score >= 6.0) return 'text-green-600';
  if (score >= 5.0) return 'text-yellow-600';
  return 'text-gray-600';
};

const getCompassIcon = (direction: string) => {
  switch (direction) {
    case 'north': return <TrendingUp className="w-4 h-4" />;
    case 'east': return <Target className="w-4 h-4" />;
    case 'south': return <TrendingDown className="w-4 h-4" />;
    case 'west': return <Users className="w-4 h-4" />;
    default: return <Target className="w-4 h-4" />;
  }
};

export default function WRCompass() {
  const [wrData, setWrData] = useState<WRCompassResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchWRCompassData();
  }, []);

  const fetchWRCompassData = async () => {
    try {
      setLoading(true);
      console.log('WRCompass: Fetching WR data from /api/compass/wr');
      const response = await fetch('/api/compass/wr');
      if (!response.ok) {
        throw new Error(`Failed to fetch WR compass data: ${response.status}`);
      }
      const data = await response.json();
      console.log('WRCompass: Successfully loaded', data.rankings?.length || 0, 'WRs');
      
      // Guard against malformed data
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format received');
      }
      
      if (!Array.isArray(data.rankings)) {
        throw new Error('Rankings data is not an array');
      }
      
      setWrData(data);
    } catch (err) {
      console.error('WRCompass: Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Guard against malformed data in filtering
  const filteredWRs = (wrData?.rankings && Array.isArray(wrData.rankings)) 
    ? wrData.rankings.filter(wr => {
        // Guard against malformed player objects
        if (!wr || typeof wr !== 'object') return false;
        if (!wr.name || !wr.team) return false;
        
        return wr.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               wr.team.toLowerCase().includes(searchTerm.toLowerCase());
      })
    : [];

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading WR Player Compass...</div>
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
            <Button onClick={fetchWRCompassData} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <Button 
          variant="outline" 
          onClick={() => window.history.back()} 
          className="flex items-center gap-2"
        >
          ← Back
        </Button>
        <div className="flex-1" />
      </div>
      
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">WR Player Compass</h1>
        <p className="text-gray-600">4-Directional Dynasty Evaluation System</p>
        <div className="text-sm text-gray-500">
          Analyzing {wrData?.rankings?.length || 0} Wide Receivers
        </div>
      </div>

      {/* Methodology Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            WR Compass Methodology
          </CardTitle>
          <CardDescription>
            Equal 25% weighting across four directional components with WR-specific factors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
              {getCompassIcon('north')}
              <div>
                <div className="font-semibold">NORTH</div>
                <div className="text-sm text-gray-600">Volume/Talent</div>
                <div className="text-xs text-gray-500">Targets, receptions, efficiency</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              {getCompassIcon('east')}
              <div>
                <div className="font-semibold">EAST</div>
                <div className="text-sm text-gray-600">Environment</div>
                <div className="text-xs text-gray-500">Offense scheme, QB play</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
              {getCompassIcon('south')}
              <div>
                <div className="font-semibold">SOUTH</div>
                <div className="text-sm text-gray-600">Risk</div>
                <div className="text-xs text-gray-500">Age, injury history</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
              {getCompassIcon('west')}
              <div>
                <div className="font-semibold">WEST</div>
                <div className="text-sm text-gray-600">Value</div>
                <div className="text-xs text-gray-500">Dynasty value, ADP</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search wide receivers by name or team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* WR Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWRs.map((wr) => (
          <Card key={wr.name} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{wr.name}</CardTitle>
                <Badge className={`${getTierColor(wr.compass.tier)} text-white`}>
                  {wr.compass.tier}
                </Badge>
              </div>
              <CardDescription>
                {wr.team} • Age {wr.age}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Compass Score */}
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getScoreColor(wr.compass.score)}`}>
                    {wr.compass.score}
                  </div>
                  <div className="text-sm text-gray-500">Compass Score</div>
                </div>

                {/* Compass Directions */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-red-50 rounded">
                    <div className="flex items-center justify-center gap-1">
                      {getCompassIcon('north')}
                      <span className="text-sm font-semibold">N</span>
                    </div>
                    <div className="text-sm">{wr.compass.north}</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <div className="flex items-center justify-center gap-1">
                      {getCompassIcon('east')}
                      <span className="text-sm font-semibold">E</span>
                    </div>
                    <div className="text-sm">{wr.compass.east}</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="flex items-center justify-center gap-1">
                      {getCompassIcon('south')}
                      <span className="text-sm font-semibold">S</span>
                    </div>
                    <div className="text-sm">{wr.compass.south}</div>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 rounded">
                    <div className="flex items-center justify-center gap-1">
                      {getCompassIcon('west')}
                      <span className="text-sm font-semibold">W</span>
                    </div>
                    <div className="text-sm">{wr.compass.west}</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Targets: {wr.targets} | Rec: {wr.receptions}</div>
                  <div>Yards: {wr.receiving_yards} | TDs: {wr.receiving_touchdowns}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredWRs.length === 0 && !loading && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-gray-500">No wide receivers found matching your search.</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}