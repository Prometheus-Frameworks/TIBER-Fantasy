/**
 * Player Compass - Dynamic Player Evaluation Interface
 * Navigate your dynasty decisions with context-aware player guidance
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Compass, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  AlertTriangle,
  Users,
  Clock,
  Target,
  Star
} from 'lucide-react';

interface CompassProfile {
  playerId: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  tier: 'Elite' | 'High-End' | 'Solid' | 'Upside' | 'Deep';
  contextTags: string[];
  scenarios: {
    contendingTeam: number;
    rebuildingTeam: number;
    redraftAppeal: number;
    dynastyCeiling: number;
    injuryReplacement: number;
    playoffReliability: number;
  };
  keyInsights: string[];
  ageContext: {
    age: number;
    primeWindow: string;
    yearsRemaining: number;
  };
  riskFactors: string[];
  opportunityMetrics: {
    usageSecurity: number;
    targetCompetition: string;
    environmentStability: number;
  };
}

interface CompassFilters {
  position: string;
  tier: string;
  minAge: string;
  maxAge: string;
  scenario: string;
  minScenarioValue: string;
}

export default function PlayerCompass() {
  const [filters, setFilters] = useState<CompassFilters>({
    position: '',
    tier: '',
    minAge: '',
    maxAge: '',
    scenario: '',
    minScenarioValue: ''
  });

  const [selectedProfile, setSelectedProfile] = useState<CompassProfile | null>(null);

  // Fetch compass profiles with filters
  const { data: compassData, isLoading, error } = useQuery({
    queryKey: ['/api/compass/players', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.position) params.append('positions', filters.position);
      if (filters.tier) params.append('tiers', filters.tier);
      if (filters.minAge) params.append('minAge', filters.minAge);
      if (filters.maxAge) params.append('maxAge', filters.maxAge);
      if (filters.scenario && filters.minScenarioValue) {
        params.append('scenario', filters.scenario);
        params.append('minScenarioValue', filters.minScenarioValue);
      }
      
      const response = await fetch(`/api/compass/players?${params}`);
      if (!response.ok) throw new Error('Failed to fetch compass data');
      return response.json();
    }
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white';
      case 'High-End': return 'bg-gradient-to-r from-green-400 to-blue-500 text-white';
      case 'Solid': return 'bg-gradient-to-r from-blue-400 to-purple-500 text-white';
      case 'Upside': return 'bg-gradient-to-r from-purple-400 to-pink-500 text-white';
      case 'Deep': return 'bg-gradient-to-r from-gray-400 to-gray-600 text-white';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const getPositionIcon = (position: string) => {
    switch (position) {
      case 'QB': return '🎯';
      case 'RB': return '🏃';
      case 'WR': return '🏈';
      case 'TE': return '⚡';
      default: return '🏟️';
    }
  };

  const getTagIcon = (tag: string) => {
    if (tag.includes('Win-Now')) return <TrendingUp className="w-3 h-3" />;
    if (tag.includes('Dynasty')) return <Star className="w-3 h-3" />;
    if (tag.includes('Risk') || tag.includes('Concern')) return <AlertTriangle className="w-3 h-3" />;
    if (tag.includes('Secure')) return <Shield className="w-3 h-3" />;
    if (tag.includes('Competition')) return <Users className="w-3 h-3" />;
    return <Target className="w-3 h-3" />;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center space-x-2">
            <Compass className="w-6 h-6 animate-spin" />
            <span>Loading Player Compass...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span>Error loading Player Compass data</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profiles = compassData?.profiles || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-2">
          <Compass className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Player Compass</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Navigate your dynasty decisions with context-aware player guidance. 
          No rigid rankings - just flexible evaluation that serves your strategy.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>Navigation Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Select
                value={filters.position}
                onValueChange={(value) => setFilters(prev => ({ ...prev, position: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Positions</SelectItem>
                  <SelectItem value="QB">QB</SelectItem>
                  <SelectItem value="RB">RB</SelectItem>
                  <SelectItem value="WR">WR</SelectItem>
                  <SelectItem value="TE">TE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tier">Tier</Label>
              <Select
                value={filters.tier}
                onValueChange={(value) => setFilters(prev => ({ ...prev, tier: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Tiers</SelectItem>
                  <SelectItem value="Elite">Elite</SelectItem>
                  <SelectItem value="High-End">High-End</SelectItem>
                  <SelectItem value="Solid">Solid</SelectItem>
                  <SelectItem value="Upside">Upside</SelectItem>
                  <SelectItem value="Deep">Deep</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minAge">Min Age</Label>
              <Input
                id="minAge"
                type="number"
                placeholder="21"
                value={filters.minAge}
                onChange={(e) => setFilters(prev => ({ ...prev, minAge: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxAge">Max Age</Label>
              <Input
                id="maxAge"
                type="number"
                placeholder="35"
                value={filters.maxAge}
                onChange={(e) => setFilters(prev => ({ ...prev, maxAge: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scenario">Scenario</Label>
              <Select
                value={filters.scenario}
                onValueChange={(value) => setFilters(prev => ({ ...prev, scenario: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any Scenario</SelectItem>
                  <SelectItem value="contendingTeam">Contending</SelectItem>
                  <SelectItem value="rebuildingTeam">Rebuilding</SelectItem>
                  <SelectItem value="dynastyCeiling">Dynasty Ceiling</SelectItem>
                  <SelectItem value="redraftAppeal">Redraft Appeal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minScenarioValue">Min Value</Label>
              <Input
                id="minScenarioValue"
                type="number"
                step="0.1"
                placeholder="7.0"
                value={filters.minScenarioValue}
                onChange={(e) => setFilters(prev => ({ ...prev, minScenarioValue: e.target.value }))}
                disabled={!filters.scenario}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <Button
              variant="outline"
              onClick={() => setFilters({
                position: '',
                tier: '',
                minAge: '',
                maxAge: '',
                scenario: '',
                minScenarioValue: ''
              })}
            >
              Clear Filters
            </Button>
            <span className="text-sm text-muted-foreground">
              {profiles.length} players found
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Player List */}
        <div className="lg:col-span-2 space-y-4">
          {profiles.map((profile: CompassProfile) => (
            <Card 
              key={profile.playerId}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedProfile?.playerId === profile.playerId ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedProfile(profile)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">{getPositionIcon(profile.position)}</div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{profile.name}</h3>
                        <Badge variant="outline">{profile.team}</Badge>
                        <Badge variant="outline">{profile.position}</Badge>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge className={getTierColor(profile.tier)}>
                          {profile.tier}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Age {profile.ageContext.age} • {profile.ageContext.primeWindow}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-semibold text-blue-600">
                      {profile.scenarios.dynastyCeiling.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Dynasty Ceiling</div>
                  </div>
                </div>

                {/* Context Tags */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {profile.contextTags.slice(0, 4).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs flex items-center space-x-1">
                      {getTagIcon(tag)}
                      <span>{tag}</span>
                    </Badge>
                  ))}
                  {profile.contextTags.length > 4 && (
                    <Badge variant="secondary" className="text-xs">
                      +{profile.contextTags.length - 4} more
                    </Badge>
                  )}
                </div>

                {/* Quick Scenarios */}
                <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                  <div className="text-center">
                    <div className="font-medium">{profile.scenarios.contendingTeam.toFixed(1)}</div>
                    <div className="text-muted-foreground">Contending</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{profile.scenarios.rebuildingTeam.toFixed(1)}</div>
                    <div className="text-muted-foreground">Rebuilding</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{profile.scenarios.redraftAppeal.toFixed(1)}</div>
                    <div className="text-muted-foreground">Redraft</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{profile.scenarios.playoffReliability.toFixed(1)}</div>
                    <div className="text-muted-foreground">Playoffs</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {profiles.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Compass className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No players found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters or clearing them to see more players.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Detailed Profile */}
        <div className="space-y-4">
          {selectedProfile ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <div className="text-2xl">{getPositionIcon(selectedProfile.position)}</div>
                    <div>
                      <div>{selectedProfile.name}</div>
                      <div className="text-sm font-normal text-muted-foreground">
                        {selectedProfile.team} • {selectedProfile.position}
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tier & Age */}
                  <div className="flex items-center justify-between">
                    <Badge className={getTierColor(selectedProfile.tier)} size="lg">
                      {selectedProfile.tier}
                    </Badge>
                    <div className="text-right">
                      <div className="font-semibold">Age {selectedProfile.ageContext.age}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedProfile.ageContext.primeWindow} • {selectedProfile.ageContext.yearsRemaining}y left
                      </div>
                    </div>
                  </div>

                  {/* Key Insights */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center space-x-1">
                      <Star className="w-4 h-4" />
                      <span>Key Insights</span>
                    </h4>
                    <ul className="space-y-1">
                      {selectedProfile.keyInsights.map((insight, index) => (
                        <li key={index} className="text-sm flex items-start space-x-2">
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Risk Factors */}
                  {selectedProfile.riskFactors.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center space-x-1 text-amber-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Risk Factors</span>
                      </h4>
                      <ul className="space-y-1">
                        {selectedProfile.riskFactors.map((risk, index) => (
                          <li key={index} className="text-sm flex items-start space-x-2">
                            <span className="text-amber-500 mt-1">⚠</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Scenario Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Compass className="w-5 h-5" />
                    <span>Scenario Analysis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(selectedProfile.scenarios).map(([scenario, value]) => (
                    <div key={scenario}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium capitalize">
                          {scenario.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="text-sm font-semibold">{value.toFixed(1)}/10</span>
                      </div>
                      <Progress value={value * 10} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Opportunity Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="w-5 h-5" />
                    <span>Opportunity</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm">Usage Security</span>
                      <span className="text-sm font-semibold">
                        {selectedProfile.opportunityMetrics.usageSecurity.toFixed(1)}/10
                      </span>
                    </div>
                    <Progress value={selectedProfile.opportunityMetrics.usageSecurity * 10} className="h-2" />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Target Competition</span>
                    <Badge variant={
                      selectedProfile.opportunityMetrics.targetCompetition === 'Minimal' ? 'default' :
                      selectedProfile.opportunityMetrics.targetCompetition === 'Moderate' ? 'secondary' :
                      selectedProfile.opportunityMetrics.targetCompetition === 'High' ? 'destructive' : 'destructive'
                    }>
                      {selectedProfile.opportunityMetrics.targetCompetition}
                    </Badge>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm">Environment Stability</span>
                      <span className="text-sm font-semibold">
                        {selectedProfile.opportunityMetrics.environmentStability.toFixed(1)}/10
                      </span>
                    </div>
                    <Progress value={selectedProfile.opportunityMetrics.environmentStability * 10} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* All Context Tags */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>Context Tags</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {selectedProfile.contextTags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                        {getTagIcon(tag)}
                        <span>{tag}</span>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Compass className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a Player</h3>
                <p className="text-muted-foreground">
                  Click on any player to view their detailed compass profile and scenario analysis.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}