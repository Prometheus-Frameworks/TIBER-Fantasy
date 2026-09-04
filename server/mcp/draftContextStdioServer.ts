import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  calculateReplacementGeometry,
  DEFAULT_REPLACEMENT_BUFFER,
} from './draftContextReplacementGeometry';
import {
  calculateTrailingVor,
  TRAILING_PRODUCTION_CACHE_PATH,
  type ReplacementRanks,
  type TrailingProductionArtifact,
} from './draftContextTrailingVor';
import {
  isExpectedTrailingProductionArtifact,
  selectAdpCandidates,
  unavailableInsufficientPopulation,
} from './draftContextStdioLogic';

const SERVER_NAME = 'tiber-draft-context';
const SERVER_VERSION = '0.2.0';
const STALE_AFTER_DAYS = 3;
const REPLACEMENT_GEOMETRY_REFERENCE = {
  repository: 'Prometheus-Frameworks/TIBER-Forecast',
  path: 'src/calculators/replacement/calculateReplacementBaselines.ts',
  blob_sha: '8c57fb1a884618c371b9172051e7b1d0155264fc',
} as const;
const TRAILING_VOR_METHOD_REFERENCE = {
  repository: 'Prometheus-Frameworks/TIBER-Ops',
  issue: 60,
  method:
    'trailing-season fantasy points as the base metric, VOR against league-specific replacement, operator context layered on top',
} as const;

const SNAPSHOTS: Record<string, string> = {
  'ppr:10': 'data/adp/adp_snapshot_latest_ppr_10tm.json',
  'ppr:12': 'data/adp/adp_snapshot_latest_ppr_12tm.json',
  'half-ppr:10': 'data/adp/adp_snapshot_latest_half-ppr_10tm.json',
};

type AdpPlayer = {
  name: string;
  position: string;
  team: string;
  adp: number;
  adp_formatted?: string;
  times_drafted?: number;
  high?: number;
  low?: number;
  stdev?: number;
  bye?: number;
};

type AdpSnapshot = {
  schema_version: string;
  source: { name: string; url: string; fetched_at: string };
  params: { format: string; teams: number; year: number };
  ffc_meta?: Record<string, unknown>;
  player_count: number;
  players: AdpPlayer[];
};

function ageDays(iso: string): number {
  const ms = Date.now() - Date.parse(iso);
  return Math.max(0, Math.floor(ms / 86_400_000));
}

async function loadSnapshot(format: string, teams: number): Promise<{ path: string; snapshot: AdpSnapshot } | null> {
  const path = SNAPSHOTS[`${format}:${teams}`];
  if (!path) return null;
  const text = await readFile(resolve(process.cwd(), path), 'utf8');
  return { path, snapshot: JSON.parse(text) as AdpSnapshot };
}

