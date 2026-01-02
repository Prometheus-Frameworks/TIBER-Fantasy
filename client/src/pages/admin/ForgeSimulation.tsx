import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Play,
  Square,
  RefreshCw,
  Settings2,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Eye,
  Flag,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface SimulationParameters {
  decayRatio: number;
  baselineWeight: number;
  volatilityHighThreshold: number;
  volatilityLowThreshold: number;
  momentumMultiplier: number;
  adjustmentCap: number;
  historyWindowVolatility: number;
  historyWindowMomentum: number;
  outlierLargeAdjustment: number;
  outlierVolatilitySpike: number;
}

interface SimulationProgress {
  runId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentWeek: number;
  totalWeeks: number;
  totalPlayers: number;
  processedPlayers: number;
  outlierCount: number;
  error?: string;
}

interface SimulationRun {
  id: string;
  presetName: string | null;
  season: number;
  weekStart: number;
  weekEnd: number;
  status: string;
  currentWeek: number | null;
  totalPlayers: number | null;
  processedPlayers: number | null;
  outlierCount: number | null;
  avgAdjustmentMagnitude: number | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

interface SimulationResult {
  id: number;
  simRunId: string;
  playerId: string;
  playerName: string | null;
  position: string | null;
  team: string | null;
  season: number;
  week: number;
  alphaRaw: number | null;
  alphaFinal: number | null;
  expectedAlpha: number | null;
  surprise: number | null;
  stabilityAdjustment: number | null;
  volatilityPrev: number | null;
  volatilityUpdated: number | null;
  momentum: number | null;
  momentumUpdated: number | null;
  tierFinal: number | null;
  outlierFlags: string[] | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
}

interface Preset {
  id: number;
  name: string;
  description: string | null;
  decayRatio: number;
  baselineWeight: number;
  volatilityHighThreshold: number;
  volatilityLowThreshold: number;
  momentumMultiplier: number;
  adjustmentCap: number;
  historyWindowVolatility: number;
  historyWindowMomentum: number;
  outlierLargeAdjustment: number;
  outlierVolatilitySpike: number;
  isDefault: boolean;
}

const DEFAULT_PARAMETERS: SimulationParameters = {
  decayRatio: 0.7,
  baselineWeight: 0.3,
  volatilityHighThreshold: 10,
  volatilityLowThreshold: 5,
  momentumMultiplier: 0.15,
  adjustmentCap: 10,
  historyWindowVolatility: 4,
  historyWindowMomentum: 3,
  outlierLargeAdjustment: 8,
  outlierVolatilitySpike: 15,
};

export default function ForgeSimulation() {
  const queryClient = useQueryClient();
  
  const [season, setSeason] = useState(2025);
  const [weekStart, setWeekStart] = useState(1);
  const [weekEnd, setWeekEnd] = useState(17);
  const [clearPrevious, setClearPrevious] = useState(false);
  const [parameters, setParameters] = useState<SimulationParameters>(DEFAULT_PARAMETERS);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [paramsOpen, setParamsOpen] = useState(true);
  
  const [positionFilter, setPositionFilter] = useState<string>('');
  const [weekFilter, setWeekFilter] = useState<string>('');
  const [minAdjustment, setMinAdjustment] = useState<string>('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [outlierOnly, setOutlierOnly] = useState(false);
  
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  
  const { data: presetsData, isLoading: presetsLoading } = useQuery<{ data: Preset[] }>({
    queryKey: ['/api/forge/simulation/presets'],
  });
  const presets: Preset[] = presetsData?.data ?? [];
  
  const { data: runsData, refetch: refetchRuns } = useQuery<{ data: SimulationRun[] }>({
    queryKey: ['/api/forge/simulation/runs'],
  });
  const runs: SimulationRun[] = runsData?.data ?? [];
  
  const { data: progressData, refetch: refetchProgress } = useQuery<{ data: SimulationProgress }>({
    queryKey: ['/api/forge/simulation/progress', activeRunId],
    enabled: !!activeRunId,
    refetchInterval: activeRunId ? 2000 : false,
  });
  const progress: SimulationProgress | null = progressData?.data ?? null;
  
  useEffect(() => {
    if (progress?.status === 'completed' || progress?.status === 'failed' || progress?.status === 'cancelled') {
      setActiveRunId(null);
      refetchRuns();
    }
  }, [progress?.status, refetchRuns]);
  
  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ['/api/forge/simulation/results', selectedRunId, positionFilter, weekFilter, minAdjustment, playerSearch, outlierOnly],
    enabled: !!selectedRunId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (positionFilter) params.set('position', positionFilter);
      if (weekFilter) params.set('weekStart', weekFilter);
      if (weekFilter) params.set('weekEnd', weekFilter);
      if (minAdjustment) params.set('minAdjustment', minAdjustment);
      if (playerSearch) params.set('playerSearch', playerSearch);
      if (outlierOnly) params.set('outlierOnly', 'true');
      params.set('limit', '200');
      
      const res = await fetch(`/api/forge/simulation/results/${selectedRunId}?${params.toString()}`);
      return res.json();
    },
  });
  const results: SimulationResult[] = resultsData?.data?.results ?? [];
  const resultsTotal = resultsData?.data?.total ?? 0;
  
  const { data: diffData, isLoading: diffLoading } = useQuery({
    queryKey: ['/api/forge/simulation/diff', selectedRunId, selectedPlayerId],
    enabled: !!selectedRunId && !!selectedPlayerId,
    queryFn: async () => {
      const res = await fetch(`/api/forge/simulation/diff/${selectedRunId}/${selectedPlayerId}`);
      return res.json();
    },
  });
  const diffResults: SimulationResult[] = diffData?.data ?? [];
  
  const { data: outliersData } = useQuery({
    queryKey: ['/api/forge/simulation/outliers', selectedRunId],
    enabled: !!selectedRunId,
    queryFn: async () => {
      const res = await fetch(`/api/forge/simulation/outliers/${selectedRunId}`);
      return res.json();
    },
  });
  const outliers: SimulationResult[] = outliersData?.data ?? [];
  
  const runSimulation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/forge/simulation/run', {
        season,
        weekStart,
        weekEnd,
        parameters,
        clearPrevious,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setActiveRunId(data.data.runId);
      setSelectedRunId(data.data.runId);
    },
  });
  
  const cancelSimulation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', `/api/forge/simulation/cancel/${activeRunId}`);
    },
    onSuccess: () => {
      setActiveRunId(null);
      refetchRuns();
    },
  });
  
  const savePreset = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/forge/simulation/presets', {
        name: newPresetName,
        description: newPresetDescription || null,
        parameters,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forge/simulation/presets'] });
      setSavePresetOpen(false);
      setNewPresetName('');
      setNewPresetDescription('');
    },
  });
  
  const deleteRun = useMutation({
    mutationFn: async (runId: string) => {
      await apiRequest('DELETE', `/api/forge/simulation/runs/${runId}`);
    },
    onSuccess: () => {
      refetchRuns();
      if (selectedRunId) setSelectedRunId(null);
    },
  });
  
  const markReviewed = useMutation({
    mutationFn: async ({ playerId, week }: { playerId: string; week: number }) => {
      await apiRequest('POST', `/api/forge/simulation/outliers/${selectedRunId}/review`, {
        playerId,
        week,
        reviewedBy: 'admin',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forge/simulation/outliers', selectedRunId] });
      queryClient.invalidateQueries({ queryKey: ['/api/forge/simulation/results', selectedRunId] });
    },
  });
  
  const loadPreset = (preset: Preset) => {
    setParameters({
      decayRatio: preset.decayRatio,
      baselineWeight: preset.baselineWeight,
      volatilityHighThreshold: preset.volatilityHighThreshold,
      volatilityLowThreshold: preset.volatilityLowThreshold,
      momentumMultiplier: preset.momentumMultiplier,
      adjustmentCap: preset.adjustmentCap,
      historyWindowVolatility: preset.historyWindowVolatility,
      historyWindowMomentum: preset.historyWindowMomentum,
      outlierLargeAdjustment: preset.outlierLargeAdjustment,
      outlierVolatilitySpike: preset.outlierVolatilitySpike,
    });
  };
  
  const resetToDefaults = () => {
    setParameters(DEFAULT_PARAMETERS);
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-blue-600"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
      case 'completed':
        return <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-600"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'cancelled':
        return <Badge className="bg-yellow-600"><Square className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge className="bg-gray-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };
  
  const getAdjustmentColor = (adj: number | null) => {
    if (adj === null) return 'text-gray-500';
    if (adj > 3) return 'text-green-400';
    if (adj < -3) return 'text-red-400';
    return 'text-gray-400';
  };
  
  const formatNumber = (val: number | null, decimals = 1) => {
    if (val === null || val === undefined) return '—';
    return val.toFixed(decimals);
  };
  
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-6" data-testid="forge-simulation-page">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/forge-hub">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" data-testid="back-button">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to FORGE Hub
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">FORGE Recursive Simulation</h1>
          </div>
          <Badge variant="outline" className="text-purple-400 border-purple-400">
            Admin Tool
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Collapsible open={controlsOpen} onOpenChange={setControlsOpen}>
              <Card className="bg-[#141824] border-gray-800">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Play className="w-5 h-5 text-green-400" />
                        <CardTitle className="text-lg">Simulation Controls</CardTitle>
                      </div>
                      {controlsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Season</Label>
                        <Select value={season.toString()} onValueChange={(v) => setSeason(parseInt(v))}>
                          <SelectTrigger data-testid="season-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2024">2024</SelectItem>
                            <SelectItem value="2025">2025</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Week Range: {weekStart} - {weekEnd}</Label>
                      <div className="flex gap-4 items-center">
                        <Slider
                          value={[weekStart, weekEnd]}
                          onValueChange={([s, e]) => { setWeekStart(s); setWeekEnd(e); }}
                          min={1}
                          max={17}
                          step={1}
                          className="flex-1"
                          data-testid="week-range-slider"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label>Clear Previous Run</Label>
                      <Switch checked={clearPrevious} onCheckedChange={setClearPrevious} data-testid="clear-previous-switch" />
                    </div>
                    
                    <Separator />
                    
                    {activeRunId && progress ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span>Week {progress.currentWeek} of {progress.totalWeeks + progress.currentWeek - 1}</span>
                          <span>{progress.processedPlayers} players</span>
                        </div>
                        <Progress 
                          value={(progress.currentWeek - weekStart) / (weekEnd - weekStart + 1) * 100} 
                          className="h-2"
                        />
                        <div className="flex items-center justify-between">
                          {getStatusBadge(progress.status)}
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => cancelSimulation.mutate()}
                            disabled={cancelSimulation.isPending}
                            data-testid="cancel-button"
                          >
                            <Square className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => runSimulation.mutate()}
                        disabled={runSimulation.isPending}
                        data-testid="run-simulation-button"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {runSimulation.isPending ? 'Starting...' : 'Run Simulation'}
                      </Button>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
            
            <Collapsible open={paramsOpen} onOpenChange={setParamsOpen}>
              <Card className="bg-[#141824] border-gray-800">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-blue-400" />
                        <CardTitle className="text-lg">Parameter Tuning</CardTitle>
                      </div>
                      {paramsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <Label>Decay Ratio (prior weight)</Label>
                        <span className="text-gray-400">{parameters.decayRatio.toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[parameters.decayRatio]}
                        onValueChange={([v]) => setParameters(p => ({ ...p, decayRatio: v, baselineWeight: 1 - v }))}
                        min={0.5}
                        max={0.9}
                        step={0.05}
                        data-testid="decay-ratio-slider"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <Label>Volatility High Threshold</Label>
                        <span className="text-gray-400">{parameters.volatilityHighThreshold}</span>
                      </div>
                      <Slider
                        value={[parameters.volatilityHighThreshold]}
                        onValueChange={([v]) => setParameters(p => ({ ...p, volatilityHighThreshold: v }))}
                        min={5}
                        max={20}
                        step={1}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <Label>Volatility Low Threshold</Label>
                        <span className="text-gray-400">{parameters.volatilityLowThreshold}</span>
                      </div>
                      <Slider
                        value={[parameters.volatilityLowThreshold]}
                        onValueChange={([v]) => setParameters(p => ({ ...p, volatilityLowThreshold: v }))}
                        min={2}
                        max={10}
                        step={1}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <Label>Momentum Multiplier</Label>
                        <span className="text-gray-400">{parameters.momentumMultiplier.toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[parameters.momentumMultiplier]}
                        onValueChange={([v]) => setParameters(p => ({ ...p, momentumMultiplier: v }))}
                        min={0.05}
                        max={0.3}
                        step={0.01}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <Label>Adjustment Cap (±)</Label>
                        <span className="text-gray-400">{parameters.adjustmentCap}</span>
                      </div>
                      <Slider
                        value={[parameters.adjustmentCap]}
                        onValueChange={([v]) => setParameters(p => ({ ...p, adjustmentCap: v }))}
                        min={5}
                        max={20}
                        step={1}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <Label>History Window (Volatility)</Label>
                        <span className="text-gray-400">{parameters.historyWindowVolatility} weeks</span>
                      </div>
                      <Slider
                        value={[parameters.historyWindowVolatility]}
                        onValueChange={([v]) => setParameters(p => ({ ...p, historyWindowVolatility: v }))}
                        min={3}
                        max={8}
                        step={1}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <Label>History Window (Momentum)</Label>
                        <span className="text-gray-400">{parameters.historyWindowMomentum} weeks</span>
                      </div>
                      <Slider
                        value={[parameters.historyWindowMomentum]}
                        onValueChange={([v]) => setParameters(p => ({ ...p, historyWindowMomentum: v }))}
                        min={2}
                        max={6}
                        step={1}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={resetToDefaults} className="flex-1" data-testid="reset-defaults-button">
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Reset
                      </Button>
                      <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1" data-testid="save-preset-button">
                            <Save className="w-3 h-3 mr-1" />
                            Save Preset
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#141824] border-gray-800">
                          <DialogHeader>
                            <DialogTitle>Save Preset</DialogTitle>
                            <DialogDescription>Save current parameters as a named preset</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Name</Label>
                              <Input 
                                value={newPresetName} 
                                onChange={(e) => setNewPresetName(e.target.value)}
                                placeholder="e.g., Conservative Tuning"
                                data-testid="preset-name-input"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Description (optional)</Label>
                              <Input 
                                value={newPresetDescription} 
                                onChange={(e) => setNewPresetDescription(e.target.value)}
                                placeholder="e.g., Lower momentum influence"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setSavePresetOpen(false)}>Cancel</Button>
                            <Button 
                              onClick={() => savePreset.mutate()}
                              disabled={!newPresetName || savePreset.isPending}
                            >
                              Save
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    {presets.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-400">Load Preset</Label>
                        <Select onValueChange={(v) => {
                          const preset = presets.find(p => p.id.toString() === v);
                          if (preset) loadPreset(preset);
                        }}>
                          <SelectTrigger data-testid="load-preset-select">
                            <SelectValue placeholder="Select preset..." />
                          </SelectTrigger>
                          <SelectContent>
                            {presets.map(preset => (
                              <SelectItem key={preset.id} value={preset.id.toString()}>
                                {preset.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
            
            <Card className="bg-[#141824] border-gray-800">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <CardTitle className="text-lg">Previous Runs</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  {runs.length === 0 ? (
                    <p className="text-sm text-gray-500">No simulation runs yet</p>
                  ) : (
                    <div className="space-y-2">
                      {runs.slice(0, 10).map(run => (
                        <div 
                          key={run.id}
                          className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                            selectedRunId === run.id ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 hover:border-gray-600'
                          }`}
                          onClick={() => setSelectedRunId(run.id)}
                          data-testid={`run-${run.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{run.presetName || 'Custom'}</span>
                            {getStatusBadge(run.status)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Season {run.season}, Weeks {run.weekStart}-{run.weekEnd}
                          </div>
                          {run.status === 'completed' && (
                            <div className="text-xs text-gray-400 mt-1">
                              {run.outlierCount} outliers • Avg adj: {run.avgAdjustmentMagnitude?.toFixed(2) ?? '—'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
          
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-[#141824] border-gray-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                    <CardTitle className="text-lg">Simulation Results</CardTitle>
                    {selectedRunId && <Badge variant="outline" className="text-xs">{resultsTotal} records</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!selectedRunId ? (
                  <div className="text-center text-gray-500 py-12">
                    Select a run from the left panel or start a new simulation
                  </div>
                ) : (
                  <Tabs defaultValue="table" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="table" data-testid="tab-table">Output Table</TabsTrigger>
                      <TabsTrigger value="diff" data-testid="tab-diff">Diff View</TabsTrigger>
                      <TabsTrigger value="outliers" data-testid="tab-outliers">
                        Outliers
                        {outliers.length > 0 && (
                          <Badge variant="destructive" className="ml-2 text-xs">{outliers.length}</Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="table">
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-3">
                          <Select value={positionFilter} onValueChange={setPositionFilter}>
                            <SelectTrigger className="w-[100px]" data-testid="position-filter">
                              <SelectValue placeholder="Position" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All</SelectItem>
                              <SelectItem value="QB">QB</SelectItem>
                              <SelectItem value="RB">RB</SelectItem>
                              <SelectItem value="WR">WR</SelectItem>
                              <SelectItem value="TE">TE</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Select value={weekFilter} onValueChange={setWeekFilter}>
                            <SelectTrigger className="w-[100px]" data-testid="week-filter">
                              <SelectValue placeholder="Week" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All</SelectItem>
                              {Array.from({ length: 17 }, (_, i) => i + 1).map(w => (
                                <SelectItem key={w} value={w.toString()}>Week {w}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Input
                            placeholder="Min |Adj|"
                            value={minAdjustment}
                            onChange={(e) => setMinAdjustment(e.target.value)}
                            className="w-[100px]"
                            type="number"
                            data-testid="min-adjustment-input"
                          />
                          
                          <div className="flex-1">
                            <Input
                              placeholder="Search player..."
                              value={playerSearch}
                              onChange={(e) => setPlayerSearch(e.target.value)}
                              className="w-full"
                              data-testid="player-search-input"
                            />
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Switch checked={outlierOnly} onCheckedChange={setOutlierOnly} data-testid="outlier-only-switch" />
                            <Label className="text-sm">Outliers only</Label>
                          </div>
                        </div>
                        
                        <ScrollArea className="h-[500px]">
                          {resultsLoading ? (
                            <div className="space-y-2">
                              {Array.from({ length: 10 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full bg-gray-800" />
                              ))}
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow className="border-gray-700">
                                  <TableHead>Player</TableHead>
                                  <TableHead className="text-center">Wk</TableHead>
                                  <TableHead className="text-center">α Raw</TableHead>
                                  <TableHead className="text-center">α Final</TableHead>
                                  <TableHead className="text-center">Adj</TableHead>
                                  <TableHead className="text-center">Vol</TableHead>
                                  <TableHead className="text-center">Mom</TableHead>
                                  <TableHead className="text-center">Surprise</TableHead>
                                  <TableHead></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {results.map((r, idx) => (
                                  <TableRow key={`${r.playerId}-${r.week}`} className="border-gray-800 hover:bg-gray-800/30">
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">{r.position}</Badge>
                                        <span className="font-medium">{r.playerName}</span>
                                        {r.outlierFlags && r.outlierFlags.length > 0 && (
                                          <Flag className="w-3 h-3 text-amber-400" />
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">{r.week}</TableCell>
                                    <TableCell className="text-center font-mono">{formatNumber(r.alphaRaw)}</TableCell>
                                    <TableCell className="text-center font-mono font-semibold">{formatNumber(r.alphaFinal)}</TableCell>
                                    <TableCell className={`text-center font-mono ${getAdjustmentColor(r.stabilityAdjustment)}`}>
                                      {r.stabilityAdjustment !== null ? (r.stabilityAdjustment >= 0 ? '+' : '') + formatNumber(r.stabilityAdjustment) : '—'}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-gray-400">{formatNumber(r.volatilityUpdated)}</TableCell>
                                    <TableCell className="text-center font-mono text-gray-400">{formatNumber(r.momentumUpdated)}</TableCell>
                                    <TableCell className="text-center font-mono text-gray-400">{formatNumber(r.surprise)}</TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedPlayerId(r.playerId)}
                                        data-testid={`view-diff-${r.playerId}`}
                                      >
                                        <Eye className="w-3 h-3" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </ScrollArea>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="diff">
                      {!selectedPlayerId ? (
                        <div className="text-center text-gray-500 py-12">
                          Click the eye icon on a player row to view their season diff
                        </div>
                      ) : diffLoading ? (
                        <div className="space-y-4">
                          <Skeleton className="h-[300px] w-full bg-gray-800" />
                          <Skeleton className="h-[200px] w-full bg-gray-800" />
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-semibold">{diffResults[0]?.playerName}</h3>
                              <Badge variant="outline">{diffResults[0]?.position}</Badge>
                              <Badge variant="outline" className="text-gray-400">{diffResults[0]?.team}</Badge>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedPlayerId(null)}>
                              Clear
                            </Button>
                          </div>
                          
                          <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={diffResults}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="week" stroke="#9ca3af" tickFormatter={(w) => `W${w}`} />
                                <YAxis stroke="#9ca3af" domain={[0, 100]} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                                  labelFormatter={(w) => `Week ${w}`}
                                />
                                <Legend />
                                <Area
                                  type="monotone"
                                  dataKey="stabilityAdjustment"
                                  fill="#8b5cf6"
                                  fillOpacity={0.3}
                                  stroke="none"
                                  name="Adjustment"
                                />
                                <Line type="monotone" dataKey="alphaRaw" stroke="#3b82f6" strokeWidth={2} name="α Raw (Pass 0)" dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="alphaFinal" stroke="#10b981" strokeWidth={2} name="α Final (Pass 1)" dot={{ r: 3 }} />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                          
                          <ScrollArea className="h-[200px]">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-gray-700">
                                  <TableHead>Week</TableHead>
                                  <TableHead className="text-center">Raw</TableHead>
                                  <TableHead className="text-center">Final</TableHead>
                                  <TableHead className="text-center">Adj</TableHead>
                                  <TableHead className="text-center">Vol</TableHead>
                                  <TableHead className="text-center">Mom</TableHead>
                                  <TableHead className="text-center">Surprise</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {diffResults.map(r => (
                                  <TableRow key={r.week} className="border-gray-800">
                                    <TableCell className="font-medium">Week {r.week}</TableCell>
                                    <TableCell className="text-center font-mono">{formatNumber(r.alphaRaw)}</TableCell>
                                    <TableCell className="text-center font-mono font-semibold">{formatNumber(r.alphaFinal)}</TableCell>
                                    <TableCell className={`text-center font-mono ${getAdjustmentColor(r.stabilityAdjustment)}`}>
                                      {r.stabilityAdjustment !== null ? (r.stabilityAdjustment >= 0 ? '+' : '') + formatNumber(r.stabilityAdjustment) : '—'}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-gray-400">{formatNumber(r.volatilityUpdated)}</TableCell>
                                    <TableCell className="text-center font-mono text-gray-400">{formatNumber(r.momentumUpdated)}</TableCell>
                                    <TableCell className="text-center font-mono text-gray-400">{formatNumber(r.surprise)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="outliers">
                      <div className="space-y-4">
                        <p className="text-sm text-gray-400">
                          Auto-flagged player-weeks that may need manual review
                        </p>
                        
                        <ScrollArea className="h-[500px]">
                          {outliers.length === 0 ? (
                            <div className="text-center text-gray-500 py-12">
                              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500/50" />
                              <p>No outliers detected in this run</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {outliers.map(o => (
                                <div
                                  key={`${o.playerId}-${o.week}`}
                                  className={`p-3 rounded-lg border ${o.reviewedAt ? 'border-gray-700 opacity-60' : 'border-amber-500/50 bg-amber-500/5'}`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{o.playerName}</span>
                                        <Badge variant="outline" className="text-xs">{o.position}</Badge>
                                        <span className="text-sm text-gray-400">Week {o.week}</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {o.outlierFlags?.map(flag => (
                                          <Badge key={flag} variant="destructive" className="text-xs">
                                            {flag.replace(/_/g, ' ')}
                                          </Badge>
                                        ))}
                                      </div>
                                      <div className="text-xs text-gray-400 mt-2">
                                        α: {formatNumber(o.alphaRaw)} → {formatNumber(o.alphaFinal)} (adj: {formatNumber(o.stabilityAdjustment)})
                                        {' | '}Vol: {formatNumber(o.volatilityUpdated)} | Mom: {formatNumber(o.momentumUpdated)}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedPlayerId(o.playerId)}
                                      >
                                        <Eye className="w-3 h-3" />
                                      </Button>
                                      {!o.reviewedAt && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => markReviewed.mutate({ playerId: o.playerId, week: o.week })}
                                          disabled={markReviewed.isPending}
                                          data-testid={`review-${o.playerId}-${o.week}`}
                                        >
                                          <Check className="w-3 h-3 mr-1" />
                                          Reviewed
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  {o.reviewedAt && (
                                    <div className="text-xs text-gray-500 mt-2">
                                      Reviewed by {o.reviewedBy} on {new Date(o.reviewedAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
