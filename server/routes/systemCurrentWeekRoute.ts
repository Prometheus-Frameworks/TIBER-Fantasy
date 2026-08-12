import type { Request, Response } from 'express';
import { checkSeasonConfigAgreement, getCurrentWeek } from '../../shared/weekDetection';
import {
  INGESTION_DEFAULT_SEASON,
  resolveEvidenceIngestionDefaultTarget,
} from '../config/season';

/**
 * Build the system week payload from one clock sample so presentation phase,
 * season agreement, and evidence-ingestion availability cannot straddle a
 * boundary. Legacy `WeekInfo` fields retain their deployed numeric shape;
 * additive evidence/agreement envelopes carry the truthful nullable values.
 */
export function buildSystemCurrentWeekResponse(now: Date = new Date()) {
  const weekInfo = getCurrentWeek(now);
  const seasonAgreement = checkSeasonConfigAgreement(INGESTION_DEFAULT_SEASON, now);
  const evidenceIngestionTarget = resolveEvidenceIngestionDefaultTarget(
    now,
    INGESTION_DEFAULT_SEASON,
  );

  if (!seasonAgreement.agrees) {
    console.warn(`[Week API] season config disagreement: ${seasonAgreement.reason}`);
  }
  if (!evidenceIngestionTarget.available) {
    console.warn(`[Week API] evidence ingestion target unavailable: ${evidenceIngestionTarget.reason}`);
  }

  return {
    success: true,
    ...weekInfo,
    // `upcomingWeek` is decision context, not evidence availability.
    upcomingWeek: weekInfo.targetWeek,
    seasonConfigAgreement: seasonAgreement,
    evidenceIngestionTarget,
  };
}

export function systemCurrentWeekHandler(_req: Request, res: Response): void {
  res.json(buildSystemCurrentWeekResponse());
}
