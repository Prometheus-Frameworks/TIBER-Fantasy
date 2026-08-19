import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const SERVER_NAME = 'tiber-draft-context';
const SERVER_VERSION = '0.1.0';
const STALE_AFTER_DAYS = 3;

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

export function buildDraftContextMcpServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        'Read-only TIBER draft context pilot. It exposes only already-committed artifacts. ' +
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
        'Returns the current activation status of the bounded trailing-production/VOR lane. This pilot refuses to manufacture VOR unless an existing reproducible evidence path is wired and validated.',
      inputSchema: {
        teams: z.number().int().positive(),
        scoring: z.string().min(1),
        candidateNames: z.array(z.string().min(1)).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ teams, scoring, candidateNames }) => ({
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              status: 'unavailable_not_wired',
              requested: { teams, scoring, candidateNames: candidateNames ?? null },
              reason:
                'The prior harness used trailing 2025 production plus league-specific replacement/VOR, but this MCP pilot has not yet bound that calculation to a reproducible committed artifact/code path. TIBER refuses to manufacture a VOR value.',
              authority: 'none',
              not_a_2026_projection: true,
              next_safe_step:
                'Audit the existing trailing-production and replacement-baseline code/artifacts and wire only a reproducible path.',
            },
            null,
            2,
          ),
        },
      ],
      isError: false,
    }),
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
