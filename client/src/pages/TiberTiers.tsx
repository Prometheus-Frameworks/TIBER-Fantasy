import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Search, Crown } from 'lucide-react';

type Position = 'WR' | 'RB' | 'TE' | 'QB';
type ScoringFormat = 'ppr' | 'half';
type SortColumn = 'fpts' | 'ppg' | 'volume' | 'efficiency' | 'gp' | 'recTds' | 'snapShare';
type SortDir = 'asc' | 'desc';

interface LabPlayer {
  playerId: string;
  playerName: string;
  teamId: string;
  position: string;
  gamesPlayed: number;
  totalFptsPpr: number;
  totalFptsHalf: number;
  totalFptsStd: number;
  avgEpaPerTarget?: number | null;
  avgEpaPerPlay?: number | null;
  avgEpaPerDropback?: number | null;
  avgSnapShare: number;
  avgTargetShare?: number | null;
  avgCatchRate?: number | null;
  avgAdot?: number | null;
  avgWopr?: number | null;
  yprr?: number | null;
  totalTargets?: number | null;
  totalReceptions?: number | null;
  totalRecYards?: number | null;
  totalRecTds?: number | null;
  totalRushAttempts?: number | null;
  totalRushYards?: number | null;
  totalRushTds?: number | null;
  totalRoutes?: number | null;
  totalDropbacks?: number | null;
  totalPassYards?: number | null;
  totalPassTds?: number | null;
  totalInterceptions?: number | null;
}

interface TieredPlayer extends LabPlayer {
  fpts: number;
  ppg: number;
  tier: { label: string; cls: string; rank: number };
}

const TIER_THRESHOLDS: Record<Position, number[]> = {
  WR: [18, 14, 10, 6],
  RB: [17, 13, 9, 5],
  QB: [22, 18, 14, 10],
  TE: [14, 10, 7, 4],
};

const TIER_DEFS = [
  { label: 'T1 Elite', cls: 'tier-1', rank: 1 },
  { label: 'T2 Core', cls: 'tier-2', rank: 2 },
  { label: 'T3 Flex', cls: 'tier-3', rank: 3 },
  { label: 'T4 Stash', cls: 'tier-4', rank: 4 },
  { label: 'T5 Depth', cls: 'tier-5', rank: 5 },
];

const TIER_DIVIDER_STYLES: Record<number, { border: string; bg: string; text: string }> = {
  1: { border: 'var(--ember)', bg: 'rgba(226,100,13,0.06)', text: 'var(--ember)' },
  2: { border: 'var(--text-primary)', bg: 'rgba(10,10,10,0.03)', text: 'var(--text-primary)' },
  3: { border: 'var(--text-secondary)', bg: 'rgba(10,10,10,0.02)', text: 'var(--text-secondary)' },
  4: { border: 'var(--text-tertiary)', bg: 'transparent', text: 'var(--text-tertiary)' },
  5: { border: 'var(--text-tertiary)', bg: 'transparent', text: 'var(--text-tertiary)' },
};

function getPpgTier(ppg: number, pos: Position): TieredPlayer['tier'] {
  const t = TIER_THRESHOLDS[pos];
  if (ppg >= t[0]) return TIER_DEFS[0];
  if (ppg >= t[1]) return TIER_DEFS[1];
  if (ppg >= t[2]) return TIER_DEFS[2];
  if (ppg >= t[3]) return TIER_DEFS[3];
  return TIER_DEFS[4];
}

function getEfficiency(p: LabPlayer): number | null {
  if (p.position === 'WR' || p.position === 'TE') return p.avgEpaPerTarget ?? null;
  if (p.position === 'RB') return p.avgEpaPerPlay ?? null;
  return p.avgEpaPerDropback ?? p.avgEpaPerPlay ?? null;
}

function getEffLabel(pos: Position): string {
  if (pos === 'WR' || pos === 'TE') return 'EPA/Tgt';
  if (pos === 'RB') return 'EPA/Play';
  return 'EPA/Drop';
}

function getVolume(p: LabPlayer): number | null {
  if (p.position === 'WR' || p.position === 'TE') return p.totalTargets ?? null;
  if (p.position === 'RB') return p.totalRushAttempts ?? null;
  return p.totalDropbacks ?? null;
}

function getVolLabel(pos: Position): string {
  if (pos === 'WR' || pos === 'TE') return 'Targets';
  if (pos === 'RB') return 'Carries';
  return 'Att';
}

