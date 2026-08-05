import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PgDialect } from "drizzle-orm/pg-core";
import express from "express";
import request from "supertest";

jest.mock("../../infra/db", () => ({
  db: {
    execute: jest.fn(),
  },
}));

jest.mock("../datadiveSnapshot", () => ({
  datadiveSnapshotService: {},
}));

jest.mock("../datadiveAuto", () => ({
  runAutoWeeklySnapshotForSeason: jest.fn(),
  getAutoSnapshotStatus: jest.fn(),
}));

jest.mock("../../modules/dstStreamer", () => ({
  getDSTStreamer: jest.fn(),
}));

import { db } from "../../infra/db";
import dataLabRouter from "../../modules/datalab/snapshots/snapshotRoutes";
import {
  getAggregatedExpectedFantasy,
  getPlayerExpectedFantasy,
} from "../xFptsService";

const dialect = new PgDialect();
const executeMock = db.execute as jest.Mock;

describe("Data Lab SQL parameterization", () => {
  const compiledQueries: Array<{ sql: string; params: unknown[] }> = [];

  beforeEach(() => {
    compiledQueries.length = 0;
    executeMock.mockReset();
    executeMock.mockImplementation(async (query) => {
      compiledQueries.push(dialect.sqlToQuery(query));
      return { rows: [] };
    });
  });

  test("binds the public aggregation position filter as a query parameter", async () => {
    const untrustedPosition = "UNTRUSTED_POSITION_MARKER";

    await getAggregatedExpectedFantasy(2025, 1, 18, untrustedPosition);

    expect(compiledQueries).toHaveLength(1);
    expect(compiledQueries[0].sql).not.toContain(untrustedPosition);
    expect(compiledQueries[0].params).toContain(untrustedPosition);
  });

  test("keeps anonymous usage-agg input out of SQL text across the mounted route", async () => {
    const untrustedPosition = "UNTRUSTED_ROUTE_POSITION_MARKER";
    const app = express();
    app.use("/api/data-lab", dataLabRouter);

    const response = await request(app)
      .get("/api/data-lab/usage-agg")
      .query({
        season: "2025",
        weekMode: "range",
        weekFrom: "1",
        weekTo: "2",
        position: untrustedPosition,
      });

    expect(response.status).toBe(200);
    expect(compiledQueries).toHaveLength(2);
    expect(compiledQueries.every((query) => !query.sql.includes(untrustedPosition))).toBe(true);
    expect(compiledQueries.some((query) => query.params.includes(untrustedPosition))).toBe(true);
  });

  test("binds player and week-range values instead of composing raw SQL", async () => {
    const untrustedPlayerId = "UNTRUSTED_PLAYER_MARKER";

    await getPlayerExpectedFantasy(untrustedPlayerId, 2025, 4, 12);

    expect(compiledQueries).toHaveLength(1);
    expect(compiledQueries[0].sql).not.toContain(untrustedPlayerId);
    expect(compiledQueries[0].sql).not.toContain("BETWEEN 4 AND 12");
    expect(compiledQueries[0].params).toEqual(
      expect.arrayContaining([2025, untrustedPlayerId, 4, 12]),
    );
  });
});

describe("Data Lab raw SQL regression guard", () => {
  const sensitiveFiles = [
    "server/services/xFptsService.ts",
    "server/routes/dataLabRoutes.ts",
    "server/modules/datalab/snapshots/snapshotRoutes.ts",
  ];

  test.each(sensitiveFiles)("does not interpolate template values through sql.raw in %s", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    const interpolatedRawSql = /sql\.raw\s*\(\s*`[^`]*\$\{/s;

    expect(source).not.toMatch(interpolatedRawSql);
  });
});
