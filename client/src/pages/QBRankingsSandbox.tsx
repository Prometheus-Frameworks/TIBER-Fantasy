import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, RotateCcw, Save, Download, Upload, Copy, X, GitBranch, Eye, Users, Zap, Target, TrendingUp, Shield } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface QBPreset {
  id: string;
  label: string;
  weights: { volume: number; production: number; efficiency: number; context: number };
  description?: string;
  isBuiltIn?: boolean;
}

interface QBFormulaExport {
  version: string;
  weights: { volume: number; production: number; efficiency: number; context: number };
}

interface QBCandidateFormula {
  id: string;
  createdAt: string;
  weights: { volume: number; production: number; efficiency: number; context: number };
}

const BUILT_IN_QB_PRESETS: QBPreset[] = [
  { id: 'default', label: 'Balanced QB', weights: { volume: 25, production: 25, efficiency: 35, context: 15 }, description: 'Default weights', isBuiltIn: true },
  { id: 'deep-ball', label: 'Deep Ball Hunter', weights: { volume: 20, production: 25, efficiency: 45, context: 10 }, description: 'Prioritize efficiency & deep accuracy', isBuiltIn: true },
  { id: 'game-manager', label: 'Game Manager', weights: { volume: 30, production: 20, efficiency: 40, context: 10 }, description: 'Volume + efficiency focus', isBuiltIn: true },
  { id: 'dual-threat', label: 'Dual Threat', weights: { volume: 20, production: 35, efficiency: 30, context: 15 }, description: 'Rushing value prioritized', isBuiltIn: true },
  { id: 'pure-efficiency', label: 'Pure Efficiency', weights: { volume: 15, production: 20, efficiency: 55, context: 10 }, description: 'Maximum EPA/CPOE weight', isBuiltIn: true },
  { id: 'qb_fantasy_lens_v1', label: 'Fantasy Lens v1', weights: { volume: 20, production: 40, efficiency: 25, context: 15 }, description: 'Fantasy-first, Konami emphasized', isBuiltIn: true },
  { id: 'qb_realball_lens_v1', label: 'Real Ball Lens v1', weights: { volume: 20, production: 20, efficiency: 40, context: 20 }, description: 'Real QB quality, efficiency + context', isBuiltIn: true },
];

type KonamiMode = 'default' | 'fantasy' | 'realball';

const getKonamiMode = (presetId: string): KonamiMode => {
  if (presetId === 'qb_fantasy_lens_v1') return 'fantasy';
  if (presetId === 'qb_realball_lens_v1') return 'realball';
  return 'default';
};

const QB_WEIGHTS_KEY = 'tiber_qb_sandbox_weights_v1';
const QB_LAST_PRESET_KEY = 'tiber_qb_sandbox_last_preset';
const QB_USER_PRESETS_KEY = 'tiber_qb_sandbox_user_presets';
const QB_CANDIDATE_FORMULAS_KEY = 'tiber_qb_candidate_formulas';

type SortField = 'playerName' | 'team' | 'games' | 'attempts' | 'completionPct' | 'passingYards' | 'passingTds' | 'avgEpa' | 'cpoe' | 'anyA' | 'rushYards' | 'rushTds' | 'totalFantasyPoints' | 'fpPerGame' | 'volumeIndex' | 'productionIndex' | 'efficiencyIndex' | 'contextIndex' | 'customAlphaScore' | 'alphaScore' | 'sackRate' | 'deepAccuracy' | 'rushFpPerGame';
type SortOrder = 'asc' | 'desc';

interface QBSandboxPlayer {
  playerId: string;
  playerName: string;
  team: string;
  games: number;
  attempts: number;
  completions: number;
  passingYards: number;
  passingTds: number;
  interceptions: number;
  sacks: number;
  sackYards: number;
  totalAirYards: number;
  completionPct: number;
  yardsPerAttempt: number;
  aDot: number;
  tdRate: number;
  intRate: number;
  avgEpa: number;
  adjEpaPerPlay: number;
  anyA: number;
  cpoe: number | null;
  deepAccuracy: number | null;
  intermediateAccuracy: number | null;
  shortAccuracy: number | null;
  carries: number;
  rushYards: number;
  rushTds: number;
  rushEpa: number;
  scrambles: number;
  scrambleRate: number | null;
  rushFpPerGame: number;
  totalFantasyPoints: number;
  fpPerGame: number;
  passFpPerGame: number;
  fpPerDropback: number;
  rzAttempts: number;
  rzTds: number;
  rzRushes: number;
  floorFp: number;
  ceilingFp: number;
  volatilityScore: number;
  volumeIndex: number;
  productionIndex: number;
  efficiencyIndex: number;
  contextIndex: number;
  archetype: string;
  archetypeLabel: string;
  contextTag: string | null;
  sackRate: number | null;
  customAlphaScore?: number;
  // FORGE Alpha fields (v1.1 - Env only, no matchup yet)
  alphaScore?: number;
  forge_alpha_base?: number;
  forge_alpha_env?: number;
  forge_env_score_100?: number | null;
  forge_env_multiplier?: number;
  forge_matchup_score_100?: number | null;  // Not used for QB yet
  forge_matchup_multiplier?: number | null;
  forge_opponent?: string | null;
}

