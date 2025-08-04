/**
 * Player Compass Data Adapter
 * Converts existing WR data to Player Compass format for demonstration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface WRData {
  player_name: string;
  team: string;
  games_played_x: number;
  total_points: number;
  fpg: number;
  vorp: number;
  rating: number;
  adjusted_rating: number;
  ypc: number;
  ypt: number;
  rush_ypc: number;
  targets: number;
  receptions: number;
  rec_yards: number;
  games_played_y: number;
  archetype_tag: string;
}

export class CompassDataAdapter {
  private wrData: WRData[] = [];

  constructor() {
    this.loadWRData();
  }

  private loadWRData() {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const csvPath = path.join(__dirname, '../data/WR_2024_Ratings_With_Tags.csv');
      
      if (fs.existsSync(csvPath)) {
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        this.wrData = this.parseCSV(csvContent);
        console.log(`🧭 Loaded ${this.wrData.length} WR players for Player Compass`);
      }
    } catch (error) {
      console.error('Error loading WR data for compass:', error);
    }
  }

  private parseCSV(csvContent: string): WRData[] {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const player: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index];
        if (['games_played_x', 'total_points', 'fpg', 'vorp', 'rating', 'adjusted_rating', 
             'ypc', 'ypt', 'rush_ypc', 'targets', 'receptions', 'rec_yards', 'games_played_y'].includes(header)) {
          player[header] = parseFloat(value) || 0;
        } else {
          player[header] = value;
        }
      });
      
      return player as WRData;
    });
  }

  /**
   * Convert WR data to Player Compass format
   */
  getCompassPlayers() {
    return this.wrData.map(wr => ({
      id: `wr_${wr.player_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      player_id: `wr_${wr.player_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: wr.player_name,
      player_name: wr.player_name,
      position: 'WR' as const,
      team: wr.team,
      age: this.estimateAge(wr.player_name), // Rough estimate
      fpg: wr.fpg,
      total_points: wr.total_points,
      targets: wr.targets,
      receptions: wr.receptions,
      rec_yards: wr.rec_yards,
      targetShare: wr.targets / 550, // Rough estimate (550 team attempts average)
      prometheusScore: wr.adjusted_rating,
      archetype_tag: wr.archetype_tag,
      consistency: this.calculateConsistency(wr),
      injuryHistory: [],
      contractStatus: 'Active', // Default
      teamStability: 7, // Default moderate
      avgPoints: wr.fpg,
      projectedPoints: wr.fpg,
      ownershipPercentage: 85, // Default
      isAvailable: true,
      upside: this.calculateUpside(wr),
      injuryStatus: 'Healthy',
      availability: 'Available',
      matchupRating: 7.5,
      trend: 'stable' as const,
      ownership: 85,
      redZoneTargets: Math.round(wr.targets * 0.15), // Estimate
      carries: wr.rush_ypc > 0 ? 5 : 0, // Rough estimate
      snapCount: Math.round(wr.games_played_x * 65), // Estimate
      externalId: `wr_${wr.player_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    }));
  }

  private estimateAge(playerName: string): number {
    // Rough age estimates for demonstration
    const ageMap: Record<string, number> = {
      "Ja'Marr Chase": 25,
      "Tee Higgins": 26,
      "Justin Jefferson": 25,
      "Amon-Ra St. Brown": 25,
      "Puka Nacua": 23,
      "Malik Nabers": 22,
      "Nico Collins": 25,
      "CeeDee Lamb": 25,
      "Mike Evans": 31,
      "Davante Adams": 32,
      "A.J. Brown": 27,
      "Brian Thomas": 22,
      "Cooper Kupp": 31,
      "Jaxon Smith-Njigba": 22,
      "Terry McLaurin": 29,
      "DeVonta Smith": 26,
      "Garrett Wilson": 24,
      "Jordan Addison": 22,
      "Drake London": 23,
      "Ladd McConkey": 23
    };
    
    return ageMap[playerName] || 26; // Default age
  }

  private calculateConsistency(wr: WRData): number {
    // Higher rating = more consistent
    if (wr.adjusted_rating >= 90) return 0.85;
    if (wr.adjusted_rating >= 80) return 0.75;
    if (wr.adjusted_rating >= 70) return 0.65;
    return 0.55;
  }

  private calculateUpside(wr: WRData): number {
    // Based on archetype and performance
    const archetypeMultipliers = {
      'efficient alpha': 9.5,
      'explosive outlier': 9.0,
      'deep threat': 8.5,
      'balanced': 7.5,
      'volume slot': 7.0
    };
    
    const baseUpside = archetypeMultipliers[wr.archetype_tag as keyof typeof archetypeMultipliers] || 7.0;
    return Math.min(10, baseUpside * (wr.fpg / 15)); // Scale by performance
  }
}

export const compassDataAdapter = new CompassDataAdapter();