/**
 * Post-cutoff signal ledger — operator intake and review surface (issue #297).
 *
 * Observatory sub-surface. The operator pastes a YAML-like ledger entry,
 * inspects the parsed structure, edits it, and saves it as candidate
 * operator evidence behind the admin key. Entries are append-only:
 * revisions and status changes preserve full history. Nothing here mutates
 * Forecast outputs, promoted artifacts, rankings, projections, or player
 * cards, and an unreviewed entry is never presented as governed truth.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, KeyRound, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CONFIDENCE_LEVELS,
  FORECAST_PRESSURES,
  LEDGER_EVENT_TYPES,
  LEDGER_STATUSES,
  ROOKIES_PROFILE_STATUSES,
  emptyLedgerEntryDraft,
  entryToDraft,
  parseLedgerPaste,
  validateLedgerDraft,
  type LedgerEntryDraft,
  type LedgerEntryView,
  type LedgerStatus,
} from "@shared/postCutoffLedger";
import {
  LEDGER_API_BASE,
  appendLedgerRevision,
  createLedgerEntry,
  getStoredOperatorKey,
  linesToList,
  listToLines,
  searchPlayerIdentity,
  storeOperatorKey,
  type LedgerDetailResponse,
  type LedgerListResponse,
  type PlayerIdentitySearchResult,
} from "@/lib/postCutoffLedger";

const PRESSURE_BADGE: Record<string, string> = {
  upward: "border-emerald-300 bg-emerald-50 text-emerald-700",
  downward: "border-red-300 bg-red-50 text-red-700",
  mixed: "border-amber-300 bg-amber-50 text-amber-700",
  none: "border-gray-200 bg-gray-50 text-gray-600",
  unresolved: "border-gray-300 bg-gray-100 text-gray-500",
};

const STATUS_BADGE: Record<string, string> = {
  candidate_operator_observation: "border-sky-300 bg-sky-50 text-sky-700",
  corroboration_pending: "border-amber-300 bg-amber-50 text-amber-700",
  confirmed_observation: "border-emerald-300 bg-emerald-50 text-emerald-700",
  superseded: "border-gray-300 bg-gray-100 text-gray-500",
  closed_no_change: "border-gray-300 bg-gray-100 text-gray-500",
};

const FIELD_LABEL = "text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400";
const SELECT_CLASS =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-ember focus:outline-none";

function ListField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="min-w-0">
      <div className={FIELD_LABEL}>{label}</div>
      {hint ? <p className="mt-0.5 text-xs text-gray-500">{hint}</p> : null}
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="mt-1 border-gray-300 bg-white font-mono text-xs text-gray-900"
        placeholder="One item per line"
      />
    </div>
  );
}

function EnumSelect({
  label,
  value,
  options,
  onChange,
  allowEmpty,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className={FIELD_LABEL}>{label}</div>
      <select className={SELECT_CLASS} value={value} onChange={(event) => onChange(event.target.value)}>
        {allowEmpty ? <option value="">— select —</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

interface SignalFormState {
  draft: LedgerEntryDraft;
  observationsText: string;
  inferencesText: string;
  limitationsText: string;
  openQuestionsText: string;
  sourcesText: string;
  parseWarnings: string[];
}

function draftToFormState(draft: LedgerEntryDraft, parseWarnings: string[] = []): SignalFormState {
  return {
    draft,
    observationsText: listToLines(draft.observations),
    inferencesText: listToLines(draft.inferences),
    limitationsText: listToLines(draft.limitations),
    openQuestionsText: listToLines(draft.open_questions),
    sourcesText: listToLines(draft.source_refs.map((ref) => ref.ref)),
    parseWarnings,
  };
}

function formStateToDraft(state: SignalFormState): LedgerEntryDraft {
  return {
    ...state.draft,
    observations: linesToList(state.observationsText),
    inferences: linesToList(state.inferencesText),
    limitations: linesToList(state.limitationsText),
    open_questions: linesToList(state.openQuestionsText),
    source_refs: linesToList(state.sourcesText).map((ref) => ({ ref, note: null, verified: false })),
  };
}

function PlayerSearch({
  onSelect,
}: {
  onSelect: (result: PlayerIdentitySearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const searchQuery = useQuery<PlayerIdentitySearchResult[], Error>({
    queryKey: ["post-cutoff-ledger-player-search", submitted],
    queryFn: () => searchPlayerIdentity(submitted),
    enabled: submitted.trim().length >= 2,
    retry: false,
  });

  return (
    <div className="min-w-0">
      <div className={FIELD_LABEL}>Canonical identity lookup</div>
      <p className="mt-0.5 text-xs text-gray-500">
        Attach a canonical player ID explicitly — the ledger never joins by display name silently.
      </p>
      <div className="mt-1 flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setSubmitted(query);
          }}
          placeholder="Search player name…"
          className="border-gray-300 bg-white text-sm text-gray-900"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1"
          onClick={() => setSubmitted(query)}
        >
          <Search className="h-4 w-4" />
          Search
        </Button>
      </div>
      {searchQuery.isError ? (
        <p className="mt-1 text-xs text-red-600">Identity search failed: {searchQuery.error.message}</p>
      ) : null}
      {searchQuery.data && searchQuery.data.length === 0 ? (
        <p className="mt-1 text-xs text-gray-500">No identity matches — the entry can still be saved unresolved.</p>
      ) : null}
      {searchQuery.data && searchQuery.data.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {searchQuery.data.map((result) => (
            <li key={result.canonicalId}>
              <button
                type="button"
                onClick={() => onSelect(result)}
                className="w-full rounded-md border border-gray-200 bg-[#fafafa] px-2 py-1 text-left text-xs text-gray-700 hover:border-ember"
              >
                <span className="font-medium text-gray-900">{result.fullName}</span>
                {result.position ? ` · ${result.position}` : ""}
                <span className="ml-1 font-mono text-[10px] text-gray-500">{result.canonicalId}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AddSignalPanel({ operatorKey }: { operatorKey: string }) {
  const queryClient = useQueryClient();
  const [pasteText, setPasteText] = useState("");
  const [form, setForm] = useState<SignalFormState | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const baselineRunsQuery = useQuery<{ baselineRunIds: string[] }, Error>({
    queryKey: [`${LEDGER_API_BASE}/baseline-runs`],
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: (draft: LedgerEntryDraft) => createLedgerEntry(operatorKey, draft),
    onSuccess: (response) => {
      setSavedEntryId(response.record.ledger_entry_id);
      setForm(null);
      setPasteText("");
      queryClient.invalidateQueries({ queryKey: [`${LEDGER_API_BASE}/entries`] });
      queryClient.invalidateQueries({ queryKey: [`${LEDGER_API_BASE}/baseline-runs`] });
    },
  });

  const validation = useMemo(
    () => (form ? validateLedgerDraft(formStateToDraft(form)) : null),
    [form],
  );

  function updateDraft(patch: Partial<LedgerEntryDraft>) {
    setForm((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...patch } } : prev));
  }

  function handleParse() {
    const { draft, warnings } = parseLedgerPaste(pasteText);
    setForm(draftToFormState(draft, warnings));
    setSavedEntryId(null);
  }

  return (
    <Card className="min-w-0 border-gray-200 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Plus className="h-4 w-4 text-ember" />
          Add signal
        </CardTitle>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Paste a YAML-like ledger entry, review the parsed structure, then save it as{" "}
          <span className="font-mono">candidate_operator_observation</span>. Parsing never invents
          missing values; unknown fields are preserved, never dropped.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <Textarea
          value={pasteText}
          onChange={(event) => setPasteText(event.target.value)}
          rows={8}
          placeholder={"player: Josh Downs\nbaseline_run: seasonal-ppr-2026-forward-001\nevent_type: role_expansion\nobserved:\n  - outside reps increasing"}
          className="border-gray-300 bg-white font-mono text-xs text-gray-900"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="bg-ember text-white hover:bg-ember/90" onClick={handleParse} disabled={!pasteText.trim()}>
            Parse pasted text
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setForm(draftToFormState(emptyLedgerEntryDraft()));
              setSavedEntryId(null);
            }}
          >
            Start blank entry
          </Button>
        </div>

        {savedEntryId ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Saved as candidate operator evidence — ledger entry{" "}
            <span className="font-mono">{savedEntryId}</span>. It now appears in the ledger below and
            on the linked player view. No Forecast output was modified.
          </p>
        ) : null}

        {form ? (
          <div className="space-y-4 rounded-lg border border-gray-200 bg-[#fafafa] p-3 sm:p-4">
            {form.parseWarnings.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                <div className="flex items-center gap-1 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Parse warnings
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-800">
                  {form.parseWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <div className={FIELD_LABEL}>Player display name</div>
                <Input
                  value={form.draft.display_name}
                  onChange={(event) => updateDraft({ display_name: event.target.value })}
                  className="mt-1 border-gray-300 bg-white text-sm text-gray-900"
                />
                <div className="mt-1 flex items-center gap-2 text-xs">
                  {form.draft.canonical_player_id ? (
                    <>
                      <Badge variant="secondary" className="border border-emerald-300 bg-emerald-50 text-emerald-700">
                        identity resolved
                      </Badge>
                      <span className="font-mono text-gray-600">{form.draft.canonical_player_id}</span>
                      <button
                        type="button"
                        className="text-gray-500 underline"
                        onClick={() => updateDraft({ canonical_player_id: null })}
                      >
                        detach
                      </button>
                    </>
                  ) : (
                    <Badge variant="secondary" className="border border-amber-300 bg-amber-50 text-amber-700">
                      identity unresolved
                    </Badge>
                  )}
                </div>
              </div>
              <PlayerSearch
                onSelect={(result) =>
                  updateDraft({
                    canonical_player_id: result.canonicalId,
                    display_name: form.draft.display_name || result.fullName,
                  })
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <div className={FIELD_LABEL}>Baseline run ID (required)</div>
                <Input
                  list="pcl-baseline-runs"
                  value={form.draft.baseline_run_id}
                  onChange={(event) => updateDraft({ baseline_run_id: event.target.value })}
                  placeholder="e.g. seasonal-ppr-2026-forward-001"
                  className="mt-1 border-gray-300 bg-white font-mono text-xs text-gray-900"
                />
                <datalist id="pcl-baseline-runs">
                  {(baselineRunsQuery.data?.baselineRunIds ?? []).map((runId) => (
                    <option key={runId} value={runId} />
                  ))}
                </datalist>
              </div>
              <div className="min-w-0">
                <div className={FIELD_LABEL}>Observed at (required)</div>
                <Input
                  type="date"
                  value={form.draft.observed_at.slice(0, 10)}
                  onChange={(event) => updateDraft({ observed_at: event.target.value })}
                  className="mt-1 border-gray-300 bg-white text-sm text-gray-900"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <EnumSelect label="Event type" value={form.draft.event_type} options={LEDGER_EVENT_TYPES} onChange={(v) => updateDraft({ event_type: v })} allowEmpty />
              <EnumSelect label="Forecast pressure" value={form.draft.forecast_pressure} options={FORECAST_PRESSURES} onChange={(v) => updateDraft({ forecast_pressure: v })} allowEmpty />
              <EnumSelect label="Confidence" value={form.draft.confidence} options={CONFIDENCE_LEVELS} onChange={(v) => updateDraft({ confidence: v })} allowEmpty />
              <EnumSelect label="Status" value={form.draft.status} options={LEDGER_STATUSES} onChange={(v) => updateDraft({ status: v })} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ListField
                label="Observations (required)"
                hint="What was actually observed. Kept separate from inference."
                value={form.observationsText}
                onChange={(next) => setForm((prev) => (prev ? { ...prev, observationsText: next } : prev))}
              />
              <ListField
                label="Inferences"
                hint="Operator interpretation derived from the observations."
                value={form.inferencesText}
                onChange={(next) => setForm((prev) => (prev ? { ...prev, inferencesText: next } : prev))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ListField
                label="Source refs"
                hint="URLs or evidence references. Recorded as unverified at intake."
                value={form.sourcesText}
                onChange={(next) => setForm((prev) => (prev ? { ...prev, sourcesText: next } : prev))}
              />
              <ListField
                label="Open questions"
                value={form.openQuestionsText}
                onChange={(next) => setForm((prev) => (prev ? { ...prev, openQuestionsText: next } : prev))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ListField
                label="Limitations"
                value={form.limitationsText}
                onChange={(next) => setForm((prev) => (prev ? { ...prev, limitationsText: next } : prev))}
              />
              <div className="min-w-0 space-y-3">
                <EnumSelect
                  label="Rookies profile status"
                  value={form.draft.rookies_profile_status}
                  options={ROOKIES_PROFILE_STATUSES}
                  onChange={(v) => updateDraft({ rookies_profile_status: v })}
                />
                <div>
                  <div className={FIELD_LABEL}>Forecast player row ref (optional)</div>
                  <Input
                    value={form.draft.forecast_player_row_ref ?? ""}
                    onChange={(event) => updateDraft({ forecast_player_row_ref: event.target.value || null })}
                    className="mt-1 border-gray-300 bg-white font-mono text-xs text-gray-900"
                  />
                </div>
              </div>
            </div>

            {form.draft.unrecognized_fields.length > 0 ? (
              <div className="rounded-md border border-gray-200 bg-white p-2">
                <div className="text-xs font-semibold text-gray-700">Unrecognized fields (preserved with the entry)</div>
                <ul className="mt-1 space-y-0.5">
                  {form.draft.unrecognized_fields.map((field, index) => (
                    <li key={`${field.key}-${index}`} className="font-mono text-[11px] text-gray-600">
                      {field.key}: {Array.isArray(field.value) ? field.value.join("; ") : field.value}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {validation ? (
              <div className="space-y-2">
                {validation.errors.length > 0 ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-2">
                    <div className="text-xs font-semibold text-red-700">Blocking validation errors</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-red-700">
                      {validation.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {validation.warnings.length > 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                    <div className="text-xs font-semibold text-amber-800">Evidence warnings</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-800">
                      {validation.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {saveMutation.isError ? (
              <p className="text-xs text-red-600">Save failed: {(saveMutation.error as Error).message}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-ember text-white hover:bg-ember/90"
                disabled={!operatorKey || !validation || validation.errors.length > 0 || saveMutation.isPending}
                onClick={() => saveMutation.mutate(formStateToDraft(form))}
              >
                {saveMutation.isPending ? "Saving…" : "Save as candidate evidence"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setForm(null)}>
                Discard draft
              </Button>
              {!operatorKey ? (
                <span className="text-xs text-amber-700">Enter the operator key above to enable saving.</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const STATUS_TRANSITIONS: Record<string, LedgerStatus[]> = {
  candidate_operator_observation: ["corroboration_pending", "confirmed_observation", "superseded", "closed_no_change"],
  corroboration_pending: ["confirmed_observation", "superseded", "closed_no_change"],
  confirmed_observation: ["superseded", "closed_no_change"],
  superseded: [],
  closed_no_change: [],
};

function LedgerEntryCard({ view, operatorKey }: { view: LedgerEntryView; operatorKey: string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [changeNote, setChangeNote] = useState("");

  const detailQuery = useQuery<LedgerDetailResponse, Error>({
    queryKey: [`${LEDGER_API_BASE}/entries/${view.ledger_entry_id}`],
    enabled: expanded,
    retry: false,
  });

  const transitionMutation = useMutation({
    mutationFn: (nextStatus: LedgerStatus) => {
      const draft = entryToDraft(view.entry);
      draft.status = nextStatus;
      return appendLedgerRevision(
        operatorKey,
        view.ledger_entry_id,
        draft,
        changeNote.trim() || `status change to ${nextStatus}`,
      );
    },
    onSuccess: () => {
      setChangeNote("");
      queryClient.invalidateQueries({ queryKey: [`${LEDGER_API_BASE}/entries`] });
      queryClient.invalidateQueries({ queryKey: [`${LEDGER_API_BASE}/entries/${view.ledger_entry_id}`] });
    },
  });

  const entry = view.entry;
  const transitions = STATUS_TRANSITIONS[entry.status] ?? [];

  return (
    <Card className="min-w-0 border-gray-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold text-gray-900">
              {entry.player_ref.display_name}
              <span className="ml-2 text-xs font-normal text-gray-500">{entry.event_type}</span>
            </CardTitle>
            <p className="mt-0.5 text-xs text-gray-500">
              observed {entry.observed_at} · recorded {view.created_at.slice(0, 10)} · rev {view.revision} ·{" "}
              <span className="font-mono">{entry.baseline_run_id}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className={`border text-[10px] ${PRESSURE_BADGE[entry.forecast_pressure] ?? PRESSURE_BADGE.unresolved}`}>
              {entry.forecast_pressure} pressure
            </Badge>
            <Badge variant="secondary" className="border border-gray-200 bg-gray-50 text-[10px] text-gray-600">
              {entry.confidence} confidence
            </Badge>
            <Badge variant="secondary" className={`border text-[10px] ${STATUS_BADGE[entry.status] ?? STATUS_BADGE.candidate_operator_observation}`}>
              {entry.status}
            </Badge>
            {entry.player_ref.identity_status === "unresolved" ? (
              <Badge variant="secondary" className="border border-amber-300 bg-amber-50 text-[10px] text-amber-700">
                identity unresolved
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className={FIELD_LABEL}>Observed</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-700">
              {entry.observations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className={FIELD_LABEL}>Inferred</div>
            {entry.inferences.length > 0 ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-500">
                {entry.inferences.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-gray-400">No inferences recorded.</p>
            )}
          </div>
        </div>

        <button
          type="button"
          className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Hide detail & history" : "Detail, sources & history"}
        </button>

        {expanded ? (
          <div className="mt-3 space-y-3 rounded-md border border-gray-200 bg-[#fafafa] p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className={FIELD_LABEL}>Sources (unverified unless corroborated)</div>
                {entry.source_refs.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {entry.source_refs.map((ref) => (
                      <li key={ref.ref} className="break-all font-mono text-[11px] text-gray-600">
                        {ref.ref} {ref.verified ? "(corroborated)" : "(unverified)"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">No source refs.</p>
                )}
              </div>
              <div>
                <div className={FIELD_LABEL}>Open questions & limitations</div>
                {entry.open_questions.length + entry.limitations.length > 0 ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-600">
                    {entry.open_questions.map((item) => (
                      <li key={`q-${item}`}>{item}</li>
                    ))}
                    {entry.limitations.map((item) => (
                      <li key={`l-${item}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">None recorded.</p>
                )}
              </div>
            </div>

            {entry.unrecognized_fields.length > 0 ? (
              <div>
                <div className={FIELD_LABEL}>Preserved unrecognized fields</div>
                <ul className="mt-1 space-y-0.5">
                  {entry.unrecognized_fields.map((field, index) => (
                    <li key={`${field.key}-${index}`} className="font-mono text-[11px] text-gray-600">
                      {field.key}: {Array.isArray(field.value) ? field.value.join("; ") : field.value}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <div className={FIELD_LABEL}>Revision history (append-only)</div>
              {detailQuery.isLoading ? <p className="mt-1 text-xs text-gray-400">Loading history…</p> : null}
              {detailQuery.isError ? (
                <p className="mt-1 text-xs text-red-600">Could not load history: {detailQuery.error.message}</p>
              ) : null}
              {detailQuery.data ? (
                <ul className="mt-1 space-y-0.5">
                  {detailQuery.data.history.map((record) => (
                    <li key={record.record_id} className="text-xs text-gray-600">
                      rev {record.revision} · {record.recorded_at.slice(0, 19).replace("T", " ")} ·{" "}
                      {record.entry.status}
                      {record.change_note ? ` — ${record.change_note}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {transitions.length > 0 ? (
              <div>
                <div className={FIELD_LABEL}>Status transition (appends a revision; history is preserved)</div>
                <Input
                  value={changeNote}
                  onChange={(event) => setChangeNote(event.target.value)}
                  placeholder="Change note (why this transition)…"
                  className="mt-1 border-gray-300 bg-white text-xs text-gray-900"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {transitions.map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!operatorKey || transitionMutation.isPending}
                      onClick={() => transitionMutation.mutate(nextStatus)}
                    >
                      → {nextStatus}
                    </Button>
                  ))}
                </div>
                {!operatorKey ? (
                  <p className="mt-1 text-xs text-amber-700">Enter the operator key to enable transitions.</p>
                ) : null}
                {transitionMutation.isError ? (
                  <p className="mt-1 text-xs text-red-600">
                    Transition failed: {(transitionMutation.error as Error).message}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function PostCutoffLedger() {
  const [operatorKey, setOperatorKey] = useState(getStoredOperatorKey);
  const [playerFilter, setPlayerFilter] = useState("");

  const listUrl = playerFilter.trim()
    ? `${LEDGER_API_BASE}/entries?player=${encodeURIComponent(playerFilter.trim())}`
    : `${LEDGER_API_BASE}/entries`;
  const listQuery = useQuery<LedgerListResponse, Error>({
    queryKey: [listUrl],
    retry: false,
  });

  return (
    <div className="pcl-light-surface mx-auto w-full max-w-5xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
          Observatory · post_cutoff_ledger_v0
        </div>
        <h1 className="mt-1 text-xl font-semibold text-gray-900 sm:text-2xl">Post-cutoff signal ledger</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Candidate operator evidence recorded against a frozen Forecast baseline. Entries keep
          observation, inference, and forecast pressure separate; the ledger is append-only and
          preserves history on supersession. Saving an entry never rewrites Forecast outputs,
          rankings, projections, or player cards, and no synthesized “current projection” is shown
          anywhere until a separately governed update method exists.
        </p>
      </header>

      <Card className="min-w-0 border-gray-200 bg-white shadow-sm">
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <KeyRound className="h-4 w-4 text-ember" />
            Operator key
          </div>
          <Input
            type="password"
            value={operatorKey}
            onChange={(event) => {
              setOperatorKey(event.target.value);
              storeOperatorKey(event.target.value);
            }}
            placeholder="Admin API key (required for writes; reads are open)"
            className="border-gray-300 bg-white text-sm text-gray-900 sm:max-w-md"
          />
          <p className="text-xs text-gray-500">Sent per-request via header; kept only in this browser session.</p>
        </CardContent>
      </Card>

      <AddSignalPanel operatorKey={operatorKey} />

      <section className="min-w-0">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Ledger (chronological)</h2>
            <p className="text-xs text-gray-500">Newest first. Superseded and closed entries remain in the record.</p>
          </div>
          <Input
            value={playerFilter}
            onChange={(event) => setPlayerFilter(event.target.value)}
            placeholder="Filter by exact player name or canonical ID…"
            className="border-gray-300 bg-white text-sm text-gray-900 sm:max-w-xs"
          />
        </div>

        {listQuery.isLoading ? <p className="text-sm text-gray-500">Loading ledger…</p> : null}
        {listQuery.isError ? (
          <p className="text-sm text-red-600">Ledger unavailable: {listQuery.error.message}</p>
        ) : null}
        {listQuery.data && listQuery.data.entries.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-300 bg-white px-3 py-6 text-center text-sm text-gray-500">
            No ledger entries yet{playerFilter ? " for this player" : ""}. Use “Add signal” above.
          </p>
        ) : null}
        <div className="space-y-3">
          {(listQuery.data?.entries ?? []).map((view) => (
            <LedgerEntryCard key={view.ledger_entry_id} view={view} operatorKey={operatorKey} />
          ))}
        </div>
      </section>
    </div>
  );
}
