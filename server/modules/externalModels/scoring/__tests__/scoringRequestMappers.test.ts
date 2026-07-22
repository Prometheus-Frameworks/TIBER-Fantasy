/**
 * Regression coverage for the `buildRankingsScoringInputs` weekly-PPR ordering query.
 *
 * The route previously ordered by `weeklyStats.fantasy_points_ppr` — a snake_case property
 * that does not exist on the Drizzle table object (the real column property is
 * `fantasyPointsPpr`). That interpolated `undefined` into the SQL fragment, producing an
 * `avg() desc` clause that Postgres rejected with `function avg() does not exist`. This
 * test drives the real code path (with `db` mocked) and inspects the exact SQL fragment
 * built for `.orderBy(...)`, so a reintroduction of the typo fails here instead of only
 * surfacing as a production query error.
 */
import { weeklyStats } from '@shared/schema';

const capturedOrderByArgs: any[] = [];

jest.mock('../../../../infra/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          groupBy: () => ({
            orderBy: (arg: any) => {
              capturedOrderByArgs.push(arg);
              return {
                limit: () => Promise.resolve([]),
              };
            },
          }),
        }),
      }),
    }),
  },
}));

import { buildRankingsScoringInputs } from '../scoringRequestMappers';

describe('buildRankingsScoringInputs ordering query', () => {
  beforeEach(() => {
    capturedOrderByArgs.length = 0;
  });

  it('orders by the real fantasyPointsPpr column, not an undefined property reference', async () => {
    await buildRankingsScoringInputs({ season: 2025, throughWeek: 10, position: 'WR', limit: 50 });

    expect(capturedOrderByArgs).toHaveLength(1);
    const orderByArg = capturedOrderByArgs[0];

    // A drizzle sql`` fragment records each interpolated value in queryChunks. The bug
    // interpolated `weeklyStats.fantasy_points_ppr`, which is `undefined`; the fix
    // interpolates the actual `fantasyPointsPpr` Column object.
    const interpolatedValues = orderByArg.queryChunks.filter((chunk: unknown) => typeof chunk !== 'string');
    expect(interpolatedValues).not.toContain(undefined);
    expect(interpolatedValues).toContain(weeklyStats.fantasyPointsPpr);

    // Guard against the exact historical typo re-appearing.
    expect((weeklyStats as any).fantasy_points_ppr).toBeUndefined();
  });
});
