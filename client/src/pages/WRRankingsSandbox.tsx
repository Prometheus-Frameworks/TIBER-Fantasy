import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, RotateCcw, Save, Download, Upload, Copy, X, GitBranch, Eye, Users } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

// ============================================================
// RB SANDBOX PHASE 2 FEATURES
// - Split-View Comparison Mode (Task 1)
// - Export/Import Formula JSON (Task 2)
// - Save/Load Custom Weight Presets (Task 3)
// - Persistence & Stability (Task 4)
// - Candidate Formula Snapshot (Task 5)
// - Role Bank v2 Integration Hooks (Task 6)
// ============================================================

// RB Preset Types
interface RBPreset {
  id: string;
  label: string;
  weights: { carries: number; rushYds: number; fpPerRush: number; receivingWork: number };
  description?: string;
  isBuiltIn?: boolean;
}

interface RBFormulaExport {
  version: string;
  weights: { carries: number; rushYds: number; fpPerRush: number; receivingWork: number };
}

interface CandidateFormula {
  id: string;
  createdAt: string;
  weights: { carries: number; rushYds: number; fpPerRush: number; receivingWork: number };
}

// TE Preset Types
interface TEPreset {
  id: string;
  label: string;
  weights: { volume: number; production: number; efficiency: number; stickiness: number };
  description?: string;
  isBuiltIn?: boolean;
}

interface TEFormulaExport {
  version: string;
  weights: { volume: number; production: number; efficiency: number; stickiness: number };
}

interface TECandidateFormula {
  id: string;
  createdAt: string;
  weights: { volume: number; production: number; efficiency: number; stickiness: number };
}

// Built-in TE Presets
const BUILT_IN_TE_PRESETS: TEPreset[] = [
  { id: 'default', label: 'Default TE', weights: { volume: 40, production: 25, efficiency: 20, stickiness: 15 }, description: 'Balanced approach', isBuiltIn: true },
  { id: 'volume-hunter', label: 'Volume Hunter', weights: { volume: 50, production: 20, efficiency: 20, stickiness: 10 }, description: 'Target hog TEs', isBuiltIn: true },
  { id: 'red-zone', label: 'Red Zone Threat', weights: { volume: 35, production: 35, efficiency: 15, stickiness: 15 }, description: 'TD-focused TEs', isBuiltIn: true },
  { id: 'grinder', label: 'Grinder/Field Time', weights: { volume: 25, production: 20, efficiency: 15, stickiness: 40 }, description: 'Barner/Mayer type blocking TEs', isBuiltIn: true },
];

// TE LocalStorage Keys
const TE_WEIGHTS_KEY = 'tiber_te_sandbox_weights_v1';
const TE_LAST_PRESET_KEY = 'tiber_te_sandbox_last_preset';
const TE_USER_PRESETS_KEY = 'tiber_te_sandbox_user_presets';
const TE_CANDIDATE_FORMULAS_KEY = 'tiber_te_candidate_formulas';

// Built-in RB Presets
const BUILT_IN_RB_PRESETS: RBPreset[] = [
  { id: 'default', label: 'Default RB', weights: { carries: 35, rushYds: 30, fpPerRush: 20, receivingWork: 15 }, description: 'Balanced approach', isBuiltIn: true },
  { id: 'dual-threat', label: 'Dual Threat Heavy', weights: { carries: 25, rushYds: 25, fpPerRush: 20, receivingWork: 30 }, description: 'Boost receiving backs', isBuiltIn: true },
  { id: 'efficiency', label: 'Efficiency Hunter', weights: { carries: 20, rushYds: 25, fpPerRush: 40, receivingWork: 15 }, description: 'Prioritize FP/Rush efficiency', isBuiltIn: true },
  { id: 'workhorse', label: 'Workhorse Volume', weights: { carries: 45, rushYds: 35, fpPerRush: 10, receivingWork: 10 }, description: 'Pure volume play', isBuiltIn: true },
];

// LocalStorage Keys
const RB_WEIGHTS_KEY = 'tiber_rb_sandbox_weights_v1';
const RB_LAST_PRESET_KEY = 'tiber_rb_sandbox_last_preset';
const RB_USER_PRESETS_KEY = 'tiber_rb_sandbox_user_presets';
const RB_CANDIDATE_FORMULAS_KEY = 'tiber_rb_candidate_formulas';

type Position = 'WR' | 'RB' | 'TE';
type SortField = 'playerName' | 'team' | 'gamesPlayed' | 'targets' | 'totalCarries' | 'totalRushingYards' | 'fantasyPointsPerRushAttempt' | 'fantasyPoints' | 'pointsPerTarget' | 'samplePenalty' | 'adjustedEfficiency' | 'alphaScore' | 'customAlphaScore' | 'roleScore' | 'deepTargetRate' | 'slotRouteShareEst' | 'weightedTargetsPerGame' | 'boomRate' | 'bustRate' | 'talentIndex' | 'usageStabilityIndex' | 'roleDelta' | 'redZoneDomScore' | 'energyIndex' | 'fpPerGame' | 'fpPerTarget' | 'routesPerGame' | 'blockingStickiness' | 'snapStickinessIndex';
type SortOrder = 'asc' | 'desc';

type RoleTier = 'ALPHA' | 'CO_ALPHA' | 'PRIMARY_SLOT' | 'SECONDARY' | 'ROTATIONAL' | 'UNKNOWN' | null;

interface SandboxPlayer {
  playerId: string;
  playerName: string;
  team: string;
  gamesPlayed: number;
  targets: number;
  fantasyPoints: number;
  pointsPerTarget: number;
  samplePenalty: number;
  adjustedEfficiency: number;
  volumeIndex: number;
  productionIndex: number;
  efficiencyIndex: number;
  stabilityIndex: number;
  alphaScore: number;
  customAlphaScore?: number;
  // Injury status (IR/OUT badges)
  injuryStatus: string | null;
  injuryType: string | null;
  // WR Role Bank metrics
  roleScore: number | null;
  pureRoleScore: number | null;
  volumeScore: number | null;
  consistencyScore: number | null;
  highValueUsageScore: number | null;
  momentumScore: number | null;
  deepTargetRate: number | null;
  slotRouteShareEst: number | null;
  roleTier: RoleTier;
  // Advanced metrics (NEW)
  weightedTargetsPerGame: number | null;
  weightedTargetsIndex: number | null;
  boomRate: number | null;
  bustRate: number | null;
  talentIndex: number | null;
  yardsPerTarget: number | null;
  yardsPerRoute: number | null;
  usageStabilityIndex: number | null;
  roleDelta: number | null;
  recentTargetsPerGame: number | null;
  seasonTargetsPerGame: number | null;
  redZoneDomScore: number | null;
  redZoneTargetsPerGame: number | null;
  endZoneTargetsPerGame: number | null;
  energyIndex: number | null;
  efficiencyTrend: number | null;
}

// RB-specific player interface
interface RBSandboxPlayer {
  playerId: string;
  playerName: string;
  team: string;
  gamesPlayed: number;
  totalCarries: number;
  totalRushingYards: number;
  fantasyPoints: number;
  fantasyPointsPerRushAttempt: number;
  totalTargets: number;
  totalReceptions: number;
  totalReceivingYards: number;
  totalReceivingTDs: number;
  receivingFantasyPerGame: number;
  weightedOppPerGame: number;
  fpPerOpp: number;
  customAlphaScore?: number;
  injuryStatus: string | null;
  injuryType: string | null;
}

// TE-specific player interface (Phase 2 - Enhanced)
interface TESandboxPlayer {
  playerId: string;
  playerName: string;
  team: string;
  gamesPlayed: number;
  // Receiving metrics
  totalTargets: number;
  totalReceptions: number;
  totalReceivingYards: number;
  totalReceivingTDs: number;
  fantasyPointsPpr: number;
  // Calculated receiving metrics
  recYdsPerGame: number;
  fpPerGame: number;
  fpPerTarget: number;
  targetsPerGame: number;
  // Route metrics
  totalRoutes: number;
  routesPerGame: number;
  routeParticipation: number;
  // Snap metrics
  totalSnaps: number;
  // Alignment (Phase 2 - real data)
  slotPct: number;
  inlinePct: number;
  widePct: number;
  routesSlot: number;
  routesInline: number;
  routesOutside: number;
  // Blocking (proxy metrics)
  passBlockGrade: number | null;
  runBlockGrade: number | null;
  blockingStickiness: number;
  // Snap Stickiness Index 2.0
  snapStickinessIndex: number;
  // Red Zone / TD Gravity (Phase 2)
  rzTargets: number;
  tenZoneTargets: number;
  goalLineTargets: number;
  rzTargetsPerGame: number;
  tdRoleScore: number;
  // Production index (Phase 2)
  productionIndex: number;
  // TE Archetype (Phase 2)
  archetype: 'BIG_SLOT' | 'INLINE' | 'HYBRID' | 'H_BACK';
  archetypeLabel: string;
  // Volatility (Phase 2)
  floorFp: number;
  ceilingFp: number;
  volatilityScore: number;
  // Context flag (Phase 2)
  contextTag: string | null;
  // Custom alpha
  customAlphaScore?: number;
  // Injury status
  injuryStatus: string | null;
  injuryType: string | null;
  // FORGE Alpha fields (v0.2.2 - Env + Matchup)
  alphaScore?: number;
  forge_alpha_base?: number;
  forge_alpha_env?: number;
  forge_env_score_100?: number | null;
  forge_env_multiplier?: number;
  forge_matchup_score_100?: number | null;
  forge_matchup_multiplier?: number;
  forge_opponent?: string | null;
  volumeIndex?: number;
  efficiencyIndex?: number;
  stabilityIndex?: number;
}

interface SandboxResponse {
  success: boolean;
  season: number;
  minGames: number;
  minTargets?: number;
  minCarries?: number;
  count: number;
  data: SandboxPlayer[] | RBSandboxPlayer[] | TESandboxPlayer[];
}

