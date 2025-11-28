import { useState } from 'react';
import { Info, ChevronDown, ChevronUp, Database, Cpu, GitBranch } from 'lucide-react';

type Position = 'WR' | 'RB' | 'TE' | 'QB';

interface ForgeTransparencyPanelProps {
  position: Position;
}

const DATA_SOURCES: Record<Position, string[]> = {
  WR: [
    'nflfastR weekly_stats (targets, receptions, yards, TDs)',
    'Sleeper player data (projections, ADP, ownership)',
    'Player identity map (cross-platform ID resolution)',
    'OASIS team environment (pace, PROE, O-line grade)',
    'Defense vs Position matchups (DvP rankings)',
  ],
  RB: [
    'nflfastR weekly_stats (carries, rush yards, targets, receptions)',
    'Sleeper player data (projections, snap counts)',
    'Player identity map (cross-platform ID resolution)', 
    'OASIS team environment (run scheme, O-line grade)',
    'Defense vs Position matchups (DvP rankings)',
  ],
  TE: [
    'nflfastR weekly_stats (targets, routes, alignment data)',
    'Sleeper player data (snap counts, route participation)',
    'Player identity map (cross-platform ID resolution)',
    'OASIS team environment (TE usage patterns)',
    'Defense vs Position matchups (DvP rankings)',
  ],
  QB: [
    'nflfastR weekly_stats (pass attempts, completions, TDs, INTs)',
    'Sleeper player data (rushing stats, projections)',
    'Player identity map (cross-platform ID resolution)',
    'OASIS team environment (pace, scheme, protection grade)',
    'Defense vs Position matchups (DvP rankings)',
  ],
};

const FORGE_WEIGHTS: Record<Position, { name: string; weight: number; color: string }[]> = {
  WR: [
    { name: 'Volume', weight: 35, color: 'text-blue-400' },
    { name: 'Efficiency', weight: 30, color: 'text-green-400' },
    { name: 'Role Leverage', weight: 18, color: 'text-yellow-400' },
    { name: 'Stability', weight: 12, color: 'text-purple-400' },
    { name: 'Context Fit', weight: 5, color: 'text-orange-400' },
  ],
  RB: [
    { name: 'Volume', weight: 38, color: 'text-blue-400' },
    { name: 'Efficiency', weight: 25, color: 'text-green-400' },
    { name: 'Role Leverage', weight: 20, color: 'text-yellow-400' },
    { name: 'Stability', weight: 12, color: 'text-purple-400' },
    { name: 'Context Fit', weight: 5, color: 'text-orange-400' },
  ],
  TE: [
    { name: 'Volume', weight: 30, color: 'text-blue-400' },
    { name: 'Efficiency', weight: 28, color: 'text-green-400' },
    { name: 'Role Leverage', weight: 25, color: 'text-yellow-400' },
    { name: 'Stability', weight: 10, color: 'text-purple-400' },
    { name: 'Context Fit', weight: 7, color: 'text-orange-400' },
  ],
  QB: [
    { name: 'Volume', weight: 25, color: 'text-blue-400' },
    { name: 'Efficiency', weight: 35, color: 'text-green-400' },
    { name: 'Role Leverage', weight: 15, color: 'text-yellow-400' },
    { name: 'Stability', weight: 10, color: 'text-purple-400' },
    { name: 'Context Fit', weight: 15, color: 'text-orange-400' },
  ],
};

export default function ForgeTransparencyPanel({ position }: ForgeTransparencyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const sources = DATA_SOURCES[position];
  const weights = FORGE_WEIGHTS[position];

  return (
    <div className="bg-[#141824] border border-slate-700 rounded-xl mt-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors rounded-xl"
        data-testid="toggle-transparency-panel"
      >
        <div className="flex items-center gap-3">
          <Info className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Algorithm Transparency</h3>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
            FORGE v0.2
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-slate-400" />
                <h4 className="text-sm font-medium text-slate-300">Data Sources</h4>
              </div>
              <ul className="space-y-1.5">
                {sources.map((source, idx) => (
                  <li key={idx} className="text-xs text-slate-500 flex items-start gap-2">
                    <span className="text-slate-600 mt-0.5">•</span>
                    {source}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-slate-400" />
                <h4 className="text-sm font-medium text-slate-300">FORGE {position} Weights</h4>
              </div>
              <div className="space-y-2">
                {weights.map((w) => (
                  <div key={w.name} className="flex items-center gap-2">
                    <div className="w-24 text-xs text-slate-400">{w.name}</div>
                    <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
                        style={{ width: `${w.weight}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono ${w.color}`}>{w.weight}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-slate-400" />
              <h4 className="text-sm font-medium text-slate-300">How FORGE α Works</h4>
            </div>
            
            <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-700/50">
              <div className="text-sm font-medium text-purple-400 mb-2">Displayed Rankings = FORGE α (Calibrated)</div>
              <p className="text-xs text-slate-400 mb-3">
                The rankings shown above are powered by the FORGE engine, our production scoring system. 
                FORGE processes raw player data through position-specific feature extraction, then calibrates 
                scores to a 0-100 scale for intuitive comparison.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="bg-slate-800/50 px-2 py-1 rounded text-slate-400">
                  1. Feature extraction from play-by-play data
                </div>
                <div className="bg-slate-800/50 px-2 py-1 rounded text-slate-400">
                  2. Position-specific weighting
                </div>
                <div className="bg-slate-800/50 px-2 py-1 rounded text-slate-400">
                  3. Percentile calibration (p10→25, p90→90)
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
              <div className="text-xs text-slate-500">
                <span className="text-slate-400 font-medium">Note:</span> The Sandbox model is our internal tuning environment 
                used during development. Sandbox scores may differ from what's displayed and are not shown to users.
              </div>
            </div>

            <div className="text-xs text-slate-600 text-center">
              Engine: FORGE v0.2 ({position} calibrated) • Last updated: 2025 Season
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
