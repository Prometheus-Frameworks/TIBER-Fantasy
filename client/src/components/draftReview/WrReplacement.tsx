import { useEffect, useRef, useState } from 'react';
import type { DraftReview } from '@/pages/TiberDraftReview';
import { currentWr, matchesHistory, matchesReplacement, referencePointsSchema, replacementHistorySchema, wrReplacementPacket, wrReplacementSchema, type ReferencePoints, type ReplacementHistory, type WrReplacement as Pool } from '@shared/wrReplacement';
export default function WrReplacement({ review, targetId }: { review: DraftReview; targetId: string }) {
  const [pool, setPool] = useState<Pool | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [archive, setArchive] = useState(false);
  const [limit, setLimit] = useState(20);
  const [benchId, setBenchId] = useState('');
  const [waiverId, setWaiverId] = useState('');
  const [history, setHistory] = useState<ReplacementHistory | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [constraints, setConstraints] = useState('');
  const [useReference, setUseReference] = useState(false);
  const [source, setSource] = useState('');
  const [basis, setBasis] = useState('');
  const [week, setWeek] = useState('1');
  const [asOf, setAsOf] = useState('');
  const [benchPoints, setBenchPoints] = useState('');
  const [waiverPoints, setWaiverPoints] = useState('');
  const sequence = useRef(0);
  function clearReference() { setUseReference(false); setSource(''); setBasis(''); setAsOf(''); setBenchPoints(''); setWaiverPoints(''); }
  function invalidatePair() { ++sequence.current; setHistory(null); setHistoryError(''); setCopyStatus(''); clearReference(); }
  useEffect(() => {
    let active = true; const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/draft-review/wr-replacement?sleeper_url=${encodeURIComponent(review.input.canonicalUrl)}&target_player_id=${targetId}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const raw = await response.text(); if (raw.length > 750000) throw new Error('Oversized response');
        const data = wrReplacementSchema.parse(JSON.parse(raw));
        if (!matchesReplacement(review, data, targetId)) throw new Error('Roster changed');
        if (active) setPool(data);
      } catch { if (active) setError('The WR pool could not be verified against this roster. Refresh your roster, then retry.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); ++sequence.current; };
  }, [review, targetId, refresh]);
  useEffect(() => {
    if (!benchId || !waiverId || !pool) return;
    let active = true; const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/draft-review/evidence?player_ids=${benchId},${waiverId}`, { cache:'no-store', signal:controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const data = replacementHistorySchema.parse(await response.json());
        if (!matchesHistory(data,[benchId,waiverId])) throw new Error('History mismatch');
        if (active) setHistory(data);
      } catch { if (active) setHistoryError('Historical comparison unavailable. You can still discuss this pair with that limitation.'); }
    })();
    return () => { active = false; controller.abort(); };
  },[benchId,waiverId,pool]);
  const bench = pool?.bench.find(p=>p.player_id===benchId);
  const waiver = pool?.unrostered.find(p=>p.player_id===waiverId);
  const candidates = pool?.unrostered.filter(p=>(archive || currentWr(p)) && p.name.toLocaleLowerCase('en').includes(query.toLocaleLowerCase('en'))) ?? [];
  let reference: ReferencePoints | null = null;
  if (useReference && benchPoints.trim() && waiverPoints.trim() && asOf) {
    const date = new Date(asOf);
    const parsed = referencePointsSchema.safeParse({kind:'manager_reported_external_projection',source,scoring_basis:basis,week:Number(week),as_of:Number.isFinite(date.getTime())?date.toISOString():'',points:[{player_id:benchId,value:Number(benchPoints)},{player_id:waiverId,value:Number(waiverPoints)}]});
    if (parsed.success) reference=parsed.data;
  }
  function editReference(action:()=>void) { ++sequence.current; setCopyStatus(''); action(); }
  async function copy() {
    if (!pool || !bench || !waiver || (useReference && !reference) || (!history && !historyError)) return;
    const current = ++sequence.current;
    try {
      const missing = {schema_version:'tiber_draft_review_historical_v1',status:'unavailable',reason:historyError,window:{season:2025},players:[]};
      await navigator.clipboard.writeText(JSON.stringify(wrReplacementPacket(review,pool,benchId,waiverId,reference,history??missing,constraints),null,2));
      if (sequence.current===current) setCopyStatus('Replacement comparison copied.');
    } catch { if (sequence.current===current) setCopyStatus('Could not copy. Check clipboard access and retry.'); }
  }
  function playerRow(p: Pool['target'], group:'bench'|'waiver') {
    const selected = group==='bench'?benchId===p.player_id:waiverId===p.player_id;
    return <button type="button" className="drp-wr-candidate" key={p.player_id} aria-pressed={selected} onClick={()=>{if(selected)return;invalidatePair();group==='bench'?setBenchId(p.player_id):setWaiverId(p.player_id);}}><strong>{p.name}</strong><span>{p.team??'Team unknown'} · {p.injury_status??'No designation reported'}</span>{p.active!==true && <small>Directory active status: {p.active===false?'false':'unknown'}</small>}</button>;
  }
  return <section className="drp-wr-replacement" aria-label="WR replacement outlook">
    <h3>WR replacement outlook</h3><p>Build a fallback if {pool?.target.name ?? 'this receiver'} is ruled out. Selecting a pair does not change the lineup.</p>
    <button type="button" className="drp-action" disabled={loading} onClick={()=>{invalidatePair();setPool(null);setBenchId('');setWaiverId('');setConstraints('');setError('');setLoading(true);setRefresh(r=>r+1);}}>Refresh WR pool</button>
    <div aria-live="polite">{loading && <p>Checking every league roster…</p>}{error && <p role="alert">{error}</p>}</div>
    {pool && <>
      <p className="drp-muted">Membership checked {new Date(pool.observations.received_at).toLocaleString()}. Unrostered does not establish claim eligibility. Kickoff times and locks are unavailable.</p>
      <p className="drp-boundary">Weekly TIBER forecast unavailable. Alphabetical order is not a ranking; historical coverage is not a measure of player quality.</p>
      <div className="drp-wr-pools"><div><h4>Your bench WRs · {pool.bench.length}</h4>{pool.bench.length?pool.bench.map(p=>playerRow(p,'bench')):<p>No bench WRs reported. A bench-versus-waiver pair cannot be formed.</p>}</div><div><h4>Unrostered WRs</h4><label>Find an unrostered WR<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(20);}} /></label><label className="drp-wr-check"><input type="checkbox" checked={archive} onChange={e=>{setArchive(e.target.checked);setLimit(20);}} /> Include inactive and team-unknown entries</label><p className="drp-muted">{candidates.length} matching · active recognized NFL teams by default; this is not injury clearance.</p>{candidates.slice(0,limit).map(p=>playerRow(p,'waiver'))}{!candidates.length && <p>No matching unrostered WRs.</p>}{candidates.length>limit && <button type="button" className="drp-action" onClick={()=>setLimit(n=>n+20)}>Show 20 more</button>}</div></div>
      {bench && waiver ? <div className="drp-wr-compare">
        <h4>{bench.name} or {waiver.name}?</h4><p>Your bench · {bench.name}. Unrostered when checked · {waiver.name}.</p>
        <h4>Historical opportunity evidence · 2025</h4><p>Per recorded nonnull week. These are historical observations, not current roles or forecasts.</p>
        {!history && !historyError && <p>Loading historical evidence…</p>}{historyError && <p>{historyError}</p>}
        {history && <div className="drp-wr-history">{[bench,waiver].map(p=>{const h=history.players.find(x=>x.player_id===p.player_id);return <article key={p.player_id}><b>{p.name}</b>{history.status==='available' && h?.status==='available'?<><p>Identity: {h.identity?.confidence??'unknown'} confidence ({h.identity?.match_method??'unknown'}).</p>{[['targets','Targets'],['receptions','Receptions'],['receiving_yards','Receiving yards']].map(([key,label])=><p key={key}>{label}: {h.derived[key]?.mean?.toFixed(2)??'Unavailable'}{h.derived[key]?.mean!=null?` across ${h.derived[key].nonnull_weeks} nonnull weeks`:''}</p>)}</>:<p>{h?.reason??history.reason??'Historical evidence unavailable.'}</p>}</article>;})}</div>}
        {history?.provenance && <p className="drp-muted">Historical source: <a href={history.provenance.attribution.source_url} target="_blank" rel="noreferrer">{history.provenance.attribution.name}</a> · <a href={history.provenance.attribution.license_url} target="_blank" rel="noreferrer">{history.provenance.attribution.license}</a>. TIBER aggregates recorded 2025 observations. {history.provenance.attribution.notice}</p>}
        <details><summary>Add external reference points (optional)</summary><label className="drp-wr-check"><input type="checkbox" checked={useReference} onChange={e=>editReference(()=>setUseReference(e.target.checked))} /> Include points I read from another source</label>
          {useReference && <div className="drp-wr-reference"><p>Enter values from the same source, week, scoring basis and observation time. These remain unverified values reported by you. They are not TIBER forecasts.</p><label>Projection source<input maxLength={120} value={source} onChange={e=>editReference(()=>setSource(e.target.value))} placeholder="e.g. Sleeper" /></label><label>Scoring basis<input maxLength={120} value={basis} onChange={e=>editReference(()=>setBasis(e.target.value))} placeholder="e.g. this league’s scoring" /></label><label>Projection week<input type="number" min="1" max="18" value={week} onChange={e=>editReference(()=>setWeek(e.target.value))} /></label><label>Observed at (your local time)<input type="datetime-local" value={asOf} onChange={e=>editReference(()=>setAsOf(e.target.value))} /></label><label>{bench.name} reference points<input type="number" step="0.01" value={benchPoints} onChange={e=>editReference(()=>setBenchPoints(e.target.value))} /></label><label>{waiver.name} reference points<input type="number" step="0.01" value={waiverPoints} onChange={e=>editReference(()=>setWaiverPoints(e.target.value))} /></label>{reference?<p>Reported point difference (bench minus waiver): {(reference.points[0].value-reference.points[1].value).toFixed(2)}. This difference alone does not establish a preferred move.</p>:<p>Complete every reference field to include these numbers in the handoff.</p>}</div>}
        </details>
        <label>My constraints (optional)<textarea maxLength={500} value={constraints} onChange={e=>editReference(()=>setConstraints(e.target.value))} placeholder="Players to preserve, keeper considerations, or willingness to make a claim" /></label>
        <button type="button" className="drp-action" disabled={(!history&&!historyError)||(useReference&&!reference)} onClick={()=>void copy()}>Discuss WR replacement</button><p role="status">{copyStatus}</p>
      </div>:<p>Select one bench receiver and one unrostered receiver to compare. No candidate is preselected.</p>}
      <details><summary>Sources and missing context</summary><p>Directory fetched {pool.observations.directory_fetched_at}; cached for up to 24 hours. Roster snapshot: {review.generated_at}. Reads are not atomic; refreshing this pool does not force the directory to refresh.</p><p>Historical evidence comes from the existing TIBER 2025 nflverse bundle; its full attribution and identity details accompany the handoff. Current routes, snaps, role forecasts, kickoff/claim timing and a required drop are not established here. Projection references clear when the pair changes. Inputs and constraints stay on this page and clear on refresh or closing.</p><ul>{pool.observations.source_urls.map(url=><li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul></details>
    </>}
  </section>;
}