function getSecondary(p: LabPlayer): { label: string; value: string } {
  if (p.position === 'WR') return { label: 'YPRR', value: p.yprr != null ? p.yprr.toFixed(2) : '—' };
  if (p.position === 'TE') return { label: 'Catch%', value: p.avgCatchRate != null ? (p.avgCatchRate * 100).toFixed(1) + '%' : '—' };
  if (p.position === 'RB') return { label: 'Rush Yds', value: p.totalRushYards != null ? String(p.totalRushYards) : '—' };
  return { label: 'Pass Yds', value: p.totalPassYards != null ? String(p.totalPassYards) : '—' };
}

function getSecLabel(pos: Position): string {
  if (pos === 'WR') return 'YPRR';
  if (pos === 'TE') return 'Catch%';
  if (pos === 'RB') return 'Rush Yds';
  return 'Pass Yds';
}

function getTds(p: LabPlayer): number {
  if (p.position === 'QB') return (p.totalPassTds ?? 0);
  return (p.totalRecTds ?? 0) + (p.totalRushTds ?? 0);
}

function getTdLabel(pos: Position): string {
  if (pos === 'QB') return 'Pass TD';
  return 'TDs';
}

const fmtDec = (v: number | null | undefined, d = 2): string => v != null ? v.toFixed(d) : '—';

