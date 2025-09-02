// Tiber Memory System Routes
import { Router } from 'express';
import { db } from '../db';
import { tiberMemory } from '@shared/schema';
import { eq, ilike, or, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const router = Router();

// GET /api/tiber/memory - Retrieve memories by category or search
router.get('/memory', async (req, res) => {
  try {
    const { category, search, limit = 10 } = req.query;
    
    let query = db.select().from(tiberMemory);
    
    if (category) {
      query = query.where(eq(tiberMemory.category, category as string));
    }
    
    if (search) {
      const searchTerm = `%${search}%`;
      query = query.where(or(
        ilike(tiberMemory.title, searchTerm),
        ilike(tiberMemory.content, searchTerm),
        sql`${search} = ANY(${tiberMemory.tags})`
      ));
    }
    
    const memories = await query
      .orderBy(desc(tiberMemory.lastAccessed), desc(tiberMemory.createdAt))
      .limit(Number(limit));
    
    res.json({
      success: true,
      memories,
      total: memories.length
    });
    
  } catch (error) {
    console.error('Memory retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve memories' });
  }
});

// POST /api/tiber/memory - Store new memory
router.post('/memory', async (req, res) => {
  try {
    const { category, title, content, insights, tags, source, confidence } = req.body;
    
    const newMemory = await db.insert(tiberMemory).values({
      category,
      title,
      content,
      insights: insights || [],
      tags: tags || [],
      source,
      confidence: confidence || 0.8
    }).returning();
    
    res.json({
      success: true,
      memory: newMemory[0],
      message: 'Memory stored successfully'
    });
    
  } catch (error) {
    console.error('Memory storage error:', error);
    res.status(500).json({ error: 'Failed to store memory' });
  }
});

// PUT /api/tiber/memory/:id/access - Update last accessed time
router.put('/memory/:id/access', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.update(tiberMemory)
      .set({ lastAccessed: new Date() })
      .where(eq(tiberMemory.id, Number(id)));
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Memory access update error:', error);
    res.status(500).json({ error: 'Failed to update access time' });
  }
});

// GET /api/tiber/memory/categories - Get all memory categories
router.get('/memory/categories', async (req, res) => {
  try {
    const categories = await db
      .select({ category: tiberMemory.category, count: sql<number>`count(*)` })
      .from(tiberMemory)
      .groupBy(tiberMemory.category)
      .orderBy(sql`count(*) desc`);
    
    res.json({
      success: true,
      categories
    });
    
  } catch (error) {
    console.error('Categories retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
});

// GET /api/tiber/memory/search/:query - Smart search across memories
router.get('/memory/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 5 } = req.query;
    
    // Search across title, content, and tags
    const memories = await db.select()
      .from(tiberMemory)
      .where(or(
        ilike(tiberMemory.title, `%${query}%`),
        ilike(tiberMemory.content, `%${query}%`),
        sql`${query} = ANY(${tiberMemory.tags})`,
        sql`${tiberMemory.insights}::text ILIKE ${'%' + query + '%'}`
      ))
      .orderBy(desc(tiberMemory.confidence), desc(tiberMemory.lastAccessed))
      .limit(Number(limit));
    
    // Update access times for retrieved memories
    if (memories.length > 0) {
      const memoryIds = memories.map(m => m.id);
      await db.update(tiberMemory)
        .set({ lastAccessed: new Date() })
        .where(sql`${tiberMemory.id} = ANY(${memoryIds})`);
    }
    
    res.json({
      success: true,
      query,
      memories: memories.map(memory => ({
        ...memory,
        relevance_score: calculateRelevanceScore(memory, query)
      })),
      total: memories.length
    });
    
  } catch (error) {
    console.error('Memory search error:', error);
    res.status(500).json({ error: 'Failed to search memories' });
  }
});

// Helper function to calculate relevance score
function calculateRelevanceScore(memory: any, query: string): number {
  let score = 0;
  const queryLower = query.toLowerCase();
  
  // Title match (highest weight)
  if (memory.title.toLowerCase().includes(queryLower)) score += 10;
  
  // Content match  
  if (memory.content.toLowerCase().includes(queryLower)) score += 5;
  
  // Tag match
  if (memory.tags.some((tag: string) => tag.toLowerCase().includes(queryLower))) score += 8;
  
  // Confidence multiplier
  score *= memory.confidence;
  
  return Math.round(score * 100) / 100;
}

export default router;