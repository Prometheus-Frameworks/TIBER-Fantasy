import { seedArticles } from '../services/seedArticles';

/**
 * Initialize database with article data
 */
export async function setupDatabase() {
  try {
    console.log('🔄 Setting up database with article content...');
    await seedArticles();
    console.log('✅ Database setup complete');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  }
}