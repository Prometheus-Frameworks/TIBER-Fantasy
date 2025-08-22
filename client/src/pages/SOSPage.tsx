import { useEffect, useState } from 'react';
import SOSTable from '../components/sos/SOSTable';
import SOSLegend from '../components/sos/SOSLegend';
import { SOSBarChart } from '../components/SOSBarChart';

type WeeklyItem = { 
  team:string; 
  position:string; 
  week:number; 
  opponent:string; 
  sos_score:number; 
  tier:'green'|'yellow'|'red';
  components?: { FPA: number; EPA: number; PACE: number; RZ: number; VEN: string };
};

type ViewMode = "table" | "chart";

export default function SOSPage() {
  const [position, setPosition] = useState<'RB'|'WR'|'QB'|'TE'>('RB');
  const [week, setWeek] = useState<number>(1);
  const [season, setSeason] = useState<number>(2024);
  const [mode, setMode] = useState<'fpa'|'ctx'>('fpa');
  const [debug, setDebug] = useState<boolean>(false);
  const [view, setView] = useState<ViewMode>("table");
  const [items, setItems] = useState<WeeklyItem[]>([]);

  useEffect(() => {
    const url = `/api/sos/weekly?position=${position}&week=${week}&season=${season}&mode=${mode}${debug ? '&debug=1' : ''}&samples=1`;
    fetch(url)
      .then(r => r.json())
      .then(d => setItems(d.items || []))
      .catch(() => setItems([]));
  }, [position, week, season, mode, debug]);

  return (
    <div className="mx-auto max-w-5xl p-3 sm:p-6">
      <div className="text-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-2">Strength of Schedule (Weekly)</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-3 text-sm sm:text-base">
          Analyze matchup difficulty for each position with color-coded ease scores
        </p>
        <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center">
          <a 
            href="/sos/docs"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
          >
            📖 How SOS Scoring Works
          </a>
          <a 
            href="/sos-dashboard" 
            className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 underline"
          >
            🎛️ Customizable Dashboard
          </a>
        </div>
      </div>
      <div className="mb-4">
        {/* Desktop Layout */}
        <div className="hidden lg:block">
          {/* Control Labels */}
          <div className="flex gap-3 mb-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="w-24 text-center">
              <div className="font-semibold">Season</div>
              <div>Data completeness</div>
            </div>
            <div className="w-16 text-center">
              <div className="font-semibold">Position</div>
              <div>Skill positions</div>
            </div>
            <div className="w-24 text-center">
              <div className="font-semibold">Week</div>
              <div>NFL schedule</div>
            </div>
            <div className="w-32 text-center">
              <div className="font-semibold">Analysis Mode</div>
              <div>Scoring method</div>
            </div>
            <div className="w-16 text-center">
              <div className="font-semibold">Debug</div>
              <div>Show details</div>
            </div>
            <div className="w-20 text-center">
              <div className="font-semibold">View</div>
              <div>Display mode</div>
            </div>
          </div>
          
          {/* Control Descriptions */}
          <div className="flex gap-3 mb-2 text-xs text-slate-400 dark:text-slate-500">
            <div className="w-24 text-center">2024: Complete season | 2025: Live updates</div>
            <div className="w-16 text-center">Fantasy relevant</div>
            <div className="w-24 text-center">Regular season</div>
            <div className="w-32 text-center">FPA: Fantasy points allowed | CTX: Advanced metrics</div>
            <div className="w-16 text-center">Component breakdown</div>
            <div className="w-20 text-center">Table or chart</div>
          </div>
          
          {/* Desktop Controls */}
          <div className="flex gap-3 items-center">
            <select className="border rounded px-2 py-1 w-24" value={season} onChange={e => setSeason(parseInt(e.target.value))}>
              <option value={2024}>2024 (full)</option>
              <option value={2025}>2025 (live)</option>
            </select>
            <select className="border rounded px-2 py-1 w-16" value={position} onChange={e => setPosition(e.target.value as any)}>
              <option>RB</option><option>WR</option><option>QB</option><option>TE</option>
            </select>
            <input className="border rounded px-2 py-1 w-24" type="number" value={week} min={1} max={season === 2024 ? 17 : 18} onChange={e => setWeek(parseInt(e.target.value || '1',10))} />
            <select className="border rounded px-2 py-1 w-32" value={mode} onChange={e => setMode(e.target.value as any)}>
              <option value="fpa">FPA (v1)</option>
              <option value="ctx">Contextual (v2)</option>
            </select>
            <label className="flex items-center gap-2 text-sm w-16">
              <input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)} />
              Debug
            </label>
            <select className="border rounded px-2 py-1 w-20" value={view} onChange={e => setView(e.target.value as ViewMode)}>
              <option value="table">Table</option>
              <option value="chart">Chart</option>
            </select>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden space-y-3">
          <div className="text-center mb-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              FPA: Fantasy points allowed | CTX: Advanced metrics
            </p>
          </div>
          
          {/* Row 1: Season, Position, Week */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Season</label>
              <select className="w-full border rounded px-2 py-1 text-sm" value={season} onChange={e => setSeason(parseInt(e.target.value))}>
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Position</label>
              <select className="w-full border rounded px-2 py-1 text-sm" value={position} onChange={e => setPosition(e.target.value as any)}>
                <option>RB</option><option>WR</option><option>QB</option><option>TE</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Week</label>
              <input className="w-full border rounded px-2 py-1 text-sm" type="number" value={week} min={1} max={season === 2024 ? 17 : 18} onChange={e => setWeek(parseInt(e.target.value || '1',10))} />
            </div>
          </div>
          
          {/* Row 2: Mode, Debug, View */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Mode</label>
              <select className="w-full border rounded px-2 py-1 text-sm" value={mode} onChange={e => setMode(e.target.value as any)}>
                <option value="fpa">FPA</option>
                <option value="ctx">CTX</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Debug</label>
              <label className="flex items-center gap-2 text-sm border rounded px-2 py-1 justify-center bg-gray-50 dark:bg-gray-800">
                <input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)} />
                <span className="text-xs">Show</span>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">View</label>
              <select className="w-full border rounded px-2 py-1 text-sm" value={view} onChange={e => setView(e.target.value as ViewMode)}>
                <option value="table">Table</option>
                <option value="chart">Chart</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <SOSLegend />
      
      {view === "table" ? (
        <SOSTable items={items} debug={debug} position={position} />
      ) : (
        <SOSBarChart items={items.map((it: any) => ({
          team: it.team,
          opponent: it.opponent,
          sos_score: it.sos_score,
        }))} />
      )}
    </div>
  );
}