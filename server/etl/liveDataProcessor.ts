/**
 * Live Data Processor for Hot List System
 * 
 * Processes live data from authenticated APIs and updates OVR calculations
 */

import fs from 'fs';
import path from 'path';

interface LiveDataSnapshot {
  timestamp: string;
  week: number;
  source: string;
  playerStats: Record<string, any>;
  processed: boolean;
}

export class LiveDataProcessor {
  private dataDir = path.join(process.cwd(), 'live_data');

  constructor() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Fetch and process live player statistics
   */
  async processLiveStats(): Promise<{ success: boolean; players: number; source: string }> {
    console.log('🔄 Processing live player statistics...');

    try {
      // Use Sleeper as primary source (free, reliable)
      const sleeperStats = await this.fetchSleeperWeeklyStats();
      
      if (sleeperStats.success) {
        console.log(`✅ Processed ${sleeperStats.players} players from Sleeper`);
        return sleeperStats;
      }

      // Fallback to static captures if live fails
      return await this.processStaticFallback();
      
    } catch (error) {
      console.error('❌ Live processing failed:', error);
      return { success: false, players: 0, source: 'error' };
    }
  }

  /**
   * Fetch current week statistics from Sleeper
   */
  private async fetchSleeperWeeklyStats(): Promise<{ success: boolean; players: number; source: string }> {
    try {
      // Get current NFL week (approximate for testing)
      const currentWeek = this.getCurrentNFLWeek();
      
      console.log(`📊 Fetching Sleeper stats for week ${currentWeek}...`);
      
      // Fetch stats for key positions
      const positions = ['WR', 'RB', 'TE', 'QB'];
      let totalPlayers = 0;
      
      for (const position of positions) {
        const statsUrl = `https://api.sleeper.app/v1/stats/nfl/regular/2024/${currentWeek}`;
        const response = await fetch(statsUrl);
        
        if (response.ok) {
          const stats = await response.json();
          const positionPlayers = Object.keys(stats).length;
          totalPlayers += positionPlayers;
          
          // Save weekly snapshot
          await this.saveWeeklySnapshot({
            timestamp: new Date().toISOString(),
            week: currentWeek,
            source: 'sleeper',
            playerStats: stats,
            processed: true
          }, `sleeper_week_${currentWeek}_${position.toLowerCase()}.json`);
        }
      }
      
      return {
        success: totalPlayers > 0,
        players: totalPlayers,
        source: 'sleeper_live'
      };
      
    } catch (error) {
      console.error('Sleeper fetch failed:', error);
      return { success: false, players: 0, source: 'sleeper_error' };
    }
  }

  /**
   * Use static captures as fallback when live APIs unavailable
   */
  private async processStaticFallback(): Promise<{ success: boolean; players: number; source: string }> {
    console.log('📁 Using static captures as fallback...');
    
    const capturesDir = path.join(process.cwd(), 'static_captures');
    
    if (!fs.existsSync(capturesDir)) {
      return { success: false, players: 0, source: 'no_fallback' };
    }
    
    const captures = fs.readdirSync(capturesDir).filter(f => f.includes('players') && f.endsWith('.json'));
    
    if (captures.length === 0) {
      return { success: false, players: 0, source: 'no_player_data' };
    }
    
    // Use the most recent player capture
    const latestCapture = captures.sort().reverse()[0];
    const capturePath = path.join(capturesDir, latestCapture);
    const captureData = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
    
    const playerCount = captureData.data?.players?.length || 0;
    
    console.log(`📋 Using static fallback: ${playerCount} players from ${latestCapture}`);
    
    return {
      success: playerCount > 0,
      players: playerCount,
      source: `static_${latestCapture}`
    };
  }

  /**
   * Get current NFL week (simplified calculation)
   */
  private getCurrentNFLWeek(): number {
    const now = new Date();
    const seasonStart = new Date('2024-09-05'); // Approximate 2024 season start
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    // Clamp between 1-18 for regular season
    return Math.max(1, Math.min(18, weeksSinceStart + 1));
  }

  /**
   * Save weekly data snapshot
   */
  private async saveWeeklySnapshot(snapshot: LiveDataSnapshot, filename: string): Promise<void> {
    const filepath = path.join(this.dataDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
    console.log(`💾 Saved ${filename}`);
  }

  /**
   * Get processing status
   */
  getProcessingStatus(): { 
    lastUpdate: string | null; 
    availableSnapshots: string[];
    staticFallbacks: string[];
  } {
    const snapshots = fs.existsSync(this.dataDir) 
      ? fs.readdirSync(this.dataDir).filter(f => f.endsWith('.json'))
      : [];
      
    const capturesDir = path.join(process.cwd(), 'static_captures');
    const fallbacks = fs.existsSync(capturesDir)
      ? fs.readdirSync(capturesDir).filter(f => f.includes('players'))
      : [];

    // Get most recent snapshot timestamp
    let lastUpdate = null;
    if (snapshots.length > 0) {
      const latestSnapshot = snapshots.sort().reverse()[0];
      const snapshotPath = path.join(this.dataDir, latestSnapshot);
      try {
        const data = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
        lastUpdate = data.timestamp;
      } catch {}
    }

    return {
      lastUpdate,
      availableSnapshots: snapshots,
      staticFallbacks: fallbacks
    };
  }
}