import { promises as fs } from 'fs';
import path from 'path';

const DEFAULT_TEAMSTATE_ENVIRONMENT_PROFILES_PATH = path.join(
  process.cwd(),
  '..',
  'TIBER-Teamstate',
  'output',
  'team_environment_profiles_v0.json',
);

export type TeamEnvironmentTier = 'elite' | 'strong' | 'average' | 'weak' | 'unknown';
export type TeamPassEnvironmentTier = 'pass_heavy' | 'balanced' | 'run_heavy' | 'unknown';
export type TeamPaceTier = 'fast' | 'neutral' | 'slow' | 'unknown';
export type TeamVolatilityTier = 'stable' | 'volatile' | 'unknown';

export interface TeamEnvironmentProfileV0 {
  contractVersion: 'team_environment_profile_v0';
  teamId: string;
  teamAbbr: string;
  season: number;
  generatedAt: string;
  sourceSnapshotAt: string | null;
  marketTier: TeamEnvironmentTier;
  offenseTier: TeamEnvironmentTier;
  passEnvironmentTier: TeamPassEnvironmentTier;
  paceTier: TeamPaceTier;
  volatilityTier: TeamVolatilityTier;
  signals: Array<{ name: string; value: number | string | null; source: string; notes?: string }>;
  warnings: string[];
}

export interface TeamEnvironmentProfileArtifactV0 {
  artifact: 'team_environment_profiles_v0';
  generatedAt: string;
  sourceArtifacts: string[];
  profiles: TeamEnvironmentProfileV0[];
}

function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }

function isValidProfile(v: unknown): v is TeamEnvironmentProfileV0 {
  if (!isRecord(v)) return false;
  if (v.contractVersion !== 'team_environment_profile_v0') return false;
  if (typeof v.teamId !== 'string' || typeof v.teamAbbr !== 'string' || typeof v.season !== 'number') return false;
  if (typeof v.generatedAt !== 'string') return false;
  if (!(typeof v.sourceSnapshotAt === 'string' || v.sourceSnapshotAt === null)) return false;
  if (!Array.isArray(v.signals) || !Array.isArray(v.warnings)) return false;
  if ('team' in v) return false;
  return true;
}

function isValidArtifact(v: unknown): v is TeamEnvironmentProfileArtifactV0 {
  if (!isRecord(v)) return false;
  if (v.artifact !== 'team_environment_profiles_v0') return false;
  if (typeof v.generatedAt !== 'string' || !Array.isArray(v.sourceArtifacts) || !Array.isArray(v.profiles)) return false;
  return v.profiles.every(isValidProfile);
}

export class TeamEnvironmentProfilesClient {
  constructor(private readonly artifactPath = process.env.TEAMSTATE_ENVIRONMENT_PROFILES_PATH ?? DEFAULT_TEAMSTATE_ENVIRONMENT_PROFILES_PATH) {}

  getConfig() { return { artifactPath: this.artifactPath }; }

  async readArtifact(): Promise<TeamEnvironmentProfileArtifactV0 | null> {
    try {
      const raw = await fs.readFile(this.artifactPath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!isValidArtifact(parsed)) {
        throw new Error('Teamstate environment artifact JSON does not match team_environment_profiles_v0 shape.');
      }
      return parsed;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code === 'ENOENT') return null;
      throw error;
    }
  }
}
