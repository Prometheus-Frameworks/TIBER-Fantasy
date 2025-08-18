import { Router, Request, Response } from 'express';
import { articles, insertArticleSchema, Article } from '../../shared/schema';
import { db } from '../db';
import { eq, desc, sql, and, like, or } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Query schema for filtering articles
const QuerySchema = z.object({
  category: z.string().optional(),
  featured: z.string().transform(val => val === 'true').optional(),
  published: z.string().transform(val => val === 'true').optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/articles
 * Get all articles with optional filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = QuerySchema.parse(req.query);
    
    // Build where conditions
    const conditions = [];
    
    if (query.category) {
      conditions.push(eq(articles.category, query.category));
    }
    
    if (query.featured !== undefined) {
      conditions.push(eq(articles.featured, query.featured));
    }
    
    if (query.published !== undefined) {
      conditions.push(eq(articles.published, query.published));
    }
    
    if (query.search) {
      conditions.push(
        or(
          like(articles.title, `%${query.search}%`),
          like(articles.description, `%${query.search}%`),
          like(articles.content, `%${query.search}%`)
        )
      );
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [articlesList, countResult] = await Promise.all([
      db.select()
        .from(articles)
        .where(whereClause)
        .orderBy(desc(articles.publishDate))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: sql<number>`count(*)` })
        .from(articles)
        .where(whereClause)
    ]);
    
    res.json({
      success: true,
      data: articlesList,
      pagination: {
        total: countResult[0]?.count || 0,
        limit: query.limit,
        offset: query.offset,
        hasMore: (query.offset + query.limit) < (countResult[0]?.count || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch articles' 
    });
  }
});

/**
 * GET /api/articles/categories
 * Get all unique categories
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await db.selectDistinct({ category: articles.category })
      .from(articles)
      .where(eq(articles.published, true));
    
    res.json({
      success: true,
      data: categories.map(c => c.category)
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch categories' 
    });
  }
});

/**
 * GET /api/articles/:slug
 * Get a specific article by slug
 */
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    // Find the article
    const [article] = await db.select()
      .from(articles)
      .where(and(
        eq(articles.slug, slug),
        eq(articles.published, true)
      ));
    
    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }
    
    // Increment view count
    await db.update(articles)
      .set({ viewCount: sql`${articles.viewCount} + 1` })
      .where(eq(articles.id, article.id));
    
    res.json({
      success: true,
      data: { ...article, viewCount: (article.viewCount || 0) + 1 }
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch article' 
    });
  }
});

/**
 * POST /api/articles
 * Create a new article
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = insertArticleSchema.parse(req.body);
    
    const [newArticle] = await db.insert(articles)
      .values(validatedData)
      .returning();
    
    res.status(201).json({
      success: true,
      data: newArticle
    });
  } catch (error) {
    console.error('Error creating article:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid article data',
        details: error.errors
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create article' 
    });
  }
});

/**
 * PUT /api/articles/:id
 * Update an existing article
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const articleId = parseInt(req.params.id);
    const validatedData = insertArticleSchema.partial().parse(req.body);
    
    const [updatedArticle] = await db.update(articles)
      .set({ 
        ...validatedData, 
        lastUpdated: new Date() 
      })
      .where(eq(articles.id, articleId))
      .returning();
    
    if (!updatedArticle) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }
    
    res.json({
      success: true,
      data: updatedArticle
    });
  } catch (error) {
    console.error('Error updating article:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid article data',
        details: error.errors
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update article' 
    });
  }
});

/**
 * DELETE /api/articles/:id
 * Delete an article
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const articleId = parseInt(req.params.id);
    
    const [deletedArticle] = await db.delete(articles)
      .where(eq(articles.id, articleId))
      .returning();
    
    if (!deletedArticle) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Article deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete article' 
    });
  }
});

export default router;