import { promises as fs } from 'fs';
import path from 'path';
import { PlayerOwnershipClient } from '../modules/externalModels/playerOwnership/playerOwnershipClient';
import { PlayerOwnershipService } from '../modules/externalModels/playerOwnership/playerOwnershipService';
import { runDynastyRosterSmokeTest } from '../modules/externalModels/playerOwnership/dynastyRosterSmokeHelper';
import { DYNASTY_ROSTER_SMOKE_2026 } from '../modules/externalModels/playerOwnership/__tests__/fixtures/dynastyRosterSmoke2026';
import { TeamEnvironmentProfilesClient } from '../modules/externalModels/teamState/teamEnvironmentProfilesClient';
import { buildDynastyRosterTeamEnvironmentSummary } from '../modules/externalModels/teamState/dynastyRosterTeamEnvironmentSummaryHelper';

const REPORT_PATH = path.join(process.cwd(), 'docs', 'reports', 'dynasty-roster-team-environment-summary-2026-05-25.md');

function table(name: string, bucket: Record<string, number>): string[] {
  const lines = [`### ${name}`, '', '| Tier | Count |', '|------|-------|'];
  for (const [k, v] of Object.entries(bucket)) lines.push(`| ${k} | ${v} |`);
  lines.push('');
  return lines;
}

async function main() {
  const ownership = new PlayerOwnershipService(new PlayerOwnershipClient());
  const smoke = await runDynastyRosterSmokeTest(DYNASTY_ROSTER_SMOKE_2026, ownership);
  const teamClient = new TeamEnvironmentProfilesClient();
  const teamArtifact = await teamClient.readArtifact();
  const summary = buildDynastyRosterTeamEnvironmentSummary(smoke, teamArtifact);

  const lines: string[] = ['# Dynasty Roster Team Environment Summary — 2026-05-25', '', `Generated at: ${summary.generatedAt}`, ''];
  lines.push(`- roster players tested: ${summary.rosterPlayersTested}`);
  lines.push(`- players with ownership match: ${summary.playersWithOwnershipMatch}`);
  lines.push(`- players with team environment profile: ${summary.playersWithTeamEnvironmentProfile}`);
  lines.push(`- players missing team environment profile: ${summary.playersMissingTeamEnvironmentProfile}`);
  lines.push('');
  lines.push(...table('Offense Tier Exposure', summary.offenseTierExposure));
  lines.push(...table('Pass Environment Exposure', summary.passEnvironmentExposure));
  lines.push(...table('Pace Exposure', summary.paceExposure));
  lines.push(...table('Volatility Exposure', summary.volatilityExposure));
  lines.push('| Input Name | Canonical Player Name | Position | Team | Ownership Confidence | offenseTier | passEnvironmentTier | paceTier | volatilityTier | Teamstate warnings | Join status |');
  lines.push('|------------|------------------------|----------|------|----------------------|-------------|---------------------|----------|----------------|--------------------|------------|');
  for (const p of summary.players) {
    lines.push(`| ${p.inputName} | ${p.canonicalPlayerName ?? '—'} | ${p.position ?? '—'} | ${p.team ?? '—'} | ${p.ownershipConfidence ?? '—'} | ${p.offenseTier ?? '—'} | ${p.passEnvironmentTier ?? '—'} | ${p.paceTier ?? '—'} | ${p.volatilityTier ?? '—'} | ${p.teamstateWarnings.join(' / ') || '—'} | ${p.joinStatus} |`);
  }

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, lines.join('\n'), 'utf8');
  console.log(`Report written: ${REPORT_PATH}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
