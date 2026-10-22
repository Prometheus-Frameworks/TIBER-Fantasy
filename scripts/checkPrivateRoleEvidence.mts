/** Owner-only local conformance against already-prepared retained bytes. Prints hashes/counts only. */
import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRoleTools, ROLE_TOOL } from '../server/modules/roleEvidence/roleHistory';

try {
  const [, , grant, path, sha] = process.argv;
  if (grant !== '--owner-private' || !path?.startsWith('/') || process.argv.length !== 5 ||
      ['CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'BUILDKITE', 'CIRCLECI', 'TF_BUILD', 'JENKINS_URL', 'TEAMCITY_VERSION'].some(k => process.env[k])) throw Error();
  const repo = await realpath('.'), inputPath = await realpath(path);
  if (inputPath.startsWith(repo + '/')) throw Error();
  const bytes = await readFile(inputPath);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sha);
  const prepared = JSON.parse(bytes.toString('utf8'));
  const reader = createRoleTools(prepared, true, () => 'local-comparison-clock');
  assert.equal(reader.capability.status, 'available');
  const expected = new Map(prepared.rows.map((r: any) => [`${r.player_id}:${r.week}`, r]));
  let checked = 0, observed = 0, missing = 0, zeroFields = 0, maxEnvelopeBytes = 0;
  const resultHashes = createHash('sha256');
  for (const subject of prepared.catalogue) {
    const result: any = reader.call(ROLE_TOOL, { subject: { namespace: 'nflverse:gsis', id: subject.player_id },
      season: 2026, seasonType: 'REG', weeks: [1, 2, 3, 4, 5] });
    assert.equal(result.status, 'available');
    assert.deepEqual(result.metadata, prepared.metadata);
    assert.deepEqual(result.release, prepared.release);
    assert.deepEqual(result.subject, subject);
    for (const week of result.weeks) {
      const row: any = expected.get(`${subject.player_id}:${week.week}`);
      assert.deepEqual(week.record, row);
      assert.equal(week.status, row.coverage_status);
      assert.deepEqual(week.state, row.state_path ? prepared.states[row.state_path] : null);
      checked++;
      if (week.status === 'observed') observed++; else missing++;
      zeroFields += week.observedZeroFields.length;
    }
    resultHashes.update(JSON.stringify(result));
    const envelope = { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result, isError: false };
    maxEnvelopeBytes = Math.max(maxEnvelopeBytes, Buffer.byteLength(JSON.stringify(envelope)));
  }
  const query = (id: string, weeks: number[]) => reader.call(ROLE_TOOL, { subject: { namespace: 'nflverse:gsis', id }, season: 2026, seasonType: 'REG', weeks }) as any;
  const noel = query('00-0040138', [1]);
  assert.equal(noel.weeks[0].status, 'observed');
  assert.equal(noel.weeks[0].record.fields.carries.value, 0);
  assert.ok(noel.weeks[0].observedZeroFields.includes('carries'));
  assert.equal(query('00-0028986', [1]).weeks[0].status, 'missing_source_evidence');
  assert.equal(query('00-0040718', [1]).weeks[0].status, 'outside_catalogue');
  assert.equal(query('00-0040138', [6]).weeks[0].status, 'outside_release_scope');
  assert.equal(checked, 1045); assert.equal(observed, 939); assert.equal(missing, 106);
  assert.ok(maxEnvelopeBytes < 1000000);
  assert.equal(createHash('sha256').update(await readFile(inputPath)).digest('hex'), sha);
  console.log(JSON.stringify({ status: 'passed', checked, observed, missing, zeroFields, maxEnvelopeBytes,
    resultAggregateSha256: resultHashes.digest('hex'), privateInputUnchanged: true,
    witnesses: ['Noel_W1_observed', 'Noel_W1_carries_observed_zero', 'Keenum_W1_missing', 'Hunter_outside_catalogue', 'W6_outside_release_scope'] }));
} catch {
  // Assertions can contain private actual/expected values. Never serialize them.
  console.error('{"status":"failed","reason":"private_comparison_failed"}');
  process.exitCode = 1;
}
