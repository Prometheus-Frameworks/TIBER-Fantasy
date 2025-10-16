import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, TrendingUp, TrendingDown, Target, Users, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SOSRanking {
  team: string;
  score: number;
  passDefScore?: number;
  rushDefScore?: number;
  pressureScore?: number;
  rank: number;
}

interface SOSResponse {
  season: number;
  week: number;
  rankings: SOSRanking[];
}

interface StartSitRecommendation {
  player: {
    canonicalId: string;
    fullName: string;
    position: string;
    team: string;
  };
  matchup: {
    week: number;
    opponent: string;
    isHome: boolean;
    dvpRating: string;
    rankVsPosition: number | null;
  };
  recommendation: 'start' | 'sit';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  metrics: {
    avgTiberScore: number;
    isSuperstar: boolean;
    recentTrend: 'up' | 'down' | 'stable';
  };
}

interface StartSitResponse {
  success: boolean;
  week: number;
  season: number;
  position: string;
  recommendations: StartSitRecommendation[];
  summary: {
    totalAnalyzed: number;
    startHighConfidence: number;
    sitRecommendations: number;
  };
}

interface WaiverTarget {
  player: {
    canonicalId: string;
    fullName: string;
    position: string;
    team: string;
  };
  tiberScore: number;
  tier: string;
  targetReason: string;
}

interface WaiverTargetsResponse {
  success: boolean;
  week: number;
  season: number;
  targets: WaiverTarget[];
}

