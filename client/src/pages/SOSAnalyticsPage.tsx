import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Shield, Target, Activity } from 'lucide-react';

interface TeamAnalytics {
  alignmentMatchups?: {
    outsideWr?: { score: number; fpgAllowed: number | null };
    slot?: { score: number; fpgAllowed: number | null };
    te?: { score: number; fpgAllowed: number | null };
  };
  coverageMatchups?: {
    vsZone?: { score: number; fpdbAllowed: number | null; defUsageRate: number | null };
    vsMan?: { score: number; fpdbAllowed: number | null; defUsageRate: number | null };
    vs2High?: { score: number; fpdbAllowed: number | null; defUsageRate: number | null };
    vs1High?: { score: number; fpdbAllowed: number | null; defUsageRate: number | null };
  };
  blockingContext?: {
    runBlocking?: { score: number; ybcPerAtt: number | null };
    passProtection?: { score: number; pressureRate: number | null };
  };
}

interface SOSItem {
  team: string;
  opponent: string;
  position: string;
  week: number;
  sos_score: number;
  tier: 'green' | 'yellow' | 'red';
  analytics?: TeamAnalytics;
}

function getTierColor(tier: string) {
  if (tier === 'green') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (tier === 'yellow') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}

function getScoreColor(score: number) {
  if (score >= 67) return 'text-green-600 dark:text-green-400';
  if (score >= 33) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function MatchupCard({ item }: { item: SOSItem }) {
  const { analytics } = item;
  
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl font-bold">{item.team}</CardTitle>
            <span className="text-slate-500">vs</span>
            <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">{item.opponent}</span>
          </div>
          <Badge className={getTierColor(item.tier)}>
            {item.sos_score} - {item.tier.toUpperCase()}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">Week {item.week} • {item.position}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Alignment Matchups (WR/TE) */}
        {analytics?.alignmentMatchups && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Target className="w-4 h-4" />
              Alignment Matchups
            </div>
            <div className="grid grid-cols-3 gap-2">
              {analytics.alignmentMatchups.outsideWr && (
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <div className="text-xs text-slate-500 mb-1">Outside WR</div>
                  <div className={`text-lg font-bold ${getScoreColor(analytics.alignmentMatchups.outsideWr.score)}`}>
                    {analytics.alignmentMatchups.outsideWr.score}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {analytics.alignmentMatchups.outsideWr.fpgAllowed != null 
                      ? `${analytics.alignmentMatchups.outsideWr.fpgAllowed.toFixed(1)} FPG`
                      : '—'
                    }
                  </div>
                </div>
              )}
              {analytics.alignmentMatchups.slot && (
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <div className="text-xs text-slate-500 mb-1">Slot</div>
                  <div className={`text-lg font-bold ${getScoreColor(analytics.alignmentMatchups.slot.score)}`}>
                    {analytics.alignmentMatchups.slot.score}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {analytics.alignmentMatchups.slot.fpgAllowed != null 
                      ? `${analytics.alignmentMatchups.slot.fpgAllowed.toFixed(1)} FPG`
                      : '—'
                    }
                  </div>
                </div>
              )}
              {analytics.alignmentMatchups.te && (
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <div className="text-xs text-slate-500 mb-1">TE</div>
                  <div className={`text-lg font-bold ${getScoreColor(analytics.alignmentMatchups.te.score)}`}>
                    {analytics.alignmentMatchups.te.score}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {analytics.alignmentMatchups.te.fpgAllowed != null 
                      ? `${analytics.alignmentMatchups.te.fpgAllowed.toFixed(1)} FPG`
                      : '—'
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Coverage Matchups (QB/WR/TE) */}
        {analytics?.coverageMatchups && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Shield className="w-4 h-4" />
              Coverage Matchups
            </div>
            <div className="grid grid-cols-2 gap-2">
              {analytics.coverageMatchups.vsZone && (
                <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded">
                  <div className="text-xs text-slate-500 mb-1">vs Zone</div>
                  <div className={`text-lg font-bold ${getScoreColor(analytics.coverageMatchups.vsZone.score)}`}>
                    {analytics.coverageMatchups.vsZone.score}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {analytics.coverageMatchups.vsZone.fpdbAllowed != null 
                      ? `${analytics.coverageMatchups.vsZone.fpdbAllowed.toFixed(2)} FPDB`
                      : '—'
                    }
                    {analytics.coverageMatchups.vsZone.defUsageRate != null && 
                      ` • ${(analytics.coverageMatchups.vsZone.defUsageRate * 100).toFixed(0)}%`
                    }
                  </div>
                </div>
              )}
              {analytics.coverageMatchups.vsMan && (
                <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded">
                  <div className="text-xs text-slate-500 mb-1">vs Man</div>
                  <div className={`text-lg font-bold ${getScoreColor(analytics.coverageMatchups.vsMan.score)}`}>
                    {analytics.coverageMatchups.vsMan.score}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {analytics.coverageMatchups.vsMan.fpdbAllowed != null 
                      ? `${analytics.coverageMatchups.vsMan.fpdbAllowed.toFixed(2)} FPDB`
                      : '—'
                    }
                    {analytics.coverageMatchups.vsMan.defUsageRate != null && 
                      ` • ${(analytics.coverageMatchups.vsMan.defUsageRate * 100).toFixed(0)}%`
                    }
                  </div>
                </div>
              )}
              {analytics.coverageMatchups.vs2High && (
                <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
                  <div className="text-xs text-slate-500 mb-1">vs 2-High</div>
                  <div className={`text-lg font-bold ${getScoreColor(analytics.coverageMatchups.vs2High.score)}`}>
                    {analytics.coverageMatchups.vs2High.score}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {analytics.coverageMatchups.vs2High.fpdbAllowed != null 
                      ? `${analytics.coverageMatchups.vs2High.fpdbAllowed.toFixed(2)} FPDB`
                      : '—'
                    }
                    {analytics.coverageMatchups.vs2High.defUsageRate != null && 
                      ` • ${(analytics.coverageMatchups.vs2High.defUsageRate * 100).toFixed(0)}%`
                    }
                  </div>
                </div>
              )}
              {analytics.coverageMatchups.vs1High && (
                <div className="p-2 bg-orange-50 dark:bg-orange-950 rounded">
                  <div className="text-xs text-slate-500 mb-1">vs 1-High</div>
                  <div className={`text-lg font-bold ${getScoreColor(analytics.coverageMatchups.vs1High.score)}`}>
                    {analytics.coverageMatchups.vs1High.score}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {analytics.coverageMatchups.vs1High.fpdbAllowed != null 
                      ? `${analytics.coverageMatchups.vs1High.fpdbAllowed.toFixed(2)} FPDB`
                      : '—'
                    }
                    {analytics.coverageMatchups.vs1High.defUsageRate != null && 
                      ` • ${(analytics.coverageMatchups.vs1High.defUsageRate * 100).toFixed(0)}%`
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Blocking Context (RB/QB) */}
        {analytics?.blockingContext && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Activity className="w-4 h-4" />
              Blocking Context
            </div>
            <div className="grid grid-cols-2 gap-2">
              {analytics.blockingContext.runBlocking && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950 rounded">
                  <div className="text-xs text-slate-500 mb-1">Run Blocking</div>
                  <div className={`text-lg font-bold ${getScoreColor(analytics.blockingContext.runBlocking.score)}`}>
                    {analytics.blockingContext.runBlocking.score}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {analytics.blockingContext.runBlocking.ybcPerAtt != null 
                      ? `${analytics.blockingContext.runBlocking.ybcPerAtt.toFixed(2)} YBC/Att`
                      : '—'
                    }
                  </div>
                </div>
              )}
              {analytics.blockingContext.passProtection && (
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950 rounded">
                  <div className="text-xs text-slate-500 mb-1">Pass Protection</div>
                  <div className={`text-lg font-bold ${getScoreColor(analytics.blockingContext.passProtection.score)}`}>
                    {analytics.blockingContext.passProtection.score}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {analytics.blockingContext.passProtection.pressureRate != null 
                      ? `${(analytics.blockingContext.passProtection.pressureRate * 100).toFixed(1)}% Press`
                      : '—'
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SOSAnalyticsPage() {
  const [position, setPosition] = useState<'RB' | 'WR' | 'QB' | 'TE'>('WR');
  const [week, setWeek] = useState(4);

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/sos/weekly/v3', position, week],
    queryFn: async () => {
      const response = await fetch(`/api/sos/weekly/v3?position=${position}&week=${week}&season=2024`);
      if (!response.ok) throw new Error('Failed to fetch SOS data');
      const data = await response.json();
      // Robust response parsing: handle both {items:[]} and {data:[]} formats
      const items = Array.isArray(data.items) ? data.items : Array.isArray(data.data) ? data.data : [];
      return items.sort((a: SOSItem, b: SOSItem) => b.sos_score - a.sos_score);
    }
  });

  const items = data || [];

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          SOS Team Analytics
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Advanced matchup analysis with alignment, coverage, and blocking context
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                Position
              </label>
              <Select value={position} onValueChange={(value) => setPosition(value as any)}>
                <SelectTrigger className="w-32" data-testid="select-position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RB">RB</SelectItem>
                  <SelectItem value="WR">WR</SelectItem>
                  <SelectItem value="QB">QB</SelectItem>
                  <SelectItem value="TE">TE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                Week
              </label>
              <Select value={week.toString()} onValueChange={(value) => setWeek(parseInt(value))}>
                <SelectTrigger className="w-24" data-testid="select-week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 18 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Week {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="p-12 text-center">
          <p className="text-red-500">Failed to load SOS data. Please try again.</p>
        </Card>
      )}

      {/* Matchup Cards */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {items.map((item: SOSItem, idx: number) => (
            <MatchupCard key={`${item.team}-${item.opponent}-${idx}`} item={item} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && items.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-slate-500">No data available for this week and position.</p>
        </Card>
      )}
    </div>
  );
}
