import {
  ExternalForgeInsightStatus,
  ForgeComparisonInsightStatus,
  SelectedForgeInsightStatus,
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
  includeSelectedForge?: boolean;
  externalForgeMode?: string;
  forgeSourceMode?: string;
}

export interface PlayerDetailEnrichmentResult {
  roleOpportunityInsight?: RoleOpportunityInsightStatus;
  externalForgeInsight?: ExternalForgeInsightStatus;
  forgeComparison?: ForgeComparisonInsightStatus;
  selectedForgeInsight?: SelectedForgeInsightStatus;
}

export interface ParsedExternalForgeRequest {
  playerId: string;
  position: TiberForgePosition;
  season: number;
  week: TiberForgeWeek;
  mode: TiberForgeMode;
}
