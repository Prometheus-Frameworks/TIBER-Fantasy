import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { app, mountProductionFrontend } from "../index";

describe("production root + SPA routing", () => {
  test("GET /health stays machine-readable JSON", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, service: "TiberClaw" });
  });

  test("GET / serves SPA shell when dist/public/index.html is present", async () => {
    const distPublicDir = path.resolve(process.cwd(), "dist", "public");
    const indexHtml = path.join(distPublicDir, "index.html");

    const hadOriginal = fs.existsSync(indexHtml);
    const originalContents = hadOriginal ? fs.readFileSync(indexHtml, "utf8") : null;

    fs.mkdirSync(distPublicDir, { recursive: true });
    fs.writeFileSync(indexHtml, "<html><body><h1>TIBER-Fantasy Frontend</h1></body></html>", "utf8");

    try {
      const res = await request(app).get("/");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain("TIBER-Fantasy Frontend");
    } finally {
      if (hadOriginal && originalContents != null) {
        fs.writeFileSync(indexHtml, originalContents, "utf8");
      } else {
        fs.rmSync(indexHtml, { force: true });
      }
    }
  });


  test("mountProductionFrontend reports missing assets safely", () => {
    const testApp = express();
    const result = mountProductionFrontend(testApp, path.join(process.cwd(), "dist", "__missing__"));

    expect(result.mounted).toBe(false);
    if (!result.mounted) {
      expect(["public_dir_missing", "index_missing"]).toContain(result.reason);
    }
  });

  test("production SPA fallback serves frontend for non-API routes and preserves API routes", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tiber-prod-static-"));
    const publicDir = path.join(tmpDir, "public");
    const indexHtml = path.join(publicDir, "index.html");

    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(indexHtml, "<html><body><div id='root'>SPA Shell</div></body></html>", "utf8");

    const testApp = express();
    testApp.get("/api/ping", (_req, res) => res.json({ pong: true }));
    const result = mountProductionFrontend(testApp, publicDir);

    expect(result.mounted).toBe(true);

    const spaRes = await request(testApp).get("/players/justin-jefferson");
    expect(spaRes.status).toBe(200);
    expect(spaRes.headers["content-type"]).toContain("text/html");
    expect(spaRes.text).toContain("SPA Shell");

    const apiRes = await request(testApp).get("/api/ping");
    expect(apiRes.status).toBe(200);
    expect(apiRes.body).toEqual({ pong: true });

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
