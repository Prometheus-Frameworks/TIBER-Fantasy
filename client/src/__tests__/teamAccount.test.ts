/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TeamAccount from '@/components/draftReview/TeamAccount';
import TeamLeagueSwitcher from '@/components/draftReview/TeamLeagueSwitcher';
import * as api from '@/lib/teamAccountApi';

const id = '00000000-0000-4000-8000-000000000001';
const csrf = 'a'.repeat(64);
const challenge = { status: 'signed_out', csrfToken: csrf, googleClientId: 'synthetic.apps.googleusercontent.com', challengeId: id,
  nonce: 'b'.repeat(64), expiresAt: new Date(Date.now() + 300000).toISOString() };
const observation = { sleeperUserId: '123', username: 'synthetic', displayName: 'Synthetic account',
  sourceUrl: 'https://api.sleeper.app/v1/user/123', receivedAt: '2026-09-13T00:00:00.000Z' };
const account = (linked = true) => ({ status: 'authenticated', user: { id }, linkVersion: linked ? 1 : 0,
  sleeperLink: linked ? { ...observation, linkedAt: observation.receivedAt, linkMethod: 'operator_assertion' } : null, sleeperAccountControlVerified: false });
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body } as Response);
const original = global.fetch;
let signedIn: boolean; let linked: boolean;
function serve(path: string) {
  if (path === '/api/auth/session') return response(signedIn ? { status: 'authenticated', user: { id } } : { status: 'signed_out' }, signedIn ? 200 : 401);
  if (path === '/api/auth/bootstrap') return response(signedIn ? { status: 'authenticated', csrfToken: csrf } : challenge);
  if (path === '/api/team-private/sleeper-link') return response(account(linked));
  throw new Error('Unexpected request');
}
beforeEach(() => { signedIn = true; linked = true; global.fetch = jest.fn(async input => serve(String(input))); });
afterEach(() => { cleanup(); global.fetch = original; jest.restoreAllMocks(); });
test.each(['focus', 'visibilitychange'])('signed-out tabs discover another tab login on %s without BroadcastChannel', async event => {
  signedIn = false;
  expect(typeof BroadcastChannel).toBe('undefined');
  const change = jest.fn(); render(React.createElement(TeamAccount, { onChange: change, recheckKey: 0 }));
  fireEvent.click(screen.getByRole('button', { name: 'Account' }));
  await screen.findByRole('button', { name: 'Continue to Google sign-in' });
  signedIn = true; // The shared session changed elsewhere; no notification was delivered.
  const visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const calls = (global.fetch as jest.Mock).mock.calls.length;
  fireEvent(event === 'focus' ? window : document, new Event(event));
  expect(global.fetch).toHaveBeenCalledTimes(calls);
  visibility.mockReturnValue('visible');
  fireEvent(event === 'focus' ? window : document, new Event(event));
  await screen.findByRole('button', { name: 'Account · signed in' });
  expect(change.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ user: { id }, sleeperLink: expect.objectContaining({ sleeperUserId: '123' }) }));
  expect((global.fetch as jest.Mock).mock.calls.some(([url]) => url === '/api/auth/google')).toBe(false);
});
test('loads the authenticated account and clears it immediately on logout, even if logout fails', async () => {
  const change = jest.fn(); render(React.createElement(TeamAccount, { onChange: change, recheckKey: 0 }));
  await screen.findByRole('button', { name: 'Account · signed in' });
  fireEvent.click(screen.getByRole('button', { name: 'Account · signed in' }));
  expect(screen.getByText('Synthetic account')).toBeTruthy();
  let release!: (value: Response) => void;
  (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign out on all devices' }));
  expect(change.mock.calls.at(-1)).toEqual([null]); expect(screen.queryByText('Synthetic account')).toBeNull();
  await act(async () => release(response({}, 503)));
  await screen.findByRole('alert'); expect(screen.queryByText('Synthetic account')).toBeNull();
  const options = (global.fetch as jest.Mock).mock.calls.at(-1)[1];
  expect(options.headers['X-CSRF-Token']).toBe(csrf); expect(options.credentials).toBe('same-origin');
});
test('focus and back-forward restoration recheck identity and discard stale linking state', async () => {
  const change = jest.fn(); render(React.createElement(TeamAccount, { onChange: change, recheckKey: 0 }));
  await screen.findByRole('button', { name: 'Account · signed in' });
  signedIn = false; fireEvent(window, new Event('focus'));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Account · signed in' })).toBeNull());
  expect(change.mock.calls.at(-1)).toEqual([null]);
  signedIn = true;
  fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }));
  await screen.findByRole('button', { name: 'Account · signed in' });
  fireEvent(window, new PageTransitionEvent('pagehide'));
  expect(change.mock.calls.at(-1)).toEqual([null]);
});
test('link resolution requires an explicit confirmation with the current version and CSRF', async () => {
  linked = false; const change = jest.fn(); render(React.createElement(TeamAccount, { onChange: change, recheckKey: 0 }));
  fireEvent.click(await screen.findByRole('button', { name: 'Account · signed in' }));
  fireEvent.change(screen.getByLabelText('Sleeper username or user ID to link'), { target: { value: 'synthetic' } });
  (global.fetch as jest.Mock).mockImplementationOnce(async () => response({ challengeId: id, expectedLinkVersion: 0, observation,
    expiresAt: challenge.expiresAt, linkMethod: 'operator_assertion', accountControlVerified: false }));
  fireEvent.click(screen.getByRole('button', { name: 'Preview account link' }));
  await screen.findByRole('button', { name: 'Confirm Sleeper link' });
  expect((global.fetch as jest.Mock).mock.calls.filter(([url, opts]) => url === '/api/team-private/sleeper-link' && opts.method === 'POST')).toHaveLength(0);
  (global.fetch as jest.Mock).mockImplementationOnce(async () => { linked = true; return response(account()); });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Sleeper link' }));
  await screen.findByRole('button', { name: 'Unlink Sleeper account' });
  const mutation = (global.fetch as jest.Mock).mock.calls.find(([url, opts]) => url === '/api/team-private/sleeper-link' && opts.method === 'POST');
  expect(JSON.parse(mutation![1].body)).toEqual({ challengeId: id, expectedLinkVersion: 0, confirm: true });
  expect(mutation![1].headers['X-CSRF-Token']).toBe(csrf);
});
test('Google loads only after explicit sign-in and sends the credential only to the fixed POST', async () => {
  signedIn = false; let callback!: (value: { credential: string }) => void;
  const google = { initialize: jest.fn(options => { callback = options.callback; }), renderButton: jest.fn(), cancel: jest.fn(), disableAutoSelect: jest.fn() };
  const load = jest.spyOn(api, 'loadGoogleButton').mockResolvedValue(google);
  const change = jest.fn(); render(React.createElement(TeamAccount, { onChange: change, recheckKey: 0 }));
  fireEvent.click(screen.getByRole('button', { name: 'Account' }));
  await screen.findByRole('button', { name: 'Continue to Google sign-in' }); expect(load).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Continue to Google sign-in' }));
  await waitFor(() => expect(google.initialize).toHaveBeenCalledWith(expect.objectContaining({ nonce: challenge.nonce, client_id: challenge.googleClientId, auto_select: false })));
  // Returning focus from the provider popup must not cancel the active challenge.
  const calls = (global.fetch as jest.Mock).mock.calls.length;
  fireEvent(window, new Event('focus'));
  fireEvent(document, new Event('visibilitychange'));
  expect(global.fetch).toHaveBeenCalledTimes(calls);
  expect(screen.getByLabelText('Google sign-in')).toBeTruthy();
  (global.fetch as jest.Mock).mockImplementationOnce(async () => { signedIn = true; return response({ status: 'authenticated' }); });
  await act(async () => callback({ credential: 'synthetic-token' }));
  await screen.findByRole('button', { name: 'Account · signed in' });
  const login = (global.fetch as jest.Mock).mock.calls.find(([url]) => url === '/api/auth/google');
  expect(login![1].method).toBe('POST'); expect(JSON.parse(login![1].body)).toEqual({ challengeId: id, credential: 'synthetic-token' });
  expect(window.location.href).not.toContain('synthetic-token'); expect(window.localStorage.length).toBe(0); expect(window.sessionStorage.length).toBe(0);
});
test('linked league discovery derives the account server-side and an outage does not loop retries', async () => {
  (global.fetch as jest.Mock).mockImplementation(async input => String(input) === '/api/team-private/leagues' ? response({ error: 'AUTH_UNAVAILABLE' }, 503) : serve(String(input)));
  render(React.createElement(TeamLeagueSwitcher, { authEnabled: true, navigationKey: '', onSelect: jest.fn(() => true) }));
  await screen.findByText('Account access changed. Recheck your account to continue.');
  expect((global.fetch as jest.Mock).mock.calls.filter(([url]) => url === '/api/team-private/leagues')).toHaveLength(1);
  const call = (global.fetch as jest.Mock).mock.calls.find(([url]) => url === '/api/team-private/leagues');
  expect(Object.keys(JSON.parse(call![1].body))).toEqual(['season']); expect(call![1].headers['X-CSRF-Token']).toBe(csrf);
});
