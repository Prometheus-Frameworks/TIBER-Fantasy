import { useCallback, useEffect, useRef, useState } from 'react';
import { accountSchema, csrfSchema, signedInSchema, signInChallengeSchema, linkPreviewSchema,
  loadGoogleButton, teamAccountRequest, TeamAccountRequestError, type TeamAccountState, type SignInChallenge } from '@/lib/teamAccountApi';
import type { z } from 'zod';

export default function TeamAccount({ onChange, recheckKey }: {
  onChange: (account: TeamAccountState | null) => void; recheckKey: number;
}) {
  const [account, setAccount] = useState<TeamAccountState | null>(null);
  const [status, setStatus] = useState<'checking' | 'signed_out' | 'unavailable' | 'authenticated'>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [challenge, setChallenge] = useState<SignInChallenge | null>(null);
  const [preview, setPreview] = useState<z.infer<typeof linkPreviewSchema> | null>(null);
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const epoch = useRef(0);
  const controller = useRef<AbortController>();
  const channel = useRef<BroadcastChannel>();
  const button = useRef<HTMLDivElement>(null);
  const currentStatus = useRef(status); currentStatus.current = status;
  const signInActive = useRef(false); signInActive.current = busy || challenge !== null;
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;

  const begin = useCallback(() => {
    ++epoch.current; controller.current?.abort(); controller.current = new AbortController();
    setAccount(null); onChangeRef.current(null); setPreview(null); setChallenge(null); setError('');
    return { id: epoch.current, signal: controller.current.signal };
  }, []);
  const failure = useCallback((id: number, message: string) => {
    if (epoch.current !== id) return;
    setAccount(null); onChangeRef.current(null); setPreview(null); setChallenge(null);
    setStatus('unavailable'); setBusy(false); setError(message);
  }, []);
  const check = useCallback(async () => {
    const { id, signal } = begin(); setStatus('checking'); setBusy(false);
    try {
      const session = signedInSchema.parse(await teamAccountRequest('/api/auth/session', { signal }));
      const bootstrap = csrfSchema.parse(await teamAccountRequest('/api/auth/bootstrap', { signal }));
      const body = accountSchema.parse(await teamAccountRequest('/api/team-private/sleeper-link', { signal }));
      if (epoch.current !== id) return;
      if (session.user.id !== body.user.id) throw new Error('Identity changed');
      const next = { ...body, csrfToken: bootstrap.csrfToken, revision: id };
      setAccount(next); setStatus('authenticated'); onChangeRef.current(next);
    } catch (caught) {
      if (epoch.current !== id) return;
      if (caught instanceof TeamAccountRequestError && caught.status === 401) setStatus('signed_out');
      else failure(id, 'Account access is unavailable. You can still look up public Sleeper leagues.');
    }
  }, [begin, failure]);

  useEffect(() => {
    if (recheckKey === 0) void check();
    else {
      const { id } = begin();
      failure(id, 'Account access changed. Recheck your account to continue.');
      setExpanded(true);
    }
    const refresh = () => {
      // Discover a login from another tab even when its broadcast was missed.
      // Focus returning from our own Google popup must preserve its challenge.
      const canRefresh = currentStatus.current === 'authenticated' ||
        (currentStatus.current === 'signed_out' && !signInActive.current);
      if (document.visibilityState !== 'hidden' && canRefresh) void check();
    };
    const hide = () => { if (currentStatus.current === 'authenticated') { begin(); setStatus('checking'); } };
    const show = (event: PageTransitionEvent) => { if (event.persisted || currentStatus.current === 'checking') void check(); };
    const visibility = () => { if (document.visibilityState !== 'hidden' && currentStatus.current === 'checking') void check(); else refresh(); };
    window.addEventListener('focus', refresh); window.addEventListener('pagehide', hide); window.addEventListener('pageshow', show);
    document.addEventListener('visibilitychange', visibility);
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('tiber-account-change');
      channel.current.onmessage = () => void check();
    }
    return () => {
      ++epoch.current; controller.current?.abort(); channel.current?.close(); channel.current = undefined;
      window.removeEventListener('focus', refresh); window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [check, begin, failure, recheckKey]);

  async function startLogin() {
    const { id, signal } = begin(); setBusy(true); setStatus('signed_out');
    try {
      const body = await teamAccountRequest('/api/auth/bootstrap', { signal });
      if (epoch.current !== id) return;
      if (body?.status === 'authenticated') { await check(); return; }
      setChallenge(signInChallengeSchema.parse(body)); setBusy(false); setExpanded(true);
    } catch { failure(id, 'Sign-in is unavailable. Try again when account access is restored.'); }
  }

  useEffect(() => {
    if (!challenge || !button.current) return;
    const id = epoch.current; let active = true;
    const expires = setTimeout(() => { if (active) { setChallenge(null); setError('Sign-in expired. Start again.'); } }, Math.max(0, Date.parse(challenge.expiresAt) - Date.now()));
    const node = button.current;
    void loadGoogleButton().then(google => {
      if (!active || epoch.current !== id || Date.now() >= Date.parse(challenge.expiresAt)) return;
      google.initialize({ client_id: challenge.googleClientId, nonce: challenge.nonce, auto_select: false, ux_mode: 'popup',
        callback: async response => {
          if (!active || epoch.current !== id) return;
          setBusy(true); setError('');
          try {
            await teamAccountRequest('/api/auth/google', { body: { challengeId: challenge.challengeId, credential: response.credential }, csrf: challenge.csrfToken, signal: controller.current?.signal });
            if (epoch.current !== id) return;
            channel.current?.postMessage('changed'); await check();
          } catch { failure(id, 'Sign-in did not complete. Recheck your account before trying again.'); }
        },
      });
      google.renderButton(node, { type: 'standard', theme: 'outline', size: 'large', width: Math.min(300, node.clientWidth || 260) });
    }).catch(() => { if (active) failure(id, 'Google sign-in could not load. Please try again.'); });
    return () => { active = false; clearTimeout(expires); node.replaceChildren(); window.google?.accounts.id.cancel(); };
  }, [challenge, check, failure]);

  async function resolveLink() {
    if (!account) return;
    const current = account; const { id, signal } = begin(); setBusy(true); setStatus('checking');
    try {
      const result = linkPreviewSchema.parse(await teamAccountRequest('/api/team-private/sleeper-link/resolve', { body: { usernameOrUserId: input.trim() }, csrf: current.csrfToken, signal }));
      if (epoch.current !== id) return;
      setAccount(current); onChangeRef.current(current); setStatus('authenticated'); setBusy(false); setPreview(result);
    } catch { failure(id, 'Sleeper linking did not complete. Recheck your account, then try again.'); }
  }

  async function mutate(kind: 'confirm' | 'unlink' | 'logout') {
    if (!account || (kind === 'confirm' && !preview)) return;
    const current = account; const confirmation = preview;
    const { id, signal } = begin(); setStatus('checking'); setBusy(true); setInput('');
    try {
      const body = kind === 'confirm' ? { challengeId: confirmation!.challengeId, expectedLinkVersion: confirmation!.expectedLinkVersion, confirm: true }
        : kind === 'unlink' ? { expectedLinkVersion: current.linkVersion } : {};
      await teamAccountRequest(kind === 'logout' ? '/api/auth/logout' : '/api/team-private/sleeper-link', {
        body, csrf: current.csrfToken, method: kind === 'unlink' ? 'DELETE' : 'POST', signal,
      });
      if (epoch.current !== id) return;
      channel.current?.postMessage('changed');
      if (kind === 'logout') { window.google?.accounts.id.disableAutoSelect(); setBusy(false); setStatus('signed_out'); }
      else await check();
    } catch { failure(id, 'The request could not be confirmed. Recheck your account to see its current state.'); }
  }

  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(() => { setPreview(null); setError('The linking preview expired. Look up the account again.'); }, Math.max(0, Date.parse(preview.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [preview]);

  return <div className="tl-account">
    <button type="button" className="drp-action" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      {status === 'authenticated' ? 'Account · signed in' : 'Account'}
    </button>
    {expanded && <div className="tl-account-body">
      {status === 'checking' && <p role="status">Checking account…</p>}
      {error && <p role="alert">{error}</p>}
      {status === 'unavailable' && <button type="button" className="drp-action" onClick={() => void check()}>Recheck account</button>}
      {status === 'signed_out' && <>
        <p>Sign in to remember your linked Sleeper account across visits.</p>
        {!challenge && <button type="button" className="drp-action" disabled={busy} onClick={() => void startLogin()}>Continue to Google sign-in</button>}
        {challenge && <div ref={button} aria-label="Google sign-in" />}
        {challenge && <button type="button" className="drp-action" disabled={busy} onClick={() => { begin(); setStatus('signed_out'); }}>Cancel sign-in</button>}
      </>}
      {account && <>
        {account.sleeperLink ? <>
          <p>Linked Sleeper account: <strong>{account.sleeperLink.displayName ?? account.sleeperLink.username ?? account.sleeperLink.sleeperUserId}</strong></p>
          <button type="button" className="drp-action" onClick={() => void mutate('unlink')}>Unlink Sleeper account</button>
        </> : <>
          <form className="tl-form" onSubmit={event => { event.preventDefault(); void resolveLink(); }}>
            <label htmlFor="team-link-account">Sleeper username or user ID to link</label>
            <input id="team-link-account" value={input} maxLength={64} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={event => { setInput(event.target.value); setPreview(null); }} />
            <button className="drp-action" disabled={busy || !/^[A-Za-z0-9_-]{1,64}$/.test(input.trim())}>Preview account link</button>
          </form>
          {preview && <div className="tl-link-preview">
            <p>Link <strong>{preview.observation.displayName ?? preview.observation.username ?? preview.observation.sleeperUserId}</strong> ({preview.observation.sleeperUserId})?</p>
            <p>This is your chosen public Sleeper account. TIBER has not verified control of it.</p>
            <button type="button" className="drp-action" onClick={() => void mutate('confirm')}>Confirm Sleeper link</button>
          </div>}
        </>}
        <p className="drp-muted">Linking helps you find leagues. Lineup and transaction changes remain in Sleeper.</p>
        <button type="button" className="drp-action" onClick={() => void mutate('logout')}>Sign out on all devices</button>
      </>}
    </div>}
  </div>;
}
