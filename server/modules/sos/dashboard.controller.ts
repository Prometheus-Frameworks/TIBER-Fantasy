import { Request, Response } from 'express';
import { SOSDashboardService } from './dashboard.service';

export class SOSDashboardController {
  
  // User Preferences
  static async getPreferences(req: Request, res: Response) {
    try {
      const userId = await SOSDashboardService.getOrCreateUserId(req);
      const preferences = await SOSDashboardService.getUserPreferences(userId);
      
      res.json({ preferences: preferences || {
        defaultPositions: ['RB', 'WR'],
        defaultWeekRange: { start: 1, end: 5 },
        favoriteTeams: [],
        tierThresholds: { green: 67, yellow: 33 },
        viewPreferences: { showCharts: true, showTable: true }
      }});
    } catch (error) {
      console.error('❌ Get preferences error:', error);
      res.status(500).json({ error: 'Failed to load preferences' });
    }
  }

  static async updatePreferences(req: Request, res: Response) {
    try {
      const userId = await SOSDashboardService.getOrCreateUserId(req);
      await SOSDashboardService.updateUserPreferences(userId, req.body);
      res.json({ success: true });
    } catch (error) {
      console.error('❌ Update preferences error:', error);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  }

  // Dashboards
  static async getDashboards(req: Request, res: Response) {
    try {
      const userId = await SOSDashboardService.getOrCreateUserId(req);
      let dashboards = await SOSDashboardService.getUserDashboards(userId);
      
      // Create default dashboard if none exist
      if (dashboards.length === 0) {
        await SOSDashboardService.createDefaultDashboard(userId);
        dashboards = await SOSDashboardService.getUserDashboards(userId);
      }
      
      res.json({ dashboards });
    } catch (error) {
      console.error('❌ Get dashboards error:', error);
      res.status(500).json({ error: 'Failed to load dashboards' });
    }
  }

  static async createDashboard(req: Request, res: Response) {
    try {
      const userId = await SOSDashboardService.getOrCreateUserId(req);
      const { name, config, isDefault } = req.body;
      
      const dashboardId = await SOSDashboardService.createDashboard(userId, name, config, isDefault);
      res.json({ dashboardId, success: true });
    } catch (error) {
      console.error('❌ Create dashboard error:', error);
      res.status(500).json({ error: 'Failed to create dashboard' });
    }
  }

  static async updateDashboard(req: Request, res: Response) {
    try {
      const userId = await SOSDashboardService.getOrCreateUserId(req);
      const { id } = req.params;
      const { config } = req.body;
      
      await SOSDashboardService.updateDashboard(parseInt(id), userId, config);
      res.json({ success: true });
    } catch (error) {
      console.error('❌ Update dashboard error:', error);
      res.status(500).json({ error: 'Failed to update dashboard' });
    }
  }

  static async deleteDashboard(req: Request, res: Response) {
    try {
      const userId = await SOSDashboardService.getOrCreateUserId(req);
      const { id } = req.params;
      
      await SOSDashboardService.deleteDashboard(parseInt(id), userId);
      res.json({ success: true });
    } catch (error) {
      console.error('❌ Delete dashboard error:', error);
      res.status(500).json({ error: 'Failed to delete dashboard' });
    }
  }

  // Widgets
  static async addWidget(req: Request, res: Response) {
    try {
      const { dashboardId, widgetType, position, config } = req.body;
      
      const widgetId = await SOSDashboardService.addWidget(dashboardId, widgetType, position, config);
      res.json({ widgetId, success: true });
    } catch (error) {
      console.error('❌ Add widget error:', error);
      res.status(500).json({ error: 'Failed to add widget' });
    }
  }

  static async updateWidget(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { position, config, isVisible } = req.body;
      
      await SOSDashboardService.updateWidget(parseInt(id), position, config, isVisible);
      res.json({ success: true });
    } catch (error) {
      console.error('❌ Update widget error:', error);
      res.status(500).json({ error: 'Failed to update widget' });
    }
  }

  static async deleteWidget(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      await SOSDashboardService.deleteWidget(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error('❌ Delete widget error:', error);
      res.status(500).json({ error: 'Failed to delete widget' });
    }
  }
}