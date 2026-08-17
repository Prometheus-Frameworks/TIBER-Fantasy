#!/usr/bin/env node
/**
 * End-to-end proof for the context-bound entity model pilot (Fantasy #332).
 *
 * Drives the real local stdio MCP server with the official MCP TypeScript SDK
 * client, in two *separate processes*:
 *
 *   Session A — connect, discover tools, resolve the entity, persist the
 *               operator-confirmed model, disconnect (server process exits).
 *   Session B — a brand-new client and a brand-new server process with no
 *               memory of Session A: retrieve the model, append one
 *               observation, and re-read to show the original is unchanged.
 *
 * Everything durable travels through PostgreSQL. If the persistence path were
 * in-process state, Session B would find nothing — which is exactly what this
 * script is here to demonstrate one way or the other.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/contextEntityGoldenTrace.mjs \
 *     --workspace H4MMER --operator operator:you --name "Jaylen Warren"
 *
 * The named player must already exist in the identity registry with a minted
 * canonical `tiber_player_id`; this script never creates identity.
 *
 * Read-only apart from the two writes it exists to demonstrate. It performs no
 * schema changes and touches no other table.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

function arg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const WORKSPACE = arg('--workspace', 'H4MMER');
const OPERATOR = arg('--operator', 'operator:local');
const PLAYER_NAME = arg('--name', 'Jaylen Warren');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required — the pilot persists to the application database.');
  process.exit(1);
}

/** The confirmed H4MMER context from #332, in the operator's own words. */
const OPERATOR_CONTEXT =
  'The Steelers have a lot of vacated RB targets with Gainwell leaving, and Warren has been a ' +
  'very efficient receiver out of the backfield. I mainly want to monitor whether he’s getting ' +
  'consistent passing-game work and remains serviceable as an RB2/flex play.';

async function openSession(label) {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'server/mcp/contextEntityStdioServer.ts'],
    env: { ...process.env },
    stderr: 'inherit',
  });
  const client = new Client({ name: `golden-trace-${label}`, version: '0.1.0' });
  await client.connect(transport);
  return client;
}

/** The `Model <id> v<n>, created <t> by ...` line of a rendered model. */
function modelHeadline(text) {
  return (text.split('\n').find((line) => line.startsWith('Model ')) ?? '').trim();
}

/** How many observations the rendered lineage reports. */
function observationCount(text) {
  if (text.includes('Observations: none appended yet.')) return 0;
  const match = text.match(/Observations \((\d+)\)/);
  return match ? Number(match[1]) : -1;
}

