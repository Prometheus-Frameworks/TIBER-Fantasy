/**
 * FORGE Simulation API Routes
 * 
 * Admin endpoints for running and analyzing FORGE recursive engine simulations.
 */

import { Router, Request, Response } from 'express';
import {
  startSimulation,
  cancelSimulation,
  getSimulationProgress,
  getSimulationResults,
  getPlayerDiffView,
  getOutliers,
  markOutlierReviewed,
  getAllPresets,
  getPreset,
  createPreset,
  updatePreset,
  deletePreset,
  getAllRuns,
  deleteRun,
  DEFAULT_PARAMETERS,
  type SimulationParameters,
  type SimulationRunConfig,
} from '../modules/forge/simulation/forgeSimService';

const router = Router();

router.get('/defaults', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: DEFAULT_PARAMETERS,
  });
});

router.post('/run', async (req: Request, res: Response) => {
  try {
    const {
      season = 2025,
      weekStart = 1,
      weekEnd = 17,
      parameters = DEFAULT_PARAMETERS,
      presetId,
      presetName,
      clearPrevious = false,
    } = req.body;

    if (weekStart < 1 || weekStart > 17) {
      return res.status(400).json({ success: false, error: 'weekStart must be 1-17' });
    }
    if (weekEnd < weekStart || weekEnd > 17) {
      return res.status(400).json({ success: false, error: 'weekEnd must be >= weekStart and <= 17' });
    }

    const config: SimulationRunConfig = {
      season,
      weekStart,
      weekEnd,
      parameters: { ...DEFAULT_PARAMETERS, ...parameters },
      presetId,
      presetName,
      clearPrevious,
    };

    const runId = await startSimulation(config);

    res.json({
      success: true,
      data: { runId },
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error starting simulation:', err);
    res.status(500).json({ success: false, error: 'Failed to start simulation' });
  }
});

router.post('/cancel/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const cancelled = await cancelSimulation(runId);

    res.json({
      success: true,
      data: { cancelled },
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error cancelling simulation:', err);
    res.status(500).json({ success: false, error: 'Failed to cancel simulation' });
  }
});

router.get('/progress/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const progress = await getSimulationProgress(runId);

    if (!progress) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }

    res.json({
      success: true,
      data: progress,
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error fetching progress:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch progress' });
  }
});

router.get('/results/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const {
      position,
      weekStart,
      weekEnd,
      minAdjustment,
      playerSearch,
      outlierOnly,
      limit = '500',
      offset = '0',
    } = req.query;

    const filters = {
      position: position as string | undefined,
      weekStart: weekStart ? parseInt(weekStart as string) : undefined,
      weekEnd: weekEnd ? parseInt(weekEnd as string) : undefined,
      minAdjustment: minAdjustment ? parseFloat(minAdjustment as string) : undefined,
      playerSearch: playerSearch as string | undefined,
      outlierOnly: outlierOnly === 'true',
    };

    const { results, total } = await getSimulationResults(
      runId,
      filters,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: { results, total, limit: parseInt(limit as string), offset: parseInt(offset as string) },
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error fetching results:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch results' });
  }
});

router.get('/diff/:runId/:playerId', async (req: Request, res: Response) => {
  try {
    const { runId, playerId } = req.params;
    const results = await getPlayerDiffView(runId, playerId);

    res.json({
      success: true,
      data: results,
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error fetching diff view:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch diff view' });
  }
});

router.get('/outliers/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const outliers = await getOutliers(runId);

    res.json({
      success: true,
      data: outliers,
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error fetching outliers:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch outliers' });
  }
});

router.post('/outliers/:runId/review', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const { playerId, week, reviewedBy, notes } = req.body;

    if (!playerId || !week || !reviewedBy) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    await markOutlierReviewed(runId, playerId, week, reviewedBy, notes);

    res.json({
      success: true,
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error marking outlier reviewed:', err);
    res.status(500).json({ success: false, error: 'Failed to mark outlier reviewed' });
  }
});

router.get('/runs', async (_req: Request, res: Response) => {
  try {
    const runs = await getAllRuns();

    res.json({
      success: true,
      data: runs,
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error fetching runs:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch runs' });
  }
});

router.delete('/runs/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    await deleteRun(runId);

    res.json({
      success: true,
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error deleting run:', err);
    res.status(500).json({ success: false, error: 'Failed to delete run' });
  }
});

router.get('/presets', async (_req: Request, res: Response) => {
  try {
    const presets = await getAllPresets();

    res.json({
      success: true,
      data: presets,
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error fetching presets:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch presets' });
  }
});

router.get('/presets/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const preset = await getPreset(id);

    if (!preset) {
      return res.status(404).json({ success: false, error: 'Preset not found' });
    }

    res.json({
      success: true,
      data: preset,
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error fetching preset:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch preset' });
  }
});

router.post('/presets', async (req: Request, res: Response) => {
  try {
    const { name, description, parameters } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const mergedParams: SimulationParameters = { ...DEFAULT_PARAMETERS, ...parameters };
    const id = await createPreset(name, description ?? null, mergedParams);

    res.json({
      success: true,
      data: { id },
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error creating preset:', err);
    res.status(500).json({ success: false, error: 'Failed to create preset' });
  }
});

router.put('/presets/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, parameters } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const mergedParams: SimulationParameters = { ...DEFAULT_PARAMETERS, ...parameters };
    await updatePreset(id, name, description ?? null, mergedParams);

    res.json({
      success: true,
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error updating preset:', err);
    res.status(500).json({ success: false, error: 'Failed to update preset' });
  }
});

router.delete('/presets/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await deletePreset(id);

    res.json({
      success: true,
    });
  } catch (err) {
    console.error('[ForgeSim/API] Error deleting preset:', err);
    res.status(500).json({ success: false, error: 'Failed to delete preset' });
  }
});

export default router;
