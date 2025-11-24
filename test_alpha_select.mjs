import { db } from './server/infra/db.ts';
import { wrRoleBank } from './shared/schema.ts';
import { eq, desc } from 'drizzle-orm';

async function test() {
  const results = await db.select().from(wrRoleBank).where(eq(wrRoleBank.season, 2025)).orderBy(desc(wrRoleBank.roleScore)).limit(1);
  
  console.log('First result:');
  console.log(JSON.stringify(results[0], null, 2));
  
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
