/**
 * Compact post-cutoff signal ledger panel for the linked player view
 * (issue #297). Read-only: shows the frozen-baseline link, post-cutoff
 * pressure direction, observation timeline, open questions, and Rookies
 * profile status for ledger entries tied to this player. Deliberately shows
 * no synthesized "current projection" — a separately governed update method
 * does not exist yet.
 *
 * Styled to match PlayerPage's dark surface (this panel lives there, not on
 * the v2-light ledger page).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BookOpen } from "lucide-react";
import type { LedgerEntryView } from "@shared/postCutoffLedger";
import { LEDGER_API_BASE, type LedgerListResponse } from "@/lib/postCutoffLedger";

const PRESSURE_STYLE: Record<string, string> = {
  upward: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  downward: "border-red-500/40 bg-red-500/10 text-red-300",
  mixed: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  none: "border-gray-600 bg-gray-800 text-gray-300",
  unresolved: "border-gray-600 bg-gray-800 text-gray-400",
};

function useLedgerEntries(filter: string | null) {
  return useQuery<LedgerListResponse, Error>({
    queryKey: [`${LEDGER_API_BASE}/entries?player=${encodeURIComponent(filter ?? "")}`],
    enabled: Boolean(filter && filter.trim()),
    retry: false,
  });
}

export default function PostCutoffLedgerPanel({
  playerName,
  canonicalPlayerId,
}: {
  playerName: string;
  canonicalPlayerId?: string | null;
}) {
  const byIdQuery = useLedgerEntries(canonicalPlayerId ?? null);
  const byNameQuery = useLedgerEntries(playerName);

  const merged = new Map<string, LedgerEntryView>();
  for (const view of [...(byIdQuery.data?.entries ?? []), ...(byNameQuery.data?.entries ?? [])]) {
    merged.set(view.ledger_entry_id, view);
  }
  const entries = Array.from(merged.values()).sort((a, b) => b.entry.observed_at.localeCompare(a.entry.observed_at));

  // Render nothing until this player has ledger evidence.
  if (entries.length === 0) return null;

  const active = entries.filter(
    (view) => view.entry.status !== "superseded" && view.entry.status !== "closed_no_change",
  );
  const pressures = Array.from(new Set(active.map((view) => view.entry.forecast_pressure)));
  const openQuestions = Array.from(new Set(active.flatMap((view) => view.entry.open_questions)));
  const baselineRuns = Array.from(new Set(entries.map((view) => view.entry.baseline_run_id)));
  const rookiesStatus = entries[0]?.entry.linked_artifacts.rookies_profile_status ?? "missing";

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4" data-testid="post-cutoff-ledger-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <BookOpen size={14} className="text-orange-400" />
          Post-cutoff signal ledger
        </h3>
        <Link href="/observatory/post-cutoff-ledger" className="text-xs text-orange-400 hover:text-orange-300">
          Open ledger →
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-400">Frozen baseline:</span>
        {baselineRuns.map((runId) => (
          <span key={runId} className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-300">
            {runId}
          </span>
        ))}
        <span className="text-gray-400">Post-cutoff pressure:</span>
        {(pressures.length > 0 ? pressures : ["unresolved"]).map((pressure) => (
          <span
            key={pressure}
            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${PRESSURE_STYLE[pressure] ?? PRESSURE_STYLE.unresolved}`}
          >
            {pressure}
          </span>
        ))}
        <span className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300">
          rookies profile: {rookiesStatus}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {entries.slice(0, 5).map((view) => (
          <li key={view.ledger_entry_id} className="border-l-2 border-gray-700 pl-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span className="font-mono text-[10px]">{view.entry.observed_at}</span>
              <span>{view.entry.event_type}</span>
              <span className="text-gray-500">{view.entry.status}</span>
              {view.entry.player_ref.identity_status === "unresolved" ? (
                <span className="text-amber-400">identity unresolved</span>
              ) : null}
            </div>
            <ul className="mt-0.5 list-disc pl-4 text-xs text-gray-300">
              {view.entry.observations.slice(0, 3).map((observation) => (
                <li key={observation}>{observation}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {openQuestions.length > 0 ? (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Open questions</div>
          <ul className="mt-1 list-disc pl-4 text-xs text-gray-400">
            {openQuestions.slice(0, 4).map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-4 text-gray-500">
        Candidate operator evidence only — the frozen Forecast baseline is unchanged, and no
        synthesized current projection is produced from these entries.
      </p>
    </div>
  );
}
