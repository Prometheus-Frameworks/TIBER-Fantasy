import { db } from '../../../infra/db';
import { sql } from 'drizzle-orm';
import { HAVOC_PRIOR_SNAPS } from '@shared/idpSchema';

export async function computeIdpBaselines(season: number): Promise<number> {
  const result = await db.execute(sql`
    WITH eligible AS (
      SELECT *
      FROM idp_player_season
      WHERE season = ${season} AND total_snaps >= ${HAVOC_PRIOR_SNAPS}
    )
    SELECT
      position_group,
      avg(havoc_smoothed_rate) as havoc_rate_mean,
      stddev_pop(havoc_smoothed_rate) as havoc_rate_std,
      avg((tackles_total::float / NULLIF(total_snaps,0))) as tackles_per_snap_mean,
      stddev_pop((tackles_total::float / NULLIF(total_snaps,0))) as tackles_per_snap_std,
      avg((sacks::float / NULLIF(total_snaps,0))) as sack_rate_mean,
      stddev_pop((sacks::float / NULLIF(total_snaps,0))) as sack_rate_std,
      avg((tackles_for_loss::float / NULLIF(total_snaps,0))) as tfl_rate_mean,
      stddev_pop((tackles_for_loss::float / NULLIF(total_snaps,0))) as tfl_rate_std,
      avg((passes_defended::float / NULLIF(total_snaps,0))) as pd_rate_mean,
      stddev_pop((passes_defended::float / NULLIF(total_snaps,0))) as pd_rate_std,
      count(*) as sample_size
    FROM eligible
    GROUP BY position_group
  `);

  let upserts = 0;
  for (const row of result.rows as Array<Record<string, any>>) {
    await db.execute(sql`
      INSERT INTO idp_position_baselines (
        season, position_group, metric_name, mean_value, std_dev, sample_size
      ) VALUES
      (${season}, ${row.position_group}, 'havoc_raw_rate', ${Number(row.havoc_rate_mean) || 0}, ${Number(row.havoc_rate_std) || 0}, ${Number(row.sample_size) || 0}),
      (${season}, ${row.position_group}, 'tackles_per_snap', ${Number(row.tackles_per_snap_mean) || 0}, ${Number(row.tackles_per_snap_std) || 0}, ${Number(row.sample_size) || 0}),
      (${season}, ${row.position_group}, 'sack_rate', ${Number(row.sack_rate_mean) || 0}, ${Number(row.sack_rate_std) || 0}, ${Number(row.sample_size) || 0}),
      (${season}, ${row.position_group}, 'tfl_rate', ${Number(row.tfl_rate_mean) || 0}, ${Number(row.tfl_rate_std) || 0}, ${Number(row.sample_size) || 0}),
      (${season}, ${row.position_group}, 'pd_rate', ${Number(row.pd_rate_mean) || 0}, ${Number(row.pd_rate_std) || 0}, ${Number(row.sample_size) || 0})
      ON CONFLICT (season, position_group, metric_name) DO UPDATE SET
        mean_value = EXCLUDED.mean_value,
        std_dev = EXCLUDED.std_dev,
        sample_size = EXCLUDED.sample_size
    `);
    upserts += 5;
  }

  return upserts;
}
