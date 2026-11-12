/**
 * Architecture Lab (TIBER-Fantasy #434) — UI-local graph shapes.
 *
 * These types describe a hand-curated, read-only fixture for one prototype page.
 * They are NOT canonical TIBER-Data contracts and nothing outside this folder
 * should import them.
 */

export const VERIFICATION_LEVELS = [
  'unknown',
  'documented_intent',
  'source_inspected',
  'test_verified',
  'runtime_verified',
] as const;

/**
 * How strongly a relationship is supported. Ordered weakest to strongest, and
 * deliberately never summarised as "working".
 *
 * - unknown            no evidence found; shown only as a proposed/candidate link
 * - documented_intent  a governing document says it should exist
 * - source_inspected   code or committed artifacts on at least one side were read at a pinned commit
 * - test_verified      a reproducible check was replayed against pinned sources (see `replay`)
 * - runtime_verified   observed in a running system (no edge in this fixture qualifies)
 */
export type Verification = (typeof VERIFICATION_LEVELS)[number];

export const REPO_IDS = [
  'data',
  'teamstate',
  'rop',
  'rookies',
  'forecast',
  'forge',
  'fantasy',
  'research',
  'ops',
] as const;
export type RepoId = (typeof REPO_IDS)[number];

/** Layers follow TIBER-Data's repo-boundaries doctrine, plus two off-flow groups. */
export const LAYER_IDS = ['contracts', 'reality', 'projection', 'adjudication', 'product', 'offflow'] as const;
export type LayerId = (typeof LAYER_IDS)[number];

export const EDGE_KINDS = ['data_flow', 'governance', 'candidate'] as const;
/**
 * - data_flow   a declared artifact / contract / HTTP exchange between repos
 * - governance  coordination or authority, not football data
 * - candidate   a proposed or suspected link with no supporting evidence yet
 */
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const EDGE_FLAGS = [
  'stale_copy',
  'interface_mismatch',
  'fixture_only',
  'inert',
  'archived_producer',
  'contradicted_by_source',
  'downstream_supplies_inputs',
] as const;
/** Review flags. Each one is a finding to look at, not a verdict. */
export type EdgeFlag = (typeof EDGE_FLAGS)[number];

/** A file in a seed repository at that repository's pinned commit. */
export interface FileEvidence {
  kind: 'file';
  repo: RepoId;
  path: string;
  line?: number;
  label: string;
  side: 'producer' | 'consumer' | 'doctrine';
}

/** A GitHub issue or pull request. Mutable, so never the only evidence for a code claim. */
export interface RecordEvidence {
  kind: 'record';
  url: string;
  label: string;
  side: 'doctrine';
}

export type Evidence = FileEvidence | RecordEvidence;

export interface Replay {
  /** What was replayed, in one line. */
  method: string;
  /** What came back. */
  result: string;
  performedAt: string;
}

export interface GraphNode {
  id: RepoId;
  label: string;
  /** owner/name on GitHub */
  ownerRepo: string;
  layer: LayerId;
  role: string;
  /** e.g. active, archived */
  lifecycle: 'active' | 'archived';
  /** Default-branch commit this fixture was checked against. */
  sourceCommit: string;
  /** Committer date of that commit (ISO 8601). */
  sourceCommitDate: string;
  owns: string[];
  evidence: Evidence[];
  notes?: string;
}

export interface GraphEdge {
  id: string;
  from: RepoId;
  to: RepoId;
  kind: EdgeKind;
  /** artifact, http, vendored_contract, governance … */
  interfaceKind: string;
  /** The specific contract, artifact or route this edge is about. */
  contract: string;
  verification: Verification;
  evidence: Evidence[];
  /** Date the evidence was read (ISO date). Required unless verification is unknown. */
  checkedAt?: string;
  flags: EdgeFlag[];
  /** What the evidence does establish. */
  proves: string;
  /** Why this is not proof of runtime behaviour. */
  doesNotProve: string;
  replay?: Replay;
  notes?: string;
}

export interface ArchitectureGraph {
  fixtureVersion: string;
  checkedAt: string;
  checkedBy: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
