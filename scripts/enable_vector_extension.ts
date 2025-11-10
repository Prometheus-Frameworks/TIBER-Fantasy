import { db } from '../server/infra/db';
import { sql } from 'drizzle-orm';

async function enableVectorExtension() {
  try {
    console.log('🔧 Enabling pgvector extension on production database...');
    
    // Execute the CREATE EXTENSION command
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('✅ pgvector extension enabled');
    
    // Verify installation
    const result = await db.execute(sql`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname = 'vector';
    `);
    
    if (result.rows.length > 0) {
      const ext = result.rows[0] as any;
      console.log('✅ Verification successful:');
      console.log(`   Extension: ${ext.extname}`);
      console.log(`   Version: ${ext.extversion}`);
    } else {
      console.log('⚠️  Extension created but not found in verification');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error enabling pgvector extension:', error);
    process.exit(1);
  }
}

enableVectorExtension();
