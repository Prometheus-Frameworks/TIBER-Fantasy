import { useEffect, useState } from 'react';
import SOSTable from '../components/sos/SOSTable';
import SOSLegend from '../components/sos/SOSLegend';

type WeeklyItem = { 
  team:string; 
  position:string; 
  week:number; 
  opponent:string; 
  sos_score:number; 
  tier:'green'|'yellow'|'red';
  components?: { FPA: number; EPA: number; PACE: number; RZ: number; VEN: string };
};

export default function SOSPage() {
  const [position, setPosition] = useState<'RB'|'WR'|'QB'|'TE'>('RB');
  const [week, setWeek] = useState<number>(1);
  const [mode, setMode] = useState<'fpa'|'ctx'>('fpa');
  const [debug, setDebug] = useState<boolean>(false);
  const [items, setItems] = useState<WeeklyItem[]>([]);

  useEffect(() => {
    const url = `/api/sos/weekly?position=${position}&week=${week}&mode=${mode}${debug ? '&debug=1' : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(d => setItems(d.items || []))
      .catch(() => setItems([]));
  }, [position, week, mode, debug]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-2">Strength of Schedule (Weekly)</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-3">
          Analyze matchup difficulty for each position with color-coded ease scores
        </p>
        <div className="mb-4 flex gap-4 justify-center">
          <a 
            href="/docs/SOS-how-it-works.md" 
            target="_blank"
            rel="noopener noreferrer"
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
      <div className="flex gap-3 mb-4 items-center">
        <select className="border rounded px-2 py-1" value={position} onChange={e => setPosition(e.target.value as any)}>
          <option>RB</option><option>WR</option><option>QB</option><option>TE</option>
        </select>
        <input className="border rounded px-2 py-1 w-24" type="number" value={week} min={1} max={18} onChange={e => setWeek(parseInt(e.target.value || '1',10))} />
        <select className="border rounded px-2 py-1" value={mode} onChange={e => setMode(e.target.value as any)}>
          <option value="fpa">FPA (v1)</option>
          <option value="ctx">Contextual (v2)</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)} />
          Debug
        </label>
      </div>
      <SOSLegend />
      <SOSTable items={items} debug={debug} />
    </div>
  );
}