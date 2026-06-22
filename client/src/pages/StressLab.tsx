/**
 * Observatory surface (user-facing product name: "TIBER Observatory").
 *
 * Naming boundary (PR A, #264):
 * - The user-facing name is "Observatory" everywhere in visible copy and nav.
 * - The implementation file/component (`StressLab`) and its heuristic lib
 *   (`stressLab.ts`) keep their legacy/internal names for now. A file/symbol
 *   rename touches imports and tests, so it is deferred to a later mechanical
 *   pass to keep PR A copy/naming/route-label only.
 * - Routes `/`, `/observatory`, and `/stress-lab` intentionally resolve to this
 *   same surface today (`/stress-lab` is a legacy alias). See client/src/App.tsx.
 *
 * Behavior is deliberately unchanged by PR A: this page makes NO backend, DB,
 * artifact, LLM, RAG, or external API calls. It is a deterministic client-side
 * v0 take-triage scaffold. A real live signal inventory (replacing the declared
 * system map below) is future work in PR C of #264; migrating the Management
 * operator diagnostics here is PR B; take-checker upgrades are PR D.
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clipboard,
  Download,
  FileJson,
  ShieldCheck,
  Telescope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  buildMockOperatorSignalNoteArtifact,
  buildSuggestedTiberHandoffs,
  serializeOperatorSignalNoteArtifactToCsv,
  type OperatorSignalNoteV0,
  type SuggestedTiberHandoff,
} from "@/lib/stressLab";

const SAMPLE_NOTE =
  "WR note: Red Zone usage looks interesting, but target share may be inflated by game script. Check EPA/Play and Catchable Target context before trusting route role in the NFC North.";

type ExportStatus = "idle" | "copied" | "downloaded" | "failed";

type DeclaredSystem = {
  name: string;
  description: string;
  role: string;
  // Declared/static label only — NOT a live health probe or measured uptime.
  status: "online" | "routing-only" | "heuristic-v0" | "partial" | "planned";
};

const DECLARED_SYSTEMS: DeclaredSystem[] = [
  {
    name: "TIBER-Data",
    description: "Canonical contracts, IDs, source metadata, and governed handoff artifacts.",
    role: "Truth and contract authority for downstream interpretation.",
    status: "routing-only",
  },
  {
    name: "TIBER-Teamstate",
    description: "Team context and environment interpretation surfaced as handoff targets.",
    role: "Owns team-level interpretation after source truth is verified.",
    status: "routing-only",
  },
  {
    name: "TIBER-Rookies",
    description: "Promoted rookie/prospect evaluation consumed as read-only handoff artifacts.",
    role: "Owns rookie model output and prospect evaluation framing.",
    status: "partial",
  },
  {
    name: "TIBER-FORGE",
    description: "Fantasy signal and scoring surface behind the live rankings lane.",
    role: "Owns deterministic fantasy scoring/ranking interpretation over canonical inputs.",
    status: "online",
  },
  {
    name: "Role & Opportunity",
    description: "Usage, role, route, and red-zone signal domain for note routing.",
    role: "Owns role/opportunity checks before fantasy implication is applied.",
    status: "heuristic-v0",
  },
];

const REPO_BOUNDARIES = [
  "TIBER-Data = truth/contracts",
  "TIBER-Teamstate = team interpretation",
  "TIBER-Rookies = rookie/prospect evaluation",
  "TIBER-FORGE = fantasy signal/scoring",
  "Role & Opportunity = usage/role signal",
  "TIBER-Fantasy = operator-facing synthesis/inspection",
];


function SystemStatusSection() {
  return (
    <section className="mt-5 sm:mt-8">
      <div className="mb-3 flex flex-col gap-1 sm:mb-4">
        <h2 className="text-base font-semibold text-slate-100">Declared systems &amp; roles</h2>
        <p className="text-sm leading-6 text-slate-400">
          A static map of real downstream repos/domains and their intended roles —
          not a live health check. The status labels below are declared, not measured
          from running services, and no uptime, confidence, or performance metrics are
          produced here. A live signal inventory is future work (PR C of #264).
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {DECLARED_SYSTEMS.map((system) => (
          <Card
            key={system.name}
            className="border-slate-800 bg-slate-950/70 text-slate-100 shadow-none"
          >
            <CardHeader className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-sm font-semibold text-slate-100">
                  {system.name}
                </CardTitle>
                <Badge
                  variant="secondary"
                  className="border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300"
                >
                  {system.status}
                </Badge>
              </div>
              <p className="text-xs leading-5 text-slate-400">{system.description}</p>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Current role
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-300">{system.role}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function RepoBoundaryPanel() {
  return (
    <Card className="mt-5 border-slate-800 bg-slate-950/70 text-slate-100 shadow-none sm:mt-8">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-100">
          Repo boundary awareness
        </CardTitle>
        <p className="text-sm leading-6 text-slate-400">
          Route before reasoning. Preserve uncertainty. Do not patch upstream data
          problems with frontend assumptions.
        </p>
      </CardHeader>
      <CardContent className="grid gap-2 pt-0 sm:grid-cols-2 lg:grid-cols-3">
        {REPO_BOUNDARIES.map((boundary) => (
          <div
            key={boundary}
            className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 font-mono text-xs text-slate-300"
          >
            {boundary}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function buildJsonFilename(artifact: OperatorSignalNoteV0): string {
  const safeNoteId = artifact.note_id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `operator_signal_note_v0_${safeNoteId}.json`;
}

function downloadTextFile(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ListPanel({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <Card className="min-w-0 border-gray-200 bg-white shadow-sm">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-sm font-semibold text-gray-900">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length > 0 ? (
          <ul className="space-y-2 text-sm text-gray-600">
            {items.map((item) => (
              <li key={item} className="flex min-w-0 gap-2">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e2640d]"
                  aria-hidden
                />
                <span className="min-w-0 break-words">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">{emptyLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SuggestedHandoffsPanel({
  handoffs,
}: {
  handoffs: SuggestedTiberHandoff[];
}) {
  return (
    <Card className="min-w-0 border-gray-200 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-900">
          Suggested TIBER handoffs
        </CardTitle>
        <p className="text-xs leading-5 text-gray-500">
          Read-only Observatory routing. These suggestions do not call repo
          APIs, mutate projections, or apply rankings.
        </p>
        <p className="text-xs leading-5 text-gray-500">
          Artifact names are planning scaffolds unless already defined in
          TIBER-Data.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3 text-sm text-orange-950">
          <div className="font-semibold">Current repo boundary model</div>
          <ul className="mt-2 space-y-1 leading-6">
            <li>TIBER-Data = truth/contracts</li>
            <li>TIBER-Teamstate = team interpretation</li>
            <li>TIBER-FORGE = fantasy signal/scoring</li>
            <li>TIBER-Rookies = rookie/prospect evaluation</li>
            <li>Role &amp; Opportunity = usage/role signal</li>
            <li>TIBER-Fantasy = operator-facing inspection/synthesis</li>
          </ul>
        </div>
        <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-2">
          {handoffs.map((handoff) => (
            <div
              key={`${handoff.repo}-${handoff.domain}`}
              className="min-w-0 rounded-2xl border border-gray-200 bg-[#fafafa] p-3 sm:p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="break-words text-sm font-semibold text-gray-900">
                    {handoff.repo.replace("TIBER-Fantasy / Stress Lab", "TIBER-Fantasy / Observatory")}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {handoff.domain}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="w-fit border-0 bg-gray-200 text-gray-700"
                >
                  {handoff.status}
                </Badge>
              </div>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                Claim class
              </div>
              <div className="mt-1 break-all font-mono text-xs text-gray-700">
                {handoff.claim_classification}
              </div>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                Likely required artifacts
              </div>
              <ul className="mt-1 flex flex-wrap gap-2">
                {handoff.required_artifact_types.map((artifactType) => (
                  <li
                    key={artifactType}
                    className="rounded-full border border-gray-200 bg-white px-2 py-1 font-mono text-[11px] text-gray-700"
                  >
                    {artifactType}
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                Why it matters
              </div>
              <p className="mt-1 break-words text-sm leading-6 text-gray-600">
                {handoff.reason}
              </p>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                Next check
              </div>
              <p className="mt-1 break-words text-sm leading-6 text-gray-600">
                {handoff.next_check}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ArtifactSummary({ artifact }: { artifact: OperatorSignalNoteV0 }) {
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const metricLabels = artifact.detected_metrics.map(
    (metric) =>
      `${metric.metric} (${metric.confidence}; ${metric.context}; sample filter: ${metric.sample_filter})`,
  );
  const entityLabels = artifact.entities.map(
    (entity) => `${entity.label} · ${entity.entity_type}`,
  );
  const rawJson = useMemo(() => JSON.stringify(artifact, null, 2), [artifact]);
  const handoffs = useMemo(
    () => buildSuggestedTiberHandoffs(artifact),
    [artifact],
  );

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(rawJson);
      setExportStatus("copied");
    } catch {
      setExportStatus("failed");
    }
  }

  function downloadJson() {
    downloadTextFile(
      rawJson,
      buildJsonFilename(artifact),
      "application/json;charset=utf-8",
    );
    setExportStatus("downloaded");
  }

  function downloadCsv() {
    downloadTextFile(
      serializeOperatorSignalNoteArtifactToCsv(artifact),
      `operator_signal_note_v0_${artifact.note_id.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`,
      "text/csv;charset=utf-8",
    );
    setExportStatus("downloaded");
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <Card className="min-w-0 border-gray-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="break-words text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 sm:tracking-[0.18em]">
                operator_signal_note_v0
              </div>
              <CardTitle className="mt-1 text-base font-semibold text-gray-900 sm:text-lg">
                Heuristic structured artifact
              </CardTitle>
            </div>
            <Badge
              variant="secondary"
              className="w-fit border-0 bg-amber-100 text-amber-800"
            >
              {artifact.reasoning_status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-3 text-sm text-gray-600 sm:gap-4 md:grid-cols-3">
          <div className="min-w-0 rounded-xl border border-gray-100 bg-[#fafafa] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Note ID
            </div>
            <div className="mt-1 break-all font-mono text-xs text-gray-900">
              {artifact.note_id}
            </div>
          </div>
          <div className="min-w-0 rounded-xl border border-gray-100 bg-[#fafafa] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Source type
            </div>
            <div className="mt-1 break-all font-mono text-xs text-gray-900">
              {artifact.source_type}
            </div>
          </div>
          <div className="min-w-0 rounded-xl border border-gray-100 bg-[#fafafa] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Created at
            </div>
            <div className="mt-1 break-all font-mono text-xs text-gray-900">
              {artifact.created_at}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 border-gray-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-gray-900">
                Export for review
              </CardTitle>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Copy or download the generated artifact client-side. No backend
                write or LLM call is made.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyJson}
                className="justify-center gap-2"
              >
                <Clipboard className="h-4 w-4" />
                Copy JSON
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadJson}
                className="justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download JSON
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadCsv}
                className="justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
          </div>
          {exportStatus !== "idle" ? (
            <p
              className={`text-xs ${exportStatus === "failed" ? "text-red-600" : "text-emerald-700"}`}
            >
              {exportStatus === "copied"
                ? "Artifact JSON copied to clipboard."
                : exportStatus === "downloaded"
                  ? "Artifact download started."
                  : "Clipboard copy failed. Use Download JSON instead."}
            </p>
          ) : null}
        </CardHeader>
      </Card>

      <Card className="min-w-0 border-gray-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-900">
            Human-readable interpretation summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="break-words text-sm leading-6 text-gray-600">
            {artifact.interpretation_summary}
          </p>
        </CardContent>
      </Card>

      <SuggestedHandoffsPanel handoffs={handoffs} />

      <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-2">
        <ListPanel
          title="Do-not-apply guardrails"
          items={artifact.do_not_apply}
          emptyLabel="No guardrails emitted."
        />
        <ListPanel
          title="Required follow-ups"
          items={artifact.required_followups}
          emptyLabel="No follow-ups emitted."
        />
        <ListPanel
          title="Uncertainty"
          items={artifact.uncertainty}
          emptyLabel="No uncertainty emitted."
        />
        <ListPanel
          title="Detected entities"
          items={entityLabels}
          emptyLabel="No player, team, or division entity was resolved by the v0 heuristic scaffold."
        />
        <ListPanel
          title="Detected metrics"
          items={metricLabels}
          emptyLabel="No conservative metric cues were detected."
        />
        <ListPanel
          title="Signal tags"
          items={artifact.signal_tags}
          emptyLabel="No signal tags emitted."
        />
      </div>

      <Card className="min-w-0 border-gray-200 bg-[#111827] text-white shadow-sm">
        <details>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold sm:px-6">
            <FileJson className="h-4 w-4 text-orange-300" />
            Raw JSON viewer
            <span className="ml-auto text-xs font-normal text-gray-300">
              Tap to expand
            </span>
          </summary>
          <CardContent className="pt-0">
            <pre className="max-h-[420px] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] leading-5 text-gray-100 sm:max-h-[520px] sm:p-4 sm:text-xs">
              {rawJson}
            </pre>
          </CardContent>
        </details>
      </Card>
    </div>
  );
}

export default function StressLab() {
  const [rawNote, setRawNote] = useState(SAMPLE_NOTE);
  const [artifact, setArtifact] = useState<OperatorSignalNoteV0 | null>(null);

  function inspectNote() {
    setArtifact(buildMockOperatorSignalNoteArtifact(rawNote));
  }

  return (
    <div className="min-h-screen bg-[#070b12] px-4 py-5 text-slate-100 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl overflow-x-hidden">
        <header className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(226,100,13,0.16),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-5 shadow-2xl shadow-black/30 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="flex min-w-0 items-center gap-3">
                <div className="shrink-0 rounded-2xl border border-orange-400/20 bg-orange-500/10 p-3">
                  <Telescope className="h-6 w-6 text-orange-300" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-200/80">
                    Inspectable reality only
                  </div>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    TIBER Observatory
                  </h1>
                </div>
              </div>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                Operator-facing inspection and routing surface for governed football intelligence systems.
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Paste a football note to inspect deterministic routing signals. The Observatory preserves uncertainty, exports JSON, and suggests repo handoffs without mutating rankings, projections, waivers, or upstream truth.
              </p>
            </div>

            <div className="min-w-0 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100 lg:max-w-sm">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4" />
                Read-only control surface
              </div>
              <p className="mt-2 leading-6 text-amber-100/85">
                No backend, database, artifact, LLM, RAG, or external API call is made by this page. Everything shown is computed client-side from the text you paste; no rankings, projections, waivers, or upstream truth are read or mutated.
              </p>
            </div>
          </div>
        </header>

        <SystemStatusSection />

        <section className="mt-5 grid min-w-0 gap-4 sm:mt-8 sm:gap-6 lg:grid-cols-[minmax(0,0.9fr),minmax(0,1.35fr)]">
          <Card className="min-w-0 border-slate-800 bg-slate-950/80 text-slate-100 shadow-none">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg font-semibold text-slate-100">
                Observatory input
              </CardTitle>
              <p className="text-sm leading-6 text-slate-400">
                Deterministic client-side heuristics only. Extraction confidence describes keyword matching, not source-truth confidence.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
              <Textarea
                value={rawNote}
                onChange={(event) => setRawNote(event.target.value)}
                className="min-h-[220px] resize-y border-slate-700 bg-slate-900 text-base leading-6 text-slate-100 placeholder:text-slate-500 focus-visible:ring-orange-400 sm:min-h-[260px] sm:text-sm"
                placeholder="Paste a football note here..."
              />
              <Button
                type="button"
                onClick={inspectNote}
                className="w-full bg-[#e2640d] text-white hover:bg-[#c7530b]"
              >
                Inspect note
              </Button>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  What TIBER cannot see yet
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
                  <li>• Canonical player/team IDs are not resolved in this v0 scaffold.</li>
                  <li>• Source metadata and film/stat verification are not attached.</li>
                  <li>• No downstream model, ranking, projection, or waiver state is changed.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="min-w-0">
            {artifact ? (
              <ArtifactSummary artifact={artifact} />
            ) : (
              <Card className="flex min-h-[300px] min-w-0 items-center justify-center border-dashed border-slate-700 bg-slate-950/60 text-slate-100 shadow-none sm:min-h-[420px]">
                <CardContent className="max-w-md p-5 text-center sm:p-8">
                  <Telescope className="mx-auto h-10 w-10 text-slate-500" />
                  <h2 className="mt-4 text-lg font-semibold text-slate-100">
                    Inspect a note to build a heuristic artifact
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    The Observatory output will show entities, signal tags, detected metrics, claim classifications, suggested repo handoffs, likely required artifacts, uncertainty, follow-ups, and export actions.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <RepoBoundaryPanel />
      </div>
    </div>
  );
}
