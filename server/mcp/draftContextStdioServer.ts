import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const SERVER_NAME = 'tiber-draft-context';
const SERVER_VERSION = '0.1.0';
const STALE_AFTER_DAYS = 3;
const DEFAULT_REPLACEMENT_BUFFER = 0.1;
const DEFAULT_FLEX_ALLOCATION = { RB: 0.35, WR: 0.5, TE: 0.15 } as const;
const REPLACEMENT_GEOMETRY_REFERENCE = {
  repository: 'Prometheus-Frameworks/TIBER-Forecast',
  path: 'src/calculators/replacement/calculateReplacementBaselines.ts',
  blob_sha: '8c57fb1a884618c371b9172051e7b1d0155264fc',
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

type StarterConfig = {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
};

type FlexAllocation = {
  RB: number;
  WR: number;
  TE: number;
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

function normalizeFlexAllocation(configured?: FlexAllocation): FlexAllocation {
  const raw = configured ?? DEFAULT_FLEX_ALLOCATION;
  const total = raw.RB + raw.WR + raw.TE;

  if (total <= 0) {
    return { ...DEFAULT_FLEX_ALLOCATION };
  }

  return {
    RB: raw.RB / total,
    WR: raw.WR / total,
    TE: raw.TE / total,
  };
}

export function calculateReplacementGeometry(
  teams: number,
  starters: StarterConfig,
  configuredFlexAllocation?: FlexAllocation,
  replacementBuffer = DEFAULT_REPLACEMENT_BUFFER,
) {
  const flexAllocation = normalizeFlexAllocation(configuredFlexAllocation);
  const flexSlots = teams * starters.FLEX;
  const starterDemand = {
    QB: teams * starters.QB,
    RB: teams * starters.RB + flexSlots * flexAllocation.RB,
    WR: teams * starters.WR + flexSlots * flexAllocation.WR,
    TE: teams * starters.TE + flexSlots * flexAllocation.TE,
  };

  const replacementRank = {
    QB: Math.max(1, Math.ceil(starterDemand.QB * (1 + replacementBuffer))),
    RB: Math.max(1, Math.ceil(starterDemand.RB * (1 + replacementBuffer))),
    WR: Math.max(1, Math.ceil(starterDemand.WR * (1 + replacementBuffer))),
    TE: Math.max(1, Math.ceil(starterDemand.TE * (1 + replacementBuffer))),
  };

  return {
    flexAllocation,
    flexSlots,
    starterDemand,
    replacementBuffer,
    replacementRank,
  };
}

export function buildDraftContextMcpServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        'Read-only TIBER draft context pilot. It exposes only already-committed artifacts and deterministic league geometry. ' +
        'It does not fetch live market data, write state, draft players, publish rankings, or ' +
        'claim that trailing evidence is a 2026 projection. Unsupported league shapes fail closed.',
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
      const wanted = candidateNames?.map((name) => name.trim().toLowerCase());
      const players = snapshot.players
        .filter((player) => !wanted || wanted.includes(player.name.toLowerCase()))
        .slice(0, limit)
        .map((player) => ({
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
        'Returns deterministic league replacement-rank geometry for full-PPR QB/RB/WR/TE using the bounded TIBER-Forecast replacement semantics. Numeric trailing VOR remains unavailable until a committed production artifact is locally bound and validated.',
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

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'replacement_geometry_available_vor_unavailable',
                requested: {
                  teams,
                  scoring: normalizedScoring,
                  starters,
                  bench: bench ?? null,
                  candidateNames: candidateNames ?? null,
                },
                authority: 'deterministic_league_geometry_only',
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
                numeric_vor: {
                  status: 'unavailable_not_wired',
                  reason:
                    'No committed local trailing-production artifact is yet bound to this MCP branch. The tool will not fetch Sleeper, reach across repositories at runtime, or manufacture replacement points.',
                  next_safe_step:
                    'Bind a compact committed trailing-production artifact with explicit provenance, then calculate historical player PPG minus the PPG at the league-specific replacement rank.',
                },
                disclosures: [
                  'Bench size is recorded but does not enter the current replacement-rank geometry.',
                  'Kicker and DST are outside this pilot and do not enter the QB/RB/WR/TE geometry.',
                  'Replacement ranks are league-demand coordinates, not player values, rankings, or 2026 projections.',
                  'Numeric VOR remains unavailable until historical production is bound reproducibly.',
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
