/**
 * Pure graph helpers for the Architecture Lab (TIBER-Fantasy #434).
 * No React, no I/O: everything here is exercised directly by the jest tests.
 */
import {
  EDGE_FLAGS,
  EDGE_KINDS,
  LAYER_IDS,
  REPO_IDS,
  VERIFICATION_LEVELS,
  type ArchitectureGraph,
  type Evidence,
  type GraphEdge,
  type GraphNode,
  type RepoId,
  type Verification,
} from './types';

export const GITHUB_ORG_PREFIX = 'https://github.com/Prometheus-Frameworks/';

export const VERIFICATION_META: Record<Verification, { label: string; short: string; code: string; meaning: string }> = {
  unknown: {
    label: 'Unknown / proposed',
    short: 'Unknown',
    code: '?',
    meaning: 'No supporting evidence found. Shown only as a candidate.',
  },
  documented_intent: {
    label: 'Documented intent',
    short: 'Intent',
    code: 'D',
    meaning: 'A governing document says this should exist. No implementation was found or checked.',
  },
  source_inspected: {
    label: 'Source-inspected',
    short: 'Source',
    code: 'S',
    meaning: 'Code or committed artifacts were read at a pinned commit. Nothing was executed.',
  },
  test_verified: {
    label: 'Replay / test verified',
    short: 'Replayed',
    code: 'T',
    meaning: 'A reproducible check was re-run against pinned sources. It verifies exactly what the replay says, no more.',
  },
  runtime_verified: {
    label: 'Runtime observed',
    short: 'Runtime',
    code: 'R',
    meaning: 'Observed in a running system. No relationship in this fixture has been.',
  },
};

export const FLAG_META: Record<(typeof EDGE_FLAGS)[number], { label: string; meaning: string }> = {
  stale_copy: { label: 'Stale copy', meaning: 'The downstream copy trails the producer.' },
  interface_mismatch: { label: 'Interface mismatch', meaning: 'The two sides disagree about the interface as written.' },
  fixture_only: { label: 'Fixture only', meaning: 'Exercised with scaffold or fixture inputs, not governed data.' },
  inert: { label: 'Inert', meaning: 'Present but declared to have no downstream effect.' },
  archived_producer: { label: 'Archived repository', meaning: 'One side of this edge is an archived repository.' },
  contradicted_by_source: { label: 'Not found in source', meaning: 'The documents describe it; the code inspected does not implement it.' },
  downstream_supplies_inputs: {
    label: 'Downstream supplies inputs',
    meaning: 'A product-layer repository sends football inputs to an upstream layer.',
  },
};

export const verificationRank = (v: Verification): number => VERIFICATION_LEVELS.indexOf(v);

/** True when the edge has at least the evidence strength of `floor`. */
export const meetsFloor = (edge: GraphEdge, floor: Verification): boolean =>
  verificationRank(edge.verification) >= verificationRank(floor);

export function evidenceUrl(evidence: Evidence, nodes: GraphNode[]): string | null {
  if (evidence.kind === 'record') return evidence.url;
  const node = nodes.find((n) => n.id === evidence.repo);
  if (!node) return null;
  const anchor = evidence.line ? `#L${evidence.line}` : '';
  return `https://github.com/${node.ownerRepo}/blob/${node.sourceCommit}/${evidence.path}${anchor}`;
}

/** The flat `evidenceUrls` list from the issue's illustrative record. */
export const evidenceUrls = (item: { evidence: Evidence[] }, nodes: GraphNode[]): string[] =>
  item.evidence.map((e) => evidenceUrl(e, nodes)).filter((u): u is string => u !== null);

export interface Neighbors {
  /** Edges where this node is the producer. One hop. */
  outgoing: GraphEdge[];
  /** Edges where this node is the consumer. One hop. */
  incoming: GraphEdge[];
  consumers: RepoId[];
  producers: RepoId[];
}

export function neighborsOf(graph: ArchitectureGraph, id: RepoId): Neighbors {
  const outgoing = graph.edges.filter((e) => e.from === id);
  const incoming = graph.edges.filter((e) => e.to === id);
  return {
    outgoing,
    incoming,
    consumers: Array.from(new Set(outgoing.map((e) => e.to))),
    producers: Array.from(new Set(incoming.map((e) => e.from))),
  };
}

export interface CycleCandidate {
  /** Repositories on the cycle, in flow order, starting from the smallest id. */
  path: RepoId[];
  edgeIds: string[];
  /** Weakest evidence class among the edges that close the loop. */
  weakest: Verification;
}

