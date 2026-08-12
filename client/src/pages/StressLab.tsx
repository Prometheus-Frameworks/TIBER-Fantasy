/**
 * Observatory surface (user-facing product name: "TIBER Observatory").
 *
 * Naming boundary (#264):
 * - The user-facing name is "Observatory" everywhere in visible copy and nav.
 * - The implementation file/component (`StressLab`) and its heuristic lib
 *   (`stressLab.ts`) keep their legacy/internal names for now.
 * - Routes `/`, `/observatory`, and `/stress-lab` intentionally resolve to this
 *   same surface today (`/stress-lab` is a legacy alias). See client/src/App.tsx.
 *
 * Behavior boundary (#264): the take-triage scaffold remains deterministic and
 * client-side. It makes no backend, DB, LLM, RAG, or external API call. The live
 * signal inventory performs one read-only GET against the existing Teamstate
 * Movement status endpoint. This page never writes, re-ranks, or mutates truth.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Clipboard,
  Download,
  FileJson,
  Route,
  ShieldCheck,
  Telescope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  buildMockOperatorSignalNoteArtifact,
  buildSuggestedTiberHandoffs,
  serializeOperatorSignalNoteArtifactToCsv,
  type OperatorSignalNoteV0,
  type SuggestedTiberHandoff,
} from "@/lib/stressLab";
import {
  getTeamEnvironmentMovementReadinessDetails,
  getTeamEnvironmentMovementSignalStatus,
  type TeamEnvironmentMovementResponse,
  type TeamEnvironmentMovementSignalStatus,
} from "@/lib/teamEnvironmentMovement";

const SAMPLE_NOTE =
  "WR note: Red Zone usage looks interesting, but target share may be inflated by game script. Check EPA/Play and Catchable Target context before trusting route role in the NFC North.";

type ExportStatus = "idle" | "copied" | "downloaded" | "failed";

type DeclaredSystem = {
  name: string;
  description: string;
  role: string;
};

const DECLARED_SYSTEMS: DeclaredSystem[] = [
  {
    name: "TIBER-Data",
    description: "Canonical contracts, IDs, source metadata, and governed handoff artifacts.",
    role: "Truth and contract authority for downstream interpretation.",
  },
  {
    name: "TIBER-Teamstate",
    description: "Team context and environment interpretation surfaced as handoff targets.",
    role: "Owns team-level interpretation after source truth is verified.",
  },
  {
    name: "TIBER-Rookies",
    description: "Promoted rookie and prospect evaluation consumed as read-only artifacts.",
    role: "Owns rookie model output and prospect evaluation framing.",
  },
  {
    name: "TIBER-FORGE",
    description: "Fantasy signal and scoring surface behind the rankings lane.",
    role: "Owns deterministic fantasy scoring over canonical inputs.",
  },
  {
    name: "Role & Opportunity",
    description: "Usage, route, and red-zone signal domain for note routing.",
    role: "Owns role checks before fantasy implications are applied.",
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

const SIGNAL_STATUS_STYLES: Record<TeamEnvironmentMovementSignalStatus, string> = {
  available: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  governed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  "fixture-only": "border-amber-400/30 bg-amber-400/10 text-amber-200",
  missing: "border-white/10 bg-white/5 text-slate-300",
  unavailable: "border-white/10 bg-white/5 text-slate-300",
};

function SignalInventorySection() {
  const movementQuery = useQuery<TeamEnvironmentMovementResponse, Error>({
    queryKey: ["/api/data-lab/team-environment-movement"],
    queryFn: async () => {
      const response = await fetch("/api/data-lab/team-environment-movement");
      return (await response.json()) as TeamEnvironmentMovementResponse;
    },
    retry: false,
  });

  const response = movementQuery.isError ? null : movementQuery.data ?? null;
  const { status, label } = getTeamEnvironmentMovementSignalStatus(response);
  const detailLines = movementQuery.isError
    ? ["Team environment movement status endpoint could not be reached in this deployment."]
    : getTeamEnvironmentMovementReadinessDetails(response);

  return (
    <Card className="rounded-xl border-white/[0.08] bg-[#111316] text-slate-100 shadow-none">
      <CardHeader className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--tmd-text-muted)]">
              TIBER signal inventory (live)
            </div>
            <h3 className="mt-1 text-sm font-semibold text-slate-100">
              Teamstate Movement artifact
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              The only operator-wide artifact status currently measured here.
            </p>
          </div>
          <Badge
            variant="secondary"
            role="status"
            aria-live="polite"
            className={`w-fit border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${SIGNAL_STATUS_STYLES[status]}`}
          >
            {movementQuery.isLoading ? "Checking" : label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
        {movementQuery.isLoading ? (
          <p className="text-xs text-slate-400">Checking artifact status…</p>
        ) : (
          <details className="rounded-xl border border-white/[0.07] bg-black/10">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-medium text-slate-300">
              View provenance and contract detail
              <span className="float-right font-normal text-[var(--tmd-text-muted)]">Technical detail</span>
            </summary>
            <div className="border-t border-white/[0.07] px-3 py-3 text-xs leading-5 text-slate-400">
              <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                <div>Artifact available: <span className="text-slate-200">{response?.artifactAvailable ? "yes" : "no"}</span></div>
                <div>Provenance: <span className="text-slate-200">{response?.provenanceStatus ?? "unknown"}</span></div>
                <div>Governance: <span className="text-slate-200">{response?.governance?.governanceStatus ?? "none"}</span></div>
                <div>Contract version: <span className="text-slate-200">{response?.governance?.contractVersion ?? "unknown"}</span></div>
                <div>Generated at: <span className="text-slate-200">{response?.generatedAt ?? "unknown"}</span></div>
                <div>Source path: <span className="break-all font-mono text-slate-300">{response?.source?.artifactPath ?? "unknown"}</span></div>
              </div>
              {detailLines.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-white/[0.07] pt-3">
                  {detailLines.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 break-all font-mono text-[10px] text-[var(--tmd-text-dim)]">
                team_environment_movement_v1 · /api/data-lab/team-environment-movement
              </p>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function RepoBoundaryPanel() {
  return (
    <div className="border-t border-white/[0.07] px-4 py-4 sm:px-5">
      <h3 className="text-sm font-semibold text-slate-200">Repo boundary awareness</h3>
      <p className="mt-1 text-xs leading-5 text-[var(--tmd-text-muted)]">
        Route before reasoning. Preserve uncertainty. Do not patch upstream data problems with frontend assumptions.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {REPO_BOUNDARIES.map((boundary) => (
          <div
            key={boundary}
            className="rounded-xl border border-white/[0.07] bg-black/10 px-3 py-2 font-mono text-[11px] text-slate-400"
          >
            {boundary}
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemStatusSection() {
  return (
    <section aria-labelledby="system-context-title" className="mt-8 sm:mt-10">
      <div className="mb-3">
        <h2 id="system-context-title" className="text-base font-semibold text-slate-100">
          System context
        </h2>
        <p className="mt-1 text-sm text-[var(--tmd-text-muted)]">
          Live availability first; architecture detail when you need it.
        </p>
      </div>

      <div className="space-y-3">
        <SignalInventorySection />

        <details className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d0e11]">
          <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-slate-300 sm:px-5">
            Declared systems &amp; roles
            <span className="float-right text-xs font-normal text-[var(--tmd-text-dim)]">Static map</span>
          </summary>
          <div className="border-t border-white/[0.07] px-4 py-4 sm:px-5">
            <p className="max-w-3xl text-xs leading-5 text-[var(--tmd-text-muted)]">
              A static ownership map, not a live health check. It makes no uptime, confidence, readiness, or performance claim.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {DECLARED_SYSTEMS.map((system) => (
                <div key={system.name} className="rounded-xl border border-white/[0.07] bg-[#111316] p-3.5">
                  <h3 className="text-sm font-semibold text-slate-200">{system.name}</h3>
                  <p className="mt-2 text-xs leading-5 text-[var(--tmd-text-muted)]">{system.description}</p>
                  <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs leading-5 text-slate-400">
                    {system.role}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <RepoBoundaryPanel />
        </details>
      </div>
    </section>
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

function ReviewList({
  title,
  items,
  emptyLabel,
  tone = "neutral",
}: {
  title: string;
  items: string[];
  emptyLabel: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <section
      className={`rounded-xl border p-4 ${
        tone === "warning"
          ? "border-amber-400/15 bg-amber-400/[0.05]"
          : "border-white/[0.07] bg-black/10"
      }`}
    >
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
          {items.map((item) => (
            <li key={item} className="flex min-w-0 gap-2.5">
              <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[#e2640d]" aria-hidden />
              <span className="min-w-0 break-words">{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[var(--tmd-text-muted)]">{emptyLabel}</p>
      )}
    </section>
  );
}

function FriendlyChips({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--tmd-text-muted)]">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function SuggestedHandoffsPanel({ handoffs }: { handoffs: SuggestedTiberHandoff[] }) {
  return (
    <section aria-labelledby="handoff-title">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-orange-400/15 bg-orange-500/10 p-2 text-orange-300">
          <Route className="h-4 w-4" />
        </div>
        <div>
          <h3 id="handoff-title" className="text-sm font-semibold text-slate-100">
            Where should it go?
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--tmd-text-muted)]">
            Suggested verification owners, not recommendations or automated repo calls.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        {handoffs.map((handoff) => (
          <article
            key={`${handoff.repo}-${handoff.domain}`}
            className="min-w-0 rounded-xl border border-white/[0.08] bg-[#0d0e11] p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h4 className="break-words text-sm font-semibold text-slate-200">
                  {handoff.repo.replace("TIBER-Fantasy / Stress Lab", "TIBER-Fantasy / Observatory")}
                </h4>
                <p className="mt-0.5 text-xs text-[var(--tmd-text-muted)]">{handoff.domain}</p>
              </div>
              <Badge
                variant="secondary"
                className="w-fit border border-white/[0.08] bg-white/[0.05] text-[10px] uppercase tracking-[0.12em] text-slate-400"
              >
                {handoff.status}
              </Badge>
            </div>

            <div className="mt-3 border-l-2 border-orange-500/40 pl-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--tmd-text-dim)]">
                Next check
              </div>
              <p className="mt-1 break-words text-sm leading-6 text-slate-300">{handoff.next_check}</p>
            </div>

            <details className="mt-3 border-t border-white/[0.07] pt-3">
              <summary className="cursor-pointer list-none text-xs font-medium text-[var(--tmd-text-muted)]">
                Why this route and what it may require
              </summary>
              <div className="mt-3 space-y-3 text-xs leading-5 text-[var(--tmd-text-muted)]">
                <p>{handoff.reason}</p>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--tmd-text-dim)]">
                    Claim class
                  </div>
                  <div className="mt-1 break-all font-mono text-slate-400">{handoff.claim_classification}</div>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {handoff.required_artifact_types.map((artifactType) => (
                    <li
                      key={artifactType}
                      className="rounded-full border border-white/[0.07] px-2 py-1 font-mono text-[10px] text-[var(--tmd-text-muted)]"
                    >
                      {artifactType}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}

function ArtifactSummary({ artifact }: { artifact: OperatorSignalNoteV0 }) {
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const entityLabels = artifact.entities.map(
    (entity) => `${entity.label} · ${entity.entity_type}`,
  );
  const metricLabels = artifact.detected_metrics.map((metric) =>
    metric.metric.replace(/_/g, " "),
  );
  const signalLabels = artifact.signal_tags.map((tag) => tag.replace(/_/g, " "));
  const rawJson = useMemo(() => JSON.stringify(artifact, null, 2), [artifact]);
  const handoffs = useMemo(() => buildSuggestedTiberHandoffs(artifact), [artifact]);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(rawJson);
      setExportStatus("copied");
    } catch {
      setExportStatus("failed");
    }
  }

  function downloadJson() {
    downloadTextFile(rawJson, buildJsonFilename(artifact), "application/json;charset=utf-8");
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
    <Card className="min-w-0 overflow-hidden rounded-xl border-white/[0.08] bg-[#111316] text-slate-100 shadow-none">
      <CardHeader className="border-b border-white/[0.07] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300/70">
              2 · Review the route
            </div>
            <h2 className="mt-1.5 text-lg font-semibold text-slate-100">
              TIBER found a review path
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--tmd-text-muted)]">
              Structured from your note. Still unverified and not fantasy advice.
            </p>
          </div>
          <Badge
            variant="secondary"
            className="w-fit border border-amber-400/20 bg-amber-400/10 text-[10px] uppercase tracking-[0.12em] text-amber-200"
          >
            {artifact.reasoning_status.replace(/_/g, " ")}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-4 sm:p-5">
        <section className="rounded-xl border border-orange-400/15 bg-orange-500/[0.06] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300/70">
            Plain-language read
          </div>
          <p className="mt-2 break-words text-sm leading-6 text-slate-200">
            {artifact.interpretation_summary}
          </p>
        </section>

        <section aria-labelledby="heard-title">
          <h3 id="heard-title" className="text-sm font-semibold text-slate-100">
            What did TIBER hear?
          </h3>
          <div className="mt-3 space-y-4">
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--tmd-text-dim)]">
                Entities
              </div>
              <FriendlyChips
                items={entityLabels}
                emptyLabel="No player, team, division, or season entity was resolved."
              />
            </div>
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--tmd-text-dim)]">
                Metric cues
              </div>
              <FriendlyChips items={metricLabels} emptyLabel="No conservative metric cues were detected." />
            </div>
            <details>
              <summary className="cursor-pointer list-none text-xs font-medium text-[var(--tmd-text-muted)]">
                View {signalLabels.length} signal tags
              </summary>
              <div className="mt-2">
                <FriendlyChips items={signalLabels} emptyLabel="No signal tags were emitted." />
              </div>
            </details>
          </div>
        </section>

        <ReviewList
          title="What needs checking next?"
          items={artifact.required_followups}
          emptyLabel="No follow-ups were emitted."
        />

        <SuggestedHandoffsPanel handoffs={handoffs} />

        <ReviewList
          title="Why is it still uncertain?"
          items={artifact.uncertainty}
          emptyLabel="No uncertainty statements were emitted."
          tone="warning"
        />

        <details className="overflow-hidden rounded-xl border border-white/[0.07] bg-black/10">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-300">
            Guardrails
            <span className="float-right text-xs font-normal text-[var(--tmd-text-dim)]">Do not apply</span>
          </summary>
          <div className="border-t border-white/[0.07] p-4">
            <ReviewList
              title="Do-not-apply guardrails"
              items={artifact.do_not_apply}
              emptyLabel="No guardrails were emitted."
            />
          </div>
        </details>

        <details className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d0e11]">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-300">
            Artifact details &amp; export
            <span className="float-right font-mono text-[10px] font-normal text-[var(--tmd-text-dim)]">
              operator_signal_note_v0
            </span>
          </summary>
          <div className="space-y-4 border-t border-white/[0.07] p-4">
            <div className="grid gap-3 text-xs sm:grid-cols-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--tmd-text-dim)]">Note ID</div>
                <div className="mt-1 break-all font-mono text-slate-400">{artifact.note_id}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--tmd-text-dim)]">Source</div>
                <div className="mt-1 break-all font-mono text-slate-400">{artifact.source_type}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--tmd-text-dim)]">Created</div>
                <div className="mt-1 break-all font-mono text-slate-400">{artifact.created_at}</div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyJson}
                className="justify-center border-white/10 bg-[#0d0e11] text-slate-300 hover:bg-white/5 hover:text-white"
              >
                <Clipboard className="h-4 w-4" />
                Copy JSON
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadJson}
                className="justify-center border-white/10 bg-[#0d0e11] text-slate-300 hover:bg-white/5 hover:text-white"
              >
                <Download className="h-4 w-4" />
                Download JSON
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadCsv}
                className="justify-center border-white/10 bg-[#0d0e11] text-slate-300 hover:bg-white/5 hover:text-white"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </div>

            {exportStatus !== "idle" ? (
              <p
                role={exportStatus === "failed" ? "alert" : "status"}
                aria-live={exportStatus === "failed" ? "assertive" : "polite"}
                className={`text-xs ${exportStatus === "failed" ? "text-red-300" : "text-emerald-300"}`}
              >
                {exportStatus === "copied"
                  ? "Artifact JSON copied to clipboard."
                  : exportStatus === "downloaded"
                    ? "Artifact download started."
                    : "Clipboard copy failed. Use Download JSON instead."}
              </p>
            ) : null}

            <details className="border-t border-white/[0.07] pt-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-[var(--tmd-text-muted)]">
                <FileJson className="h-4 w-4 text-orange-300/70" />
                Raw JSON viewer
              </summary>
              <pre className="mt-3 max-h-[420px] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/[0.07] bg-black/30 p-3 text-[11px] leading-5 text-slate-300">
                {rawJson}
              </pre>
            </details>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function EmptyReviewState() {
  return (
    <Card className="flex min-h-[360px] min-w-0 items-center rounded-xl border-white/[0.08] bg-[#0d0e11] text-slate-100 shadow-none">
      <CardContent className="w-full p-5 sm:p-7">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--tmd-text-dim)]">
          2 · Review the route
        </div>
        <Telescope className="mt-6 h-8 w-8 text-slate-600" />
        <h2 className="mt-4 text-lg font-semibold text-slate-200">
          Your review path will appear here
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--tmd-text-muted)]">
          Inspect a note and TIBER will organize the next human questions without deciding whether the claim is true.
        </p>
        <ol className="mt-6 grid gap-2 text-sm text-slate-400 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {[
            "What TIBER detected",
            "What still needs proof",
            "Which system owns the next check",
          ].map((step, index) => (
            <li key={step} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <span className="mr-2 font-mono text-xs text-orange-300/70">0{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export default function StressLab() {
  const [rawNote, setRawNote] = useState("");
  const [artifact, setArtifact] = useState<OperatorSignalNoteV0 | null>(null);

  function updateRawNote(nextNote: string) {
    setRawNote(nextNote);
    setArtifact(null);
  }

  function inspectNote() {
    if (!rawNote.trim()) return;
    setArtifact(buildMockOperatorSignalNoteArtifact(rawNote));
  }

  return (
    <div className="min-h-screen bg-[#07080a] px-4 py-6 text-slate-100 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-[1180px] overflow-x-hidden">
        <header className="border-b border-white/[0.07] pb-6 sm:pb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-orange-400/15 bg-orange-500/10 p-2.5">
                  <Telescope className="h-5 w-5 text-orange-300" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300/60">
                    Inspectable reality only
                  </div>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
                    TIBER Observatory
                  </h1>
                </div>
              </div>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Turn a football observation into an explicit review path.
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--tmd-text-muted)]">
                TIBER separates what it detected from what still needs evidence, then routes the claim to the system that owns the next check.
              </p>
            </div>

            <details className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#0d0e11] lg:w-[360px]">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-300">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Read-only control surface
                <span className="ml-auto text-xs font-normal text-[var(--tmd-text-dim)]">How it works</span>
              </summary>
              <p className="border-t border-white/[0.07] px-4 py-3 text-xs leading-5 text-[var(--tmd-text-muted)]">
                The take-checker is computed entirely client-side from the text you paste — no backend, database, LLM, RAG, or external API call. The live signal inventory makes one read-only status request. Nothing on this page writes, re-ranks, projects, or mutates upstream truth.
              </p>
            </details>
          </div>
        </header>

        <section className="mt-6 grid min-w-0 gap-4 lg:grid-cols-[minmax(320px,0.82fr),minmax(0,1.45fr)] lg:items-start">
          <Card className="min-w-0 rounded-xl border-white/[0.08] bg-[#111316] text-slate-100 shadow-none">
            <CardHeader className="p-4 sm:p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300/70">
                1 · Add an observation
              </div>
              <h2 className="mt-1 text-lg font-semibold text-slate-100">
                What are you seeing?
              </h2>
              <p className="text-sm leading-6 text-[var(--tmd-text-muted)]">
                Paste a camp report, role note, matchup idea, or player take.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
              <label htmlFor="observatory-note" className="sr-only">Football observation</label>
              <Textarea
                id="observatory-note"
                value={rawNote}
                onChange={(event) => updateRawNote(event.target.value)}
                className="min-h-[180px] resize-y border-slate-500 bg-[#090c12] text-sm leading-6 text-slate-100 placeholder:text-[var(--tmd-text-dim)] focus-visible:ring-[#e2640d] focus-visible:ring-offset-[#111316]"
                placeholder="Paste your football observation here…"
              />
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => updateRawNote(SAMPLE_NOTE)}
                  className="text-xs text-[var(--tmd-text-muted)] transition-colors hover:text-slate-300"
                >
                  Use an example
                </button>
                <span className="text-xs text-[var(--tmd-text-dim)]">{rawNote.trim().length} characters</span>
              </div>
              <Button
                type="button"
                onClick={inspectNote}
                disabled={!rawNote.trim()}
                className="w-full bg-ember text-primary-foreground hover:bg-ember/90"
              >
                Inspect note
              </Button>
              <p className="text-center text-[11px] text-[var(--tmd-text-dim)]">
                Local heuristic · no write · no ranking change
              </p>

              <details className="border-t border-white/[0.07] pt-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-[var(--tmd-text-muted)]">
                  <AlertTriangle className="h-4 w-4 text-amber-400/70" />
                  What this does not do
                </summary>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--tmd-text-muted)]">
                  <li>• Does not verify the analyst claim — it structures and routes the note for operator review.</li>
                  <li>• Does not check live NFL data, rankings, projections, injuries, betting lines, or social posts.</li>
                  <li>• No LLM or RAG: deterministic keyword heuristics only; canonical player and team IDs are not resolved.</li>
                  <li>• It does not generate fantasy advice or change any model, ranking, or projection state.</li>
                  <li>• You remain responsible for the final judgment.</li>
                </ul>
              </details>
            </CardContent>
          </Card>

          <div className="min-w-0">
            {artifact ? <ArtifactSummary artifact={artifact} /> : <EmptyReviewState />}
          </div>
        </section>

        <SystemStatusSection />
      </div>
    </div>
  );
}
