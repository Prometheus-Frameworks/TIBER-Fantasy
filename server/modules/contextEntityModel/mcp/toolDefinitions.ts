/**
 * MCP tool contract for the context-bound entity model pilot (Fantasy #332).
 *
 * This module holds *what* the tools are — names, descriptions, input schemas,
 * read/write classification, and the rendering of results into text a human
 * can read. It imports no MCP SDK: the SDK-dependent wiring lives in
 * `server/mcp/contextEntityStdioServer.ts` and does nothing but hand these
 * definitions to `McpServer.registerTool`.
 *
 * That split is the point of the layering. MCP is transport. The application
 * operations these handlers call are ordinary service methods that work
 * without any of this, and the tool contract stays testable without standing
 * up a transport.
 *
 * Two conventions worth stating, because they are easy to erode:
 *
 *   - **Tool availability is not write authority.** Every write tool requires
 *     the operator/workspace fields and, for persistence, an explicit operator
 *     confirmation. A client being able to see the tool grants nothing.
 *   - **Results are for reading, not for pasting.** Handlers return concise
 *     prose. Nothing here emits a serialised model by default; the structured
 *     payload comes back only when a caller deliberately asks for it.
 */

import { z } from 'zod';
import {
  HORIZONS,
  OBSERVATION_SOURCES,
  type ContextBoundEntityModel,
  type ContextEntityObservationRecord,
  type EntitySubject,
} from '../domain';
import type {
  AppendObservationResult,
  ContextEntityModelService,
  GetEntityModelResult,
  Refusal,
  ResolveEntityResult,
  SaveEntityModelResult,
} from '../contextEntityModelService';

export interface ToolResult {
  text: string;
  isError: boolean;
}

export interface ContextEntityToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  /** Explicit read/write classification, mirrored into MCP annotations. */
  access: 'read' | 'write';
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
  handler: (args: unknown, service: ContextEntityModelService) => Promise<ToolResult>;
}

// ---------------------------------------------------------------------------
// Shared input pieces
// ---------------------------------------------------------------------------

const locatorSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('tiber_player_id'),
      tiberPlayerId: z.string().describe('Canonical opaque TIBER entity id (tbr_p_...).'),
    }),
    z.object({
      kind: z.literal('player_name'),
      name: z.string().describe('Player name as the operator said it. A locator, never an identity.'),
      position: z.string().optional().describe('Optional position filter to narrow the lookup.'),
    }),
  ])
  .describe(
    'How to find the entity. Names are resolved against the canonical TIBER identity registry ' +
      'and an ambiguous, missing, or unavailable lookup is refused rather than guessed.',
  );

const workspaceIdSchema = z
  .string()
  .describe("Operator's workspace label (e.g. the operator's private workspace name).");

const operatorIdSchema = z
  .string()
  .describe('Operator attribution for this write. Required — there is no ambient operator.');

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function ok(text: string): ToolResult {
  return { text, isError: false };
}

function refusalResult(refusal: Refusal): ToolResult {
  return { text: `Refused (${refusal.reason}): ${refusal.detail}`, isError: true };
}

function describeSubject(subject: EntitySubject): string {
  const qualifiers = [subject.position, subject.team].filter(Boolean).join(', ');
  return qualifiers ? `${subject.displayName} (${qualifiers})` : subject.displayName;
}

function renderObservations(observations: ContextEntityObservationRecord[]): string {
  if (observations.length === 0) return 'Observations: none appended yet.';
  const lines = observations.map(
    (observation) =>
      `  ${observation.sequence}. [${observation.observationSource}] observed ` +
      `${observation.observedAt.toISOString()} by ${observation.recordedBy}: ${observation.body}`,
  );
  return [`Observations (${observations.length}):`, ...lines].join('\n');
}

/**
 * Human-readable rendering of a stored model.
 *
 * Laid out as prose fields rather than serialised so a retrieving session can
 * explain the context in its own words instead of relaying a machine dump.
 * The structured payload is included only when explicitly requested.
 */
