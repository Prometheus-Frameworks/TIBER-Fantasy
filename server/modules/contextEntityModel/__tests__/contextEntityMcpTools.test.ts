/**
 * Fantasy #332 — MCP tool contract for the context-bound entity model pilot.
 *
 * These tests deliberately import no MCP SDK. The tool contract is a plain
 * data structure over the application service, and the SDK-dependent wiring in
 * `server/mcp/contextEntityStdioServer.ts` only hands these definitions to
 * `registerTool`. What is asserted here is the surface an MCP client sees:
 * which tools exist, how they are classified, what they refuse, and what they
 * put in front of a human.
 */

import { ContextEntityModelService } from '../contextEntityModelService';
import { ContextEntityResolver } from '../entityResolver';
import { CONTEXT_ENTITY_TOOLS, CONTEXT_ENTITY_TOOL_NAMES } from '../mcp/toolDefinitions';
import { FakeIdentityGateway, WARREN_TIBER_ID } from './fakeIdentityGateway';
import { InMemoryContextEntityModelStore } from './inMemoryContextEntityModelStore';

const WORKSPACE = 'H4MMER';
const OPERATOR = 'operator:user-zero';
const WARREN_CONTEXT =
  'The Steelers have a lot of vacated RB targets with Gainwell leaving, and Warren has been a ' +
  'very efficient receiver out of the backfield. I mainly want to monitor whether he’s getting ' +
  'consistent passing-game work and remains serviceable as an RB2/flex play.';

function tool(name: string) {
  const found = CONTEXT_ENTITY_TOOLS.find((definition) => definition.name === name);
  if (!found) throw new Error(`no such tool: ${name}`);
  return found;
}

