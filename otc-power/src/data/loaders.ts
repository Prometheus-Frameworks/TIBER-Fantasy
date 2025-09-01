import { PlayerFacts } from '../core/types.js';
import { fetch } from 'undici';

const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE || 'http://localhost:5000/api';
const OASIS_BASE = process.env.OASIS_BASE || 'http://oasis-service:8000';

/** Pull usage/efficiency: xFP 3w EWMA, targets/route, RZ share */
export async function loadUsageBundle(player_id: string, season: number, week: number): Promise<number> {
  try {
    // Wire to DeepSeek xFP service for 3-week EWMA + role shares
    const response = await fetch(`${DEEPSEEK_BASE}/player/${player_id}/usage?season=${season}&week=${week}`);
    if (!response.ok) throw new Error(`Usage API failed: ${response.status}`);
    
    const data = await response.json() as any;
    // Return 0-100 scaled usage score from xFP recent + shares
    return Math.max(0, Math.min(100, data.usage_score || 0));
  } catch (err) {
    // Fallback to last known value with confidence haircut
    return 0; // stub - implement fallback logic
  }
}

/** Pull talent priors: Fusion North / OTC rating (stabilized) */
export async function loadTalent(player_id: string): Promise<number> {
  try {
    // Wire to DeepSeek/Fusion North quadrant (multi-season stabilized)
    const response = await fetch(`${DEEPSEEK_BASE}/rankings/deepseek/v3.2/debug/${encodeURIComponent(player_id)}`);
    if (!response.ok) throw new Error(`Talent API failed: ${response.status}`);
    
    const data = await response.json() as any;
    // Extract north quadrant as talent score (0-100)
    return Math.max(0, Math.min(100, data.quadrant_scores?.north || 0));
  } catch (err) {
    return 0; // stub - implement fallback logic
  }
}

/** OASIS team env + QB stability */
export async function loadEnvironment(team: string): Promise<number> {
  try {
    const response = await fetch(`${OASIS_BASE}/teams/${team}/env`);
    if (!response.ok) throw new Error(`Environment API failed: ${response.status}`);
    
    const data = await response.json() as any;
    return Math.max(0, Math.min(100, data.environment_score || 0));
  } catch (err) {
    return 0; // stub - implement fallback logic
  }
}

/** Availability from practice reports + expected snaps */
export async function loadAvailability(player_id: string): Promise<number> {
  try {
    // TODO: Wire to practice reports and injury status
    // For now, assume healthy if no data
    return 85; // stub - implement real availability logic
  } catch (err) {
    return 0; // stub
  }
}

/** Tiny anchor vs market */
export async function loadMarketAnchor(player_id: string): Promise<number> {
  try {
    // TODO: Wire to ECR/ADP drift analysis (tiny 5% weight)
    return 50; // stub - neutral market position
  } catch (err) {
    return 0; // stub
  }
}