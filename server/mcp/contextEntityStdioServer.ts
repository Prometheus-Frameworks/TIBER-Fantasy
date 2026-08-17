/**
 * Local stdio MCP server for the context-bound entity model pilot (#332).
 *
 * The entire MCP surface of the pilot is this file: it hands the tool
 * definitions from `server/modules/contextEntityModel/mcp/toolDefinitions.ts`
 * to the official SDK's `McpServer` and connects a stdio transport. It holds
 * no domain logic, no persistence, and no identity rules — delete it and the
 * application operations still work.
 *
 * Transport: local stdio only (v0 decision, #332 implementation checkpoint).
 * The server runs as a child process of the operator's own MCP client, on the
 * operator's machine, with the operator's own environment. There is no network
 * listener, no OAuth, and no multi-user isolation, because none of those are
 * needed to answer the question this pilot exists to answer — and building a
 * fake production auth layer would be worse than not having one.
 *
 * Deferred to a future remote/multi-user phase, explicitly:
 *   - authentication and authorisation of the *caller* (stdio inherits the
 *     operator's trust; anyone who can run this process is already the
 *     operator);
 *   - per-user isolation of workspaces (`workspaceId` is an operator-supplied
 *     label, not an authenticated tenant);
 *   - transport security (no network transport exists to secure);
 *   - rate limiting and audit forwarding.
 *
 * See docs/mcp/context-bound-entity-model-v0.md for the operator-facing note.
 */

// Must be first: stdout is the JSON-RPC channel on stdio transport.
import './stdioSafety';

import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createContextEntityModelService } from '../modules/contextEntityModel/composition';
import { CONTEXT_ENTITY_TOOLS } from '../modules/contextEntityModel/mcp/toolDefinitions';
import type { ContextEntityModelService } from '../modules/contextEntityModel/contextEntityModelService';

const SERVER_NAME = 'tiber-context-entity';
/** Pilot surface version, independent of the product version. */
const SERVER_VERSION = '0.1.0';

export function buildContextEntityMcpServer(service: ContextEntityModelService): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        'Operator-local context-bound entity models for TIBER. Read tools resolve canonical ' +
        'entity identity and retrieve the durable context an operator saved in a workspace. ' +
        'Write tools persist an operator-confirmed interpretation and append observations to ' +
        'its append-only lineage. Persistence requires an explicit operator confirmation; the ' +
        'availability of these tools is not itself authority to write. Nothing here takes a ' +
        'fantasy roster action or publishes to shared/promoted state.',
    },
  );

  for (const tool of CONTEXT_ENTITY_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema.shape,
        annotations: tool.annotations,
      },
      async (args: unknown) => {
        try {
          const result = await tool.handler(args, service);
          return { content: [{ type: 'text' as const, text: result.text }], isError: result.isError };
        } catch (error) {
          // Refusals already come back as structured results; reaching here
          // means something genuinely unexpected broke. Report it as a tool
          // error rather than letting it take down the transport, and keep the
          // detail on stderr where the operator can see it.
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[${SERVER_NAME}] tool ${tool.name} failed:`, error);
          return {
            content: [{ type: 'text' as const, text: `Tool ${tool.name} failed: ${message}` }],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}

async function main(): Promise<void> {
  const service = createContextEntityModelService();
  const server = buildContextEntityMcpServer(service);
  await server.connect(new StdioServerTransport());
  console.error(`[${SERVER_NAME}] stdio MCP server ready (${CONTEXT_ENTITY_TOOLS.length} tools)`);
}

// Start only when run as the process entrypoint, so importing this module (to
// inspect the wiring) does not open a database connection or seize stdio.
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && resolve(fileURLToPath(import.meta.url)) === invokedPath) {
  main().catch((error) => {
    console.error(`[${SERVER_NAME}] failed to start:`, error);
    process.exit(1);
  });
}