interface SandboxResponse {
  success: boolean;
  season: number;
  envWeek?: number;
  matchupsAvailable?: boolean;
  minAttempts: number;
  count: number;
  version: string;
  data: QBSandboxPlayer[];
}

export default function QBRankingsSandbox() {
  const [sortField, setSortField] = useState<SortField>('alphaScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  const [volumeWeight, setVolumeWeight] = useState(25);
  const [productionWeight, setProductionWeight] = useState(25);
  const [efficiencyWeight, setEfficiencyWeight] = useState(35);
  const [contextWeight, setContextWeight] = useState(15);

  const [activePreset, setActivePreset] = useState<string>('default');
  const [userPresets, setUserPresets] = useState<QBPreset[]>([]);
  const [candidateFormulas, setCandidateFormulas] = useState<QBCandidateFormula[]>([]);

  const [compareMode, setCompareMode] = useState(false);
  const [playerA, setPlayerA] = useState<string | null>(null);
  const [playerB, setPlayerB] = useState<string | null>(null);

  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [candidateLabel, setCandidateLabel] = useState('');

  const [filterArchetype, setFilterArchetype] = useState<string | null>(null);
  const [highlightDualThreat, setHighlightDualThreat] = useState(false);

  useEffect(() => {
    const savedUserPresets = localStorage.getItem(QB_USER_PRESETS_KEY);
    if (savedUserPresets) {
      try {
        setUserPresets(JSON.parse(savedUserPresets));
      } catch (e) { console.error('Failed to parse user presets'); }
    }

    const savedCandidates = localStorage.getItem(QB_CANDIDATE_FORMULAS_KEY);
    if (savedCandidates) {
      try {
        setCandidateFormulas(JSON.parse(savedCandidates));
      } catch (e) { console.error('Failed to parse candidate formulas'); }
    }

    const lastPreset = localStorage.getItem(QB_LAST_PRESET_KEY);
    const savedWeights = localStorage.getItem(QB_WEIGHTS_KEY);

    if (lastPreset) {
      setActivePreset(lastPreset);
      const allPresets = [...BUILT_IN_QB_PRESETS, ...(savedUserPresets ? JSON.parse(savedUserPresets) : [])];
      const preset = allPresets.find((p: QBPreset) => p.id === lastPreset);
      if (preset) {
        setVolumeWeight(preset.weights.volume);
        setProductionWeight(preset.weights.production);
        setEfficiencyWeight(preset.weights.efficiency);
        setContextWeight(preset.weights.context);
      }
    } else if (savedWeights) {
      try {
        const weights = JSON.parse(savedWeights);
        setVolumeWeight(weights.volume ?? 25);
        setProductionWeight(weights.production ?? 25);
        setEfficiencyWeight(weights.efficiency ?? 35);
        setContextWeight(weights.context ?? 15);
      } catch (e) { console.error('Failed to parse weights'); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(QB_WEIGHTS_KEY, JSON.stringify({
      volume: volumeWeight,
      production: productionWeight,
      efficiency: efficiencyWeight,
      context: contextWeight,
    }));
  }, [volumeWeight, productionWeight, efficiencyWeight, contextWeight]);

  useEffect(() => {
    localStorage.setItem(QB_LAST_PRESET_KEY, activePreset);
  }, [activePreset]);

  useEffect(() => {
    localStorage.setItem(QB_USER_PRESETS_KEY, JSON.stringify(userPresets));
  }, [userPresets]);

  useEffect(() => {
    localStorage.setItem(QB_CANDIDATE_FORMULAS_KEY, JSON.stringify(candidateFormulas));
  }, [candidateFormulas]);

  const { data: sandboxData, isLoading, error } = useQuery<SandboxResponse>({
    queryKey: ['/api/admin/qb-rankings-sandbox'],
  });

  const applyPreset = (presetId: string) => {
    const allPresets = [...BUILT_IN_QB_PRESETS, ...userPresets];
    const preset = allPresets.find(p => p.id === presetId);
    if (preset) {
      setVolumeWeight(preset.weights.volume);
      setProductionWeight(preset.weights.production);
      setEfficiencyWeight(preset.weights.efficiency);
      setContextWeight(preset.weights.context);
      setActivePreset(presetId);
    }
  };

  const resetToDefault = () => {
    setVolumeWeight(25);
    setProductionWeight(25);
    setEfficiencyWeight(35);
    setContextWeight(15);
    setActivePreset('default');
  };

  const saveUserPreset = () => {
    const name = prompt('Enter preset name:');
    if (!name) return;
    const newPreset: QBPreset = {
      id: `user-${Date.now()}`,
      label: name,
      weights: { volume: volumeWeight, production: productionWeight, efficiency: efficiencyWeight, context: contextWeight },
      isBuiltIn: false,
    };
    setUserPresets([...userPresets, newPreset]);
    setActivePreset(newPreset.id);
  };

  const deleteUserPreset = (presetId: string) => {
    setUserPresets(userPresets.filter(p => p.id !== presetId));
    if (activePreset === presetId) {
      resetToDefault();
    }
  };

  const handleExport = () => {
    const exportData: QBFormulaExport = {
      version: 'qb-sandbox-v1',
      weights: { volume: volumeWeight, production: productionWeight, efficiency: efficiencyWeight, context: contextWeight },
    };
    const json = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(json);
    setShowExportModal(true);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJson);
      if (parsed.weights) {
        setVolumeWeight(parsed.weights.volume ?? 25);
        setProductionWeight(parsed.weights.production ?? 25);
        setEfficiencyWeight(parsed.weights.efficiency ?? 35);
        setContextWeight(parsed.weights.context ?? 15);
        setActivePreset('custom');
        setShowImportModal(false);
        setImportJson('');
        setImportError(null);
      } else {
        setImportError('Invalid format: missing weights');
      }
    } catch (e) {
      setImportError('Invalid JSON format');
    }
  };

  const saveCandidateFormula = () => {
    const newCandidate: QBCandidateFormula = {
      id: candidateLabel || `Candidate ${candidateFormulas.length + 1}`,
      createdAt: new Date().toISOString(),
      weights: { volume: volumeWeight, production: productionWeight, efficiency: efficiencyWeight, context: contextWeight },
    };
    setCandidateFormulas([...candidateFormulas, newCandidate]);
    setShowCandidateModal(false);
    setCandidateLabel('');
  };

  const calculateCustomAlphaScore = (player: QBSandboxPlayer): number => {
    const totalWeight = volumeWeight + productionWeight + efficiencyWeight + contextWeight;
    if (totalWeight === 0) return 0;
    
    // Base weighted score from 4 pillars
    let baseScore = (
      (player.volumeIndex * volumeWeight / totalWeight) +
      (player.productionIndex * productionWeight / totalWeight) +
      (player.efficiencyIndex * efficiencyWeight / totalWeight) +
      (player.contextIndex * contextWeight / totalWeight)
    );
    
    // Lens-aware Konami boost for high rushing QBs
    const konamiMode = getKonamiMode(activePreset);
    let konamiBoostFactor = 1.0;
    
    if (konamiMode === 'fantasy') {
      // Fantasy Lens: Stronger Konami boost (1.12 / 1.06)
      if (player.rushFpPerGame >= 6) {
        konamiBoostFactor = 1.12;
      } else if (player.rushFpPerGame >= 4) {
        konamiBoostFactor = 1.06;
      }
    } else if (konamiMode === 'realball') {
      // Real Ball Lens: No Konami boost
      konamiBoostFactor = 1.0;
    } else {
      // Default mode: Standard Konami boost (1.10 / 1.05)
      if (player.rushFpPerGame >= 6) {
        konamiBoostFactor = 1.10;
      } else if (player.rushFpPerGame >= 4) {
        konamiBoostFactor = 1.05;
      }
    }
    
    return baseScore * konamiBoostFactor;
  };

  const processedData = useMemo(() => {
    if (!sandboxData?.data) return [];
    
    let players = sandboxData.data.map(player => ({
      ...player,
      customAlphaScore: calculateCustomAlphaScore(player),
    }));

    if (filterArchetype) {
      players = players.filter(p => p.archetype === filterArchetype);
    }

    players.sort((a, b) => {
      let aVal: number | string | null = a[sortField as keyof QBSandboxPlayer] as number | string | null;
      let bVal: number | string | null = b[sortField as keyof QBSandboxPlayer] as number | string | null;
      
      if (aVal === null || aVal === undefined) aVal = sortOrder === 'desc' ? -Infinity : Infinity;
      if (bVal === null || bVal === undefined) bVal = sortOrder === 'desc' ? -Infinity : Infinity;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      return sortOrder === 'asc' 
        ? (aVal as number) - (bVal as number) 
        : (bVal as number) - (aVal as number);
    });

    return players;
  }, [sandboxData?.data, sortField, sortOrder, volumeWeight, productionWeight, efficiencyWeight, contextWeight, filterArchetype, activePreset]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const playerAData = processedData.find(p => p.playerId === playerA);
  const playerBData = processedData.find(p => p.playerId === playerB);

  const formatNumber = (val: number | null | undefined, decimals = 1): string => {
    if (val === null || val === undefined) return '-';
    return val.toFixed(decimals);
  };

  const getArchetypeBadge = (archetype: string) => {
    const colors: Record<string, string> = {
      DUAL_THREAT: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
      DEEP_BALL: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
      GAME_MANAGER: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
      POCKET_PASSER: 'bg-green-500/20 text-green-400 border-green-500/40',
      DEVELOPING: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
    };
    const labels: Record<string, string> = {
      DUAL_THREAT: 'Dual Threat',
      DEEP_BALL: 'Deep Ball',
      GAME_MANAGER: 'Game Mgr',
      POCKET_PASSER: 'Pocket',
      DEVELOPING: 'Developing',
    };
    return (
      <span className={`px-1.5 py-0.5 text-xs font-medium border rounded ${colors[archetype] || colors.DEVELOPING}`}>
        {labels[archetype] || archetype}
      </span>
    );
  };

  const getContextTagBadge = (tag: string | null) => {
    if (!tag) return null;
    const colors: Record<string, string> = {
      'Small Sample': 'bg-orange-500/20 text-orange-400',
      'Dual Threat Weapon': 'bg-purple-500/20 text-purple-400',
      'Game Manager': 'bg-yellow-500/20 text-yellow-400',
      'Volatile Elite': 'bg-red-500/20 text-red-400',
      'Reliable QB1': 'bg-green-500/20 text-green-400',
      'O-line Victim': 'bg-gray-500/20 text-gray-400',
      'Scheme Merchant': 'bg-blue-500/20 text-blue-400',
    };
    return (
      <span className={`px-1.5 py-0.5 text-xs rounded ${colors[tag] || 'bg-gray-500/20 text-gray-400'}`}>
        {tag}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-700/50 rounded w-1/3"></div>
            <div className="h-64 bg-slate-700/50 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-4">
            <h2 className="text-red-400 font-semibold">Error Loading Data</h2>
            <p className="text-red-300 mt-2">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-6" data-testid="qb-sandbox-page">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">QB Rankings Sandbox v1.0</h1>
          <p className="text-slate-400 text-sm">
            Experimental QB alpha scoring with 4-pillar model. {sandboxData?.count || 0} QBs, 100+ attempts.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6 mb-6">
          <div className="col-span-12 lg:col-span-4 bg-[#141824] rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Weight Sliders
            </h3>
            
            {activePreset === 'qb_fantasy_lens_v1' && (
              <div className="mb-3 px-2 py-1.5 bg-purple-500/15 border border-purple-500/30 rounded text-xs text-purple-300 flex items-center gap-2">
                <Zap className="w-3 h-3" />
                Fantasy Lens v1 (Konami emphasized)
              </div>
            )}
            {activePreset === 'qb_realball_lens_v1' && (
              <div className="mb-3 px-2 py-1.5 bg-blue-500/15 border border-blue-500/30 rounded text-xs text-blue-300 flex items-center gap-2">
                <Shield className="w-3 h-3" />
                Real Ball Lens v1 (efficiency + context)
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Volume ({volumeWeight}%)</span>
                  <span className="text-amber-400">Attempts, Air Yards, Dropbacks</span>
                </div>
                <Slider
                  value={[volumeWeight]}
                  onValueChange={([v]) => setVolumeWeight(v)}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-volume"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Production ({productionWeight}%)</span>
                  <span className="text-green-400">FP/G, TDs, Rush FP</span>
                </div>
                <Slider
                  value={[productionWeight]}
                  onValueChange={([v]) => setProductionWeight(v)}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-production"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Efficiency ({efficiencyWeight}%)</span>
                  <span className="text-blue-400">EPA, CPOE, ANY/A, Deep Acc</span>
                </div>
                <Slider
                  value={[efficiencyWeight]}
                  onValueChange={([v]) => setEfficiencyWeight(v)}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-efficiency"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Context ({contextWeight}%)</span>
                  <span className="text-purple-400">Team Support, Scheme</span>
                </div>
                <Slider
                  value={[contextWeight]}
                  onValueChange={([v]) => setContextWeight(v)}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-context"
                />
              </div>

              <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-700/50">
                Total: {volumeWeight + productionWeight + efficiencyWeight + contextWeight}%
                {volumeWeight + productionWeight + efficiencyWeight + contextWeight !== 100 && (
                  <span className="text-amber-400 ml-2">(Will normalize)</span>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-[#141824] rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              Presets
            </h3>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {BUILT_IN_QB_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className={`px-2.5 py-1 text-xs rounded transition-all ${
                    activePreset === preset.id
                      ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                      : 'bg-slate-700/40 text-slate-400 hover:bg-slate-600/50 border border-slate-600/50'
                  }`}
                  title={preset.description}
                  data-testid={`preset-${preset.id}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {userPresets.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-2">User Presets:</div>
                <div className="flex flex-wrap gap-2">
                  {userPresets.map(preset => (
                    <div key={preset.id} className="flex items-center gap-1">
                      <button
                        onClick={() => applyPreset(preset.id)}
                        className={`px-2 py-1 text-xs rounded ${
                          activePreset === preset.id
                            ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                            : 'bg-slate-700/40 text-slate-400 hover:bg-slate-600/50'
                        }`}
                      >
                        {preset.label}
                      </button>
                      <button
                        onClick={() => deleteUserPreset(preset.id)}
                        className="text-red-400 hover:text-red-300 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={resetToDefault}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700/40 text-slate-400 hover:bg-slate-600/50 rounded"
                data-testid="btn-reset"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
              <button
                onClick={saveUserPreset}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700/40 text-slate-400 hover:bg-slate-600/50 rounded"
                data-testid="btn-save-preset"
              >
                <Save className="w-3 h-3" /> Save
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700/40 text-slate-400 hover:bg-slate-600/50 rounded"
                data-testid="btn-export"
              >
                <Download className="w-3 h-3" /> Export
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700/40 text-slate-400 hover:bg-slate-600/50 rounded"
                data-testid="btn-import"
              >
                <Upload className="w-3 h-3" /> Import
              </button>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-[#141824] rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Eye className="w-4 h-4 text-green-400" />
              Tools & Filters
            </h3>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">Archetype Filter:</div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setFilterArchetype(null)}
                    className={`px-2 py-1 text-xs rounded ${!filterArchetype ? 'bg-blue-500/30 text-blue-300' : 'bg-slate-700/40 text-slate-400'}`}
                  >
                    All
                  </button>
                  {['DUAL_THREAT', 'DEEP_BALL', 'GAME_MANAGER', 'POCKET_PASSER', 'DEVELOPING'].map(arch => (
                    <button
                      key={arch}
                      onClick={() => setFilterArchetype(filterArchetype === arch ? null : arch)}
                      className={`px-2 py-1 text-xs rounded ${filterArchetype === arch ? 'bg-blue-500/30 text-blue-300' : 'bg-slate-700/40 text-slate-400'}`}
                    >
                      {arch.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highlightDualThreat}
                    onChange={(e) => setHighlightDualThreat(e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600"
                  />
                  Highlight Dual Threats
                </label>
              </div>

              <div className="pt-2 border-t border-slate-700/50">
                <button
                  onClick={() => setCompareMode(!compareMode)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded w-full justify-center ${
                    compareMode
                      ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                      : 'bg-slate-700/40 text-slate-400 hover:bg-slate-600/50'
                  }`}
                  data-testid="btn-compare-mode"
                >
                  <Users className="w-3 h-3" />
                  {compareMode ? 'Exit Compare Mode' : 'Compare Players'}
                </button>
              </div>

              <button
                onClick={() => setShowCandidateModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded w-full justify-center border border-amber-500/40"
                data-testid="btn-save-candidate"
              >
                <GitBranch className="w-3 h-3" /> Save Candidate Formula
              </button>
            </div>
          </div>
        </div>

        {compareMode && (playerA || playerB) && (
          <div className="mb-6 bg-[#141824] rounded-lg p-4 border border-purple-500/30">
            <h3 className="text-sm font-semibold text-purple-300 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" /> Player Comparison
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-slate-500 mb-2">Player A</div>
                {playerAData ? (
                  <div className="space-y-2">
                    <div className="text-lg font-semibold text-white">{playerAData.playerName}</div>
                    <div className="text-sm text-slate-400">{playerAData.team} | {getArchetypeBadge(playerAData.archetype)}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Alpha: <span className="text-amber-400 font-semibold">{formatNumber(playerAData.customAlphaScore)}</span></div>
                      <div>FP/G: <span className="text-green-400">{formatNumber(playerAData.fpPerGame)}</span></div>
                      <div>EPA: <span className="text-blue-400">{formatNumber(playerAData.avgEpa, 3)}</span></div>
                      <div>CPOE: <span className="text-blue-400">{formatNumber(playerAData.cpoe)}</span></div>
                      <div>Rush FP/G: <span className="text-purple-400">{formatNumber(playerAData.rushFpPerGame)}</span></div>
                      <div>Att/G: <span className="text-slate-300">{formatNumber(playerAData.attempts / playerAData.games)}</span></div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <div className="flex-1 bg-amber-500/20 rounded p-2 text-center">
                        <div className="text-xs text-amber-400">Vol</div>
                        <div className="text-sm font-semibold">{formatNumber(playerAData.volumeIndex)}</div>
                      </div>
                      <div className="flex-1 bg-green-500/20 rounded p-2 text-center">
                        <div className="text-xs text-green-400">Prod</div>
                        <div className="text-sm font-semibold">{formatNumber(playerAData.productionIndex)}</div>
                      </div>
                      <div className="flex-1 bg-blue-500/20 rounded p-2 text-center">
                        <div className="text-xs text-blue-400">Eff</div>
                        <div className="text-sm font-semibold">{formatNumber(playerAData.efficiencyIndex)}</div>
                      </div>
                      <div className="flex-1 bg-purple-500/20 rounded p-2 text-center">
                        <div className="text-xs text-purple-400">Ctx</div>
                        <div className="text-sm font-semibold">{formatNumber(playerAData.contextIndex)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm">Click a row to select</div>
                )}
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-2">Player B</div>
                {playerBData ? (
                  <div className="space-y-2">
                    <div className="text-lg font-semibold text-white">{playerBData.playerName}</div>
                    <div className="text-sm text-slate-400">{playerBData.team} | {getArchetypeBadge(playerBData.archetype)}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Alpha: <span className="text-amber-400 font-semibold">{formatNumber(playerBData.customAlphaScore)}</span></div>
                      <div>FP/G: <span className="text-green-400">{formatNumber(playerBData.fpPerGame)}</span></div>
                      <div>EPA: <span className="text-blue-400">{formatNumber(playerBData.avgEpa, 3)}</span></div>
                      <div>CPOE: <span className="text-blue-400">{formatNumber(playerBData.cpoe)}</span></div>
                      <div>Rush FP/G: <span className="text-purple-400">{formatNumber(playerBData.rushFpPerGame)}</span></div>
                      <div>Att/G: <span className="text-slate-300">{formatNumber(playerBData.attempts / playerBData.games)}</span></div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <div className="flex-1 bg-amber-500/20 rounded p-2 text-center">
                        <div className="text-xs text-amber-400">Vol</div>
                        <div className="text-sm font-semibold">{formatNumber(playerBData.volumeIndex)}</div>
                      </div>
                      <div className="flex-1 bg-green-500/20 rounded p-2 text-center">
                        <div className="text-xs text-green-400">Prod</div>
                        <div className="text-sm font-semibold">{formatNumber(playerBData.productionIndex)}</div>
                      </div>
                      <div className="flex-1 bg-blue-500/20 rounded p-2 text-center">
                        <div className="text-xs text-blue-400">Eff</div>
                        <div className="text-sm font-semibold">{formatNumber(playerBData.efficiencyIndex)}</div>
                      </div>
                      <div className="flex-1 bg-purple-500/20 rounded p-2 text-center">
                        <div className="text-xs text-purple-400">Ctx</div>
                        <div className="text-sm font-semibold">{formatNumber(playerBData.contextIndex)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm">Click a row to select</div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => { setPlayerA(null); setPlayerB(null); }}
                className="text-xs text-slate-400 hover:text-slate-300"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        <div className="bg-[#141824] rounded-lg border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="qb-rankings-table">
              <thead className="bg-slate-800/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">#</th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('playerName')}
                  >
                    <div className="flex items-center gap-1">Player <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('team')}
                  >
                    Team
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Arch</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-sky-400" title="Team Offensive Environment">
                    Env
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-amber-400 cursor-pointer hover:text-amber-300"
                    onClick={() => handleSort('alphaScore')}
                  >
                    <div className="flex items-center justify-end gap-1">Alpha <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('games')}
                  >
                    G
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('fpPerGame')}
                  >
                    <div className="flex items-center justify-end gap-1">FP/G <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('avgEpa')}
                  >
                    <div className="flex items-center justify-end gap-1">EPA <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('cpoe')}
                  >
                    <div className="flex items-center justify-end gap-1">CPOE <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('anyA')}
                  >
                    ANY/A
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('completionPct')}
                  >
                    Cmp%
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('rushFpPerGame')}
                  >
                    <div className="flex items-center justify-end gap-1">Rush FP/G <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-amber-400/70 cursor-pointer hover:text-amber-300"
                    onClick={() => handleSort('volumeIndex')}
                  >
                    Vol
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-green-400/70 cursor-pointer hover:text-green-300"
                    onClick={() => handleSort('productionIndex')}
                  >
                    Prod
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-blue-400/70 cursor-pointer hover:text-blue-300"
                    onClick={() => handleSort('efficiencyIndex')}
                  >
                    Eff
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-purple-400/70 cursor-pointer hover:text-purple-300"
                    onClick={() => handleSort('contextIndex')}
                  >
                    Ctx
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Tag</th>
                </tr>
              </thead>
              <tbody>
                {processedData.map((player, idx) => {
                  const isSelected = player.playerId === playerA || player.playerId === playerB;
                  const isDualThreat = player.archetype === 'DUAL_THREAT';
                  
                  return (
                    <tr 
                      key={player.playerId}
                      className={`border-t border-slate-700/30 hover:bg-slate-700/20 transition-colors ${
                        isSelected ? 'bg-purple-500/10 border-purple-500/30' : ''
                      } ${highlightDualThreat && isDualThreat ? 'bg-purple-500/5' : ''}`}
                      onClick={() => {
                        if (compareMode) {
                          if (!playerA) {
                            setPlayerA(player.playerId);
                          } else if (!playerB && player.playerId !== playerA) {
                            setPlayerB(player.playerId);
                          } else if (player.playerId === playerA) {
                            setPlayerA(playerB);
                            setPlayerB(null);
                          } else if (player.playerId === playerB) {
                            setPlayerB(null);
                          } else {
                            setPlayerB(player.playerId);
                          }
                        }
                      }}
                      style={{ cursor: compareMode ? 'pointer' : 'default' }}
                      data-testid={`qb-row-${player.playerId}`}
                    >
                      <td className="px-3 py-2 text-slate-500 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-white">{player.playerName}</td>
                      <td className="px-3 py-2 text-slate-400">{player.team}</td>
                      <td className="px-3 py-2 text-center">{getArchetypeBadge(player.archetype)}</td>
                      <td className="px-3 py-2 text-center">
                        {player.forge_env_score_100 != null ? (
                          <span 
                            className={`font-medium ${
                              player.forge_env_score_100 >= 60 ? 'text-green-400' :
                              player.forge_env_score_100 >= 55 ? 'text-emerald-400' :
                              player.forge_env_score_100 >= 45 ? 'text-sky-300' :
                              player.forge_env_score_100 >= 40 ? 'text-orange-400' :
                              'text-red-400'
                            }`}
                            title={`Env: ${player.forge_env_score_100} (${player.forge_env_multiplier?.toFixed(3)}x)`}
                          >
                            {player.forge_env_score_100}
                          </span>
                        ) : (
                          <span className="text-slate-600">–</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-400">{formatNumber(player.alphaScore ?? player.customAlphaScore)}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{player.games}</td>
                      <td className="px-3 py-2 text-right text-green-400">{formatNumber(player.fpPerGame)}</td>
                      <td className={`px-3 py-2 text-right ${player.avgEpa >= 0.15 ? 'text-green-400' : player.avgEpa >= 0 ? 'text-slate-300' : 'text-red-400'}`}>
                        {formatNumber(player.avgEpa, 3)}
                      </td>
                      <td className={`px-3 py-2 text-right ${(player.cpoe ?? 0) > 2 ? 'text-green-400' : (player.cpoe ?? 0) > 0 ? 'text-slate-300' : 'text-red-400'}`}>
                        {formatNumber(player.cpoe)}
                      </td>
                      <td className={`px-3 py-2 text-right ${player.anyA >= 7 ? 'text-green-400' : player.anyA >= 5 ? 'text-slate-300' : 'text-red-400'}`}>
                        {formatNumber(player.anyA)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">{formatNumber(player.completionPct, 1)}%</td>
                      <td className={`px-3 py-2 text-right ${player.rushFpPerGame >= 4 ? 'text-purple-400' : 'text-slate-400'}`}>
                        {formatNumber(player.rushFpPerGame)}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-400/70">{formatNumber(player.volumeIndex)}</td>
                      <td className="px-3 py-2 text-right text-green-400/70">{formatNumber(player.productionIndex)}</td>
                      <td className="px-3 py-2 text-right text-blue-400/70">{formatNumber(player.efficiencyIndex)}</td>
                      <td className="px-3 py-2 text-right text-purple-400/70">{formatNumber(player.contextIndex)}</td>
                      <td className="px-3 py-2 text-center">{getContextTagBadge(player.contextTag)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {candidateFormulas.length > 0 && (
          <div className="mt-6 bg-[#141824] rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-amber-400" />
              Saved Candidate Formulas
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {candidateFormulas.map((formula, idx) => (
                <div 
                  key={idx}
                  className="bg-slate-800/50 rounded p-3 border border-slate-700/50 hover:border-amber-500/30 cursor-pointer transition-all"
                  onClick={() => {
                    setVolumeWeight(formula.weights.volume);
                    setProductionWeight(formula.weights.production);
                    setEfficiencyWeight(formula.weights.efficiency);
                    setContextWeight(formula.weights.context);
                  }}
                >
                  <div className="font-medium text-slate-300 text-sm mb-1">{formula.id}</div>
                  <div className="text-xs text-slate-500">
                    Vol: {formula.weights.volume}% | Prod: {formula.weights.production}% | Eff: {formula.weights.efficiency}% | Ctx: {formula.weights.context}%
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {new Date(formula.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowExportModal(false)}>
          <div className="bg-[#141824] rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Formula Exported</h3>
            <p className="text-slate-400 text-sm mb-4">JSON copied to clipboard!</p>
            <pre className="bg-slate-800/50 p-3 rounded text-xs text-slate-300 overflow-auto max-h-40">
              {JSON.stringify({ version: 'qb-sandbox-v1', weights: { volume: volumeWeight, production: productionWeight, efficiency: efficiencyWeight, context: contextWeight }}, null, 2)}
            </pre>
            <button
              onClick={() => setShowExportModal(false)}
              className="mt-4 w-full py-2 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowImportModal(false)}>
          <div className="bg-[#141824] rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Import Formula</h3>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='Paste JSON here...'
              className="w-full h-32 bg-slate-800/50 border border-slate-700 rounded p-3 text-sm text-slate-300 placeholder-slate-500"
            />
            {importError && (
              <p className="text-red-400 text-xs mt-2">{importError}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setShowImportModal(false); setImportJson(''); setImportError(null); }}
                className="flex-1 py-2 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="flex-1 py-2 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {showCandidateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCandidateModal(false)}>
          <div className="bg-[#141824] rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Save Candidate Formula</h3>
            <input
              type="text"
              value={candidateLabel}
              onChange={(e) => setCandidateLabel(e.target.value)}
              placeholder="Formula name (optional)"
              className="w-full bg-slate-800/50 border border-slate-700 rounded p-3 text-sm text-slate-300 placeholder-slate-500"
            />
            <div className="mt-3 text-xs text-slate-500">
              Current weights: Vol {volumeWeight}% | Prod {productionWeight}% | Eff {efficiencyWeight}% | Ctx {contextWeight}%
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setShowCandidateModal(false); setCandidateLabel(''); }}
                className="flex-1 py-2 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50"
              >
                Cancel
              </button>
              <button
                onClick={saveCandidateFormula}
                className="flex-1 py-2 bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
