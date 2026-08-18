/**
 * Composition root for the context-bound entity model pilot (Fantasy #332).
 *
 * The only file in the module that reaches for live infrastructure. Everything
 * above it — domain, service, resolver, tool contract — takes its dependencies
 * as parameters, which is why the rest of the module can be exercised without
 * a database and why MCP is a caller rather than a foundation.
 *
 * Importing this module opens the application database connection (via
 * `server/infra/db`), so import it from entrypoints only.
 */

import { db } from '../../infra/db';
import { playerIdentityService } from '../../services/PlayerIdentityService';
import { ContextEntityModelService, type Clock } from './contextEntityModelService';
import { ContextEntityResolver } from './entityResolver';
import { DrizzleContextEntityModelStore } from './drizzleContextEntityModelStore';

export function createContextEntityModelService(clock?: Clock): ContextEntityModelService {
  const store = new DrizzleContextEntityModelStore(db);
  const resolver = new ContextEntityResolver(playerIdentityService);
  return new ContextEntityModelService(store, resolver, clock);
}
