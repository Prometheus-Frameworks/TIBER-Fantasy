/**
 * Fantasy #332 — the Warren / H4MMER golden trace at the application layer.
 *
 * Session A creates and persists the model; Session B is a *separate service
 * instance with no shared in-process state* that retrieves the same model and
 * appends one observation. Only the store is shared, which is the claim under
 * test: TIBER carries the durable context, not conversational memory.
 *
 * This proves the semantics. The end-to-end proof over the real stdio MCP
 * server and a real PostgreSQL database — including a process restart between
 * the two sessions — is `scripts/contextEntityGoldenTrace.mjs`, recorded in
 * docs/mcp/context-bound-entity-model-v0.md.
 */

import { ContextEntityModelService } from '../contextEntityModelService';
import { ContextEntityResolver } from '../entityResolver';
import { FakeIdentityGateway, WARREN_TIBER_ID } from './fakeIdentityGateway';
import { InMemoryContextEntityModelStore } from './inMemoryContextEntityModelStore';

const WORKSPACE = 'H4MMER';
const OPERATOR = 'operator:user-zero';

/** The confirmed H4MMER Warren context, verbatim from the issue. */
const WARREN_CONTEXT =
  'The Steelers have a lot of vacated RB targets with Gainwell leaving, and Warren has been a ' +
  'very efficient receiver out of the backfield. I mainly want to monitor whether he’s getting ' +
  'consistent passing-game work and remains serviceable as an RB2/flex play.';

describe('Warren / H4MMER golden trace', () => {
  it('carries operator context from Session A to a Session B that never saw it', async () => {
    // One durable store; everything else is rebuilt per session.
    const store = new InMemoryContextEntityModelStore();
    const gateway = FakeIdentityGateway.withWarren();

    // ---- Session A -------------------------------------------------------
    const sessionAClock = new Date('2026-08-17T18:00:00.000Z');
    const sessionA = new ContextEntityModelService(
      store,
      new ContextEntityResolver(gateway),
      () => sessionAClock,
    );

    // The agent starts from the operator's natural phrasing, not an id.
    const resolved = await sessionA.resolveEntity({ kind: 'player_name', name: 'Jaylen Warren' });
    expect(resolved.status).toBe('resolved');
    if (resolved.status !== 'resolved') throw new Error('unreachable');
    expect(resolved.subject.subjectId).toBe(WARREN_TIBER_ID);

    const saved = await sessionA.saveEntityModel({
      workspaceId: WORKSPACE,
      operatorId: OPERATOR,
      locator: { kind: 'tiber_player_id', tiberPlayerId: resolved.subject.subjectId },
      operatorContext: WARREN_CONTEXT,
      horizon: 'medium_term',
      structuredMap: {
        contract: 'agent-thesis-proposal/v0',
        payload: {
          thesis: 'Passing-game usage is the thing worth monitoring here.',
          watch_conditions: ['route participation', 'share of backfield targets'],
        },
      },
      provenance: {
        agentRef: 'claude-code',
        sessionRef: 'session-a',
        confirmation: {
          confirmed: true,
          statement: 'Operator confirmed the Warren interpretation for H4MMER.',
        },
      },
    });
    expect(saved.status).toBe('saved');
    if (saved.status !== 'saved') throw new Error('unreachable');
    expect(saved.outcome).toBe('created');
    const originalModel = { ...saved.model };

    // ---- Session B -------------------------------------------------------
    // A fresh service. No shared resolver, no shared clock, no memory of the
    // conversation above — the only thing carried over is the durable store.
    const sessionBClock = new Date('2026-08-18T14:30:00.000Z');
    const sessionB = new ContextEntityModelService(
      store,
      new ContextEntityResolver(gateway),
      () => sessionBClock,
    );

    const retrieved = await sessionB.getEntityModel({
      workspaceId: WORKSPACE,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
    });
    expect(retrieved.status).toBe('found');
    if (retrieved.status !== 'found') throw new Error('unreachable');

    // Session B can state the original management context accurately, because
    // it was stored rather than remembered.
    expect(retrieved.model.operatorContext).toBe(WARREN_CONTEXT);
    expect(retrieved.model.horizon).toBe('medium_term');
    expect(retrieved.model.provenance.sessionRef).toBe('session-a');
    expect(retrieved.model.subjectId).toBe(WARREN_TIBER_ID);
    expect(retrieved.model.authorityState).toBe('operator_local');

    const appended = await sessionB.appendEntityObservation({
      workspaceId: WORKSPACE,
      operatorId: OPERATOR,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
      body: 'Operator-supplied: 6 targets, 4 receptions in the most recent game observed.',
      observationSource: 'operator_supplied',
      observedAt: new Date('2026-08-18T03:00:00.000Z'),
    });
    expect(appended.status).toBe('appended');
    if (appended.status !== 'appended') throw new Error('unreachable');
    expect(appended.observation.sequence).toBe(1);
    expect(appended.observation.recordedAt).toEqual(sessionBClock);

    // ---- The original is untouched --------------------------------------
    const versions = await sessionB.listEntityModelVersions(WORKSPACE, retrieved.subject);
    expect(Array.isArray(versions)).toBe(true);
    if (!Array.isArray(versions)) throw new Error('unreachable');
    expect(versions).toHaveLength(1);
    expect(versions[0]).toEqual(originalModel);
    expect(versions[0].contentDigest).toBe(originalModel.contentDigest);

    // ---- And the lineage is visible on the next read ---------------------
    const afterAppend = await sessionB.getEntityModel({
      workspaceId: WORKSPACE,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
    });
    if (afterAppend.status !== 'found') throw new Error('unreachable');
    expect(afterAppend.model).toEqual(originalModel);
    expect(afterAppend.observations).toHaveLength(1);
    expect(afterAppend.observations[0].observationSource).toBe('operator_supplied');
  });
});
