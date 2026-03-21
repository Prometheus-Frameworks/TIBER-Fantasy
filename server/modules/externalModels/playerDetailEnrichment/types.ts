import {
  ExternalForgeInsightStatus,
  ForgeComparisonInsightStatus,
} from '../forge/playerDetailEnrichment';
import { RoleOpportunityInsightStatus } from '../roleOpportunity/playerDetailEnrichment';
import { TiberForgeMode, TiberForgePosition, TiberForgeWeek } from '../forge/types';

export interface PlayerDetailEnrichmentRequest {
  playerId: string;
  playerPosition?: string;
  season?: number;
  week?: number | TiberForgeWeek;
  includeRoleOpportunity?: boolean;
  includeExternalForge?: boolean;
  includeForgeComparison?: boolean;
  externalForgeMode?: string;
}

export interface PlayerDetailEnrichmentResult {
  roleOpportunityInsight?: RoleOpportunityInsightStatus;
  externalForgeInsight?: ExternalForgeInsightStatus;
  forgeComparison?: ForgeComparisonInsightStatus;
}

export interface ParsedExternalForgeRequest {
  playerId: string;
  position: TiberForgePosition;
  season: number;
  week: TiberForgeWeek;
  mode: TiberForgeMode;
}
