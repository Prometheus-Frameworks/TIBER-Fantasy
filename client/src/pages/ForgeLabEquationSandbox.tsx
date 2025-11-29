import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Copy, Check, FlaskConical, Save, FolderOpen, Trash2, X, Search, Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { FORGE_LAB_EQUATIONS, getEquationById, type ForgeLabEquation, type ForgeLabInputDef } from '../forgeLab/equations';

type ForgeLabPreset = {
  id: string;
  title: string;
  equationId: string;
  inputs: Record<string, number>;
  savedAt: string;
};

const PRESETS_STORAGE_KEY = 'forge_lab_presets';

function loadPresets(): ForgeLabPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function savePresets(presets: ForgeLabPreset[]) {
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

function generateId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function InputSlider({
  def,
  value,
  onChange,
}: {
  def: ForgeLabInputDef;
  value: number;
  onChange: (val: number) => void;
}) {
  const handleSliderChange = useCallback((vals: number[]) => {
    onChange(vals[0]);
  }, [onChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      const clamped = Math.max(def.min, Math.min(def.max, parsed));
      onChange(clamped);
    }
  }, [def.min, def.max, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-gray-300">{def.label}</Label>
        <Input
          type="number"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          onChange={handleInputChange}
          className="w-24 h-8 text-right bg-[#1a1f2e] border-gray-700 text-white"
          data-testid={`input-${def.key}`}
        />
      </div>
      <Slider
        min={def.min}
        max={def.max}
        step={def.step}
        value={[value]}
        onValueChange={handleSliderChange}
        className="w-full"
        data-testid={`slider-${def.key}`}
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>{def.min}</span>
        <span>{def.max}</span>
      </div>
    </div>
  );
}

function OutputCard({ outputs }: { outputs: Record<string, number> }) {
  return (
    <Card className="bg-[#141824] border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <Badge className="bg-emerald-600 text-white">Outputs</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(outputs).map(([key, val]) => (
            <div key={key} className="bg-[#0a0e1a] rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1">{key}</div>
              <div className="text-xl font-mono text-white" data-testid={`output-${key}`}>
                {typeof val === 'number' ? val.toFixed(4) : val}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StepsCard({ steps }: { steps: string[] }) {
  return (
    <Card className="bg-[#141824] border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <Badge className="bg-blue-600 text-white">Calculation Steps</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 font-mono text-sm">
          {steps.map((step, i) => (
            <div
              key={i}
              className={step === '' ? 'h-2' : 'text-gray-300 bg-[#0a0e1a] rounded px-3 py-1.5 border border-gray-800'}
              data-testid={`step-${i}`}
            >
              {step}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function JsonExportCard({
  inputs,
  outputs,
}: {
  inputs: Record<string, number>;
  outputs: Record<string, number>;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const jsonData = useMemo(() => ({
    inputs,
    derived: outputs,
  }), [inputs, outputs]);

  const jsonString = useMemo(() => JSON.stringify(jsonData, null, 2), [jsonData]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      toast({ title: 'Copied to clipboard', description: 'JSON data copied successfully' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard', variant: 'destructive' });
    }
  }, [jsonString, toast]);

  return (
    <Card className="bg-[#141824] border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Badge className="bg-purple-600 text-white">JSON Export</Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
            data-testid="button-copy-json"
          >
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? 'Copied' : 'Copy JSON'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="bg-[#0a0e1a] rounded-lg p-4 border border-gray-800 text-xs text-gray-300 overflow-x-auto">
          {jsonString}
        </pre>
      </CardContent>
    </Card>
  );
}

type PlayerMatch = {
  rank: number;
  playerId: string;
  playerName: string;
  team: string;
  WR_Alpha: number;
  Chain: number;
  Explosive: number;
  WinSkill: number;
  similarity: number;
};

type PlayerMatchesResponse = {
  success: boolean;
  meta: {
    season: number;
    week: string | number;
    matchCount: number;
  };
  matches: PlayerMatch[];
  error?: string;
};

function PlayerMatchesCard({
  inputs,
}: {
  inputs: Record<string, number>;
}) {
  const { toast } = useToast();
  const [season, setSeason] = useState('2025');
  const [week, setWeek] = useState('full');
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<PlayerMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleFindMatches = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await apiRequest('POST', '/api/forge/lab/wr-core/matches', {
        inputs: {
          TS: inputs.TS,
          YPRR: inputs.YPRR,
          FD_RR: inputs.FD_RR,
          YAC: inputs.YAC,
          CC: inputs.CC,
        },
        season: parseInt(season),
        week: week === 'full' ? 'full' : parseInt(week),
        limit: 5,
      });
      
      const response: PlayerMatchesResponse = await res.json();
      
      if (response.success && response.matches) {
        setMatches(response.matches);
        toast({
          title: 'Matches found',
          description: `Found ${response.matches.length} closest player matches`,
        });
      } else {
        toast({
          title: 'No matches',
          description: response.error || 'No matching players found',
          variant: 'destructive',
        });
        setMatches([]);
      }
    } catch (err) {
      console.error('Error finding matches:', err);
      toast({
        title: 'Error',
        description: 'Failed to find player matches',
        variant: 'destructive',
      });
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [inputs, season, week, toast]);

  return (
    <Card className="bg-[#141824] border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-400" />
          <span>Closest Player Matches</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Find real players whose profiles match your slider configuration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Season</Label>
            <Select value={season} onValueChange={setSeason}>
              <SelectTrigger className="w-24 bg-[#0a0e1a] border-gray-700 text-white" data-testid="select-season">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141824] border-gray-700">
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Week</Label>
            <Select value={week} onValueChange={setWeek}>
              <SelectTrigger className="w-32 bg-[#0a0e1a] border-gray-700 text-white" data-testid="select-week">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141824] border-gray-700">
                <SelectItem value="full">Full Season</SelectItem>
                {[...Array(17)].map((_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>Week {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleFindMatches}
            disabled={loading}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
            data-testid="button-find-matches"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Find Matches
          </Button>
        </div>

        {hasSearched && (
          <div className="mt-4">
            {matches.length > 0 ? (
              <div className="overflow-x-auto" data-testid="matches-table-container">
                <table className="w-full text-sm" data-testid="matches-table">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-2 text-gray-400 font-medium" data-testid="header-rank">#</th>
                      <th className="text-left py-2 px-2 text-gray-400 font-medium" data-testid="header-player">Player</th>
                      <th className="text-center py-2 px-2 text-gray-400 font-medium" data-testid="header-alpha">WR_α</th>
                      <th className="text-center py-2 px-2 text-gray-400 font-medium" data-testid="header-chain">Chain</th>
                      <th className="text-center py-2 px-2 text-gray-400 font-medium" data-testid="header-explosive">Expl</th>
                      <th className="text-center py-2 px-2 text-gray-400 font-medium" data-testid="header-winskill">Win</th>
                      <th className="text-center py-2 px-2 text-gray-400 font-medium" data-testid="header-match">Match</th>
                    </tr>
                  </thead>
                  <tbody data-testid="matches-tbody">
                    {matches.map((match) => (
                      <tr 
                        key={match.playerId} 
                        className="border-b border-gray-800 hover:bg-[#0a0e1a]/50"
                        data-testid={`match-row-${match.rank}`}
                      >
                        <td className="py-2 px-2 text-gray-500 font-mono" data-testid={`cell-rank-${match.rank}`}>{match.rank}</td>
                        <td className="py-2 px-2" data-testid={`cell-player-${match.rank}`}>
                          <div className="text-white font-medium" data-testid={`text-player-name-${match.rank}`}>{match.playerName}</div>
                          <div className="text-xs text-gray-500" data-testid={`text-player-team-${match.rank}`}>{match.team}</div>
                        </td>
                        <td className="py-2 px-2 text-center" data-testid={`cell-alpha-${match.rank}`}>
                          <span className="font-mono text-cyan-400">{match.WR_Alpha.toFixed(1)}</span>
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-gray-300" data-testid={`cell-chain-${match.rank}`}>{match.Chain.toFixed(2)}</td>
                        <td className="py-2 px-2 text-center font-mono text-gray-300" data-testid={`cell-explosive-${match.rank}`}>{match.Explosive.toFixed(2)}</td>
                        <td className="py-2 px-2 text-center font-mono text-gray-300" data-testid={`cell-winskill-${match.rank}`}>{match.WinSkill.toFixed(2)}</td>
                        <td className="py-2 px-2" data-testid={`cell-similarity-${match.rank}`}>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={match.similarity * 100} 
                              className="h-2 w-16 bg-gray-700"
                              data-testid={`progress-similarity-${match.rank}`}
                            />
                            <span className="text-xs font-mono text-emerald-400" data-testid={`text-similarity-${match.rank}`}>
                              {(match.similarity * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                {loading ? 'Searching...' : 'No matches found. Try adjusting the sliders.'}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ForgeLabEquationSandbox() {
  const { toast } = useToast();
  const [selectedEquationId, setSelectedEquationId] = useState<string>(FORGE_LAB_EQUATIONS[0]?.id ?? '');
  const selectedEquation = useMemo(() => getEquationById(selectedEquationId), [selectedEquationId]);

  const [inputValues, setInputValues] = useState<Record<string, number>>(() => {
    const eq = FORGE_LAB_EQUATIONS[0];
    if (!eq) return {};
    return eq.inputs.reduce((acc, input) => {
      acc[input.key] = input.defaultValue;
      return acc;
    }, {} as Record<string, number>);
  });

  const [presets, setPresets] = useState<ForgeLabPreset[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const presetsForCurrentEquation = useMemo(() => {
    return presets.filter(p => p.equationId === selectedEquationId);
  }, [presets, selectedEquationId]);

  const handleEquationChange = useCallback((eqId: string) => {
    setSelectedEquationId(eqId);
    const eq = getEquationById(eqId);
    if (eq) {
      const defaults = eq.inputs.reduce((acc, input) => {
        acc[input.key] = input.defaultValue;
        return acc;
      }, {} as Record<string, number>);
      setInputValues(defaults);
    }
  }, []);

  const handleInputChange = useCallback((key: string, val: number) => {
    setInputValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) {
      toast({ title: 'Name required', description: 'Please enter a name for the preset', variant: 'destructive' });
      return;
    }
    const duplicate = presetsForCurrentEquation.find(p => p.title.toLowerCase() === presetName.trim().toLowerCase());
    if (duplicate) {
      toast({ title: 'Duplicate name', description: 'A preset with this name already exists for this equation', variant: 'destructive' });
      return;
    }
    const newPreset: ForgeLabPreset = {
      id: generateId(),
      title: presetName.trim(),
      equationId: selectedEquationId,
      inputs: { ...inputValues },
      savedAt: new Date().toISOString(),
    };
    const updatedPresets = [...presets, newPreset];
    savePresets(updatedPresets);
    setPresets(updatedPresets);
    setPresetName('');
    setSaveDialogOpen(false);
    toast({ title: 'Preset saved', description: `"${newPreset.title}" saved successfully` });
  }, [presetName, presetsForCurrentEquation, selectedEquationId, inputValues, presets, toast]);

  const handleLoadPreset = useCallback((presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setInputValues(preset.inputs);
      toast({ title: 'Preset loaded', description: `"${preset.title}" loaded` });
    }
  }, [presets, toast]);

  const handleDeletePreset = useCallback((presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    const updatedPresets = presets.filter(p => p.id !== presetId);
    savePresets(updatedPresets);
    setPresets(updatedPresets);
    toast({ title: 'Preset deleted', description: preset ? `"${preset.title}" deleted` : 'Preset deleted' });
  }, [presets, toast]);

  const computeResult = useMemo(() => {
    if (!selectedEquation) return { outputs: {}, steps: [] };
    return selectedEquation.compute(inputValues);
  }, [selectedEquation, inputValues]);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/dev/forge">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">FORGE Lab</h1>
              <Badge className="bg-yellow-600 text-white text-xs">Admin Sandbox</Badge>
            </div>
          </div>
        </div>

        <Card className="bg-[#141824] border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Equation Selector</CardTitle>
            <CardDescription className="text-gray-400">
              Select an equation to explore and adjust its parameters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedEquationId} onValueChange={handleEquationChange}>
              <SelectTrigger className="w-full md:w-96 bg-[#1a1f2e] border-gray-700 text-white" data-testid="select-equation">
                <SelectValue placeholder="Select equation..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1f2e] border-gray-700">
                {FORGE_LAB_EQUATIONS.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id} className="text-white hover:bg-gray-800">
                    {eq.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEquation && (
              <p className="mt-3 text-sm text-gray-400">{selectedEquation.description}</p>
            )}
          </CardContent>
        </Card>

        {selectedEquation && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Card className="bg-[#141824] border-gray-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Badge className="bg-orange-600 text-white">Inputs</Badge>
                      </CardTitle>
                      <CardDescription className="text-gray-400 mt-1">
                        Adjust the input parameters using sliders or direct input
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-purple-600 text-purple-400 hover:bg-purple-600/20"
                            data-testid="button-save-preset"
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Save Preset
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#141824] border-gray-700">
                          <DialogHeader>
                            <DialogTitle className="text-white">Save Preset</DialogTitle>
                            <DialogDescription className="text-gray-400">
                              Give this configuration a name so you can load it later.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <Label className="text-gray-300">Preset Name</Label>
                            <Input
                              value={presetName}
                              onChange={(e) => setPresetName(e.target.value)}
                              placeholder="e.g., Ja'Marr Chase Baseline"
                              className="mt-2 bg-[#1a1f2e] border-gray-700 text-white"
                              data-testid="input-preset-name"
                              onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                            />
                          </div>
                          <DialogFooter>
                            <Button
                              variant="ghost"
                              onClick={() => { setSaveDialogOpen(false); setPresetName(''); }}
                              className="text-gray-400"
                              data-testid="button-cancel-save"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleSavePreset}
                              className="bg-purple-600 hover:bg-purple-700"
                              data-testid="button-confirm-save"
                            >
                              Save Preset
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {presetsForCurrentEquation.length > 0 && (
                    <div className="bg-[#0a0e1a] rounded-lg p-4 border border-gray-800">
                      <div className="flex items-center gap-2 mb-3">
                        <FolderOpen className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium text-gray-300">Saved Presets</span>
                        <Badge className="bg-blue-600/30 text-blue-300 text-xs">{presetsForCurrentEquation.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {presetsForCurrentEquation.map((preset) => (
                          <div
                            key={preset.id}
                            className="flex items-center justify-between bg-[#141824] rounded px-3 py-2 border border-gray-700 group"
                          >
                            <div className="flex-1">
                              <span className="text-sm text-white">{preset.title}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                {new Date(preset.savedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleLoadPreset(preset.id)}
                                className="h-7 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-600/20"
                                data-testid={`button-load-preset-${preset.id}`}
                              >
                                Load
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePreset(preset.id)}
                                className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-600/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                data-testid={`button-delete-preset-${preset.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedEquation.inputs.map((inputDef) => (
                    <InputSlider
                      key={inputDef.key}
                      def={inputDef}
                      value={inputValues[inputDef.key] ?? inputDef.defaultValue}
                      onChange={(val) => handleInputChange(inputDef.key, val)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <OutputCard outputs={computeResult.outputs} />
              {selectedEquationId === 'WR_CORE_ALPHA' && (
                <PlayerMatchesCard inputs={inputValues} />
              )}
              <StepsCard steps={computeResult.steps} />
              <JsonExportCard inputs={inputValues} outputs={computeResult.outputs} />
            </div>
          </div>
        )}

        {/* TODO: Player-Linked Mode
          Future enhancement: Add player dropdown to auto-fetch input defaults from FORGE context APIs.
          This will allow testing equations with real player data.
        */}
      </div>
    </div>
  );
}
