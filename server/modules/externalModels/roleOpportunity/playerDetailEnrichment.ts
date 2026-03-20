import { RoleOpportunityService, roleOpportunityService } from './roleOpportunityService';
import {
  RoleOpportunityErrorCode,
  RoleOpportunityIntegrationError,
  TiberRoleOpportunityInsight,
} from './types';

export interface RoleOpportunityInsightStatus {
  available: boolean;
  fetchedAt: string;
  data?: TiberRoleOpportunityInsight;
  error?: {
    category: RoleOpportunityErrorCode | 'unexpected_error';
    message: string;
  };
}

export async function buildRoleOpportunityInsightStatus(
  query: {
    playerId: string;
    season: number;
    week: number;
  },
  service: RoleOpportunityService = roleOpportunityService,
): Promise<RoleOpportunityInsightStatus> {
  const fetchedAt = new Date().toISOString();

  try {
    const data = await service.getRoleOpportunityInsight(query);
    return {
      available: true,
      fetchedAt,
      data,
    };
  } catch (error) {
    if (error instanceof RoleOpportunityIntegrationError) {
      return {
        available: false,
        fetchedAt,
        error: {
          category: error.code,
          message: error.message,
        },
      };
    }

    return {
      available: false,
      fetchedAt,
      error: {
        category: 'unexpected_error',
        message: 'Role opportunity insight failed unexpectedly.',
      },
    };
  }
}
