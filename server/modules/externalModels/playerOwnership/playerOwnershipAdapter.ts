import { ZodError } from 'zod';
import {
  CanonicalPlayerOwnershipArtifact,
  CanonicalPlayerOwnershipEvent,
  PlayerOwnershipIntegrationError,
  canonicalPlayerOwnershipArtifactSchema,
  canonicalPlayerOwnershipEventSchema,
} from './types';

export function normalizePlayerOwnershipToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function parsePlayerOwnershipArtifact(payload: unknown): CanonicalPlayerOwnershipArtifact {
  try {
    return canonicalPlayerOwnershipArtifactSchema.parse(payload);
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
