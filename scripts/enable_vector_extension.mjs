import pg from 'pg';
const { Pool } = pg;

async function enableVectorExtension() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Enabling pgvector extension on production database...');
    
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ pgvector extension enabled');
    
    const result = await pool.query(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Verification successful:');
      console.log(`   Extension: ${result.rows[0].extname}`);
      console.log(`   Version: ${result.rows[0].extversion}`);
    } else {
      console.log('⚠️  Extension created but not found in verification');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

enableVectorExtension();
