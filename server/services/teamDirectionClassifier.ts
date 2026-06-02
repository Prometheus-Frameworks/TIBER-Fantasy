type TeamDirectionCoverage = { matched: number; total: number; rate: number };
type TeamDirectionEvidenceCoverage = TeamDirectionCoverage & { rookieAlphaMatched: number };

export type TeamDirectionResult = {
  direction: 'contender' | 'rebuild' | 'retool' | 'uncertain';
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  blockers: string[];
  coverage: TeamDirectionCoverage & { forgeMatched: number; rookieAlphaMatched: number };
  evidenceCoverage: TeamDirectionEvidenceCoverage;
  forgeCoverage: TeamDirectionCoverage;
};

export type ClassifierOptions = {
  superflex?: boolean;
};

type ClassifierPlayer = {
  pos?: string | null;
  alpha?: number | null;
  missingReason?: string | null;
  rookieAsset?: unknown;
};

type ClassifierPick = {
  season?: number;
  round?: number;
  source?: string;
};

const COVERAGE_THRESHOLD = 0.5;
const HIGH_CONFIDENCE_COVERAGE = 0.8;
const MIN_HIGH_CONFIDENCE_PLAYERS = 10;

function posAlphas(players: ClassifierPlayer[], pos: string): number[] {
  return players
    .filter((p) => String(p.pos ?? '').toUpperCase() === pos && typeof p.alpha === 'number')
    .map((p) => p.alpha as number);
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

export function classifyTeamDirection(
  rosterPlayers: ClassifierPlayer[],
  picks: ClassifierPick[],
  options: ClassifierOptions = {}
): TeamDirectionResult {
  const { superflex = false } = options;

  const total = rosterPlayers.length;
  const forgeMatched = rosterPlayers.filter((p) => typeof p.alpha === 'number').length;
  const rookieAlphaMatched = rosterPlayers.filter((p) => typeof p.alpha !== 'number' && Boolean(p.rookieAsset)).length;
  const matched = forgeMatched + rookieAlphaMatched;
  const rate = total === 0 ? 0 : matched / total;
  const forgeRate = total === 0 ? 0 : forgeMatched / total;
  const evidenceCoverage = { matched, total, rate, rookieAlphaMatched };
  const forgeCoverage = { matched: forgeMatched, total, rate: forgeRate };
  // Preserve the original additive coverage shape for existing Management consumers.
  const coverage = { ...evidenceCoverage, forgeMatched, rookieAlphaMatched };
  const coverageDetails = { coverage, evidenceCoverage, forgeCoverage };

  if (total === 0) {
    return {
      direction: 'uncertain',
      confidence: 'low',
      reasons: [],
      blockers: ['No roster data — sync your league and select a team first.'],
      ...coverageDetails,
    };
  }

  if (forgeRate < COVERAGE_THRESHOLD) {
    const unmapped = rosterPlayers.filter((p) => p.missingReason === 'unmapped_sleeper_id').length;
    const missingForge = rosterPlayers.filter(
      (p) => p.missingReason === 'missing_forge_row' || p.missingReason === 'alpha_null'
    ).length;
    const blockers = [
      rookieAlphaMatched > 0
        ? `Rookie Alpha covers ${rookieAlphaMatched} asset${rookieAlphaMatched === 1 ? '' : 's'} for visibility, but Team Direction still needs sufficient FORGE scoring coverage before classifying roster strength.`
        : 'Team Direction still needs sufficient FORGE scoring coverage before classifying roster strength.',
      `Only ${forgeMatched} of ${total} roster players have FORGE scoring data (${Math.round(forgeRate * 100)}% coverage). Need ≥ 50% to classify.`,
    ];
    if (unmapped > 0)
      blockers.push(`${unmapped} player${unmapped > 1 ? 's' : ''} not found in the identity map.`);
    if (missingForge > 0)
      blockers.push(
        `${missingForge} player${missingForge > 1 ? 's' : ''} mapped but missing a FORGE row. Re-sync or recompute FORGE grades.`
      );
    return { direction: 'uncertain', confidence: 'low', reasons: [], blockers, ...coverageDetails };
  }

  const matchedPlayers = rosterPlayers.filter((p) => typeof p.alpha === 'number');
  const alphas = matchedPlayers.map((p) => p.alpha as number);

  const totalAlpha = alphas.reduce((s, a) => s + a, 0);
  const avgAlpha = totalAlpha / forgeMatched;

  const sortedAlphas = [...alphas].sort((a, b) => b - a);
  const top3Sum = sortedAlphas.slice(0, 3).reduce((s, a) => s + a, 0);
  const top3Rate = totalAlpha > 0 ? top3Sum / totalAlpha : 0;

  // QB room strength — boosted requirement in Superflex
  const qbAlphas = posAlphas(matchedPlayers, 'QB');
  const qbAlpha = qbAlphas.length > 0 ? Math.max(...qbAlphas) : null;
  const qbAlphaSecondary = qbAlphas.length > 1 ? qbAlphas.sort((a, b) => b - a)[1] : null;
  const qbDataMissing = qbAlpha === null;

  // WR core depth — average alpha across all matched WRs
  const wrAlphas = posAlphas(matchedPlayers, 'WR');
  const wrAvg = avg(wrAlphas);
  const wrDataMissing = wrAlphas.length === 0;

  // TE signal — average alpha across matched TEs
  const teAlphas = posAlphas(matchedPlayers, 'TE');
  const teAvg = avg(teAlphas);
  const teDataMissing = teAlphas.length === 0;

  const pickCount = picks.length;

  const confidence: TeamDirectionResult['confidence'] =
    rate >= HIGH_CONFIDENCE_COVERAGE && matched >= MIN_HIGH_CONFIDENCE_PLAYERS
      ? 'high'
      : rate >= 0.65
        ? 'medium'
        : 'low';

  const reasons: string[] = [];
  const blockers: string[] = [];

  let direction: TeamDirectionResult['direction'];

  if (rookieAlphaMatched > 0) {
    reasons.push(`${rookieAlphaMatched} rookie asset${rookieAlphaMatched > 1 ? 's are' : ' is'} covered by promoted Rookie Alpha context without blending into FORGE scoring.`);
  }

  // ── Contender gate ──
  // Requires strong avg alpha AND a credible QB room.
  // In Superflex: QB data must be present and QB alpha must be strong (QB2 depth also matters).
  // In 1QB: missing QB data is a blocker but does not automatically veto contender; weak QB does.
  const qbContenderThreshold = superflex ? 58 : 52;
  const qbPassesContender = qbAlpha !== null && qbAlpha >= qbContenderThreshold;
  const qbVetosContender = superflex
    ? qbDataMissing || qbAlpha! < qbContenderThreshold
    : qbAlpha !== null && qbAlpha < 46;

  if (avgAlpha >= 60 && !qbVetosContender) {
    direction = 'contender';
    reasons.push(`Strong FORGE alpha across the roster (avg ${fmt(avgAlpha)}).`);

    if (qbPassesContender) {
      if (superflex) {
        reasons.push(
          qbAlphaSecondary !== null && qbAlphaSecondary >= 50
            ? `Deep QB room for Superflex — QB1 alpha ${fmt(qbAlpha!)}, QB2 alpha ${fmt(qbAlphaSecondary)}.`
            : `Strong QB1 for Superflex (alpha ${fmt(qbAlpha!)}).`
        );
      } else {
        reasons.push(
          qbAlpha! >= 60
            ? `Elite QB room anchors the lineup (alpha ${fmt(qbAlpha!)}).`
            : `QB room is serviceable (alpha ${fmt(qbAlpha!)}).`
        );
      }
    } else if (qbDataMissing) {
      blockers.push(
        superflex
          ? 'No QB FORGE data — Superflex leagues heavily depend on QB depth. Confirm QB room quality before acting on this reading.'
          : 'No QB FORGE data available. Verify QB room quality manually.'
      );
    }

    if (top3Rate >= 0.5) reasons.push('Top-3 players drive the majority of roster alpha — strong at the top.');
    if (pickCount >= 3)
      blockers.push(`Holding ${pickCount} future picks. Contender teams typically trade picks for immediate help.`);

    // WR core depth signal
    if (wrDataMissing) {
      blockers.push('No WR FORGE data — WR corps depth cannot be assessed.');
    } else if (wrAvg! < 50) {
      blockers.push(`WR corps is below average (avg alpha ${fmt(wrAvg!)}). Depth at receiver is a limiting factor.`);
    } else if (wrAvg! >= 60) {
      reasons.push(`Strong WR core depth (avg alpha ${fmt(wrAvg!)}).`);
    }

    // TE signal
    if (!teDataMissing && teAvg! >= 58) {
      reasons.push(`Elite TE adds a positional advantage (alpha ${fmt(teAvg!)}).`);
    } else if (!teDataMissing && teAvg! < 42) {
      blockers.push(`TE is a weak spot (avg alpha ${fmt(teAvg!)}). A TE upgrade would broaden the ceiling.`);
    }
  } else if (avgAlpha < 42 || (avgAlpha < 50 && pickCount >= 3)) {
    // ── Rebuild gate ──
    direction = 'rebuild';
    reasons.push(`Below-average FORGE alpha across the roster (avg ${fmt(avgAlpha)}) suggests long-term rebuild.`);
    if (pickCount >= 3) reasons.push(`Holding ${pickCount} future picks signals long-term capital accumulation.`);
    if (avgAlpha >= 42 && avgAlpha < 50)
      blockers.push('Alpha is borderline — re-sync or recompute FORGE grades to confirm rebuild reading.');
    if (top3Rate < 0.45)
      blockers.push('No clear top-end difference-makers. Priority: identify a franchise anchor.');

    // QB in rebuild
    if (qbDataMissing) {
      blockers.push('No QB FORGE data. QB evaluation should be the first step in any rebuild plan.');
    } else if (qbAlpha! < 45) {
      blockers.push(`QB room is below average (alpha ${fmt(qbAlpha!)}). QB is often the rebuild starting point.`);
    }
    if (superflex && qbDataMissing) {
      blockers.push('Superflex leagues require QB depth — acquiring or developing a QB2 is a critical rebuild lever.');
    }

    // WR core depth in rebuild
    if (!wrDataMissing) {
      if (wrAvg! >= 52) {
        reasons.push(`WR corps has above-average depth (avg alpha ${fmt(wrAvg!)}) — a potential trade asset or core piece.`);
      } else if (wrAvg! < 38) {
        blockers.push(`WR corps is very thin (avg alpha ${fmt(wrAvg!)}). Receiver depth needs to be a priority.`);
      }
    }
    // TE in rebuild
    if (!teDataMissing && teAvg! >= 58) {
      reasons.push(`TE is a high-value asset (alpha ${fmt(teAvg!)}) — a tradeable piece in a rebuild.`);
    }
  } else {
    // ── Retool gate ──
    direction = 'retool';
    reasons.push(`Mixed roster signals — neither a clear contender nor a full rebuild (avg alpha ${fmt(avgAlpha)}).`);
    if (pickCount >= 2) reasons.push(`Holding ${pickCount} future picks offers flexibility to move in either direction.`);

    // QB in retool
    if (qbDataMissing) {
      blockers.push(
        superflex
          ? 'No QB FORGE data — in Superflex, QB clarity is critical before deciding which direction to push.'
          : 'No QB FORGE data. QB room quality should inform whether to push toward contending or rebuild.'
      );
    } else if (qbAlpha! < 50) {
      blockers.push(
        superflex
          ? `QB1 alpha (${fmt(qbAlpha!)}) is below the Superflex threshold — upgrading the QB room is the single highest-leverage move.`
          : `QB alpha (${fmt(qbAlpha!)}) is a limiting factor. Upgrading QB is the highest-leverage move.`
      );
    } else if (superflex && qbAlpha! >= 55 && qbAlphaSecondary === null) {
      blockers.push(`Strong QB1 (alpha ${fmt(qbAlpha!)}) but no QB2 data — Superflex value depends on depth.`);
    }

    // WR/TE core depth in retool
    if (!wrDataMissing) {
      if (wrAvg! < 48) {
        blockers.push(`WR corps depth is below average (avg alpha ${fmt(wrAvg!)}). Adding receiver talent is the highest-leverage retool move.`);
        if (top3Rate >= 0.55) {
          reasons.push('Top-end talent exists, but the receiving corps depth behind the starters is thin. Improving WR floor is key.');
        }
      } else if (wrAvg! >= 58) {
        reasons.push(`WR core is a strength (avg alpha ${fmt(wrAvg!)}) — push toward contending if the QB situation improves.`);
      } else {
        reasons.push('No dominant top player at receiver. Adding a true difference-maker would accelerate the transition.');
      }
    } else {
      reasons.push('WR data is incomplete — cannot assess receiver depth.');
    }
    if (!teDataMissing && teAvg! >= 58) {
      reasons.push(`TE is an asset (alpha ${fmt(teAvg!)}) — leverageable for a win-now trade.`);
    } else if (!teDataMissing && teAvg! < 42) {
      blockers.push(`TE is a weak spot (avg alpha ${fmt(teAvg!)}). Consider a TE upgrade as part of a retool plan.`);
    }

    // Veto logic: if qbVetosContender was the reason we're here, flag it clearly
    if (qbVetosContender && !qbDataMissing) {
      blockers.push(
        superflex
          ? `QB room (${fmt(qbAlpha!)}) is below the Superflex contender bar (≥${qbContenderThreshold}). Upgrade QB to unlock contender potential.`
          : `QB room (${fmt(qbAlpha!)}) is below the contender threshold (≥${qbContenderThreshold}). Upgrading QB would lift this team into contender range.`
      );
    }
  }

  // ── Low coverage footnote ──
  if (rate < HIGH_CONFIDENCE_COVERAGE) {
    const unmatchedCount = total - matched;
    blockers.push(
      `${unmatchedCount} roster player${unmatchedCount > 1 ? 's' : ''} still missing FORGE or promoted Rookie Alpha evidence (${Math.round(rate * 100)}% coverage). Confidence is limited.`
    );
  }

  return { direction, confidence, reasons, blockers, ...coverageDetails };
}
