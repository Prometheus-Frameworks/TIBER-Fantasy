import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, User, Bell, TrendingUp, TrendingDown, Target, Shield, Activity } from 'lucide-react';
import { Link } from 'wouter';

// Types
interface OVRPlayer {
  player_id: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  ovr: number;
  tier: string;
  confidence: number;
}

interface DvPMatchup {
  team: string;
  rank: number;
  position: string;
  pts_allowed_ppr: number;
  avg_epa: number;
  plays_against: number;
  matchup_rating: string;
}

function TiberDashboard() {
  const [selectedPosition, setSelectedPosition] = useState('ALL');
  const [selectedFormat, setSelectedFormat] = useState<'dynasty' | 'redraft'>('redraft');
  const [selectedTab, setSelectedTab] = useState('rankings');
  const [dvpPosition, setDvpPosition] = useState('QB');

  // Fetch OVR rankings
  const { data: ovrData, isLoading: ovrLoading } = useQuery<{ players: OVRPlayer[] }>({
    queryKey: ['/api/ovr', { format: selectedFormat, position: selectedPosition, limit: 100 }],
    enabled: selectedTab === 'rankings'
  });

  // Fetch DvP matchups
  const { data: dvpResponse, isLoading: dvpLoading } = useQuery<{ success: boolean; data: DvPMatchup[] }>({
    queryKey: ['/api/dvp', { position: dvpPosition, season: 2025, week: 5 }],
    enabled: selectedTab === 'matchups'
  });

  // Fetch insights (top DvP matchups)
  const { data: topMatchupsResponse } = useQuery<{ success: boolean; data: DvPMatchup[] }>({
    queryKey: ['/api/dvp', { position: 'ALL', season: 2025, week: 5 }],
  });

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      S: 'from-purple-500 to-purple-700',
      A: 'from-blue-500 to-blue-700',
      B: 'from-green-500 to-green-700',
      C: 'from-yellow-500 to-yellow-700',
      D: 'from-red-500 to-red-700'
    };
    return colors[tier] || colors.C;
  };

  const getMatchupIcon = (matchup: string) => {
    if (matchup === 'elite-matchup' || matchup === 'elite') return '🎯🎯🎯';
    if (matchup === 'good-matchup' || matchup === 'good') return '🎯🎯';
    if (matchup === 'neutral-matchup' || matchup === 'average') return '🎯';
    if (matchup === 'tough-matchup') return '⚠️';
    return '🚫';
  };

  const getMatchupLabel = (matchup: string) => {
    const labels: Record<string, string> = {
      'elite-matchup': 'ELITE MATCHUP',
      'good-matchup': 'Good Matchup',
      'neutral-matchup': 'Average',
      'tough-matchup': 'Tough',
      'avoid-matchup': 'AVOID'
    };
    return labels[matchup] || 'Average';
  };

  const getMatchupColor = (matchup: string) => {
    const colors: Record<string, string> = {
      'elite-matchup': 'text-green-400 bg-green-500/10',
      'good-matchup': 'text-blue-400 bg-blue-500/10',
      'neutral-matchup': 'text-gray-400 bg-gray-500/10',
      'tough-matchup': 'text-orange-400 bg-orange-500/10',
      'avoid-matchup': 'text-red-400 bg-red-500/10'
    };
    return colors[matchup] || colors['neutral-matchup'];
  };

  const filteredPlayers = ovrData?.players || [];
  const dvpData = dvpResponse?.data || [];
  const topMatchups = topMatchupsResponse?.data || [];
  const topInsights = topMatchups.filter(m => m.matchup_rating === 'elite-matchup').slice(0, 3);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-gray-100">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-[#141824] border-b border-gray-800 backdrop-blur-sm bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-white">
                T
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                TIBER ANALYTICS
              </span>
            </Link>

            {/* Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search players..."
                  className="w-full pl-10 pr-4 py-2 bg-[#1e2330] border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  data-testid="input-player-search"
                />
              </div>
            </div>

            {/* Right Nav */}
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-[#1e2330] rounded-lg transition-colors" data-testid="button-notifications">
                <Bell className="w-5 h-5 text-gray-400" />
              </button>
              <button className="p-2 hover:bg-[#1e2330] rounded-lg transition-colors" data-testid="button-user-menu">
                <User className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Filters */}
          <aside className="lg:col-span-1">
            <div className="bg-[#141824] border border-gray-800 rounded-xl p-6 sticky top-24">
              <h3 className="text-lg font-semibold mb-4">Quick Filters</h3>
              
              {/* Position Filters */}
              <div className="space-y-2 mb-6">
                <label className="text-sm font-medium text-gray-400">Position</label>
                {['ALL', 'QB', 'RB', 'WR', 'TE'].map(pos => (
                  <button
                    key={pos}
                    onClick={() => setSelectedPosition(pos)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedPosition === pos
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                        : 'text-gray-400 hover:bg-[#1e2330] border border-transparent'
                    }`}
                    data-testid={`button-filter-${pos.toLowerCase()}`}
                  >
                    {pos}
                  </button>
                ))}
              </div>

              {/* Format Filters */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Format</label>
                {[
                  { id: 'redraft', label: 'Redraft' },
                  { id: 'dynasty', label: 'Dynasty' }
                ].map(format => (
                  <button
                    key={format.id}
                    onClick={() => setSelectedFormat(format.id as 'dynasty' | 'redraft')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedFormat === format.id
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                        : 'text-gray-400 hover:bg-[#1e2330] border border-transparent'
                    }`}
                    data-testid={`button-format-${format.id}`}
                  >
                    {format.label}
                  </button>
                ))}
              </div>

              {/* Top Players Quick View */}
              <div className="mt-8 pt-6 border-t border-gray-800">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Top 5</h4>
                <div className="space-y-2">
                  {filteredPlayers.slice(0, 5).map((player, idx) => (
                    <div key={player.player_id} className="flex items-center gap-2 text-sm" data-testid={`top-player-${idx}`}>
                      <span className="text-gray-500 w-4">{idx + 1}.</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold bg-gradient-to-r ${getTierColor(player.tier)}`}>
                        {player.ovr}
                      </span>
                      <span className="text-gray-300 truncate flex-1">{player.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="lg:col-span-3 space-y-6">
            {/* Insights Panel */}
            <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-orange-400" />
                <h2 className="text-lg font-bold text-orange-400">🔥 This Week's Insights</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topInsights.length > 0 ? (
                  topInsights.map((matchup, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-[#141824]/50 rounded-lg p-3" data-testid={`insight-${idx}`}>
                      <Target className="w-5 h-5 mt-0.5 text-green-400" />
                      <div>
                        <div className="font-medium text-sm">{matchup.team}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Elite matchup vs {matchup.position} ({matchup.pts_allowed_ppr.toFixed(1)} PPR pts/game)
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 text-center text-gray-400 text-sm py-4">
                    Loading insights...
                  </div>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-[#141824] border border-gray-800 rounded-xl overflow-hidden">
              <div className="border-b border-gray-800">
                <div className="flex">
                  {[
                    { id: 'rankings', label: 'Power Rankings', icon: TrendingUp },
                    { id: 'matchups', label: 'DvP Matchups', icon: Shield },
                    { id: 'trends', label: 'Trends', icon: Activity }
                  ].map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition-colors ${
                          selectedTab === tab.id
                            ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                            : 'text-gray-400 hover:text-gray-300 hover:bg-[#1e2330]'
                        }`}
                        data-testid={`tab-${tab.id}`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rankings Tab */}
              {selectedTab === 'rankings' && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">
                      Top {selectedPosition === 'ALL' ? '100' : selectedPosition} Rankings
                    </h2>
                    <span className="text-sm text-gray-400">
                      {selectedFormat === 'dynasty' ? 'Dynasty' : 'Redraft'} • Week 5
                    </span>
                  </div>

                  {ovrLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, idx) => (
                        <div key={idx} className="bg-[#1e2330] border border-gray-700 rounded-lg p-4 animate-pulse">
                          <div className="h-20 bg-gray-700/50 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredPlayers.map((player, idx) => (
                        <div
                          key={player.player_id}
                          className="bg-[#1e2330] border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                          data-testid={`player-card-${idx}`}
                        >
                          <div className="flex items-start gap-4">
                            {/* Rank */}
                            <div className="flex-shrink-0 w-8 text-center">
                              <span className="text-2xl font-bold text-gray-500">{idx + 1}</span>
                            </div>

                            {/* Player Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-lg font-bold text-gray-100">{player.name}</h3>
                                <span className="text-sm text-gray-400">{player.position} • {player.team}</span>
                              </div>

                              {/* Stats Bar */}
                              <div className="mb-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                                    <div
                                      className={`h-full bg-gradient-to-r ${getTierColor(player.tier)} transition-all`}
                                      style={{ width: `${player.ovr}%` }}
                                    />
                                  </div>
                                  <span className={`text-lg font-bold px-2 py-1 rounded bg-gradient-to-r ${getTierColor(player.tier)}`}>
                                    {player.ovr}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                  <span>Tier: <span className="text-gray-300 font-semibold">{player.tier}</span></span>
                                  <span>Confidence: <span className="text-gray-300 font-mono">{(player.confidence * 100).toFixed(0)}%</span></span>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex-shrink-0 flex flex-col gap-2">
                              <Link 
                                href={`/players/${player.player_id}`}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors text-center"
                                data-testid={`button-view-${idx}`}
                              >
                                View
                              </Link>
                              <Link
                                href="/compare"
                                className="px-4 py-2 bg-[#141824] hover:bg-[#1e2330] border border-gray-700 rounded-lg text-sm font-medium transition-colors text-center"
                                data-testid={`button-compare-${idx}`}
                              >
                                Compare
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* DvP Matchups Tab */}
              {selectedTab === 'matchups' && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Defense vs Position Matchups</h2>
                    <span className="text-sm text-gray-400">Week 5 • 2025</span>
                  </div>

                  {/* Position Tabs */}
                  <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {['QB', 'RB', 'WR', 'TE'].map(pos => (
                      <button
                        key={pos}
                        onClick={() => setDvpPosition(pos)}
                        className={`px-6 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                          dvpPosition === pos
                            ? 'bg-blue-500 text-white'
                            : 'bg-[#1e2330] text-gray-400 hover:text-gray-300'
                        }`}
                        data-testid={`dvp-position-${pos.toLowerCase()}`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>

                  {dvpLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, idx) => (
                        <div key={idx} className="bg-[#1e2330] border border-gray-700 rounded-lg p-4 animate-pulse">
                          <div className="h-24 bg-gray-700/50 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {(dvpData || []).slice(0, 10).map((def, idx) => (
                        <div 
                          key={idx} 
                          className={`bg-[#1e2330] border rounded-lg p-4 ${
                            def.matchup_rating === 'elite-matchup' ? 'border-green-500/20' : 'border-gray-700'
                          }`}
                          data-testid={`dvp-matchup-${idx}`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="text-lg font-bold text-gray-100">{def.team}</h4>
                              <p className="text-sm text-gray-400">Rank: #{def.rank} vs {def.position}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${getMatchupColor(def.matchup_rating)}`}>
                              {getMatchupIcon(def.matchup_rating)} {getMatchupLabel(def.matchup_rating)}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-gray-400 text-xs mb-1">Fantasy Pts Allowed</div>
                              <div className="text-xl font-bold text-gray-100">{def.pts_allowed_ppr.toFixed(1)}</div>
                              <div className="text-gray-500 text-xs">PPR PPG</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs mb-1">EPA</div>
                              <div className="text-xl font-bold text-gray-100">{def.avg_epa > 0 ? '+' : ''}{def.avg_epa.toFixed(2)}</div>
                              <div className="text-gray-500 text-xs">per play</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs mb-1">Sample Size</div>
                              <div className="text-xl font-bold text-gray-100">{def.plays_against}</div>
                              <div className="text-gray-500 text-xs">plays</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Trends Tab */}
              {selectedTab === 'trends' && (
                <div className="p-6">
                  <div className="text-center py-12 text-gray-400">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Trends analysis coming soon!</p>
                    <p className="text-sm mt-2">Track week-over-week changes in OVR scores and matchup ratings</p>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default TiberDashboard;
