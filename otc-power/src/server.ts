// /src/server.ts
import Fastify from 'fastify';
import routes from './api/powerRoutes.js';
import { initDb } from './infra/db.js';
import { logger } from './infra/logger.js';

async function main() {
  await initDb();
  const app = Fastify({ logger: true });
  await app.register(routes);
  const port = Number(process.env.PORT || 8084);
  await app.listen({ port, host: '0.0.0.0' });
  logger.info('server.listening', { port });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}