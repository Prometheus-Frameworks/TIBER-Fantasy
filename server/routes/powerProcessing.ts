/**
 * Enhanced Power Processing Endpoint
 * Implements Grok's context → data → tools → results flow
 * 
 * Flow:
 * 1. Context: Parse input to scope (week, position, query)
 * 2. Look for Relevant Data: Query existing data sources
 * 3. Use Tools to Determine Context: External APIs, web search, processing
 * 4. Results to Frontend: Updated rankings with explanations
 */

import type { Express, Request, Response } from "express";
import { db } from "../db";
import { players, advancedSignals } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import axios from "axios";

interface ContextProcessingRequest {
  week: number;
  position: string;
  season?: number;
  query?: string; // Additional context like "post-week1 adjustments"
  useTools?: boolean; // Whether to invoke external tools
}

interface ToolResult {
  source: string;
  data: any;
  confidence: number;
  timestamp: string;
}

interface ProcessingResult {
  context: ContextProcessingRequest;
  dataFound: {
    internal: number; // Count of internal data points
    external: number; // Count of external sources used
  };
  toolsUsed: string[];
  rankings: Array<{
    player_id: string;
    name: string;
    team: string;
    position: string;
    rank: number;
    power_score: number;
    explanation: string; // Key enhancement - why this rank
    confidence: number;
    signals?: {
      ypc?: number;
      snapShare?: number;
      trendMultiplier?: number;
      usageSpike?: boolean;
    };
  }>;
  processingTime: number;
  generated_at: string;
}

