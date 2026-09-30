import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createToolHandler, tools } from '../modules/weeklyEvidence/toolDefinitions';
import { createWeeklyEvidenceService, type EvidenceReader } from '../modules/weeklyEvidence/weeklyEvidenceService';

export function buildWeeklyEvidenceServer(reader?: EvidenceReader) {
  // Low-level SDK dispatch retains raw arguments for strict validation and sanitized errors.
  const server = new Server({ name: 'tiber-weekly-evidence-offline', version: '0.1.0' }, {
    capabilities: { tools: {} },
    instructions: 'Offline read-only Watson/GB W1→W2 projection pilot. Preserve source/adapter clocks, missing evidence, attribution and shared lineage. Not remote admission or complete producer exports. No writes, providers, reruns or fantasy transactions.',
  });
  const handle = createToolHandler(createWeeklyEvidenceService(reader));
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: structuredClone(tools) }));
  server.setRequestHandler(CallToolRequestSchema, async request => handle(request.params.name, request.params.arguments));
  return server;
}

export async function startOfflineServer() {
  if (process.env.TIBER_WEEKLY_EVIDENCE_OFFLINE !== '1') throw new Error('offline_launcher_required');
  const server = buildWeeklyEvidenceServer();
  const transport = new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 8_192 });
  server.onerror = () => { process.stderr.write('weekly_evidence_protocol_error\n'); };
  await server.connect(transport);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startOfflineServer().catch(() => { process.stderr.write('weekly_evidence_start_failed\n'); process.exitCode = 1; });
}