/**
 * Find simple directed cycles among data-flow and candidate edges.
 *
 * A cycle here is a REVIEW CANDIDATE only. Two repositories exchanging a
 * request and a response is a cycle in this graph without being a case of
 * "downstream output used as upstream truth"; deciding that needs the fields
 * traced, which this fixture does not do. Governance edges are excluded
 * because they carry no football data.
 */
export function findCycleCandidates(graph: ArchitectureGraph): CycleCandidate[] {
  const edges = graph.edges.filter((e) => e.kind !== 'governance' && e.from !== e.to);
  const adjacency = new Map<RepoId, GraphEdge[]>();
  for (const edge of edges) {
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge]);
  }

  const found = new Map<string, CycleCandidate>();
  const ids = Array.from(new Set(graph.nodes.map((n) => n.id))).sort();

  const walk = (start: RepoId, current: RepoId, pathNodes: RepoId[], pathEdges: GraphEdge[]) => {
    for (const edge of adjacency.get(current) ?? []) {
      if (edge.to === start) {
        const loopEdges = [...pathEdges, edge];
        // Parallel contracts between the same pair produce the same node cycle; keep one entry per node path.
        const key = pathNodes.join('>');
        const existing = found.get(key);
        const edgeIds = Array.from(new Set([...(existing?.edgeIds ?? []), ...loopEdges.map((e) => e.id)])).sort();
        const all = graph.edges.filter((e) => edgeIds.includes(e.id));
        const weakest = all.reduce<Verification>(
          (acc, e) => (verificationRank(e.verification) < verificationRank(acc) ? e.verification : acc),
          'runtime_verified',
        );
        found.set(key, { path: [...pathNodes], edgeIds, weakest });
      } else if (edge.to > start && !pathNodes.includes(edge.to)) {
        // Only visit ids greater than the start so each cycle is reported once, from its smallest id.
        walk(start, edge.to, [...pathNodes, edge.to], [...pathEdges, edge]);
      }
    }
  };

  for (const id of ids) walk(id, id, [id], []);
  return Array.from(found.values()).sort((a, b) => a.path.join().localeCompare(b.path.join()));
}

export interface ValidationIssue {
  code: string;
  where: string;
  message: string;
}

