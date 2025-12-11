import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Plus, MessageCircle, Trash2, Edit3, Save, X,
  TrendingUp, ArrowLeftRight, UserPlus, UserMinus,
  PlayCircle, FileText, Lightbulb, Send, Loader2,
  ChevronDown, ChevronRight, Crown, Calendar, BarChart3, CheckCircle2, Clock3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Link } from 'wouter';

type EntryType = 'roster_move' | 'trade' | 'waiver_add' | 'waiver_drop' | 'start_sit' | 'note' | 'insight';

type RegretSummaryResponse = {
  success: boolean;
  byType: {
    entry_type: EntryType;
    decisions_count: number;
    avg_regret: number | null;
    high_regret_rate: number | null;
    win_rate: number | null;
    loss_rate: number | null;
  }[];
  byWeek: {
    season: number;
    week: number;
    decisions_count: number;
    avg_regret: number | null;
  }[];
};

type PatternInsight = {
  id: string;
  severity: 'low' | 'medium' | 'high';
  label: string;
  description: string;
  entry_types?: EntryType[];
  season?: number | null;
  weeks?: number[] | null;
};

type PatternInsightsResponse = {
  success: boolean;
  insights: PatternInsight[];
};

interface PlaybookEntry {
  id: number;
  user_id: string;
  league_id: string | null;
  team_id: string | null;
  scoring_format: string | null;
  week: number | null;
  season: number | null;
  entry_type: EntryType;
  title: string;
  content: string;
  player_ids: string[] | null;
  metadata: {
    forgeAlpha?: Record<string, number>;
    tier?: Record<string, string>;
    linkedFeature?: string;
    tags?: string[];
    summary?: string;
  } | null;
  outcome: 'win' | 'loss' | 'push' | 'pending' | null;
  regret_score: number | null;
  resolved_at: string | null;
  forge_before: number | null;
  forge_after: number | null;
  tier_before: string | null;
  tier_after: string | null;
  created_at: string;
  updated_at: string;
}

type PlaybookContext = {
  leagueId?: string | null;
  teamId?: string | null;
  week?: number | null;
  season?: number | null;
  scoringFormat?: string | null;
};

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ENTRY_TYPE_CONFIG: Record<EntryType, { label: string; icon: typeof TrendingUp; color: string }> = {
  roster_move: { label: 'Roster Move', icon: PlayCircle, color: 'text-blue-400' },
  trade: { label: 'Trade', icon: ArrowLeftRight, color: 'text-purple-400' },
  waiver_add: { label: 'Waiver Add', icon: UserPlus, color: 'text-green-400' },
  waiver_drop: { label: 'Waiver Drop', icon: UserMinus, color: 'text-red-400' },
  start_sit: { label: 'Start/Sit', icon: TrendingUp, color: 'text-yellow-400' },
  note: { label: 'Note', icon: FileText, color: 'text-gray-400' },
  insight: { label: 'Insight', icon: Lightbulb, color: 'text-amber-400' }
};

const WAR_ROOM_SECTIONS: { key: EntryType; label: string }[] = [
  { key: 'trade', label: 'Pending Trades' },
  { key: 'start_sit', label: 'Pending Start/Sit' },
  { key: 'roster_move', label: 'Pending Roster Moves' },
  { key: 'waiver_add', label: 'Pending Waiver Adds' },
  { key: 'waiver_drop', label: 'Pending Waiver Drops' },
  { key: 'insight', label: 'Insights' },
  { key: 'note', label: 'Notes' }
];

const REVIEW_SECTIONS: { key: EntryType; label: string }[] = [
  { key: 'trade', label: 'Trades' },
  { key: 'start_sit', label: 'Start/Sit' },
  { key: 'roster_move', label: 'Roster Moves' },
  { key: 'waiver_add', label: 'Waiver Adds' },
  { key: 'waiver_drop', label: 'Waiver Drops' },
  { key: 'insight', label: 'Insights' },
  { key: 'note', label: 'Notes' }
];

