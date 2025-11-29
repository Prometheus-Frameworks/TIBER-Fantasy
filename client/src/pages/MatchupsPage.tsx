import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowLeft, RefreshCw, Calendar, TrendingUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type Position = 'WR' | 'RB' | 'TE';
type MatchupBand = 'Smash' | 'Good' | 'Neutral' | 'Tough' | 'Stay Away';

interface TeamSeasonData {
  rank: number;
  season: number;
  team: string;
  envScore100: number;
  passEpaPerPlay: number;
  rushEpaPerPlay: number;
  styleTag: 'Pass-leaning' | 'Balanced' | 'Run-heavy';
}

interface MatchupData {
  season: number;
  week: number;
  gameId: string;
  isHome: boolean;
  offenseTeam: string;
  defenseTeam: string;
  position: string;
  offenseEnvScore100: number;
  offenseMatchupScore100: number;
  offenseBand: MatchupBand;
}

const BAND_COLORS: Record<MatchupBand, string> = {
  'Smash': 'bg-green-500/20 text-green-400 border-green-500/50',
  'Good': 'bg-green-400/15 text-green-300 border-green-400/40',
  'Neutral': 'bg-slate-500/20 text-slate-300 border-slate-500/50',
  'Tough': 'bg-red-400/15 text-red-300 border-red-400/40',
  'Stay Away': 'bg-red-500/20 text-red-400 border-red-500/50',
};

const STYLE_COLORS: Record<string, string> = {
  'Pass-leaning': 'text-blue-400',
  'Balanced': 'text-slate-400',
  'Run-heavy': 'text-amber-400',
};

