import type {
  CatalystBatchResponse,
  CatalystComponents,
  CatalystErrorResponse,
  CatalystPlayer,
  CatalystPlayerResponse,
  CatalystYoYPlayer,
  CatalystYoYResponse,
} from '@shared/types/catalyst';

export type QueryError = Error & { status?: number; statusText?: string; body?: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function hasComponents(value: unknown): value is CatalystComponents {
  if (!isObject(value)) return false;
  return (
    hasNumber(value.leverage_factor)
    && hasNumber(value.opponent_factor)
    && hasNumber(value.script_factor)
    && hasNumber(value.recency_factor)
    && hasNumber(value.base_epa_sum)
    && hasNumber(value.weighted_epa_sum)
    && hasNumber(value.play_count)
    && hasNumber(value.avg_leverage)
  );
}

export function hasCatalystPlayer(value: unknown): value is CatalystPlayer {
  if (!isObject(value)) return false;
  return (
    typeof value.gsis_id === 'string'
    && typeof value.player_name === 'string'
    && typeof value.position === 'string'
    && typeof value.team === 'string'
    && hasNumber(value.catalyst_raw)
    && hasNumber(value.catalyst_alpha)
    && hasComponents(value.components)
  );
}

export function hasCatalystPlayerDetail(value: unknown): value is CatalystPlayerResponse {
  if (!isObject(value) || !hasCatalystPlayer(value) || !hasNumber(value.season) || !Array.isArray(value.weekly)) return false;
  return value.weekly.every((w: unknown) => isObject(w)
    && hasNumber(w.week)
    && hasNumber(w.catalyst_raw)
    && hasNumber(w.catalyst_alpha)
    && hasComponents(w.components));
}

function hasYoyPlayer(value: unknown): value is CatalystYoYPlayer {
  if (!isObject(value)) return false;
  return (
    typeof value.gsis_id === 'string'
    && typeof value.player_name === 'string'
    && typeof value.position === 'string'
    && typeof value.team_2024 === 'string'
    && typeof value.team_2025 === 'string'
    && (value.alpha_2024 == null || hasNumber(value.alpha_2024))
    && (value.alpha_2025 == null || hasNumber(value.alpha_2025))
    && (value.delta == null || hasNumber(value.delta))
  );
}

function toQueryError(message: string, details?: Partial<QueryError>): QueryError {
  const error = new Error(message) as QueryError;
  if (details) Object.assign(error, details);
  return error;
}

function readBackendMessage(value: unknown, fallback: string): string {
  if (!isObject(value)) return fallback;
  const maybeError = value.error;
  if (!isObject(maybeError)) return fallback;
  if (typeof maybeError.message === 'string') return maybeError.message;
  return fallback;
}

async function fetchJsonOrThrow<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();
  let parsed: unknown = null;

  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      if (res.ok) {
        throw toQueryError('Server returned an unreadable response body.');
      }
    }
  }

  if (!res.ok) {
    const backendMessage = readBackendMessage(parsed, text);
    throw toQueryError(`Request failed (${res.status} ${res.statusText})${backendMessage ? `: ${backendMessage}` : ''}`, {
      status: res.status,
      statusText: res.statusText,
      body: backendMessage,
    });
  }

  return parsed as T;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}

export async function fetchCatalystBatch(position: string, season: number): Promise<CatalystBatchResponse> {
  const payload = await fetchJsonOrThrow<CatalystBatchResponse>(`/api/catalyst/batch?position=${position}&season=${season}&limit=200`);
  if (!Array.isArray(payload.players) || !payload.players.every(hasCatalystPlayer)) {
    throw toQueryError('Batch payload is malformed.');
  }
  return payload;
}

export async function fetchCatalystPlayer(playerId: string, season: number): Promise<CatalystPlayerResponse> {
  const payload = await fetchJsonOrThrow<CatalystPlayerResponse>(`/api/catalyst/player/${playerId}?season=${season}`);
  if (!hasCatalystPlayerDetail(payload)) {
    throw toQueryError('Player detail payload is malformed.');
  }
  return payload;
}

export async function fetchCatalystYoY(position: string): Promise<CatalystYoYResponse> {
  const payload = await fetchJsonOrThrow<CatalystYoYResponse>(`/api/catalyst/yoy?position=${position}&limit=25`);
  if (!Array.isArray(payload.players) || !payload.players.every(hasYoyPlayer)) {
    throw toQueryError('YoY payload is malformed.');
  }
  return payload;
}

export type { CatalystErrorResponse };
