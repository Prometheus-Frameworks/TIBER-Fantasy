import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MODEL_PATH = resolve(process.cwd(), 'server/modules/draftReview/artifacts/watsonGbCase01ReadModel.json');
export const WATSON_MODEL_SHA256 = '06f7c33f9ca4ea7e3ce5b8a2b88891d3bb63e8a899294f66f8fff955fc658c2e';
const COMPOSITION_SHA256 = '1dbf07a8da739c5d8bc05a9c55cd3dab434b0b1b212f99d67d070d5485932fb3';
const MACHINE_SHA256 = 'a27e4f0daa7b2820be275dd138098755bd95989f078e31111405882293c80049';
const RECEIPT_SHA256 = '61624a0ef315fc77bde99b98863da0fcce7e3940502b1328c3324d9e9d15deba';
const REVIEW_SHA256 = 'a247b57f635f760f2d292ce6ceb5c072d47840067b1d0fbd3170a89bbfcbcf3a';

// This is a fixed presentation projection, never a source loader or generic player lookup.
export interface WatsonReadModel {
  schemaVersion: string;
  eligibility: string;
  binding: Record<string, string>;
  identity: {
    sourceNamespace: string; sourceNativePlayerId: string; name: string; position: string;
    observedEventTeam: string; sleeperPlayerId: null; sleeperJoinStatus: string;
  };
  scope: {
    season: number; seasonType: string; weeks: number[]; comparability: string;
    join: Record<string, { gameId: string; team: string; opponent: string; sourceNativePlayerId: string }>;
    teamWeek1: { game_id: string; opponent_team: string; week: number };
    teamWeek2: { game_id: string; opponent_team: string; week: number };
  };
  roleOpportunity: {
    recordedWork: Record<string, { week1: { value: number | null; status: string }; week2: { value: number | null; status: string }; delta: number | null }>;
    targetShareCreditedTeamTargets: {
      week1: { numerator: number; denominator: number; value: number; definition: string };
      week2: { numerator: number; denominator: number; value: number; definition: string };
      percentagePointDelta: number;
    };
    carryShareAllTeamCarries: Record<string, unknown>;
    claimStates: Array<{ id: string; week1: { status: string }; week2: { status: string } }>;
    limitations: string[];
  };
  teamActivity: { fields: Record<string, { week1: number; week2: number; delta: number; comparability: string }>; comparability: string };
  jointObservations: Array<{ metricPair: string; text: string; playerDelta?: number; teamDelta?: number; numeratorDelta?: number; denominatorDelta?: number }>;
  evidenceHealth: {
    status: string; rop: { finality: Record<string, string>; correction: Record<string, string>; evidenceCutoff: Record<string, null>; mandatoryCompanionSupportDependency: boolean; receivingAirYardConflicts: Record<string, number | boolean> };
    teamstate: string[]; composition: string[]; missingPlayerEvidence: string[]; missingTeamEvidence: string[];
    sameSourceReconciliationIsIndependentCorroboration: false; coverageIsParticipationCensus: false;
  };
  attribution: { name: string; license: string; licenseUrl: string; sourceUrl: string; derivedNotice: string; licenseDoesNotGrantTiberConsumerAdmission: true };
}

