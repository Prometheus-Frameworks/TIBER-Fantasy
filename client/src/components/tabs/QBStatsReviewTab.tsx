import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, Activity, Target, Shield, Zap } from 'lucide-react';

interface QBStats {
  playerId: string;
  playerName: string;
  team: string;
  reference: {
    rawEpa: number;
    adjEpa: number;
    epaDiff: number;
    numPlays: number;
  } | null;
  context: {
    passAttempts: number;
    completions: number | null;
    completionPct: number | null;
    cpoe: number | null;
    drops: number;
    dropRate: number;
    pressures: number;
    pressureRate: number;
    sacks: number;
    sackRate: number;
    totalYac: number;
    expectedYac: number;
    yacDelta: number;
    avgDefEpaFaced: number;
    interceptablePasses: number;
    droppedInterceptions: number;
  } | null;
  tiber: {
    rawEpa: number;
    adjEpa: number;
    epaDiff: number;
    dropAdjustment: number;
    pressureAdjustment: number;
    yacAdjustment: number;
    defenseAdjustment: number;
  } | null;
}

interface QBStatsResponse {
  season: number;
  qbs: QBStats[];
  summary: {
    total: number;
    withContextData: number;
    withTiberData: number;
    withCompleteData: number;
  };
}

function StatRow({ label, value, className = "" }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-border/30">
      <span className="text-sm text-gray-300">{label}</span>
      <span className={`text-sm font-medium ${className || 'text-gray-100'}`}>{value}</span>
    </div>
  );
}

function QBCard({ qb, rank }: { qb: QBStats; rank: number }) {
  const getTrendIcon = (diff: number) => {
    if (diff > 0.05) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (diff < -0.05) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getRankColor = (rank: number) => {
    if (rank <= 5) return "text-yellow-500 font-bold";
    if (rank <= 12) return "text-blue-500 font-semibold";
    if (rank <= 24) return "text-gray-500";
    return "text-gray-400";
  };

  return (
    <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-2xl ${getRankColor(rank)}`}>#{rank}</span>
            <div>
              <CardTitle className="text-lg">{qb.playerName}</CardTitle>
              <p className="text-sm text-gray-400">{qb.team}</p>
            </div>
          </div>
          {qb.reference && (
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {qb.reference.adjEpa.toFixed(3)}
              </div>
              <div className="text-xs text-gray-300 flex items-center gap-1">
                {getTrendIcon(qb.reference.epaDiff)}
                <span>EPA/play</span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* External EPA Reference */}
        {qb.reference && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <h4 className="text-sm font-semibold text-blue-500">EPA Reference</h4>
            </div>
            <div className="grid grid-cols-2 gap-2 pl-6">
              <StatRow label="Raw EPA" value={qb.reference.rawEpa.toFixed(3)} />
              <StatRow label="Adj EPA" value={qb.reference.adjEpa.toFixed(3)} className="text-primary" />
              <StatRow label="Adjustment" value={qb.reference.epaDiff.toFixed(3)} />
              <StatRow label="Plays" value={qb.reference.numPlays} />
            </div>
          </div>
        )}

        {/* Context Metrics (NFLfastR) */}
        {qb.context && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-500" />
              <h4 className="text-sm font-semibold text-purple-500">Context Metrics</h4>
            </div>
            <div className="grid grid-cols-2 gap-2 pl-6">
              <StatRow label="Pass Attempts" value={qb.context.passAttempts} />
              <StatRow 
                label="Completions" 
                value={qb.context.completions !== null && qb.context.completionPct !== null ? `${qb.context.completions} (${(qb.context.completionPct * 100).toFixed(1)}%)` : 'N/A'} 
              />
              <StatRow 
                label="CPOE" 
                value={qb.context.cpoe !== null ? `${(qb.context.cpoe * 100).toFixed(1)}%` : 'N/A'} 
                className={qb.context.cpoe !== null ? (qb.context.cpoe > 0 ? "text-green-500" : "text-red-500") : ""} 
              />
              <StatRow label="Drops" value={`${qb.context.drops} (${(qb.context.dropRate * 100).toFixed(1)}%)`} />
              <StatRow label="Pressures" value={`${qb.context.pressures} (${(qb.context.pressureRate * 100).toFixed(1)}%)`} />
              <StatRow label="Sacks" value={`${qb.context.sacks} (${(qb.context.sackRate * 100).toFixed(1)}%)`} />
              <StatRow label="YAC Δ" value={qb.context.yacDelta.toFixed(1)} className={qb.context.yacDelta > 0 ? "text-green-500" : "text-red-500"} />
              <StatRow label="Def EPA Faced" value={qb.context.avgDefEpaFaced.toFixed(3)} />
            </div>
          </div>
        )}

        {/* Tiber Adjusted EPA */}
        {qb.tiber && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              <h4 className="text-sm font-semibold text-emerald-500">Tiber Adjustments</h4>
            </div>
            <div className="grid grid-cols-2 gap-2 pl-6">
              <StatRow label="Tiber EPA" value={qb.tiber.adjEpa?.toFixed(3) || 'N/A'} className="text-emerald-500 font-semibold" />
              <StatRow label="Total Adj" value={qb.tiber.epaDiff?.toFixed(3) || 'N/A'} />
              <StatRow label="Drop Adj" value={qb.tiber.dropAdjustment?.toFixed(3) || 'N/A'} />
              <StatRow label="Pressure Adj" value={qb.tiber.pressureAdjustment?.toFixed(3) || 'N/A'} />
              <StatRow label="YAC Adj" value={qb.tiber.yacAdjustment?.toFixed(3) || 'N/A'} />
              <StatRow label="Def Adj" value={qb.tiber.defenseAdjustment?.toFixed(3) || 'N/A'} />
            </div>
          </div>
        )}

        {/* Data Status */}
        <div className="flex gap-2 pt-2 border-t border-border/30">
          {qb.context && <Badge variant="outline" className="text-xs">Context ✓</Badge>}
          {qb.tiber && <Badge variant="outline" className="text-xs">Tiber ✓</Badge>}
          {!qb.context && <Badge variant="outline" className="text-xs text-muted-foreground">No Context</Badge>}
          {!qb.tiber && <Badge variant="outline" className="text-xs text-muted-foreground">No Tiber</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function QBStatsReviewTab() {
  const { data, isLoading } = useQuery<{ success: boolean; data: QBStatsResponse }>({
    queryKey: ['/api/sanity-check/qb-stats-review'],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  const qbs = data?.data?.qbs || [];
  const summary = data?.data?.summary;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground" data-testid="header-title">QB Stats Review</h1>
        <p className="text-muted-foreground">
          Eye-test all QB stats from NFLfastR - Context metrics, EPA reference data, and Tiber adjustments
        </p>
        {summary && (
          <div className="flex gap-3 pt-2">
            <Badge variant="outline" className="bg-background/50">
              {summary.total} Total QBs
            </Badge>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
              {summary.withContextData} with Context
            </Badge>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
              {summary.withTiberData} with Tiber
            </Badge>
          </div>
        )}
      </div>

      {/* QB Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {qbs.map((qb, index) => (
          <QBCard key={qb.playerId} qb={qb} rank={index + 1} />
        ))}
      </div>

      {qbs.length === 0 && (
        <div className="text-center py-12">
          <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-lg text-muted-foreground">No QB data available</p>
          <p className="text-sm text-muted-foreground mt-2">
            QB statistics are currently unavailable
          </p>
        </div>
      )}
    </div>
  );
}
