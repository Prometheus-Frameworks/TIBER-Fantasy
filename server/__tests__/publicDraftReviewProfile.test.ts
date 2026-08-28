import express from "express";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { createDraftReviewRouter } from "../routes/draftReviewRoutes";
import {
  createRuntimeProfileRouter,
  installPublicApiBoundary,
  PUBLIC_DRAFT_REVIEW_PROFILE,
  resolveRuntimeProfile,
} from "../runtimeProfile";

function makePublicApp(privateHandler: jest.Mock) {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(createRuntimeProfileRouter(PUBLIC_DRAFT_REVIEW_PROFILE));
  testApp.use(createDraftReviewRouter());
  installPublicApiBoundary(testApp);
  testApp.all("/api/*", privateHandler);
  return testApp;
}

describe("public Draft Review runtime profile", () => {
  test("keeps all API responses out of the service-worker caches", () => {
    const serviceWorker = fs.readFileSync(
      path.resolve(process.cwd(), "client/public/sw.js"),
      "utf8",
    );

    expect(serviceWorker).toContain("event.respondWith(apiNetworkOnly(request))");
    expect(serviceWorker).toContain("fetch(request, { cache: 'no-store' })");
    expect(serviceWorker).not.toMatch(/networkFirst\(request\)[\s\S]*startsWith\('\/api\/'\)/);
    expect(serviceWorker).not.toContain("DYNAMIC_CACHE");
  });

  test("defaults to full but rejects an unknown configured profile", () => {
    expect(resolveRuntimeProfile(undefined)).toBe("full");
    expect(resolveRuntimeProfile("public-draft-review")).toBe("public-draft-review");
    expect(() => resolveRuntimeProfile("public-ish")).toThrow("Unsupported TIBER_RUNTIME_PROFILE");
  });

  test("keeps the runtime-profile and Draft Review routes available", async () => {
    const privateHandler = jest.fn((_req, res) => res.status(418).end());
    const testApp = makePublicApp(privateHandler);

    const profile = await request(testApp).get("/api/runtime-profile");
    expect(profile.status).toBe(200);
    expect(profile.headers["cache-control"]).toBe("no-store");
    expect(profile.body).toEqual({ profile: "public-draft-review" });

    const draftReview = await request(testApp).get("/api/draft-review");
    expect(draftReview.status).toBe(400);
    expect(draftReview.body).toEqual({
      status: "invalid_input",
      error: "sleeper_url is required.",
    });
    expect(privateHandler).not.toHaveBeenCalled();
  });

  test("denies private reads and writes identically before lookup or mutation", async () => {
    const privateHandler = jest.fn((_req, res) => res.status(418).end());
    const testApp = makePublicApp(privateHandler);
    const requests = [
      request(testApp).get("/api/management?user_id=synthetic-a"),
      request(testApp).get("/api/management?user_id=synthetic-b"),
      request(testApp).get("/api/integrations/sleeper?default_user=synthetic-a"),
      request(testApp).post("/api/sleeper/sync").send({ user_id: "synthetic-a" }),
      request(testApp).delete("/api/dashboard/synthetic-private-resource"),
    ];

    const responses = await Promise.all(requests);
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "Not found" });
      expect(JSON.stringify(response.body)).not.toContain("synthetic");
    }
    expect(privateHandler).not.toHaveBeenCalled();
  });
});
