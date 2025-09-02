/**
 * Tiber Answer System - Real OTC Power Integration + Memory-Enhanced Intelligence
 * Main answer router using live database queries and learned insights
 */

import { resolvePlayerId, fetchPlayerWeekBundle } from './dataAdapter';
import { decideStartSit, decideTrade, reasonsFromMetrics, contingencies } from './deciders';
import { db } from '../db';
import { tiberMemory } from '@shared/schema';
import { ilike, or, sql, desc } from 'drizzle-orm';
import axios from 'axios';
import type { TiberAsk, TiberAnswer } from './types';

export async function tiberAnswer(ask: TiberAsk): Promise<TiberAnswer> {
  const who = ask.players[0];
  
  // Resolve player name to ID
  const r = await resolvePlayerId(who);
  if (!r) {
    return {
      verdict: 'Unknown Player',
      confidence: 0,
      reasons: [`Could not resolve "${who}" to a player_id`],
      metrics: {},
      tone: 'tiber'
    };
  }
  
  // Fetch comprehensive player data
  const p = await fetchPlayerWeekBundle(r.player_id, ask.season, ask.week);
  if (!p) {
    return {
      verdict: 'No Data',
      confidence: 0,
      reasons: ['No facts for this player/week yet'],
      metrics: { player_id: r.player_id },
      tone: 'tiber'
    };
  }

  let verdict = 'Neutral';
  let confidence = 55;

  // Decision logic based on intent
  if (ask.intent === 'START_SIT' || ask.intent === 'PLAYER_OUTLOOK') {
    const d = decideStartSit(p);
    verdict = d.verdict;
    confidence = d.conf;
  } else if (ask.intent === 'TRADE') {
    const d = decideTrade(p);
    verdict = d.verdict;
    confidence = d.conf;
  } else if (ask.intent === 'WAIVER') {
    if ((p.rag_score ?? 0) >= 66) {
      verdict = 'Claim: High';
      confidence = 70 - (Math.max(0, (p.ceiling_points ?? 0) - (p.floor_points ?? 0)) * 2);
    } else if ((p.rag_score ?? 0) >= 50) {
      verdict = 'Claim: Medium';
      confidence = 60;
    } else {
      verdict = 'Pass';
      confidence = 65;
    }
  } else if (ask.intent === 'RANKING_EXPLAIN') {
    verdict = `Rank ${p.rank ?? '—'} (Power ${p.power_score?.toFixed(1) ?? '—'})`;
    confidence = 60 + Math.min(20, (p.power_score ?? 50) / 8);
  }

  // Build evidence-based reasons and contingencies
  const baseReasons = reasonsFromMetrics(p);
  const cont = contingencies(p);
  
  // Enhanced with Tiber Memory + RAG - add learned insights and enriched takes
  const memoryInsights = await getTiberMemoryInsights(p, ask);
  const ragInsights = await getRagInsights(p, ask);
  const enhancedReasons = [...baseReasons, ...memoryInsights, ...ragInsights];

  return {
    verdict,
    confidence: Math.round(Math.max(0, Math.min(100, confidence))),
    reasons: enhancedReasons,
    contingencies: cont.length ? cont : undefined,
    metrics: {
      player_id: p.player_id,
      name: p.name,
      team: p.team,
      pos: p.position,
      rank: p.rank,
      power_score: p.power_score,
      rag_color: p.rag_color,
      rag_score: p.rag_score,
      expected_points: p.expected_points,
      floor_points: p.floor_points,
      ceiling_points: p.ceiling_points,
      delta_vs_ecr: p.delta_vs_ecr,
      upside_index: p.upside_index,
      beat_proj: p.beat_proj
    },
    tone: 'tiber',
    memory_applied: memoryInsights.length > 0,
    rag_applied: ragInsights.length > 0
  };
}

