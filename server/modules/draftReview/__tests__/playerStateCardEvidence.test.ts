import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeWatsonModel, validateWatsonModel, privateWatsonEvidence, WATSON_MODEL_SHA256 } from '../playerStateCardEvidence';

const raw = readFileSync(resolve(process.cwd(), 'server/modules/draftReview/artifacts/watsonGbCase01ReadModel.json'));
const source = decodeWatsonModel(raw);
const altered = (edit: (candidate: any) => void) => {
  const candidate = structuredClone(source); edit(candidate); return candidate;
};

test('exact model and reviewed values, scopes, statuses and denominators survive', () => {
  expect(WATSON_MODEL_SHA256).toHaveLength(64);
  expect(privateWatsonEvidence()).toMatchObject({ status: 'private_preview', sourceNativePlayerId: '00-0038124' });
  expect(source.binding).toMatchObject({
    compositionPacketSha256: '1dbf07a8da739c5d8bc05a9c55cd3dab434b0b1b212f99d67d070d5485932fb3',
    compositionMachineSha256: 'a27e4f0daa7b2820be275dd138098755bd95989f078e31111405882293c80049',
    compositionReceiptSha256: '61624a0ef315fc77bde99b98863da0fcce7e3940502b1328c3324d9e9d15deba',
    compositionReviewDisposition: 'CLEAN WITH NON-BLOCKING NOTES',
  });
  expect(source.identity).toMatchObject({ sourceNativePlayerId: '00-0038124', sleeperPlayerId: null, sleeperJoinStatus: 'unresolved' });
  expect(source.scope.join.week1).toMatchObject({ gameId: '2026_01_GB_MIN', team: 'GB', opponent: 'MIN' });
  expect(source.scope.join.week2).toMatchObject({ gameId: '2026_02_GB_NYJ', team: 'GB', opponent: 'NYJ' });
  expect(source.roleOpportunity.recordedWork.targets).toMatchObject({ week1: { value: 8 }, week2: { value: 11 }, delta: 3 });
  expect(source.roleOpportunity.recordedWork.receptions).toMatchObject({ week1: { value: 6 }, week2: { value: 4 }, delta: -2 });
  expect(source.roleOpportunity.recordedWork.carries).toMatchObject({ week1: { status: 'observed', value: 0 }, week2: { status: 'observed', value: 0 }, delta: 0 });
  expect(source.roleOpportunity.targetShareCreditedTeamTargets).toMatchObject({ week1: { numerator: 8, denominator: 40 }, week2: { numerator: 11, denominator: 29 }, percentagePointDelta: 17.93103448275862 });
  expect(source.teamActivity.fields.attempts).toMatchObject({ week1: 42, week2: 29, delta: -13 });
  expect(source.teamActivity.fields.carries).toMatchObject({ week1: 21, week2: 18, delta: -3 });
  expect(Object.fromEntries(Object.entries(source.teamActivity.fields).map(([key, v]) => [key, [v.week1, v.week2, v.delta]]))).toEqual({
    attempts: [42, 29, -13], completions: [21, 16, -5], passing_yards: [387, 145, -242],
    passing_tds: [2, 2, 0], passing_interceptions: [1, 0, -1], sacks_suffered: [4, 3, -1],
    carries: [21, 18, -3], rushing_yards: [66, 63, -3], rushing_tds: [0, 0, 0], fumbles_lost_total: [1, 1, 0],
  });
  expect(source.roleOpportunity.claimStates.map(x => [x.id, x.week1.status, x.week2.status])).toEqual([
    ['observed_receiving_involvement', 'supported', 'supported'],
    ['recorded_receiving_opportunity', 'supported', 'supported'],
    ['recorded_rushing_work', 'not_supported', 'not_supported'],
  ]);
  expect(source.evidenceHealth).toMatchObject({ status: 'provisional', sameSourceReconciliationIsIndependentCorroboration: false, coverageIsParticipationCensus: false });
  expect(source.evidenceHealth.rop).toMatchObject({ finality: { week1: 'unknown', week2: 'unknown' }, correction: { week1: 'open', week2: 'open' }, evidenceCutoff: { week1: null, week2: null } });
});

test('any altered or additional byte fails the fixed read-model hash', () => {
  expect(() => decodeWatsonModel(Buffer.from(raw.toString('utf8').replace('Christian Watson', 'Other Watson')))).toThrow('integrity');
  expect(() => decodeWatsonModel(Buffer.concat([raw, Buffer.from(' ')]))).toThrow('integrity');
});

test.each([
  ['player', (m: any) => { m.identity.sourceNativePlayerId = '00-0000000'; }],
  ['Sleeper association', (m: any) => { m.identity.sleeperPlayerId = '123'; }],
  ['week', (m: any) => { m.scope.weeks = [1, 3]; }],
  ['team', (m: any) => { m.scope.join.week2.team = 'MIN'; }],
  ['game', (m: any) => { m.scope.join.week1.gameId = 'wrong'; }],
  ['opponent', (m: any) => { m.scope.teamWeek2.opponent_team = 'BUF'; }],
  ['receipt', (m: any) => { m.binding.compositionReceiptSha256 = '0'.repeat(64); }],
  ['review', (m: any) => { m.binding.compositionReviewDisposition = 'pending'; }],
  ['finality', (m: any) => { m.evidenceHealth.rop.finality.week1 = 'final'; }],
  ['correction', (m: any) => { m.evidenceHealth.rop.correction.week2 = 'closed'; }],
  ['missing witness', (m: any) => { m.evidenceHealth.missingPlayerEvidence = []; }],
])('semantic guard rejects altered %s even if the byte pin were replaced', (_name, edit) => {
  expect(() => validateWatsonModel(altered(edit))).toThrow();
});

test('no context, hypotheses, future observations, fantasy output or roster edge enters the fixed model', () => {
  const model = raw.toString('utf8');
  expect(model).not.toMatch(/hypothesisLedger|contemporaneousSources|subsequent_evidence|fantasyPoints|sleeperRosterId|retrospectiveInterpretation/);
  expect(source.identity.sleeperPlayerId).toBeNull();
  expect(source.attribution).toMatchObject({ name: 'nflverse contributors', license: 'CC BY 4.0', licenseDoesNotGrantTiberConsumerAdmission: true });
});