export default function WRRankingsSandbox() {
  const [position, setPosition] = useState<Position>('WR');
  const [sortField, setSortField] = useState<SortField>('customAlphaScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Filter controls
  const [filterCoAlphaSecondary, setFilterCoAlphaSecondary] = useState(false);
  const [highlightDeepThreats, setHighlightDeepThreats] = useState(false);
  const [highlightSlotHeavy, setHighlightSlotHeavy] = useState(false);

  // WR Weight sliders (default: 50/25/15/10)
  const [wrVolWeight, setWrVolWeight] = useState(50);
  const [wrProdWeight, setWrProdWeight] = useState(25);
  const [wrEffWeight, setWrEffWeight] = useState(15);
  const [wrStabWeight, setWrStabWeight] = useState(10);

  // RB Weight sliders (default: 35/30/20/15 for carries/yards/fp-rush/receiving)
  const [rbCarriesWeight, setRbCarriesWeight] = useState(35);
  const [rbYardsWeight, setRbYardsWeight] = useState(30);
  const [rbFpRushWeight, setRbFpRushWeight] = useState(20);
  const [rbReceivingWeight, setRbReceivingWeight] = useState(15);

  // RB Phase 2: Preset & Persistence State
  const [rbActivePreset, setRbActivePreset] = useState<string>('default');
  const [rbUserPresets, setRbUserPresets] = useState<RBPreset[]>([]);
  const [rbCandidateFormulas, setRbCandidateFormulas] = useState<CandidateFormula[]>([]);

  // RB Phase 2: Split-View Comparison State
  const [rbCompareMode, setRbCompareMode] = useState(false);
  const [rbPlayerA, setRbPlayerA] = useState<string | null>(null);
  const [rbPlayerB, setRbPlayerB] = useState<string | null>(null);

  // RB Phase 2: Export/Import Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // RB Phase 2: Candidate Formula State
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [candidateLabel, setCandidateLabel] = useState('');

  // TE Weight sliders (default: 40/25/20/15 for volume/production/efficiency/stickiness)
  const [teVolumeWeight, setTeVolumeWeight] = useState(40);
  const [teProductionWeight, setTeProductionWeight] = useState(25);
  const [teEfficiencyWeight, setTeEfficiencyWeight] = useState(20);
  const [teStickinessWeight, setTeStickinessWeight] = useState(15);

  // TE Phase 2: Preset & Persistence State
  const [teActivePreset, setTeActivePreset] = useState<string>('default');
  const [teUserPresets, setTeUserPresets] = useState<TEPreset[]>([]);
  const [teCandidateFormulas, setTeCandidateFormulas] = useState<TECandidateFormula[]>([]);

  // TE Phase 2: Split-View Comparison State
  const [teCompareMode, setTeCompareMode] = useState(false);
  const [tePlayerA, setTePlayerA] = useState<string | null>(null);
  const [tePlayerB, setTePlayerB] = useState<string | null>(null);

  // TE Phase 2: Export/Import Modal State
  const [showTeExportModal, setShowTeExportModal] = useState(false);
  const [showTeImportModal, setShowTeImportModal] = useState(false);
  const [teImportJson, setTeImportJson] = useState('');
  const [teImportError, setTeImportError] = useState<string | null>(null);

  // TE Phase 2: Candidate Formula State
  const [showTeCandidateModal, setShowTeCandidateModal] = useState(false);
  const [teCandidateLabel, setTeCandidateLabel] = useState('');

  // Load RB weights and presets from localStorage on mount
  useEffect(() => {
    // Load user presets
    const savedUserPresets = localStorage.getItem(RB_USER_PRESETS_KEY);
    if (savedUserPresets) {
      try {
        setRbUserPresets(JSON.parse(savedUserPresets));
      } catch (e) { console.error('Failed to parse user presets'); }
    }

    // Load candidate formulas
    const savedCandidates = localStorage.getItem(RB_CANDIDATE_FORMULAS_KEY);
    if (savedCandidates) {
      try {
        setRbCandidateFormulas(JSON.parse(savedCandidates));
      } catch (e) { console.error('Failed to parse candidate formulas'); }
    }

    // Load last preset or saved weights
    const lastPreset = localStorage.getItem(RB_LAST_PRESET_KEY);
    const savedWeights = localStorage.getItem(RB_WEIGHTS_KEY);

    if (lastPreset) {
      setRbActivePreset(lastPreset);
      // Apply preset weights
      const allPresets = [...BUILT_IN_RB_PRESETS, ...(savedUserPresets ? JSON.parse(savedUserPresets) : [])];
      const preset = allPresets.find((p: RBPreset) => p.id === lastPreset);
      if (preset) {
        setRbCarriesWeight(preset.weights.carries);
        setRbYardsWeight(preset.weights.rushYds);
        setRbFpRushWeight(preset.weights.fpPerRush);
        setRbReceivingWeight(preset.weights.receivingWork);
      }
    } else if (savedWeights) {
      try {
        const weights = JSON.parse(savedWeights);
        setRbCarriesWeight(weights.carries ?? 35);
        setRbYardsWeight(weights.rushYds ?? 30);
        setRbFpRushWeight(weights.fpPerRush ?? 20);
        setRbReceivingWeight(weights.receivingWork ?? 15);
      } catch (e) { console.error('Failed to parse saved weights'); }
    }
  }, []);

  // Persist RB weights to localStorage when they change
  useEffect(() => {
    if (position === 'RB') {
      localStorage.setItem(RB_WEIGHTS_KEY, JSON.stringify({
        carries: rbCarriesWeight,
        rushYds: rbYardsWeight,
        fpPerRush: rbFpRushWeight,
        receivingWork: rbReceivingWeight
      }));
    }
  }, [position, rbCarriesWeight, rbYardsWeight, rbFpRushWeight, rbReceivingWeight]);

  // Get all RB presets (built-in + user)
  const allRbPresets = useMemo(() => [...BUILT_IN_RB_PRESETS, ...rbUserPresets], [rbUserPresets]);

  // Apply preset weights
  const applyRbPreset = (presetId: string) => {
    const preset = allRbPresets.find(p => p.id === presetId);
    if (preset) {
      setRbCarriesWeight(preset.weights.carries);
      setRbYardsWeight(preset.weights.rushYds);
      setRbFpRushWeight(preset.weights.fpPerRush);
      setRbReceivingWeight(preset.weights.receivingWork);
      setRbActivePreset(presetId);
      localStorage.setItem(RB_LAST_PRESET_KEY, presetId);
    }
  };

  // Save current weights as user preset
  const saveAsRbPreset = () => {
    const presetName = prompt('Enter a name for this preset:');
    if (!presetName) return;

    const newPreset: RBPreset = {
      id: `user-${Date.now()}`,
      label: presetName,
      weights: { carries: rbCarriesWeight, rushYds: rbYardsWeight, fpPerRush: rbFpRushWeight, receivingWork: rbReceivingWeight },
      isBuiltIn: false
    };

    const updatedPresets = [...rbUserPresets, newPreset];
    setRbUserPresets(updatedPresets);
    localStorage.setItem(RB_USER_PRESETS_KEY, JSON.stringify(updatedPresets));
    setRbActivePreset(newPreset.id);
    localStorage.setItem(RB_LAST_PRESET_KEY, newPreset.id);
  };

  // Delete user preset
  const deleteRbPreset = (presetId: string) => {
    const updatedPresets = rbUserPresets.filter(p => p.id !== presetId);
    setRbUserPresets(updatedPresets);
    localStorage.setItem(RB_USER_PRESETS_KEY, JSON.stringify(updatedPresets));
    if (rbActivePreset === presetId) {
      applyRbPreset('default');
    }
  };

  // Export formula to JSON
  const exportRbFormula = (): RBFormulaExport => ({
    version: 'rb-alpha-sandbox-v1',
    weights: {
      carries: rbCarriesWeight / 100,
      rushYds: rbYardsWeight / 100,
      fpPerRush: rbFpRushWeight / 100,
      receivingWork: rbReceivingWeight / 100
    }
  });

  // Copy formula JSON to clipboard
  const copyFormulaToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(exportRbFormula(), null, 2));
  };

  // Download formula as JSON file
  const downloadFormula = () => {
    const blob = new Blob([JSON.stringify(exportRbFormula(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rb-formula-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import formula from JSON
  const importRbFormula = () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importJson);
      if (!parsed.weights || 
          typeof parsed.weights.carries !== 'number' ||
          typeof parsed.weights.rushYds !== 'number' ||
          typeof parsed.weights.fpPerRush !== 'number' ||
          typeof parsed.weights.receivingWork !== 'number') {
        setImportError('Invalid format: Must include weights for carries, rushYds, fpPerRush, and receivingWork');
        return;
      }

      // Normalize to sum to 1.0 if needed
      const sum = parsed.weights.carries + parsed.weights.rushYds + parsed.weights.fpPerRush + parsed.weights.receivingWork;
      const factor = sum > 0 ? (1 / sum) : 1;

      setRbCarriesWeight(Math.round(parsed.weights.carries * factor * 100));
      setRbYardsWeight(Math.round(parsed.weights.rushYds * factor * 100));
      setRbFpRushWeight(Math.round(parsed.weights.fpPerRush * factor * 100));
      setRbReceivingWeight(Math.round(parsed.weights.receivingWork * factor * 100));
      setShowImportModal(false);
      setImportJson('');
      setRbActivePreset('custom');
    } catch (e) {
      setImportError('Invalid JSON format');
    }
  };

  // Mark current formula as candidate
  const markAsCandidateFormula = () => {
    if (!candidateLabel.trim()) return;

    const newCandidate: CandidateFormula = {
      id: candidateLabel.trim(),
      createdAt: new Date().toISOString(),
      weights: { carries: rbCarriesWeight, rushYds: rbYardsWeight, fpPerRush: rbFpRushWeight, receivingWork: rbReceivingWeight }
    };

    console.log('[TIBER RB Alpha] Candidate Formula Saved:', newCandidate);

    const updatedCandidates = [...rbCandidateFormulas, newCandidate];
    setRbCandidateFormulas(updatedCandidates);
    localStorage.setItem(RB_CANDIDATE_FORMULAS_KEY, JSON.stringify(updatedCandidates));
    setShowCandidateModal(false);
    setCandidateLabel('');
  };

  // Load candidate formula
  const loadCandidateFormula = (candidate: CandidateFormula) => {
    setRbCarriesWeight(candidate.weights.carries);
    setRbYardsWeight(candidate.weights.rushYds);
    setRbFpRushWeight(candidate.weights.fpPerRush);
    setRbReceivingWeight(candidate.weights.receivingWork);
    setRbActivePreset('candidate');
  };

  // Task 6: Build RB Alpha Export (Role Bank v2 Integration Hook)
  const buildRbAlphaExport = (player: RBSandboxPlayer) => ({
    playerId: player.playerId,
    playerName: player.playerName,
    team: player.team,
    alphaScore: player.customAlphaScore ?? 0,
    games: player.gamesPlayed,
    carries: player.totalCarries,
    rushYds: player.totalRushingYards,
    targets: player.totalTargets,
    rec: player.totalReceptions,
    recYds: player.totalReceivingYards,
    recFpPerGame: player.receivingFantasyPerGame,
    wtdOppPerGame: player.weightedOppPerGame,
    fpPerOpp: player.fpPerOpp
  });

  // Preview Role Bank Payload (top 50 RBs by alphaScore)
  const previewRoleBankPayload = () => {
    if (!data?.data || position !== 'RB') return;
    const rbData = (data.data as RBSandboxPlayer[])
      .slice()
      .sort((a, b) => (b.customAlphaScore ?? 0) - (a.customAlphaScore ?? 0))
      .slice(0, 50)
      .map(buildRbAlphaExport);
    console.log('[TIBER RB Role Bank v2] Preview Payload (Top 50):', rbData);
  };

  // ==============================================
  // TE PHASE 2: HOOKS & HELPER FUNCTIONS
  // ==============================================

  // Load TE weights and presets from localStorage on mount
  useEffect(() => {
    // Load TE user presets
    const savedTePresets = localStorage.getItem(TE_USER_PRESETS_KEY);
    if (savedTePresets) {
      try {
        setTeUserPresets(JSON.parse(savedTePresets));
      } catch (e) { console.error('Failed to parse TE user presets'); }
    }

    // Load TE candidate formulas
    const savedTeCandidates = localStorage.getItem(TE_CANDIDATE_FORMULAS_KEY);
    if (savedTeCandidates) {
      try {
        setTeCandidateFormulas(JSON.parse(savedTeCandidates));
      } catch (e) { console.error('Failed to parse TE candidate formulas'); }
    }

    // Load last TE preset or saved weights
    const lastTePreset = localStorage.getItem(TE_LAST_PRESET_KEY);
    const savedTeWeights = localStorage.getItem(TE_WEIGHTS_KEY);

    if (lastTePreset) {
      setTeActivePreset(lastTePreset);
      const allTePresets = [...BUILT_IN_TE_PRESETS, ...(savedTePresets ? JSON.parse(savedTePresets) : [])];
      const preset = allTePresets.find((p: TEPreset) => p.id === lastTePreset);
      if (preset) {
        setTeVolumeWeight(preset.weights.volume);
        setTeProductionWeight(preset.weights.production);
        setTeEfficiencyWeight(preset.weights.efficiency);
        setTeStickinessWeight(preset.weights.stickiness);
      }
    } else if (savedTeWeights) {
      try {
        const weights = JSON.parse(savedTeWeights);
        setTeVolumeWeight(weights.volume ?? 40);
        setTeProductionWeight(weights.production ?? 25);
        setTeEfficiencyWeight(weights.efficiency ?? 20);
        setTeStickinessWeight(weights.stickiness ?? 15);
      } catch (e) { console.error('Failed to parse TE saved weights'); }
    }
  }, []);

  // Persist TE weights to localStorage when they change
  useEffect(() => {
    if (position === 'TE') {
      localStorage.setItem(TE_WEIGHTS_KEY, JSON.stringify({
        volume: teVolumeWeight,
        production: teProductionWeight,
        efficiency: teEfficiencyWeight,
        stickiness: teStickinessWeight
      }));
    }
  }, [position, teVolumeWeight, teProductionWeight, teEfficiencyWeight, teStickinessWeight]);

  // Get all TE presets (built-in + user)
  const allTePresets = useMemo(() => [...BUILT_IN_TE_PRESETS, ...teUserPresets], [teUserPresets]);

  // Apply TE preset weights
  const applyTePreset = (presetId: string) => {
    const preset = allTePresets.find(p => p.id === presetId);
    if (preset) {
      setTeVolumeWeight(preset.weights.volume);
      setTeProductionWeight(preset.weights.production);
      setTeEfficiencyWeight(preset.weights.efficiency);
      setTeStickinessWeight(preset.weights.stickiness);
      setTeActivePreset(presetId);
      localStorage.setItem(TE_LAST_PRESET_KEY, presetId);
    }
  };

  // Save current TE weights as user preset
  const saveAsTePreset = () => {
    const presetName = prompt('Enter a name for this TE preset:');
    if (!presetName) return;

    const newPreset: TEPreset = {
      id: `user-${Date.now()}`,
      label: presetName,
      weights: { volume: teVolumeWeight, production: teProductionWeight, efficiency: teEfficiencyWeight, stickiness: teStickinessWeight },
      isBuiltIn: false
    };

    const updatedPresets = [...teUserPresets, newPreset];
    setTeUserPresets(updatedPresets);
    localStorage.setItem(TE_USER_PRESETS_KEY, JSON.stringify(updatedPresets));
    setTeActivePreset(newPreset.id);
    localStorage.setItem(TE_LAST_PRESET_KEY, newPreset.id);
  };

  // Delete TE user preset
  const deleteTePreset = (presetId: string) => {
    const updatedPresets = teUserPresets.filter(p => p.id !== presetId);
    setTeUserPresets(updatedPresets);
    localStorage.setItem(TE_USER_PRESETS_KEY, JSON.stringify(updatedPresets));
    if (teActivePreset === presetId) {
      applyTePreset('default');
    }
  };

  // Export TE formula to JSON
  const exportTeFormula = (): TEFormulaExport => ({
    version: 'te-alpha-sandbox-v1',
    weights: {
      volume: teVolumeWeight / 100,
      production: teProductionWeight / 100,
      efficiency: teEfficiencyWeight / 100,
      stickiness: teStickinessWeight / 100
    }
  });

  // Copy TE formula JSON to clipboard
  const copyTeFormulaToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(exportTeFormula(), null, 2));
  };

  // Download TE formula as JSON file
  const downloadTeFormula = () => {
    const blob = new Blob([JSON.stringify(exportTeFormula(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `te-formula-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import TE formula from JSON
  const importTeFormula = () => {
    setTeImportError(null);
    try {
      const parsed = JSON.parse(teImportJson);
      if (!parsed.weights || 
          typeof parsed.weights.volume !== 'number' ||
          typeof parsed.weights.production !== 'number' ||
          typeof parsed.weights.efficiency !== 'number' ||
          typeof parsed.weights.stickiness !== 'number') {
        setTeImportError('Invalid format: Must include weights for volume, production, efficiency, and stickiness');
        return;
      }

      // Normalize to sum to 1.0 if needed
      const sum = parsed.weights.volume + parsed.weights.production + parsed.weights.efficiency + parsed.weights.stickiness;
      const factor = sum > 0 ? (1 / sum) : 1;

      setTeVolumeWeight(Math.round(parsed.weights.volume * factor * 100));
      setTeProductionWeight(Math.round(parsed.weights.production * factor * 100));
      setTeEfficiencyWeight(Math.round(parsed.weights.efficiency * factor * 100));
      setTeStickinessWeight(Math.round(parsed.weights.stickiness * factor * 100));
      setShowTeImportModal(false);
      setTeImportJson('');
      setTeActivePreset('custom');
    } catch (e) {
      setTeImportError('Invalid JSON format');
    }
  };

  // Mark current TE formula as candidate
  const markAsTeCandidateFormula = () => {
    if (!teCandidateLabel.trim()) return;

    const newCandidate: TECandidateFormula = {
      id: teCandidateLabel.trim(),
      createdAt: new Date().toISOString(),
      weights: { volume: teVolumeWeight, production: teProductionWeight, efficiency: teEfficiencyWeight, stickiness: teStickinessWeight }
    };

    console.log('[TIBER TE Alpha] Candidate Formula Saved:', newCandidate);

    const updatedCandidates = [...teCandidateFormulas, newCandidate];
    setTeCandidateFormulas(updatedCandidates);
    localStorage.setItem(TE_CANDIDATE_FORMULAS_KEY, JSON.stringify(updatedCandidates));
    setShowTeCandidateModal(false);
    setTeCandidateLabel('');
  };

  // Load TE candidate formula
  const loadTeCandidateFormula = (candidate: TECandidateFormula) => {
    setTeVolumeWeight(candidate.weights.volume);
    setTeProductionWeight(candidate.weights.production);
    setTeEfficiencyWeight(candidate.weights.efficiency);
    setTeStickinessWeight(candidate.weights.stickiness);
    setTeActivePreset('candidate');
  };

  // Build TE Alpha Export (Role Bank v2 Integration Hook) - Phase 2 Enhanced
  const buildTeAlphaExport = (player: TESandboxPlayer) => ({
    playerId: player.playerId,
    playerName: player.playerName,
    team: player.team,
    alphaScore: player.customAlphaScore ?? 0,
    // Core Receiving
    targets: player.totalTargets,
    rec: player.totalReceptions,
    recYds: player.totalReceivingYards,
    fpPerGame: player.fpPerGame,
    fpPerTarget: player.fpPerTarget,
    // Route Usage
    routesRun: player.totalRoutes,
    routesPerGame: player.routesPerGame,
    routeParticipation: player.routeParticipation,
    // Alignment (Phase 2 - real data)
    slotPct: player.slotPct,
    inlinePct: player.inlinePct,
    widePct: player.widePct,
    routesSlot: player.routesSlot,
    routesInline: player.routesInline,
    routesOutside: player.routesOutside,
    // Snap Stickiness 2.0
    blockingStickiness: player.blockingStickiness,
    snapStickinessIndex: player.snapStickinessIndex,
    totalSnaps: player.totalSnaps,
    // Red Zone / TD Gravity (Phase 2)
    rzTargets: player.rzTargets,
    tenZoneTargets: player.tenZoneTargets,
    goalLineTargets: player.goalLineTargets,
    rzTargetsPerGame: player.rzTargetsPerGame,
    tdRoleScore: player.tdRoleScore,
    // Production Index (Phase 2)
    productionIndex: player.productionIndex,
    // TE Archetype (Phase 2)
    archetype: player.archetype,
    archetypeLabel: player.archetypeLabel,
    // Volatility (Phase 2)
    floorFp: player.floorFp,
    ceilingFp: player.ceilingFp,
    volatilityScore: player.volatilityScore,
    // Context (Phase 2)
    contextTag: player.contextTag
  });

  // Preview TE Role Bank Payload (top 40 TEs by alphaScore)
  const previewTeRoleBankPayload = () => {
    if (!data?.data || position !== 'TE') return;
    const teData = (data.data as TESandboxPlayer[])
      .slice()
      .sort((a, b) => (b.customAlphaScore ?? 0) - (a.customAlphaScore ?? 0))
      .slice(0, 40)
      .map(buildTeAlphaExport);
    console.log('[TIBER TE Role Bank v2] Preview Payload (Top 40):', teData);
  };

  // Reset weights to defaults
  const resetWeights = () => {
    if (position === 'WR') {
      setWrVolWeight(50);
      setWrProdWeight(25);
      setWrEffWeight(15);
      setWrStabWeight(10);
    } else if (position === 'RB') {
      setRbCarriesWeight(35);
      setRbYardsWeight(30);
      setRbFpRushWeight(20);
      setRbReceivingWeight(15);
    } else if (position === 'TE') {
      setTeVolumeWeight(40);
      setTeProductionWeight(25);
      setTeEfficiencyWeight(20);
      setTeStickinessWeight(15);
    }
  };

  // Save formula to localStorage
  const saveFormula = () => {
    const formulaName = prompt('Enter a name for this formula:');
    if (!formulaName) return;

    const formulas = JSON.parse(localStorage.getItem('adminSandboxFormulas') || '{}');
    formulas[formulaName] = {
      position,
      weights: position === 'WR' 
        ? { vol: wrVolWeight, prod: wrProdWeight, eff: wrEffWeight, stab: wrStabWeight }
        : { carries: rbCarriesWeight, yards: rbYardsWeight, fpRush: rbFpRushWeight, receiving: rbReceivingWeight },
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('adminSandboxFormulas', JSON.stringify(formulas));
    alert(`Formula "${formulaName}" saved successfully!`);
  };

  // Load formula from localStorage
  const loadFormula = (formulaName: string) => {
    const formulas = JSON.parse(localStorage.getItem('adminSandboxFormulas') || '{}');
    const formula = formulas[formulaName];
    if (!formula) return;

    if (formula.position === 'WR' && position === 'WR') {
      setWrVolWeight(formula.weights.vol);
      setWrProdWeight(formula.weights.prod);
      setWrEffWeight(formula.weights.eff);
      setWrStabWeight(formula.weights.stab);
    } else if (formula.position === 'RB' && position === 'RB') {
      setRbCarriesWeight(formula.weights.carries);
      setRbYardsWeight(formula.weights.yards);
      setRbFpRushWeight(formula.weights.fpRush);
      setRbReceivingWeight(formula.weights.receiving ?? 15);
    }
  };

  // Get saved formulas for current position
  const getSavedFormulas = () => {
    const formulas = JSON.parse(localStorage.getItem('adminSandboxFormulas') || '{}');
    return Object.entries(formulas)
      .filter(([_, formula]: any) => formula.position === position)
      .map(([name]) => name);
  };

  const savedFormulas = getSavedFormulas();

  const { data, isLoading } = useQuery<SandboxResponse>({
    queryKey: [
      position === 'WR' 
        ? '/api/admin/wr-rankings-sandbox' 
        : position === 'RB' 
          ? '/api/admin/rb-rankings-sandbox' 
          : '/api/admin/te-rankings-sandbox'
    ],
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Calculate custom alphaScore based on slider weights
  const dataWithCustomScores = data?.data?.map(player => {
    if (position === 'WR') {
      const wrPlayer = player as SandboxPlayer;
      // Normalize weights to sum to 100
      const totalWeight = wrVolWeight + wrProdWeight + wrEffWeight + wrStabWeight;
      const normalizedVol = wrVolWeight / totalWeight;
      const normalizedProd = wrProdWeight / totalWeight;
      const normalizedEff = wrEffWeight / totalWeight;
      const normalizedStab = wrStabWeight / totalWeight;

      const customAlphaScore = Math.round(
        wrPlayer.volumeIndex * normalizedVol +
        wrPlayer.productionIndex * normalizedProd +
        wrPlayer.efficiencyIndex * normalizedEff +
        wrPlayer.stabilityIndex * normalizedStab
      );

      return { ...wrPlayer, customAlphaScore };
    } else if (position === 'RB') {
      const rbPlayer = player as RBSandboxPlayer;
      // For RB, we need to normalize carries, yards, fp/rush, and receiving work across all players
      // First pass: find max values (we'll do this inline for simplicity)
      const allRBs = (data?.data ?? []) as RBSandboxPlayer[];
      const maxCarries = Math.max(...allRBs.map(p => p.totalCarries));
      const maxYards = Math.max(...allRBs.map(p => p.totalRushingYards));
      const maxFpRush = Math.max(...allRBs.map(p => p.fantasyPointsPerRushAttempt));
      // Use receivingFantasyPerGame instead of raw receivingYards for the 15% Receiving Work weight
      const maxRecFpg = Math.max(...allRBs.map(p => p.receivingFantasyPerGame));

      // Normalize each metric to 0-100
      const carriesScore = (rbPlayer.totalCarries / maxCarries) * 100;
      const yardsScore = (rbPlayer.totalRushingYards / maxYards) * 100;
      const fpRushScore = (rbPlayer.fantasyPointsPerRushAttempt / maxFpRush) * 100;
      // Receiving Work now uses receivingFantasyPerGame (half-PPR: rec*0.5 + recYd/10 + recTD*6)
      const receivingScore = maxRecFpg > 0 ? (rbPlayer.receivingFantasyPerGame / maxRecFpg) * 100 : 0;

      // Apply custom weights
      const totalWeight = rbCarriesWeight + rbYardsWeight + rbFpRushWeight + rbReceivingWeight;
      const normalizedCarries = rbCarriesWeight / totalWeight;
      const normalizedYards = rbYardsWeight / totalWeight;
      const normalizedFpRush = rbFpRushWeight / totalWeight;
      const normalizedReceiving = rbReceivingWeight / totalWeight;

      const customAlphaScore = Math.round(
        carriesScore * normalizedCarries +
        yardsScore * normalizedYards +
        fpRushScore * normalizedFpRush +
        receivingScore * normalizedReceiving
      );

      return { ...rbPlayer, customAlphaScore };
    } else {
      // TE Alpha Score Calculation (Phase 2 Enhanced)
      const tePlayer = player as TESandboxPlayer;
      const allTEs = (data?.data ?? []) as TESandboxPlayer[];
      
      // Find max values for normalization
      const maxTargets = Math.max(...allTEs.map(p => p.totalTargets), 1);
      const maxRoutes = Math.max(...allTEs.map(p => p.totalRoutes), 1);
      const maxFpPerGame = Math.max(...allTEs.map(p => p.fpPerGame), 1);
      const maxFpPerTarget = Math.max(...allTEs.map(p => p.fpPerTarget), 1);
      const maxSSI = Math.max(...allTEs.map(p => p.snapStickinessIndex), 1);
      const maxTdRoleScore = Math.max(...allTEs.map(p => p.tdRoleScore ?? 0), 0.01);
      const maxRzTargetsPerGame = Math.max(...allTEs.map(p => p.rzTargetsPerGame ?? 0), 0.01);

      // Pillar 1: Volume (40% default) - targets + routes + slot% boost
      const volumeScore = (
        (tePlayer.totalTargets / maxTargets) * 0.5 +
        (tePlayer.totalRoutes / maxRoutes) * 0.35 +
        (tePlayer.slotPct * 0.15) // Slot bonus (more receiving role)
      ) * 100;

      // Pillar 2: Production (25% default) - NOW USES productionIndex with tdRoleScore
      // productionIndex = fpPerGameNorm * 0.6 + tdRoleScore * 0.4
      const fpPerGameNorm = tePlayer.fpPerGame / maxFpPerGame;
      const tdRoleNorm = (tePlayer.tdRoleScore ?? 0) / maxTdRoleScore;
      const productionScore = (
        (fpPerGameNorm * 0.6) + 
        (tdRoleNorm * 0.4)
      ) * 100;

      // Pillar 3: Efficiency (20% default) - fpPerTarget + RZ gravity boost
      const rzGravityBoost = Math.min((tePlayer.rzTargetsPerGame ?? 0) / maxRzTargetsPerGame, 1) * 0.2;
      const efficiencyScore = (
        (tePlayer.fpPerTarget / maxFpPerTarget) * 0.8 +
        rzGravityBoost
      ) * 100;

      // Pillar 4: Snap Stickiness 2.0 (15% default) - SSI enhanced
      const stickinessScore = (tePlayer.snapStickinessIndex / maxSSI) * 100;

      // Apply custom weights
      const totalWeight = teVolumeWeight + teProductionWeight + teEfficiencyWeight + teStickinessWeight;
      const normalizedVolume = teVolumeWeight / totalWeight;
      const normalizedProd = teProductionWeight / totalWeight;
      const normalizedEff = teEfficiencyWeight / totalWeight;
      const normalizedStick = teStickinessWeight / totalWeight;

      const customAlphaScore = Math.round(
        volumeScore * normalizedVolume +
        productionScore * normalizedProd +
        efficiencyScore * normalizedEff +
        stickinessScore * normalizedStick
      );

      return { ...tePlayer, customAlphaScore };
    }
  });

  // Apply filters and sort (WR filters only apply to WR position)
  const filteredData = dataWithCustomScores?.filter(player => {
    // WR-specific filters - skip if viewing RBs
    if (position === 'WR') {
      const wrPlayer = player as SandboxPlayer;
      // Filter: Only CO_ALPHA / SECONDARY
      if (filterCoAlphaSecondary) {
        if (wrPlayer.roleTier !== 'CO_ALPHA' && wrPlayer.roleTier !== 'SECONDARY') {
          return false;
        }
      }
    }
    return true;
  });

  const sortedData = filteredData?.slice().sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    // Handle null values (role bank fields may be null)
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1; // null goes to end
    if (bVal === null) return -1; // null goes to end
    
    return sortOrder === 'asc' 
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });
  
  // Helper to check if player should be highlighted
  const isDeepThreat = (player: SandboxPlayer) => 
    highlightDeepThreats && player.deepTargetRate !== null && player.deepTargetRate >= 0.20;
  
  const isSlotHeavy = (player: SandboxPlayer) => 
    highlightSlotHeavy && player.slotRouteShareEst !== null && player.slotRouteShareEst >= 0.45;

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-white transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-blue-400' : 'text-gray-600'}`} />
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-blue-500/20 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-wide">
                {position} RANKINGS SANDBOX
              </h1>
              <p className="text-gray-400 mt-2 text-sm">
                {position === 'WR' 
                  ? 'Algorithm test page - 2025 season, minimum 2 games / 10 targets (includes IR players)'
                  : 'Algorithm test page - 2025 season, minimum 2 games / 15 carries (includes IR players)'
                }
              </p>
            </div>
            {/* Position Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPosition('WR');
                  setSortField('customAlphaScore');
                  setSortOrder('desc');
                }}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  position === 'WR'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                }`}
                data-testid="toggle-wr"
              >
                WR
              </button>
              <button
                onClick={() => {
                  setPosition('RB');
                  setSortField('customAlphaScore');
                  setSortOrder('desc');
                }}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  position === 'RB'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                }`}
                data-testid="toggle-rb"
              >
                RB
              </button>
              <button
                onClick={() => {
                  setPosition('TE');
                  setSortField('alphaScore');
                  setSortOrder('desc');
                }}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  position === 'TE'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                }`}
                data-testid="toggle-te"
              >
                TE
              </button>
            </div>
          </div>
        </div>

        {/* Formula Weight Sliders */}
        <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-purple-300">
                {position === 'WR' ? '🎛️ WR Formula Weights' : position === 'RB' ? '🎛️ RB Formula Weights' : '🎛️ TE Formula Weights'}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Adjust the weights to test different ranking formulas (total: {
                  position === 'WR' 
                    ? wrVolWeight + wrProdWeight + wrEffWeight + wrStabWeight 
                    : position === 'RB' 
                      ? rbCarriesWeight + rbYardsWeight + rbFpRushWeight + rbReceivingWeight
                      : teVolumeWeight + teProductionWeight + teEfficiencyWeight + teStickinessWeight
                }%)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveFormula}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600/50 hover:bg-green-600/70 text-white rounded-lg text-xs font-medium transition-colors"
                data-testid="save-formula"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
              {savedFormulas.length > 0 && (
                <select
                  onChange={(e) => e.target.value && loadFormula(e.target.value)}
                  className="px-3 py-1.5 bg-blue-600/50 hover:bg-blue-600/70 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  data-testid="load-formula"
                >
                  <option value="">Load Formula...</option>
                  {savedFormulas.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={resetWeights}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-lg text-xs font-medium transition-colors"
                data-testid="reset-weights"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
          </div>

          {position === 'WR' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-purple-200 font-medium">Volume</label>
                  <span className="text-sm text-purple-300 font-bold">{wrVolWeight}%</span>
                </div>
                <Slider
                  value={[wrVolWeight]}
                  onValueChange={(val) => setWrVolWeight(val[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-wr-volume"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-blue-200 font-medium">Production</label>
                  <span className="text-sm text-blue-300 font-bold">{wrProdWeight}%</span>
                </div>
                <Slider
                  value={[wrProdWeight]}
                  onValueChange={(val) => setWrProdWeight(val[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-wr-production"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-green-200 font-medium">Efficiency</label>
                  <span className="text-sm text-green-300 font-bold">{wrEffWeight}%</span>
                </div>
                <Slider
                  value={[wrEffWeight]}
                  onValueChange={(val) => setWrEffWeight(val[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-wr-efficiency"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-orange-200 font-medium">Stability</label>
                  <span className="text-sm text-orange-300 font-bold">{wrStabWeight}%</span>
                </div>
                <Slider
                  value={[wrStabWeight]}
                  onValueChange={(val) => setWrStabWeight(val[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-wr-stability"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-purple-200 font-medium">Carries Weight</label>
                  <span className="text-sm text-purple-300 font-bold">{rbCarriesWeight}%</span>
                </div>
                <Slider
                  value={[rbCarriesWeight]}
                  onValueChange={(val) => setRbCarriesWeight(val[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-rb-carries"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-blue-200 font-medium">Yards Weight</label>
                  <span className="text-sm text-blue-300 font-bold">{rbYardsWeight}%</span>
                </div>
                <Slider
                  value={[rbYardsWeight]}
                  onValueChange={(val) => setRbYardsWeight(val[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-rb-yards"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-green-200 font-medium">FP/Rush Weight</label>
                  <span className="text-sm text-green-300 font-bold">{rbFpRushWeight}%</span>
                </div>
                <Slider
                  value={[rbFpRushWeight]}
                  onValueChange={(val) => setRbFpRushWeight(val[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-rb-fprush"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-amber-200 font-medium">Receiving Work</label>
                  <span className="text-sm text-amber-300 font-bold">{rbReceivingWeight}%</span>
                </div>
                <Slider
                  value={[rbReceivingWeight]}
                  onValueChange={(val) => setRbReceivingWeight(val[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-rb-receiving"
                />
              </div>
            </div>
          )}

          {/* TE Sliders */}
          {position === 'TE' && (
            <div className="grid grid-cols-4 gap-4">
              {/* Volume Weight (40% default) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-amber-200 font-medium">Volume</span>
                  <span className="text-sm text-amber-400 font-bold">{teVolumeWeight}%</span>
                </div>
                <Slider
                  value={[teVolumeWeight]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([val]) => setTeVolumeWeight(val)}
                  className="w-full"
                  data-testid="slider-te-volume"
                />
              </div>

              {/* Production Weight (25% default) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-amber-200 font-medium">Production</span>
                  <span className="text-sm text-amber-400 font-bold">{teProductionWeight}%</span>
                </div>
                <Slider
                  value={[teProductionWeight]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([val]) => setTeProductionWeight(val)}
                  className="w-full"
                  data-testid="slider-te-production"
                />
              </div>

              {/* Efficiency Weight (20% default) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-amber-200 font-medium">Efficiency</span>
                  <span className="text-sm text-amber-400 font-bold">{teEfficiencyWeight}%</span>
                </div>
                <Slider
                  value={[teEfficiencyWeight]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([val]) => setTeEfficiencyWeight(val)}
                  className="w-full"
                  data-testid="slider-te-efficiency"
                />
              </div>

              {/* Stickiness Weight (15% default) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-amber-200 font-medium">Stickiness</span>
                  <span className="text-sm text-amber-400 font-bold">{teStickinessWeight}%</span>
                </div>
                <Slider
                  value={[teStickinessWeight]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([val]) => setTeStickinessWeight(val)}
                  className="w-full"
                  data-testid="slider-te-stickiness"
                />
              </div>
            </div>
          )}
        </div>

        {/* RB Phase 2: Presets, Export/Import, Compare, Candidate */}
        {position === 'RB' && (
          <div className="space-y-4">
            {/* Presets & Advanced Controls */}
            <div className="bg-gradient-to-br from-green-900/20 to-teal-900/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Preset Dropdown */}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-green-300 font-medium">Preset:</label>
                  <select
                    value={rbActivePreset}
                    onChange={(e) => applyRbPreset(e.target.value)}
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm cursor-pointer"
                    data-testid="rb-preset-select"
                  >
                    <optgroup label="Built-in">
                      {BUILT_IN_RB_PRESETS.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </optgroup>
                    {rbUserPresets.length > 0 && (
                      <optgroup label="Custom">
                        {rbUserPresets.map(p => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button
                    onClick={saveAsRbPreset}
                    className="px-3 py-1.5 bg-green-600/50 hover:bg-green-600/70 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    data-testid="rb-save-preset"
                  >
                    <Save className="w-3 h-3" />
                    Save as Preset
                  </button>
                  {rbUserPresets.find(p => p.id === rbActivePreset) && (
                    <button
                      onClick={() => deleteRbPreset(rbActivePreset)}
                      className="px-2 py-1.5 bg-red-600/50 hover:bg-red-600/70 text-white rounded-lg text-xs font-medium transition-colors"
                      data-testid="rb-delete-preset"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Export/Import/Compare/Candidate */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="px-3 py-1.5 bg-blue-600/50 hover:bg-blue-600/70 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    data-testid="rb-export-formula"
                  >
                    <Download className="w-3 h-3" />
                    Export
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-3 py-1.5 bg-blue-600/50 hover:bg-blue-600/70 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    data-testid="rb-import-formula"
                  >
                    <Upload className="w-3 h-3" />
                    Import
                  </button>
                  <button
                    onClick={() => setRbCompareMode(!rbCompareMode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      rbCompareMode ? 'bg-purple-600 text-white' : 'bg-purple-600/50 hover:bg-purple-600/70 text-white'
                    }`}
                    data-testid="rb-compare-toggle"
                  >
                    <Users className="w-3 h-3" />
                    Compare
                  </button>
                  <button
                    onClick={() => setShowCandidateModal(true)}
                    className="px-3 py-1.5 bg-amber-600/50 hover:bg-amber-600/70 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    data-testid="rb-mark-candidate"
                  >
                    <GitBranch className="w-3 h-3" />
                    Mark Candidate
                  </button>
                  <button
                    onClick={previewRoleBankPayload}
                    className="px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    data-testid="rb-preview-payload"
                  >
                    <Eye className="w-3 h-3" />
                    Preview Payload
                  </button>
                </div>
              </div>

              {/* Candidate Formulas List */}
              {rbCandidateFormulas.length > 0 && (
                <div className="mt-4 pt-3 border-t border-green-500/20">
                  <h4 className="text-xs font-semibold text-green-400 mb-2">Saved Candidate Formulas</h4>
                  <div className="flex flex-wrap gap-2">
                    {rbCandidateFormulas.map(c => (
                      <button
                        key={c.id}
                        onClick={() => loadCandidateFormula(c)}
                        className="px-2 py-1 bg-amber-800/30 hover:bg-amber-800/50 text-amber-300 rounded text-xs transition-colors"
                        data-testid={`candidate-${c.id}`}
                      >
                        {c.id} ({new Date(c.createdAt).toLocaleDateString()})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Split-View Comparison */}
            {rbCompareMode && (
              <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-lg p-4">
                <h3 className="text-sm font-bold text-purple-300 mb-4">Side-by-Side Comparison</h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* Player A */}
                  <div className="space-y-3">
                    <select
                      value={rbPlayerA || ''}
                      onChange={(e) => setRbPlayerA(e.target.value || null)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm"
                      data-testid="compare-player-a"
                    >
                      <option value="">Select Player A</option>
                      {(dataWithCustomScores as RBSandboxPlayer[])?.map(p => (
                        <option key={p.playerId} value={p.playerId}>{p.playerName} ({p.team})</option>
                      ))}
                    </select>
                    {rbPlayerA && (() => {
                      const playerA = (dataWithCustomScores as RBSandboxPlayer[])?.find(p => p.playerId === rbPlayerA);
                      const playerB = rbPlayerB ? (dataWithCustomScores as RBSandboxPlayer[])?.find(p => p.playerId === rbPlayerB) : null;
                      if (!playerA) return null;
                      const compareVal = (a: number, b: number | undefined) => {
                        if (b === undefined) return '';
                        return a > b ? 'text-green-400 font-bold' : a < b ? 'text-red-400' : '';
                      };
                      return (
                        <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 text-sm">
                          <div className="font-semibold text-white">{playerA.playerName} <span className="text-gray-500">({playerA.team})</span></div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div className="text-gray-400">Games</div><div className={compareVal(playerA.gamesPlayed, playerB?.gamesPlayed)}>{playerA.gamesPlayed}</div>
                            <div className="text-gray-400">Carries</div><div className={compareVal(playerA.totalCarries, playerB?.totalCarries)}>{playerA.totalCarries}</div>
                            <div className="text-gray-400">Carries/G</div><div className={compareVal(playerA.totalCarries / playerA.gamesPlayed, playerB ? playerB.totalCarries / playerB.gamesPlayed : undefined)}>{(playerA.totalCarries / playerA.gamesPlayed).toFixed(1)}</div>
                            <div className="text-gray-400">Rush Yds</div><div className={compareVal(playerA.totalRushingYards, playerB?.totalRushingYards)}>{playerA.totalRushingYards}</div>
                            <div className="text-gray-400">Yds/Carry</div><div className={compareVal(playerA.totalRushingYards / playerA.totalCarries, playerB ? playerB.totalRushingYards / playerB.totalCarries : undefined)}>{(playerA.totalRushingYards / playerA.totalCarries).toFixed(1)}</div>
                            <div className="text-gray-400">Fantasy Pts</div><div className={compareVal(playerA.fantasyPoints, playerB?.fantasyPoints)}>{playerA.fantasyPoints.toFixed(1)}</div>
                            <div className="text-gray-400">FP/Rush</div><div className={compareVal(playerA.fantasyPointsPerRushAttempt, playerB?.fantasyPointsPerRushAttempt)}>{playerA.fantasyPointsPerRushAttempt}</div>
                            <div className="text-gray-400">Targets</div><div className={compareVal(playerA.totalTargets, playerB?.totalTargets)}>{playerA.totalTargets}</div>
                            <div className="text-gray-400">Rec</div><div className={compareVal(playerA.totalReceptions, playerB?.totalReceptions)}>{playerA.totalReceptions}</div>
                            <div className="text-gray-400">Rec Yds</div><div className={compareVal(playerA.totalReceivingYards, playerB?.totalReceivingYards)}>{playerA.totalReceivingYards}</div>
                            <div className="text-gray-400">Rec Yds/G</div><div className={compareVal(playerA.totalReceivingYards / playerA.gamesPlayed, playerB ? playerB.totalReceivingYards / playerB.gamesPlayed : undefined)}>{(playerA.totalReceivingYards / playerA.gamesPlayed).toFixed(1)}</div>
                            <div className="text-gray-400">Rec FP/G</div><div className={compareVal(playerA.receivingFantasyPerGame, playerB?.receivingFantasyPerGame)}>{playerA.receivingFantasyPerGame}</div>
                            <div className="text-gray-400">Wtd Opp/G</div><div className={compareVal(playerA.weightedOppPerGame, playerB?.weightedOppPerGame)}>{playerA.weightedOppPerGame}</div>
                            <div className="text-gray-400">FP/Opp</div><div className={compareVal(playerA.fpPerOpp, playerB?.fpPerOpp)}>{playerA.fpPerOpp}</div>
                            <div className="text-purple-400 font-medium">Alpha Score</div><div className={`font-bold ${compareVal(playerA.customAlphaScore ?? 0, playerB?.customAlphaScore)}`}>{playerA.customAlphaScore ?? 0}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Player B */}
                  <div className="space-y-3">
                    <select
                      value={rbPlayerB || ''}
                      onChange={(e) => setRbPlayerB(e.target.value || null)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm"
                      data-testid="compare-player-b"
                    >
                      <option value="">Select Player B</option>
                      {(dataWithCustomScores as RBSandboxPlayer[])?.map(p => (
                        <option key={p.playerId} value={p.playerId}>{p.playerName} ({p.team})</option>
                      ))}
                    </select>
                    {rbPlayerB && (() => {
                      const playerB = (dataWithCustomScores as RBSandboxPlayer[])?.find(p => p.playerId === rbPlayerB);
                      const playerA = rbPlayerA ? (dataWithCustomScores as RBSandboxPlayer[])?.find(p => p.playerId === rbPlayerA) : null;
                      if (!playerB) return null;
                      const compareVal = (b: number, a: number | undefined) => {
                        if (a === undefined) return '';
                        return b > a ? 'text-green-400 font-bold' : b < a ? 'text-red-400' : '';
                      };
                      return (
                        <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 text-sm">
                          <div className="font-semibold text-white">{playerB.playerName} <span className="text-gray-500">({playerB.team})</span></div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div className="text-gray-400">Games</div><div className={compareVal(playerB.gamesPlayed, playerA?.gamesPlayed)}>{playerB.gamesPlayed}</div>
                            <div className="text-gray-400">Carries</div><div className={compareVal(playerB.totalCarries, playerA?.totalCarries)}>{playerB.totalCarries}</div>
                            <div className="text-gray-400">Carries/G</div><div className={compareVal(playerB.totalCarries / playerB.gamesPlayed, playerA ? playerA.totalCarries / playerA.gamesPlayed : undefined)}>{(playerB.totalCarries / playerB.gamesPlayed).toFixed(1)}</div>
                            <div className="text-gray-400">Rush Yds</div><div className={compareVal(playerB.totalRushingYards, playerA?.totalRushingYards)}>{playerB.totalRushingYards}</div>
                            <div className="text-gray-400">Yds/Carry</div><div className={compareVal(playerB.totalRushingYards / playerB.totalCarries, playerA ? playerA.totalRushingYards / playerA.totalCarries : undefined)}>{(playerB.totalRushingYards / playerB.totalCarries).toFixed(1)}</div>
                            <div className="text-gray-400">Fantasy Pts</div><div className={compareVal(playerB.fantasyPoints, playerA?.fantasyPoints)}>{playerB.fantasyPoints.toFixed(1)}</div>
                            <div className="text-gray-400">FP/Rush</div><div className={compareVal(playerB.fantasyPointsPerRushAttempt, playerA?.fantasyPointsPerRushAttempt)}>{playerB.fantasyPointsPerRushAttempt}</div>
                            <div className="text-gray-400">Targets</div><div className={compareVal(playerB.totalTargets, playerA?.totalTargets)}>{playerB.totalTargets}</div>
                            <div className="text-gray-400">Rec</div><div className={compareVal(playerB.totalReceptions, playerA?.totalReceptions)}>{playerB.totalReceptions}</div>
                            <div className="text-gray-400">Rec Yds</div><div className={compareVal(playerB.totalReceivingYards, playerA?.totalReceivingYards)}>{playerB.totalReceivingYards}</div>
                            <div className="text-gray-400">Rec Yds/G</div><div className={compareVal(playerB.totalReceivingYards / playerB.gamesPlayed, playerA ? playerA.totalReceivingYards / playerA.gamesPlayed : undefined)}>{(playerB.totalReceivingYards / playerB.gamesPlayed).toFixed(1)}</div>
                            <div className="text-gray-400">Rec FP/G</div><div className={compareVal(playerB.receivingFantasyPerGame, playerA?.receivingFantasyPerGame)}>{playerB.receivingFantasyPerGame}</div>
                            <div className="text-gray-400">Wtd Opp/G</div><div className={compareVal(playerB.weightedOppPerGame, playerA?.weightedOppPerGame)}>{playerB.weightedOppPerGame}</div>
                            <div className="text-gray-400">FP/Opp</div><div className={compareVal(playerB.fpPerOpp, playerA?.fpPerOpp)}>{playerB.fpPerOpp}</div>
                            <div className="text-purple-400 font-medium">Alpha Score</div><div className={`font-bold ${compareVal(playerB.customAlphaScore ?? 0, playerA?.customAlphaScore)}`}>{playerB.customAlphaScore ?? 0}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TE Phase 2: Presets, Export/Import, Compare, Candidate */}
        {position === 'TE' && (
          <div className="space-y-4">
            {/* Presets & Advanced Controls */}
            <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 border border-amber-500/30 rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Preset Dropdown */}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-amber-300 font-medium">Preset:</label>
                  <select
                    value={teActivePreset}
                    onChange={(e) => applyTePreset(e.target.value)}
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm cursor-pointer"
                    data-testid="te-preset-select"
                  >
                    <option value="">Custom</option>
                    {BUILT_IN_TE_PRESETS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                    {teUserPresets.map(p => (
                      <option key={p.id} value={p.id}>[User] {p.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={saveAsTePreset}
                    className="px-2 py-1.5 bg-amber-600/50 hover:bg-amber-600/70 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                    data-testid="te-save-preset"
                  >
                    <Save className="w-3 h-3" />
                    Save as Preset
                  </button>
                  {teUserPresets.find(p => p.id === teActivePreset) && (
                    <button
                      onClick={() => deleteTePreset(teActivePreset)}
                      className="px-2 py-1.5 bg-red-600/50 hover:bg-red-600/70 text-white rounded-lg text-xs font-medium transition-colors"
                      data-testid="te-delete-preset"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Export/Import/Compare/Candidate */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTeExportModal(true)}
                    className="px-3 py-1.5 bg-blue-600/50 hover:bg-blue-600/70 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    data-testid="te-export-formula"
                  >
                    <Download className="w-3 h-3" />
                    Export
                  </button>
                  <button
                    onClick={() => setShowTeImportModal(true)}
                    className="px-3 py-1.5 bg-blue-600/50 hover:bg-blue-600/70 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    data-testid="te-import-formula"
                  >
                    <Upload className="w-3 h-3" />
                    Import
                  </button>
                  <button
                    onClick={() => setTeCompareMode(!teCompareMode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      teCompareMode ? 'bg-purple-600 text-white' : 'bg-purple-600/50 hover:bg-purple-600/70 text-white'
                    }`}
                    data-testid="te-compare-toggle"
                  >
                    <Users className="w-3 h-3" />
                    Compare
                  </button>
                  <button
                    onClick={() => setShowTeCandidateModal(true)}
                    className="px-3 py-1.5 bg-amber-600/50 hover:bg-amber-600/70 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    data-testid="te-mark-candidate"
                  >
                    <GitBranch className="w-3 h-3" />
                    Mark Candidate
                  </button>
                  <button
                    onClick={previewTeRoleBankPayload}
                    className="px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    data-testid="te-preview-payload"
                  >
                    <Eye className="w-3 h-3" />
                    Preview Payload
                  </button>
                </div>
              </div>

              {/* Candidate Formulas List */}
              {teCandidateFormulas.length > 0 && (
                <div className="mt-4 pt-3 border-t border-amber-500/20">
                  <h4 className="text-xs font-semibold text-amber-400 mb-2">Saved Candidate Formulas</h4>
                  <div className="flex flex-wrap gap-2">
                    {teCandidateFormulas.map(c => (
                      <button
                        key={c.id}
                        onClick={() => loadTeCandidateFormula(c)}
                        className="px-2 py-1 bg-amber-800/30 hover:bg-amber-800/50 text-amber-300 rounded text-xs transition-colors"
                        data-testid={`te-candidate-${c.id}`}
                      >
                        {c.id} ({new Date(c.createdAt).toLocaleDateString()})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Split-View Comparison */}
            {teCompareMode && (
              <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-lg p-4">
                <h3 className="text-sm font-bold text-purple-300 mb-4">Side-by-Side Comparison</h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* Player A */}
                  <div className="space-y-3">
                    <select
                      value={tePlayerA || ''}
                      onChange={(e) => setTePlayerA(e.target.value || null)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm"
                      data-testid="te-compare-player-a"
                    >
                      <option value="">Select Player A</option>
                      {(dataWithCustomScores as TESandboxPlayer[])?.map(p => (
                        <option key={p.playerId} value={p.playerId}>{p.playerName} ({p.team})</option>
                      ))}
                    </select>
                    {tePlayerA && (() => {
                      const playerA = (dataWithCustomScores as TESandboxPlayer[])?.find(p => p.playerId === tePlayerA);
                      const playerB = tePlayerB ? (dataWithCustomScores as TESandboxPlayer[])?.find(p => p.playerId === tePlayerB) : null;
                      if (!playerA) return null;
                      const compareVal = (a: number, b: number | undefined) => {
                        if (b === undefined) return '';
                        return a > b ? 'text-green-400 font-bold' : a < b ? 'text-red-400' : '';
                      };
                      return (
                        <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 text-sm">
                          <div className="font-semibold text-white">{playerA.playerName} <span className="text-gray-500">({playerA.team})</span></div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div className="text-gray-400">Games</div><div className={compareVal(playerA.gamesPlayed, playerB?.gamesPlayed)}>{playerA.gamesPlayed}</div>
                            <div className="text-gray-400">Targets</div><div className={compareVal(playerA.totalTargets, playerB?.totalTargets)}>{playerA.totalTargets}</div>
                            <div className="text-gray-400">Targets/G</div><div className={compareVal(playerA.targetsPerGame, playerB?.targetsPerGame)}>{playerA.targetsPerGame.toFixed(1)}</div>
                            <div className="text-gray-400">Rec</div><div className={compareVal(playerA.totalReceptions, playerB?.totalReceptions)}>{playerA.totalReceptions}</div>
                            <div className="text-gray-400">Rec Yds</div><div className={compareVal(playerA.totalReceivingYards, playerB?.totalReceivingYards)}>{playerA.totalReceivingYards}</div>
                            <div className="text-gray-400">FP/Game</div><div className={compareVal(playerA.fpPerGame, playerB?.fpPerGame)}>{playerA.fpPerGame.toFixed(1)}</div>
                            <div className="text-gray-400">FP/Target</div><div className={compareVal(playerA.fpPerTarget, playerB?.fpPerTarget)}>{playerA.fpPerTarget.toFixed(2)}</div>
                            <div className="text-gray-400">Routes</div><div className={compareVal(playerA.totalRoutes, playerB?.totalRoutes)}>{playerA.totalRoutes}</div>
                            <div className="text-gray-400">Slot%</div><div className={compareVal(playerA.slotPct, playerB?.slotPct)}>{(playerA.slotPct * 100).toFixed(0)}%</div>
                            <div className="text-gray-400">Inline%</div><div className={compareVal(playerA.inlinePct, playerB?.inlinePct)}>{(playerA.inlinePct * 100).toFixed(0)}%</div>
                            <div className="text-gray-400">Snap Stickiness</div><div className={compareVal(playerA.snapStickinessIndex, playerB?.snapStickinessIndex)}>{playerA.snapStickinessIndex.toFixed(1)}</div>
                            <div className="text-purple-400 font-medium">Alpha Score</div><div className={`font-bold ${compareVal(playerA.customAlphaScore ?? 0, playerB?.customAlphaScore)}`}>{playerA.customAlphaScore ?? 0}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Player B */}
                  <div className="space-y-3">
                    <select
                      value={tePlayerB || ''}
                      onChange={(e) => setTePlayerB(e.target.value || null)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm"
                      data-testid="te-compare-player-b"
                    >
                      <option value="">Select Player B</option>
                      {(dataWithCustomScores as TESandboxPlayer[])?.map(p => (
                        <option key={p.playerId} value={p.playerId}>{p.playerName} ({p.team})</option>
                      ))}
                    </select>
                    {tePlayerB && (() => {
                      const playerB = (dataWithCustomScores as TESandboxPlayer[])?.find(p => p.playerId === tePlayerB);
                      const playerA = tePlayerA ? (dataWithCustomScores as TESandboxPlayer[])?.find(p => p.playerId === tePlayerA) : null;
                      if (!playerB) return null;
                      const compareVal = (b: number, a: number | undefined) => {
                        if (a === undefined) return '';
                        return b > a ? 'text-green-400 font-bold' : b < a ? 'text-red-400' : '';
                      };
                      return (
                        <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 text-sm">
                          <div className="font-semibold text-white">{playerB.playerName} <span className="text-gray-500">({playerB.team})</span></div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div className="text-gray-400">Games</div><div className={compareVal(playerB.gamesPlayed, playerA?.gamesPlayed)}>{playerB.gamesPlayed}</div>
                            <div className="text-gray-400">Targets</div><div className={compareVal(playerB.totalTargets, playerA?.totalTargets)}>{playerB.totalTargets}</div>
                            <div className="text-gray-400">Targets/G</div><div className={compareVal(playerB.targetsPerGame, playerA?.targetsPerGame)}>{playerB.targetsPerGame.toFixed(1)}</div>
                            <div className="text-gray-400">Rec</div><div className={compareVal(playerB.totalReceptions, playerA?.totalReceptions)}>{playerB.totalReceptions}</div>
                            <div className="text-gray-400">Rec Yds</div><div className={compareVal(playerB.totalReceivingYards, playerA?.totalReceivingYards)}>{playerB.totalReceivingYards}</div>
                            <div className="text-gray-400">FP/Game</div><div className={compareVal(playerB.fpPerGame, playerA?.fpPerGame)}>{playerB.fpPerGame.toFixed(1)}</div>
                            <div className="text-gray-400">FP/Target</div><div className={compareVal(playerB.fpPerTarget, playerA?.fpPerTarget)}>{playerB.fpPerTarget.toFixed(2)}</div>
                            <div className="text-gray-400">Routes</div><div className={compareVal(playerB.totalRoutes, playerA?.totalRoutes)}>{playerB.totalRoutes}</div>
                            <div className="text-gray-400">Slot%</div><div className={compareVal(playerB.slotPct, playerA?.slotPct)}>{(playerB.slotPct * 100).toFixed(0)}%</div>
                            <div className="text-gray-400">Inline%</div><div className={compareVal(playerB.inlinePct, playerA?.inlinePct)}>{(playerB.inlinePct * 100).toFixed(0)}%</div>
                            <div className="text-gray-400">Snap Stickiness</div><div className={compareVal(playerB.snapStickinessIndex, playerA?.snapStickinessIndex)}>{playerB.snapStickinessIndex.toFixed(1)}</div>
                            <div className="text-purple-400 font-medium">Alpha Score</div><div className={`font-bold ${compareVal(playerB.customAlphaScore ?? 0, playerA?.customAlphaScore)}`}>{playerB.customAlphaScore ?? 0}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TE Export Formula Modal */}
        {showTeExportModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Export TE Formula JSON</h3>
                <button onClick={() => setShowTeExportModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <pre className="bg-gray-800 p-4 rounded-lg text-sm text-amber-300 overflow-x-auto mb-4">
                {JSON.stringify(exportTeFormula(), null, 2)}
              </pre>
              <div className="flex gap-3">
                <button
                  onClick={() => { copyTeFormulaToClipboard(); setShowTeExportModal(false); }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  data-testid="te-copy-formula"
                >
                  <Copy className="w-4 h-4" />
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => { downloadTeFormula(); setShowTeExportModal(false); }}
                  className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  data-testid="te-download-formula"
                >
                  <Download className="w-4 h-4" />
                  Download File
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TE Import Formula Modal */}
        {showTeImportModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Import TE Formula JSON</h3>
                <button onClick={() => { setShowTeImportModal(false); setTeImportJson(''); setTeImportError(null); }} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <textarea
                value={teImportJson}
                onChange={(e) => setTeImportJson(e.target.value)}
                placeholder='Paste JSON here, e.g., {"version":"te-alpha-sandbox-v1","weights":{"volume":40,...}}'
                className="w-full h-40 px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm font-mono"
                data-testid="te-import-json-input"
              />
              {teImportError && (
                <p className="mt-2 text-sm text-red-400">{teImportError}</p>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { setShowTeImportModal(false); setTeImportJson(''); setTeImportError(null); }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={importTeFormula}
                  className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  data-testid="te-apply-import"
                >
                  <Upload className="w-4 h-4" />
                  Apply Formula
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TE Candidate Formula Modal */}
        {showTeCandidateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Mark as TE Candidate Formula</h3>
                <button onClick={() => { setShowTeCandidateModal(false); setTeCandidateLabel(''); }} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                type="text"
                value={teCandidateLabel}
                onChange={(e) => setTeCandidateLabel(e.target.value)}
                placeholder="e.g., te-alpha-v0.1"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm mb-4"
                data-testid="te-candidate-label-input"
              />
              <div className="bg-gray-800 p-3 rounded-lg mb-4">
                <p className="text-xs text-gray-400">Current Weights:</p>
                <p className="text-sm text-white mt-1">
                  Volume: {teVolumeWeight}% | Production: {teProductionWeight}% | Efficiency: {teEfficiencyWeight}% | Stickiness: {teStickinessWeight}%
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowTeCandidateModal(false); setTeCandidateLabel(''); }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={markAsTeCandidateFormula}
                  disabled={!teCandidateLabel.trim()}
                  className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  data-testid="te-save-candidate"
                >
                  <GitBranch className="w-4 h-4" />
                  Save Candidate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Formula Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Export Formula JSON</h3>
                <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <pre className="bg-gray-800 p-4 rounded-lg text-sm text-green-300 overflow-x-auto mb-4">
                {JSON.stringify(exportRbFormula(), null, 2)}
              </pre>
              <div className="flex gap-3">
                <button
                  onClick={() => { copyFormulaToClipboard(); setShowExportModal(false); }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  data-testid="copy-formula"
                >
                  <Copy className="w-4 h-4" />
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => { downloadFormula(); setShowExportModal(false); }}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  data-testid="download-formula"
                >
                  <Download className="w-4 h-4" />
                  Download File
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Formula Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Import Formula JSON</h3>
                <button onClick={() => { setShowImportModal(false); setImportJson(''); setImportError(null); }} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder='Paste JSON here, e.g., {"version":"rb-alpha-sandbox-v1","weights":{"carries":0.35,...}}'
                className="w-full h-40 px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm font-mono"
                data-testid="import-json-input"
              />
              {importError && (
                <p className="mt-2 text-sm text-red-400">{importError}</p>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { setShowImportModal(false); setImportJson(''); setImportError(null); }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={importRbFormula}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  data-testid="apply-import"
                >
                  <Upload className="w-4 h-4" />
                  Apply Formula
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Candidate Formula Modal */}
        {showCandidateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Mark as Candidate Formula</h3>
                <button onClick={() => { setShowCandidateModal(false); setCandidateLabel(''); }} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                type="text"
                value={candidateLabel}
                onChange={(e) => setCandidateLabel(e.target.value)}
                placeholder="e.g., rb-alpha-v0.4"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm mb-4"
                data-testid="candidate-label-input"
              />
              <div className="bg-gray-800 p-3 rounded-lg mb-4">
                <p className="text-xs text-gray-400">Current Weights:</p>
                <p className="text-sm text-white mt-1">
                  Carries: {rbCarriesWeight}% | Yards: {rbYardsWeight}% | FP/Rush: {rbFpRushWeight}% | Receiving: {rbReceivingWeight}%
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCandidateModal(false); setCandidateLabel(''); }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={markAsCandidateFormula}
                  disabled={!candidateLabel.trim()}
                  className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  data-testid="save-candidate"
                >
                  <GitBranch className="w-4 h-4" />
                  Save Candidate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Box - WR only */}
        {position === 'WR' && (
          <>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-blue-300 mb-2">Alpha Composite Score (0-100)</h3>
                <p className="text-xs text-gray-400 mb-1">
                  Blends volume, total fantasy points, and efficiency into a single diagnostic score:
                </p>
                <p className="text-xs text-gray-500">
                  <strong className="text-purple-300">Alpha Score</strong> = 45% Volume + 35% Total Points + 20% Efficiency
                </p>
              </div>
              <div className="border-t border-blue-500/20 pt-2">
                <p className="text-xs text-gray-500">
                  High-volume, high-scoring WRs (JSN, ARSB, Lamb, Puka, Chase) rank at the top. 
                  Low-volume spike guys can still rank well but won't eclipse true workhorse alphas.
                </p>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Filters & Highlights</h3>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterCoAlphaSecondary}
                    onChange={(e) => setFilterCoAlphaSecondary(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-2 focus:ring-blue-500"
                    data-testid="filter-co-alpha-secondary"
                  />
                  <span className="text-sm text-gray-300">Only show CO_ALPHA / SECONDARY</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highlightDeepThreats}
                    onChange={(e) => setHighlightDeepThreats(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-2 focus:ring-orange-500"
                    data-testid="highlight-deep-threats"
                  />
                  <span className="text-sm text-gray-300">Highlight deep threats (≥20% deep target rate)</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highlightSlotHeavy}
                    onChange={(e) => setHighlightSlotHeavy(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-2 focus:ring-cyan-500"
                    data-testid="highlight-slot-heavy"
                  />
                  <span className="text-sm text-gray-300">Highlight slot-heavy (≥45% slot share)</span>
                </label>
              </div>
            </div>
          </>
        )}

        {/* Stats Summary */}
        {data && (
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="font-medium text-white">{sortedData?.length || 0}</span>
            <span>{position}s shown (from {data.count} total)</span>
            <span className="text-gray-600">•</span>
            <span>Season: {data.season}</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-500">Sorted by {sortField}</span>
          </div>
        )}

        {/* Table */}
        {position === 'TE' ? (
          // TE Table Phase 2 (Enhanced with Archetype, RZ Targets, TD Role, Volatility)
          <div className="bg-[#111217] border border-gray-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0d0e11] border-b border-gray-800/50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="playerName" label="Player" />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="team" label="Team" />
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="gamesPlayed" label="G" />
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-lime-400 uppercase tracking-wider" title="TE Role Archetype (Phase 2)">
                      Type
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-green-400 uppercase tracking-wider">
                      Tgts
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-red-400 uppercase tracking-wider" title="Red Zone Targets (Phase 2)">
                      RZ
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-amber-400 uppercase tracking-wider" title="Total Receiving TDs">
                      TDs
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-pink-400 uppercase tracking-wider" title="TD Role Score (Phase 2)">
                      TD Role
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                      FP/G
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-orange-400 uppercase tracking-wider">
                      FP/Tgt
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-indigo-400 uppercase tracking-wider" title="Slot% / Inline%">
                      Align
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-emerald-400 uppercase tracking-wider" title="Snap Stickiness Index 2.0">
                      SSI
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-yellow-400 uppercase tracking-wider" title="Floor/Ceiling (P20/P80)">
                      Range
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider" title="Context Tag (Phase 2)">
                      Context
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-sky-400 uppercase tracking-wider" title="Team Offensive Environment (v0.2.1)">
                      Env
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-rose-400 uppercase tracking-wider" title="Matchup vs Opponent Defense (v0.2.2)">
                      Matchup
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-purple-400 uppercase tracking-wider">
                      <button 
                        onClick={() => handleSort('alphaScore')}
                        className="flex items-center gap-1 hover:text-purple-300 transition-colors"
                        data-testid="te-sort-alphaScore"
                      >
                        <span>Alpha</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    [...Array(10)].map((_, idx) => (
                      <tr key={idx} className="border-b border-gray-800/30">
                        <td colSpan={16} className="px-4 py-4">
                          <div className="h-8 bg-gray-700/30 rounded animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    sortedData?.map((player, idx) => {
                      const tePlayer = player as TESandboxPlayer;
                      const isCustomWeights = teVolumeWeight !== 40 || teProductionWeight !== 25 || teEfficiencyWeight !== 20 || teStickinessWeight !== 15;
                      const archetypeColors: Record<string, string> = {
                        'BIG_SLOT': 'bg-indigo-600/40 text-indigo-200',
                        'INLINE': 'bg-amber-600/40 text-amber-200',
                        'HYBRID': 'bg-cyan-600/40 text-cyan-200',
                        'H_BACK': 'bg-gray-600/40 text-gray-300',
                      };
                      return (
                        <tr
                          key={tePlayer.playerId}
                          className="border-b border-gray-800/30 hover:bg-amber-500/5 transition-colors"
                          data-testid={`te-sandbox-row-${idx}`}
                        >
                          <td className="px-3 py-3 text-gray-500 font-medium">{idx + 1}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{tePlayer.playerName}</span>
                              {(tePlayer.injuryStatus === 'IR' || tePlayer.injuryStatus === 'OUT' || tePlayer.injuryStatus === 'PUP') && (
                                <span className="px-1.5 py-0.5 bg-red-600/80 text-white text-[10px] font-bold rounded uppercase tracking-wide">
                                  {tePlayer.injuryStatus}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="px-2 py-1 bg-gray-800/70 text-gray-300 rounded text-xs font-medium">
                              {tePlayer.team}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center text-gray-300">{tePlayer.gamesPlayed}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${archetypeColors[tePlayer.archetype] || 'bg-gray-600/40 text-gray-300'}`}>
                              {tePlayer.archetype === 'BIG_SLOT' ? 'Slot' : 
                               tePlayer.archetype === 'INLINE' ? 'Inline' :
                               tePlayer.archetype === 'H_BACK' ? 'H-back' : 'Hybrid'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center text-green-300 font-semibold">{tePlayer.totalTargets}</td>
                          <td className="px-3 py-3 text-center text-red-300 font-medium">{tePlayer.rzTargets ?? 0}</td>
                          <td className="px-3 py-3 text-center text-amber-300 font-bold">{tePlayer.totalReceivingTDs}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`font-semibold ${(tePlayer.tdRoleScore ?? 0) >= 0.5 ? 'text-pink-400' : (tePlayer.tdRoleScore ?? 0) >= 0.3 ? 'text-pink-300' : 'text-gray-400'}`}>
                              {((tePlayer.tdRoleScore ?? 0) * 100).toFixed(0)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center text-cyan-300 font-medium">{tePlayer.fpPerGame.toFixed(1)}</td>
                          <td className="px-3 py-3 text-center text-orange-300">{tePlayer.fpPerTarget.toFixed(2)}</td>
                          <td className="px-3 py-3 text-center text-indigo-300 text-xs">
                            {(tePlayer.slotPct * 100).toFixed(0)}/{(tePlayer.inlinePct * 100).toFixed(0)}
                          </td>
                          <td className="px-3 py-3 text-center text-emerald-300 font-medium">{tePlayer.snapStickinessIndex.toFixed(0)}</td>
                          <td className="px-3 py-3 text-center text-yellow-300 text-xs">
                            {tePlayer.floorFp?.toFixed(1) ?? '–'}/{tePlayer.ceilingFp?.toFixed(1) ?? '–'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {tePlayer.contextTag ? (
                              <span className="text-[10px] text-gray-400 italic">{tePlayer.contextTag.split(' – ')[0]}</span>
                            ) : (
                              <span className="text-gray-600">–</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {tePlayer.forge_env_score_100 != null ? (
                              <span 
                                className={`font-medium ${
                                  tePlayer.forge_env_score_100 >= 60 ? 'text-green-400' :
                                  tePlayer.forge_env_score_100 >= 55 ? 'text-emerald-400' :
                                  tePlayer.forge_env_score_100 >= 45 ? 'text-sky-300' :
                                  tePlayer.forge_env_score_100 >= 40 ? 'text-orange-400' :
                                  'text-red-400'
                                }`}
                                title={`Env: ${tePlayer.forge_env_score_100} (${tePlayer.forge_env_multiplier?.toFixed(3)}x)`}
                              >
                                {tePlayer.forge_env_score_100}
                              </span>
                            ) : (
                              <span className="text-gray-600">–</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {tePlayer.forge_matchup_score_100 != null && tePlayer.forge_opponent ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span 
                                  className={`text-xs font-medium ${
                                    tePlayer.forge_matchup_score_100 >= 70 ? 'text-green-400' :
                                    tePlayer.forge_matchup_score_100 >= 55 ? 'text-emerald-400' :
                                    tePlayer.forge_matchup_score_100 >= 45 ? 'text-rose-300' :
                                    tePlayer.forge_matchup_score_100 >= 30 ? 'text-orange-400' :
                                    'text-red-400'
                                  }`}
                                  title={`vs ${tePlayer.forge_opponent}: ${tePlayer.forge_matchup_score_100} (${tePlayer.forge_matchup_multiplier?.toFixed(3)}x)`}
                                >
                                  {tePlayer.forge_opponent}
                                </span>
                                <span className="text-[10px] text-gray-500">{tePlayer.forge_matchup_score_100}</span>
                              </div>
                            ) : (
                              <span className="text-gray-600">–</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-bold text-purple-400 text-base">{tePlayer.alphaScore?.toFixed(1) ?? tePlayer.customAlphaScore ?? 0}</span>
                              {isCustomWeights && (
                                <span className="text-[9px] text-purple-300/60 uppercase tracking-wide">custom</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {!isLoading && sortedData?.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </div>
        ) : position === 'RB' ? (
          // RB Simple Table (Total Carries, Total Rush Yds, FP/Rush)
          <div className="bg-[#111217] border border-gray-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0d0e11] border-b border-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="playerName" label="Player" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="team" label="Team" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="gamesPlayed" label="Games" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="totalCarries" label="Total Carries" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                      Carries/G
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="totalRushingYards" label="Total Rush Yds" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      Yds/Carry
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="fantasyPoints" label="Fantasy Pts" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="fantasyPointsPerRushAttempt" label="FP/Rush" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-green-400 uppercase tracking-wider">
                      Targets
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-blue-400 uppercase tracking-wider">
                      Rec
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                      Rec Yds
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      Rec Yds/G
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-pink-400 uppercase tracking-wider">
                      Rec FP/G
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-orange-400 uppercase tracking-wider">
                      Wtd Opp/G
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-teal-400 uppercase tracking-wider">
                      FP/Opp
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-purple-400 uppercase tracking-wider">
                      <button 
                        onClick={() => handleSort('customAlphaScore')}
                        className="flex items-center gap-1 hover:text-purple-300 transition-colors"
                        data-testid="sort-customAlphaScore"
                      >
                        <span>Custom Score</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    [...Array(10)].map((_, idx) => (
                      <tr key={idx} className="border-b border-gray-800/30">
                        <td colSpan={18} className="px-4 py-4">
                          <div className="h-8 bg-gray-700/30 rounded animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    sortedData?.map((player, idx) => {
                      const rbPlayer = player as RBSandboxPlayer;
                      // Check if weights are custom
                      const isCustomWeights = rbCarriesWeight !== 35 || rbYardsWeight !== 30 || rbFpRushWeight !== 20 || rbReceivingWeight !== 15;
                      return (
                        <tr
                          key={rbPlayer.playerId}
                          className="border-b border-gray-800/30 hover:bg-green-500/5 transition-colors"
                          data-testid={`sandbox-row-${idx}`}
                        >
                          <td className="px-4 py-3 text-gray-500 font-medium">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{rbPlayer.playerName}</span>
                              {(rbPlayer.injuryStatus === 'IR' || rbPlayer.injuryStatus === 'OUT' || rbPlayer.injuryStatus === 'PUP') && (
                                <span className="px-1.5 py-0.5 bg-red-600/80 text-white text-[10px] font-bold rounded uppercase tracking-wide">
                                  {rbPlayer.injuryStatus}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-gray-800/70 text-gray-300 rounded text-xs font-medium">
                              {rbPlayer.team}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-300">{rbPlayer.gamesPlayed}</td>
                          <td className="px-4 py-3 text-center text-green-300 font-semibold">{rbPlayer.totalCarries}</td>
                          <td className="px-4 py-3 text-center text-cyan-300">{(rbPlayer.totalCarries / rbPlayer.gamesPlayed).toFixed(1)}</td>
                          <td className="px-4 py-3 text-center text-blue-300">{rbPlayer.totalRushingYards}</td>
                          <td className="px-4 py-3 text-center text-amber-300">{(rbPlayer.totalRushingYards / rbPlayer.totalCarries).toFixed(1)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{rbPlayer.fantasyPoints.toFixed(1)}</td>
                          <td className="px-4 py-3 text-center text-purple-300 font-bold">{rbPlayer.fantasyPointsPerRushAttempt}</td>
                          <td className="px-4 py-3 text-center text-green-300">{rbPlayer.totalTargets}</td>
                          <td className="px-4 py-3 text-center text-blue-300">{rbPlayer.totalReceptions}</td>
                          <td className="px-4 py-3 text-center text-cyan-300">{rbPlayer.totalReceivingYards}</td>
                          <td className="px-4 py-3 text-center text-amber-300">{(rbPlayer.totalReceivingYards / rbPlayer.gamesPlayed).toFixed(1)}</td>
                          <td className="px-4 py-3 text-center text-pink-300 font-medium">{rbPlayer.receivingFantasyPerGame}</td>
                          <td className="px-4 py-3 text-center text-orange-300 font-medium">{rbPlayer.weightedOppPerGame}</td>
                          <td className="px-4 py-3 text-center text-teal-300 font-medium">{rbPlayer.fpPerOpp}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-bold text-purple-400 text-base">{rbPlayer.customAlphaScore ?? 0}</span>
                              {isCustomWeights && (
                                <span className="text-[9px] text-purple-300/60 uppercase tracking-wide">custom</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {!isLoading && sortedData?.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </div>
        ) : (
          // WR Complex Table (all the advanced metrics)
          <div className="bg-[#111217] border border-gray-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0d0e11] border-b border-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="playerName" label="Player" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="team" label="Team" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="gamesPlayed" label="Games" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="targets" label="Targets" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="fantasyPoints" label="Fantasy Pts" />
                    </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="pointsPerTarget" label="Pts/Tgt" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="samplePenalty" label="Sample" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="adjustedEfficiency" label="Adj Pts/Tgt" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-purple-400 uppercase tracking-wider">
                    <SortButton field="customAlphaScore" label="Custom Score" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="roleScore" label="Role Score" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="deepTargetRate" label="Deep %" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="slotRouteShareEst" label="Slot %" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="weightedTargetsPerGame" label="Wt Tgt/G" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="boomRate" label="Boom %" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="bustRate" label="Bust %" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="talentIndex" label="Talent" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="usageStabilityIndex" label="Stability" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="roleDelta" label="Role Δ" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="redZoneDomScore" label="RZ Dom" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="energyIndex" label="Energy" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(10)].map((_, idx) => (
                    <tr key={idx} className="border-b border-gray-800/30">
                      <td colSpan={21} className="px-4 py-4">
                        <div className="h-8 bg-gray-700/30 rounded animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : (
                  sortedData?.map((player, idx) => {
                    const deepThreat = isDeepThreat(player);
                    const slotHeavy = isSlotHeavy(player);
                    const highEnergy = (player.energyIndex ?? 0) >= 80;
                    const rowClassName = `border-b border-gray-800/30 hover:bg-blue-500/5 transition-colors ${
                      deepThreat ? 'bg-orange-500/10' : slotHeavy ? 'bg-cyan-500/10' : highEnergy ? 'bg-green-500/5' : ''
                    }`;
                    
                    return (
                      <tr
                        key={player.playerId}
                        className={rowClassName}
                        data-testid={`sandbox-row-${idx}`}
                      >
                        <td className="px-4 py-3 text-gray-500 font-medium">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{player.playerName}</span>
                            {(player.injuryStatus === 'IR' || player.injuryStatus === 'OUT' || player.injuryStatus === 'PUP') && (
                              <span className="px-1.5 py-0.5 bg-red-600/80 text-white text-[10px] font-bold rounded uppercase tracking-wide">
                                {player.injuryStatus}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-gray-800/70 text-gray-300 rounded text-xs font-medium">
                            {player.team}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{player.gamesPlayed}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{player.targets}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{player.fantasyPoints.toFixed(1)}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{player.pointsPerTarget.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{player.samplePenalty.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{player.adjustedEfficiency.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold text-purple-400 text-base">{player.customAlphaScore ?? player.alphaScore}</span>
                            {player.customAlphaScore && player.customAlphaScore !== player.alphaScore && (
                              <span className="text-[9px] text-purple-300/60 uppercase tracking-wide">custom</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.roleScore !== null ? (
                            <span className="text-blue-300 font-medium">{player.roleScore}</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.deepTargetRate !== null ? (
                            <span className={deepThreat ? 'text-orange-400 font-bold' : 'text-gray-300'}>
                              {(player.deepTargetRate * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.slotRouteShareEst !== null ? (
                            <span className={slotHeavy ? 'text-cyan-400 font-bold' : 'text-gray-300'}>
                              {(player.slotRouteShareEst * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        {/* Advanced Metrics (NEW) */}
                        <td className="px-4 py-3 text-center">
                          {player.weightedTargetsPerGame !== null ? (
                            <span className="text-amber-300 font-medium">{player.weightedTargetsPerGame.toFixed(1)}</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.boomRate !== null ? (
                            <span className="text-green-300">{(player.boomRate * 100).toFixed(0)}%</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.bustRate !== null ? (
                            <span className="text-red-300">{(player.bustRate * 100).toFixed(0)}%</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.talentIndex !== null ? (
                            <span className="text-purple-300 font-medium">{player.talentIndex}</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.usageStabilityIndex !== null ? (
                            <span className="text-blue-300">{player.usageStabilityIndex}</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.roleDelta !== null ? (
                            <span className={player.roleDelta >= 80 ? 'text-green-400 font-bold' : player.roleDelta <= 50 ? 'text-red-400' : 'text-gray-300'}>
                              {player.roleDelta}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.redZoneDomScore !== null ? (
                            <span className="text-orange-300 font-medium">{player.redZoneDomScore}</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.energyIndex !== null ? (
                            <span className={highEnergy ? 'text-yellow-400 font-bold text-base' : 'text-gray-300'}>
                              {player.energyIndex}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {!isLoading && sortedData?.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>
        )}

        {/* Progress & Future Features */}
        <div className="bg-gradient-to-br from-green-900/20 to-gray-900/20 border border-green-500/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-green-300 mb-2">✅ Implemented Features</h3>
          <ul className="text-xs text-gray-400 space-y-1 mb-3">
            <li>✓ Interactive weight sliders to test custom formulas</li>
            <li>✓ Real-time alphaScore recalculation</li>
            <li>✓ Additional metrics: Carries/G, Yds/Carry for RBs</li>
            <li>✓ Save & load custom formulas (localStorage)</li>
          </ul>
          <h3 className="text-sm font-semibold text-gray-300 mb-2 mt-4">🔮 Future Enhancements</h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• Compare multiple formulas side-by-side in split view</li>
            <li>• Export formula as shareable JSON</li>
            <li>• Apply winning formula to TE/QB positions</li>
            <li>• A/B test formulas against expert consensus rankings</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
