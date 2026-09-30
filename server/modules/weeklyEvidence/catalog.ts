/** Reference-only pilot catalog. These states do not grant consumer admission. */
export const EVIDENCE_ID = 'watson-gb-2026-reg-w01-w02-projection-v0';
export const SUBJECT_ID = '00-0038124';
export const MODEL_SHA256 = '06f7c33f9ca4ea7e3ce5b8a2b88891d3bb63e8a899294f66f8fff955fc658c2e';
export const INPUT_LIMIT = 2_048;
export const RESULT_LIMIT = 65_536;
export const TOOL_NAMES = ['tiber_describe_capabilities', 'tiber_list_evidence', 'tiber_get_evidence'] as const;

export function evidenceCatalog() {
  return {
    entries: [{
      evidence_id: EVIDENCE_ID, subject_namespace: 'GSIS', subject_id: SUBJECT_ID,
      season: 2026, season_type: 'REG', weeks: [1, 2], observed_event_team: 'GB',
      representation: 'reviewed_presentation_projection_not_complete_producer_export',
      sha256: MODEL_SHA256,
      retained: true, review: 'CLEAN WITH NON-BLOCKING NOTES',
      purpose: 'operator_authorized_offline_adapter_inspection',
      access: 'offline_only', remote_consumer_enabled: false,
      locator: {
        repository: 'Prometheus-Frameworks/TIBER-Fantasy',
        commit: '67398ca651bb96d08798bc10f8134f5ec6c1ff6a',
        path: 'server/modules/draftReview/artifacts/watsonGbCase01ReadModel.json',
      },
      // Bytes are checked by get_evidence, never inferred from listing metadata.
      current_byte_integrity: 'not_checked_by_catalog',
    }],
    unavailable: [
      { lane: 'ROP/Teamstate', weeks: [3], reason: 'No exact reviewed Week 3 output and MCP-purpose eligibility witness is bound to this offline catalog.' },
      { lane: 'Forecast', reason: 'No eligible exact Forecast packet is bound to this case.' },
      { lane: 'Sleeper_roster_association', reason: 'Source-native GSIS identity only; Sleeper join remains unresolved.' },
    ],
  };
}
