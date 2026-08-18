/**
 * Fantasy #332 — application operations for context-bound entity models.
 *
 * These exercise the service with no MCP anywhere in the picture, which is the
 * layering claim the pilot makes: MCP is transport, and everything below it is
 * ordinary application code.
 */

import {
  ContextEntityModelService,
  type SaveEntityModelInput,
} from '../contextEntityModelService';
import { ContextEntityResolver } from '../entityResolver';
import { MODEL_ID_PATTERN, OBSERVATION_ID_PATTERN, sha256Digest } from '../domain';
import { FakeIdentityGateway, WARREN_TIBER_ID } from './fakeIdentityGateway';
import { InMemoryContextEntityModelStore } from './inMemoryContextEntityModelStore';
import type {
  ConfirmationOutcome,
  ConfirmationRequest,
  OperatorConfirmationGateway,
} from '../operatorConfirmation';

const WORKSPACE = 'H4MMER';
const OPERATOR = 'operator:user-zero';

/**
 * The confirmed H4MMER Warren context from the issue, used verbatim so the
 * fixture stays the operator's own words rather than a paraphrase.
 */
const WARREN_CONTEXT =
  'The Steelers have a lot of vacated RB targets with Gainwell leaving, and Warren has been a ' +
  'very efficient receiver out of the backfield. I mainly want to monitor whether he’s getting ' +
  'consistent passing-game work and remains serviceable as an RB2/flex play.';

function saveInput(overrides: Partial<SaveEntityModelInput> = {}): SaveEntityModelInput {
  return {
    workspaceId: WORKSPACE,
    operatorId: OPERATOR,
    locator: { kind: 'player_name', name: 'Jaylen Warren' },
    operatorContext: WARREN_CONTEXT,
    horizon: 'medium_term',
    structuredMap: {
      declaredContract: 'tiber-fantasy-pilot-thesis/v0',
      payload: {
        thesis: 'Monitor passing-game usage stability',
        watch_conditions: ['route participation', 'target share of backfield'],
      },
    },
    provenance: { agentRef: 'claude-code', sessionRef: 'session-a' },
    agentAttestedConfirmation: 'Operator confirmed the interpretation.',
    ...overrides,
  };
}

interface Harness {
  service: ContextEntityModelService;
  store: InMemoryContextEntityModelStore;
  gateway: FakeIdentityGateway;
  /** Advance the injected clock; every write reads it once. */
  advance(ms: number): void;
  now(): Date;
}

function harness(startIso = '2026-08-17T18:00:00.000Z'): Harness {
  const store = new InMemoryContextEntityModelStore();
  const gateway = FakeIdentityGateway.withWarren();
  let current = new Date(startIso).getTime();
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
    now: () => new Date(current),
  };
}