function formatForgeSummary(forgeBefore: number | null, forgeAfter: number | null, tierBefore: string | null, tierAfter: string | null) {
  const beforeText = forgeBefore !== null && forgeBefore !== undefined ? forgeBefore : 'N/A';
  const afterText = forgeAfter !== null && forgeAfter !== undefined ? forgeAfter : 'N/A';
  const delta = forgeBefore !== null && forgeAfter !== null
    ? Number(forgeAfter - forgeBefore).toFixed(2)
    : 'N/A';
  const tierBeforeText = tierBefore ?? 'N/A';
  const tierAfterText = tierAfter ?? 'N/A';

  return `FORGE Change: ${beforeText} → ${afterText} (Δ ${delta}), Tier: ${tierBeforeText} → ${tierAfterText}`;
}

function WarRoomPanel({ leagueId, teamId, week, season }: PlaybookContext) {
  const { data, isLoading } = useQuery<{ success: boolean; entries: PlaybookEntry[] }>({
    queryKey: ['/api/playbook', 'war-room', leagueId, teamId, week, season],
    queryFn: async () => {
      const params = new URLSearchParams({ user_id: 'default_user', pending_only: 'true' });
      if (leagueId) params.append('league_id', leagueId);
      if (teamId) params.append('team_id', teamId);
      if (week !== null && week !== undefined) params.append('week', week.toString());
      if (season !== null && season !== undefined) params.append('season', season.toString());

      const res = await fetch(`/api/playbook?${params.toString()}`);
      return res.json();
    }
  });

  const entries = data?.entries || [];

  const grouped = entries.reduce<Record<EntryType, PlaybookEntry[]>>((acc, entry) => {
    if (!acc[entry.entry_type]) acc[entry.entry_type] = [] as PlaybookEntry[];
    acc[entry.entry_type].push(entry);
    return acc;
  }, {} as Record<EntryType, PlaybookEntry[]>);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-gray-800/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border border-dashed border-purple-500/30 rounded-xl">
          <p className="text-sm">No pending items yet.</p>
          <p className="text-xs mt-1 text-gray-600">New journal entries tagged to this context will show here.</p>
        </div>
      ) : (
        WAR_ROOM_SECTIONS.map((section) => {
          const sectionEntries = grouped[section.key] || [];
          if (sectionEntries.length === 0) return null;
          const config = ENTRY_TYPE_CONFIG[section.key];
          const Icon = config.icon;

          return (
            <div key={section.key} className="bg-[#0f1016] border border-gray-800/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Icon size={16} className={config.color} />
                <span>{section.label}</span>
              </div>
              <div className="space-y-2">
                {sectionEntries.map((entry) => (
                  <div key={entry.id} className="bg-gray-900/40 border border-gray-800/70 rounded-lg p-3">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{entry.title}</span>
                      {entry.week && entry.season && (
                        <span className="text-[11px] text-gray-600">Week {entry.week} • {entry.season}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{entry.content}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function ReviewModePanel({ leagueId, teamId, week, season }: PlaybookContext) {
  const [selectedEntry, setSelectedEntry] = useState<PlaybookEntry | null>(null);
  const [pendingOutcome, setPendingOutcome] = useState<'win' | 'loss' | 'push'>('win');
  const [regretScore, setRegretScore] = useState<number>(3);
  const [summaryText, setSummaryText] = useState<string>('');
  const [forgeSnapshot, setForgeSnapshot] = useState<{ before: number | null; after: number | null; tierBefore: string | null; tierAfter: string | null; loading: boolean }>({
    before: null,
    after: null,
    tierBefore: null,
    tierAfter: null,
    loading: false
  });

  const { data, isLoading } = useQuery<{ success: boolean; entries: PlaybookEntry[] }>({
    queryKey: ['/api/playbook', 'review', leagueId, teamId, week, season],
    queryFn: async () => {
      const params = new URLSearchParams({ user_id: 'default_user', pending_only: 'true' });
      if (leagueId) params.append('league_id', leagueId);
      if (teamId) params.append('team_id', teamId);
      if (week !== null && week !== undefined) params.append('week', week.toString());
      if (season !== null && season !== undefined) params.append('season', season.toString());

      const res = await fetch(`/api/playbook?${params.toString()}`);
      return res.json();
    }
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ entry, payload }: { entry: PlaybookEntry; payload: any }) => {
      return apiRequest('PUT', `/api/playbook/${entry.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playbook', 'review', leagueId, teamId, week, season] });
      queryClient.invalidateQueries({ queryKey: ['/api/playbook', 'war-room', leagueId, teamId, week, season] });
      queryClient.invalidateQueries({ queryKey: ['/api/playbook', leagueId, teamId, week, season] });
      setSelectedEntry(null);
      setSummaryText('');
      setForgeSnapshot({ before: null, after: null, tierBefore: null, tierAfter: null, loading: false });
    }
  });

  const entries = data?.entries || [];

  const grouped = entries.reduce<Record<EntryType, PlaybookEntry[]>>((acc, entry) => {
    if (!acc[entry.entry_type]) acc[entry.entry_type] = [] as PlaybookEntry[];
    acc[entry.entry_type].push(entry);
    return acc;
  }, {} as Record<EntryType, PlaybookEntry[]>);

  const loadForgeSnapshot = async (entry: PlaybookEntry) => {
    if (!entry.player_ids || entry.player_ids.length === 0) {
      setForgeSnapshot({ before: null, after: null, tierBefore: null, tierAfter: null, loading: false });
      return;
    }

    setForgeSnapshot((prev) => ({ ...prev, loading: true }));
    try {
      const responses = await Promise.all(entry.player_ids.map(async (id) => {
        const res = await fetch(`/api/forge/score/${id}`);
        if (!res.ok) return { score: null as number | null, tier: null as string | null };
        const body = await res.json();
        return {
          score: typeof body.score === 'number' ? body.score : (typeof body.alpha === 'number' ? body.alpha : null),
          tier: body.tier ?? body.tier_label ?? null
        };
      }));

      const validScores = responses.map((r) => r.score).filter((s): s is number => typeof s === 'number' && !Number.isNaN(s));
      const averageScore = validScores.length ? Number((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)) : null;
      const tierBefore = responses.find((r) => r.tier)?.tier ?? null;

      setForgeSnapshot({
        before: averageScore,
        after: averageScore,
        tierBefore,
        tierAfter: tierBefore,
        loading: false
      });

      if (!summaryText) {
        setSummaryText(formatForgeSummary(averageScore, averageScore, tierBefore, tierBefore));
      }
    } catch (error) {
      console.error('Failed to load FORGE snapshot', error);
      setForgeSnapshot({ before: null, after: null, tierBefore: null, tierAfter: null, loading: false });
    }
  };

  const closeModal = () => {
    setSelectedEntry(null);
    setSummaryText('');
    setForgeSnapshot({ before: null, after: null, tierBefore: null, tierAfter: null, loading: false });
  };

  useEffect(() => {
    if (selectedEntry) {
      const normalizedOutcome = selectedEntry.outcome && selectedEntry.outcome !== 'pending'
        ? selectedEntry.outcome
        : 'win';
      setPendingOutcome(normalizedOutcome as 'win' | 'loss' | 'push');
      setRegretScore(selectedEntry.regret_score ?? 3);
      setSummaryText(selectedEntry.metadata?.summary || '');
      loadForgeSnapshot(selectedEntry);
    }
  }, [selectedEntry]);

  const handleResolve = async () => {
    if (!selectedEntry) return;

    const summary = summaryText || formatForgeSummary(forgeSnapshot.before, forgeSnapshot.after, forgeSnapshot.tierBefore, forgeSnapshot.tierAfter);
    const metadata = { ...(selectedEntry.metadata || {}), summary };

    await resolveMutation.mutateAsync({
      entry: selectedEntry,
      payload: {
        outcome: pendingOutcome,
        regret_score: regretScore,
        resolved_at: new Date().toISOString(),
        forge_before: forgeSnapshot.before,
        forge_after: forgeSnapshot.after,
        tier_before: forgeSnapshot.tierBefore,
        tier_after: forgeSnapshot.tierAfter,
        metadata
      }
    });
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-gray-800/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border border-dashed border-purple-500/30 rounded-xl">
          <p className="text-sm">Nothing to review yet.</p>
          <p className="text-xs mt-1 text-gray-600">Pending decisions will surface here once logged.</p>
        </div>
      ) : (
        REVIEW_SECTIONS.map((section) => {
          const sectionEntries = grouped[section.key] || [];
          if (sectionEntries.length === 0) return null;
          const config = ENTRY_TYPE_CONFIG[section.key];
          const Icon = config.icon;

          return (
            <div key={section.key} className="bg-[#0f1016] border border-gray-800/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Icon size={16} className={config.color} />
                <span>{section.label}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {sectionEntries.map((entry) => (
                  <div key={entry.id} className="bg-gray-900/40 border border-gray-800/80 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <div className="flex items-center gap-2">
                        <Clock3 size={14} className="text-purple-400" />
                        <span>Week {entry.week ?? '—'} / {entry.season ?? '—'}</span>
                      </div>
                      {/* TODO: once non-pending items can appear here, derive status from entry.outcome instead of hardcoding "Pending". */}
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-200">Pending</span>
                    </div>
                    <h4 className="text-white font-semibold text-sm">{entry.title}</h4>
                    <p className="text-gray-400 text-xs line-clamp-3 whitespace-pre-line">{entry.content}</p>
                    {entry.player_ids && entry.player_ids.length > 0 && (
                      <p className="text-[11px] text-gray-500">Players: {entry.player_ids.join(', ')}</p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-500 text-white"
                        onClick={() => setSelectedEntry(entry)}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {selectedEntry && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d0f14] border border-purple-500/30 rounded-xl max-w-2xl w-full p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-purple-300 uppercase tracking-wide">Resolve Decision</p>
                <h3 className="text-lg font-semibold text-white">{selectedEntry.title}</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={closeModal}>
                <X size={18} />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400 mb-2">Outcome</p>
                  <div className="flex gap-2 flex-wrap">
                    {(['win', 'loss', 'push'] as const).map((outcome) => (
                      <Button
                        key={outcome}
                        variant={pendingOutcome === outcome ? 'default' : 'outline'}
                        className={pendingOutcome === outcome ? 'bg-green-600 text-white' : 'text-gray-300 border-gray-700'}
                        onClick={() => setPendingOutcome(outcome)}
                      >
                        {outcome.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-2">Regret Score (1–5)</p>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={regretScore}
                    onChange={(e) => setRegretScore(parseInt(e.target.value, 10))}
                    className="w-full"
                  />
                  <div className="text-sm text-gray-300 mt-1">Current: {regretScore}</div>
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-1">Summary</p>
                  <textarea
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    rows={4}
                    placeholder="Auto-generated summary will appear here."
                    value={summaryText}
                    onChange={(e) => setSummaryText(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>FORGE Snapshot</span>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3 space-y-2 min-h-[120px]">
                  {forgeSnapshot.loading ? (
                    <div className="text-gray-500 text-sm">Loading FORGE data...</div>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm text-gray-300">
                        <span>Score Before</span>
                        <span>{forgeSnapshot.before ?? 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-300">
                        <span>Score After</span>
                        <span>{forgeSnapshot.after ?? 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-300">
                        <span>Tier</span>
                        <span>{forgeSnapshot.tierBefore ?? 'N/A'} → {forgeSnapshot.tierAfter ?? 'N/A'}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {summaryText || formatForgeSummary(forgeSnapshot.before, forgeSnapshot.after, forgeSnapshot.tierBefore, forgeSnapshot.tierAfter)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button
                onClick={handleResolve}
                disabled={resolveMutation.isPending}
                className="bg-purple-600 hover:bg-purple-500"
              >
                {resolveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Save Outcome'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InsightsPanel({ leagueId, teamId, week, season }: PlaybookContext) {
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<RegretSummaryResponse>({
    queryKey: ['/api/playbook/analytics', 'regret-summary', leagueId, teamId, season],
    queryFn: async () => {
      const params = new URLSearchParams({ user_id: 'default_user' });
      if (leagueId) params.append('league_id', leagueId);
      if (teamId) params.append('team_id', teamId);
      if (season !== null && season !== undefined) params.append('season', season.toString());

      const res = await fetch(`/api/playbook/analytics/regret-summary?${params.toString()}`);
      return res.json();
    }
  });

  const { data: patternData, isLoading: isPatternLoading } = useQuery<PatternInsightsResponse>({
    queryKey: ['/api/playbook/analytics', 'patterns', leagueId, teamId, season],
    queryFn: async () => {
      const params = new URLSearchParams({ user_id: 'default_user' });
      if (leagueId) params.append('league_id', leagueId);
      if (teamId) params.append('team_id', teamId);
      if (season !== null && season !== undefined) params.append('season', season.toString());

      const res = await fetch(`/api/playbook/analytics/patterns?${params.toString()}`);
      return res.json();
    }
  });

  const severityStyles: Record<PatternInsight['severity'], string> = {
    low: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200',
    medium: 'border-amber-500/30 bg-amber-500/5 text-amber-200',
    high: 'border-red-500/30 bg-red-500/5 text-red-200'
  };

  const byType = summaryData?.byType ?? [];
  const byWeek = summaryData?.byWeek ?? [];
  const insights = patternData?.insights ?? [];

  return (
    <div className="space-y-4">
      <div className="bg-[#0f1016] border border-purple-500/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-purple-300 uppercase tracking-wide">Tiber Fantasy Suite</p>
            <h3 className="text-lg font-semibold text-white">Insights</h3>
          </div>
          <div className="text-[11px] text-gray-400 flex gap-2">
            <span className="px-2 py-1 rounded-full bg-white/5 border border-purple-500/20">League: {leagueId ?? 'N/A'}</span>
            <span className="px-2 py-1 rounded-full bg-white/5 border border-purple-500/20">Team: {teamId ?? 'N/A'}</span>
            <span className="px-2 py-1 rounded-full bg-white/5 border border-purple-500/20">Season: {season ?? 'All'}</span>
            {week !== null && week !== undefined && (
              <span className="px-2 py-1 rounded-full bg-white/5 border border-purple-500/20">Week: {week}</span>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-gray-900/40 border border-gray-800/60 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-white mb-2">Regret Map by Decision Type</h4>
            {isSummaryLoading ? (
              <div className="h-24 bg-gray-800/40 animate-pulse rounded" />
            ) : byType.length === 0 ? (
              <p className="text-sm text-gray-500">No regret data yet.</p>
            ) : (
              <div className="divide-y divide-gray-800 text-sm">
                {byType.map((row) => (
                  <div key={row.entry_type} className="py-2 flex items-center justify-between text-gray-200">
                    <div>
                      <div className="font-semibold text-white">{ENTRY_TYPE_CONFIG[row.entry_type].label}</div>
                      <p className="text-xs text-gray-500">{row.decisions_count} decisions</p>
                    </div>
                    <div className="text-right text-xs text-gray-400 space-y-1">
                      <div>Avg Regret: {row.avg_regret !== null ? Number(row.avg_regret).toFixed(2) : '—'}</div>
                      <div>High Regret %: {row.high_regret_rate !== null ? `${Math.round(row.high_regret_rate * 100)}%` : '—'}</div>
                      <div>Win Rate: {row.win_rate !== null ? `${Math.round(row.win_rate * 100)}%` : '—'}</div>
                      <div>Loss Rate: {row.loss_rate !== null ? `${Math.round(row.loss_rate * 100)}%` : '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-900/40 border border-gray-800/60 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-white mb-2">Timeline</h4>
            {isSummaryLoading ? (
              <div className="h-24 bg-gray-800/40 animate-pulse rounded" />
            ) : byWeek.length === 0 ? (
              <p className="text-sm text-gray-500">No weekly outcomes to chart yet.</p>
            ) : (
              <div className="space-y-2 text-sm text-gray-200">
                {byWeek.map((row) => (
                  <div key={`${row.season}-${row.week}`} className="flex items-center justify-between bg-gray-800/30 rounded px-3 py-2">
                    <div>
                      <div className="font-medium text-white">Season {row.season}, Week {row.week}</div>
                      <p className="text-xs text-gray-500">{row.decisions_count} decisions</p>
                    </div>
                    <div className="text-xs text-gray-400">Avg Regret: {row.avg_regret !== null ? Number(row.avg_regret).toFixed(2) : '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-900/40 border border-gray-800/60 rounded-lg p-3 mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-white">Patterns Detected</h4>
            {isPatternLoading && <div className="text-xs text-gray-500">Analyzing...</div>}
          </div>
          {isPatternLoading ? (
            <div className="h-24 bg-gray-800/40 animate-pulse rounded" />
          ) : insights.length === 0 ? (
            <p className="text-sm text-gray-500">No patterns detected yet.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${severityStyles[insight.severity]}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{insight.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/20 uppercase tracking-wide">{insight.severity}</span>
                  </div>
                  <p className="text-xs mt-1">{insight.description}</p>
                  {insight.entry_types && insight.entry_types.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {insight.entry_types.map((type) => (
                        <span key={type} className="text-[10px] px-2 py-0.5 rounded-full bg-black/20 border border-white/10">
                          {ENTRY_TYPE_CONFIG[type].label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlaybookTab({ leagueId = null, teamId = null, week = null, season = null, scoringFormat = null }: PlaybookContext) {
  const [activeView, setActiveView] = useState<'journal' | 'war_room' | 'review' | 'insights'>('journal');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newEntry, setNewEntry] = useState({ title: '', content: '', entryType: 'note' as EntryType });
  const [editEntry, setEditEntry] = useState({ title: '', content: '' });

  const [isAskTiberOpen, setIsAskTiberOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<{ success: boolean; entries: PlaybookEntry[] }>({
    queryKey: ['/api/playbook', leagueId, teamId, week, season],
    queryFn: async () => {
      const params = new URLSearchParams({ user_id: 'default_user', limit: '100' });
      if (leagueId) params.append('league_id', leagueId);
      if (teamId) params.append('team_id', teamId);
      if (week !== null && week !== undefined) params.append('week', week.toString());
      if (season !== null && season !== undefined) params.append('season', season.toString());

      const res = await fetch(`/api/playbook?${params.toString()}`);
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (entry: { title: string; content: string; entry_type: string }) => {
      return apiRequest('POST', '/api/playbook', {
        user_id: 'default_user',
        league_id: leagueId,
        team_id: teamId,
        scoring_format: scoringFormat,
        week,
        season,
        ...entry
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playbook', leagueId, teamId, week, season] });
      setIsCreating(false);
      setNewEntry({ title: '', content: '', entryType: 'note' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: { title: string; content: string } }) => {
      return apiRequest('PUT', `/api/playbook/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playbook', leagueId, teamId, week, season] });
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/playbook/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playbook', leagueId, teamId, week, season] });
    }
  });

  const saveChatEntryMutation = useMutation({
    mutationFn: async (entry: { title: string; content: string }) => {
      return apiRequest('POST', '/api/playbook', {
        user_id: 'default_user',
        league_id: leagueId,
        team_id: teamId,
        scoring_format: scoringFormat,
        week,
        season,
        entry_type: 'insight',
        ...entry
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playbook', leagueId, teamId, week, season] });
    }
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch('/api/tiber-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId,
          mode: 'insight',
          userLevel: 3
        })
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.sessionId) setSessionId(data.sessionId);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response || data.message || 'No response',
        timestamp: new Date()
      }]);
    }
  });

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: chatMessage,
      timestamp: new Date()
    }]);

    chatMutation.mutate(chatMessage);
    setChatMessage('');
  };

  const handleSaveChatEntry = (message: ChatMessage) => {
    if (message.role !== 'assistant') return;
    const snippet = message.content.slice(0, 60).trim();
    const title = `Ask Tiber – ${snippet}${message.content.length > snippet.length ? '...' : ''}`;

    saveChatEntryMutation.mutate({
      title,
      content: message.content
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const entries = data?.entries || [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-purple-500/20 pb-4">
        <h2 className="text-2xl font-bold text-white tracking-wide">PLAYBOOK</h2>
        <p className="text-gray-400 mt-1 text-sm tracking-wide">
          Your decision journal. Track roster moves, trades, and insights alongside FORGE data.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeView === 'journal' ? 'default' : 'outline'}
            className={activeView === 'journal' ? 'bg-purple-600 text-white' : 'text-gray-300 border-purple-500/40'}
            onClick={() => setActiveView('journal')}
          >
            Journal
          </Button>
          <Button
            variant={activeView === 'war_room' ? 'default' : 'outline'}
            className={activeView === 'war_room' ? 'bg-blue-600 text-white' : 'text-gray-300 border-blue-500/40'}
            onClick={() => setActiveView('war_room')}
          >
            War Room
          </Button>
          <Button
            variant={activeView === 'review' ? 'default' : 'outline'}
            className={activeView === 'review' ? 'bg-emerald-600 text-white' : 'text-gray-300 border-emerald-500/40'}
            onClick={() => setActiveView('review')}
          >
            Review Mode
          </Button>
          <Button
            variant={activeView === 'insights' ? 'default' : 'outline'}
            className={activeView === 'insights' ? 'bg-amber-600 text-white' : 'text-gray-300 border-amber-500/40'}
            onClick={() => setActiveView('insights')}
          >
            Insights
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-gray-300">
          <span className="px-3 py-1 rounded-full bg-white/5 border border-purple-500/20">League: {leagueId ?? 'N/A'}</span>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-purple-500/20">Team: {teamId ?? 'N/A'}</span>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-purple-500/20">Week: {week ?? 'N/A'}</span>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-purple-500/20">Season: {season ?? 'N/A'}</span>
        </div>
      </div>

      {activeView === 'journal' ? (
        <>
      <div className="flex gap-2 flex-wrap text-xs">
        <span className="text-gray-500 py-1">Quick Reference:</span>
        <Link href="/rankings" data-testid="link-tiber-tiers">
          <a className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 border border-purple-500/30 rounded text-purple-300 hover:bg-purple-600/30 transition-colors cursor-pointer">
            <Crown size={12} />
            Tiber Tiers
          </a>
        </Link>
        <Link href="/schedule" data-testid="link-sos">
          <a className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-blue-300 hover:bg-blue-600/30 transition-colors cursor-pointer">
            <Calendar size={12} />
            SoS
          </a>
        </Link>
        <Link href="/tiber-data-lab" data-testid="link-data-lab">
          <a className="flex items-center gap-1 px-2 py-1 bg-green-600/20 border border-green-500/30 rounded text-green-300 hover:bg-green-600/30 transition-colors cursor-pointer">
            <BarChart3 size={12} />
            Data Lab
          </a>
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={() => setIsCreating(true)}
          className="bg-gradient-to-r from-purple-600/30 to-blue-600/30 border border-purple-500/50 text-white hover:border-purple-400"
          data-testid="button-new-entry"
        >
          <Plus size={18} className="mr-2" />
          New Entry
        </Button>
        
        <Button
          onClick={() => setIsAskTiberOpen(!isAskTiberOpen)}
          variant="outline"
          className={`border-amber-500/50 ${isAskTiberOpen ? 'bg-amber-500/20 text-amber-300' : 'text-amber-400 hover:bg-amber-500/10'}`}
          data-testid="button-ask-tiber"
        >
          <MessageCircle size={18} className="mr-2" />
          Ask Tiber
        </Button>
      </div>

      {isAskTiberOpen && (
        <div className="bg-[#111217] border border-amber-500/30 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-2">
            <MessageCircle size={18} className="text-amber-400" />
            <span className="font-medium text-amber-300">Ask Tiber</span>
            <span className="text-xs text-gray-500 ml-2">FORGE-grounded AI companion</span>
          </div>
          
          <div className="h-64 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Lightbulb size={24} className="mx-auto mb-2 text-amber-500/50" />
                <p className="text-sm">Ask about players, matchups, or roster decisions.</p>
                <p className="text-xs mt-1">Tiber uses FORGE data to give you grounded advice.</p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-purple-600/30 text-white'
                      : 'bg-gray-800 text-gray-200'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'assistant' && (
                  <div className="mt-1 ml-2">
                    <Button
                      size="xs"
                      variant="outline"
                      className="text-amber-300 border-amber-500/50 hover:bg-amber-500/10"
                      onClick={() => handleSaveChatEntry(msg)}
                      disabled={saveChatEntryMutation.isPending}
                    >
                      Save as Entry
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-gray-800 px-4 py-2 rounded-lg">
                  <Loader2 size={16} className="animate-spin text-amber-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="p-3 border-t border-amber-500/20 flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask about a player, trade, or decision..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              data-testid="input-ask-tiber"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!chatMessage.trim() || chatMutation.isPending}
              className="bg-amber-600 hover:bg-amber-500 text-white"
              data-testid="button-send-tiber"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      )}

      {isCreating && (
        <div className="bg-[#111217] border border-purple-500/30 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-white">New Entry</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
              <X size={18} />
            </Button>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(ENTRY_TYPE_CONFIG) as EntryType[]).map((type) => {
              const config = ENTRY_TYPE_CONFIG[type];
              const Icon = config.icon;
              return (
                <button
                  key={type}
                  onClick={() => setNewEntry({ ...newEntry, entryType: type })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    newEntry.entryType === type
                      ? 'bg-purple-600/30 border border-purple-500/50 text-white'
                      : 'bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/50'
                  }`}
                  data-testid={`button-type-${type}`}
                >
                  <Icon size={14} className={config.color} />
                  {config.label}
                </button>
              );
            })}
          </div>
          
          <input
            type="text"
            value={newEntry.title}
            onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
            placeholder="Title (e.g., 'Started Puka over Lamb')"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            data-testid="input-entry-title"
          />
          
          <textarea
            value={newEntry.content}
            onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
            placeholder="Details, reasoning, FORGE data at decision time..."
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none"
            data-testid="input-entry-content"
          />
          
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({
                title: newEntry.title,
                content: newEntry.content,
                entry_type: newEntry.entryType
              })}
              disabled={!newEntry.title.trim() || !newEntry.content.trim() || createMutation.isPending}
              className="bg-purple-600 hover:bg-purple-500"
              data-testid="button-save-entry"
            >
              {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} className="mr-1" />}
              Save
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-800/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText size={32} className="mx-auto mb-3 opacity-50" />
            <p>No entries yet. Start logging your decisions!</p>
          </div>
        ) : (
          entries.map((entry) => {
            const config = ENTRY_TYPE_CONFIG[entry.entry_type] || ENTRY_TYPE_CONFIG.note;
            const Icon = config.icon;
            const isEditing = editingId === entry.id;
            
            return (
              <div
                key={entry.id}
                className="bg-[#111217] border border-gray-800/50 rounded-xl p-4 hover:border-gray-700/50 transition-all"
                data-testid={`entry-card-${entry.id}`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editEntry.title}
                      onChange={(e) => setEditEntry({ ...editEntry, title: e.target.value })}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500/50"
                      data-testid="input-edit-title"
                    />
                    <textarea
                      value={editEntry.content}
                      onChange={(e) => setEditEntry({ ...editEntry, content: e.target.value })}
                      rows={3}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500/50 resize-none"
                      data-testid="input-edit-content"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: entry.id, updates: editEntry })}
                        disabled={updateMutation.isPending}
                        className="bg-purple-600 hover:bg-purple-500"
                        data-testid="button-save-edit"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon size={18} className={config.color} />
                        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                        <span className="text-xs text-gray-600">•</span>
                        <span className="text-xs text-gray-500">{formatDate(entry.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingId(entry.id);
                            setEditEntry({ title: entry.title, content: entry.content });
                          }}
                          className="h-7 w-7 p-0 text-gray-500 hover:text-white"
                          data-testid={`button-edit-${entry.id}`}
                        >
                          <Edit3 size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Delete this entry?')) {
                              deleteMutation.mutate(entry.id);
                            }
                          }}
                          className="h-7 w-7 p-0 text-gray-500 hover:text-red-400"
                          data-testid={`button-delete-${entry.id}`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                    <h4 className="text-white font-medium mt-2">{entry.title}</h4>
                    <p className="text-gray-400 text-sm mt-1 whitespace-pre-wrap">{entry.content}</p>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
        </>
      ) : activeView === 'war_room' ? (
        <WarRoomPanel
          leagueId={leagueId ?? undefined}
          teamId={teamId ?? undefined}
          week={week ?? undefined}
          season={season ?? undefined}
        />
      ) : activeView === 'insights' ? (
        <InsightsPanel
          leagueId={leagueId ?? undefined}
          teamId={teamId ?? undefined}
          week={week ?? undefined}
          season={season ?? undefined}
        />
      ) : (
        <ReviewModePanel
          leagueId={leagueId ?? undefined}
          teamId={teamId ?? undefined}
          week={week ?? undefined}
          season={season ?? undefined}
        />
      )}

      <div className="mt-8 pt-6 border-t border-purple-500/10 text-center text-xs text-gray-600/70 tracking-wider">
        PLAYBOOK — Your Fantasy Decision Journal
      </div>
    </div>
  );
}
