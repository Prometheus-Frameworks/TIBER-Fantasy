import { z } from 'zod';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { INPUT_LIMIT, RESULT_LIMIT, SUBJECT_ID } from './catalog';
import { createWeeklyEvidenceService, EvidenceFailure } from './weeklyEvidenceService';

const schemas = {
  tiber_describe_capabilities: z.object({}).strict(),
  tiber_list_evidence: z.object({ season: z.literal(2026), season_type: z.literal('REG'), subject_id: z.literal(SUBJECT_ID) }).strict(),
  tiber_get_evidence: z.object({ evidence_id: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/) }).strict(),
};
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
export const tools: Tool[] = [
  { name: 'tiber_describe_capabilities', description: 'Describe this offline-only three-tool pilot, exact limits and unavailable capabilities.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations },
  { name: 'tiber_list_evidence', description: 'List the retained Watson/GB W1→W2 projection and unavailable W3/Forecast lanes. Listing does not check bytes or grant remote admission.', inputSchema: { type: 'object', properties: { season: { type: 'integer', const: 2026 }, season_type: { type: 'string', const: 'REG' }, subject_id: { type: 'string', const: SUBJECT_ID } }, required: ['season', 'season_type', 'subject_id'], additionalProperties: false }, annotations },
  { name: 'tiber_get_evidence', description: 'Read one allowlisted exact local projection for offline inspection. Preserve complete model, provenance, nulls and limitations. Other IDs are unavailable; no fallback, producer run or remote admission.', inputSchema: { type: 'object', properties: { evidence_id: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-zA-Z0-9_-]+$' } }, required: ['evidence_id'], additionalProperties: false }, annotations },
];

function result(operation: string, status: string, data: unknown, started: string, isError = false): CallToolResult {
  const envelope = {
    schema_version: 'tiber_weekly_evidence_offline_v0', operation, status,
    request_started_at: started, response_generated_at: new Date().toISOString(),
    clock_meaning: 'adapter_call_times_not_football_or_source_update_times',
    data, remote_consumer_enabled: false,
  };
  return { content: [{ type: 'text', text: JSON.stringify(envelope) }], structuredContent: envelope, isError };
}

export function createToolHandler(service = createWeeklyEvidenceService()) {
  return async (name: string, args: unknown): Promise<CallToolResult> => {
    const started = new Date().toISOString();
    const known = Object.prototype.hasOwnProperty.call(schemas, name);
    const operation = known ? name : 'unknown_tool';
    const fail = (status: string) => result(operation, status, null, started, true);
    if (!known) return fail('unknown_tool');
    let inputBytes: number;
    const input = args === undefined ? {} : args;
    try { inputBytes = Buffer.byteLength(JSON.stringify(input), 'utf8'); }
    catch { return fail('invalid_input'); }
    if (inputBytes > INPUT_LIMIT) return fail('input_too_large');
    const schema = schemas[name as keyof typeof schemas];
    const parsed = schema.safeParse(input);
    if (!parsed.success) return fail('invalid_input');
    try {
      let data: unknown;
      if (name === 'tiber_describe_capabilities') data = service.describe();
      else if (name === 'tiber_list_evidence') data = service.list();
      else data = await service.get((parsed.data as { evidence_id: string }).evidence_id);
      const domainStatus = typeof data === 'object' && data !== null && 'status' in data ? String(data.status) : 'ok';
      const output = result(operation, domainStatus, data, started);
      // Count both representations, not just the model or one JSON content block.
      if (Buffer.byteLength(JSON.stringify(output), 'utf8') > RESULT_LIMIT) return fail('response_too_large');
      return output;
    } catch (error) {
      return fail(error instanceof EvidenceFailure ? error.code : 'internal_error');
    }
  };
}