describe('ContextEntityModelService — save', () => {
  it('persists an operator-confirmed model bound to the canonical identity', async () => {
    const { service, now } = harness();

    const result = await service.saveEntityModel(saveInput());

    expect(result.status).toBe('saved');
    if (result.status !== 'saved') throw new Error('unreachable');
    expect(result.outcome).toBe('created');
    expect(result.model.modelId).toMatch(MODEL_ID_PATTERN);
    expect(result.model.version).toBe(1);
    expect(result.model.workspaceId).toBe(WORKSPACE);
    expect(result.model.subjectType).toBe('tiber_player');
    expect(result.model.subjectId).toBe(WARREN_TIBER_ID);
    expect(result.model.operatorContext).toBe(WARREN_CONTEXT);
    expect(result.model.createdAt).toEqual(now());
  });

  it('marks the model as operator-local private state, never shared or promoted', async () => {
    const { service } = harness();

    const result = await service.saveEntityModel(saveInput());

    if (result.status !== 'saved') throw new Error('unreachable');
    expect(result.model.authorityState).toBe('operator_local');
    expect(result.model.visibility).toBe('operator_private');
  });

  it('stores the structured map verbatim under its declared contract', async () => {
    const { service } = harness();
    const input = saveInput();

    const result = await service.saveEntityModel(input);

    if (result.status !== 'saved') throw new Error('unreachable');
    // The wrapper records what the producing agent declared and keeps the
    // payload identifiable by digest; it never rewrites or reinterprets it.
    expect(result.model.structuredMap.declaredContract).toBe(input.structuredMap.declaredContract);
    expect(result.model.structuredMap.payload).toEqual(input.structuredMap.payload);
    // And it never lets the declaration read as verified: the validation state
    // is stamped by the service, not accepted from the caller.
    expect(result.model.structuredMap.validation).toBe('not_performed');
    expect(result.model.structuredMapDigest).toBe(sha256Digest(result.model.structuredMap));
  });

  it('is idempotent: an identical re-save returns the stored model, not a new version', async () => {
    const { service, store, advance } = harness();

    const first = await service.saveEntityModel(saveInput());
    advance(60_000);
    const second = await service.saveEntityModel(
      // A genuine retry comes from a new session at a new time; neither is
      // part of the content, so both calls must land on the same stored row.
      saveInput({ provenance: { agentRef: 'claude-code', sessionRef: 'session-a-retry' } }),
    );

    if (first.status !== 'saved' || second.status !== 'saved') throw new Error('unreachable');
    expect(second.outcome).toBe('unchanged');
    expect(second.model.modelId).toBe(first.model.modelId);
    expect(second.model.version).toBe(1);
    expect(store.snapshotModels()).toHaveLength(1);
  });

  it('creates a new version for a changed interpretation and leaves the original intact', async () => {
    const { service, store, advance } = harness();

    const first = await service.saveEntityModel(saveInput());
    if (first.status !== 'saved') throw new Error('unreachable');
    const originalSnapshot = { ...first.model };

    advance(3_600_000);
    const second = await service.saveEntityModel(
      saveInput({ operatorContext: `${WARREN_CONTEXT} Also watching two-minute usage.` }),
    );

    if (second.status !== 'saved') throw new Error('unreachable');
    expect(second.outcome).toBe('created');
    expect(second.model.version).toBe(2);
    expect(second.model.modelId).not.toBe(first.model.modelId);

    const versions = store.snapshotModels().sort((a, b) => a.version - b.version);
    expect(versions).toHaveLength(2);
    expect(versions[0]).toEqual(originalSnapshot);
  });

  it('refuses persistence when nothing confirms it', async () => {
    const { service, store } = harness();

    // No operator channel and no attestation: there is nothing authorising the
    // write, whatever transport it arrived over.
    const { agentAttestedConfirmation, ...withoutAttestation } = saveInput();
    const result = await service.saveEntityModel(withoutAttestation);

    expect(result).toMatchObject({ status: 'refused', reason: 'invalid_input' });
    expect(store.snapshotModels()).toHaveLength(0);
  });

  it('refuses an empty attestation', async () => {
    const { service, store } = harness();

    for (const attestation of ['', '   ']) {
      const result = await service.saveEntityModel(
        saveInput({ agentAttestedConfirmation: attestation }),
      );
      expect(result).toMatchObject({ status: 'refused', reason: 'invalid_input' });
    }
    expect(store.snapshotModels()).toHaveLength(0);
  });

  it('refuses persistence with incomplete provenance attribution', async () => {
    const { service, store } = harness();

    const result = await service.saveEntityModel(
      saveInput({
        provenance: {
          agentRef: '',
          sessionRef: 'session-a',
          confirmation: { confirmed: true, statement: 'Operator confirmed.' },
        },
      }),
    );

    expect(result).toMatchObject({ status: 'refused', reason: 'invalid_input' });
    expect(store.snapshotModels()).toHaveLength(0);
  });

  it('refuses persistence without workspace or operator attribution', async () => {
    const { service } = harness();

    await expect(service.saveEntityModel(saveInput({ workspaceId: '   ' }))).resolves.toMatchObject({
      status: 'refused',
      reason: 'invalid_input',
    });
    await expect(service.saveEntityModel(saveInput({ operatorId: '' }))).resolves.toMatchObject({
      status: 'refused',
      reason: 'invalid_input',
    });
  });

  it('refuses to persist against an ambiguous identity', async () => {
    const { service, store, gateway } = harness();
    gateway.byTiberId.set(WARREN_TIBER_ID, { status: 'ambiguous', matches: 2 });

    const result = await service.saveEntityModel(
      saveInput({ locator: { kind: 'tiber_player_id', tiberPlayerId: WARREN_TIBER_ID } }),
    );

    expect(result).toMatchObject({ status: 'refused', reason: 'identity_ambiguous' });
    expect(store.snapshotModels()).toHaveLength(0);
  });

  it('refuses to persist against an unknown identity', async () => {
    const { service, store } = harness();

    const result = await service.saveEntityModel(
      saveInput({ locator: { kind: 'player_name', name: 'Nobody At All' } }),
    );

    expect(result).toMatchObject({ status: 'refused', reason: 'identity_not_found' });
    expect(store.snapshotModels()).toHaveLength(0);
  });

  it('refuses to persist while the identity registry is unavailable', async () => {
    const { service, store, gateway } = harness();
    gateway.byTiberId.set(WARREN_TIBER_ID, { status: 'unavailable' });

    const result = await service.saveEntityModel(
      saveInput({ locator: { kind: 'tiber_player_id', tiberPlayerId: WARREN_TIBER_ID } }),
    );

    expect(result).toMatchObject({ status: 'refused', reason: 'identity_unavailable' });
    expect(store.snapshotModels()).toHaveLength(0);
  });

  it('reports a store outage as unavailable rather than as nothing stored', async () => {
    const { service, store } = harness();
    store.unavailable = true;

    const result = await service.saveEntityModel(saveInput());

    expect(result).toMatchObject({ status: 'refused', reason: 'store_unavailable' });
  });
});

