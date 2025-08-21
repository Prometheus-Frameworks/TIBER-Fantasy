import { useEffect, useState } from 'react';
import SOSTable from '../components/sos/SOSTable';
import SOSLegend from '../components/sos/SOSLegend';

type WeeklyItem = { team:string; position:string; week:number; opponent:string; sos_score:number; tier:'green'|'yellow'|'red' };

export default function SOSPage() {
  const [position, setPosition] = useState<'RB'|'WR'|'QB'|'TE'>('RB');
  const [week, setWeek] = useState<number>(1);
  const [items, setItems] = useState<WeeklyItem[]>([]);

  useEffect(() => {
    fetch(`/api/sos/weekly?position=${position}&week=${week}`)
      .then(r => r.json())
      .then(d => setItems(d.items || []))
      .catch(() => setItems([]));
  }, [position, week]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-4">Strength of Schedule (Weekly)</h1>
      <div className="flex gap-3 mb-4">
        <select className="border rounded px-2 py-1" value={position} onChange={e => setPosition(e.target.value as any)}>
          <option>RB</option><option>WR</option><option>QB</option><option>TE</option>
        </select>
        <input className="border rounded px-2 py-1 w-24" type="number" value={week} min={1} max={18} onChange={e => setWeek(parseInt(e.target.value || '1',10))} />
      </div>
      <SOSLegend />
      <SOSTable items={items} />
    </div>
  );
}