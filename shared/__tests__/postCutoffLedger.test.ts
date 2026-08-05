import {
  draftToEntry,
  emptyLedgerEntryDraft,
  entryToDraft,
  parseLedgerPaste,
  validateLedgerDraft,
} from '../postCutoffLedger';

const JOSH_DOWNS_EXAMPLE = `player: Josh Downs
baseline_run: seasonal-ppr-2026-forward-001
event_type: role_expansion
observed:
  - outside reps increasing
  - multi-TE personnel expected to rise
  - bunch/stack usage designed to preserve free releases
inference:
  - more routes in two-WR personnel
  - modestly higher target depth
  - increased spike-week potential
forecast_pressure: upward
confidence: moderate
status: pending repeated camp and preseason deployment
`;

describe('parseLedgerPaste', () => {
  it('parses the Josh Downs pilot example faithfully', () => {
    const { draft, warnings } = parseLedgerPaste(JOSH_DOWNS_EXAMPLE);

    expect(draft.display_name).toBe('Josh Downs');
    expect(draft.baseline_run_id).toBe('seasonal-ppr-2026-forward-001');
    expect(draft.event_type).toBe('role_expansion');
    expect(draft.observations).toEqual([
      'outside reps increasing',
      'multi-TE personnel expected to rise',
      'bunch/stack usage designed to preserve free releases',
    ]);
    expect(draft.inferences).toEqual([
      'more routes in two-WR personnel',
      'modestly higher target depth',
      'increased spike-week potential',
    ]);
    expect(draft.forecast_pressure).toBe('upward');
    expect(draft.confidence).toBe('moderate');

    // "pending repeated camp..." is not a contract status: it must be
    // preserved and warned about, not coerced or dropped.
    expect(draft.status).toBe('candidate_operator_observation');
    expect(draft.unrecognized_fields).toEqual([
      { key: 'status', value: 'pending repeated camp and preseason deployment' },
    ]);
    expect(warnings.some((w) => w.includes('status'))).toBe(true);

    // Nothing invented: no observed_at, no canonical identity.
    expect(draft.observed_at).toBe('');
    expect(draft.canonical_player_id).toBeNull();
    expect(warnings.some((w) => w.includes('observed_at'))).toBe(true);
    expect(warnings.some((w) => w.includes('unresolved'))).toBe(true);
  });

  it('preserves unknown fields instead of dropping them', () => {
    const { draft } = parseLedgerPaste(
      'player: Tyler Warren\ncamp_source: beat writer thread\nsnap_share_note: near-every-down\n',
    );
    expect(draft.unrecognized_fields).toEqual([
      { key: 'camp_source', value: 'beat writer thread' },
      { key: 'snap_share_note', value: 'near-every-down' },
    ]);
  });

  it('preserves unparseable lines and warns', () => {
    const { draft, warnings } = parseLedgerPaste('player: Deebo Samuel\njust some prose with no key\n');
    expect(draft.unrecognized_fields).toHaveLength(1);
    expect(draft.unrecognized_fields[0].value).toBe('just some prose with no key');
    expect(warnings.some((w) => w.includes('could not parse'))).toBe(true);
  });

  it('warns on non-enum pressure/confidence values and preserves the raw value', () => {
    const { draft, warnings } = parseLedgerPaste(
      'player: Bhayshul Tuten\nforecast_pressure: slightly up\nconfidence: pretty sure\n',
    );
    expect(draft.forecast_pressure).toBe('');
    expect(draft.confidence).toBe('');
    expect(draft.unrecognized_fields.map((f) => f.key)).toEqual([
      'forecast_pressure',
      'confidence',
    ]);
    expect(warnings.filter((w) => w.includes('not a recognized'))).toHaveLength(2);
  });

  it('parses nested maps, sources, dates, and quoted values', () => {
    const { draft } = parseLedgerPaste(
      [
        'player: "Malik Nabers"',
        'baseline_run_id: seasonal-ppr-2026-forward-001',
        'event_type: availability_change',
        'observed_at: 2026-08-01',
        'observed:',
        '  - practicing without limitation',
        'sources:',
        '  - https://example.com/report',
        'linked_artifacts:',
        '  forecast_player_row_ref: fpr-123',
      ].join('\n'),
    );
    expect(draft.display_name).toBe('Malik Nabers');
    expect(draft.observed_at).toBe('2026-08-01');
    expect(draft.source_refs).toEqual([
      { ref: 'https://example.com/report', note: null, verified: false },
    ]);
    // Nested map under an unaliased key is preserved, not dropped.
    expect(draft.unrecognized_fields).toEqual([
      { key: 'linked_artifacts', value: 'forecast_player_row_ref: fpr-123' },
    ]);
  });
});

describe('validateLedgerDraft', () => {
  function validDraft() {
    const draft = emptyLedgerEntryDraft();
    draft.baseline_run_id = 'seasonal-ppr-2026-forward-001';
    draft.display_name = 'Josh Downs';
    draft.observed_at = '2026-08-01';
    draft.event_type = 'role_expansion';
    draft.observations = ['outside reps increasing'];
    draft.forecast_pressure = 'upward';
    draft.confidence = 'moderate';
    return draft;
  }

  it('accepts a complete draft', () => {
    const result = validateLedgerDraft(validDraft());
    expect(result.errors).toEqual([]);
  });

  it('requires baseline run, player, observed_at, event_type, and observations', () => {
    const result = validateLedgerDraft(emptyLedgerEntryDraft());
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('baseline_run_id'),
        expect.stringContaining('display_name'),
        expect.stringContaining('observed_at'),
        expect.stringContaining('event_type'),
        expect.stringContaining('observations'),
      ]),
    );
  });

  it('warns when no sources are attached', () => {
    const result = validateLedgerDraft(validDraft());
    expect(result.warnings.some((w) => w.includes('No source references'))).toBe(true);
  });

  it('warns on high confidence with a single source for a candidate entry', () => {
    const draft = validDraft();
    draft.confidence = 'high';
    draft.source_refs = [{ ref: 'https://example.com/highlight', note: null, verified: false }];
    const result = validateLedgerDraft(draft);
    expect(result.warnings.some((w) => w.includes('corroboration_pending'))).toBe(true);
  });
});

describe('draftToEntry / entryToDraft round trip', () => {
  it('keeps observations and inferences separate and never marks sources verified at intake', () => {
    const { draft } = parseLedgerPaste(JOSH_DOWNS_EXAMPLE);
    draft.observed_at = '2026-08-01';
    draft.source_refs = [{ ref: 'https://example.com/camp-report', note: 'beat report', verified: true }];

    const entry = draftToEntry(draft);
    expect(entry.observations).toHaveLength(3);
    expect(entry.inferences).toHaveLength(3);
    expect(entry.observations).not.toEqual(entry.inferences);
    expect(entry.source_refs[0].verified).toBe(false);
    expect(entry.player_ref.identity_status).toBe('unresolved');
    expect(entry.player_ref.canonical_player_id).toBeNull();
    expect(entry.unrecognized_fields).toHaveLength(1);

    const roundTripped = draftToEntry(entryToDraft(entry));
    expect(roundTripped).toEqual(entry);
  });

  it('resolves identity only when a canonical id is attached', () => {
    const { draft } = parseLedgerPaste(JOSH_DOWNS_EXAMPLE);
    draft.observed_at = '2026-08-01';
    draft.canonical_player_id = '00-0038113';
    const entry = draftToEntry(draft);
    expect(entry.player_ref.identity_status).toBe('resolved');
  });
});