function renderModel(
  subject: EntitySubject,
  model: ContextBoundEntityModel,
  observations: ContextEntityObservationRecord[],
  includeStructuredMap: boolean,
): string {
  const lines = [
    `${describeSubject(subject)} — workspace ${model.workspaceId}`,
    `Canonical identity: ${model.subjectId} (${model.subjectType})`,
    `Model ${model.modelId} v${model.version}, created ${model.createdAt.toISOString()} ` +
      `by ${model.provenance.agentRef} for operator ${model.operatorId}`,
    `Authority: ${model.authorityState} / ${model.visibility} — operator-local working context, ` +
      'not Shared Reality and not a promoted artifact',
    `Horizon: ${model.horizon}`,
    'Operator context:',
    `  ${model.operatorContext}`,
    `Operator confirmation at creation: ${model.provenance.confirmation.statement}`,
    `Structured map: contract ${model.structuredMap.contract}, digest ${model.structuredMapDigest}, ` +
      `top-level keys [${Object.keys(model.structuredMap.payload).sort().join(', ')}]`,
    renderObservations(observations),
  ];
  if (includeStructuredMap) {
    lines.push(
      'Structured map payload (verbatim, as supplied by the producing agent):',
      `  ${JSON.stringify(model.structuredMap.payload)}`,
    );
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const resolveEntityInput = z.object({ locator: locatorSchema });

const getEntityModelInput = z.object({
  workspaceId: workspaceIdSchema,
  locator: locatorSchema,
  includeStructuredMap: z
    .boolean()
    .optional()
    .describe(
      'Return the verbatim structured-map payload as well. Off by default: retrieval is meant ' +
        'to let you explain the context, not to paste a serialised model into the conversation.',
    ),
});

const saveEntityModelInput = z.object({
  workspaceId: workspaceIdSchema,
  operatorId: operatorIdSchema,
  locator: locatorSchema,
  operatorContext: z
    .string()
    .describe("Why this entity matters in this workspace, in the operator's own framing."),
  horizon: z.enum(HORIZONS).describe('Generic management/research horizon.'),
  structuredMapContract: z
    .string()
    .describe(
      'Contract id the payload claims to follow, e.g. agent-thesis-proposal/v0. Recorded and ' +
        'digested as declared; this repo does not define or validate that contract.',
    ),
  structuredMap: z
    .record(z.unknown())
    .describe('Structured interpretation payload. Stored verbatim, never rewritten.'),
  agentRef: z.string().describe('Producing agent/client reference, e.g. claude-code.'),
  sessionRef: z
    .string()
    .describe('Opaque session reference for provenance. Must not carry conversation content.'),
  operatorConfirmationStatement: z
    .string()
    .trim()
    .min(1)
    .describe(
      'What the operator confirmed. Persistence requires it. Confirmation authorises storing ' +
        'the interpretation — it is not a request to print the model into the conversation.',
    ),
  provenanceNote: z.string().optional().describe('Optional note on how the interpretation was reached.'),
});

const appendObservationInput = z.object({
  workspaceId: workspaceIdSchema,
  operatorId: operatorIdSchema,
  locator: locatorSchema.optional(),
  modelId: z
    .string()
    .optional()
    .describe('Append against an exact model version instead of the latest one.'),
  body: z.string().describe('The observation, in the words of whoever supplied it.'),
  observationSource: z
    .enum(OBSERVATION_SOURCES)
    .describe('Where the observation came from. Never inferred from its text.'),
  observedAt: z
    .string()
    .optional()
    .describe(
      'ISO-8601 instant the observation was actually made. Defaults to now; a future time is refused.',
    ),
});

export const CONTEXT_ENTITY_TOOLS: ContextEntityToolDefinition[] = [
  {
    name: 'tiber_resolve_entity',
    title: 'Resolve a TIBER entity',
    description:
      'READ. Resolve a player name or canonical id to the opaque canonical TIBER entity identity. ' +
      'Ambiguous, missing, incomplete, or unavailable lookups are refused rather than guessed.',
    inputSchema: resolveEntityInput,
    access: 'read',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async handler(args, service) {
      const input = resolveEntityInput.parse(args);
      const result: ResolveEntityResult = await service.resolveEntity(input.locator);
      if (result.status === 'refused') return refusalResult(result);
      return ok(
        `Resolved ${describeSubject(result.subject)} to ${result.subject.subjectId} ` +
          `(${result.subject.subjectType}).`,
      );
    },
  },
  {
    name: 'tiber_get_entity_model',
    title: 'Get a context-bound entity model',
    description:
      'READ. Retrieve the durable context an operator saved about an entity in one workspace, ' +
      'with its append-only observation lineage. This is what lets a session with no prior ' +
      'conversation explain why the entity matters there.',
    inputSchema: getEntityModelInput,
    access: 'read',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async handler(args, service) {
      const input = getEntityModelInput.parse(args);
      const result: GetEntityModelResult = await service.getEntityModel({
        workspaceId: input.workspaceId,
        locator: input.locator,
      });
      if (result.status === 'refused') return refusalResult(result);
      return ok(
        renderModel(result.subject, result.model, result.observations, input.includeStructuredMap === true),
      );
    },
  },
  {
    name: 'tiber_save_entity_model',
    title: 'Save a context-bound entity model',
    description:
      'WRITE. Persist an operator-confirmed interpretation of why an entity matters in a workspace. ' +
      'Requires explicit operator/workspace attribution and an operator confirmation statement. ' +
      'Idempotent by content: re-saving the same interpretation returns the stored model instead ' +
      'of creating a second version. A changed interpretation becomes a new version and leaves ' +
      'the previous one intact. Writes operator-local private state only — never Shared Reality, ' +
      'a promoted artifact, or any fantasy roster action.',
    inputSchema: saveEntityModelInput,
    access: 'write',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async handler(args, service) {
      const input = saveEntityModelInput.parse(args);
      const result: SaveEntityModelResult = await service.saveEntityModel({
        workspaceId: input.workspaceId,
        operatorId: input.operatorId,
        locator: input.locator,
        operatorContext: input.operatorContext,
        horizon: input.horizon,
        structuredMap: { contract: input.structuredMapContract, payload: input.structuredMap },
        provenance: {
          agentRef: input.agentRef,
          sessionRef: input.sessionRef,
          confirmation: { confirmed: true, statement: input.operatorConfirmationStatement },
          note: input.provenanceNote,
        },
      });
      if (result.status === 'refused') return refusalResult(result);

      const name = result.subject.displayName;
      const headline =
        result.outcome === 'created'
          ? `Saved ${name} to ${result.model.workspaceId}.`
          : `${name} was already saved to ${result.model.workspaceId}; nothing changed.`;
      return ok(
        `${headline}\nModel ${result.model.modelId} v${result.model.version}, ` +
          `recorded ${result.model.createdAt.toISOString()}.`,
      );
    },
  },
  {
    name: 'tiber_append_entity_observation',
    title: 'Append an observation to a context-bound entity model',
    description:
      'WRITE. Add one observation to an entity model\'s append-only lineage. The stored model is ' +
      'not modified: the observation is a new linked record, and the original interpretation ' +
      'stays byte-identical and replayable. Not idempotent — two identical observations are two ' +
      'observations.',
    inputSchema: appendObservationInput,
    access: 'write',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async handler(args, service) {
      const input = appendObservationInput.parse(args);

      let observedAt: Date | undefined;
      if (input.observedAt !== undefined) {
        observedAt = new Date(input.observedAt);
        if (Number.isNaN(observedAt.getTime())) {
          return { text: 'Refused (invalid_input): observedAt is not a valid ISO-8601 instant', isError: true };
        }
      }

      const result: AppendObservationResult = await service.appendEntityObservation({
        workspaceId: input.workspaceId,
        operatorId: input.operatorId,
        locator: input.locator,
        modelId: input.modelId,
        body: input.body,
        observationSource: input.observationSource,
        observedAt,
      });
      if (result.status === 'refused') return refusalResult(result);
      return ok(
        `Appended observation ${result.observation.sequence} to ${result.model.modelId} ` +
          `v${result.model.version} in ${result.observation.workspaceId}. ` +
          'The saved model itself was not modified.',
      );
    },
  },
];

/** Tool names, for wiring assertions and the operator-facing note. */
export const CONTEXT_ENTITY_TOOL_NAMES = CONTEXT_ENTITY_TOOLS.map((tool) => tool.name);
