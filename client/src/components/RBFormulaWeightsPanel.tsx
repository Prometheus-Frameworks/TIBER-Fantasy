import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface RBWeights {
  volume: number;
  efficiency: number;
  roleLeverage: number;
  stability: number;
  contextFit: number;
}

interface RBFormulaWeightsPanelProps {
  weights: RBWeights;
  onWeightsChange: (weights: RBWeights) => void;
  defaultCollapsed?: boolean;
}

const DEFAULT_RB_WEIGHTS: RBWeights = {
  volume: 38,
  efficiency: 25,
  roleLeverage: 20,
  stability: 12,
  contextFit: 5,
};

const RB_PRESETS = [
  { id: 'forge-default', label: 'FORGE Default', weights: { volume: 38, efficiency: 25, roleLeverage: 20, stability: 12, contextFit: 5 } },
  { id: 'workhorse', label: 'Workhorse', weights: { volume: 50, efficiency: 20, roleLeverage: 15, stability: 10, contextFit: 5 } },
  { id: 'dual-threat', label: 'Dual Threat', weights: { volume: 30, efficiency: 30, roleLeverage: 25, stability: 10, contextFit: 5 } },
  { id: 'efficiency', label: 'Efficiency Hunter', weights: { volume: 25, efficiency: 40, roleLeverage: 15, stability: 15, contextFit: 5 } },
  { id: 'situation', label: 'Situation Dependent', weights: { volume: 30, efficiency: 20, roleLeverage: 20, stability: 15, contextFit: 15 } },
];

export default function RBFormulaWeightsPanel({
  weights,
  onWeightsChange,
  defaultCollapsed = false,
}: RBFormulaWeightsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [activePreset, setActivePreset] = useState<string>('forge-default');

  const totalWeight = weights.volume + weights.efficiency + weights.roleLeverage + weights.stability + weights.contextFit;
  const isValidTotal = totalWeight === 100;

  const handleSliderChange = (field: keyof RBWeights, value: number[]) => {
    onWeightsChange({ ...weights, [field]: value[0] });
    setActivePreset('custom');
  };

  const applyPreset = (presetId: string) => {
    const preset = RB_PRESETS.find(p => p.id === presetId);
    if (preset) {
      onWeightsChange(preset.weights);
      setActivePreset(presetId);
    }
  };

  const resetToDefaults = () => {
    onWeightsChange(DEFAULT_RB_WEIGHTS);
    setActivePreset('forge-default');
  };

  return (
    <div className="bg-[#141824] border border-slate-700 rounded-xl mb-6">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors rounded-t-xl"
        data-testid="toggle-rb-weights-panel"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">Sandbox Formula Weights</h3>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
            {isValidTotal ? 'Valid (100%)' : `⚠️ ${totalWeight}%`}
          </span>
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        )}
      </button>

      {!isCollapsed && (
        <div className="p-4 pt-0 space-y-4">
          <p className="text-xs text-slate-500 border-l-2 border-green-500/50 pl-3">
            These weights describe how we think about RBs (volume, efficiency, role leverage, stability, context). 
            <span className="text-purple-400">FORGE</span> uses a more complex internal formula, but this panel shows the philosophy behind it.
          </p>

          <div className="flex flex-wrap gap-2">
            {RB_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  activePreset === preset.id
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                data-testid={`rb-preset-${preset.id}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300">Volume</label>
                <span className="text-sm font-mono text-blue-400">{weights.volume}%</span>
              </div>
              <Slider
                value={[weights.volume]}
                onValueChange={(v) => handleSliderChange('volume', v)}
                min={0}
                max={100}
                step={1}
                className="w-full"
                data-testid="rb-slider-volume"
              />
              <p className="text-xs text-slate-500">Carries, touches, opportunity share</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300">Efficiency</label>
                <span className="text-sm font-mono text-green-400">{weights.efficiency}%</span>
              </div>
              <Slider
                value={[weights.efficiency]}
                onValueChange={(v) => handleSliderChange('efficiency', v)}
                min={0}
                max={100}
                step={1}
                className="w-full"
                data-testid="rb-slider-efficiency"
              />
              <p className="text-xs text-slate-500">YPC, FP per touch, success rate</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300">Role Leverage</label>
                <span className="text-sm font-mono text-yellow-400">{weights.roleLeverage}%</span>
              </div>
              <Slider
                value={[weights.roleLeverage]}
                onValueChange={(v) => handleSliderChange('roleLeverage', v)}
                min={0}
                max={100}
                step={1}
                className="w-full"
                data-testid="rb-slider-role"
              />
              <p className="text-xs text-slate-500">Snap share, receiving work, goal line</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300">Stability</label>
                <span className="text-sm font-mono text-purple-400">{weights.stability}%</span>
              </div>
              <Slider
                value={[weights.stability]}
                onValueChange={(v) => handleSliderChange('stability', v)}
                min={0}
                max={100}
                step={1}
                className="w-full"
                data-testid="rb-slider-stability"
              />
              <p className="text-xs text-slate-500">Week-to-week consistency, floor</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300">Context Fit</label>
                <span className="text-sm font-mono text-orange-400">{weights.contextFit}%</span>
              </div>
              <Slider
                value={[weights.contextFit]}
                onValueChange={(v) => handleSliderChange('contextFit', v)}
                min={0}
                max={100}
                step={1}
                className="w-full"
                data-testid="rb-slider-context"
              />
              <p className="text-xs text-slate-500">Team environment, O-line, game script</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-700">
            <div className="text-xs text-slate-500">
              Total: <span className={isValidTotal ? 'text-green-400' : 'text-red-400'}>{totalWeight}%</span>
              {!isValidTotal && ' (should equal 100%)'}
            </div>
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300 transition-colors"
              data-testid="rb-reset-weights"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