async function loadTrailingProduction(): Promise<{ path: string; artifact: TrailingProductionArtifact } | null> {
  const path = TRAILING_PRODUCTION_CACHE_PATH;
  try {
    const text = await readFile(resolve(process.cwd(), path), 'utf8');
    const artifact: unknown = JSON.parse(text);
    if (!isExpectedTrailingProductionArtifact(artifact)) {
      throw new Error('local trailing-production cache failed shape/authority validation');
    }
    return { path, artifact };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export function buildDraftContextMcpServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        'Read-only TIBER draft context pilot. It exposes committed ADP artifacts, deterministic league geometry, and—when the source-pinned local cache has been built—backward-looking 2025 production/VOR context. ' +
        'The MCP runtime performs no network fetch, writes no state, drafts no players, publishes no ranking, and makes no 2026 projection claim. Unsupported league shapes fail closed.',
    },
  );

  server.registerTool(
    'tiber_get_draft_board_context',
    {
      title: 'Get committed draft-board context',
      description:
        'Read an already-committed Fantasy Football Calculator ADP snapshot for an exact supported format/team-count pair. Returns provenance, freshness, ADP, bye week, and source-native spread/sample fields. Never performs a network request or silently substitutes another league shape.',
      inputSchema: {
        format: z.enum(['ppr', 'half-ppr']),
        teams: z.number().int().positive(),
        candidateNames: z.array(z.string().min(1)).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ format, teams, candidateNames, limit = 50 }) => {
      const loaded = await loadSnapshot(format, teams);
      if (!loaded) {
        const supported = Object.keys(SNAPSHOTS).map((key) => {
          const [supportedFormat, supportedTeams] = key.split(':');
          return { format: supportedFormat, teams: Number(supportedTeams) };
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  status: 'unsupported_configuration',
                  requested: { format, teams },
                  supported,
                  substitution_performed: false,
                },
                null,
                2,
              ),
            },
          ],
          isError: false,
        };
      }

      const { path, snapshot } = loaded;
      const daysOld = ageDays(snapshot.source.fetched_at);
      const selection = selectAdpCandidates(snapshot.players, candidateNames, limit);
      const players = selection.players.map((player) => ({
        name: player.name,
        position: player.position,
        team: player.team,
        adp: player.adp,
        adp_formatted: player.adp_formatted ?? null,
        bye: player.bye ?? null,
        times_drafted: player.times_drafted ?? null,
        high: player.high ?? null,
        low: player.low ?? null,
        stdev: player.stdev ?? null,
      }));

      const payload = {
        status: 'available',
        authority: 'committed_historical_market_observation',
        not_live: true,
        source: 'Fantasy Football Calculator',
        artifact_path: path,
        schema_version: snapshot.schema_version,
        source_url_recorded_in_artifact: snapshot.source.url,
        fetched_at: snapshot.source.fetched_at,
        age_days: daysOld,
        freshness: daysOld > STALE_AFTER_DAYS ? 'stale' : 'current_within_pilot_threshold',
        stale_after_days: STALE_AFTER_DAYS,
        requested: { format, teams },
        artifact_params: snapshot.params,
        ffc_meta: snapshot.ffc_meta ?? null,
        player_count_in_artifact: snapshot.player_count,
        returned_player_count: players.length,
        players,
        unmatched_candidates: selection.unmatchedCandidates,
        disclosures: [
          'This tool performs no network request; it reads an already-committed snapshot only.',
          'ADP is a source-specific market coordinate, not a TIBER ranking or projection.',
          'Team and bye fields are source observations from the snapshot and may be stale.',
        ],
      };

      return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }], isError: false };
    },
  );

  server.registerTool(
    'tiber_get_vor_context',
    {
      title: 'Get trailing VOR context',
      description:
        'Returns deterministic league replacement geometry for full-PPR QB/RB/WR/TE and, when the pinned 2025 production cache is present, backward-looking season-PPR VOR plus games/PPG context. This is descriptive historical evidence, not a 2026 projection or ranking.',
      inputSchema: {
        teams: z.number().int().positive(),
        scoring: z.string().min(1),
        starters: z.object({
          QB: z.number().int().min(0),
          RB: z.number().int().min(0),
          WR: z.number().int().min(0),
          TE: z.number().int().min(0),
          FLEX: z.number().int().min(0),
        }),
        flexAllocation: z
          .object({
            RB: z.number().min(0).max(1),
            WR: z.number().min(0).max(1),
            TE: z.number().min(0).max(1),
          })
          .optional(),
        replacementBuffer: z.number().min(0).max(1).optional(),
        bench: z.number().int().min(0).optional(),
        candidateNames: z.array(z.string().min(1)).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ teams, scoring, starters, flexAllocation, replacementBuffer, bench, candidateNames }) => {
      const normalizedScoring = scoring.trim().toLowerCase();
      if (normalizedScoring !== 'ppr') {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  status: 'unsupported_scoring_profile',
                  requested: { teams, scoring, starters, bench: bench ?? null },
                  supported_scoring: ['ppr'],
                  substitution_performed: false,
                  numeric_vor_available: false,
                },
                null,
                2,
              ),
            },
          ],
          isError: false,
        };
      }

      const geometry = calculateReplacementGeometry(
        teams,
        starters,
        flexAllocation,
        replacementBuffer ?? DEFAULT_REPLACEMENT_BUFFER,
      );
      const replacementRanks = geometry.replacementRank as ReplacementRanks;

      let trailingProduction: Awaited<ReturnType<typeof loadTrailingProduction>> = null;
      let cacheError: string | null = null;
      try {
        trailingProduction = await loadTrailingProduction();
      } catch (error) {
        cacheError = error instanceof Error ? error.message : String(error);
      }

      let numericVor: Record<string, unknown>;
      let overallStatus = 'replacement_geometry_available_vor_unavailable';
      let authority = 'deterministic_league_geometry_only';

      if (cacheError) {
        numericVor = {
          status: 'unavailable_invalid_local_cache',
          cache_path: TRAILING_PRODUCTION_CACHE_PATH,
          reason: cacheError,
          setup_command: 'npx tsx scripts/buildDraftTrailingProductionSnapshot.ts',
        };
      } else if (!trailingProduction) {
        numericVor = {
          status: 'unavailable_local_cache_not_built',
          cache_path: TRAILING_PRODUCTION_CACHE_PATH,
          reason:
            'The source-pinned 2025 production cache has not been built on this machine. MCP runtime network access stays disabled.',
          setup_command: 'npx tsx scripts/buildDraftTrailingProductionSnapshot.ts',
        };
      } else {
        const calculation = calculateTrailingVor(trailingProduction.artifact, replacementRanks, candidateNames);
        if (calculation.status === 'insufficient_population') {
          numericVor = unavailableInsufficientPopulation(calculation);
        } else {
          overallStatus = 'replacement_geometry_and_trailing_vor_available';
          authority = 'deterministic_league_geometry_plus_promoted_historical_evidence';
          numericVor = {
            status: 'available',
            authority: 'backward_looking_descriptive_trailing_vor',
            season: trailingProduction.artifact.season,
            scoring: trailingProduction.artifact.scoring,
            metric: '2025 season PPR minus the 2025 season PPR of the positional player at the league-specific replacement rank',
            method_reference: TRAILING_VOR_METHOD_REFERENCE,
            cache_path: trailingProduction.path,
            source: trailingProduction.artifact.source,
            source_player_count: trailingProduction.artifact.player_count,
            replacement: calculation.replacement,
            candidates: calculation.candidates,
            unmatched_candidates: calculation.unmatched_candidates,
            ppg_context:
              'Games played, season PPG, and PPG delta versus the same replacement player are context fields only; the registered trailing-VOR metric remains season-total PPR.',
          };
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: overallStatus,
                requested: {
                  teams,
                  scoring: normalizedScoring,
                  starters,
                  bench: bench ?? null,
                  candidateNames: candidateNames ?? null,
                },
                authority,
                not_a_2026_projection: true,
                geometry: {
                  flex_slots_league_wide: geometry.flexSlots,
                  flex_allocation: geometry.flexAllocation,
                  flex_allocation_source: flexAllocation ? 'caller_supplied_normalized' : 'forecast_default_35_50_15',
                  starter_demand: geometry.starterDemand,
                  replacement_buffer: geometry.replacementBuffer,
                  replacement_rank: geometry.replacementRank,
                },
                semantics_reference: {
                  ...REPLACEMENT_GEOMETRY_REFERENCE,
                  relationship:
                    'Bounded local reimplementation of starter/flex demand and replacement-rank geometry only; no Forecast runtime or projection activation is implied.',
                },
                numeric_vor: numericVor,
                disclosures: [
                  'Bench size is recorded but does not enter the current replacement-rank geometry.',
                  'Kicker and DST are outside this pilot and do not enter the QB/RB/WR/TE geometry.',
                  'Replacement ranks are league-demand coordinates, not player values, rankings, or 2026 projections.',
                  'When numeric trailing VOR is available, it is backward-looking 2025 descriptive evidence only and is not product advice.',
                  'Season-total VOR reflects missed games by design. Games played and PPG are returned so an agent/operator can see that context rather than silently treating availability as talent.',
                  'The one-time cache builder fetches one exact SHA-pinned promoted TIBER-Data artifact from GitHub; the MCP runtime itself remains network-free.',
                ],
              },
              null,
              2,
            ),
          },
        ],
        isError: false,
      };
    },
  );

  return server;
}

async function main(): Promise<void> {
  await import('./stdioSafety');
  const server = buildDraftContextMcpServer();
  await server.connect(new StdioServerTransport());
  console.error(`[${SERVER_NAME}] stdio MCP server ready (2 tools)`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && resolve(fileURLToPath(import.meta.url)) === invokedPath) {
  main().catch((error) => {
    console.error(`[${SERVER_NAME}] failed to start:`, error);
    process.exit(1);
  });
}
