/**
 * Architecture Lab — experimental, read-only BIM-style explorer of the TIBER
 * repository ecosystem (TIBER-Fantasy #434).
 *
 * Prototype only. It renders one hand-curated fixture; it makes no network
 * calls, reads no database and has no backend of its own. See README.md in
 * this folder for what it does and does not establish.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ARCHITECTURE_GRAPH } from './graphFixture';
import {
  FLAG_META,
  VERIFICATION_META,
  evidenceUrl,
  findCycleCandidates,
  meetsFloor,
  neighborsOf,
  summarizeFloors,
  validateGraph,
} from './graphLogic';
import { EDGE_ROUTES, LAYER_BANDS, NODE_BOXES, SHEET, arrowHead, routeLabelPoint, routePath } from './layout';
import type { Evidence, GraphEdge, GraphNode, RepoId, Verification } from './types';
import './architectureLab.css';

type Selection = { type: 'node'; id: RepoId } | { type: 'edge'; id: string } | { type: 'cycle'; index: number } | null;
type Pane = 'model' | 'schedule';

interface ViewTransform {
  x: number;
  y: number;
  k: number;
}

const HOME: ViewTransform = { x: 0, y: 0, k: 1 };
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 5;

/** The four selectable evidence floors. "unknown" is not a floor: candidates are always drawn as candidates. */
const FLOORS: { floor: Verification; title: string; blurb: string }[] = [
  { floor: 'documented_intent', title: 'Design intent', blurb: 'Everything a document or source says exists.' },
  { floor: 'source_inspected', title: 'As-built: source', blurb: 'Only what was read in code or committed artifacts.' },
  { floor: 'test_verified', title: 'Replayed', blurb: 'Only what a re-run check confirmed.' },
  { floor: 'runtime_verified', title: 'Runtime observed', blurb: 'Only what was seen running.' },
];

const graph = ARCHITECTURE_GRAPH;
const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
const shortSha = (sha: string) => sha.slice(0, 7);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function VerificationChip({ level }: { level: Verification }) {
  const meta = VERIFICATION_META[level];
  return (
    <span className={`alab-chip alab-chip--${level}`} title={meta.meaning}>
      <span className="alab-chip-code" aria-hidden="true">{meta.code}</span>
      {meta.label}
    </span>
  );
}

function EvidenceList({ items, nodes }: { items: Evidence[]; nodes: GraphNode[] }) {
  if (items.length === 0) return <p className="alab-empty">No evidence recorded.</p>;
  return (
    <ul className="alab-evidence">
      {items.map((item, index) => {
        const url = evidenceUrl(item, nodes);
        const where =
          item.kind === 'file'
            ? `${nodeById.get(item.repo)?.label ?? item.repo} · ${item.path}${item.line ? `:${item.line}` : ''}`
            : 'Issue / PR record (mutable)';
        return (
          <li key={`${item.label}-${index}`}>
            <span className={`alab-side alab-side--${item.side}`}>{item.side}</span>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer noopener">{item.label}</a>
            ) : (
              <span>{item.label} (no link available)</span>
            )}
            <span className="alab-evidence-path">{where}</span>
          </li>
        );
      })}
    </ul>
  );
}

function EdgeRow({ edge, onSelect, direction }: { edge: GraphEdge; onSelect: (s: Selection) => void; direction: 'out' | 'in' }) {
  const other = nodeById.get(direction === 'out' ? edge.to : edge.from);
  return (
    <li>
      <button type="button" className="alab-link-row" onClick={() => onSelect({ type: 'edge', id: edge.id })}>
        <span className="alab-link-row-head">
          <span className="alab-arrow" aria-hidden="true">{direction === 'out' ? '→' : '←'}</span>
          <strong>{other?.label ?? '?'}</strong>
          <VerificationChip level={edge.verification} />
        </span>
        <span className="alab-link-row-contract">{edge.contract}</span>
        {edge.flags.length > 0 && (
          <span className="alab-link-row-flags">{edge.flags.map((f) => FLAG_META[f].label).join(' · ')}</span>
        )}
      </button>
    </li>
  );
}

