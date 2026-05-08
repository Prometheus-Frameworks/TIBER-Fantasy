import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, Beaker, ChevronRight, FileJson, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { buildMockOperatorSignalNoteArtifact, type OperatorSignalNoteV0 } from '@/lib/stressLab';

const SAMPLE_NOTE = 'WR note: Red Zone usage looks interesting, but target share may be inflated by game script. Check EPA/Play and Catchable Target context before trusting route role in the NFC North.';

function ListPanel({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <Card className="border-gray-200 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length > 0 ? (
          <ul className="space-y-2 text-sm text-gray-600">
            {items.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#e2640d]" aria-hidden />
                <span>{item}</span>
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

function ArtifactSummary({ artifact }: { artifact: OperatorSignalNoteV0 }) {
  const metricLabels = artifact.detected_metrics.map(
    (metric) => `${metric.metric} (${metric.confidence}; ${metric.context}; sample filter: ${metric.sample_filter})`,
  );
  const entityLabels = artifact.entities.map((entity) => `${entity.label} · ${entity.entity_type}`);
  const rawJson = useMemo(() => JSON.stringify(artifact, null, 2), [artifact]);

  return (
    <div className="space-y-5">
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                operator_signal_note_v0
              </div>
              <CardTitle className="mt-1 text-lg font-semibold text-gray-900">Mock structured artifact</CardTitle>
            </div>
            <Badge variant="secondary" className="border-0 bg-amber-100 text-amber-800">
              {artifact.reasoning_status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-gray-600 md:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Note ID</div>
            <div className="mt-1 break-all font-mono text-xs text-gray-900">{artifact.note_id}</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Source type</div>
            <div className="mt-1 font-mono text-xs text-gray-900">{artifact.source_type}</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Created at</div>
            <div className="mt-1 font-mono text-xs text-gray-900">{artifact.created_at}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-900">Human-readable interpretation summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm leading-6 text-gray-600">{artifact.interpretation_summary}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListPanel title="Detected entities" items={entityLabels} emptyLabel="No player, team, or division entity was resolved by the v0 heuristic scaffold." />
        <ListPanel title="Detected metrics" items={metricLabels} emptyLabel="No conservative metric cues were detected." />
        <ListPanel title="Signal tags" items={artifact.signal_tags} emptyLabel="No signal tags emitted." />
        <ListPanel title="Required follow-ups" items={artifact.required_followups} emptyLabel="No follow-ups emitted." />
        <ListPanel title="Uncertainty" items={artifact.uncertainty} emptyLabel="No uncertainty emitted." />
        <ListPanel title="Do-not-apply guardrails" items={artifact.do_not_apply} emptyLabel="No guardrails emitted." />
      </div>

      <Card className="border-gray-200 bg-[#111827] text-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-orange-300" />
            <CardTitle className="text-sm font-semibold">Raw JSON viewer</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <pre className="max-h-[520px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-5 text-gray-100">
            {rawJson}
          </pre>
        </CardContent>
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
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/" className="transition-colors hover:text-[#e2640d]">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/tiber-data-lab" className="transition-colors hover:text-[#e2640d]">
            Data Lab
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-gray-600">Stress Lab</span>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#e2640d]/10 p-3">
                  <Beaker className="h-6 w-6 text-[#e2640d]" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Reasoning Sandbox · read-only v0
                  </div>
                  <h1 className="mt-1 text-3xl font-semibold text-gray-900">TIBER Stress Lab</h1>
                </div>
              </div>
              <p className="mt-5 text-sm leading-7 text-gray-600">
                Paste a freeform football note to inspect a mocked <span className="font-mono">operator_signal_note_v0</span> artifact for inspectable hypothesis extraction from operator notes. Operator notes generate hypotheses, not truth.
              </p>
              <p className="mt-2 text-sm leading-7 text-gray-600">
                Stress Lab is for testing reasoning integrity, not changing rankings.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 lg:max-w-sm">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4" />
                No mutation path
              </div>
              <p className="mt-2 leading-6">
                This page does not call an LLM, external API, backend write route, ranking service, waiver workflow, or projection engine.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr),minmax(0,1.35fr)]">
        <Card className="border-gray-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Operator note input</CardTitle>
            <p className="text-sm leading-6 text-gray-500">
              V0 uses deterministic client-side heuristics only. Extraction confidence describes keyword matching, not source-truth confidence.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={rawNote}
              onChange={(event) => setRawNote(event.target.value)}
              className="min-h-[260px] resize-y text-sm leading-6"
              placeholder="Paste a football note here..."
            />
            <Button type="button" onClick={inspectNote} className="w-full bg-[#e2640d] text-white hover:bg-[#c7530b]">
              Inspect note
            </Button>
            <div className="rounded-2xl border border-gray-200 bg-[#fafafa] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                What TIBER cannot see yet
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
                <li>• Canonical player/team IDs are not resolved in this v0 scaffold.</li>
                <li>• Source metadata and film/stat verification are not attached.</li>
                <li>• No downstream model, ranking, projection, or waiver state is changed.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div>
          {artifact ? (
            <ArtifactSummary artifact={artifact} />
          ) : (
            <Card className="flex min-h-[420px] items-center justify-center border-dashed border-gray-300 bg-[#fafafa] shadow-sm">
              <CardContent className="max-w-md p-8 text-center">
                <Beaker className="mx-auto h-10 w-10 text-gray-300" />
                <h2 className="mt-4 text-lg font-semibold text-gray-900">Inspect a note to generate a mock artifact</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  The output panel will show the structured contract fields, heuristic cues, required follow-ups, guardrails, uncertainty, and raw JSON.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