const COMMIT_RE = /^[0-9a-f]{40}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RECORD_URL_RE = /^https:\/\/github\.com\/Prometheus-Frameworks\/[A-Za-z0-9._-]+\/(issues|pull)\/\d+(#[A-Za-z0-9_-]+)?$/;

const includes = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

function checkEvidence(evidence: Evidence[], where: string, nodeIds: Set<string>, issues: ValidationIssue[]) {
  evidence.forEach((item, index) => {
    const at = `${where}.evidence[${index}]`;
    if (!item.label?.trim()) issues.push({ code: 'evidence_label_missing', where: at, message: 'Evidence needs a label.' });
    if (item.kind === 'file') {
      if (!nodeIds.has(item.repo)) {
        issues.push({ code: 'evidence_repo_unknown', where: at, message: `Evidence repo "${item.repo}" is not a node.` });
      }
      if (!item.path || item.path.startsWith('/') || item.path.includes('..') || /^https?:/.test(item.path)) {
        issues.push({ code: 'evidence_path_invalid', where: at, message: 'Evidence path must be a repo-relative path.' });
      }
      if (item.line !== undefined && (!Number.isInteger(item.line) || item.line < 1)) {
        issues.push({ code: 'evidence_line_invalid', where: at, message: 'Evidence line must be a positive integer.' });
      }
    } else if (item.kind === 'record') {
      if (!RECORD_URL_RE.test(item.url)) {
        issues.push({ code: 'evidence_url_invalid', where: at, message: 'Record evidence must be a Prometheus-Frameworks issue or PR URL.' });
      }
    } else {
      issues.push({ code: 'evidence_kind_invalid', where: at, message: 'Unknown evidence kind.' });
    }
  });
}

/**
 * Validate a graph fixture. Returns every problem found; an empty list means
 * the fixture is internally consistent. It cannot tell whether a claim is
 * true, only whether the record is complete enough to be checked by a person.
 */
export function validateGraph(graph: ArchitectureGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<string>();

  if (!ISO_DATE_RE.test(graph.checkedAt ?? '')) {
    issues.push({ code: 'graph_checked_at_invalid', where: 'graph', message: 'checkedAt must be an ISO date.' });
  }

  for (const node of graph.nodes) {
    const where = `node:${node.id}`;
    if (nodeIds.has(node.id)) issues.push({ code: 'node_id_duplicate', where, message: `Duplicate node id "${node.id}".` });
    nodeIds.add(node.id);
    if (!includes(REPO_IDS, node.id)) issues.push({ code: 'node_id_unknown', where, message: 'Node id is not in REPO_IDS.' });
    if (!includes(LAYER_IDS, node.layer)) issues.push({ code: 'node_layer_invalid', where, message: 'Unknown layer.' });
    if (node.lifecycle !== 'active' && node.lifecycle !== 'archived') {
      issues.push({ code: 'node_lifecycle_invalid', where, message: 'Lifecycle must be active or archived.' });
    }
    if (!/^Prometheus-Frameworks\/[A-Za-z0-9._-]+$/.test(node.ownerRepo ?? '')) {
      issues.push({ code: 'node_owner_repo_invalid', where, message: 'ownerRepo must be Prometheus-Frameworks/<name>.' });
    }
    if (!COMMIT_RE.test(node.sourceCommit ?? '')) {
      issues.push({ code: 'node_commit_invalid', where, message: 'sourceCommit must be a full 40-character SHA.' });
    }
    if (Number.isNaN(Date.parse(node.sourceCommitDate ?? ''))) {
      issues.push({ code: 'node_commit_date_invalid', where, message: 'sourceCommitDate must be a parseable date.' });
    }
    if (!node.label?.trim() || !node.role?.trim()) {
      issues.push({ code: 'node_text_missing', where, message: 'Node needs a label and a role.' });
    }
    if (!node.evidence?.length) issues.push({ code: 'node_evidence_missing', where, message: 'Node needs at least one evidence item.' });
  }
  for (const node of graph.nodes) checkEvidence(node.evidence ?? [], `node:${node.id}`, nodeIds, issues);

  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    const where = `edge:${edge.id}`;
    if (edgeIds.has(edge.id)) issues.push({ code: 'edge_id_duplicate', where, message: `Duplicate edge id "${edge.id}".` });
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.from)) issues.push({ code: 'edge_from_missing', where, message: `from "${edge.from}" is not a node.` });
    if (!nodeIds.has(edge.to)) issues.push({ code: 'edge_to_missing', where, message: `to "${edge.to}" is not a node.` });
    if (edge.from === edge.to) issues.push({ code: 'edge_self_loop', where, message: 'Self-loops are not allowed.' });

    if (!includes(EDGE_KINDS, edge.kind)) issues.push({ code: 'edge_kind_invalid', where, message: 'Unknown edge kind.' });
    if (!includes(VERIFICATION_LEVELS, edge.verification)) {
      issues.push({ code: 'edge_verification_invalid', where, message: `Unknown verification "${String(edge.verification)}".` });
    }
    for (const flag of edge.flags ?? []) {
      if (!includes(EDGE_FLAGS, flag)) issues.push({ code: 'edge_flag_invalid', where, message: `Unknown flag "${String(flag)}".` });
    }
    if (!edge.contract?.trim() || !edge.interfaceKind?.trim()) {
      issues.push({ code: 'edge_contract_missing', where, message: 'Edge needs a contract and an interface kind.' });
    }
    if (!edge.proves?.trim() || !edge.doesNotProve?.trim()) {
      issues.push({ code: 'edge_limits_missing', where, message: 'Edge must say what the evidence proves and what it does not.' });
    }

    // Evidence strength must be earned.
    const isUnknown = edge.verification === 'unknown';
    if (!isUnknown) {
      if (!edge.evidence?.length) {
        issues.push({ code: 'edge_evidence_missing', where, message: 'A non-unknown edge needs at least one evidence item.' });
      }
      if (!ISO_DATE_RE.test(edge.checkedAt ?? '')) {
        issues.push({ code: 'edge_checked_at_missing', where, message: 'A non-unknown edge needs a checkedAt date.' });
      }
    }
    if (isUnknown !== (edge.kind === 'candidate')) {
      issues.push({
        code: 'edge_candidate_mismatch',
        where,
        message: 'Unknown verification and the candidate kind must go together: an unsupported link is a candidate, and a candidate is unsupported.',
      });
    }
    const sides = new Set((edge.evidence ?? []).map((e) => e.side));
    if (verificationRank(edge.verification) >= verificationRank('source_inspected') && !sides.has('producer') && !sides.has('consumer')) {
      issues.push({ code: 'edge_source_evidence_missing', where, message: 'Source-inspected or stronger needs producer or consumer file evidence.' });
    }
    if (edge.verification === 'test_verified') {
      if (!edge.replay?.method?.trim() || !edge.replay?.result?.trim() || !ISO_DATE_RE.test(edge.replay?.performedAt ?? '')) {
        issues.push({ code: 'edge_replay_missing', where, message: 'test_verified needs a replay record (method, result, date).' });
      }
      if (!sides.has('producer') || !sides.has('consumer')) {
        issues.push({ code: 'edge_replay_one_sided', where, message: 'test_verified needs evidence on both the producer and consumer side.' });
      }
    }
    if (edge.verification === 'runtime_verified') {
      issues.push({
        code: 'edge_runtime_unsupported',
        where,
        message: 'This fixture format has no runtime-observation record, so runtime_verified cannot be claimed.',
      });
    }
    checkEvidence(edge.evidence ?? [], where, nodeIds, issues);
  }

  return issues;
}

