// server/bootstrap.mjs — copied to dist/index.mjs at build time.
// run: ["node", "dist/index.mjs"]  (no npm overhead)
import http from "node:http";
import fs   from "node:fs";
import path from "node:path";
import net  from "node:net";

process.env.NODE_ENV = process.env.NODE_ENV || "production";

process.on("uncaughtException",  (err) => console.error("[bootstrap] uncaughtException:",  err));
process.on("unhandledRejection", (r)   => console.error("[bootstrap] unhandledRejection:", r));

const PORT = Number(process.env.PORT ?? 5000);
console.log(`[bootstrap] start — PORT=${PORT} NODE_ENV=${process.env.NODE_ENV} pid=${process.pid}`);

// Read index.html once (sync). Served for GET / — no middleware, can't hang.
const INDEX_HTML_PATH = path.join(process.cwd(), "dist", "public", "index.html");
let indexHtmlBuf = null;
try {
  indexHtmlBuf = fs.readFileSync(INDEX_HTML_PATH);
  console.log(`[bootstrap] index.html loaded (${indexHtmlBuf.length} bytes)`);
} catch {
  console.warn(`[bootstrap] index.html not found at ${INDEX_HTML_PATH}`);
}

let expressApp = null;

function sendOk(res, body) {
  res.writeHead(200, {
    "Content-Type":   "application/json",
    "Content-Length": String(Buffer.byteLength(body)),
    "Connection":     "close",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url    = (req.url ?? "/").split("?")[0];
  const method = req.method ?? "GET";
  console.log(`[http] ${method} ${url} from ${req.socket?.remoteAddress}`);

  if (url === "/" || url === "/health") {
    if (url === "/" && indexHtmlBuf) {
      res.writeHead(200, {
        "Content-Type":   "text/html; charset=utf-8",
        "Content-Length": String(indexHtmlBuf.length),
        "Connection":     "close",
      });
      res.end(indexHtmlBuf);
    } else {
      sendOk(res, `{"ok":true,"status":"${expressApp ? "ready" : "starting"}"}`);
    }
    return;
  }

  if (expressApp) {
    expressApp(req, res);
  } else {
    const body = '{"error":"starting"}';
    res.writeHead(503, { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)), "Connection": "close" });
    res.end(body);
  }
});

// TCP-level: log every connection even before HTTP parsing
server.on("connection", (socket) => {
  console.log(`[tcp] connection from ${socket.remoteAddress}:${socket.remotePort} → port ${PORT}`);
});

server.on("error", (err) => console.error("[bootstrap] server error:", err));

// Also probe other common ports to help diagnose where health checks go
for (const probePort of [3000, 8080, 8000]) {
  const probe = net.createServer((sock) => {
    console.log(`[probe] connection on port ${probePort} from ${sock.remoteAddress} — health check is on this port!`);
    // Reply with HTTP 200 so the health check passes from here too
    sock.write(`HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\nConnection: close\r\n\r\n{"ok":true,"p":${probePort}}`);
    sock.end();
  }).listen(probePort, "0.0.0.0", () => {
    console.log(`[probe] listening on port ${probePort}`);
  });
  probe.on("error", () => {}); // silently ignore if port is taken
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[bootstrap] port ${PORT} bound and ready`);
  const t = Date.now();

  (async () => {
    const { app, initBackground } = await import("./app.mjs");
    expressApp = app;
    console.log(`[bootstrap] bundle ready in ${Date.now() - t}ms`);
    await initBackground();
    console.log(`[bootstrap] fully initialized`);
  })().catch((err) => console.error("[bootstrap] FATAL:", err));
});
