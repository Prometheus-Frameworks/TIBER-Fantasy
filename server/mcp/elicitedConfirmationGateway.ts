/**
 * MCP-elicitation confirmation gateway (Fantasy #332).
 *
 * This is where "persistence requires operator confirmation" stops being a
 * claim and becomes a mechanism. The server asks the *client* to put a
 * question to its user; the client returns the user's answer. The agent that
 * called the write tool is not on that path and cannot produce the answer by
 * asserting it.
 *
 * Elicitation is an optional client capability. When the connected client does
 * not declare it, this gateway reports `no_channel` rather than inventing an
 * approval — the service then records the caller's attestation as
 * `agent_attested`, which every human-facing surface labels as unverified.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type {
  ConfirmationOutcome,
  ConfirmationRequest,
  OperatorConfirmationGateway,
} from '../modules/contextEntityModel/operatorConfirmation';

/** How long to wait for a human to answer before giving up. */
const ELICITATION_TIMEOUT_MS = 120_000;

export function createElicitedConfirmationGateway(server: Server): OperatorConfirmationGateway {
  return {
    async requestConfirmation(request: ConfirmationRequest): Promise<ConfirmationOutcome> {
      if (!server.getClientCapabilities()?.elicitation) {
        return {
          status: 'no_channel',
          detail: 'the connected MCP client does not support elicitation',
        };
      }

      const subject = request.subject.displayName || request.subject.subjectId;

      let result;
      try {
        result = await server.elicitInput(
          {
            message:
              `TIBER wants to save context about ${subject} to your workspace ` +
              `"${request.workspaceId}".\n\nIt would record this as why the entity matters ` +
              `there:\n\n${request.interpretation}\n\nSave it?`,
            requestedSchema: {
              type: 'object',
              properties: {
                decision: {
                  type: 'string',
                  title: 'Save this to your workspace?',
                  enum: ['approve', 'reject'],
                  enumNames: ['Yes, save it', 'No, do not save'],
                },
                statement: {
                  type: 'string',
                  title: 'Anything to record about what you are approving (optional)',
                },
              },
              required: ['decision'],
            },
          },
          { timeout: ELICITATION_TIMEOUT_MS },
        );
      } catch (error) {
        // A failed or timed-out ask is not an approval. Reporting no_channel
        // would let the caller's attestation stand in for an operator who may
        // simply not have answered yet, so this is a decline.
        const message = error instanceof Error ? error.message : String(error);
        return { status: 'declined', detail: `operator confirmation could not be obtained: ${message}` };
      }

      if (result.action !== 'accept') {
        return {
          status: 'declined',
          detail:
            result.action === 'decline'
              ? 'operator declined to save this context'
              : 'operator cancelled the confirmation',
        };
      }

      const decision = result.content?.decision;
      if (decision !== 'approve') {
        return { status: 'declined', detail: 'operator did not approve saving this context' };
      }

      const statement = typeof result.content?.statement === 'string' ? result.content.statement : '';
      return { status: 'approved', statement };
    },
  };
}
