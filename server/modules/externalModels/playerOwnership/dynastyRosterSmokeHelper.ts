import { PlayerOwnershipService } from './playerOwnershipService';

export interface SmokeTestPlayerResult {
  inputName: string;
  available: boolean;
  matched: boolean;
  ambiguous: boolean;
  playerId: string | null;
  canonicalName: string | null;
  position: string | null;
  footballLevel: string | null;
  currentTeam: string | null;
  ownershipStatus: string | null;
  confidence: string | null;
  sourceSummary: string | null;
  lastVerifiedAt: string | null;
  warnings: string[];
}

export interface SmokeTestReport {
  generatedAt: string;
  artifactPath: string;
  artifactAvailable: boolean;
  totalTested: number;
  totalMatched: number;
  totalUnmatched: number;
  totalAmbiguous: number;
  totalUnavailable: number;
  byConfidence: Record<string, number>;
  players: SmokeTestPlayerResult[];
}

export async function runDynastyRosterSmokeTest(
  roster: readonly string[],
  service: PlayerOwnershipService,
): Promise<SmokeTestReport> {
  const generatedAt = new Date().toISOString();
  const config = service.getStatus();
  const artifactPath = (config as Record<string, unknown>).latestArtifactPath as string ?? '(unknown)';

  const players: SmokeTestPlayerResult[] = [];
  let artifactAvailable = true;

  for (const name of roster) {
    const insight = await service.getPlayerOwnershipInsight({ query: name, includeEvents: false });

    if (!insight.available) {
      artifactAvailable = false;
    }

    const ambiguous = insight.warnings.some((w) => w.toLowerCase().includes('ambiguous'));

    const sourceSummary =
      insight.sourceRefs.length > 0
        ? insight.sourceRefs
            .map((ref) => (ref as Record<string, unknown>).source_name as string)
            .filter(Boolean)
            .join(', ')
        : null;

    players.push({
      inputName: name,
      available: insight.available,
      matched: insight.matched,
      ambiguous,
      playerId: insight.playerId,
      canonicalName: insight.playerName,
      position: insight.position,
      footballLevel: insight.footballLevel,
      currentTeam: insight.currentTeamAbbr,
      ownershipStatus: insight.ownershipStatus,
      confidence: insight.confidence,
      sourceSummary,
      lastVerifiedAt: insight.lastVerifiedAt,
      warnings: insight.warnings,
    });
  }

  const matched = players.filter((p) => p.matched);
  const unmatched = players.filter((p) => p.available && !p.matched && !p.ambiguous);
  const ambiguous = players.filter((p) => p.ambiguous);
  const unavailable = players.filter((p) => !p.available);

  const byConfidence: Record<string, number> = {};
  for (const p of matched) {
    if (p.confidence) {
      byConfidence[p.confidence] = (byConfidence[p.confidence] ?? 0) + 1;
    }
  }

  return {
    generatedAt,
    artifactPath,
    artifactAvailable,
    totalTested: roster.length,
    totalMatched: matched.length,
    totalUnmatched: unmatched.length,
    totalAmbiguous: ambiguous.length,
    totalUnavailable: unavailable.length,
    byConfidence,
    players,
  };
}

export function formatSmokeReportMarkdown(report: SmokeTestReport, issueRef = '#145'): string {
  const lines: string[] = [];

  lines.push('# Dynasty Roster Ownership Smoke Test — 2026-05-24');
  lines.push('');
  lines.push(`**Issue:** ${issueRef}  `);
  lines.push(`**Generated at:** ${report.generatedAt}  `);
  lines.push(`**Artifact path:** \`${report.artifactPath}\`  `);
  lines.push(`**Artifact available:** ${report.artifactAvailable ? 'YES' : 'NO — TIBER-Data sibling repo not mounted in this environment'}  `);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Total players tested | ${report.totalTested} |`);
  lines.push(`| Matched | ${report.totalMatched} |`);
  lines.push(`| Unmatched | ${report.totalUnmatched} |`);
  lines.push(`| Ambiguous | ${report.totalAmbiguous} |`);
  lines.push(`| Artifact unavailable | ${report.totalUnavailable} |`);
  lines.push('');

  if (Object.keys(report.byConfidence).length > 0) {
    lines.push('### Confidence Breakdown (matched rows only)');
    lines.push('');
    lines.push('| Confidence | Count |');
    lines.push('|-----------|-------|');
    for (const [conf, count] of Object.entries(report.byConfidence)) {
      lines.push(`| ${conf} | ${count} |`);
    }
    lines.push('');
  }

  if (!report.artifactAvailable) {
    lines.push('> **Artifact unavailable.** The TIBER-Data `player_ownership_latest.json` artifact was not found at');
    lines.push(`> the configured path. All 26 players returned \`available: false\` — these results are not fabricated.`);
    lines.push('> TIBER-Fantasy does not invent ownership truth when the upstream artifact is absent.');
    lines.push('> To produce a live result, mount the TIBER-Data sibling repo at the expected relative path or set');
    lines.push('> `PLAYER_OWNERSHIP_LATEST_ARTIFACT_PATH` to the correct location.');
    lines.push('');
  }

  lines.push('## Per-Player Results');
  lines.push('');
  lines.push('| Input Name | Match | Player ID | Canonical Name | Pos | Level | Team | Ownership Status | Confidence | Source | Last Verified | Warnings |');
  lines.push('|------------|-------|-----------|---------------|-----|-------|------|-----------------|-----------|--------|--------------|----------|');

  for (const p of report.players) {
    const matchStatus = !p.available ? '⚠ artifact unavailable' : p.ambiguous ? '⚠ ambiguous' : p.matched ? '✓ matched' : '✗ unmatched';
    const warningText = p.warnings.length > 0 ? p.warnings.join(' / ') : '—';
    lines.push(
      `| ${p.inputName} | ${matchStatus} | ${p.playerId ?? '—'} | ${p.canonicalName ?? '—'} | ${p.position ?? '—'} | ${p.footballLevel ?? '—'} | ${p.currentTeam ?? '—'} | ${p.ownershipStatus ?? '—'} | ${p.confidence ?? '—'} | ${p.sourceSummary ?? '—'} | ${p.lastVerifiedAt ?? '—'} | ${warningText} |`,
    );
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Out of Scope (per issue spec)');
  lines.push('');
  lines.push('- Roster valuation');
  lines.push('- Trade advice');
  lines.push('- Teamstate interpretation');
  lines.push('- Role/Opportunity interpretation');
  lines.push('- FORGE grades');
  lines.push('- Mutation of TIBER-Data artifacts');
  lines.push('- Patching missing ownership inside TIBER-Fantasy');
  lines.push('');
  lines.push('_TIBER-Fantasy does not invent or override ownership truth. All confidence and warning semantics are preserved verbatim from the upstream artifact._');
  lines.push('');

  return lines.join('\n');
}
