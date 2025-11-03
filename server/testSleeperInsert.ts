import { db } from './infra/db';
import { players } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function testSleeperInsert() {
  console.log('🧪 Testing Sleeper data insert...');
  
  const testPlayer = {
    name: 'Test Player',
    team: 'NFL',
    position: 'QB',
    avgPoints: 15.5,
    projectedPoints: 16.0,
    ownershipPercentage: 60,
    isAvailable: true,
    upside: 7.5,
    
    // Sleeper fields
    sleeperId: 'test123',
    firstName: 'Test',
    lastName: 'Player',
    fullName: 'Test Player',
    status: 'Active',
    adp: 25.0,
  };

  try {
    // Test insert
    await db.insert(players).values(testPlayer);
    console.log('✅ Test player inserted successfully');
    
    // Test select
    const result = await db.select().from(players).where(eq(players.sleeperId, 'test123'));
    console.log('✅ Test player retrieved:', result[0]?.name);
    
    // Clean up
    await db.delete(players).where(eq(players.sleeperId, 'test123'));
    console.log('✅ Test player cleaned up');
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}