export default function ArchitectureLab() {
  const issues = useMemo(() => validateGraph(graph), []);
  const cycles = useMemo(() => findCycleCandidates(graph), []);
  const floors = useMemo(() => summarizeFloors(graph), []);

  const [floor, setFloor] = useState<Verification>('documented_intent');
  const [selection, setSelection] = useState<Selection>(null);
  const [pane, setPane] = useState<Pane>('model');
  const [view, setView] = useState<ViewTransform>(HOME);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const inspectorRef = useRef<HTMLElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragMoved = useRef(false);

  useEffect(() => {
    document.title = 'Architecture Lab (prototype) - Tiber Fantasy';
  }, []);

  const select = useCallback((next: Selection) => {
    setSelection(next);
    if (next && window.matchMedia('(max-width: 900px)').matches) {
      window.setTimeout(() => {
        const el = inspectorRef.current;
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }, []);

  /** Screen pixels per sheet unit, for converting drags into sheet coordinates. */
  const pxPerUnit = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 1;
    return Math.min(rect.width / SHEET.width, rect.height / SHEET.height);
  }, []);

  const zoomBy = useCallback((factor: number, cx = SHEET.width / 2, cy = SHEET.height / 2) => {
    setView((v) => {
      const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
      const ratio = k / v.k;
      return { k, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio };
    });
  }, []);

  // Wheel zoom needs a non-passive listener so the page does not scroll under the sheet.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const scale = Math.min(rect.width / SHEET.width, rect.height / SHEET.height) || 1;
      const offsetX = (rect.width - SHEET.width * scale) / 2;
      const offsetY = (rect.height - SHEET.height * scale) / 2;
      const cx = (event.clientX - rect.left - offsetX) / scale;
      const cy = (event.clientY - rect.top - offsetY) / scale;
      zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15, cx, cy);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomBy, pane, issues.length]);

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragMoved.current = false;
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    const scale = pxPerUnit();

    if (pointers.current.size === 2) {
      const other = Array.from(pointers.current.entries()).find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(previous.x - other.x, previous.y - other.y);
        const after = Math.hypot(current.x - other.x, current.y - other.y);
        if (before > 0 && after > 0) zoomBy(after / before);
        dragMoved.current = true;
      }
    } else if (pointers.current.size === 1) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      if (Math.abs(dx) + Math.abs(dy) > 0) {
        if (!dragMoved.current && Math.hypot(dx, dy) > 3) {
          dragMoved.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }
        if (dragMoved.current) setView((v) => ({ ...v, x: v.x + dx / scale, y: v.y + dy / scale }));
      }
    }
    pointers.current.set(event.pointerId, current);
  };

  const onPointerEnd = (event: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
  };

  const onCanvasKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const step = 40 / view.k;
    const pan = (dx: number, dy: number) => setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    switch (event.key) {
      case 'ArrowLeft': pan(step, 0); break;
      case 'ArrowRight': pan(-step, 0); break;
      case 'ArrowUp': pan(0, step); break;
      case 'ArrowDown': pan(0, -step); break;
      case '+': case '=': zoomBy(1.2); break;
      case '-': case '_': zoomBy(1 / 1.2); break;
      case '0': setView(HOME); break;
      case 'Escape': setSelection(null); break;
      default: return;
    }
    event.preventDefault();
  };

  const activate = (next: Selection) => (event: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
    } else if (dragMoved.current) {
      return;
    }
    event.stopPropagation();
    select(next);
  };

  // ── What is highlighted for the current selection ─────────────────────────
  const highlight = useMemo(() => {
    const edgeIds = new Set<string>();
    const nodeIds = new Set<RepoId>();
    if (!selection) return { edgeIds, nodeIds, active: false };
    if (selection.type === 'node') {
      const n = neighborsOf(graph, selection.id);
      nodeIds.add(selection.id);
      [...n.outgoing, ...n.incoming].forEach((e) => {
        edgeIds.add(e.id);
        nodeIds.add(e.from);
        nodeIds.add(e.to);
      });
    } else if (selection.type === 'edge') {
      const edge = graph.edges.find((e) => e.id === selection.id);
      if (edge) {
        edgeIds.add(edge.id);
        nodeIds.add(edge.from);
        nodeIds.add(edge.to);
      }
    } else {
      const cycle = cycles[selection.index];
      cycle?.edgeIds.forEach((id) => edgeIds.add(id));
      cycle?.path.forEach((id) => nodeIds.add(id));
    }
    return { edgeIds, nodeIds, active: true };
  }, [selection, cycles]);

  const cycleEdgeIds = useMemo(() => new Set(cycles.flatMap((c) => c.edgeIds)), [cycles]);
  const floorSummary = floors.find((f) => f.floor === floor);
  const declaredCount = graph.edges.filter((e) => e.kind !== 'candidate').length;

  // ── Fail closed: an inconsistent fixture is not drawn ─────────────────────
  if (issues.length > 0) {
    return (
      <div className="alab-root">
        <div className="alab-window alab-window--error" role="alert">
          <div className="alab-titlebar">Architecture Lab — fixture rejected</div>
          <div className="alab-window-body">
            <p>
              The graph fixture failed validation, so nothing is drawn. A partly valid architecture
              picture would look more trustworthy than it is.
            </p>
            <ul>
              {issues.map((issue) => (
                <li key={`${issue.where}-${issue.code}`}>
                  <code>{issue.code}</code> at <code>{issue.where}</code>: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const selectedNode = selection?.type === 'node' ? nodeById.get(selection.id) : undefined;
  const selectedEdge = selection?.type === 'edge' ? graph.edges.find((e) => e.id === selection.id) : undefined;
  const selectedCycle = selection?.type === 'cycle' ? cycles[selection.index] : undefined;

  return (
    <div className="alab-root">
      <header className="alab-window alab-header">
        <div className="alab-titlebar">
          <span>TIBER Architecture Lab — sheet A-434</span>
          <span className="alab-titlebar-tag">PROTOTYPE · READ-ONLY</span>
        </div>
        <div className="alab-window-body alab-header-body">
          <p className="alab-lede">
            An as-built model of how nine TIBER repositories connect, where every line carries its
            evidence. Pick how much proof you require and see what is left standing.
          </p>

          <div className="alab-floors" role="radiogroup" aria-label="Evidence floor">
            {FLOORS.map((entry, index) => {
              const summary = floors.find((f) => f.floor === entry.floor);
              const checked = floor === entry.floor;
              return (
                <button
                  key={entry.floor}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={`alab-floor alab-floor--${entry.floor}${checked ? ' is-active' : ''}`}
                  onClick={() => setFloor(entry.floor)}
                  title={entry.blurb}
                >
                  <span className="alab-floor-level">{index + 1}</span>
                  <span className="alab-floor-title">{entry.title}</span>
                  <span className="alab-floor-count">
                    {summary?.meeting ?? 0}/{summary?.total ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="alab-toolbar">
            {/* Plain pressed-state buttons: the site stylesheet restyles role="tab" with !important. */}
            <div className="alab-tabs" role="group" aria-label="View">
              <button type="button" aria-pressed={pane === 'model'} className={pane === 'model' ? 'is-active' : ''} onClick={() => setPane('model')}>
                Model
              </button>
              <button type="button" aria-pressed={pane === 'schedule'} className={pane === 'schedule' ? 'is-active' : ''} onClick={() => setPane('schedule')}>
                Schedule
              </button>
            </div>
            <p className="alab-floor-status" aria-live="polite">
              <strong>{floorSummary?.meeting ?? 0} of {floorSummary?.total ?? 0}</strong> relationships reach “
              {FLOORS.find((f) => f.floor === floor)?.title}”.
              {floor === 'runtime_verified' && ' Nothing on this sheet has been observed running.'}
            </p>
          </div>
        </div>
      </header>

      <div className="alab-workspace">
        <section className="alab-window alab-stage" aria-label={pane === 'model' ? 'Architecture model' : 'Relationship schedule'}>
          <div className="alab-titlebar">
            <span>{pane === 'model' ? 'Model space' : 'Relationship schedule (evidence matrix)'}</span>
            {pane === 'model' && (
              <span className="alab-zoom">
                <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
                <button type="button" onClick={() => zoomBy(0.8)} aria-label="Zoom out">−</button>
                <button type="button" onClick={() => setView(HOME)} aria-label="Fit sheet to view">Fit</button>
              </span>
            )}
          </div>

          {pane === 'model' ? (
            <div className="alab-canvas-wrap">
              <svg
                ref={svgRef}
                className="alab-canvas"
                viewBox={`0 0 ${SHEET.width} ${SHEET.height}`}
                preserveAspectRatio="xMidYMid meet"
                tabIndex={0}
                role="group"
                aria-label="Architecture graph. Arrow keys pan, plus and minus zoom, zero fits the sheet. Tab moves through repositories and relationships."
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onPointerLeave={onPointerEnd}
                onKeyDown={onCanvasKeyDown}
                onClick={() => { if (!dragMoved.current) setSelection(null); }}
              >
                <defs>
                  <pattern id="alab-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" className="alab-grid-line" />
                  </pattern>
                  <pattern id="alab-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="8" className="alab-hatch-line" />
                  </pattern>
                </defs>

                <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
                  <rect x={-2000} y={-2000} width={5000} height={5400} fill="url(#alab-grid)" />

                  {LAYER_BANDS.map((band) => (
                    <rect key={band.id} x={24} y={band.y} width={SHEET.width - 48} height={band.h} rx={2} className={`alab-band alab-band--${band.id}`} />
                  ))}

                  {/* Highlighted edges draw last so they sit on top. */}
                  {[...graph.edges]
                    .sort((a, b) => Number(highlight.edgeIds.has(a.id)) - Number(highlight.edgeIds.has(b.id)))
                    .map((edge) => {
                      const points = EDGE_ROUTES[edge.id];
                      if (!points) return null;
                      const candidate = edge.kind === 'candidate';
                      const below = !candidate && !meetsFloor(edge, floor);
                      const lit = highlight.edgeIds.has(edge.id);
                      const dimmed = highlight.active && !lit;
                      const [lx, ly] = routeLabelPoint(points);
                      const d = routePath(points);
                      const meta = VERIFICATION_META[edge.verification];
                      const from = nodeById.get(edge.from)?.label;
                      const to = nodeById.get(edge.to)?.label;
                      const classes = [
                        'alab-edge',
                        `alab-edge--${edge.verification}`,
                        `alab-edge--${edge.kind}`,
                        below ? 'is-below' : '',
                        lit ? 'is-lit' : '',
                        dimmed ? 'is-dimmed' : '',
                        selection?.type === 'edge' && selection.id === edge.id ? 'is-selected' : '',
                      ].join(' ');
                      return (
                        <g
                          key={edge.id}
                          className={classes}
                          role="button"
                          tabIndex={0}
                          aria-label={`${from} to ${to}: ${edge.contract}. ${meta.label}${below ? ', below the selected evidence floor' : ''}${edge.flags.length ? `. Flags: ${edge.flags.map((f) => FLAG_META[f].label).join(', ')}` : ''}.`}
                          onClick={activate({ type: 'edge', id: edge.id })}
                          onKeyDown={activate({ type: 'edge', id: edge.id })}
                        >
                          <path d={d} className="alab-edge-hit" />
                          <path d={d} className="alab-edge-line" />
                          {edge.verification === 'test_verified' && !below && <path d={d} className="alab-edge-core" />}
                          <polygon points={arrowHead(points)} className="alab-edge-arrow" />
                          <g transform={`translate(${lx} ${ly})`} className="alab-edge-tag">
                            <circle r={9} />
                            <text y={3.5} textAnchor="middle">{below ? '·' : meta.code}</text>
                            {edge.flags.length > 0 && !below && <path d="M 6 -14 L 13 -3 L -1 -3 Z" className="alab-edge-flag" />}
                            {cycleEdgeIds.has(edge.id) && !below && <circle r={13} className="alab-edge-cycle" />}
                          </g>
                        </g>
                      );
                    })}

                  {/* Band labels sit above the runs so a crossing line never strikes through the text. */}
                  {LAYER_BANDS.map((band) => (
                    <text key={band.id} x={104} y={band.y + 19} className="alab-band-label">
                      <tspan className="alab-band-level">{band.level}</tspan>
                      <tspan dx={8} className="alab-band-title">{band.title.toUpperCase()}</tspan>
                      <tspan dx={10} className="alab-band-caption">{band.caption}</tspan>
                    </text>
                  ))}

                  {graph.nodes.map((node) => {
                    const box = NODE_BOXES[node.id];
                    const lit = highlight.nodeIds.has(node.id);
                    const dimmed = highlight.active && !lit;
                    const isSelected = selection?.type === 'node' && selection.id === node.id;
                    const n = neighborsOf(graph, node.id);
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${box.x} ${box.y})`}
                        className={`alab-node alab-node--${node.lifecycle}${isSelected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        aria-label={`${node.label}, ${node.lifecycle} repository. ${n.incoming.length} incoming and ${n.outgoing.length} outgoing relationships.`}
                        onClick={activate({ type: 'node', id: node.id })}
                        onKeyDown={activate({ type: 'node', id: node.id })}
                      >
                        <rect width={box.w} height={box.h} rx={3} className="alab-node-box" />
                        {node.lifecycle === 'archived' && <rect width={box.w} height={box.h} rx={3} fill="url(#alab-hatch)" className="alab-node-hatch" />}
                        <rect width={box.w} height={5} className="alab-node-cap" />
                        <text x={12} y={34} className="alab-node-label">{node.label}</text>
                        <text x={12} y={54} className="alab-node-sub">
                          {node.lifecycle === 'archived' ? 'ARCHIVED · ' : ''}@{shortSha(node.sourceCommit)}
                        </text>
                        <text x={12} y={72} className="alab-node-io">
                          in {n.incoming.length} · out {n.outgoing.length}
                        </text>
                      </g>
                    );
                  })}

                  {/* Title block, as on a drawing sheet: it is where the provenance lives. */}
                  <g transform={`translate(${SHEET.width - 330} ${SHEET.height - 94})`} className="alab-titleblock">
                    <rect width={306} height={74} />
                    <line x1={0} y1={24} x2={306} y2={24} />
                    <line x1={150} y1={24} x2={150} y2={74} />
                    <text x={8} y={16} className="alab-titleblock-main">TIBER ECOSYSTEM — AS-BUILT EVIDENCE MODEL</text>
                    <text x={8} y={40}>FIXTURE {graph.fixtureVersion}</text>
                    <text x={8} y={54}>CHECKED {graph.checkedAt}</text>
                    <text x={8} y={68}>VALIDATION {issues.length === 0 ? 'PASS' : 'FAIL'}</text>
                    <text x={158} y={40}>SHEET A-434</text>
                    <text x={158} y={54}>{graph.nodes.length} REPOS · {graph.edges.length} LINKS</text>
                    <text x={158} y={68} className="alab-titleblock-stamp">NOT FOR CONSTRUCTION</text>
                  </g>
                </g>
              </svg>

              <div className="alab-legend" aria-label="Legend">
                {(['documented_intent', 'source_inspected', 'test_verified', 'runtime_verified', 'unknown'] as Verification[]).map((level) => (
                  <span key={level} className="alab-legend-item" title={VERIFICATION_META[level].meaning}>
                    <svg width="34" height="12" aria-hidden="true" className={`alab-edge alab-edge--${level}`}>
                      <path d="M 1 6 L 33 6" className="alab-edge-line" />
                      {level === 'test_verified' && <path d="M 1 6 L 33 6" className="alab-edge-core" />}
                    </svg>
                    <span className="alab-legend-code">{VERIFICATION_META[level].code}</span>
                    {VERIFICATION_META[level].short}
                    {level === 'runtime_verified' && ' (none)'}
                  </span>
                ))}
                <span className="alab-legend-item"><span className="alab-legend-flag" aria-hidden="true">▲</span>review flag</span>
                <span className="alab-legend-item"><span className="alab-legend-ring" aria-hidden="true" />cycle candidate</span>
                <span className="alab-legend-item alab-legend-note">Faint dotted lines fall below the selected floor. Nothing here animates: motion is reserved for runtime-observed flow.</span>
              </div>
            </div>
          ) : (
            <div className="alab-schedule-wrap">
              <table className="alab-schedule">
                <caption>
                  Every relationship in the fixture, with the evidence class it claims and why that is not runtime proof.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">From → To</th>
                    <th scope="col">Contract / interface</th>
                    <th scope="col">Evidence class</th>
                    <th scope="col">Flags</th>
                    <th scope="col">Not proven</th>
                  </tr>
                </thead>
                <tbody>
                  {graph.edges.map((edge) => (
                    <tr
                      key={edge.id}
                      className={`${!meetsFloor(edge, floor) && edge.kind !== 'candidate' ? 'is-below' : ''}${selection?.type === 'edge' && selection.id === edge.id ? ' is-selected' : ''}`}
                    >
                      <th scope="row">
                        <button type="button" className="alab-schedule-link" onClick={() => select({ type: 'edge', id: edge.id })}>
                          {nodeById.get(edge.from)?.label} → {nodeById.get(edge.to)?.label}
                        </button>
                      </th>
                      <td>
                        {edge.contract}
                        <span className="alab-schedule-kind">{edge.interfaceKind}</span>
                      </td>
                      <td><VerificationChip level={edge.verification} /></td>
                      <td>{edge.flags.length ? edge.flags.map((f) => FLAG_META[f].label).join(', ') : '—'}</td>
                      <td>{edge.doesNotProve}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="alab-window alab-inspector" aria-label="Inspector" ref={inspectorRef}>
          <div className="alab-titlebar">
            <span>Inspector</span>
            <button
              type="button"
              className="alab-titlebar-close alab-back"
              onClick={() => svgRef.current?.closest('.alab-stage')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}
            >
              ↑ Model
            </button>
            {selection && (
              <button type="button" className="alab-titlebar-close" onClick={() => setSelection(null)} aria-label="Clear selection">×</button>
            )}
          </div>
          <div className="alab-window-body alab-inspector-body" aria-live="polite">
            {selectedNode && <NodeInspector node={selectedNode} onSelect={select} />}
            {selectedEdge && <EdgeInspector edge={selectedEdge} onSelect={select} inCycle={cycleEdgeIds.has(selectedEdge.id)} />}
            {selectedCycle && (
              <div>
                <p className="alab-kicker">Cycle review candidate</p>
                <h2>{selectedCycle.path.map((id) => nodeById.get(id)?.label).join(' → ')} → {nodeById.get(selectedCycle.path[0])?.label}</h2>
                <p>
                  These repositories form a directed cycle in this graph. That is a prompt to trace the
                  fields, not a finding that a downstream output is being reused as upstream truth.
                  The weakest link on the loop is <VerificationChip level={selectedCycle.weakest} />.
                </p>
                <ul className="alab-link-list">
                  {selectedCycle.edgeIds.map((id) => {
                    const edge = graph.edges.find((e) => e.id === id);
                    return edge ? <EdgeRow key={id} edge={edge} onSelect={select} direction="out" /> : null;
                  })}
                </ul>
              </div>
            )}
            {!selection && (
              <div>
                <p className="alab-kicker">Sheet overview</p>
                <h2>What this model can and cannot tell you</h2>
                <p>
                  Select a repository to see what it owns, what it reads and who reads from it. Select
                  a line to see the exact contract and the files behind it.
                </p>
                <dl className="alab-meta">
                  <div><dt>Checked</dt><dd>{graph.checkedAt}, by hand, against pinned commits</dd></div>
                  <div><dt>Scope</dt><dd>{graph.nodes.length} repositories, {declaredCount} declared relationships, {graph.edges.length - declaredCount} unverified candidate</dd></div>
                  <div><dt>Fixture</dt><dd>{graph.fixtureVersion} · validation passed</dd></div>
                </dl>

                <h3>Evidence by class</h3>
                <ul className="alab-tally">
                  {[...floors].reverse().map((entry) => (
                    <li key={entry.floor}>
                      <VerificationChip level={entry.floor} />
                      <span className="alab-tally-count">{entry.exactly}</span>
                    </li>
                  ))}
                </ul>
                <p className="alab-note">
                  No relationship is runtime-verified. This page did not call any service, and a
                  matching contract or committed artifact is not a running integration.
                </p>

                <h3>Cycle review candidates</h3>
                {cycles.length === 0 ? (
                  <p className="alab-empty">None in this fixture.</p>
                ) : (
                  <ul className="alab-link-list">
                    {cycles.map((cycle, index) => (
                      <li key={cycle.path.join('-')}>
                        <button type="button" className="alab-link-row" onClick={() => select({ type: 'cycle', index })}>
                          <span className="alab-link-row-head">
                            <strong>{cycle.path.map((id) => nodeById.get(id)?.label).join(' → ')} ↺</strong>
                          </span>
                          <span className="alab-link-row-contract">Weakest link: {VERIFICATION_META[cycle.weakest].label}. Needs tracing before any conclusion.</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <h3>Review flags</h3>
                <ul className="alab-link-list">
                  {graph.edges.filter((e) => e.flags.some((f) => f === 'stale_copy' || f === 'interface_mismatch' || f === 'contradicted_by_source')).map((edge) => (
                    <EdgeRow key={edge.id} edge={edge} onSelect={select} direction="out" />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function NodeInspector({ node, onSelect }: { node: GraphNode; onSelect: (s: Selection) => void }) {
  const n = neighborsOf(graph, node.id);
  const band = LAYER_BANDS.find((b) => b.id === node.layer);
  return (
    <div>
      <p className="alab-kicker">Repository · {band?.level} {band?.title}</p>
      <h2>{node.label}</h2>
      <p>{node.role}</p>
      <dl className="alab-meta">
        <div><dt>Lifecycle</dt><dd>{node.lifecycle}</dd></div>
        <div>
          <dt>Checked against</dt>
          <dd>
            <a href={`https://github.com/${node.ownerRepo}/tree/${node.sourceCommit}`} target="_blank" rel="noreferrer noopener">
              {node.ownerRepo}@{shortSha(node.sourceCommit)}
            </a>{' '}
            (committed {node.sourceCommitDate.slice(0, 10)})
          </dd>
        </div>
      </dl>
      {node.notes && <p className="alab-note">{node.notes}</p>}

      <h3>Owns</h3>
      <ul className="alab-plain">{node.owns.map((item) => <li key={item}>{item}</li>)}</ul>

      <h3>If this changes: who reads from it ({n.outgoing.length})</h3>
      {n.outgoing.length === 0 ? (
        <p className="alab-empty">No outgoing relationship is recorded. That means none was found in this pass, not that none exists.</p>
      ) : (
        <ul className="alab-link-list">{n.outgoing.map((e) => <EdgeRow key={e.id} edge={e} onSelect={onSelect} direction="out" />)}</ul>
      )}

      <h3>Reads from ({n.incoming.length})</h3>
      {n.incoming.length === 0 ? (
        <p className="alab-empty">No incoming relationship is recorded. That means none was found in this pass, not that none exists.</p>
      ) : (
        <ul className="alab-link-list">{n.incoming.map((e) => <EdgeRow key={e.id} edge={e} onSelect={onSelect} direction="in" />)}</ul>
      )}
      <p className="alab-note">One hop only. Impact beyond direct readers is not traced in this prototype.</p>

      <h3>Evidence</h3>
      <EvidenceList items={node.evidence} nodes={graph.nodes} />
    </div>
  );
}

function EdgeInspector({ edge, onSelect, inCycle }: { edge: GraphEdge; onSelect: (s: Selection) => void; inCycle: boolean }) {
  const from = nodeById.get(edge.from);
  const to = nodeById.get(edge.to);
  const meta = VERIFICATION_META[edge.verification];
  return (
    <div>
      <p className="alab-kicker">Relationship · {edge.kind.replace('_', ' ')} · {edge.interfaceKind}</p>
      <h2 className="alab-edge-title">
        <button type="button" onClick={() => onSelect({ type: 'node', id: edge.from })}>{from?.label}</button>
        <span aria-label="to"> → </span>
        <button type="button" onClick={() => onSelect({ type: 'node', id: edge.to })}>{to?.label}</button>
      </h2>
      <p className="alab-contract">{edge.contract}</p>

      <div className="alab-status-block">
        <VerificationChip level={edge.verification} />
        <p>{meta.meaning}</p>
      </div>

      {edge.flags.length > 0 && (
        <>
          <h3>Review flags</h3>
          <ul className="alab-flags">
            {edge.flags.map((flag) => (
              <li key={flag}><strong>{FLAG_META[flag].label}.</strong> {FLAG_META[flag].meaning}</li>
            ))}
          </ul>
        </>
      )}
      {inCycle && (
        <p className="alab-note">
          This line sits on a cycle review candidate. Cycles here are prompts to trace fields, not
          findings of recursion.
        </p>
      )}

      <h3>What the evidence shows</h3>
      <p>{edge.proves}</p>
      <h3>What it does not show</h3>
      <p>{edge.doesNotProve}</p>

      {edge.replay && (
        <>
          <h3>Replay ({edge.replay.performedAt})</h3>
          <p><strong>Method.</strong> {edge.replay.method}</p>
          <p><strong>Result.</strong> {edge.replay.result}</p>
        </>
      )}
      {edge.notes && <p className="alab-note">{edge.notes}</p>}

      <h3>Evidence</h3>
      <EvidenceList items={edge.evidence} nodes={graph.nodes} />

      <dl className="alab-meta">
        <div><dt>Checked</dt><dd>{edge.checkedAt ?? 'not checked — no evidence to check'}</dd></div>
        <div><dt>Producer pin</dt><dd>{from ? `${from.ownerRepo}@${shortSha(from.sourceCommit)}` : 'unknown'}</dd></div>
        <div><dt>Consumer pin</dt><dd>{to ? `${to.ownerRepo}@${shortSha(to.sourceCommit)}` : 'unknown'}</dd></div>
      </dl>
    </div>
  );
}
