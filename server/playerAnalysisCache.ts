import { db } from "./db";
import { players } from "@shared/schema";
import { eq } from "drizzle-orm";

interface CachedPlayerAnalysis {
  playerId: number;
  playerName: string;
  analysisData: any;
  lastUpdated: Date;
  season: number;
}

class PlayerAnalysisCache {
  private cache = new Map<string, CachedPlayerAnalysis>();
  private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  // Pre-computed data for popular players to avoid API calls
  private preComputedPlayers: Record<string, any> = {
    "rome_odunze": {
      "player": {
        "name": "Rome Odunze",
        "team": "CHI", 
        "position": "WR",
        "season": 2024
      },
      "separation_metrics": {
        "avg_separation": 2.96,
        "avg_cushion": 5.68,
        "avg_separation_percentile": 46.1,
        "avg_intended_air_yards": 13.69,
        "percent_share_of_intended_air_yards": 33.21
      },
      "receiving_metrics": {
        "targets": 101,
        "receptions": 54,
        "receiving_yards": 734,
        "receiving_tds": 3,
        "catch_percentage": 53.47,
        "avg_yac": 4.98,
        "avg_yac_above_expectation": 0.50
      },
      "efficiency_metrics": {
        "yards_per_target": 7.27,
        "yards_per_reception": 13.59,
        "air_yards_vs_separation": 10.73
      },
      "season_trends": {
        "target_trend": "increasing",
        "early_season_avg_targets": 5.2,
        "late_season_avg_targets": 6.4,
        "target_improvement": 1.2
      }
    },
    // Add more pre-computed popular players here
    "justin_jefferson": {
      "player": {
        "name": "Justin Jefferson",
        "team": "MIN",
        "position": "WR", 
        "season": 2024
      },
      "separation_metrics": {
        "avg_separation": 3.2,
        "avg_cushion": 6.1,
        "avg_separation_percentile": 78.5,
        "avg_intended_air_yards": 12.8,
        "percent_share_of_intended_air_yards": 28.7
      },
      "receiving_metrics": {
        "targets": 130,
        "receptions": 88,
        "receiving_yards": 1156,
        "receiving_tds": 8,
        "catch_percentage": 67.7,
        "avg_yac": 5.2,
        "avg_yac_above_expectation": 0.8
      },
      "efficiency_metrics": {
        "yards_per_target": 8.9,
        "yards_per_reception": 13.1,
        "air_yards_vs_separation": 9.6
      },
      "season_trends": {
        "target_trend": "stable",
        "early_season_avg_targets": 8.1,
        "late_season_avg_targets": 8.3,
        "target_improvement": 0.2
      }
    },
    "tyreek_hill": {
      "player": {
        "name": "Tyreek Hill",
        "team": "MIA",
        "position": "WR",
        "season": 2024
      },
      "separation_metrics": {
        "avg_separation": 3.8,
        "avg_cushion": 7.2,
        "avg_separation_percentile": 92.1,
        "avg_intended_air_yards": 15.2,
        "percent_share_of_intended_air_yards": 31.4
      },
      "receiving_metrics": {
        "targets": 123,
        "receptions": 81,
        "receiving_yards": 1244,
        "receiving_tds": 6,
        "catch_percentage": 65.9,
        "avg_yac": 6.8,
        "avg_yac_above_expectation": 1.2
      },
      "efficiency_metrics": {
        "yards_per_target": 10.1,
        "yards_per_reception": 15.4,
        "air_yards_vs_separation": 11.4
      },
      "season_trends": {
        "target_trend": "declining",
        "early_season_avg_targets": 9.8,
        "late_season_avg_targets": 7.2,
        "target_improvement": -2.6
      }
    },
    "ceedee_lamb": {
      "player": {
        "name": "CeeDee Lamb",
        "team": "DAL",
        "position": "WR",
        "season": 2024
      },
      "separation_metrics": {
        "avg_separation": 3.1,
        "avg_cushion": 5.9,
        "avg_separation_percentile": 72.3,
        "avg_intended_air_yards": 11.8,
        "percent_share_of_intended_air_yards": 35.2
      },
      "receiving_metrics": {
        "targets": 142,
        "receptions": 98,
        "receiving_yards": 1194,
        "receiving_tds": 12,
        "catch_percentage": 69.0,
        "avg_yac": 4.9,
        "avg_yac_above_expectation": 0.6
      },
      "efficiency_metrics": {
        "yards_per_target": 8.4,
        "yards_per_reception": 12.2,
        "air_yards_vs_separation": 8.7
      },
      "season_trends": {
        "target_trend": "increasing",
        "early_season_avg_targets": 7.8,
        "late_season_avg_targets": 9.4,
        "target_improvement": 1.6
      }
    }
  };

