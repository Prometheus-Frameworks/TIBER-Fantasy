import fs from 'fs';
import path from 'path';
import { sleeperSnapService } from './sleeperSnapService';

interface NormalizedSnapData {
  player_name: string;
  snap_percentages: {
    [key: string]: number; // week_1 through week_17
  };
  metadata: {
    source: 'sleeper_api' | 'generated' | 'external_api';
    last_updated: string;
    total_weeks: number;
    avg_snap_pct: number;
    active_weeks: number;
  };
}

export class SleeperSnapPipeline {
  private outputPath: string;
  private backupPath: string;

  constructor() {
    this.outputPath = path.join(process.cwd(), 'server/data/sleeper_wr_snap_percentages_2024.json');
    this.backupPath = path.join(process.cwd(), 'server/data/backup_wr_snap_percentages_2024.json');
  }

  /**
   * Main pipeline execution - fetch, normalize, and store snap data
   */
  async executePipeline(position: string = 'WR'): Promise<{
    success: boolean;
    source: string;
    playerCount: number;
    totalDataPoints: number;
    message: string;
  }> {
    try {
      console.log(`🚀 Starting Sleeper snap percentage pipeline for ${position}...`);
      
      // Step 1: Check Sleeper API availability and snap data
      const serviceStatus = await sleeperSnapService.getServiceStatus();
      console.log(`📊 Service Status:`, serviceStatus);
      
      // Step 2: Fetch snap percentage data
      const rawSnapData = await sleeperSnapService.fetchSleeperSnapPercentages(position);
      
      if (rawSnapData.length === 0) {
        throw new Error('No snap percentage data available from any source');
      }
      
      // Step 3: Normalize the data
      const normalizedData = await this.normalizeSnapData(rawSnapData, serviceStatus);
      
      // Step 4: Validate data quality
      const validation = this.validateSnapData(normalizedData);
      
      if (!validation.isValid) {
        throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Step 5: Store the data
      await this.storeSnapData(normalizedData);
      
      // Step 6: Create backup
      await this.createBackup(normalizedData);
      
      const totalDataPoints = normalizedData.length * 17; // 17 weeks per player
      
      console.log(`✅ Pipeline completed successfully:`);
      console.log(`   Players: ${normalizedData.length}`);
      console.log(`   Data points: ${totalDataPoints}`);
      console.log(`   Source: ${normalizedData[0]?.metadata.source || 'unknown'}`);
      
      return {
        success: true,
        source: normalizedData[0]?.metadata.source || 'unknown',
        playerCount: normalizedData.length,
        totalDataPoints: totalDataPoints,
        message: `Successfully processed ${normalizedData.length} ${position}s with ${totalDataPoints} data points`
      };
      
    } catch (error) {
      console.error('❌ Pipeline execution failed:', error);
      
      return {
        success: false,
        source: 'error',
        playerCount: 0,
        totalDataPoints: 0,
        message: error instanceof Error ? error.message : 'Unknown pipeline error'
      };
    }
  }

  /**
   * Normalize raw snap data with metadata
   */
  private async normalizeSnapData(
    rawData: any[], 
    serviceStatus: any
  ): Promise<NormalizedSnapData[]> {
    console.log('🔄 Normalizing snap percentage data...');
    
    const normalizedData: NormalizedSnapData[] = [];
    
    for (const player of rawData) {
      // Calculate metadata
      const snapValues = Object.values(player.snap_percentages) as number[];
      const activeWeeks = snapValues.filter(snap => snap > 0).length;
      const avgSnapPct = activeWeeks > 0 ? 
        Math.round(snapValues.reduce((sum, snap) => sum + snap, 0) / snapValues.length) : 0;
      
      // Determine data source
      let source: 'sleeper_api' | 'generated' | 'external_api' = 'generated';
      if (serviceStatus.hasSnapData && serviceStatus.sleeperApiActive) {
        source = 'sleeper_api';
      } else if (!serviceStatus.sleeperApiActive) {
        source = 'external_api';
      }
      
      const normalizedPlayer: NormalizedSnapData = {
        player_name: player.player_name,
        snap_percentages: player.snap_percentages,
        metadata: {
          source: source,
          last_updated: new Date().toISOString(),
          total_weeks: 17,
          avg_snap_pct: avgSnapPct,
          active_weeks: activeWeeks
        }
      };
      
      normalizedData.push(normalizedPlayer);
    }
    
    console.log(`✅ Normalized ${normalizedData.length} players`);
    return normalizedData;
  }

  /**
   * Validate snap percentage data quality
   */
  private validateSnapData(data: NormalizedSnapData[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    console.log('🔍 Validating snap percentage data...');
    
    // Check if we have data
    if (data.length === 0) {
      errors.push('No player data available');
      return { isValid: false, errors, warnings };
    }
    
    // Validate each player
    for (const player of data) {
      // Check player name
      if (!player.player_name || player.player_name.trim() === '') {
        errors.push(`Player missing name: ${JSON.stringify(player)}`);
        continue;
      }
      
      // Check snap percentages structure
      const weeks = Object.keys(player.snap_percentages);
      if (weeks.length !== 17) {
        errors.push(`${player.player_name}: Expected 17 weeks, got ${weeks.length}`);
      }
      
      // Validate week format and values
      for (let week = 1; week <= 17; week++) {
        const weekKey = `week_${week}`;
        
        if (!(weekKey in player.snap_percentages)) {
          errors.push(`${player.player_name}: Missing ${weekKey}`);
        } else {
          const snapPct = player.snap_percentages[weekKey];
          
          if (typeof snapPct !== 'number') {
            errors.push(`${player.player_name} ${weekKey}: Invalid snap percentage type`);
          } else if (snapPct < 0 || snapPct > 100) {
            errors.push(`${player.player_name} ${weekKey}: Snap percentage out of range (${snapPct})`);
          }
        }
      }
      
      // Warnings for unusual patterns
      if (player.metadata.active_weeks === 0) {
        warnings.push(`${player.player_name}: No active weeks (all 0% snaps)`);
      } else if (player.metadata.active_weeks < 5) {
        warnings.push(`${player.player_name}: Low activity (${player.metadata.active_weeks} active weeks)`);
      }
    }
    
    const isValid = errors.length === 0;
    
    console.log(`📋 Validation complete: ${isValid ? 'PASSED' : 'FAILED'}`);
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Warnings: ${warnings.length}`);
    
    return { isValid, errors, warnings };
  }

  /**
   * Store normalized snap data to file
   */
  private async storeSnapData(data: NormalizedSnapData[]): Promise<void> {
    try {
      console.log('💾 Storing snap percentage data...');
      
      // Ensure directory exists
      const dir = path.dirname(this.outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write the data
      fs.writeFileSync(this.outputPath, JSON.stringify(data, null, 2));
      
      console.log(`✅ Snap data stored: ${this.outputPath}`);
      
    } catch (error) {
      console.error('❌ Error storing snap data:', error);
      throw error;
    }
  }

  /**
   * Create backup of existing data
   */
  private async createBackup(data: NormalizedSnapData[]): Promise<void> {
    try {
      console.log('💾 Creating backup...');
      
      const backupData = {
        backup_timestamp: new Date().toISOString(),
        player_count: data.length,
        data_source: data[0]?.metadata.source || 'unknown',
        snap_data: data
      };
      
      fs.writeFileSync(this.backupPath, JSON.stringify(backupData, null, 2));
      
      console.log(`✅ Backup created: ${this.backupPath}`);
      
    } catch (error) {
      console.error('❌ Error creating backup:', error);
      // Don't throw - backup failure shouldn't stop the pipeline
    }
  }

  /**
   * Load stored snap data
   */
  async loadStoredSnapData(): Promise<NormalizedSnapData[]> {
    try {
      if (fs.existsSync(this.outputPath)) {
        const data = JSON.parse(fs.readFileSync(this.outputPath, 'utf8'));
        console.log(`📂 Loaded ${data.length} players from stored snap data`);
        return data;
      }
      
      console.log('⚠️ No stored snap data found');
      return [];
      
    } catch (error) {
      console.error('❌ Error loading stored snap data:', error);
      return [];
    }
  }

  /**
   * Get pipeline status and data summary
   */
  async getPipelineStatus(): Promise<{
    hasStoredData: boolean;
    lastUpdated: string | null;
    playerCount: number;
    dataSource: string;
    totalDataPoints: number;
  }> {
    try {
      const storedData = await this.loadStoredSnapData();
      
      if (storedData.length > 0) {
        return {
          hasStoredData: true,
          lastUpdated: storedData[0].metadata.last_updated,
          playerCount: storedData.length,
          dataSource: storedData[0].metadata.source,
          totalDataPoints: storedData.length * 17
        };
      }
      
      return {
        hasStoredData: false,
        lastUpdated: null,
        playerCount: 0,
        dataSource: 'none',
        totalDataPoints: 0
      };
      
    } catch (error) {
      console.error('❌ Error getting pipeline status:', error);
      return {
        hasStoredData: false,
        lastUpdated: null,
        playerCount: 0,
        dataSource: 'error',
        totalDataPoints: 0
      };
    }
  }
}

export const sleeperSnapPipeline = new SleeperSnapPipeline();