describe('ContextEntityModelService — the operator confirmation boundary', () => {
  /** A gateway standing in for a human answering through the MCP client. */
  function operatorWhoAnswers(outcome: ConfirmationOutcome): OperatorConfirmationGateway & {
    calls: ConfirmationRequest[];
  } {
    const calls: ConfirmationRequest[] = [];
    return {
      calls,
      async requestConfirmation(request) {
        calls.push(request);
        return outcome;
      },
    };
  }

  it('records an elicited approval as operator-verified, in the operator’s words', async () => {
    const { service } = harness();
    const gateway = operatorWhoAnswers({
      status: 'approved',
      statement: 'Yes — that is what I want tracked.',
    });

    const result = await service.saveEntityModel(saveInput(), { confirmation: gateway });

    if (result.status !== 'saved') throw new Error('unreachable');
    expect(result.model.provenance.confirmation).toEqual({
      confirmed: true,
      method: 'operator_elicited',
      statement: 'Yes — that is what I want tracked.',
    });
    // The operator was shown what they were approving, not just asked to agree.
    expect(gateway.calls).toHaveLength(1);
    expect(gateway.calls[0].interpretation).toBe(WARREN_CONTEXT);
    expect(gateway.calls[0].subject.displayName).toBe('Jaylen Warren');
  });

  it('refuses when the operator declines, even though the agent attested otherwise', async () => {
    const { service, store } = harness();
    const gateway = operatorWhoAnswers({ status: 'declined', detail: 'operator said no' });

    // The attestation says the operator confirmed. The operator, asked
    // directly, said no. If the attestation could win here, asking would be
    // theatre.
    const result = await service.saveEntityModel(
      saveInput({ agentAttestedConfirmation: 'Operator definitely confirmed this.' }),
      { confirmation: gateway },
    );

    expect(result).toMatchObject({ status: 'refused', reason: 'confirmation_declined' });
    expect(store.snapshotModels()).toHaveLength(0);
  });

  it('falls back to an attested confirmation only when there is no channel, and says so', async () => {
    const { service } = harness();
    const gateway = operatorWhoAnswers({ status: 'no_channel', detail: 'client cannot elicit' });

    const result = await service.saveEntityModel(saveInput(), { confirmation: gateway });

    if (result.status !== 'saved') throw new Error('unreachable');
    expect(result.model.provenance.confirmation.method).toBe('agent_attested');
    expect(result.model.provenance.confirmation.statement).toBe(
      'Operator confirmed the interpretation.',
    );
  });

  it('records a truthful placeholder when the operator approves without comment', async () => {
    const { service } = harness();
    const gateway = operatorWhoAnswers({ status: 'approved', statement: '   ' });

    const result = await service.saveEntityModel(saveInput(), { confirmation: gateway });

    if (result.status !== 'saved') throw new Error('unreachable');
    // Records what happened rather than inventing words for the operator.
    expect(result.model.provenance.confirmation.method).toBe('operator_elicited');
    expect(result.model.provenance.confirmation.statement).toBe(
      'Operator approved persistence without additional comment.',
    );
  });

  it('does not interrupt the operator for a save that would change nothing', async () => {
    const { service } = harness();
    const first = operatorWhoAnswers({ status: 'approved', statement: 'Approved.' });
    await service.saveEntityModel(saveInput(), { confirmation: first });

    const second = operatorWhoAnswers({ status: 'approved', statement: 'Approved.' });
    const result = await service.saveEntityModel(saveInput(), { confirmation: second });

    if (result.status !== 'saved') throw new Error('unreachable');
    expect(result.outcome).toBe('unchanged');
    // Asking a human to approve a no-op teaches them to approve without reading.
    expect(second.calls).toHaveLength(0);
  });

  it('does not let a caller declare its own confirmation method', async () => {
    const { service } = harness();

    // The caller supplies provenance and, at most, an attestation. There is no
    // input path that reaches `method`, so `operator_elicited` cannot be
    // claimed by whoever is making the request.
    const result = await service.saveEntityModel({
      ...saveInput(),
      provenance: {
        agentRef: 'claude-code',
        sessionRef: 'session-a',
        // Deliberately smuggled: an older shape that carried its own verdict.
        confirmation: { confirmed: true, method: 'operator_elicited', statement: 'I say so.' },
      } as unknown as SaveEntityModelInput['provenance'],
    });

    if (result.status !== 'saved') throw new Error('unreachable');
    expect(result.model.provenance.confirmation.method).toBe('agent_attested');
    expect(result.model.provenance).not.toHaveProperty('confirmation.confirmed', undefined);
  });
});

