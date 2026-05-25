import { promises as fs } from 'fs';
import path from 'path';
import { PlayerOwnershipClient } from '../modules/externalModels/playerOwnership/playerOwnershipClient';
import { PlayerOwnershipService } from '../modules/externalModels/playerOwnership/playerOwnershipService';
import { DYNASTY_ROSTER_SMOKE_2026 } from '../modules/externalModels/playerOwnership/__tests__/fixtures/dynastyRosterSmoke2026';
import { runDynastyRosterSmokeTest } from '../modules/externalModels/playerOwnership/dynastyRosterSmokeHelper';
import { TeamEnvironmentProfilesClient } from '../modules/externalModels/teamState/teamEnvironmentProfilesClient';
import { buildDynastyRosterTeamEnvironmentSummary } from '../modules/externalModels/teamState/dynastyRosterTeamEnvironmentSummaryHelper';

const REPORT_PATH = path.join(process.cwd(), 'docs', 'reports', 'dynasty-roster-team-environment-summary-2026-05-25.md');

function render(summary: ReturnType<typeof buildDynastyRosterTeamEnvironmentSummary>, environmentWarnings: string[], ownershipReportPath: string): string {
  const lines: string[] = [];
  lines.push('# Dynasty Roster Team Environment Summary — 2026-05-25', '');
  lines.push(`- Roster players tested: ${summary.rosterPlayersTested}`);
  lines.push(`- Players with ownership match: ${summary.playersWithOwnershipMatch}`);
  lines.push(`- Players with team environment profile: ${summary.playersWithTeamEnvironmentProfile}`);
  lines.push(`- Players missing team environment profile: ${summary.playersMissingTeamEnvironmentProfile}`);
  lines.push('');
  if (environmentWarnings.length) lines.push(`> ${environmentWarnings.join(' ')}`, '');
  const section = (title: string, obj: Record<string, number>) => { lines.push(`## ${title}`, ''); for (const [k, v] of Object.entries(obj)) lines.push(`- ${k}: ${v} players`); lines.push(''); };
  section('Offense tier exposure', summary.offenseTierExposure);
  section('Pass environment exposure', summary.passEnvironmentExposure);
  section('Pace exposure', summary.paceExposure);
  section('Volatility exposure', summary.volatilityExposure);
  lines.push('## Per-player team environment attachment', '');
  lines.push('| input name | canonical player name | position | team | ownership confidence | offenseTier | passEnvironmentTier | paceTier | volatilityTier | Teamstate warnings | join status |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const p of summary.players) lines.push(`| ${p.inputName} | ${p.canonicalPlayerName ?? '—'} | ${p.position ?? '—'} | ${p.team ?? '—'} | ${p.ownershipConfidence ?? '—'} | ${p.offenseTier} | ${p.passEnvironmentTier} | ${p.paceTier} | ${p.volatilityTier} | ${p.teamstateWarnings.join(' / ') || '—'} | ${p.joinStatus} |`);
  lines.push('', `Ownership source report path: \`${ownershipReportPath}\``);
  return lines.join('\n');
}

async function main() {
  const ownershipService = new PlayerOwnershipService(new PlayerOwnershipClient());
  const ownership = await runDynastyRosterSmokeTest(DYNASTY_ROSTER_SMOKE_2026, ownershipService);
  const envClient = new TeamEnvironmentProfilesClient();
  const env = await envClient.readArtifact();
  const summary = buildDynastyRosterTeamEnvironmentSummary(ownership, env.artifact);
  const markdown = render(summary, env.warnings, ownership.artifactPath);
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, markdown, 'utf8');
  console.log(`[TeamEnvSummary] report written: ${REPORT_PATH}`);
}

main().catch((e) => { console.error('[TeamEnvSummary] fatal', e); process.exit(1); });
