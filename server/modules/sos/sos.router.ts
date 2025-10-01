import { Router } from 'express';
import { getWeekly, getROS, getWeeklyV3 } from './sos.controller';
import { SOSDashboardController } from './dashboard.controller';

const router = Router();

// Basic SOS endpoints
router.get('/weekly', getWeekly); // /api/sos/weekly?position=RB&week=1
router.get('/ros', getROS);       // /api/sos/ros?position=RB&startWeek=1&window=5

// Enhanced team analytics endpoint
router.get('/weekly/v3', getWeeklyV3); // /api/sos/weekly/v3?position=WR&week=4&analytics=true

// Dashboard API endpoints
router.get('/dashboard/preferences', SOSDashboardController.getPreferences);
router.put('/dashboard/preferences', SOSDashboardController.updatePreferences);
router.get('/dashboard/dashboards', SOSDashboardController.getDashboards);
router.post('/dashboard/dashboards', SOSDashboardController.createDashboard);
router.put('/dashboard/dashboards/:id', SOSDashboardController.updateDashboard);
router.delete('/dashboard/dashboards/:id', SOSDashboardController.deleteDashboard);
router.post('/dashboard/widgets', SOSDashboardController.addWidget);
router.put('/dashboard/widgets/:id', SOSDashboardController.updateWidget);
router.delete('/dashboard/widgets/:id', SOSDashboardController.deleteWidget);

export default router;