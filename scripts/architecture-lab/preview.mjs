#!/usr/bin/env node
/**
 * Database-free preview of the Architecture Lab prototype (TIBER-Fantasy #434).
 *
 * Starts the repository's own Vite dev server for the client only and answers
 * GET /api/runtime-profile with the "full" profile so the real router mounts
 * /architecture-lab inside the real layout. Every other /api request returns
 * 503: there is no Express server, no database and no upstream call behind
 * this preview. Local development aid only; nothing here is deployed.
 *
 *   node scripts/architecture-lab/preview.mjs [port]
 *   open http://127.0.0.1:5199/architecture-lab
 */
import { createServer } from 'vite';

const port = Number(process.argv[2] ?? 5199);

const stubApi = {
  name: 'architecture-lab-preview-api-stub',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next();
      res.setHeader('Content-Type', 'application/json');
      if (req.url.split('?')[0] === '/api/runtime-profile') {
        res.end(JSON.stringify({ profile: 'full' }));
        return;
      }
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'architecture-lab preview: no backend is running' }));
    });
  },
};

const server = await createServer({
  plugins: [stubApi],
  server: { port, strictPort: true, host: '127.0.0.1' },
  logLevel: 'info',
});
await server.listen();
console.log(`Architecture Lab preview: http://127.0.0.1:${port}/architecture-lab`);
