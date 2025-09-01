import Fastify from 'fastify';
import routes from './api/powerRoutes.js';
import { initDb, closeDb } from './infra/db.js';
import { initCache, closeCache } from './infra/cache.js';
import { logger } from './infra/logger.js';

const app = Fastify({ 
  logger: false, // Use our custom logger
  requestIdLogLabel: 'req_id'
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await app.close();
  await closeDb();
  await closeCache();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await app.close();
  await closeDb();
  await closeCache();
  process.exit(0);
});

async function start() {
  try {
    // Initialize infrastructure
    await initDb();
    await initCache();
    
    // Register routes
    await app.register(routes);
    
    // Start server
    const port = Number(process.env.PORT || 8084);
    const host = '0.0.0.0';
    
    await app.listen({ port, host });
    logger.info(`🚀 OTC Power Rankings service running on port ${port}`);
    
  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }
}

start();