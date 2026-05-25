import { promises as fs } from 'fs';
import path from 'path';

export type TeamEnvironmentLaneTier = string | null;

export interface TeamEnvironmentProfile {
  team: {
    abbreviation: string;
    name?: string | null;
  };
  offenseTier: TeamEnvironmentLaneTier;
  passEnvironmentTier: TeamEnvironmentLaneTier;
  paceTier: TeamEnvironmentLaneTier;
  volatilityTier: TeamEnvironmentLaneTier;
  marketTier?: TeamEnvironmentLaneTier;
  warnings: string[];
  signals?: unknown;
}

export interface TeamEnvironmentProfilesArtifact {
  artifact: string;
  generatedAt?: string;
  season?: number;
  profiles: TeamEnvironmentProfile[];
}

export class TeamEnvironmentProfilesClient {
  private readonly artifactPath: string;

  constructor(artifactPath = process.env.TEAMSTATE_ENVIRONMENT_PROFILES_PATH ?? path.join('..', 'TIBER-Teamstate', 'output', 'team_environment_profiles_v0.json')) {
    this.artifactPath = artifactPath;
  }

  getStatus() {
    return { artifactPath: this.artifactPath };
  }

  async readArtifact(): Promise<{ available: boolean; artifact: TeamEnvironmentProfilesArtifact | null; warnings: string[] }> {
    try {
      const raw = await fs.readFile(this.artifactPath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!isValidArtifact(parsed)) {
        return { available: false, artifact: null, warnings: ['Teamstate environment artifact is invalid_payload.'] };
      }
      return { available: true, artifact: parsed, warnings: [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return { available: false, artifact: null, warnings: ['Teamstate environment artifact is missing.'] };
      }
      if (error instanceof SyntaxError) {
        return { available: false, artifact: null, warnings: ['Teamstate environment artifact JSON is invalid.'] };
      }
      return { available: false, artifact: null, warnings: ['Teamstate environment artifact is unavailable.'] };
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidArtifact(value: unknown): value is TeamEnvironmentProfilesArtifact {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.profiles)) return false;
  return value.profiles.every((profile) => {
    if (!isRecord(profile)) return false;
    if (!isRecord(profile.team) || typeof profile.team.abbreviation !== 'string') return false;
    return true;
  });
}
