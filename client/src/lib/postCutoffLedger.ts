/**
 * Client helpers for the post-cutoff signal ledger (issue #297).
 *
 * Reads are open; writes require the operator admin key, sent via the
 * x-admin-api-key header only (never a query param). The key is kept in
 * sessionStorage for the operator session and is never persisted elsewhere.
 */
import type {
  LedgerEntryDraft,
  LedgerEntryView,
  LedgerRecord,
  LedgerValidationResult,
} from '@shared/postCutoffLedger';

export const LEDGER_API_BASE = '/api/post-cutoff-ledger';

const OPERATOR_KEY_STORAGE = 'tiber_operator_admin_key';

export function getStoredOperatorKey(): string {
  try {
    return sessionStorage.getItem(OPERATOR_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function storeOperatorKey(key: string): void {
  try {
    if (key) sessionStorage.setItem(OPERATOR_KEY_STORAGE, key);
    else sessionStorage.removeItem(OPERATOR_KEY_STORAGE);
  } catch {
    // sessionStorage unavailable (private mode) — key stays in-memory only.
  }
}

export interface LedgerListResponse {
  ok: boolean;
  count: number;
  entries: LedgerEntryView[];
}

export interface LedgerDetailResponse extends LedgerEntryView {
  ok: boolean;
  history: LedgerRecord[];
}

export interface LedgerWriteResponse {
  ok: boolean;
  record: LedgerRecord;
  validation: LedgerValidationResult;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body?.validation?.errors?.length) return body.validation.errors.join(' ');
    if (body?.error?.message) return body.error.message;
    if (body?.message) return body.message;
  } catch {
    // fall through to status text
  }
  return `${response.status}: ${response.statusText}`;
}

async function writeRequest(url: string, operatorKey: string, body: unknown): Promise<LedgerWriteResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-api-key': operatorKey,
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as LedgerWriteResponse;
}

export function createLedgerEntry(
  operatorKey: string,
  draft: LedgerEntryDraft,
  changeNote: string | null = null,
): Promise<LedgerWriteResponse> {
  return writeRequest(`${LEDGER_API_BASE}/entries`, operatorKey, { draft, change_note: changeNote });
}

export function appendLedgerRevision(
  operatorKey: string,
  ledgerEntryId: string,
  draft: LedgerEntryDraft,
  changeNote: string | null = null,
): Promise<LedgerWriteResponse> {
  return writeRequest(`${LEDGER_API_BASE}/entries/${encodeURIComponent(ledgerEntryId)}/revisions`, operatorKey, {
    draft,
    change_note: changeNote,
  });
}

export interface PlayerIdentitySearchResult {
  canonicalId: string;
  fullName: string;
  position?: string | null;
  nflTeam?: string | null;
}

export async function searchPlayerIdentity(name: string): Promise<PlayerIdentitySearchResult[]> {
  const response = await fetch(`/api/player-identity/search?name=${encodeURIComponent(name)}&limit=8`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json();
  return (body?.data?.results ?? []) as PlayerIdentitySearchResult[];
}

/** Split a textarea value into one trimmed item per non-empty line. */
export function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

export function listToLines(items: string[]): string {
  return items.join('\n');
}