export interface FloorSummary {
  floor: Verification;
  /** Edges at or above the floor. */
  meeting: number;
  /** Edges exactly at this level. */
  exactly: number;
  total: number;
}

export function summarizeFloors(graph: ArchitectureGraph): FloorSummary[] {
  return VERIFICATION_LEVELS.map((floor) => ({
    floor,
    meeting: graph.edges.filter((e) => meetsFloor(e, floor)).length,
    exactly: graph.edges.filter((e) => e.verification === floor).length,
    total: graph.edges.length,
  }));
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

/**
 * The evidence matrix as Markdown: every edge, its claimed class, the pinned
 * files behind it, and why that is or is not proof of runtime behaviour.
 * docs/prototypes/architecture-lab/EVIDENCE_MATRIX.md is this output, and a
 * test fails if the two drift apart.
 */
export function renderEvidenceMatrixMarkdown(graph: ArchitectureGraph): string {
  const label = (id: RepoId) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  const lines: string[] = [
    '# Architecture Lab — evidence matrix',
    '',
    `Generated from \`client/src/pages/architectureLab/graphFixture.ts\` (${graph.fixtureVersion}, checked ${graph.checkedAt}).`,
    'Do not edit by hand: run `npx tsx scripts/architecture-lab/writeEvidenceMatrix.ts`.',
    '',
    'No relationship below is runtime-verified. "Replay / test verified" means the named replay was re-run against the pinned commits and nothing more.',
    '',
    '## Source pins',
    '',
    '| Repository | Lifecycle | Commit | Committed |',
    '| --- | --- | --- | --- |',
    ...graph.nodes.map(
      (n) => `| ${n.label} | ${n.lifecycle} | [\`${n.sourceCommit}\`](https://github.com/${n.ownerRepo}/tree/${n.sourceCommit}) | ${n.sourceCommitDate.slice(0, 10)} |`,
    ),
    '',
    '## Relationships',
    '',
    '| # | From → To | Contract / interface | Claimed class | Flags | Evidence (pinned) | What it shows | Why it is not runtime proof |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  graph.edges.forEach((edge, index) => {
    const evidence = edge.evidence
      .map((item) => {
        const url = evidenceUrl(item, graph.nodes);
        const where = item.kind === 'file' ? `${label(item.repo)}: \`${item.path}${item.line ? `:${item.line}` : ''}\`` : 'record';
        return `[${cell(item.label)}](${url}) (${item.side}; ${where})`;
      })
      .join('<br>');
    const shows = edge.replay ? `${edge.proves} Replay: ${edge.replay.result}` : edge.proves;
    lines.push(
      `| ${index + 1} | ${label(edge.from)} → ${label(edge.to)} | ${cell(edge.contract)} (${cell(edge.interfaceKind)}) | ${VERIFICATION_META[edge.verification].label} | ${
        edge.flags.length ? edge.flags.map((f) => FLAG_META[f].label).join(', ') : '—'
      } | ${evidence || '—'} | ${cell(shows)} | ${cell(edge.doesNotProve)} |`,
    );
  });
  const cycles = findCycleCandidates(graph);
  lines.push('', '## Cycle review candidates', '');
  if (cycles.length === 0) lines.push('None.');
  for (const cycle of cycles) {
    lines.push(
      `- ${[...cycle.path, cycle.path[0]].map(label).join(' → ')} — weakest link: ${VERIFICATION_META[cycle.weakest].label}. Edges: ${cycle.edgeIds.map((id) => `\`${id}\``).join(', ')}. A prompt to trace fields, not a finding of recursion.`,
    );
  }
  lines.push('');
  return lines.join('\n');
}
