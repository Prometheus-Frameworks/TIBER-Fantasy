import { z } from 'zod';
import type { buildDraftReview, parseSleeperRosterUrl } from '../draftReviewService';
import type { historicalEvidenceFor } from '../historicalEvidence';
import { MAX_TEAM_RESULT_BYTES, TEAM_MCP_SCHEMA, teamToolError, teamToolSuccess } from './teamToolResults';
import type { TeamToolResult } from './teamToolResults';

/** Required injection; this contract never imports or selects production readers. */
export interface TeamToolDependencies {
  /** Descriptive only; never enables or selects a source reader. */
  sourceMode?: 'disabled' | 'synthetic';
  parseRosterUrl: typeof parseSleeperRosterUrl;
  readRoster: typeof buildDraftReview;
  readEvidence: typeof historicalEvidenceFor;
}

export const TEAM_TOOL_NAMES = [
  'tiber_team_describe_capabilities',
  'tiber_team_get_roster_context',
  'tiber_team_get_player_evidence',
] as const;

const capabilitiesInput = z.object({}).strict();
const rosterInput = z.object({ sleeper_url: z.string().max(256).trim().min(1) }).strict();
const evidenceInput = z.object({
  player_ids: z.array(z.string().regex(/^(?:\d{1,24}|[A-Z]{2,3})$/)).min(1).max(3)
    .refine(ids => new Set(ids).size === ids.length, 'Exact player IDs must be distinct.'),
}).strict();

/** One instance per future server; its single-flight guard spans that instance. */
export function createTeamToolDefinitions(deps: TeamToolDependencies) {
  let rosterBusy = false;
  const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true } as const;
  return [
    {
      name: TEAM_TOOL_NAMES[0], title: 'Describe TIBER Team capabilities',
      description: 'Describe this read-only contract. Availability does not establish source-use permission or a live connection.',
      inputSchema: capabilitiesInput,
      annotations: { ...annotations, openWorldHint: false },
      async handler(args: unknown): Promise<TeamToolResult> {
        if (!capabilitiesInput.safeParse(args).success) return teamToolError('invalid_input');
        return teamToolSuccess({
          contract_version: TEAM_MCP_SCHEMA, tools: [...TEAM_TOOL_NAMES],
          implementation_stage: 'read_only_tools',
          source_mode: deps.sourceMode ?? 'caller_supplied_read_dependencies',
          limits: { roster_url_characters: 256, evidence_player_ids: 3, result_utf8_bytes: MAX_TEAM_RESULT_BYTES, concurrent_roster_reads_per_instance: 1 },
          unsupported: ['private_studies', 'writes', 'transactions', 'arbitrary_fetch', 'name_lookup', 'hosted_access'],
          disclosures: [
            'A roster locator does not authenticate ownership.',
            'Roster acquisition time is not a provider update time; the player directory may be cached up to 24 hours.',
            'Historical observations are not current projections; missing forecasts remain unavailable.',
            'Source-use permission and real-client acceptance must be checked separately.',
          ],
        });
      },
    },
    {
      name: TEAM_TOOL_NAMES[1], title: 'Read public roster context',
      description: 'Read an exact public Sleeper roster locator. Preserve observed facts, deterministic derivations, source clocks and unavailable evidence. No team guessing or transactions.',
      inputSchema: rosterInput, annotations,
      async handler(args: unknown): Promise<TeamToolResult> {
        const parsed = rosterInput.safeParse(args);
        if (!parsed.success) return teamToolError('invalid_input');
        let canonicalUrl: string;
        try { canonicalUrl = deps.parseRosterUrl(parsed.data.sleeper_url).canonicalUrl; }
        catch { return teamToolError('invalid_input'); }
        if (rosterBusy) return teamToolError('busy');
        rosterBusy = true;
        try { return teamToolSuccess(await deps.readRoster(canonicalUrl)); }
        catch { return teamToolError('source_unavailable'); }
        finally { rosterBusy = false; }
      },
    },
    {
      name: TEAM_TOOL_NAMES[2], title: 'Read admitted player evidence',
      description: 'Read historical evidence for one to three distinct exact Sleeper IDs. No fuzzy lookup, projections or substitute data; unmapped identities stay unavailable.',
      inputSchema: evidenceInput, annotations,
      async handler(args: unknown): Promise<TeamToolResult> {
        const parsed = evidenceInput.safeParse(args);
        if (!parsed.success) return teamToolError('invalid_input');
        try { return teamToolSuccess(deps.readEvidence(parsed.data.player_ids)); }
        catch { return teamToolError('source_unavailable'); }
      },
    },
  ] as const;
}
