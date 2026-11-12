/**
 * Fixture and logic checks for the Architecture Lab prototype (TIBER-Fantasy #434).
 * Pure functions only: no DOM, no network, no database.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { ARCHITECTURE_GRAPH, EDGES, NODES } from '../graphFixture';
import {
  GITHUB_ORG_PREFIX,
  evidenceUrls,
  findCycleCandidates,
  meetsFloor,
  neighborsOf,
  renderEvidenceMatrixMarkdown,
  summarizeFloors,
  validateGraph,
} from '../graphLogic';
import { EDGE_ROUTES, NODE_BOXES, SHEET } from '../layout';
import { REPO_IDS, VERIFICATION_LEVELS, type ArchitectureGraph, type GraphEdge } from '../types';

const clone = (): ArchitectureGraph => JSON.parse(JSON.stringify(ARCHITECTURE_GRAPH));
const codes = (graph: ArchitectureGraph) => validateGraph(graph).map((issue) => issue.code);
const edgeById = (graph: ArchitectureGraph, id: string): GraphEdge => {
  const edge = graph.edges.find((e) => e.id === id);
  if (!edge) throw new Error(`missing edge ${id}`);
  return edge;
};

describe('seed fixture', () => {
  test('passes validation with no issues', () => {
    expect(validateGraph(ARCHITECTURE_GRAPH)).toEqual([]);
  });

  test('covers exactly the nine seed repositories from the brief', () => {
    expect(NODES.map((n) => n.id).sort()).toEqual([...REPO_IDS].sort());
    expect(new Set(NODES.map((n) => n.id)).size).toBe(NODES.length);
    expect(NODES.find((n) => n.id === 'forge')?.lifecycle).toBe('archived');
  });

  test('edge ids are unique and every endpoint is a node', () => {
    const ids = new Set(NODES.map((n) => n.id));
    expect(new Set(EDGES.map((e) => e.id)).size).toBe(EDGES.length);
    for (const edge of EDGES) {
      expect(ids.has(edge.from)).toBe(true);
      expect(ids.has(edge.to)).toBe(true);
    }
  });

  test('every node pins a full commit SHA', () => {
    for (const node of NODES) expect(node.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
  });

  test('every evidence link resolves under the org and file links are pinned to the owning node commit', () => {
    for (const item of [...NODES, ...EDGES]) {
      const urls = evidenceUrls(item, NODES);
      expect(urls).toHaveLength(item.evidence.length);
      item.evidence.forEach((evidence, index) => {
        expect(urls[index].startsWith(GITHUB_ORG_PREFIX)).toBe(true);
        if (evidence.kind === 'file') {
          const owner = NODES.find((n) => n.id === evidence.repo);
          expect(urls[index]).toContain(`/${owner?.ownerRepo}/blob/${owner?.sourceCommit}/${evidence.path}`);
        }
      });
    }
  });

  test('no relationship is claimed as runtime verified', () => {
    expect(EDGES.filter((e) => e.verification === 'runtime_verified')).toEqual([]);
    expect(summarizeFloors(ARCHITECTURE_GRAPH).find((f) => f.floor === 'runtime_verified')?.meeting).toBe(0);
  });

  test('includes exactly one unverified candidate, kept separate from declared edges', () => {
    const candidates = EDGES.filter((e) => e.kind === 'candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].verification).toBe('unknown');
    expect(candidates[0].checkedAt).toBeUndefined();
    expect(EDGES.filter((e) => e.verification === 'unknown' && e.kind !== 'candidate')).toEqual([]);
  });

  test('every edge states what its evidence does not prove', () => {
    for (const edge of EDGES) expect(edge.doesNotProve.trim().length).toBeGreaterThan(20);
  });

  test('replay-verified edges carry a replay record and evidence on both sides', () => {
    const replayed = EDGES.filter((e) => e.verification === 'test_verified');
    expect(replayed.map((e) => e.id).sort()).toEqual([
      'data-fantasy-identity-crosswalk',
      'forecast-fantasy-weekly-player-card',
      'forge-fantasy-player-static',
    ]);
    for (const edge of replayed) {
      expect(edge.replay?.method).toBeTruthy();
      expect(edge.evidence.some((e) => e.side === 'producer')).toBe(true);
      expect(edge.evidence.some((e) => e.side === 'consumer')).toBe(true);
    }
  });

  test('every edge has a drawn route that starts and ends on its endpoint boxes', () => {
    const onBox = (id: keyof typeof NODE_BOXES, [x, y]: [number, number]) => {
      const b = NODE_BOXES[id];
      const inX = x >= b.x && x <= b.x + b.w;
      const inY = y >= b.y && y <= b.y + b.h;
      const onEdge = x === b.x || x === b.x + b.w || y === b.y || y === b.y + b.h;
      return inX && inY && onEdge;
    };
    expect(Object.keys(EDGE_ROUTES).sort()).toEqual(EDGES.map((e) => e.id).sort());
    for (const edge of EDGES) {
      const route = EDGE_ROUTES[edge.id];
      expect(onBox(edge.from, route[0])).toBe(true);
      expect(onBox(edge.to, route[route.length - 1])).toBe(true);
      for (let i = 1; i < route.length; i += 1) {
        const sameX = route[i][0] === route[i - 1][0];
        const sameY = route[i][1] === route[i - 1][1];
        expect(sameX !== sameY).toBe(true);
        expect(route[i][0]).toBeGreaterThanOrEqual(0);
        expect(route[i][0]).toBeLessThanOrEqual(SHEET.width);
        expect(route[i][1]).toBeLessThanOrEqual(SHEET.height);
      }
    }
  });
});

describe('validateGraph negative paths', () => {
  test('rejects a duplicate node id', () => {
    const graph = clone();
    graph.nodes.push({ ...graph.nodes[0] });
    expect(codes(graph)).toContain('node_id_duplicate');
  });

  test('rejects a duplicate edge id', () => {
    const graph = clone();
    graph.edges.push({ ...graph.edges[0] });
    expect(codes(graph)).toContain('edge_id_duplicate');
  });

  test('rejects an edge whose endpoint is not a node', () => {
    const graph = clone();
    (graph.edges[0] as { to: string }).to = 'tiber-nowhere';
    expect(codes(graph)).toContain('edge_to_missing');
  });

  test('rejects an unrecognised verification value such as "working"', () => {
    const graph = clone();
    (graph.edges[0] as { verification: string }).verification = 'working';
    expect(codes(graph)).toContain('edge_verification_invalid');
  });

  test('rejects a non-unknown edge with no evidence', () => {
    const graph = clone();
    edgeById(graph, 'rop-fantasy-role-opportunity-api').evidence = [];
    const found = codes(graph);
    expect(found).toContain('edge_evidence_missing');
    expect(found).toContain('edge_source_evidence_missing');
  });

  test('rejects a non-unknown edge with no checkedAt date', () => {
    const graph = clone();
    delete edgeById(graph, 'rop-fantasy-role-opportunity-api').checkedAt;
    expect(codes(graph)).toContain('edge_checked_at_missing');
  });

  test('rejects promoting the unverified candidate to a declared data flow', () => {
    const graph = clone();
    edgeById(graph, 'fantasy-research-league-context-candidate').kind = 'data_flow';
    expect(codes(graph)).toContain('edge_candidate_mismatch');
  });

  test('rejects upgrading documented intent to source-inspected on doctrine evidence alone', () => {
    const graph = clone();
    const edge = edgeById(graph, 'ops-fantasy-operator-gate');
    edge.evidence = edge.evidence.filter((e) => e.side === 'doctrine');
    edge.verification = 'source_inspected';
    expect(codes(graph)).toContain('edge_source_evidence_missing');
  });

  test('rejects test_verified without a replay record', () => {
    const graph = clone();
    delete edgeById(graph, 'forge-fantasy-player-static').replay;
    expect(codes(graph)).toContain('edge_replay_missing');
  });

  test('rejects any runtime_verified claim, because the fixture cannot record a runtime observation', () => {
    const graph = clone();
    edgeById(graph, 'forecast-fantasy-weekly-player-card').verification = 'runtime_verified';
    expect(codes(graph)).toContain('edge_runtime_unsupported');
  });

  test('rejects evidence that points outside the organisation or outside a repository', () => {
    const graph = clone();
    const edge = edgeById(graph, 'ops-fantasy-operator-gate');
    edge.evidence.push({ kind: 'record', url: 'https://example.com/issues/1', label: 'elsewhere', side: 'doctrine' });
    edge.evidence.push({ kind: 'file', repo: 'ops', path: '../secrets.env', label: 'escape', side: 'doctrine' });
    const found = codes(graph);
    expect(found).toContain('evidence_url_invalid');
    expect(found).toContain('evidence_path_invalid');
  });

  test('rejects an edge that does not say what it fails to prove', () => {
    const graph = clone();
    edgeById(graph, 'data-rop-compatibility-api').doesNotProve = ' ';
    expect(codes(graph)).toContain('edge_limits_missing');
  });

  test('rejects a short or missing commit pin', () => {
    const graph = clone();
    graph.nodes[0].sourceCommit = '7a13fda';
    expect(codes(graph)).toContain('node_commit_invalid');
  });
});

describe('impact tracing', () => {
  test('one-hop neighbours of TIBER-Data', () => {
    const n = neighborsOf(ARCHITECTURE_GRAPH, 'data');
    expect(n.incoming).toEqual([]);
    expect(n.consumers.sort()).toEqual(['fantasy', 'forecast', 'forge', 'rookies', 'rop', 'teamstate']);
    expect(n.outgoing).toHaveLength(8);
  });

  test('parallel contracts between the same pair stay separate edges', () => {
    const n = neighborsOf(ARCHITECTURE_GRAPH, 'fantasy');
    expect(n.incoming.filter((e) => e.from === 'data').map((e) => e.contract)).toHaveLength(3);
    expect(n.incoming.filter((e) => e.from === 'forge')).toHaveLength(2);
  });

  test('a repository with no evidence-backed data edge reports none rather than inventing one', () => {
    const n = neighborsOf(ARCHITECTURE_GRAPH, 'research');
    expect(n.outgoing).toEqual([]);
    expect(n.incoming.every((e) => e.kind === 'candidate')).toBe(true);
  });
});

describe('evidence floors', () => {
  test('levels are ordered weakest to strongest', () => {
    expect([...VERIFICATION_LEVELS]).toEqual(['unknown', 'documented_intent', 'source_inspected', 'test_verified', 'runtime_verified']);
  });

  test('raising the floor never increases the number of edges that meet it', () => {
    const counts = summarizeFloors(ARCHITECTURE_GRAPH).map((f) => f.meeting);
    for (let i = 1; i < counts.length; i += 1) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    expect(counts[0]).toBe(EDGES.length);
  });

  test('a documented-intent edge does not survive the source floor', () => {
    const edge = edgeById(ARCHITECTURE_GRAPH, 'forecast-forge-doctrine');
    expect(meetsFloor(edge, 'documented_intent')).toBe(true);
    expect(meetsFloor(edge, 'source_inspected')).toBe(false);
  });
});

describe('cycle review candidates', () => {
  test('finds the two cycles in the seed and reports their weakest link', () => {
    const cycles = findCycleCandidates(ARCHITECTURE_GRAPH);
    expect(cycles.map((c) => c.path)).toEqual([
      ['fantasy', 'forecast'],
      ['fantasy', 'forecast', 'forge'],
    ]);
    expect(cycles[0].weakest).toBe('source_inspected');
    expect(cycles[1].weakest).toBe('documented_intent');
    expect(cycles[1].edgeIds).toEqual(
      expect.arrayContaining(['forecast-forge-doctrine', 'forge-fantasy-player-static', 'forge-fantasy-evaluations-http']),
    );
  });

  test('governance edges never form a cycle candidate', () => {
    const graph = clone();
    graph.edges.push({
      ...edgeById(graph, 'ops-fantasy-operator-gate'),
      id: 'fantasy-ops-synthetic',
      from: 'fantasy',
      to: 'ops',
    });
    expect(findCycleCandidates(graph).some((c) => c.path.includes('ops'))).toBe(false);
  });

  test('an acyclic graph yields none', () => {
    const graph = clone();
    graph.edges = graph.edges.filter((e) => e.id !== 'fantasy-forecast-weekly-player-request');
    expect(findCycleCandidates(graph)).toEqual([]);
  });
});

describe('route containment', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const read = (relative: string) => readFileSync(path.join(repoRoot, relative), 'utf8');

  test('/architecture-lab is registered once, only in the full-profile switch, and /architecture is untouched', () => {
    const app = read('client/src/App.tsx');
    expect(app.match(/path="\/architecture-lab"/g)).toHaveLength(1);
    const restrictedShell = app.slice(app.indexOf('publicDraftReviewOnly'), app.indexOf('All routes share the unified dark TiberLayout shell'));
    expect(restrictedShell.length).toBeGreaterThan(0);
    expect(restrictedShell).not.toContain('architecture-lab');
    expect(app).toContain('<Route path="/architecture" component={Architecture} />');
  });

  test('the committed evidence matrix matches the fixture', () => {
    expect(read('docs/prototypes/architecture-lab/EVIDENCE_MATRIX.md')).toBe(renderEvidenceMatrixMarkdown(ARCHITECTURE_GRAPH));
  });

  test('no navigation entry points at the lab', () => {
    expect(read('client/src/components/TiberLayout.tsx')).not.toContain('architecture-lab');
  });

  test('the lab makes no network call and reads no environment', () => {
    const dir = path.join(repoRoot, 'client/src/pages/architectureLab');
    for (const name of ['ArchitectureLab.tsx', 'graphFixture.ts', 'graphLogic.ts', 'layout.ts', 'types.ts']) {
      const source = readFileSync(path.join(dir, name), 'utf8');
      expect(source).not.toMatch(/\bfetch\(|XMLHttpRequest|useQuery|apiRequest|import\.meta\.env|process\.env|WebSocket|localStorage/);
    }
  });
});