export default function StrategyTab() {
  const [activeTab, setActiveTab] = useState<'sos' | 'startsit' | 'waivers'>('startsit');
  const [sosView, setSosView] = useState<'defense' | 'offense'>('defense');
  const [sosPosition, setSosPosition] = useState<'ALL' | 'QB' | 'RB' | 'WR' | 'TE'>('ALL');
  const [startSitWeek] = useState(7); // Week 7 for decision making
  const [startSitPosition, setStartSitPosition] = useState<'ALL' | 'QB' | 'RB' | 'WR' | 'TE'>('ALL');

  // Build query URLs with params
  const buildSosUrl = (type: 'defense' | 'offense') => {
    const params = new URLSearchParams();
    if (sosPosition !== 'ALL') {
      params.set('position', sosPosition);
    }
    const queryString = params.toString();
    return `/api/sos/rankings/${type}${queryString ? `?${queryString}` : ''}`;
  };

  // Fetch SOS defense rankings
  const { data: sosDefense, isLoading: defenseLoading } = useQuery<SOSResponse>({
    queryKey: [buildSosUrl('defense')],
    enabled: activeTab === 'sos' && sosView === 'defense',
  });

  // Fetch SOS offense rankings
  const { data: sosOffense, isLoading: offenseLoading } = useQuery<SOSResponse>({
    queryKey: [buildSosUrl('offense')],
    enabled: activeTab === 'sos' && sosView === 'offense',
  });

  // Build query URLs with params
  const buildStartSitUrl = () => {
    const params = new URLSearchParams();
    params.set('week', startSitWeek.toString());
    if (startSitPosition !== 'ALL') {
      params.set('position', startSitPosition);
    }
    return `/api/strategy/start-sit?${params.toString()}`;
  };

  const buildWaiverUrl = () => {
    const params = new URLSearchParams();
    params.set('week', startSitWeek.toString());
    return `/api/strategy/targets?${params.toString()}`;
  };

  // Fetch start/sit recommendations
  const { data: startSitData, isLoading: startSitLoading } = useQuery<StartSitResponse>({
    queryKey: [buildStartSitUrl()],
    enabled: activeTab === 'startsit',
  });

  // Fetch waiver targets
  const { data: waiverTargets, isLoading: waiversLoading } = useQuery<WaiverTargetsResponse>({
    queryKey: [buildWaiverUrl()],
    enabled: activeTab === 'waivers',
  });

  const isLoading = sosView === 'defense' ? defenseLoading : offenseLoading;
  const sosData = sosView === 'defense' ? sosDefense?.rankings || [] : sosOffense?.rankings || [];

  const getRankColor = (rank: number, isOffense: boolean) => {
    if (isOffense) {
      if (rank <= 3) return 'text-green-400 bg-green-500/10';
      if (rank <= 10) return 'text-blue-400 bg-blue-500/10';
      if (rank <= 20) return 'text-gray-400 bg-gray-500/10';
      return 'text-orange-400 bg-orange-500/10';
    } else {
      if (rank <= 3) return 'text-red-400 bg-red-500/10';
      if (rank <= 10) return 'text-orange-400 bg-orange-500/10';
      if (rank <= 20) return 'text-gray-400 bg-gray-500/10';
      return 'text-green-400 bg-green-500/10';
    }
  };

  const getRankIcon = (rank: number, isOffense: boolean) => {
    if (isOffense) {
      if (rank <= 3) return <TrendingUp className="w-5 h-5 text-green-400" />;
      if (rank <= 10) return <Target className="w-5 h-5 text-blue-400" />;
      return <TrendingDown className="w-5 h-5 text-orange-400" />;
    } else {
      if (rank <= 3) return <Shield className="w-5 h-5 text-red-400" />;
      if (rank <= 10) return <Shield className="w-5 h-5 text-orange-400" />;
      return <Shield className="w-5 h-5 text-green-400" />;
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Week 7 Strategy Guide</h2>
          <p className="text-gray-400 mt-1">Start/Sit Decisions, Waiver Targets & Matchup Intelligence</p>
        </div>
      </div>

      {/* Main Tab Toggle */}
      <div className="flex gap-2">
        {[
          { id: 'startsit', label: 'Start/Sit', icon: Users },
          { id: 'waivers', label: 'Waiver Targets', icon: Target },
          { id: 'sos', label: 'SOS Rankings', icon: Shield }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-[#1e2330] text-gray-400 hover:text-gray-300'
              }`}
              data-testid={`button-strategy-${tab.id}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Start/Sit View */}
      {activeTab === 'startsit' && (
        <>
          {/* Position Filters */}
          <div className="flex gap-2">
            {['ALL', 'QB', 'RB', 'WR', 'TE'].map(pos => (
              <button
                key={pos}
                onClick={() => setStartSitPosition(pos as typeof startSitPosition)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  startSitPosition === pos
                    ? 'bg-purple-500 text-white'
                    : 'bg-[#1e2330] text-gray-400 hover:text-gray-300'
                }`}
                data-testid={`button-startsit-position-${pos.toLowerCase()}`}
              >
                {pos}
              </button>
            ))}
          </div>

          {startSitLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : startSitData?.message ? (
            <div className="text-center py-12 text-gray-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{startSitData.message}</p>
            </div>
          ) : startSitData?.recommendations && startSitData.recommendations.length > 0 ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#1e2330] border border-gray-700 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-100">{startSitData.summary.totalAnalyzed}</div>
                  <div className="text-sm text-gray-500">Players Analyzed</div>
                </div>
                <div className="bg-[#1e2330] border border-gray-700 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-400">{startSitData.summary.startHighConfidence}</div>
                  <div className="text-sm text-gray-500">High Confidence Starts</div>
                </div>
                <div className="bg-[#1e2330] border border-gray-700 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-400">{startSitData.summary.sitRecommendations}</div>
                  <div className="text-sm text-gray-500">Sit Recommendations</div>
                </div>
              </div>

              {/* Recommendations List */}
              <div className="space-y-3">
                {startSitData.recommendations.slice(0, 20).map((rec, idx) => (
                  <div
                    key={idx}
                    className="bg-[#1e2330] border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                    data-testid={`startsit-recommendation-${idx}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Recommendation Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {rec.recommendation === 'start' ? (
                          <CheckCircle className="w-6 h-6 text-green-400" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-400" />
                        )}
                      </div>

                      {/* Player Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-bold text-gray-100">{rec.player.fullName}</h4>
                          <Badge variant="outline">{rec.player.position}</Badge>
                          <span className="text-sm text-gray-500">{rec.player.team}</span>
                        </div>

                        <div className="text-sm text-gray-400 mb-2">
                          {rec.matchup.isHome ? 'vs' : '@'} {rec.matchup.opponent}
                          {rec.matchup.rankVsPosition && (
                            <span className="ml-2">• Defense Rank: #{rec.matchup.rankVsPosition}</span>
                          )}
                        </div>

                        <p className="text-sm text-gray-300">{rec.reasoning}</p>

                        <div className="flex items-center gap-4 mt-2">
                          <div className="text-xs text-gray-500">
                            Confidence: <span className={getConfidenceColor(rec.confidence)}>{rec.confidence.toUpperCase()}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            TIBER: <span className="text-gray-300">{rec.metrics.avgTiberScore}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Trend: <span className="text-gray-300">{rec.metrics.recentTrend}</span>
                          </div>
                        </div>
                      </div>

                      {/* Recommendation Badge */}
                      <div className="flex-shrink-0">
                        <Badge className={rec.recommendation === 'start' ? 'bg-green-500' : 'bg-red-500'}>
                          {rec.recommendation.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No start/sit recommendations available</p>
              <p className="text-sm mt-2">Try selecting a different position</p>
            </div>
          )}
        </>
      )}

      {/* Waiver Targets View */}
      {activeTab === 'waivers' && (
        <>
          {waiversLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
            </div>
          ) : waiverTargets?.targets && waiverTargets.targets.length > 0 ? (
            <div className="space-y-3">
              {waiverTargets.targets.map((target, idx) => (
                <div
                  key={idx}
                  className="bg-[#1e2330] border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                  data-testid={`waiver-target-${idx}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="text-2xl font-bold text-purple-400">#{idx + 1}</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="text-lg font-bold text-gray-100">{target.player.fullName}</h4>
                        <Badge variant="outline">{target.player.position}</Badge>
                        <span className="text-sm text-gray-500">{target.player.team}</span>
                      </div>
                      <p className="text-sm text-gray-400">{target.targetReason}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <Badge className="bg-purple-500">
                        TIBER: {target.tiberScore}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No waiver targets available</p>
            </div>
          )}
        </>
      )}

      {/* SOS View */}
      {activeTab === 'sos' && (
        <>
          {/* View Toggle */}
          <div className="flex gap-2">
            {[
              { id: 'defense', label: 'Defense Rankings', icon: Shield },
              { id: 'offense', label: 'Offense Rankings', icon: TrendingUp }
            ].map(view => {
              const Icon = view.icon;
              return (
                <button
                  key={view.id}
                  onClick={() => setSosView(view.id as 'defense' | 'offense')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    sosView === view.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-[#1e2330] text-gray-400 hover:text-gray-300'
                  }`}
                  data-testid={`button-sos-${view.id}`}
                >
                  <Icon className="w-4 h-4" />
                  {view.label}
                </button>
              );
            })}
          </div>

          {/* Position Filters */}
          <div className="flex gap-2">
            {['ALL', 'QB', 'RB', 'WR', 'TE'].map(pos => (
              <button
                key={pos}
                onClick={() => setSosPosition(pos as typeof sosPosition)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  sosPosition === pos
                    ? 'bg-purple-500 text-white'
                    : 'bg-[#1e2330] text-gray-400 hover:text-gray-300'
                }`}
                data-testid={`button-sos-position-${pos.toLowerCase()}`}
              >
                {pos}
              </button>
            ))}
          </div>

          {/* SOS Rankings */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, idx) => (
                <div key={idx} className="bg-[#1e2330] border border-gray-700 rounded-lg p-4 animate-pulse">
                  <div className="h-16 bg-gray-700/50 rounded"></div>
                </div>
              ))}
            </div>
          ) : sosData.length > 0 ? (
            <div className="grid gap-3">
              {sosData.slice(0, 28).map((team, idx) => (
                <div
                  key={idx}
                  className="bg-[#1e2330] border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                  data-testid={`sos-team-${idx}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12">
                      <div className="text-2xl font-bold text-gray-500">#{team.rank}</div>
                    </div>
                    <div className="flex-shrink-0">
                      {getRankIcon(team.rank, sosView === 'offense')}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-100">{team.team}</h4>
                      <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                        {team.passDefScore !== undefined && (
                          <span>Pass Def: <span className="text-gray-300">{team.passDefScore.toFixed(1)}</span></span>
                        )}
                        {team.rushDefScore !== undefined && (
                          <span>Rush Def: <span className="text-gray-300">{team.rushDefScore.toFixed(1)}</span></span>
                        )}
                        {team.pressureScore !== undefined && (
                          <span>Pressure: <span className="text-gray-300">{team.pressureScore.toFixed(1)}</span></span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${getRankColor(team.rank, sosView === 'offense')}`}>
                        {team.score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No SOS data available for this position</p>
              <p className="text-sm mt-2">Try selecting a different position or view</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