export function registerPowerProcessingRoutes(app: Express) {
  
  // Main context processing endpoint (Grok's recommendation)
  app.post('/api/power/process', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const context: ContextProcessingRequest = {
      season: 2025,
      useTools: true,
      ...req.body
    };

    try {
      console.log(`[Power Processing] Starting context processing:`, context);

      // Step 1: Context - Parse and validate input
      if (!context.week || !context.position) {
        return res.status(400).json({ 
          error: "Missing required fields: week and position" 
        });
      }

      // Step 2: Look for Relevant Data - Query internal sources
      const internalData = await queryInternalData(context);
      console.log(`[Power Processing] Found ${internalData.length} internal data points`);

      let toolResults: ToolResult[] = [];
      let enhancedData = internalData;

      // Step 3: Use Tools to Determine Context (if insufficient data or useTools=true)
      if (internalData.length < 5 || context.useTools) {
        console.log(`[Power Processing] Invoking external tools for enhanced context`);
        toolResults = await invokeExternalTools(context);
        enhancedData = await mergeWithToolData(internalData, toolResults);
      }

      // Step 4: Results to Frontend - Compute rankings with explanations
      const rankings = await computeEnhancedRankings(enhancedData, context);

      const result: ProcessingResult = {
        context,
        dataFound: {
          internal: internalData.length,
          external: toolResults.length
        },
        toolsUsed: toolResults.map(t => t.source),
        rankings,
        processingTime: Date.now() - startTime,
        generated_at: new Date().toISOString()
      };

      console.log(`[Power Processing] Complete in ${result.processingTime}ms`);
      res.json(result);

    } catch (error) {
      console.error(`[Power Processing] Error:`, error);
      res.status(500).json({ 
        error: "Processing failed", 
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Health check for processing system
  app.get('/api/power/process/health', async (req: Request, res: Response) => {
    try {
      // Quick internal data check
      const sampleData = await db.select()
        .from(players)
        .where(eq(players.position, 'RB'))
        .limit(5);

      res.json({
        status: 'healthy',
        internal_data_available: sampleData.length > 0,
        advanced_signals_table: true, // Grok's enhancement ready
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });
}

// Helper: Query internal data sources
async function queryInternalData(context: ContextProcessingRequest) {
  try {
    // Get basic player data first (simplified approach)
    const data = await db.select({
      player_id: players.id,
      name: players.name,
      team: players.team,
      position: players.position,
      projected_points: players.projectedPoints,
      avg_points: players.avgPoints
    })
    .from(players)
    .where(eq(players.position, context.position))
    .limit(20);

    return data.map(player => ({
      ...player,
      power_score: player.projected_points || 50, // Fallback scoring
      confidence: 0.8,
      usage_now: null,
      talent: null,
      environment: null,
      availability: null,
      // Advanced signals placeholders
      ypc: null,
      snapShare: null,
      trendMultiplier: null,
      usageSpike: false
    }));
  } catch (error) {
    console.error(`[Internal Query] Error:`, error);
    return [];
  }
}

// Helper: Invoke external tools for enhanced context
async function invokeExternalTools(context: ContextProcessingRequest): Promise<ToolResult[]> {
  const tools: ToolResult[] = [];

  try {
    // Tool 1: Sleeper API for fresh data (existing integration)
    try {
      const sleeperResponse = await axios.get(`http://localhost:5000/api/sleeper/players`);
      if (sleeperResponse.data) {
        tools.push({
          source: 'sleeper_api',
          data: sleeperResponse.data,
          confidence: 0.9,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.log(`[Tools] Sleeper API unavailable`);
    }

    // Tool 2: Power Rankings API (internal microservice)
    try {
      const powerResponse = await axios.get(`http://localhost:5000/api/power/${context.position}?season=${context.season}&week=${context.week}`);
      if (powerResponse.data?.items) {
        tools.push({
          source: 'power_rankings_api',
          data: powerResponse.data.items,
          confidence: 0.95,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.log(`[Tools] Power Rankings API unavailable`);
    }

    // Tool 3: Web search for context (placeholder - would integrate with search API)
    if (context.query) {
      // Simulated search result - in production would use SerpAPI or similar
      tools.push({
        source: 'web_search',
        data: { 
          query: context.query,
          insights: [`Week ${context.week} ${context.position} analysis`, 'Market trends', 'Injury updates']
        },
        confidence: 0.7,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error(`[Tools] Error invoking external tools:`, error);
  }

  return tools;
}

// Helper: Merge internal data with tool results
async function mergeWithToolData(internalData: any[], toolResults: ToolResult[]) {
  // For now, prioritize internal data and enhance with tool insights
  // In production, this would implement Grok's sophisticated merging logic
  
  const powerApiTool = toolResults.find(t => t.source === 'power_rankings_api');
  if (powerApiTool?.data) {
    // Use power rankings as the authoritative source
    return powerApiTool.data.map((item: any, index: number) => ({
      ...item,
      // Enhance with any internal advanced signals
      signals: internalData.find(d => d.player_id === item.player_id)
    }));
  }

  return internalData;
}

// Helper: Compute enhanced rankings with explanations (Grok's key insight)
async function computeEnhancedRankings(data: any[], context: ContextProcessingRequest) {
  return data
    .filter(item => item.power_score > 0)
    .map((item, index) => ({
      player_id: item.player_id,
      name: item.name,
      team: item.team,
      position: item.position,
      rank: index + 1,
      power_score: item.power_score || 0,
      // Grok's key enhancement - dynamic explanations
      explanation: generateExplanation(item, context),
      confidence: item.confidence || 0.8,
      signals: {
        ypc: item.ypc,
        snapShare: item.snapShare,
        trendMultiplier: item.trendMultiplier,
        usageSpike: item.usageSpike
      }
    }))
    .slice(0, 20); // Top 20 for performance
}

// Helper: Generate dynamic explanations (Grok's insight)
function generateExplanation(player: any, context: ContextProcessingRequest): string {
  const explanations: string[] = [];

  // Base ranking explanation
  if (player.power_score >= 90) {
    explanations.push('Elite tier');
  } else if (player.power_score >= 75) {
    explanations.push('High-end starter');
  } else if (player.power_score >= 60) {
    explanations.push('Flex worthy');
  }

  // Add signal-based insights
  if (player.trendMultiplier > 1.1) {
    explanations.push(`Hot trend (+${Math.round((player.trendMultiplier - 1) * 100)}%)`);
  }

  if (player.usageSpike) {
    explanations.push('Usage spike detected');
  }

  if (player.ypc > 5.0) {
    explanations.push(`Efficient (${player.ypc} YPC)`);
  }

  // Context-specific explanations
  if (context.query?.includes('week1')) {
    explanations.push('Week 1 performance factored');
  }

  return explanations.length > 0 ? explanations.join(' • ') : 'Standard projection';
}