/** Semantic checks supplement the immutable byte pin and fail closed on scope and identity. */
export function validateWatsonModel(candidate: unknown): asserts candidate is WatsonReadModel {
  if (!candidate || typeof candidate !== 'object') throw new Error('Private card model unavailable');
  const model = candidate as WatsonReadModel;
  if (model.schemaVersion !== 'watson_gb_source_native_private_card_read_model_v0'
      || model.eligibility !== 'private_operator_preview_only_no_public_team_activation'
      || model.binding?.compositionPacketSha256 !== COMPOSITION_SHA256
      || model.binding?.compositionMachineSha256 !== MACHINE_SHA256
      || model.binding?.compositionReceiptSha256 !== RECEIPT_SHA256
      || model.binding?.compositionReviewSha256 !== REVIEW_SHA256
      || model.binding?.compositionReviewDisposition !== 'CLEAN WITH NON-BLOCKING NOTES'
      || model.binding?.compositionRule !== 'rop_teamstate_w1_w2_observational_composition_v1'
      || model.identity?.sourceNamespace !== 'GSIS'
      || model.identity?.sourceNativePlayerId !== '00-0038124'
      || model.identity?.name !== 'Christian Watson' || model.identity?.position !== 'WR'
      || model.identity?.observedEventTeam !== 'GB'
      || model.identity?.sleeperPlayerId !== null || model.identity?.sleeperJoinStatus !== 'unresolved'
      || model.scope?.season !== 2026 || model.scope?.seasonType !== 'REG'
      || JSON.stringify(model.scope?.weeks) !== '[1,2]'
      || model.scope?.comparability !== 'comparable_same_team_windows'
      || model.scope?.join?.week1?.gameId !== '2026_01_GB_MIN'
      || model.scope?.join?.week1?.team !== 'GB' || model.scope?.join?.week1?.opponent !== 'MIN'
      || model.scope?.join?.week1?.sourceNativePlayerId !== '00-0038124'
      || model.scope?.join?.week2?.gameId !== '2026_02_GB_NYJ'
      || model.scope?.join?.week2?.team !== 'GB' || model.scope?.join?.week2?.opponent !== 'NYJ'
      || model.scope?.join?.week2?.sourceNativePlayerId !== '00-0038124'
      || model.scope?.teamWeek1?.game_id !== '2026_01_GB_MIN'
      || model.scope?.teamWeek1?.opponent_team !== 'MIN' || model.scope?.teamWeek1?.week !== 1
      || model.scope?.teamWeek2?.game_id !== '2026_02_GB_NYJ'
      || model.scope?.teamWeek2?.opponent_team !== 'NYJ' || model.scope?.teamWeek2?.week !== 2
      || model.teamActivity?.comparability !== 'comparable'
      || !Array.isArray(model.roleOpportunity?.claimStates)
      || Object.keys(model.teamActivity?.fields ?? {}).length !== 10
      || !Array.isArray(model.jointObservations) || model.jointObservations.length !== 2
      || model.evidenceHealth?.status !== 'provisional'
      || model.evidenceHealth?.rop?.finality?.week1 !== 'unknown'
      || model.evidenceHealth?.rop?.finality?.week2 !== 'unknown'
      || model.evidenceHealth?.rop?.correction?.week1 !== 'open'
      || model.evidenceHealth?.rop?.correction?.week2 !== 'open'
      || model.evidenceHealth?.rop?.evidenceCutoff?.week1 !== null
      || model.evidenceHealth?.rop?.evidenceCutoff?.week2 !== null
      || model.evidenceHealth?.rop?.mandatoryCompanionSupportDependency !== true
      || model.evidenceHealth?.rop?.receivingAirYardConflicts?.week1 !== 22
      || model.evidenceHealth?.rop?.receivingAirYardConflicts?.week2 !== 22
      || model.evidenceHealth?.sameSourceReconciliationIsIndependentCorroboration !== false
      || model.evidenceHealth?.coverageIsParticipationCensus !== false
      || !Array.isArray(model.evidenceHealth?.teamstate) || !Array.isArray(model.evidenceHealth?.composition)
      || model.attribution?.name !== 'nflverse contributors'
      || model.attribution?.license !== 'CC BY 4.0'
      || model.attribution?.licenseUrl !== 'https://creativecommons.org/licenses/by/4.0/'
      || model.attribution?.licenseDoesNotGrantTiberConsumerAdmission !== true) {
    throw new Error('Private card binding or evidence-health mismatch');
  }
  for (const field of ['targets', 'receptions', 'carries']) {
    if (!model.roleOpportunity.recordedWork[field]) throw new Error('Missing reviewed player field');
  }
  for (const field of ['routes', 'snaps', 'alignment', 'first reads']) {
    if (!model.evidenceHealth.missingPlayerEvidence.includes(field)) throw new Error('Missing evidence disclosure');
  }
}

export function decodeWatsonModel(raw: Buffer): WatsonReadModel {
  if (raw.length > 40_000 || createHash('sha256').update(raw).digest('hex') !== WATSON_MODEL_SHA256) {
    throw new Error('Private card model integrity failure');
  }
  const parsed: unknown = JSON.parse(raw.toString('utf8'));
  validateWatsonModel(parsed);
  return parsed;
}

export function privateWatsonEvidence(): { status: 'private_preview'; sourceNativePlayerId: '00-0038124'; model: WatsonReadModel } | { status: 'unavailable'; reason: string } {
  try {
    return { status: 'private_preview', sourceNativePlayerId: '00-0038124', model: decodeWatsonModel(readFileSync(MODEL_PATH)) };
  } catch {
    return { status: 'unavailable', reason: 'Exact reviewed private Watson evidence failed integrity or scope checks.' };
  }
}
