import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  Beaker,
  ChevronRight,
  Clipboard,
  Download,
  FileJson,
  ShieldCheck,
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
          Read-only v0 routing scaffolding. These suggestions do not call repo
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
            <li>Role &amp; Opportunity = usage/role signal</li>
            <li>TIBER-Fantasy = user-facing inspection/synthesis</li>
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
                    {handoff.repo}
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
                Mock structured artifact
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
    <div className="mx-auto max-w-6xl overflow-x-hidden px-4 py-4 sm:px-6 sm:py-8">
      <div className="mb-5 sm:mb-8">
        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 text-sm text-gray-400 sm:mb-4">
          <Link href="/" className="transition-colors hover:text-[#e2640d]">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            href="/tiber-data-lab"
            className="transition-colors hover:text-[#e2640d]"
          >
            Data Lab
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-gray-600">Stress Lab</span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="flex min-w-0 items-center gap-3">
                <div className="shrink-0 rounded-2xl bg-[#e2640d]/10 p-3">
                  <Beaker className="h-6 w-6 text-[#e2640d]" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Reasoning Sandbox · read-only v0
                  </div>
                  <h1 className="mt-1 text-2xl font-semibold text-gray-900 sm:text-3xl">
                    TIBER Stress Lab
                  </h1>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-600 sm:mt-5 sm:leading-7">
                Paste a freeform football note to inspect a mocked{" "}
                <span className="font-mono">operator_signal_note_v0</span>{" "}
                artifact for inspectable hypothesis extraction from operator
                notes. Operator notes generate hypotheses, not truth.
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-600 sm:leading-7">
                Stress Lab is for testing reasoning integrity, not changing
                rankings.
              </p>
            </div>

            <div className="min-w-0 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4 lg:max-w-sm">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4" />
                No mutation path
              </div>
              <p className="mt-2 leading-6">
                This page does not call an LLM, external API, backend write
                route, ranking service, waiver workflow, or projection engine.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,0.95fr),minmax(0,1.35fr)]">
        <Card className="min-w-0 border-gray-200 bg-white shadow-sm">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Operator note input
            </CardTitle>
            <p className="text-sm leading-6 text-gray-500">
              V0 uses deterministic client-side heuristics only. Extraction
              confidence describes keyword matching, not source-truth
              confidence.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            <Textarea
              value={rawNote}
              onChange={(event) => setRawNote(event.target.value)}
              className="min-h-[220px] resize-y text-base leading-6 sm:min-h-[260px] sm:text-sm"
              placeholder="Paste a football note here..."
            />
            <Button
              type="button"
              onClick={inspectNote}
              className="w-full bg-[#e2640d] text-white hover:bg-[#c7530b]"
            >
              Inspect note
            </Button>
            <div className="rounded-2xl border border-gray-200 bg-[#fafafa] p-3 sm:p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                What TIBER cannot see yet
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
                <li>
                  • Canonical player/team IDs are not resolved in this v0
                  scaffold.
                </li>
                <li>
                  • Source metadata and film/stat verification are not attached.
                </li>
                <li>
                  • No downstream model, ranking, projection, or waiver state is
                  changed.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0">
          {artifact ? (
            <ArtifactSummary artifact={artifact} />
          ) : (
            <Card className="flex min-h-[300px] min-w-0 items-center justify-center border-dashed border-gray-300 bg-[#fafafa] shadow-sm sm:min-h-[420px]">
              <CardContent className="max-w-md p-5 text-center sm:p-8">
                <Beaker className="mx-auto h-10 w-10 text-gray-300" />
                <h2 className="mt-4 text-lg font-semibold text-gray-900">
                  Inspect a note to generate a mock artifact
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  The output panel will show the structured contract fields,
                  heuristic cues, required follow-ups, guardrails, uncertainty,
                  and raw JSON.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
