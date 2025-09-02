/**
 * Intent Parser - Convert natural language queries to TiberAsk
 * Identifies intent and extracts players from user queries
 */

import type { TiberIntent, TiberAsk } from './types';

export function parseQuery(query: string, season = 2025, week = 1): TiberAsk {
  const lowerQuery = query.toLowerCase();
  
  // Extract player names - simplified approach
  const players = extractPlayerNames(query);
  
  // Determine intent from query patterns
  let intent: TiberIntent = 'PLAYER_OUTLOOK'; // Default
  
  if (lowerQuery.includes('start') || lowerQuery.includes('sit') || lowerQuery.includes('bench') || lowerQuery.includes('lineup')) {
    intent = 'START_SIT';
  } else if (lowerQuery.includes('trade') || lowerQuery.includes('swap') || lowerQuery.includes('deal') || lowerQuery.includes('acquire')) {
    intent = 'TRADE';
  } else if (lowerQuery.includes('waiver') || lowerQuery.includes('claim') || lowerQuery.includes('pickup') || lowerQuery.includes('drop')) {
    intent = 'WAIVER';
  } else if (lowerQuery.includes('rank') || lowerQuery.includes('tier') || lowerQuery.includes('where') || lowerQuery.includes('position')) {
    intent = 'RANKING_EXPLAIN';
  }
  
  // Extract league context
  let leagueType: 'redraft' | 'dynasty' | undefined;
  if (lowerQuery.includes('dynasty')) {
    leagueType = 'dynasty';
  } else if (lowerQuery.includes('redraft')) {
    leagueType = 'redraft';
  }
  
  // Extract scoring format
  let scoring: 'PPR' | 'Half' | 'Standard' | undefined;
  if (lowerQuery.includes('ppr')) {
    scoring = 'PPR';
  } else if (lowerQuery.includes('half')) {
    scoring = 'Half';
  } else if (lowerQuery.includes('standard') || lowerQuery.includes('non-ppr')) {
    scoring = 'Standard';
  }
  
  return {
    intent,
    players: players.length > 0 ? players : ['unknown'],
    week,
    season,
    leagueType,
    scoring
  };
}

function extractPlayerNames(query: string): string[] {
  const players: string[] = [];
  
  // Simple approach - look for capitalized words that might be names
  const words = query.split(/\s+/);
  let currentName = '';
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Check if word starts with capital letter
    const firstChar = word.charAt(0);
    if (firstChar >= 'A' && firstChar <= 'Z') {
      if (currentName) {
        currentName += ' ' + word;
      } else {
        currentName = word;
      }
      
      // If next word doesn't start with capital, we have a complete name
      const nextWord = words[i + 1] || '';
      const nextFirstChar = nextWord.charAt(0);
      if (i === words.length - 1 || !(nextFirstChar >= 'A' && nextFirstChar <= 'Z')) {
        if (currentName && isLikelyPlayerName(currentName)) {
          players.push(currentName);
        }
        currentName = '';
      }
    }
  }
  
  return players.slice(0, 2); // Max 2 players for trade comparisons
}

function isLikelyPlayerName(name: string): boolean {
  // Filter out common non-player words
  const excludeWords = [
    'Should', 'Would', 'Could', 'Will', 'Can', 'Start', 'Sit', 'Trade',
    'Week', 'Season', 'Game', 'Points', 'Dynasty', 'Redraft', 'PPR'
  ];
  
  return !excludeWords.includes(name) && name.length >= 3;
}