import { db } from '../../db';
import { sosDashboards, sosWidgets, sosUserPreferences } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface DashboardConfig {
  layout: 'grid' | 'vertical' | 'horizontal';
  theme: 'light' | 'dark' | 'auto';
  refreshInterval: number; // minutes
  globalFilters: {
    positions: string[];
    teams: string[];
    seasons: number[];
  };
}

export interface WidgetConfig {
  title?: string;
  positions?: string[];
  teams?: string[];
  weekRange?: { start: number; end: number };
  showTiers?: boolean;
  chartType?: 'bar' | 'line' | 'table';
  sortBy?: 'team' | 'score' | 'tier';
  customThresholds?: { green: number; yellow: number };
}

export interface UserPreferences {
  defaultPositions: string[];
  defaultWeekRange: { start: number; end: number };
  favoriteTeams: string[];
  tierThresholds: { green: number; yellow: number };
  viewPreferences: { showCharts: boolean; showTable: boolean };
}

export class SOSDashboardService {
  
  // User Preferences Management
  static async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    const result = await db
      .select()
      .from(sosUserPreferences)
      .where(eq(sosUserPreferences.userId, userId))
      .limit(1);
    
    if (result.length === 0) {
      return null;
    }
    
    const prefs = result[0];
    return {
      defaultPositions: prefs.defaultPositions as string[],
      defaultWeekRange: prefs.defaultWeekRange as { start: number; end: number },
      favoriteTeams: prefs.favoriteTeams as string[],
      tierThresholds: prefs.tierThresholds as { green: number; yellow: number },
      viewPreferences: prefs.viewPreferences as { showCharts: boolean; showTable: boolean }
    };
  }

  static async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>) {
    const existing = await this.getUserPreferences(userId);
    
    if (existing) {
      await db
        .update(sosUserPreferences)
        .set({
          defaultPositions: preferences.defaultPositions || existing.defaultPositions,
          defaultWeekRange: preferences.defaultWeekRange || existing.defaultWeekRange,
          favoriteTeams: preferences.favoriteTeams || existing.favoriteTeams,
          tierThresholds: preferences.tierThresholds || existing.tierThresholds,
          viewPreferences: preferences.viewPreferences || existing.viewPreferences,
          updatedAt: new Date(),
        })
        .where(eq(sosUserPreferences.userId, userId));
    } else {
      await db.insert(sosUserPreferences).values({
        userId,
        defaultPositions: preferences.defaultPositions || ['RB', 'WR'],
        defaultWeekRange: preferences.defaultWeekRange || { start: 1, end: 5 },
        favoriteTeams: preferences.favoriteTeams || [],
        tierThresholds: preferences.tierThresholds || { green: 67, yellow: 33 },
        viewPreferences: preferences.viewPreferences || { showCharts: true, showTable: true },
      });
    }
  }

  // Dashboard Management
  static async getUserDashboards(userId: string) {
    const dashboards = await db
      .select()
      .from(sosDashboards)
      .where(eq(sosDashboards.userId, userId))
      .orderBy(sosDashboards.isDefault, sosDashboards.updatedAt);

    const result = [];
    for (const dashboard of dashboards) {
      const widgets = await db
        .select()
        .from(sosWidgets)
        .where(eq(sosWidgets.dashboardId, dashboard.id));
      
      result.push({
        ...dashboard,
        widgets
      });
    }

    return result;
  }

  static async createDashboard(userId: string, name: string, config: DashboardConfig, isDefault = false) {
    // If setting as default, unset other defaults first
    if (isDefault) {
      await db
        .update(sosDashboards)
        .set({ isDefault: false })
        .where(eq(sosDashboards.userId, userId));
    }

    const result = await db
      .insert(sosDashboards)
      .values({
        userId,
        name,
        isDefault,
        config,
      })
      .returning({ id: sosDashboards.id });

    return result[0].id;
  }

  static async updateDashboard(dashboardId: number, userId: string, config: DashboardConfig) {
    await db
      .update(sosDashboards)
      .set({
        config,
        updatedAt: new Date(),
      })
      .where(and(
        eq(sosDashboards.id, dashboardId),
        eq(sosDashboards.userId, userId)
      ));
  }

  static async deleteDashboard(dashboardId: number, userId: string) {
    await db
      .delete(sosDashboards)
      .where(and(
        eq(sosDashboards.id, dashboardId),
        eq(sosDashboards.userId, userId)
      ));
  }

  // Widget Management
  static async addWidget(dashboardId: number, widgetType: string, position: any, config: WidgetConfig) {
    const result = await db
      .insert(sosWidgets)
      .values({
        dashboardId,
        widgetType,
        position,
        config,
      })
      .returning({ id: sosWidgets.id });

    return result[0].id;
  }

  static async updateWidget(widgetId: number, position?: any, config?: WidgetConfig, isVisible?: boolean) {
    const updates: any = {};
    if (position) updates.position = position;
    if (config) updates.config = config;
    if (isVisible !== undefined) updates.isVisible = isVisible;

    if (Object.keys(updates).length > 0) {
      await db
        .update(sosWidgets)
        .set(updates)
        .where(eq(sosWidgets.id, widgetId));
    }
  }

  static async deleteWidget(widgetId: number) {
    await db
      .delete(sosWidgets)
      .where(eq(sosWidgets.id, widgetId));
  }

  // Default Dashboard Creation
  static async createDefaultDashboard(userId: string) {
    const prefs = await this.getUserPreferences(userId);
    const defaultConfig: DashboardConfig = {
      layout: 'grid',
      theme: 'auto',
      refreshInterval: 5,
      globalFilters: {
        positions: prefs?.defaultPositions || ['RB', 'WR'],
        teams: prefs?.favoriteTeams || [],
        seasons: [2024],
      }
    };

    const dashboardId = await this.createDashboard(userId, 'My SOS Dashboard', defaultConfig, true);

    // Add default widgets
    await this.addWidget(dashboardId, 'weekly', { x: 0, y: 0, w: 6, h: 4 }, {
      title: 'Weekly Matchups',
      positions: prefs?.defaultPositions || ['RB'],
      showTiers: true,
      chartType: 'table',
    });

    await this.addWidget(dashboardId, 'ros', { x: 6, y: 0, w: 6, h: 4 }, {
      title: 'Rest of Season',
      positions: prefs?.defaultPositions || ['RB'],
      weekRange: prefs?.defaultWeekRange || { start: 1, end: 5 },
      chartType: 'bar',
    });

    await this.addWidget(dashboardId, 'filter', { x: 0, y: 4, w: 12, h: 2 }, {
      title: 'Quick Filters',
    });

    return dashboardId;
  }

  // Utility function to get user ID from session/auth
  static async getOrCreateUserId(req: any): Promise<string> {
    // For now, use session ID or create a guest user ID
    // In production, this would integrate with your auth system
    if (!req.session) {
      req.session = {};
    }
    
    if (!req.session.sosUserId) {
      req.session.sosUserId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    return req.session.sosUserId;
  }
}