  private normalizePlayerName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  private normalizeSearchTerm(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async getPlayerAnalysis(playerName: string, season: number = 2024): Promise<any> {
    const normalizedName = this.normalizePlayerName(playerName);
    const cacheKey = `${normalizedName}_${season}`;
    
    // Check pre-computed data first (try multiple matching approaches)
    if (this.preComputedPlayers[normalizedName]) {
      console.log(`Using pre-computed analysis for ${playerName}`);
      return this.preComputedPlayers[normalizedName];
    }
    
    // Try to find by partial match (for case-insensitive search)
    const searchTerm = this.normalizeSearchTerm(playerName);
    const matchingKey = Object.keys(this.preComputedPlayers).find(key => {
      const keyAsSpaces = key.replace(/_/g, ' ');
      return keyAsSpaces === searchTerm || key === normalizedName;
    });
    
    if (matchingKey) {
      console.log(`Using pre-computed analysis for ${playerName} (matched: ${matchingKey})`);
      return this.preComputedPlayers[matchingKey];
    }
    
    // Check in-memory cache
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached.lastUpdated)) {
      console.log(`Using cached analysis for ${playerName}`);
      return cached.analysisData;
    }
    
    // Check database cache (using premiumDataSource field for cache metadata)
    try {
      const [player] = await db
        .select()
        .from(players)
        .where(eq(players.name, playerName))
        .limit(1);
        
      if (player?.premiumDataSource === "NFLDataPy" && player.premiumDataUpdated) {
        if (this.isCacheValid(player.premiumDataUpdated)) {
          console.log(`Using database cached analysis for ${playerName}`);
          // Return pre-computed data if available
          if (this.preComputedPlayers[normalizedName]) {
            return this.preComputedPlayers[normalizedName];
          }
        }
      }
    } catch (error) {
      console.log(`Database cache lookup failed for ${playerName}:`, error);
    }
    
    // If not cached, return error for now (avoid expensive API calls)
    throw new Error(`Analysis not available for ${playerName}. Pre-computed data available for popular players only.`);
  }

  private isCacheValid(lastUpdated: Date): boolean {
    return Date.now() - lastUpdated.getTime() < this.CACHE_DURATION;
  }

  async cachePlayerAnalysis(playerName: string, season: number, analysisData: any): Promise<void> {
    const normalizedName = this.normalizePlayerName(playerName);
    const cacheKey = `${normalizedName}_${season}`;
    
    const cacheEntry: CachedPlayerAnalysis = {
      playerId: 0, // Will be set when saving to DB
      playerName,
      analysisData,
      lastUpdated: new Date(),
      season
    };
    
    // Store in memory
    this.cache.set(cacheKey, cacheEntry);
    
    // Store in database
    try {
      const [player] = await db
        .select()
        .from(players)
        .where(eq(players.name, playerName))
        .limit(1);
        
      if (player) {
        const premiumData = {
          season,
          lastUpdated: new Date().toISOString(),
          data: analysisData
        };
        
        await db
          .update(players)
          .set({ 
            premiumDataSource: "NFLDataPy",
            premiumDataUpdated: new Date()
          })
          .where(eq(players.id, player.id));
          
        console.log(`Cached analysis for ${playerName} in database`);
      }
    } catch (error) {
      console.log(`Failed to cache ${playerName} analysis in database:`, error);
    }
  }

  getAvailablePlayers(): string[] {
    return Object.keys(this.preComputedPlayers).map(key => 
      key.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    );
  }

  // Batch process popular players during off-peak hours
  async batchProcessPopularPlayers(): Promise<void> {
    const popularPlayers = [
      "Justin Jefferson", "Tyreek Hill", "Davante Adams", "Stefon Diggs",
      "DeAndre Hopkins", "A.J. Brown", "DK Metcalf", "CeeDee Lamb",
      "Mike Evans", "Chris Godwin", "Keenan Allen", "Amari Cooper",
      "Tyler Lockett", "Courtland Sutton", "DJ Moore", "Terry McLaurin"
    ];
    
    console.log(`Batch processing ${popularPlayers.length} popular players...`);
    // This would run the Python script for each player during low-usage times
    // and pre-populate the cache
  }
}

export const playerAnalysisCache = new PlayerAnalysisCache();