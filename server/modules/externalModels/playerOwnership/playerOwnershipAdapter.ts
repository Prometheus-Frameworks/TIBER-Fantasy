import { ZodError } from 'zod';
import { assessAndLogArtifactFreshness } from '../artifactFreshness';
import {
  CanonicalPlayerOwnershipAliasArtifact,
  CanonicalPlayerOwnershipAliasRow,
  CanonicalPlayerOwnershipArtifact,
  CanonicalPlayerOwnershipEvent,
  canonicalPlayerOwnershipAliasArtifactSchema,
  canonicalPlayerOwnershipAliasRowSchema,
  PlayerOwnershipIntegrationError,
  canonicalPlayerOwnershipArtifactSchema,
  canonicalPlayerOwnershipEventSchema,
} from './types';

export function normalizePlayerOwnershipToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function parsePlayerOwnershipArtifact(payload: unknown): CanonicalPlayerOwnershipArtifact {
  try {
    const artifact = canonicalPlayerOwnershipArtifactSchema.parse(payload);
    // Log-only: the return type is the upstream zod contract, so freshness is
    // not attached to the response here (warn-only phase, Issue #192 M3).
    assessAndLogArtifactFreshness({
      artifact: 'player_ownership_v0',
      generatedAt: artifact.generated_at,
    });
    return artifact;
  } catch (error) {
    throw new PlayerOwnershipIntegrationError(
      'invalid_payload',
      'Player ownership latest artifact does not match the player_ownership_v0 contract.',
      502,
      error instanceof ZodError ? error.flatten() : error,
    );
  }
}

export function parsePlayerOwnershipEvent(payload: unknown): CanonicalPlayerOwnershipEvent {
  try {
    return canonicalPlayerOwnershipEventSchema.parse(payload);
  } catch (error) {
    throw new PlayerOwnershipIntegrationError(
      'invalid_payload',
      'Player ownership event row does not match the player_ownership_change_event_v0 contract.',
      502,
      error instanceof ZodError ? error.flatten() : error,
    );
  }
}

export function parsePlayerOwnershipAliasesArtifact(payload: unknown): CanonicalPlayerOwnershipAliasArtifact {
  try {
    return canonicalPlayerOwnershipAliasArtifactSchema.parse(payload);
  } catch (error) {
    throw new PlayerOwnershipIntegrationError(
      'invalid_payload',
      'Player ownership alias artifact does not match the player_ownership_aliases_v0 contract.',
      502,
      error instanceof ZodError ? error.flatten() : error,
    );
  }
}

export function parsePlayerOwnershipAliasRow(payload: unknown): CanonicalPlayerOwnershipAliasRow {
  try {
    return canonicalPlayerOwnershipAliasRowSchema.parse(payload);
  } catch (error) {
    throw new PlayerOwnershipIntegrationError(
      'invalid_payload',
      'Player ownership alias row does not match the player_ownership_aliases_v0 contract.',
      502,
      error instanceof ZodError ? error.flatten() : error,
    );
  }
}