export default function TiberTiers() {
  const [position, setPosition] = useState<Position>('WR');
  const [scoring, setScoring] = useState<ScoringFormat>('ppr');
  const [sortCol, setSortCol] = useState<SortColumn>('fpts');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const { data: labData, isLoading } = useQuery<{ data: LabPlayer[]; count: number }>({
    queryKey: ['/api/data-lab/lab-agg', position],
    queryFn: () =>
      fetch(`/api/data-lab/lab-agg?season=2025&position=${position}&limit=150`)
        .then(r => r.json()),
  });

  const players = useMemo(() => {
    const raw = labData?.data || [];
    return raw
      .filter(p => p.gamesPlayed >= 4)
      .map(p => {
        const fpts = scoring === 'ppr' ? p.totalFptsPpr : p.totalFptsHalf;
        const ppg = fpts / Math.max(p.gamesPlayed, 1);
        return { ...p, fpts, ppg, tier: getPpgTier(ppg, position) } as TieredPlayer;
      });
  }, [labData, scoring, position]);

  const sorted = useMemo(() => {
    let list = [...players];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.playerName.toLowerCase().includes(q) || p.teamId.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let aVal = 0, bVal = 0;
      switch (sortCol) {
        case 'fpts': aVal = a.fpts; bVal = b.fpts; break;
        case 'ppg': aVal = a.ppg; bVal = b.ppg; break;
        case 'volume': aVal = getVolume(a) ?? 0; bVal = getVolume(b) ?? 0; break;
        case 'efficiency': aVal = getEfficiency(a) ?? 0; bVal = getEfficiency(b) ?? 0; break;
        case 'gp': aVal = a.gamesPlayed; bVal = b.gamesPlayed; break;
        case 'recTds': aVal = getTds(a); bVal = getTds(b); break;
        case 'snapShare': aVal = a.avgSnapShare; bVal = b.avgSnapShare; break;
      }
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return list;
  }, [players, search, sortCol, sortDir]);

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const tierGroups = useMemo(() => {
    const groups: { tier: typeof TIER_DEFS[0]; players: TieredPlayer[] }[] = [];
    let currentTier: number | null = null;
    for (const p of sorted) {
      if (p.tier.rank !== currentTier) {
        currentTier = p.tier.rank;
        groups.push({ tier: p.tier, players: [p] });
      } else {
        groups[groups.length - 1].players.push(p);
      }
    }
    return groups;
  }, [sorted]);

  const exportCsv = () => {
    if (!sorted.length) return;
    const headers = ['Rank', 'Player', 'Team', 'Pos', 'Tier', 'FPTS', 'PPG', getVolLabel(position), getEffLabel(position), getSecLabel(position), getTdLabel(position), 'Snap%', 'GP'];
    let rank = 0;
    const rows = sorted.map(p => {
      rank++;
      const eff = getEfficiency(p);
      const vol = getVolume(p);
      const sec = getSecondary(p);
      return [
        rank, p.playerName, p.teamId, p.position, p.tier.label,
        Math.round(p.fpts), p.ppg.toFixed(1),
        vol ?? '', eff != null ? eff.toFixed(3) : '',
        sec.value, getTds(p),
        (p.avgSnapShare * 100).toFixed(1) + '%', p.gamesPlayed,
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiber-tiers-${position}-${scoring}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ col, label, className = '' }: { col: SortColumn; label: string; className?: string }) => (
    <th className={`ar ${className}`} onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {label}
        {sortCol === col
          ? sortDir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />
          : <ArrowUpDown size={10} style={{ opacity: 0.3 }} />}
      </span>
    </th>
  );

  const rankedGroups = useMemo(() => {
    let rank = 0;
    return tierGroups.map(group => ({
      ...group,
      players: group.players.map(p => ({ ...p, rank: ++rank })),
    }));
  }, [tierGroups]);

  return (
    <>
      <div className="tiber-hero" style={{ paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Crown size={22} style={{ color: 'var(--ember)' }} />
          <div>
            <div className="hero-title" style={{ fontSize: 28 }}>FORGE Tiers</div>
            <div className="hero-sub" style={{ fontSize: 13 }}>PPG-driven rankings across {position} · {scoring.toUpperCase()} scoring</div>
          </div>
        </div>
      </div>

      <div className="tiber-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {(['WR', 'RB', 'QB', 'TE'] as Position[]).map(pos => (
            <button
              key={pos}
              className={`tool-btn ${position === pos ? 'active' : ''}`}
              onClick={() => { setPosition(pos); setSortCol('fpts'); setSortDir('desc'); setSearch(''); }}
            >
              {pos}
            </button>
          ))}

          <span style={{ width: 1, height: 20, background: 'var(--border-line)', margin: '0 4px' }} />

          {(['ppr', 'half'] as ScoringFormat[]).map(fmt => (
            <button
              key={fmt}
              className={`tool-btn ${scoring === fmt ? 'active' : ''}`}
              onClick={() => setScoring(fmt)}
              style={{ fontSize: 11, padding: '4px 10px', minHeight: 'auto', minWidth: 'auto' }}
            >
              {fmt === 'ppr' ? 'PPR' : 'Half'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              className="toolbar-search"
              placeholder="Search players..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            className="tool-btn"
            onClick={exportCsv}
            disabled={!sorted.length}
            style={{ fontSize: 11, padding: '4px 10px', minHeight: 'auto', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
            title="Export CSV"
          >
            <Download size={12} />
            CSV
          </button>
        </div>
      </div>

      <div className="tiber-content stagger-children">
        <div className="status-row">
          <div className="status-card">
            <div className="status-label">Qualifying Players</div>
            <div className="status-value">{players.length}</div>
            <div className="status-sub">{position} · 4+ games played</div>
          </div>
          <div className="status-card">
            <div className="status-label">T1 Elite</div>
            <div className="status-value" style={{ color: 'var(--ember)' }}>
              {players.filter(p => p.tier.rank === 1).length}
            </div>
            <div className="status-sub">{scoring === 'ppr' ? 'PPR' : 'Half PPR'} · {TIER_THRESHOLDS[position][0]}+ PPG</div>
          </div>
          <div className="status-card">
            <div className="status-label">T2 Core</div>
            <div className="status-value">
              {players.filter(p => p.tier.rank === 2).length}
            </div>
            <div className="status-sub">{TIER_THRESHOLDS[position][1]}–{TIER_THRESHOLDS[position][0]} PPG</div>
          </div>
          <div className="status-card">
            <div className="status-label">Avg PPG</div>
            <div className="status-value">
              {players.length > 0 ? (players.reduce((s, p) => s + p.ppg, 0) / players.length).toFixed(1) : '—'}
            </div>
            <div className="status-sub">Position group average</div>
          </div>
        </div>

        <div className="section-header">
          <div className="section-title">
            <span className="section-dot" />
            Tier Rankings — {position}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {sorted.length} players · sorted by {sortCol === 'fpts' ? 'FPTS' : sortCol === 'ppg' ? 'PPG' : sortCol}
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Player</th>
                <th>Tier</th>
                <SortHeader col="fpts" label="FPTS" />
                <SortHeader col="ppg" label="PPG" />
                <SortHeader col="volume" label={getVolLabel(position)} />
                <SortHeader col="efficiency" label={getEffLabel(position)} />
                <th className="ar">{getSecLabel(position)}</th>
                <SortHeader col="recTds" label={getTdLabel(position)} />
                <SortHeader col="snapShare" label="Snap%" />
                <SortHeader col="gp" label="GP" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i}>
                    <td className="mono dim">{i + 1}</td>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j}>
                        <div style={{ height: 14, width: j === 1 ? 120 : 40, background: 'var(--bg-tertiary)', borderRadius: 3, marginLeft: j > 2 ? 'auto' : undefined }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                    No players found
                  </td>
                </tr>
              ) : (
                rankedGroups.map(group => {
                  const style = TIER_DIVIDER_STYLES[group.tier.rank];
                  return [
                    <tr key={`tier-${group.tier.rank}`} className="tier-divider-row">
                      <td
                        colSpan={11}
                        style={{
                          padding: '10px 12px 6px',
                          borderBottom: `2px solid ${style.border}`,
                          background: style.bg,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className={`tier-badge ${group.tier.cls}`}
                            style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}
                          >
                            {group.tier.label}
                          </span>
                          <span style={{ fontSize: 11, color: style.text, fontFamily: 'var(--font-mono)' }}>
                            {group.players.length} player{group.players.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                    </tr>,
                    ...group.players.map(p => {
                      const eff = getEfficiency(p);
                      const vol = getVolume(p);
                      const sec = getSecondary(p);
                      const tds = getTds(p);
                      return (
                        <tr key={p.playerName + p.teamId}>
                          <td className="mono dim">{p.rank}</td>
                          <td>
                            <div className="player-cell">
                              <div className="player-name-cell">{p.playerName}</div>
                              <div className="player-meta">{p.position} · {p.teamId} · {p.gamesPlayed}G</div>
                            </div>
                          </td>
                          <td>
                            <span className={`tier-badge ${p.tier.cls}`}>{p.tier.label}</span>
                          </td>
                          <td className="ar mono">{Math.round(p.fpts)}</td>
                          <td className="ar mono" style={{ color: 'var(--ember)', fontWeight: 600 }}>{p.ppg.toFixed(1)}</td>
                          <td className="ar mono dim">{vol ?? '—'}</td>
                          <td className="ar mono dim">{fmtDec(eff, 3)}</td>
                          <td className="ar mono dim">{sec.value}</td>
                          <td className="ar mono dim">{tds}</td>
                          <td className="ar mono dim">{(p.avgSnapShare * 100).toFixed(1)}%</td>
                          <td className="ar mono dim">{p.gamesPlayed}</td>
                        </tr>
                      );
                    }),
                  ];
                }).flat()
              )}
            </tbody>
          </table>
        </div>

        <div className="two-col" style={{ marginTop: 24 }}>
          <div>
            <div className="section-header">
              <div className="section-title">
                <span className="section-dot" />
                Tier Definitions
              </div>
            </div>
            <div className="insight-card">
              <table style={{ width: '100%', fontSize: 12, fontFamily: 'var(--font-body)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-line)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--text-tertiary)', fontWeight: 500, fontSize: 11 }}>Tier</th>
                    <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--text-tertiary)', fontWeight: 500, fontSize: 11 }}>PPG Threshold</th>
                    <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--text-tertiary)', fontWeight: 500, fontSize: 11 }}>Dynasty Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { tier: TIER_DEFS[0], desc: 'Untouchable — only sell for elite hauls' },
                    { tier: TIER_DEFS[1], desc: 'Core starters — build around these assets' },
                    { tier: TIER_DEFS[2], desc: 'Weekly flex plays — buy low targets' },
                    { tier: TIER_DEFS[3], desc: 'Hold for upside — monitor closely' },
                    { tier: TIER_DEFS[4], desc: 'Roster fringe — drop if bench space needed' },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--bg-tertiary)' }}>
                      <td style={{ padding: '8px 0' }}>
                        <span className={`tier-badge ${row.tier.cls}`}>{row.tier.label}</span>
                      </td>
                      <td style={{ padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {i < 4 ? `${TIER_THRESHOLDS[position][i]}+ PPG` : `< ${TIER_THRESHOLDS[position][3]} PPG`}
                      </td>
                      <td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>
                        {row.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="section-header">
              <div className="section-title">
                <span className="section-dot" />
                Methodology
              </div>
            </div>
            <div className="insight-card">
              <div className="insight-body" style={{ lineHeight: 1.7 }}>
                Tiers are computed from <strong>PPG (points per game)</strong> using
                position-specific thresholds calibrated for {scoring === 'ppr' ? 'full PPR' : 'half-PPR'} scoring.
                Only players with 4+ games qualify. Rankings are powered by the Data Lab aggregation
                pipeline, which processes snap-level NFL data across all 18 weeks of the 2025 season.
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href="/forge-workbench" className="tool-btn" style={{ fontSize: 11, padding: '4px 10px', minHeight: 'auto', minWidth: 'auto', textDecoration: 'none' }}>
                  FORGE Workbench
                </Link>
                <Link href="/tiber-data-lab" className="tool-btn" style={{ fontSize: 11, padding: '4px 10px', minHeight: 'auto', minWidth: 'auto', textDecoration: 'none' }}>
                  Data Lab
                </Link>
              </div>
            </div>
          </div>
        </div>

        <footer className="app-footer">
          <div className="footer-left">
            <span>TIBER v2.1</span>
            <span>·</span>
            <span>FORGE Tiers · {position} · {scoring.toUpperCase()}</span>
          </div>
          <div className="footer-right">
            <Link href="/" className="footer-link">Dashboard</Link>
            <Link href="/forge-workbench" className="footer-link">Workbench</Link>
            <Link href="/tiber-data-lab" className="footer-link">Data Lab</Link>
          </div>
        </footer>
      </div>
    </>
  );
}
