/**
 * Post-cutoff signal ledger API (issue #297).
 *
 * Reads are open (operator inspection surface); writes require admin auth.
 * Saving or revising an entry only appends immutable candidate-evidence
 * records — it never mutates Forecast outputs, promoted artifacts, rankings,
 * projections, or player cards.
 */
import express, { RequestHandler } from 'express';
import { z } from 'zod';
import {
  draftToEntry,
  emptyLedgerEntryDraft,
  LedgerEntryDraft,
  validateLedgerDraft,
} from '@shared/postCutoffLedger';
import { requireAdminAuth } from '../middleware/adminAuth';
import {
  PostCutoffLedgerStore,
  PostCutoffLedgerStoreError,
  postCutoffLedgerStore,
} from '../modules/postCutoffLedger/postCutoffLedgerStore';

const ARTIFACT = 'post_cutoff_ledger_v0';

const sourceRefSchema = z.object({
  ref: z.string(),
  note: z.string().nullable().optional().default(null),
  verified: z.boolean().optional().default(false),
});

const draftSchema = z.object({
  baseline_run_id: z.string().default(''),
  canonical_player_id: z.string().nullable().optional().default(null),
  display_name: z.string().default(''),
  observed_at: z.string().default(''),
  event_type: z.string().default(''),
  observations: z.array(z.string()).default([]),
  inferences: z.array(z.string()).default([]),
  forecast_pressure: z.string().default(''),
  confidence: z.string().default(''),
  status: z.string().default('candidate_operator_observation'),
  source_refs: z.array(sourceRefSchema).default([]),
  forecast_player_row_ref: z.string().nullable().optional().default(null),
  rookies_profile_ref: z.string().nullable().optional().default(null),
  rookies_profile_status: z.string().default('missing'),
  limitations: z.array(z.string()).default([]),
  open_questions: z.array(z.string()).default([]),
  unrecognized_fields: z
    .array(z.object({ key: z.string(), value: z.union([z.string(), z.array(z.string())]) }))
    .default([]),
});

const createBodySchema = z.object({
  draft: draftSchema,
  change_note: z.string().nullable().optional().default(null),
});

const listQuerySchema = z.object({
  player: z.string().optional(),
  baselineRunId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

function toDraft(parsed: z.infer<typeof draftSchema>): LedgerEntryDraft {
  return { ...emptyLedgerEntryDraft(), ...parsed };
}

function sendStoreError(res: express.Response, error: unknown) {
  if (error instanceof PostCutoffLedgerStoreError) {
    return res.status(error.status).json({
      ok: false,
      artifact: ARTIFACT,
      error: { code: error.code, message: error.message },
    });
  }
  return res.status(500).json({
    ok: false,
    artifact: ARTIFACT,
    error: { code: 'storage_failure', message: 'Unexpected post-cutoff ledger failure.' },
  });
}

export function createPostCutoffLedgerRouter(
  store: PostCutoffLedgerStore = postCutoffLedgerStore,
  authMiddleware: RequestHandler = requireAdminAuth,
) {
  const router = express.Router();

  router.get('/entries', async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        artifact: ARTIFACT,
        error: { code: 'invalid_request', message: 'Invalid list query parameters.' },
      });
    }
    try {
      const entries = await store.listEntries(parsed.data);
      return res.json({ ok: true, artifact: ARTIFACT, count: entries.length, entries });
    } catch (error) {
      return sendStoreError(res, error);
    }
  });

  router.get('/baseline-runs', async (_req, res) => {
    try {
      const baselineRunIds = await store.listBaselineRunIds();
      return res.json({ ok: true, artifact: ARTIFACT, baselineRunIds });
    } catch (error) {
      return sendStoreError(res, error);
    }
  });

  router.get('/entries/:ledgerEntryId', async (req, res) => {
    try {
      const detail = await store.getEntry(req.params.ledgerEntryId);
      return res.json({ ok: true, artifact: ARTIFACT, ...detail });
    } catch (error) {
      return sendStoreError(res, error);
    }
  });

  router.post('/entries', authMiddleware, async (req, res) => {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        artifact: ARTIFACT,
        error: { code: 'invalid_request', message: 'Body must be { draft, change_note? }.' },
      });
    }
    const draft = toDraft(parsed.data.draft);
    const validation = validateLedgerDraft(draft);
    if (validation.errors.length > 0) {
      return res.status(422).json({
        ok: false,
        artifact: ARTIFACT,
        error: { code: 'contract_invalid', message: 'Draft does not satisfy the ledger contract.' },
        validation,
      });
    }
    try {
      const record = await store.createEntry(draftToEntry(draft), parsed.data.change_note);
      return res.status(201).json({ ok: true, artifact: ARTIFACT, record, validation });
    } catch (error) {
      return sendStoreError(res, error);
    }
  });

  router.post('/entries/:ledgerEntryId/revisions', authMiddleware, async (req, res) => {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        artifact: ARTIFACT,
        error: { code: 'invalid_request', message: 'Body must be { draft, change_note? }.' },
      });
    }
    const draft = toDraft(parsed.data.draft);
    const validation = validateLedgerDraft(draft);
    if (validation.errors.length > 0) {
      return res.status(422).json({
        ok: false,
        artifact: ARTIFACT,
        error: { code: 'contract_invalid', message: 'Draft does not satisfy the ledger contract.' },
        validation,
      });
    }
    try {
      const record = await store.appendRevision(
        req.params.ledgerEntryId,
        draftToEntry(draft),
        parsed.data.change_note,
      );
      return res.status(201).json({ ok: true, artifact: ARTIFACT, record, validation });
    } catch (error) {
      return sendStoreError(res, error);
    }
  });

  return router;
}

export const postCutoffLedgerRouter = createPostCutoffLedgerRouter();
