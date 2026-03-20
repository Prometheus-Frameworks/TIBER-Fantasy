import { RoleOpportunityInsightStatus } from '../roleOpportunity/playerDetailEnrichment';

export interface PlayerDetailEnrichmentRequest {
  playerId: string;
  season?: number;
  week?: number;
  includeRoleOpportunity?: boolean;
}

export interface PlayerDetailEnrichmentResult {
  roleOpportunityInsight?: RoleOpportunityInsightStatus;
}
