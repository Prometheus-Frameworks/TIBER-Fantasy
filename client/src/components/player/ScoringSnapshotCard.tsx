import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ScoringResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string }
  | null
  | undefined;

export interface PlayerCardSnapshot {
  expectedPoints: number | null;
  vorp: number | null;
  floor: number | null;
  median: number | null;
  ceiling: number | null;
  confidence: string | null;
  volatility: string | null;
  fragility: string | null;
  weeklyOutlook: string | null;
  roleSummary: string | null;
  valueSummary: string | null;
  roleNotes: string[];
}

function fmt(value: number | null | undefined) {
  return value == null ? '—' : value.toFixed(1);
}

function toneClass(label: string | null | undefined) {
  if (!label) return 'border-slate-600/50 text-slate-300 bg-slate-700/30';
  const lower = label.toLowerCase();
  if (lower.includes('high') || lower.includes('strong')) return 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10';
  if (lower.includes('low') || lower.includes('fragile')) return 'border-amber-500/40 text-amber-300 bg-amber-500/10';
  return 'border-blue-500/40 text-blue-300 bg-blue-500/10';
}

export function ScoringSnapshotCard({ weekly, ros }: { weekly: ScoringResult<PlayerCardSnapshot>; ros?: ScoringResult<PlayerCardSnapshot> }) {
  if (!weekly) return null;

  if (!weekly.ok) {
    return (
      <div className="bg-[#141824] border border-amber-500/30 rounded-xl p-4 text-sm text-amber-100">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle size={14} />
          Scoring unavailable
        </div>
        <p className="mt-2 text-xs text-amber-200/90">{weekly.message}</p>
      </div>
    );
  }

  const card = weekly.data;
  const rosCard = ros && ros.ok ? ros.data : null;

  return (
    <div className="bg-[#141824] border border-gray-800/50 rounded-xl p-4 space-y-3" data-testid="player-scoring-snapshot">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Live scoring snapshot</h3>
        <div className="flex gap-1">
          {[card.confidence, card.volatility, card.fragility].filter(Boolean).map((tag) => (
            <Badge key={tag} variant="outline" className={`text-[10px] ${toneClass(tag)}`}>
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="rounded bg-slate-900/40 p-2"><div className="text-slate-400">Expected</div><div className="text-white font-mono">{fmt(card.expectedPoints)}</div></div>
        <div className="rounded bg-slate-900/40 p-2"><div className="text-slate-400">VORP</div><div className="text-white font-mono">{fmt(card.vorp)}</div></div>
        <div className="rounded bg-slate-900/40 p-2"><div className="text-slate-400">Floor / Med</div><div className="text-white font-mono">{fmt(card.floor)} / {fmt(card.median)}</div></div>
        <div className="rounded bg-slate-900/40 p-2"><div className="text-slate-400">Ceiling</div><div className="text-white font-mono">{fmt(card.ceiling)}</div></div>
      </div>
      <div className="text-xs text-slate-300 space-y-1">
        <p><span className="text-slate-400">Weekly outlook:</span> {card.weeklyOutlook ?? '—'}</p>
        <p><span className="text-slate-400">Role summary:</span> {card.roleSummary ?? '—'}</p>
        <p><span className="text-slate-400">Value summary:</span> {card.valueSummary ?? '—'}</p>
        {card.roleNotes.length > 0 && <p><span className="text-slate-400">Role notes:</span> {card.roleNotes.join(' · ')}</p>}
        {rosCard && <p><span className="text-slate-400">ROS expected:</span> {fmt(rosCard.expectedPoints)} ({rosCard.valueSummary ?? 'no ROS note'})</p>}
      </div>
    </div>
  );
}