function show(label, result) {
  const text = (result.content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
  console.log(`\n--- ${label}${result.isError ? ' [TOOL ERROR]' : ''}\n${text}`);
  return { text, isError: Boolean(result.isError) };
}

async function main() {
  let failures = 0;
  const expect = (condition, description) => {
    console.log(`${condition ? '  PASS' : '  FAIL'}  ${description}`);
    if (!condition) failures += 1;
  };

  // ---- Session A ---------------------------------------------------------
  console.log('=== SESSION A (fresh process) ===');
  const sessionA = await openSession('a');

  const tools = await sessionA.listTools();
  console.log(`\n--- tools/list\n${tools.tools.map((tool) => tool.name).join('\n')}`);
  expect(tools.tools.length === 4, 'server advertises exactly the four pilot tools');

  const resolved = show(
    'tiber_resolve_entity',
    await sessionA.callTool({
      name: 'tiber_resolve_entity',
      arguments: { locator: { kind: 'player_name', name: PLAYER_NAME } },
    }),
  );
  expect(!resolved.isError, 'entity resolves to a canonical identity');
  const canonicalId = (resolved.text.match(/tbr_p_[0-9A-Z]{26}/) ?? [])[0];
  expect(Boolean(canonicalId), 'resolution returns an opaque canonical id');

  const saved = show(
    'tiber_save_entity_model',
    await sessionA.callTool({
      name: 'tiber_save_entity_model',
      arguments: {
        workspaceId: WORKSPACE,
        operatorId: OPERATOR,
        locator: { kind: 'tiber_player_id', tiberPlayerId: canonicalId },
        operatorContext: OPERATOR_CONTEXT,
        horizon: 'medium_term',
        structuredMapContract: 'agent-thesis-proposal/v0',
        structuredMap: {
          thesis: 'Passing-game usage stability is the thing worth monitoring here.',
          watch_conditions: ['route participation', 'share of backfield targets'],
        },
        agentRef: 'claude-code',
        sessionRef: 'golden-trace-session-a',
        operatorConfirmationStatement:
          'Operator confirmed the interpretation before persistence.',
      },
    }),
  );
  expect(!saved.isError, 'model persists after operator confirmation');
  expect(
    saved.text.split('\n')[0].startsWith('Saved '),
    'human-facing completion is a concise sentence',
  );
  expect(!saved.text.includes(OPERATOR_CONTEXT), 'save does not dump the model back into the chat');
  const modelId = (saved.text.match(/tbr_cem_[0-9a-f]{32}/) ?? [])[0];

  // Idempotency, over the wire rather than only in unit tests.
  const resaved = show(
    'tiber_save_entity_model (identical repeat)',
    await sessionA.callTool({
      name: 'tiber_save_entity_model',
      arguments: {
        workspaceId: WORKSPACE,
        operatorId: OPERATOR,
        locator: { kind: 'tiber_player_id', tiberPlayerId: canonicalId },
        operatorContext: OPERATOR_CONTEXT,
        horizon: 'medium_term',
        structuredMapContract: 'agent-thesis-proposal/v0',
        structuredMap: {
          thesis: 'Passing-game usage stability is the thing worth monitoring here.',
          watch_conditions: ['route participation', 'share of backfield targets'],
        },
        agentRef: 'claude-code',
        sessionRef: 'golden-trace-session-a-retry',
        operatorConfirmationStatement:
          'Operator confirmed the interpretation before persistence.',
      },
    }),
  );
  expect(resaved.text.includes('nothing changed'), 'identical re-save is idempotent');
  expect(resaved.text.includes(modelId), 'idempotent re-save resolves to the same model');

  await sessionA.close();
  console.log('\n[session A closed — server process exited]');

  // ---- Session B ---------------------------------------------------------
  console.log('\n=== SESSION B (new process, no Session A memory) ===');
  const sessionB = await openSession('b');

  const retrieved = show(
    'tiber_get_entity_model',
    await sessionB.callTool({
      name: 'tiber_get_entity_model',
      arguments: { workspaceId: WORKSPACE, locator: { kind: 'player_name', name: PLAYER_NAME } },
    }),
  );
  expect(!retrieved.isError, 'a fresh session retrieves the persisted model');
  // Recorded before the append so the assertions afterwards are relative. The
  // workspace may legitimately already hold versions and observations from a
  // previous run; what must hold is that the append changes exactly one thing.
  const modelLineBefore = modelHeadline(retrieved.text);
  const observationsBefore = observationCount(retrieved.text);
  expect(
    retrieved.text.includes(OPERATOR_CONTEXT),
    'retrieved context states the original management intent',
  );
  expect(retrieved.text.includes(modelId), 'retrieved model is the one Session A wrote');
  expect(
    retrieved.text.includes('operator_local / operator_private'),
    'retrieved model is marked operator-local, not shared reality',
  );

  const appended = show(
    'tiber_append_entity_observation',
    await sessionB.callTool({
      name: 'tiber_append_entity_observation',
      arguments: {
        workspaceId: WORKSPACE,
        operatorId: OPERATOR,
        locator: { kind: 'player_name', name: PLAYER_NAME },
        body: 'Operator-supplied: 6 targets, 4 receptions in the most recent game observed.',
        observationSource: 'operator_supplied',
      },
    }),
  );
  expect(!appended.isError, 'observation appends');

  const reread = show(
    'tiber_get_entity_model (after append)',
    await sessionB.callTool({
      name: 'tiber_get_entity_model',
      arguments: { workspaceId: WORKSPACE, locator: { kind: 'player_name', name: PLAYER_NAME } },
    }),
  );
  expect(
    modelHeadline(reread.text) === modelLineBefore,
    'the stored model row is unchanged after the append (same id, version, and creation time)',
  );
  expect(
    observationCount(reread.text) === observationsBefore + 1,
    `the lineage grew by exactly one observation (${observationsBefore} -> ${observationsBefore + 1})`,
  );
  expect(
    reread.text.includes(OPERATOR_CONTEXT),
    'the original operator context was not rewritten by the append',
  );

  await sessionB.close();

  console.log(`\n=== ${failures === 0 ? 'GOLDEN TRACE PASSED' : `GOLDEN TRACE FAILED (${failures})`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('golden trace failed:', error);
  process.exit(1);
});