describe('ContextEntityModelService — retrieval', () => {
  it('returns the stored context and lineage for a workspace/entity pair', async () => {
    const { service } = harness();
    await service.saveEntityModel(saveInput());

    const result = await service.getEntityModel({
      workspaceId: WORKSPACE,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
    });

    expect(result.status).toBe('found');
    if (result.status !== 'found') throw new Error('unreachable');
    expect(result.model.operatorContext).toBe(WARREN_CONTEXT);
    expect(result.subject.displayName).toBe('Jaylen Warren');
    expect(result.observations).toEqual([]);
  });

  it('does not leak a model across workspaces', async () => {
    const { service } = harness();
    await service.saveEntityModel(saveInput());

    const result = await service.getEntityModel({
      workspaceId: 'SOME-OTHER-WORKSPACE',
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
    });

    expect(result).toMatchObject({ status: 'refused', reason: 'model_not_found' });
  });

  it('distinguishes a store outage from an empty workspace', async () => {
    const { service, store } = harness();
    await service.saveEntityModel(saveInput());
    store.unavailable = true;

    const result = await service.getEntityModel({
      workspaceId: WORKSPACE,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
    });

    expect(result).toMatchObject({ status: 'refused', reason: 'store_unavailable' });
  });
});

describe('ContextEntityModelService — observations', () => {
  it('appends an observation without rewriting the stored model', async () => {
    const { service, store, advance } = harness();
    const saved = await service.saveEntityModel(saveInput());
    if (saved.status !== 'saved') throw new Error('unreachable');
    const before = { ...saved.model };

    advance(86_400_000);
    const appended = await service.appendEntityObservation({
      workspaceId: WORKSPACE,
      operatorId: OPERATOR,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
      body: 'Operator reports 5 targets in the most recent game.',
      observationSource: 'operator_supplied',
    });

    expect(appended.status).toBe('appended');
    if (appended.status !== 'appended') throw new Error('unreachable');
    expect(appended.observation.observationId).toMatch(OBSERVATION_ID_PATTERN);
    expect(appended.observation.sequence).toBe(1);

    // The whole point: the confirmed model is byte-for-byte what it was.
    const stored = store.snapshotModels();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(before);
  });

  it('numbers the lineage in append order', async () => {
    const { service, advance } = harness();
    await service.saveEntityModel(saveInput());

    for (const body of ['first', 'second', 'third']) {
      advance(1000);
      await service.appendEntityObservation({
        workspaceId: WORKSPACE,
        operatorId: OPERATOR,
        locator: { kind: 'player_name', name: 'Jaylen Warren' },
        body,
        observationSource: 'operator_supplied',
      });
    }

    const result = await service.getEntityModel({
      workspaceId: WORKSPACE,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
    });
    if (result.status !== 'found') throw new Error('unreachable');
    expect(result.observations.map((observation) => observation.sequence)).toEqual([1, 2, 3]);
    expect(result.observations.map((observation) => observation.body)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('keeps earlier observations visible after a new model version is written', async () => {
    const { service, advance } = harness();
    await service.saveEntityModel(saveInput());
    await service.appendEntityObservation({
      workspaceId: WORKSPACE,
      operatorId: OPERATOR,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
      body: 'Appended against version 1.',
      observationSource: 'operator_supplied',
    });

    advance(1000);
    await service.saveEntityModel(saveInput({ operatorContext: `${WARREN_CONTEXT} Revised.` }));

    const result = await service.getEntityModel({
      workspaceId: WORKSPACE,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
    });
    if (result.status !== 'found') throw new Error('unreachable');
    expect(result.model.version).toBe(2);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].body).toBe('Appended against version 1.');
  });

  it('refuses an append for a model in another workspace', async () => {
    const { service } = harness();
    const saved = await service.saveEntityModel(saveInput());
    if (saved.status !== 'saved') throw new Error('unreachable');

    const result = await service.appendEntityObservation({
      workspaceId: 'SOME-OTHER-WORKSPACE',
      operatorId: OPERATOR,
      modelId: saved.model.modelId,
      body: 'Should not land.',
      observationSource: 'operator_supplied',
    });

    expect(result).toMatchObject({ status: 'refused', reason: 'workspace_mismatch' });
  });

  it('refuses an append when no model has been saved for the entity', async () => {
    const { service } = harness();

    const result = await service.appendEntityObservation({
      workspaceId: WORKSPACE,
      operatorId: OPERATOR,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
      body: 'Nothing to attach to.',
      observationSource: 'operator_supplied',
    });

    expect(result).toMatchObject({ status: 'refused', reason: 'model_not_found' });
  });

  it('refuses an append with neither a locator nor a model id', async () => {
    const { service } = harness();
    await service.saveEntityModel(saveInput());

    const result = await service.appendEntityObservation({
      workspaceId: WORKSPACE,
      operatorId: OPERATOR,
      body: 'Unaddressed.',
      observationSource: 'operator_supplied',
    });

    expect(result).toMatchObject({ status: 'refused', reason: 'invalid_input' });
  });
});

describe('ContextEntityModelService — truthful timestamps', () => {
  it('stamps writes from the observed clock, not from caller-supplied values', async () => {
    const { service, advance, now } = harness('2026-08-17T18:00:00.000Z');

    const saved = await service.saveEntityModel(saveInput());
    if (saved.status !== 'saved') throw new Error('unreachable');
    expect(saved.model.createdAt.toISOString()).toBe('2026-08-17T18:00:00.000Z');

    advance(7_200_000);
    const appended = await service.appendEntityObservation({
      workspaceId: WORKSPACE,
      operatorId: OPERATOR,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
      body: 'Later observation.',
      observationSource: 'operator_supplied',
    });
    if (appended.status !== 'appended') throw new Error('unreachable');

    // `recordedAt` tracked the clock forward; it is not a stored default and
    // not a value the caller could have chosen.
    expect(appended.observation.recordedAt).toEqual(now());
    expect(appended.observation.recordedAt.getTime()).toBeGreaterThan(
      saved.model.createdAt.getTime(),
    );
  });

  it('defaults observedAt to the moment of recording', async () => {
    const { service, now } = harness();
    await service.saveEntityModel(saveInput());

    const appended = await service.appendEntityObservation({
      workspaceId: WORKSPACE,
      operatorId: OPERATOR,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
      body: 'No explicit observation time.',
      observationSource: 'operator_supplied',
    });

    if (appended.status !== 'appended') throw new Error('unreachable');
    expect(appended.observation.observedAt).toEqual(now());
  });

  it('accepts an earlier observedAt, because observations can describe the past', async () => {
    const { service } = harness('2026-08-17T18:00:00.000Z');
    await service.saveEntityModel(saveInput());
    const observedAt = new Date('2026-08-16T20:30:00.000Z');

    const appended = await service.appendEntityObservation({
      workspaceId: WORKSPACE,
      operatorId: OPERATOR,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
      body: 'Something the operator saw yesterday.',
      observationSource: 'operator_supplied',
      observedAt,
    });

    if (appended.status !== 'appended') throw new Error('unreachable');
    expect(appended.observation.observedAt).toEqual(observedAt);
    expect(appended.observation.recordedAt.toISOString()).toBe('2026-08-17T18:00:00.000Z');
  });

  it('refuses an observedAt in the future', async () => {
    const { service } = harness('2026-08-17T18:00:00.000Z');
    await service.saveEntityModel(saveInput());

    const result = await service.appendEntityObservation({
      workspaceId: WORKSPACE,
      operatorId: OPERATOR,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
      body: 'Observed tomorrow, apparently.',
      observationSource: 'operator_supplied',
      observedAt: new Date('2026-08-18T18:00:00.000Z'),
    });

    expect(result).toMatchObject({ status: 'refused', reason: 'invalid_input' });
  });

  it('refuses an invalid observedAt instead of storing an epoch placeholder', async () => {
    const { service } = harness();
    await service.saveEntityModel(saveInput());

    const result = await service.appendEntityObservation({
      workspaceId: WORKSPACE,
      operatorId: OPERATOR,
      locator: { kind: 'player_name', name: 'Jaylen Warren' },
      body: 'Bad clock.',
      observationSource: 'operator_supplied',
      observedAt: new Date('not a date'),
    });

    expect(result).toMatchObject({ status: 'refused', reason: 'invalid_input' });
  });
});

describe('ContextEntityModelService — provider neutrality', () => {
  it('keeps football-use-case vocabulary out of the persistence contract', async () => {
    const { service, store } = harness();
    await service.saveEntityModel(saveInput());

    const [model] = store.snapshotModels();
    // Position, role, and scoring language may appear inside the operator's
    // own words and inside the agent's payload — but never as a field of the
    // durable wrapper. Those are the keys a reviewer should be able to read
    // and see nothing domain-specific in.
    expect(Object.keys(model).sort()).toEqual([
      'authorityState',
      'contentDigest',
      'createdAt',
      'horizon',
      'modelId',
      'operatorContext',
      'operatorId',
      'provenance',
      'structuredMap',
      'structuredMapDigest',
      'subjectId',
      'subjectType',
      'version',
      'visibility',
      'workspaceId',
    ]);
  });
});
