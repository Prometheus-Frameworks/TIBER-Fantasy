import { createHash } from 'node:crypto';
import { z } from 'zod';

const count = z.number().int().min(0).max(1_000_000).nullable();
const yards = z.number().int().min(-1_000_000).max(1_000_000).nullable();
const fields = z.object({
  completions: count, attempts: count, passing_yards: yards, passing_tds: count,
  passing_interceptions: count, sacks_suffered: count, carries: count, rushing_yards: yards,
  rushing_tds: count, receptions: count, targets: count, receiving_yards: yards,
  receiving_tds: count, fumbles_lost_total: count,
}); // Explicit allowlist: air yards remain upstream audit-only.
const scopeSchema = z.object({ season: z.number().int().min(1900).max(2200),
  season_type: z.literal('REG'), week: z.number().int().min(1).max(18) });
const identity = scopeSchema.extend({ game_id: z.string().min(1).max(80),
  team: z.string().min(1).max(8), opponent_team: z.string().min(1).max(8),
  player_id: z.string().regex(/^00-\d{7}$/), player_name: z.string().max(200).nullable(),
  position: z.string().max(16).nullable() });
const shareSchema = z.object({ numerator: count, denominator: count, value: z.number().min(0).max(1).nullable(),
  status: z.enum(['available', 'unavailable']), reason: z.string().nullable() });
const rowSchema = z.object({identity, source: z.literal('nflverse_stats_player'), source_csv_row: z.number().int().min(2),
  observed: fields, derived: z.object({ carries_plus_targets: count,
    target_share_credited_team_targets: shareSchema, carry_share_all_team_carries: shareSchema }) });
const envelopeSchema = z.object({schema_version: z.literal('weekly_boxscore_publication_candidate_v0'),
  status: z.literal('candidate_needs_review'), consumer_admitted: z.literal(false),
  source_receipt_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  builder_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  fact_builder_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  schedule_receipt: z.object({schema_version:z.literal('weekly_schedule_source_candidate_v0'),
    status:z.literal('unadmitted_schedule_snapshot'),source_family:z.literal('nflverse/nflverse-data/schedules'),
    source_url:z.literal('https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv'),
    source_support_commit:z.string().regex(/^[0-9a-f]{40}$/),asset_id:z.number().int().positive(),
    sha256:z.string().regex(/^[0-9a-f]{64}$/),byte_count:z.number().int().positive(),
    release_asset_updated_at:z.string(),retrieval_started_at:z.string(),retrieval_completed_at:z.string(),
    release_digest_matched:z.literal(true),attribution:z.object({name:z.literal('nflverse contributors'),
      license:z.literal('CC BY 4.0'),license_url:z.literal('https://creativecommons.org/licenses/by/4.0/'),
      license_source_url:z.string().url(),license_sha256:z.string().regex(/^[0-9a-f]{64}$/)}),
    limitations:z.array(z.string())}).nullable(),
  coverage: z.object({observed_game_ids: z.array(z.string()).max(16), scheduled_game_ids: z.array(z.string()).max(16).nullable(),
    missing_game_ids: z.array(z.string()).max(16).nullable(), unexpected_game_ids: z.array(z.string()).max(16).nullable(),
    schedule_coverage: z.enum(['unavailable','matched','partial_or_conflicting']), game_finality: z.literal('unknown'),
    full_week_final: z.literal(false), reason: z.string()}),
  candidate: z.object({schema_version: z.literal('weekly_boxscore_candidate_v0'),
    status: z.literal('candidate_needs_review'), consumer_admitted: z.literal(false), scope: scopeSchema,
    source_support_commit: z.string().regex(/^[0-9a-f]{40}$/), snapshot_compiled_at: z.string(),
    source_receipt: z.object({schema_version: z.literal('weekly_boxscore_source_receipt_candidate_v0'),
      status: z.literal('unadmitted_candidate_source_snapshot'),
      attribution: z.object({name:z.literal('nflverse contributors'),license:z.literal('CC BY 4.0'),
        license_url:z.literal('https://creativecommons.org/licenses/by/4.0/'),notice:z.string()}),
      sources: z.object({player:z.object({source_url:z.string().url(),sha256:z.string().regex(/^[0-9a-f]{64}$/),
        release_asset_updated_at:z.string(),retrieval_completed_at:z.string()}),
        team:z.object({source_url:z.string().url(),sha256:z.string().regex(/^[0-9a-f]{64}$/),
          release_asset_updated_at:z.string(),retrieval_completed_at:z.string()})})}),
    players: z.array(rowSchema).max(3000), limitations: z.array(z.string()), unavailable: z.array(z.string()) }) });

type Row = z.infer<typeof rowSchema>;
type Level = 'strong' | 'low' | 'middle' | 'unknown';
export const WEEKLY_POLICY = Object.freeze({version:'target_involvement_full_ppr_v0',
  receiving_axis:'target involvement; route participation unavailable',
  scoring:'1/reception + 0.1/rush or receiving yard + 6/rush or receiving TD - 2/lost fumble; no bonuses, TE premium or two-point conversions',
  qb_scoring:'4/passing TD + 0.04/passing yard - 2/interception, plus rushing/receiving rules',
  wr:{strong_target_share:0.20,low_target_share_below:0.15,high_points:15,low_points_below:8},
  te:{strong_target_share:0.15,low_target_share_below:0.10,high_points:12,low_points_below:6},
  rb:{strong_carries_plus_targets:15,low_carries_plus_targets_at_most:8,high_points:15,low_points_below:8},
  interpretation:'Exploratory descriptive thresholds, not validated predictive rules.'});

