import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function seedMinimalData() {
  console.log('🌱 Seeding minimal ratings test data...');
  
  try {
    // Insert sample players
    await pool.query(`
      INSERT INTO player_profile (player_id, name, position, team, age, draft_round, draft_pick)
      VALUES 
        ('jamarr-chase', 'Ja''Marr Chase', 'WR', 'CIN', 24.5, 1, 5),
        ('josh-jacobs', 'Josh Jacobs', 'RB', 'LV', 26.2, 2, 24),
        ('travis-kelce', 'Travis Kelce', 'TE', 'KC', 35.1, 3, 63),
        ('josh-allen', 'Josh Allen', 'QB', 'BUF', 28.3, 1, 7),
        ('tyreek-hill', 'Tyreek Hill', 'WR', 'MIA', 30.1, 5, 165)
      ON CONFLICT (player_id) DO NOTHING
    `);
    
    // Insert sample weekly inputs
    await pool.query(`
      INSERT INTO player_inputs (
        player_id, season, week, position, team,
        snap_pct, routes, tprr, rush_share, target_share,
        goalline_share, two_min_share, yprr, yac_per_rec,
        mtf, succ_rate, epa_per_play_qb, team_epa_play, team_pace
      )
      VALUES 
        ('jamarr-chase', 2024, 6, 'WR', 'CIN', 85.2, 32, 0.28, 0, 28.5, 5.2, 12.1, 2.1, 5.8, 0.15, 0.65, 0.12, 0.08, 65.2),
        ('josh-jacobs', 2024, 6, 'RB', 'LV', 68.1, 8, 0.12, 72.5, 12.8, 85.2, 78.6, 4.2, 3.1, 0.28, 0.48, 0.08, 0.06, 62.8),
        ('travis-kelce', 2024, 6, 'TE', 'KC', 78.9, 28, 0.32, 0, 22.1, 8.5, 15.2, 1.8, 4.2, 0.18, 0.58, 0.15, 0.10, 68.5),
        ('josh-allen', 2024, 6, 'QB', 'BUF', 100, 0, 0, 18.5, 0, 25.2, 35.8, 0, 0, 0.22, 0.52, 0.18, 0.12, 66.1),
        ('tyreek-hill', 2024, 6, 'WR', 'MIA', 82.6, 35, 0.25, 0, 31.2, 2.8, 18.5, 2.3, 6.1, 0.12, 0.62, 0.10, 0.07, 71.2)
      ON CONFLICT (player_id, season, week) DO NOTHING
    `);
    
    // Insert age curves (if not exists)
    await pool.query(`
      INSERT INTO age_curves (position, age, multiplier)
      VALUES 
        ('QB', 24, 0.95), ('QB', 25, 0.98), ('QB', 26, 1.00), ('QB', 27, 1.02), ('QB', 28, 1.00), ('QB', 29, 0.98), ('QB', 30, 0.95),
        ('RB', 22, 0.92), ('RB', 23, 0.98), ('RB', 24, 1.00), ('RB', 25, 1.00), ('RB', 26, 0.95), ('RB', 27, 0.88), ('RB', 28, 0.80),
        ('WR', 23, 0.95), ('WR', 24, 0.98), ('WR', 25, 1.00), ('WR', 26, 1.02), ('WR', 27, 1.00), ('WR', 28, 0.98), ('WR', 29, 0.95),
        ('TE', 24, 0.95), ('TE', 25, 0.98), ('TE', 26, 1.00), ('TE', 27, 1.02), ('TE', 28, 1.00), ('TE', 29, 0.98), ('TE', 30, 0.95)
      ON CONFLICT (position, age) DO NOTHING
    `);
    
    console.log('✅ Minimal test data seeded successfully');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMinimalData();
}