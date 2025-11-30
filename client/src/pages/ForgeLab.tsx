import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, RefreshCw, Beaker, TrendingUp, TrendingDown, Minus, Download, Trophy, Target, Zap, BarChart3 } from 'lucide-react';
import type { ForgePosition, ForgeScore } from '../types/forge';
import { fetchForgeBatch, createForgeSnapshot, fetchForgeScore, fetchPlayerContext, type PlayerContextResponse } from '../api/forge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const POSITIONS: (ForgePosition | 'ALL')[] = ['ALL', 'QB', 'RB', 'WR', 'TE'];

function TrajectoryIcon({ trajectory }: { trajectory: string }) {
  if (trajectory === 'rising') {
    return <TrendingUp className="h-4 w-4 text-green-400" />;
  }
  if (trajectory === 'falling') {
    return <TrendingDown className="h-4 w-4 text-red-400" />;
  }
  return <Minus className="h-4 w-4 text-gray-400" />;
}

function AlphaBadge({ alpha }: { alpha: number }) {
  let colorClass = 'bg-gray-600';
  if (alpha >= 80) colorClass = 'bg-emerald-600';
  else if (alpha >= 60) colorClass = 'bg-blue-600';
  else if (alpha >= 40) colorClass = 'bg-yellow-600';
  else if (alpha >= 20) colorClass = 'bg-orange-600';
  else colorClass = 'bg-red-600';

  return (
    <Badge className={`${colorClass} text-white font-mono`} data-testid="alpha-badge">
      {alpha.toFixed(1)}
    </Badge>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  let colorClass = 'text-gray-400';
  if (confidence >= 80) colorClass = 'text-green-400';
  else if (confidence >= 50) colorClass = 'text-yellow-400';
  else colorClass = 'text-red-400';

  return <span className={`font-mono ${colorClass}`}>{confidence}</span>;
}

function StatBox({ label, value, format = 'default' }: { label: string; value: any; format?: 'default' | 'pct' | 'decimal' }) {
  let displayValue = '-';
  if (value != null && value !== undefined) {
    if (format === 'pct') {
      displayValue = `${(Number(value) * 100).toFixed(1)}%`;
    } else if (format === 'decimal') {
      displayValue = Number(value).toFixed(2);
    } else {
      displayValue = String(value);
    }
  }
  return (
    <div className="bg-[#1a1f2e] p-2 rounded text-center">
      <div className="text-gray-500 text-xs">{label}</div>
      <div className="font-mono text-white">{displayValue}</div>
    </div>
  );
}

function AdvancedStatsPanel({ context }: { context: PlayerContextResponse }) {
  const { identity, usage = {}, efficiency = {}, finishing = {}, metaStats = { gamesPlayed: 0, lastUpdated: '' } } = context;
  const pos = identity.position;
  const hasStats = Object.keys(usage).length > 0 || Object.keys(efficiency).length > 0 || Object.keys(finishing).length > 0;

  if (!hasStats) return null;

  return (
    <div className="mt-4 p-4 bg-[#020617] border border-gray-600 rounded-lg" data-testid="advanced-stats-panel">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-5 w-5 text-blue-400" />
        <span className="font-semibold text-white">Advanced Stats</span>
        <span className="text-xs text-gray-500">{metaStats.gamesPlayed} games</span>
      </div>

      {pos === 'QB' && (
        <>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-gray-400">Usage</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatBox label="Attempts" value={usage.attempts} />
              <StatBox label="Completions" value={usage.completions} />
              <StatBox label="Rush Att" value={usage.rushAttempts} />
              <StatBox label="Air Yards" value={usage.airYards} />
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-gray-400">Efficiency</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatBox label="Comp %" value={efficiency.completionPct} format="pct" />
              <StatBox label="Y/Att" value={efficiency.yardsPerAttempt} format="decimal" />
              <StatBox label="EPA/Att" value={efficiency.epaPerAttempt} format="decimal" />
              <StatBox label="Success %" value={efficiency.successRate} format="pct" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-400">Production</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <StatBox label="Pass Yds" value={finishing.passYards} />
              <StatBox label="Pass TDs" value={finishing.passTds} />
              <StatBox label="INTs" value={finishing.ints} />
              <StatBox label="Rush Yds" value={finishing.rushYards} />
              <StatBox label="Rush TDs" value={finishing.rushTds} />
            </div>
          </div>
        </>
      )}

      {pos === 'RB' && (
        <>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-gray-400">Usage</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatBox label="Carries" value={usage.carries} />
              <StatBox label="Targets" value={usage.targets} />
              <StatBox label="Carry Share" value={usage.carryShare} format="pct" />
              <StatBox label="Tgt Share" value={usage.targetShare} format="pct" />
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-gray-400">Efficiency</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatBox label="Y/Carry" value={efficiency.yardsPerCarry} format="decimal" />
              <StatBox label="Rush Succ%" value={efficiency.rushSuccessRate} format="pct" />
              <StatBox label="Catch %" value={efficiency.catchRate} format="pct" />
              <StatBox label="YAC/Rec" value={efficiency.yacPerRec} format="decimal" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-400">Production</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <StatBox label="Rush Yds" value={finishing.rushYards} />
              <StatBox label="Rec Yds" value={finishing.recYards} />
              <StatBox label="Total TDs" value={finishing.totalTds} />
              <StatBox label="GL Carries" value={finishing.goalLineCarries} />
              <StatBox label="RZ Carries" value={finishing.redzoneCarries} />
            </div>
          </div>
        </>
      )}

      {pos === 'WR' && (
        <>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-gray-400">Usage</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <StatBox label="Targets" value={usage.targets} />
              <StatBox label="Rec" value={usage.receptions} />
              <StatBox label="Air Yds" value={usage.airYards} />
              <StatBox label="Tgt Share" value={usage.targetShare} format="pct" />
              <StatBox label="AY Share" value={usage.airYardsShare} format="pct" />
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-gray-400">Efficiency</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <StatBox label="Catch %" value={efficiency.catchRate} format="pct" />
              <StatBox label="Y/Tgt" value={efficiency.yardsPerTarget} format="decimal" />
              <StatBox label="EPA/Tgt" value={efficiency.epaPerTarget} format="decimal" />
              <StatBox label="YAC/Rec" value={efficiency.yacPerRec} format="decimal" />
              <StatBox label="YPRR" value={efficiency.yprrEst} format="decimal" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-400">Production</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatBox label="Rec Yds" value={finishing.recYards} />
              <StatBox label="TDs" value={finishing.tds} />
              <StatBox label="1st Downs" value={finishing.firstDowns} />
              <StatBox label="YAC" value={finishing.yac} />
            </div>
          </div>
        </>
      )}

      {pos === 'TE' && (
        <>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-gray-400">Usage</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <StatBox label="Targets" value={usage.targets} />
              <StatBox label="Rec" value={usage.receptions} />
              <StatBox label="Air Yds" value={usage.airYards} />
              <StatBox label="Tgt Share" value={usage.targetShare} format="pct" />
              <StatBox label="AY Share" value={usage.airYardsShare} format="pct" />
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-gray-400">Efficiency</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <StatBox label="Catch %" value={efficiency.catchRate} format="pct" />
              <StatBox label="Y/Tgt" value={efficiency.yardsPerTarget} format="decimal" />
              <StatBox label="EPA/Tgt" value={efficiency.epaPerTarget} format="decimal" />
              <StatBox label="YAC/Rec" value={efficiency.yacPerRec} format="decimal" />
              <StatBox label="Y/Rec" value={efficiency.yardsPerReception} format="decimal" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-400">Production</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatBox label="Rec Yds" value={finishing.recYards} />
              <StatBox label="TDs" value={finishing.tds} />
              <StatBox label="1st Downs" value={finishing.firstDowns} />
              <StatBox label="YAC" value={finishing.yac} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ForgeLab() {
  const [position, setPosition] = useState<ForgePosition | 'ALL'>('WR');
  const [limit, setLimit] = useState<number>(25);
  const [season, setSeason] = useState<number>(2024);
  const [week, setWeek] = useState<number>(17);

  const [scores, setScores] = useState<ForgeScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [snapshotInfo, setSnapshotInfo] = useState<null | {
    filePath: string;
    count: number;
    position: string;
    season: number;
    week: number;
  }>(null);
  const [inspectId, setInspectId] = useState('');
  const [inspectResult, setInspectResult] = useState<ForgeScore | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [playerContext, setPlayerContext] = useState<PlayerContextResponse | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchForgeBatch({ position, limit, season, week });
      setScores(res.scores);
      setLastMeta(res.meta);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Failed to load FORGE scores');
    } finally {
      setLoading(false);
    }
  };

  const handleExportSnapshot = async () => {
    try {
      setExporting(true);
      setError(null);
      setSnapshotInfo(null);

      const res = await createForgeSnapshot({
        position,
        limit,
        season,
        week,
      });

      if (res.success) {
        const s = res.snapshot;
        setSnapshotInfo({
          filePath: s.filePath,
          count: s.count,
          position: s.position,
          season: s.season,
          week: s.week,
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Failed to create FORGE snapshot');
    } finally {
      setExporting(false);
    }
  };

  const handleInspect = async () => {
    const id = inspectId.trim();
    if (!id) return;

    try {
      setInspecting(true);
      setError(null);
      setInspectResult(null);
      setPlayerContext(null);

      const [scoreRes, contextRes] = await Promise.allSettled([
        fetchForgeScore(id),
        fetchPlayerContext(id, 2025)
      ]);

      if (scoreRes.status === 'fulfilled' && scoreRes.value.success) {
        setInspectResult(scoreRes.value.score);
      }
      
      if (contextRes.status === 'fulfilled') {
        setPlayerContext(contextRes.value);
      }

      if (scoreRes.status === 'rejected' && contextRes.status === 'rejected') {
        setError('Failed to fetch player data');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Failed to fetch FORGE score for player');
      setInspectResult(null);
      setPlayerContext(null);
    } finally {
      setInspecting(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/" data-testid="link-back">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        <Card className="bg-[#141824] border-gray-800 mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Beaker className="h-8 w-8 text-purple-400" />
              <div>
                <CardTitle className="text-2xl text-white">FORGE Lab v0.1</CardTitle>
                <CardDescription className="text-gray-400">
                  Football-Oriented Recursive Grading Engine — Read-only alpha score viewer
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="position" className="text-gray-300">Position</Label>
                <Select 
                  value={position} 
                  onValueChange={(v) => setPosition(v as ForgePosition | 'ALL')}
                >
                  <SelectTrigger className="w-[120px] bg-[#1a1f2e] border-gray-700 text-white" data-testid="select-position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1f2e] border-gray-700">
                    {POSITIONS.map((pos) => (
                      <SelectItem key={pos} value={pos} data-testid={`option-position-${pos}`}>
                        {pos}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="limit" className="text-gray-300">Limit</Label>
                <Input
                  id="limit"
                  type="number"
                  value={limit}
                  min={1}
                  max={500}
                  onChange={(e) => setLimit(Number(e.target.value) || 1)}
                  className="w-[80px] bg-[#1a1f2e] border-gray-700 text-white"
                  data-testid="input-limit"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="season" className="text-gray-300">Season</Label>
                <Input
                  id="season"
                  type="number"
                  value={season}
                  onChange={(e) => setSeason(Number(e.target.value) || season)}
                  className="w-[90px] bg-[#1a1f2e] border-gray-700 text-white"
                  data-testid="input-season"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="week" className="text-gray-300">Week</Label>
                <Input
                  id="week"
                  type="number"
                  value={week}
                  onChange={(e) => setWeek(Number(e.target.value) || week)}
                  className="w-[70px] bg-[#1a1f2e] border-gray-700 text-white"
                  data-testid="input-week"
                />
              </div>

              <Button 
                onClick={load} 
                disabled={loading || exporting}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading…' : 'Refresh'}
              </Button>

              <Button
                onClick={handleExportSnapshot}
                disabled={exporting || loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="button-export-snapshot"
              >
                <Download className={`h-4 w-4 mr-2 ${exporting ? 'animate-pulse' : ''}`} />
                {exporting ? 'Exporting…' : 'Export Snapshot'}
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 items-end mt-4 pt-4 border-t border-gray-700">
              <div className="space-y-2">
                <Label htmlFor="inspectId" className="text-gray-300">Player ID</Label>
                <Input
                  id="inspectId"
                  type="text"
                  value={inspectId}
                  onChange={(e) => setInspectId(e.target.value)}
                  placeholder="e.g. ja-marr-chase"
                  className="w-[200px] bg-[#1a1f2e] border-gray-700 text-white placeholder:text-gray-400"
                  data-testid="input-inspect-id"
                />
              </div>
              <Button
                onClick={handleInspect}
                disabled={inspecting || !inspectId.trim()}
                variant="secondary"
                className="bg-[#1a1f2e] hover:bg-[#252b3d] border border-gray-600 text-white disabled:text-gray-500"
                data-testid="button-inspect"
              >
                {inspecting ? 'Inspecting…' : 'Inspect Player'}
              </Button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-300" data-testid="error-message">
                Error: {error}
              </div>
            )}

            {lastMeta && (
              <div className="mt-4 text-sm text-gray-400" data-testid="meta-info">
                Showing <span className="text-white font-medium">{lastMeta.count}</span> scores · 
                Position: <span className="text-white">{lastMeta.position}</span> · 
                Season: <span className="text-white">{lastMeta.season}</span> · 
                Week: <span className="text-white">{lastMeta.week}</span>
              </div>
            )}

            {snapshotInfo && (
              <div className="mt-3 p-3 bg-green-900/20 border border-green-700/50 rounded text-sm" data-testid="snapshot-info">
                <div className="text-green-300">
                  Snapshot created for <span className="font-medium">{snapshotInfo.position}</span> — 
                  Season {snapshotInfo.season}, Week {snapshotInfo.week}, 
                  Players: <span className="font-medium">{snapshotInfo.count}</span>
                </div>
                <code className="mt-1 block text-xs text-gray-400 bg-[#1a1f2e] p-2 rounded overflow-x-auto">
                  {snapshotInfo.filePath}
                </code>
              </div>
            )}

            {inspectResult && (
              <div className="mt-4 p-4 bg-[#020617] border border-gray-600 rounded-lg" data-testid="inspect-result">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-white text-lg">
                    {inspectResult.playerName ?? inspectResult.playerId}
                  </span>
                  <Badge variant="outline" className="border-gray-600 text-gray-300">
                    {inspectResult.position}
                  </Badge>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-400">{inspectResult.nflTeam ?? '-'}</span>
                </div>
                <div className="text-sm text-gray-400 mb-3">
                  Season {inspectResult.season} · Week {inspectResult.asOfWeek ?? '—'}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-[#1a1f2e] p-2 rounded">
                    <div className="text-gray-500 text-xs">Alpha</div>
                    <div className="font-mono text-white text-lg">{inspectResult.alpha.toFixed(1)}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded">
                    <div className="text-gray-500 text-xs">Trajectory</div>
                    <div className="flex items-center gap-1">
                      <TrajectoryIcon trajectory={inspectResult.trajectory} />
                      <span className="text-white">{inspectResult.trajectory}</span>
                    </div>
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded">
                    <div className="text-gray-500 text-xs">Confidence</div>
                    <ConfidenceBadge confidence={inspectResult.confidence} />
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded">
                    <div className="text-gray-500 text-xs">Games</div>
                    <div className="font-mono text-white">{inspectResult.gamesPlayed ?? 0}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2 text-sm">
                  <div className="bg-[#1a1f2e] p-2 rounded text-center">
                    <div className="text-gray-500 text-xs">Vol</div>
                    <div className="font-mono text-gray-300">{inspectResult.subScores.volume}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded text-center">
                    <div className="text-gray-500 text-xs">Eff</div>
                    <div className="font-mono text-gray-300">{inspectResult.subScores.efficiency}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded text-center">
                    <div className="text-gray-500 text-xs">Role</div>
                    <div className="font-mono text-gray-300">{inspectResult.subScores.roleLeverage}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded text-center">
                    <div className="text-gray-500 text-xs">Stab</div>
                    <div className="font-mono text-gray-300">{inspectResult.subScores.stability}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded text-center">
                    <div className="text-gray-500 text-xs">Ctx</div>
                    <div className="font-mono text-gray-300">{inspectResult.subScores.contextFit}</div>
                  </div>
                </div>
                {inspectResult.dataQuality?.cappedDueToMissingData && (
                  <div className="mt-3 text-xs text-yellow-400">
                    ⚠ Score capped due to missing data
                  </div>
                )}
              </div>
            )}

            {playerContext?.fantasy && (
              <div className="mt-4 p-4 bg-[#020617] border border-gray-600 rounded-lg" data-testid="fantasy-summary">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  <span className="font-semibold text-white">Fantasy Summary</span>
                </div>
                
                <div className="text-sm text-gray-300 mb-4 bg-[#1a1f2e] p-3 rounded" data-testid="fantasy-summary-text">
                  Through Week {playerContext.fantasy.dataThroughWeek ?? '?'}, {playerContext.identity.displayName} is {playerContext.identity.position}{playerContext.fantasy.pprRankPos} in PPR with {playerContext.fantasy.totalPpr?.toFixed(1) ?? '?'} points over {playerContext.fantasy.gamesPlayed ?? '?'} games.
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-[#1a1f2e] p-2 rounded">
                    <div className="text-gray-500 text-xs">Games</div>
                    <div className="font-mono text-white">{playerContext.fantasy.gamesPlayed ?? '-'}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded">
                    <div className="text-gray-500 text-xs">Last Played</div>
                    <div className="font-mono text-white">Week {playerContext.fantasy.lastWeekPlayed ?? '-'}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded">
                    <div className="text-gray-500 text-xs">Data Through</div>
                    <div className="font-mono text-white">Week {playerContext.fantasy.dataThroughWeek ?? '-'}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded">
                    <div className="text-gray-500 text-xs">PPR Rank</div>
                    <div className="font-mono text-white">{playerContext.identity.position}{playerContext.fantasy.pprRankPos ?? '-'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                  <div className="bg-[#1a1f2e] p-2 rounded text-center">
                    <div className="text-gray-500 text-xs">Total PPR</div>
                    <div className="font-mono text-green-400 text-lg">{playerContext.fantasy.totalPpr?.toFixed(1) ?? '-'}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded text-center">
                    <div className="text-gray-500 text-xs">Total Half-PPR</div>
                    <div className="font-mono text-blue-400 text-lg">{playerContext.fantasy.totalHalfPpr?.toFixed(1) ?? '-'}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded text-center">
                    <div className="text-gray-500 text-xs">Total Standard</div>
                    <div className="font-mono text-gray-300 text-lg">{playerContext.fantasy.totalStd?.toFixed(1) ?? '-'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                  <div className="bg-[#1a1f2e] p-2 rounded text-center">
                    <div className="text-gray-500 text-xs">Last Week PPR</div>
                    <div className="font-mono text-green-400">{playerContext.fantasy.lastWeekPpr?.toFixed(1) ?? '-'}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded text-center">
                    <div className="text-gray-500 text-xs">Last Week Half</div>
                    <div className="font-mono text-blue-400">{playerContext.fantasy.lastWeekHalfPpr?.toFixed(1) ?? '-'}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-2 rounded text-center">
                    <div className="text-gray-500 text-xs">Last Week Std</div>
                    <div className="font-mono text-gray-300">{playerContext.fantasy.lastWeekStd?.toFixed(1) ?? '-'}</div>
                  </div>
                </div>
              </div>
            )}

            {playerContext && <AdvancedStatsPanel context={playerContext} />}
          </CardContent>
        </Card>

        <Card className="bg-[#141824] border-gray-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-sm" data-testid="scores-table">
                <thead className="bg-[#1a1f2e] sticky top-0">
                  <tr>
                    <th className="text-left p-3 text-gray-400 font-medium border-b border-gray-700">Player</th>
                    <th className="text-center p-3 text-gray-400 font-medium border-b border-gray-700">Pos</th>
                    <th className="text-center p-3 text-gray-400 font-medium border-b border-gray-700">Team</th>
                    <th className="text-center p-3 text-gray-400 font-medium border-b border-gray-700">Alpha</th>
                    <th className="text-center p-3 text-gray-400 font-medium border-b border-gray-700">Traj</th>
                    <th className="text-center p-3 text-gray-400 font-medium border-b border-gray-700">Conf</th>
                    <th className="text-center p-3 text-gray-400 font-medium border-b border-gray-700">Vol</th>
                    <th className="text-center p-3 text-gray-400 font-medium border-b border-gray-700">Eff</th>
                    <th className="text-center p-3 text-gray-400 font-medium border-b border-gray-700">Role</th>
                    <th className="text-center p-3 text-gray-400 font-medium border-b border-gray-700">Stab</th>
                    <th className="text-center p-3 text-gray-400 font-medium border-b border-gray-700">Ctx</th>
                    <th className="text-center p-3 text-gray-400 font-medium border-b border-gray-700">Games</th>
                    <th className="text-center p-3 text-gray-400 font-medium border-b border-gray-700">Capped?</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && scores.length === 0 && (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 13 }).map((_, j) => (
                          <td key={j} className="p-3 border-b border-gray-800">
                            <Skeleton className="h-4 w-full bg-gray-700" />
                          </td>
                        ))}
                      </tr>
                    ))
                  )}

                  {scores.map((s, index) => (
                    <tr 
                      key={`${s.playerId}-${s.season}-${s.asOfWeek ?? ''}`}
                      className="hover:bg-[#1a1f2e] transition-colors"
                      data-testid={`row-player-${index}`}
                    >
                      <td className="p-3 border-b border-gray-800 font-medium text-white">
                        {s.playerName ?? s.playerId}
                      </td>
                      <td className="p-3 border-b border-gray-800 text-center">
                        <Badge variant="outline" className="border-gray-600 text-gray-300">
                          {s.position}
                        </Badge>
                      </td>
                      <td className="p-3 border-b border-gray-800 text-center text-gray-400">
                        {s.nflTeam ?? '-'}
                      </td>
                      <td className="p-3 border-b border-gray-800 text-center">
                        <AlphaBadge alpha={s.alpha} />
                      </td>
                      <td className="p-3 border-b border-gray-800 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <TrajectoryIcon trajectory={s.trajectory} />
                          <span className="text-xs text-gray-500">{s.trajectory}</span>
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-800 text-center">
                        <ConfidenceBadge confidence={s.confidence} />
                      </td>
                      <td className="p-3 border-b border-gray-800 text-center font-mono text-gray-300">
                        {s.subScores.volume}
                      </td>
                      <td className="p-3 border-b border-gray-800 text-center font-mono text-gray-300">
                        {s.subScores.efficiency}
                      </td>
                      <td className="p-3 border-b border-gray-800 text-center font-mono text-gray-300">
                        {s.subScores.roleLeverage}
                      </td>
                      <td className="p-3 border-b border-gray-800 text-center font-mono text-gray-300">
                        {s.subScores.stability}
                      </td>
                      <td className="p-3 border-b border-gray-800 text-center font-mono text-gray-300">
                        {s.subScores.contextFit}
                      </td>
                      <td className="p-3 border-b border-gray-800 text-center font-mono text-gray-300">
                        {s.gamesPlayed ?? 0}
                      </td>
                      <td className="p-3 border-b border-gray-800 text-center">
                        {s.dataQuality?.cappedDueToMissingData ? (
                          <Badge variant="outline" className="border-yellow-600 text-yellow-400 text-xs">
                            capped
                          </Badge>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {scores.length === 0 && !loading && (
                    <tr>
                      <td colSpan={13} className="p-8 text-center text-gray-500" data-testid="empty-state">
                        No scores returned. Try adjusting the filters and click Refresh.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
