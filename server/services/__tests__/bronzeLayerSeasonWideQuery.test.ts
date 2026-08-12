import { PgDialect } from 'drizzle-orm/pg-core';

const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockOffset = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();

const query: Record<string, unknown> & PromiseLike<unknown[]> = {
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  offset: mockOffset,
  then: (resolve, reject) => Promise.resolve([]).then(resolve, reject),
};

mockWhere.mockImplementation(() => query);
mockOrderBy.mockImplementation(() => query);
mockLimit.mockImplementation(() => query);
mockOffset.mockImplementation(() => query);
mockFrom.mockImplementation(() => query);
mockSelect.mockImplementation(() => ({ from: mockFrom }));

jest.mock('../../infra/db', () => ({
  db: { select: mockSelect },
}));

import { bronzeLayerService } from '../BronzeLayerService';

const dialect = new PgDialect();

function compiledWhereParams(): unknown[] {
  const whereExpression = mockWhere.mock.calls[0]?.[0];
  if (!whereExpression) return [];
  return dialect.sqlToQuery(whereExpression).params;
}

describe('BronzeLayerService raw-payload week filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWhere.mockImplementation(() => query);
    mockOrderBy.mockImplementation(() => query);
    mockLimit.mockImplementation(() => query);
    mockOffset.mockImplementation(() => query);
    mockFrom.mockImplementation(() => query);
    mockSelect.mockImplementation(() => ({ from: mockFrom }));
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('undefined week leaves a governed-season query season-wide', async () => {
    await bronzeLayerService.getRawPayloads({
      status: 'PENDING',
      season: 2026,
      week: undefined,
      limit: 100,
    });

    expect(compiledWhereParams()).toEqual(['PENDING', 2026]);
    expect(mockLimit).toHaveBeenCalledWith(100);
  });

  test('process-all style omission of limit does not introduce a week condition', async () => {
    await bronzeLayerService.getRawPayloads({
      status: 'PENDING',
      season: 2026,
      week: undefined,
      limit: undefined,
    });

    expect(compiledWhereParams()).toEqual(['PENDING', 2026]);
    expect(mockLimit).not.toHaveBeenCalled();
  });

  test('an explicit week remains an exact service filter', async () => {
    await bronzeLayerService.getRawPayloads({
      status: 'PENDING',
      season: 2025,
      week: 18,
    });

    expect(compiledWhereParams()).toEqual(['PENDING', 2025, 18]);
  });
});