function harness() {
  const store = new InMemoryContextEntityModelStore();
  const gateway = FakeIdentityGateway.withWarren();
  let current = new Date('2026-08-17T18:00:00.000Z').getTime();
  const service = new ContextEntityModelService(
    store,
    new ContextEntityResolver(gateway),
    () => new Date(current),
  );
  return {
    service,
    store,
    gateway,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

const SAVE_ARGS = {
  workspaceId: WORKSPACE,
  operatorId: OPERATOR,
  locator: { kind: 'player_name', name: 'Jaylen Warren' },
  operatorContext: WARREN_CONTEXT,
  horizon: 'medium_term',
  structuredMapContract: 'agent-thesis-proposal/v0',
  structuredMap: { thesis: 'Monitor passing-game usage stability' },
  agentRef: 'claude-code',
  sessionRef: 'session-a',
  operatorConfirmationStatement: 'Operator confirmed the interpretation.',
};

describe('context entity MCP tool surface', () => {
  it('exposes only the four calls the pilot needs', () => {
    expect(CONTEXT_ENTITY_TOOL_NAMES.sort()).toEqual([
      'tiber_append_entity_observation',
      'tiber_get_entity_model',
      'tiber_resolve_entity',
      'tiber_save_entity_model',
    ]);
  });

  it('classifies reads and writes explicitly and consistently', () => {
    expect(tool('tiber_resolve_entity').access).toBe('read');
    expect(tool('tiber_get_entity_model').access).toBe('read');
    expect(tool('tiber_save_entity_model').access).toBe('write');
    expect(tool('tiber_append_entity_observation').access).toBe('write');

    // The MCP annotation a client reads must agree with our classification —
    // a write advertised as read-only would misinform every host UI.
    for (const definition of CONTEXT_ENTITY_TOOLS) {
      expect(definition.annotations.readOnlyHint).toBe(definition.access === 'read');
      expect(definition.annotations.destructiveHint).toBe(false);
      expect(definition.annotations.openWorldHint).toBe(false);
    }
  });

  it('advertises save as idempotent and append as not', () => {
    expect(tool('tiber_save_entity_model').annotations.idempotentHint).toBe(true);
    expect(tool('tiber_append_entity_observation').annotations.idempotentHint).toBe(false);
  });

  it('requires operator and workspace attribution on every write tool', () => {
    for (const name of ['tiber_save_entity_model', 'tiber_append_entity_observation']) {
      const shape = tool(name).inputSchema.shape;
      expect(Object.keys(shape)).toEqual(expect.arrayContaining(['workspaceId', 'operatorId']));
    }
  });

  it('requires an operator confirmation statement to persist', async () => {
    const { service, store } = harness();
    const { operatorConfirmationStatement, ...withoutConfirmation } = SAVE_ARGS;

    await expect(tool('tiber_save_entity_model').handler(withoutConfirmation, service)).rejects.toThrow();
    // A blank statement is not a confirmation either — the schema rejects it
    // rather than passing a hollow `confirmed: true` down to the service.
    await expect(
      tool('tiber_save_entity_model').handler(
        { ...SAVE_ARGS, operatorConfirmationStatement: '   ' },
        service,
      ),
    ).rejects.toThrow();
    expect(store.snapshotModels()).toHaveLength(0);
  });
});

describe('context entity MCP tools — behaviour', () => {
  it('resolves an entity without writing anything', async () => {
    const { service, store } = harness();

    const result = await tool('tiber_resolve_entity').handler(
      { locator: { kind: 'player_name', name: 'Jaylen Warren' } },
      service,
    );

    expect(result.isError).toBe(false);
    expect(result.text).toContain(WARREN_TIBER_ID);
    expect(store.snapshotModels()).toHaveLength(0);
  });

  it('returns a concise human completion on save, not a serialised model', async () => {
    const { service } = harness();

    const result = await tool('tiber_save_entity_model').handler(SAVE_ARGS, service);

    expect(result.isError).toBe(false);
    expect(result.text.split('\n')[0]).toBe('Saved Jaylen Warren to H4MMER.');
    // No machine dump: the operator's context and the payload are not echoed
    // back into the conversation just because the write succeeded.
    expect(result.text).not.toContain(WARREN_CONTEXT);
    expect(result.text).not.toContain('thesis');
  });

  it('reports an idempotent re-save as unchanged', async () => {
    const { service } = harness();
    await tool('tiber_save_entity_model').handler(SAVE_ARGS, service);

    const result = await tool('tiber_save_entity_model').handler(SAVE_ARGS, service);

    expect(result.isError).toBe(false);
    expect(result.text).toContain('nothing changed');
  });

  it('surfaces an identity refusal as a tool error with the reason', async () => {
    const { service, gateway } = harness();
    gateway.byTiberId.set(WARREN_TIBER_ID, { status: 'ambiguous', matches: 2 });

    const result = await tool('tiber_save_entity_model').handler(
      { ...SAVE_ARGS, locator: { kind: 'tiber_player_id', tiberPlayerId: WARREN_TIBER_ID } },
      service,
    );

    expect(result.isError).toBe(true);
    expect(result.text).toContain('identity_ambiguous');
  });

  it('renders retrieval as readable context, withholding the payload by default', async () => {
    const { service } = harness();
    await tool('tiber_save_entity_model').handler(SAVE_ARGS, service);

    const result = await tool('tiber_get_entity_model').handler(
      { workspaceId: WORKSPACE, locator: { kind: 'player_name', name: 'Jaylen Warren' } },
      service,
    );

    expect(result.isError).toBe(false);
    expect(result.text).toContain('Jaylen Warren (RB, PIT) — workspace H4MMER');
    expect(result.text).toContain(WARREN_CONTEXT);
    expect(result.text).toContain('operator_local / operator_private');
    // Payload withheld unless deliberately requested.
    expect(result.text).not.toContain('Monitor passing-game usage stability');
    expect(result.text).toContain('agent-thesis-proposal/v0');
  });

  it('returns the verbatim payload only when explicitly requested', async () => {
    const { service } = harness();
    await tool('tiber_save_entity_model').handler(SAVE_ARGS, service);

    const result = await tool('tiber_get_entity_model').handler(
      {
        workspaceId: WORKSPACE,
        locator: { kind: 'player_name', name: 'Jaylen Warren' },
        includeStructuredMap: true,
      },
      service,
    );

    expect(result.text).toContain('Monitor passing-game usage stability');
  });

  it('appends an observation and says the model was not modified', async () => {
    const { service, store, advance } = harness();
    await tool('tiber_save_entity_model').handler(SAVE_ARGS, service);
    const before = store.snapshotModels();
    advance(86_400_000);

    const result = await tool('tiber_append_entity_observation').handler(
      {
        workspaceId: WORKSPACE,
        operatorId: OPERATOR,
        locator: { kind: 'player_name', name: 'Jaylen Warren' },
        body: 'Operator reports 5 targets in the most recent game.',
        observationSource: 'operator_supplied',
      },
      service,
    );

    expect(result.isError).toBe(false);
    expect(result.text).toContain('Appended observation 1');
    expect(result.text).toContain('was not modified');
    expect(store.snapshotModels()).toEqual(before);
  });

  it('refuses an observedAt that is not a valid instant', async () => {
    const { service } = harness();
    await tool('tiber_save_entity_model').handler(SAVE_ARGS, service);

    const result = await tool('tiber_append_entity_observation').handler(
      {
        workspaceId: WORKSPACE,
        operatorId: OPERATOR,
        locator: { kind: 'player_name', name: 'Jaylen Warren' },
        body: 'Bad clock.',
        observationSource: 'operator_supplied',
        observedAt: 'yesterday-ish',
      },
      service,
    );

    expect(result.isError).toBe(true);
    expect(result.text).toContain('invalid_input');
  });
});