// Tiber Memory Integration - Search knowledge base for relevant insights
async function getTiberMemoryInsights(p: any, ask: TiberAsk): Promise<string[]> {
  try {
    const insights: string[] = [];
    
    // Search for current season data (highest priority)
    const currentSeasonMemory = await db.select()
      .from(tiberMemory)
      .where(sql`${tiberMemory.category} = '2025_season'`)
      .orderBy(desc(tiberMemory.confidence))
      .limit(1);
    
    if (currentSeasonMemory.length > 0) {
      const seasonData = currentSeasonMemory[0];
      const seasonInsights = Array.isArray(seasonData.insights) ? seasonData.insights : [];
      
      // Check for player-specific current season insights
      for (const insight of seasonInsights) {
        if (insight.toLowerCase().includes(p.name?.toLowerCase()) ||
            insight.toLowerCase().includes(p.team?.toLowerCase()) ||
            (p.position && insight.toLowerCase().includes(p.position.toLowerCase()))) {
          insights.push(`🚨 2025 Intel: ${insight}`);
          break; // Only add one current season insight to avoid clutter
        }
      }
    }
    
    // Search for position-specific insights from training data
    const positionMemory = await db.select()
      .from(tiberMemory)
      .where(or(
        ilike(tiberMemory.content, `%${p.position}%`),
        sql`${p.position?.toLowerCase()} = ANY(${tiberMemory.tags})`
      ))
      .orderBy(desc(tiberMemory.confidence))
      .limit(2);
    
    for (const memory of positionMemory) {
      const memoryInsights = Array.isArray(memory.insights) ? memory.insights : [];
      
      if (memory.category === 'scheme_analysis' && memoryInsights.length > 0) {
        // Add scheme-based insight for this position
        const relevantSchemeInsight = memoryInsights.find((insight: string) => 
          insight.toLowerCase().includes(p.position?.toLowerCase() || '')
        );
        if (relevantSchemeInsight && insights.length < 2) {
          insights.push(`📊 Scheme context: ${relevantSchemeInsight.slice(0, 85)}...`);
        }
      }
      
      if (memory.category === 'draft_analysis' && p.position === 'QB' && insights.length < 2) {
        // Add QB-specific draft pattern for quarterbacks
        const qbInsight = memoryInsights.find((insight: string) => 
          insight.toLowerCase().includes('qb') || insight.toLowerCase().includes('quarterback')
        );
        if (qbInsight) {
          insights.push(`🎯 Pattern: ${qbInsight.slice(0, 90)}...`);
        }
      }
    }
    
    // Update access time for retrieved memories
    if (currentSeasonMemory.length > 0 || positionMemory.length > 0) {
      const allMemoryIds = [...currentSeasonMemory, ...positionMemory].map(m => m.id);
      if (allMemoryIds.length > 0) {
        await db.update(tiberMemory)
          .set({ lastAccessed: new Date() })
          .where(sql`${tiberMemory.id} = ANY(${allMemoryIds})`);
      }
    }
    
    return insights.slice(0, 2); // Limit to 2 memory insights max
    
  } catch (error) {
    console.error('Memory search error:', error);
    return [];
  }
}

// RAG Integration - Get enriched insights from the fantasy football knowledge base
async function getRagInsights(p: any, ask: TiberAsk): Promise<string[]> {
  try {
    const insights: string[] = [];
    
    if (!p.player_id || !p.name) return insights;
    
    // Determine relevant topic based on intent
    let topic = '';
    if (ask.intent === 'PLAYER_OUTLOOK') {
      topic = `${p.position} outlook 2025 season`;
    } else if (ask.intent === 'START_SIT') {
      topic = `start sit ${p.position} weekly`;
    } else if (ask.intent === 'TRADE') {
      topic = `trade value ${p.position}`;
    } else if (ask.intent === 'WAIVER') {
      topic = `waiver wire pickup ${p.position}`;
    }
    
    if (topic) {
      try {
        // Call RAG endpoint to get enriched insights
        const ragResponse = await axios.get(`http://localhost:5000/rag/api/take`, {
          params: {
            player_id: p.player_id,
            topic: topic
          },
          timeout: 2000 // Quick timeout to avoid slowing down responses
        });
        
        if (ragResponse.data && ragResponse.data.take) {
          // Extract key insights from RAG take
          const take = ragResponse.data.take;
          const confidence = ragResponse.data.confidence || 50;
          
          // Add a condensed version of the RAG insight
          if (take.length > 50) {
            insights.push(`📰 RAG: ${take.slice(0, 120)}...`);
          }
          
          // Add confidence boost if RAG is very confident
          if (confidence >= 75) {
            insights.push(`🔥 High-confidence insight (${confidence}% RAG score)`);
          }
        }
        
      } catch (ragError) {
        // Silently fail RAG calls - don't break Tiber if RAG is unavailable
        console.warn('RAG call failed, continuing without:', ragError.message);
      }
    }
    
    return insights.slice(0, 1); // Limit to 1 RAG insight to avoid overwhelming
    
  } catch (error) {
    console.error('RAG integration error:', error);
    return [];
  }
}