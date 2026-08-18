/**
 * Operator confirmation boundary (Fantasy #332).
 *
 * The problem this exists to solve: an agent holding the write tool can
 * assemble a confirmation record and hand it to the service. If the service
 * only checks a boolean the agent supplied, then "persistence requires
 * operator confirmation" is a sentence in a document, not a property of the
 * system — the agent is both the requester and the witness.
 *
 * A confirmation is only worth something if the answer comes from somewhere
 * the calling agent cannot reach. That is what this port is for: the transport
 * adapter supplies a channel to the *human*, and the service asks through it.
 * Over MCP that channel is elicitation — the server asks the client, the
 * client asks its user, and the answer returns outside the agent's control.
 *
 * When no such channel exists, the service does not pretend otherwise. It
 * records the confirmation as `agent_attested` and every surface says so.
 * Deferring honestly is fine; claiming an authorisation that never happened is
 * not.
 */

import type { EntitySubject } from './domain';

/** What the operator is being asked to approve. */
export interface ConfirmationRequest {
  workspaceId: string;
  operatorId: string;
  subject: EntitySubject;
  /** The interpretation, in the words the operator should see before approving. */
  interpretation: string;
}

export type ConfirmationOutcome =
  /** The operator was asked and approved. `statement` is what they answered. */
  | { status: 'approved'; statement: string }
  /** The operator was asked and said no. A refusal, never a fallback. */
  | { status: 'declined'; detail: string }
  /**
   * No channel to the operator exists on this call — the client does not
   * support elicitation, or the caller is not a transport with a human on the
   * other end. The caller may fall back to an attested confirmation, which
   * must then be labelled as such.
   */
  | { status: 'no_channel'; detail: string };

export interface OperatorConfirmationGateway {
  requestConfirmation(request: ConfirmationRequest): Promise<ConfirmationOutcome>;
}

/**
 * Gateway for callers with no human attached — scripts, batch jobs, tests.
 *
 * Explicit rather than implicit: a caller that passes this is stating that it
 * cannot reach an operator, and the resulting model is marked `agent_attested`
 * rather than silently looking like a verified approval.
 */
export const noOperatorChannel: OperatorConfirmationGateway = {
  async requestConfirmation() {
    return { status: 'no_channel', detail: 'caller has no operator channel' };
  },
};