function SeasonViewTable({ season }: { season: number }) {
  const { data, isLoading, error } = useQuery<{ meta: any; teams: TeamSeasonData[] }>({
    queryKey: ['/api/forge/env-season', { season }],
    queryFn: () => fetch(`/api/forge/env-season?season=${season}`).then(res => res.json()),
  });

  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="season-view-loading">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full bg-slate-700/50" />
        ))}
      </div>
    );
  }

  if (error || !data?.teams) {
    return (
      <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
        <p className="text-red-400">Failed to load season data</p>
      </div>
    );
  }

  return (
    <div className="bg-[#141824] rounded-lg border border-slate-700/50 overflow-hidden" data-testid="season-view-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800/50 text-slate-400 text-left">
            <th className="px-4 py-3 font-medium">Rank</th>
            <th className="px-4 py-3 font-medium">Team</th>
            <th className="px-4 py-3 font-medium text-right">Env Score</th>
            <th className="px-4 py-3 font-medium text-right">Pass EPA</th>
            <th className="px-4 py-3 font-medium text-right">Rush EPA</th>
            <th className="px-4 py-3 font-medium">Style</th>
          </tr>
        </thead>
        <tbody>
          {data.teams.map((team) => (
            <tr 
              key={team.team} 
              className="border-t border-slate-700/50 hover:bg-slate-700/20 transition-colors"
              data-testid={`team-row-${team.team}`}
            >
              <td className="px-4 py-3 text-slate-400">{team.rank}</td>
              <td className="px-4 py-3 font-medium text-white">{team.team}</td>
              <td className="px-4 py-3 text-right">
                <span className={`font-mono font-bold ${
                  team.envScore100 >= 60 ? 'text-green-400' : 
                  team.envScore100 >= 45 ? 'text-slate-300' : 'text-red-400'
                }`}>
                  {team.envScore100}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-300">
                {team.passEpaPerPlay != null 
                  ? `${team.passEpaPerPlay >= 0 ? '+' : ''}${team.passEpaPerPlay.toFixed(3)}`
                  : '—'}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-300">
                {team.rushEpaPerPlay != null
                  ? `${team.rushEpaPerPlay >= 0 ? '+' : ''}${team.rushEpaPerPlay.toFixed(3)}`
                  : '—'}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium ${STYLE_COLORS[team.styleTag]}`}>
                  {team.styleTag}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchupCard({ matchups, gameId }: { matchups: MatchupData[]; gameId: string }) {
  const gameMatchups = matchups.filter(m => m.gameId === gameId);
  if (gameMatchups.length < 2) return null;

  // Find away (isHome=false) and home (isHome=true) matchups
  const awayMatchup = gameMatchups.find(m => !m.isHome);
  const homeMatchup = gameMatchups.find(m => m.isHome);
  
  if (!awayMatchup || !homeMatchup) return null;

  const header = `${awayMatchup.offenseTeam} @ ${homeMatchup.offenseTeam}`;

  return (
    <div 
      className="bg-[#141824] rounded-lg border border-slate-700/50 overflow-hidden"
      data-testid={`matchup-card-${gameId}`}
    >
      <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700/50">
        <h3 className="font-semibold text-white">{header}</h3>
        <p className="text-xs text-slate-400">Week {awayMatchup.week} • {awayMatchup.position}</p>
      </div>
      
      <div className="grid grid-cols-2 divide-x divide-slate-700/50">
        <MatchupSide matchup={awayMatchup} />
        <MatchupSide matchup={homeMatchup} />
      </div>
    </div>
  );
}

function MatchupSide({ matchup }: { matchup: MatchupData }) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-white font-medium">{matchup.offenseTeam}</span>
        <span className="text-xs text-slate-500">{matchup.isHome ? 'HOME' : 'AWAY'}</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400">Env Score</span>
          <span className={`font-mono font-bold ${
            matchup.offenseEnvScore100 >= 55 ? 'text-green-400' : 
            matchup.offenseEnvScore100 >= 45 ? 'text-slate-300' : 'text-red-400'
          }`}>
            {matchup.offenseEnvScore100}
          </span>
        </div>
        
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400">Matchup</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${BAND_COLORS[matchup.offenseBand]}`}>
            {matchup.offenseBand} ({matchup.offenseMatchupScore100})
          </span>
        </div>
      </div>
    </div>
  );
}

function WeeklyMatchupsView({ season, week, position }: { season: number; week: number; position: Position }) {
  const { data, isLoading, error } = useQuery<{ meta: any; matchups: MatchupData[] }>({
    queryKey: ['/api/forge/matchups', { season, week, position }],
    queryFn: () => fetch(`/api/forge/matchups?season=${season}&week=${week}&position=${position}`).then(res => res.json()),
  });

  const gameIds = useMemo(() => {
    if (!data?.matchups) return [];
    const ids = new Set<string>();
    data.matchups.forEach(m => ids.add(m.gameId));
    return Array.from(ids);
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="weekly-view-loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full bg-slate-700/50 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error || !data?.matchups) {
    return (
      <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
        <p className="text-red-400">Failed to load matchup data</p>
      </div>
    );
  }

  if (gameIds.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
        <p className="text-slate-400">No games found for Week {week}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="weekly-matchups-grid">
      {gameIds.map(gameId => (
        <MatchupCard key={gameId} matchups={data.matchups} gameId={gameId} />
      ))}
    </div>
  );
}

export default function MatchupsPage() {
  const [season, setSeason] = useState(2025);
  const [week, setWeek] = useState(12);
  const [position, setPosition] = useState<Position>('WR');
  const [activeTab, setActiveTab] = useState<'season' | 'weekly'>('season');

  const { data: weeksData } = useQuery<{ season: number; weeks: number[]; currentWeek: number }>({
    queryKey: ['/api/forge/weeks', { season }],
    queryFn: () => fetch(`/api/forge/weeks?season=${season}`).then(res => res.json()),
  });

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors" data-testid="back-link">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white" data-testid="page-title">
                FORGE Matchups
              </h1>
              <p className="text-sm text-slate-400">
                {season} season • Environment & matchup analysis
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={String(season)} onValueChange={(v) => setSeason(Number(v))}>
              <SelectTrigger className="w-24 bg-slate-800 border-slate-700" data-testid="season-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'season' | 'weekly')} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-slate-800/50 border border-slate-700" data-testid="view-tabs">
              <TabsTrigger 
                value="season" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                data-testid="tab-season"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Season View
              </TabsTrigger>
              <TabsTrigger 
                value="weekly"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                data-testid="tab-weekly"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Weekly Matchups
              </TabsTrigger>
            </TabsList>

            {activeTab === 'weekly' && (
              <div className="flex items-center gap-3">
                <Select value={String(week)} onValueChange={(v) => setWeek(Number(v))}>
                  <SelectTrigger className="w-28 bg-slate-800 border-slate-700" data-testid="week-select">
                    <SelectValue placeholder="Week" />
                  </SelectTrigger>
                  <SelectContent>
                    {(weeksData?.weeks || [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]).map((w) => (
                      <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center bg-slate-800/50 rounded-lg p-1 border border-slate-700" data-testid="position-tabs">
                  {(['WR', 'RB', 'TE'] as Position[]).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setPosition(pos)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        position === pos
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                      data-testid={`position-${pos.toLowerCase()}`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <TabsContent value="season" className="mt-0">
            <SeasonViewTable season={season} />
          </TabsContent>

          <TabsContent value="weekly" className="mt-0">
            <WeeklyMatchupsView season={season} week={week} position={position} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