function score(row: Row): number | null {
  const o=row.observed;
  const required=[o.receptions,o.rushing_yards,o.receiving_yards,o.rushing_tds,o.receiving_tds,o.fumbles_lost_total];
  if(row.identity.position==='QB') required.push(o.passing_yards,o.passing_tds,o.passing_interceptions);
  if(required.some(v=>v===null)) return null;
  let result=o.receptions! + .1*(o.rushing_yards!+o.receiving_yards!) + 6*(o.rushing_tds!+o.receiving_tds!) -2*o.fumbles_lost_total!;
  if(row.identity.position==='QB') result+=.04*o.passing_yards!+4*o.passing_tds!-2*o.passing_interceptions!;
  return Math.round(result*100)/100;
}
function describe(row:Row) {
  const position=row.identity.position;
  const points=score(row);
  let involvement:Level='unknown';
  const target=row.derived.target_share_credited_team_targets;
  if(position==='RB' && row.derived.carries_plus_targets!==null){
    const n=row.derived.carries_plus_targets;
    involvement=n>=15?'strong':n<=8?'low':'middle';
  } else if((position==='WR'||position==='TE')&&target.status==='available'&&target.value!==null){
    const high=position==='WR'?.20:.15, low=position==='WR'?.15:.10;
    involvement=target.value>=high?'strong':target.value<low?'low':'middle';
  }
  const scoring=points===null?'unknown':points>=(position==='TE'?12:15)?'high':points<(position==='TE'?6:8)?'low':'middle';
  const bucket=position==='QB'?'qb_separate':involvement==='unknown'||scoring==='unknown'?'insufficient_evidence':
    involvement==='middle'||scoring==='middle'?'mixed_or_borderline':`${involvement}_usage_${scoring}_scoring`;
  const o=row.observed;
  const tdPoints=o.rushing_tds===null||o.receiving_tds===null||(position==='QB'&&o.passing_tds===null)?null:
    6*(o.rushing_tds+o.receiving_tds)+(position==='QB'?4*o.passing_tds!:0);
  return {...row,derived:{...row.derived,generic_full_ppr:points,td_points:tdPoints},
    classification:{involvement:position==='QB'?'not_applied':involvement,scoring:position==='QB'?'not_applied':scoring,bucket},
    unavailable_context:['routes','snap_share','first_read_share','inside_five_work','injury_context',
      'game_script','dropbacks','designed_runs','scrambles']};
}

/** Offline review only. A hash supplied here is integrity, never admission authority. */
export function inspectWeeklyCandidate(raw:Buffer, expectedSha256:string, season:number, week:number){
  if(raw.length>5_000_000||! /^[0-9a-f]{64}$/.test(expectedSha256)||createHash('sha256').update(raw).digest('hex')!==expectedSha256)
    throw new Error('Weekly candidate integrity failure');
  const e=envelopeSchema.parse(JSON.parse(raw.toString('utf8')));
  const c=e.candidate;
  if ((e.schedule_receipt===null)!==(e.coverage.schedule_coverage==='unavailable')) throw new Error('Schedule provenance missing');
  if(c.scope.season!==season||c.scope.week!==week) throw new Error('Weekly scope mismatch');
  const keys=new Set<string>();
  for(const row of c.players){
    const i=row.identity, o=row.observed;
    const key=JSON.stringify([i.game_id,i.team,i.player_id]);
    if(i.season!==season||i.week!==week||!e.coverage.observed_game_ids.includes(i.game_id)||keys.has(key)) throw new Error('Weekly identity conflict');
    keys.add(key);
    if(row.derived.carries_plus_targets!==(o.carries===null||o.targets===null?null:o.carries+o.targets)) throw new Error('Opportunity mismatch');
    for(const [field,share] of [['targets',row.derived.target_share_credited_team_targets],['carries',row.derived.carry_share_all_team_carries]] as const){
      if(share.numerator!==o[field] || (share.status==='available' && (share.reason!==null || share.numerator===null || share.denominator===null ||share.denominator<=0 || share.value!==share.numerator/share.denominator)) || (share.status==='unavailable'&&share.value!==null)) throw new Error('Share mismatch');
    }
  }
  return {schema_version:'tiber_weekly_review_preview_v0',status:'preview_not_admitted',consumer_admitted:false,
    scope:c.scope,coverage:e.coverage,policy:WEEKLY_POLICY,source_artifact_sha256:expectedSha256,
    source_support_commit:c.source_support_commit,source_receipt:c.source_receipt,
    schedule_receipt:e.schedule_receipt,source_receipt_sha256:e.source_receipt_sha256,
    builder_sha256:e.builder_sha256,fact_builder_sha256:e.fact_builder_sha256,
    snapshot_compiled_at:c.snapshot_compiled_at,limitations:c.limitations,
    players:c.players.filter(r=>['QB','RB','WR','TE'].includes(r.identity.position??'')).map(describe)};
}

/** Deliberately no admission pin or activation flag in this preparation slice. */
export function weeklyEvidenceFor(season:number,week:number){
  scopeSchema.parse({season,week,season_type:'REG'});
  return {schema_version:'tiber_weekly_evidence_v0',status:'unavailable',scope:{season,week,season_type:'REG'},
    reason:'Weekly evidence has not been admitted for Team.',players:[],consumer_admitted:false};
}
