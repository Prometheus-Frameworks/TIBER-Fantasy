import { z } from 'zod';

/** Sleeper elimination ("chopped"/guillotine) leagues keep an eliminated roster row but clear its
 * primary membership to `players: null` and stamp `settings.eliminated` with the week it was cut.
 * That stamp is the only witness under which a null membership list is read as "holds no players".
 * Null without the stamp, and a missing `players` key, remain unreadable: callers fail closed. */
export const eliminationWitness = z.object({ eliminated: z.number().int().min(1).max(18).nullish() }).nullish();

export function hasEliminationWitness(row: { settings?: { eliminated?: number | null } | null }): boolean {
  return typeof row.settings?.eliminated === 'number';
}

/** True when every null primary membership list in the census carries the elimination witness. */
export function nullMembershipsAreWitnessed(rows: ReadonlyArray<{ players: unknown; settings?: { eliminated?: number | null } | null }>): boolean {
  return rows.every(row => row.players !== null || hasEliminationWitness(row));
}
