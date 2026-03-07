export {};

/**
 * Lightweight CATALYST API smoke checks.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:5000 \
 *   CATALYST_TEST_PLAYER_ID=<gsis_id> \
 *   TIBER_API_KEY=<key> \
 *   tsx server/scripts/catalystApiSmoke.ts
 */

type Json = Record<string, unknown>;

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:5000';
const testPlayerId = process.env.CATALYST_TEST_PLAYER_ID;
const apiKey = process.env.TIBER_API_KEY;

async function request(path: string, headers?: Record<string, string>) {
  const res = await fetch(`${baseUrl}${path}`, { headers });
  const body = (await res.json().catch(() => null)) as Json | null;
  return { status: res.status, body };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function run() {
  console.log(`Running CATALYST smoke checks against ${baseUrl}`);

  const batch = await request('/api/catalyst/batch?position=QB&season=2025&limit=50');
  assert(batch.status === 200, 'Batch endpoint should return 200');
  assert(Array.isArray(batch.body?.players), 'Batch endpoint should return players array');

  const badPosition = await request('/api/catalyst/batch?position=K&season=2025&limit=50');
  assert(badPosition.status === 400, 'Invalid position should return 400');
  assert(Boolean((badPosition.body?.error as Json | undefined)?.code), 'Invalid position should return machine-friendly error code');

  const yoy = await request('/api/catalyst/yoy?position=QB&limit=25');
  assert(yoy.status === 200, 'YoY endpoint should return 200');
  assert(Array.isArray(yoy.body?.players), 'YoY endpoint should return players array');

  if (testPlayerId) {
    const player = await request(`/api/catalyst/player/${testPlayerId}?season=2025`);
    assert(player.status === 200, 'Valid player request should return 200');
    assert(Array.isArray(player.body?.weekly), 'Valid player request should return weekly data');
  } else {
    console.warn('Skipping valid player check. Set CATALYST_TEST_PLAYER_ID to enable it.');
  }

  const missingPlayer = await request('/api/catalyst/player/__missing_player__?season=2025');
  assert(missingPlayer.status === 404, 'Missing player should return 404');

  if (apiKey) {
    const headers = { 'x-tiber-key': apiKey };

    const v1Batch = await request('/api/v1/catalyst/batch?position=QB&season=2025&limit=10', headers);
    assert(v1Batch.status === 200, 'v1 batch proxy should return 200');
    assert((v1Batch.body?.ok as boolean | undefined) === true, 'v1 batch should be wrapped in success envelope');

    if (testPlayerId) {
      const v1Player = await request(`/api/v1/catalyst/player/${testPlayerId}?season=2025`, headers);
      assert(v1Player.status === 200, 'v1 player proxy should return 200');
      assert((v1Player.body?.ok as boolean | undefined) === true, 'v1 player should be wrapped in success envelope');
    } else {
      console.warn('Skipping v1 player check. Set CATALYST_TEST_PLAYER_ID to enable it.');
    }

    const v1Yoy = await request('/api/v1/catalyst/yoy?position=QB&limit=10', headers);
    assert(v1Yoy.status === 200, 'v1 yoy proxy should return 200');
    assert((v1Yoy.body?.ok as boolean | undefined) === true, 'v1 yoy should be wrapped in success envelope');
  } else {
    console.warn('Skipping v1 checks. Set TIBER_API_KEY to enable authenticated v1 smoke tests.');
  }

  console.log('CATALYST smoke checks passed.');
}

run().catch((error) => {
  console.error('CATALYST smoke checks failed:', error);
  process.exit(1);
});
