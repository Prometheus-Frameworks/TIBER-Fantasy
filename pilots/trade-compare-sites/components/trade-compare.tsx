'use client';

import { useEffect, useRef, useState } from 'react';
import { PlayerStateCard } from './player-state-card';
import { revisionGuard } from '../lib/revision-guard.ts';
import { METRICS, PICKS, formatMetric, parseHistory, projectPlayerState, researchPacket, validateIds, HISTORY_ENDPOINT, type ReadResult } from '../lib/player-state.ts';

type Mode = 'compare' | 'trade';
type Side = 'give' | 'receive';

export default function TradeCompare() {
  const [ids, setIds] = useState<string[]>(['8112', '9487']);
  const [refresh, setRefresh] = useState(0);
  const [read, setRead] = useState<ReadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('compare');
  const [sides, setSides] = useState<Record<string, Side>>({ '8112': 'give', '9487': 'receive' });
  const [thesis, setThesis] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const generation = useRef(revisionGuard());
  const copyRevision = useRef(revisionGuard());
  const dialog = useRef<HTMLDialogElement>(null);
  const fingerprint = ids.join(',');

  function invalidateCopy() { copyRevision.current.invalidate(); setCopyStatus(''); }
  function changePlayers(next: string[]) {
    generation.current.invalidate(); invalidateCopy(); setRead(null); setError(null); setOpenId(null); setThesis('');
    setSides(Object.fromEntries(next.map((id, i) => [id, i === 0 ? 'give' : 'receive'])));
    setIds(next);
  }
  function reload() {
    generation.current.invalidate(); invalidateCopy(); setRead(null); setError(null); setOpenId(null); setThesis(''); setRefresh(v => v + 1);
  }

  useEffect(() => {
    const version = generation.current.begin();
    const controller = new AbortController();
    const selected = fingerprint.split(',');
    let timeout: ReturnType<typeof setTimeout>;
    setRead(null); setError(null);
    try { validateIds(selected); }
    catch { setLoading(false); setError('Choose distinct players in every slot.'); return; }
    setLoading(true);
    timeout = setTimeout(() => controller.abort(), 12000);
    (async () => {
      try {
        const response = await fetch('/api/compare?ids=' + encodeURIComponent(fingerprint), { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Read failed');
        const raw = await response.json() as ReadResult;
        if (raw.schema_version !== 'tiber_trade_compare_read_v0' || raw.transport?.endpoint !== HISTORY_ENDPOINT ||
            JSON.stringify(raw.selected_ids) !== JSON.stringify(selected) || !['available', 'unavailable'].includes(raw.status)) throw new Error('Scope mismatch');
        if (raw.history) raw.history = parseHistory(raw.history, selected);
        if (raw.status === 'available' && raw.history?.status !== 'available') throw new Error('History unavailable');
        if (!generation.current.isCurrent(version)) return;
        setRead(raw);
        if (raw.status === 'unavailable') setError(raw.reason ?? 'Historical evidence is unavailable.');
      } catch {
        if (generation.current.isCurrent(version)) setError('Historical evidence is unavailable. Reload to try again.');
      } finally {
        clearTimeout(timeout);
        if (generation.current.isCurrent(version)) setLoading(false);
      }
    })();
    return () => { generation.current.invalidate(); controller.abort(); clearTimeout(timeout); };
  }, [fingerprint, refresh]);

  useEffect(() => {
    const element = dialog.current;
    if (openId && element && !element.open) element.showModal();
    if (!openId && element?.open) element.close();
  }, [openId]);

  async function copyContext() {
    if (!read || loading) return;
    const revision = copyRevision.current.begin();
    setCopyStatus('Copying…');
    try {
      const packet = researchPacket(ids, read, sides, thesis, mode);
      await navigator.clipboard.writeText(JSON.stringify(packet, null, 2));
      if (copyRevision.current.isCurrent(revision)) setCopyStatus('Copied. Bring this evidence to your agent.');
    } catch { if (copyRevision.current.isCurrent(revision)) setCopyStatus('Copy unavailable. Your browser did not allow clipboard access.'); }
  }

  const cards = ids.map(id => projectPlayerState(id, read));
  const canCopy = !loading && read?.status === 'available';
  const opened = openId ? cards.find(c => c.identity.providerId === openId) : null;
  return <>
    <a className="tc-skip" href="#tc-main">Skip to comparison</a>
    <header className="tc-topbar"><a className="tc-brand" href="/" aria-label="TIBER Trade Compare home"><span className="tc-mark">T</span>TIBER<span className="tc-brand-separator">/</span><span className="tc-brand-sub">Trade research</span></a><span className="tc-private">Private pilot · v0</span></header>
    <main id="tc-main" className="tc-main">
      <section className="tc-intro"><p className="tc-eyebrow">A clearer view of the exchange</p><h1>Compare the players.<br /><em>Keep the decision yours.</em></h1><p className="tc-lead">Bring a few names to the table. Inspect what is supported, what you would exchange, and what still needs a witness.</p></section>
      <div className="tc-toolbar"><div className="tc-mode" role="group" aria-label="Comparison mode">{([['compare', 'Compare players'], ['trade', 'Explore as trade']] as const).map(([value, label]) => <button key={value} aria-pressed={mode === value} onClick={() => { invalidateCopy(); setMode(value); }}>{label}</button>)}</div><button className="tc-text-button" onClick={reload} disabled={loading}>↻ Reload evidence</button></div>
      <section className="tc-panel" aria-labelledby="tc-selected"><div className="tc-section-heading"><div><p className="tc-eyebrow">01 · The players</p><h2 id="tc-selected">A small, selected comparison</h2></div><span className="tc-caption">Up to three players</span></div>
        <div className="tc-selectors">{ids.map((id, i) => <div className="tc-selection" key={i}>
          <label htmlFor={'tc-player-' + i}>Player {i + 1}</label>
          <select id={'tc-player-' + i} value={id} onChange={e => changePlayers(ids.map((v, n) => n === i ? e.target.value : v))}>{PICKS.map(p => <option key={p.id} value={p.id} disabled={p.id !== id && ids.includes(p.id)}>{p.name}</option>)}</select>
          {mode === 'trade' && <div className="tc-side" role="group" aria-label={'Trade side for player ' + (i + 1)}>{(['give', 'receive'] as const).map(side => <button key={side} aria-pressed={sides[id] === side} onClick={() => { invalidateCopy(); setSides(v => ({ ...v, [id]: side })); }}>{side === 'give' ? 'Give' : 'Receive'}</button>)}</div>}
          {i === 2 && <button className="tc-text-button" onClick={() => changePlayers(ids.slice(0, 2))}>Remove third player</button>}
        </div>)}</div>
        {ids.length < 3 && <button className="tc-text-button tc-add" onClick={() => changePlayers([...ids, PICKS.find(p => !ids.includes(p.id))!.id])}>+ Add a third player</button>}
        <p className="tc-caption">Names are intake hints checked October 12, 2026. Exact Sleeper IDs resolve through the historical source; selection does not establish ownership.</p>
      </section>
      <section className="tc-evidence" aria-labelledby="tc-evidence-title" aria-busy={loading}>
        <div className="tc-section-heading"><div><p className="tc-eyebrow">02 · The evidence</p><h2 id="tc-evidence-title">History, with its limits intact</h2></div><span className="tc-window">2025 · W1–18</span></div>
        <div role="status" className="tc-load-status">{loading ? 'Loading selected historical evidence…' : error ?? 'Historical evidence loaded. Current weekly evidence remains unavailable.'}</div>
        <div className="tc-player-strip">{cards.map(card => <button className="tc-player-tile" key={card.identity.providerId} onClick={() => setOpenId(card.identity.providerId)} aria-haspopup="dialog">
          <span className="tc-tile-overline">{mode === 'trade' ? (sides[card.identity.providerId] === 'give' ? 'Give' : 'Receive') : 'Selected player'}</span><strong>{card.identity.name}</strong>
          <span className="tc-caption">Historical {card.identity.historicalPositions.join('/') || 'position unavailable'} · {card.identity.historicalTeams.join('/') || 'team unavailable'}</span>
          <span className="tc-tile-footer"><span>{loading ? 'Loading…' : card.historical ? `${card.historical.observed!.weeks.length} recorded weeks` : 'unavailable'}</span><span>Open card ↗</span></span>
        </button>)}</div>
        <div className="tc-table-scroll" role="region" aria-label="Historical player comparison; swipe to see all players" tabIndex={0}>
          <table className="tc-table"><caption>Derived means from 2025 recorded observations · each denominator stays visible</caption><thead><tr><th scope="col">Historical metric</th>{cards.map(c => <th key={c.identity.providerId} scope="col">{c.identity.name}</th>)}</tr></thead><tbody>{METRICS.map(([key, label, style]) => <tr key={key}><th scope="row">{label}</th>{cards.map(c => {
            const m = c.historical?.derived[key];
            return <td key={c.identity.providerId}><strong className={!m || m.mean === null ? 'tc-unavailable' : ''}>{loading ? 'Loading…' : formatMetric(m, style)}</strong><small>{loading ? 'Pending read' : m ? `${m.nonnull_weeks}/${m.recorded_weeks} recorded weeks` : 'Coverage unavailable'}</small></td>;
          })}</tr>)}</tbody></table>
        </div>
        <p className="tc-caption tc-table-note">Swipe the table on a phone. Different observation windows are not a matched-week comparison. Unrecorded weeks are unknown; mean weekly target share is not season share.</p>
      </section>
      <div className="tc-two-column">
        <section className="tc-panel"><p className="tc-eyebrow">03 · Missing witnesses</p><h2>What would sharpen the view?</h2><ul className="tc-witnesses"><li><strong>Current role & team environment</strong><span>unavailable · eligible weekly ROP and same-window Teamstate evidence are not connected.</span></li><li><strong>Actual fantasy points & opportunity xFP</strong><span>unavailable · historical points are withheld; no eligible xFP model or scoring contract.</span></li><li><strong>Forward outlook & next opponent</strong><span>unavailable · no eligible projection or schedule attachment.</span></li></ul><details><summary>What is changing?</summary><p>Comparable weekly change is unavailable. Historical full-window averages do not establish today’s role, a trend or future persistence.</p></details>
          {mode === 'trade' && <div className="tc-callout"><strong>Package context</strong><p>{ids.filter(id => sides[id] === 'give').length} selected to give · {ids.filter(id => sides[id] === 'receive').length} selected to receive.</p><p className="tc-caption">Roster fit, open slots and forced cuts: unavailable. Counterparty willingness: unknown. A package describes your idea, not an offer.</p></div>}
        </section>
        <section className="tc-panel tc-thesis"><p className="tc-eyebrow">04 · Your question</p><h2>Put your thesis beside the evidence.</h2><label htmlFor="tc-thesis">Operator note · optional</label><textarea id="tc-thesis" maxLength={1200} rows={4} value={thesis} onChange={e => { invalidateCopy(); setThesis(e.target.value); }} placeholder="What would have to be true for this exchange to work for me?" /><p className="tc-caption">Your judgment stays separate from player evidence. Kept only on this page; changing players or reloading clears it.</p><button className="tc-primary" onClick={copyContext} disabled={!canCopy}>Copy research context <span aria-hidden="true">↗</span></button><p className="tc-copy-status" role="status">{copyStatus}</p></section>
      </div>
      <details className="tc-scenario"><summary>Scenario boundary example · Will Shipley</summary><p><strong>Illustrative fixture only.</strong> “What if Barkley / Bigsby were unavailable?” is an operator-selected hypothetical. It is not an injury report.</p><dl><div><dt>Observed current role</dt><dd>unavailable</dd></div><div><dt>Teammate availability evidence</dt><dd>unavailable</dd></div><div><dt>Hypothetical redistribution</dt><dd>unmodeled</dd></div><div><dt>Forward projection</dt><dd>unavailable</dd></div></dl><p>No vacated work is assigned to a player. The missing witnesses are eligible current role, availability, team context and a separately qualified redistribution model.</p></details>
      <footer className="tc-footer"><p>TIBER prepares the decision. <strong>The manager makes it.</strong></p><p>Private pilot · read-only research · <a href="https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/416" target="_blank" rel="noreferrer">Pilot #416</a></p></footer>
    </main>
    <dialog ref={dialog} className="tc-dialog" aria-label="Player evidence card" onClose={() => setOpenId(null)} onClick={e => { if (e.target === dialog.current) setOpenId(null); }}><div className="tc-dialog-heading"><span>Evidence, player by player</span><button className="tc-close" autoFocus onClick={() => setOpenId(null)} aria-label="Close player evidence card">Close ×</button></div>{opened && <PlayerStateCard model={opened} />}</dialog>
  </>;
}
