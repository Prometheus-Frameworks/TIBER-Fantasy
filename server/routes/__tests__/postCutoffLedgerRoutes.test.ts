import express from 'express';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { AddressInfo } from 'net';
import { createPostCutoffLedgerRouter } from '../postCutoffLedgerRoutes';
import { PostCutoffLedgerStore } from '../../modules/postCutoffLedger/postCutoffLedgerStore';

const ADMIN_KEY = 'test-admin-key';

function validDraft(overrides: Record<string, unknown> = {}) {
  return {
    baseline_run_id: 'seasonal-ppr-2026-forward-001',
    canonical_player_id: null,
    display_name: 'Josh Downs',
    observed_at: '2026-08-01',
    event_type: 'role_expansion',
    observations: [
      'outside reps increasing',
      'multi-TE personnel expected to rise',
      'bunch/stack usage designed to preserve free releases',
    ],
    inferences: ['more routes in two-WR personnel', 'modestly higher target depth'],
    forecast_pressure: 'upward',
    confidence: 'moderate',
    status: 'candidate_operator_observation',
    source_refs: [],
    limitations: [],
    open_questions: [],
    unrecognized_fields: [{ key: 'status', value: 'pending repeated camp and preseason deployment' }],
    ...overrides,
  };
}

describe('post-cutoff ledger routes', () => {
  let tmpDir: string;
  let store: PostCutoffLedgerStore;
  let app: express.Express;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;
  const originalAdminKey = process.env.ADMIN_API_KEY;

  beforeEach(async () => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pcl-test-'));
    store = new PostCutoffLedgerStore(tmpDir);
    app = express();
    app.use(express.json());
    app.use('/api/post-cutoff-ledger', createPostCutoffLedgerRouter(store));
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/post-cutoff-ledger`;
  });

  afterEach(async () => {
    server.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
    if (originalAdminKey === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = originalAdminKey;
  });

  async function post(pathname: string, body: unknown, withKey = true) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(withKey ? { 'x-admin-api-key': ADMIN_KEY } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  async function get(pathname: string) {
    const response = await fetch(`${baseUrl}${pathname}`);
    return { status: response.status, body: await response.json() };
  }

  it('rejects unauthenticated writes', async () => {
    const res = await post('/entries', { draft: validDraft() }, false);
    expect(res.status).toBe(401);
  });

  it('creates an entry, lists it chronologically, and links it to the baseline run', async () => {
    const created = await post('/entries', { draft: validDraft() });
    expect(created.status).toBe(201);
    expect(created.body.record.revision).toBe(1);
    expect(created.body.record.entry.baseline_run_id).toBe('seasonal-ppr-2026-forward-001');
    expect(created.body.record.entry.status).toBe('candidate_operator_observation');
    expect(created.body.record.entry.player_ref.identity_status).toBe('unresolved');

    const second = await post('/entries', { draft: validDraft({ display_name: 'Tyler Warren', event_type: 'personnel_usage' }) });
    expect(second.status).toBe(201);

    const list = await get('/entries');
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(2);
    // Newest first (append order).
    expect(list.body.entries[0].entry.player_ref.display_name).toBe('Tyler Warren');

    const filtered = await get('/entries?player=josh%20downs');
    expect(filtered.body.count).toBe(1);

    const baselines = await get('/baseline-runs');
    expect(baselines.body.baselineRunIds).toEqual(['seasonal-ppr-2026-forward-001']);
  });

  it('preserves observation/inference separation and unrecognized fields across save and reload', async () => {
    const created = await post('/entries', { draft: validDraft() });
    const id = created.body.record.ledger_entry_id;

    const fetched = await get(`/entries/${id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.entry.observations).toHaveLength(3);
    expect(fetched.body.entry.inferences).toHaveLength(2);
    expect(fetched.body.entry.unrecognized_fields).toEqual([
      { key: 'status', value: 'pending repeated camp and preseason deployment' },
    ]);
  });

  it('rejects contract-invalid drafts with explicit validation errors and invents nothing', async () => {
    const res = await post('/entries', { draft: validDraft({ baseline_run_id: '', observations: [] }) });
    expect(res.status).toBe(422);
    expect(res.body.validation.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('baseline_run_id'),
        expect.stringContaining('observations'),
      ]),
    );
    const list = await get('/entries');
    expect(list.body.count).toBe(0);
  });

  it('supersedes via appended revision while preserving the full historical record on disk', async () => {
    const created = await post('/entries', { draft: validDraft() });
    const id = created.body.record.ledger_entry_id;
    const firstRecordId = created.body.record.record_id;

    const revised = await post(`/entries/${id}/revisions`, {
      draft: validDraft({ status: 'superseded' }),
      change_note: 'superseded by corroborated camp reports',
    });
    expect(revised.status).toBe(201);
    expect(revised.body.record.revision).toBe(2);
    expect(revised.body.record.supersedes_record_id).toBe(firstRecordId);

    const detail = await get(`/entries/${id}`);
    expect(detail.body.revision).toBe(2);
    expect(detail.body.entry.status).toBe('superseded');
    expect(detail.body.history).toHaveLength(2);
    expect(detail.body.history[0].entry.status).toBe('candidate_operator_observation');

    // Append-only on disk: both immutable record files exist.
    const files = await fs.readdir(path.join(tmpDir, 'records'));
    expect(files).toHaveLength(2);
  });

  it('never marks source refs verified at intake', async () => {
    const created = await post('/entries', {
      draft: validDraft({
        source_refs: [{ ref: 'https://example.com/camp-report', note: 'beat writer', verified: true }],
      }),
    });
    expect(created.status).toBe(201);
    expect(created.body.record.entry.source_refs[0].verified).toBe(false);
  });

  it('404s revisions for unknown entries', async () => {
    const res = await post('/entries/pcl_missing/revisions', { draft: validDraft() });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
