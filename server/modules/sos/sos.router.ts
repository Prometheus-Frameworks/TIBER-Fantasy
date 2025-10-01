import { Router } from 'express';
import { getWeekly, getROS, getWeeklyV3, getDefenseRankings, getOffenseRankings, getWeek5SOS, getTeamGameHistory } from './sos.controller';
import { SOSDashboardController } from './dashboard.controller';

const router = Router();

// Basic SOS endpoints
router.get('/weekly', getWeekly); // /api/sos/weekly?position=RB&week=1
router.get('/ros', getROS);       // /api/sos/ros?position=RB&startWeek=1&window=5

// Enhanced team analytics endpoint
router.get('/weekly/v3', getWeeklyV3); // /api/sos/weekly/v3?position=WR&week=4&analytics=true

// Team rankings based on Week 4 data
router.get('/rankings/defense', getDefenseRankings); // /api/sos/rankings/defense
router.get('/rankings/offense', getOffenseRankings); // /api/sos/rankings/offense

// Week 5 SOS (uses Week 4 rankings)
router.get('/week5', getWeek5SOS); // /api/sos/week5?position=RB

// Team game history
router.get('/team/history', getTeamGameHistory); // /api/sos/team/history?team=BUF&season=2024&maxWeek=4

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