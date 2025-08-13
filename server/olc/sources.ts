// Note: logger import removed to fix circular dependency - will use console for now

// Data source adapters for various OL metrics
export interface OlSourceData {
  pff_pb: number;           // PFF Pass Block grade
  espn_pbwr: number;        // ESPN Pass Block Win Rate
  espn_rbwr: number;        // ESPN Run Block Win Rate
  pressure_rate: number;    // Pressure allowed rate
  adjusted_sack_rate: number; // ASR
  ybc_per_rush: number;     // Yards Before Contact per rush
  injuries: OlInjuryData[];
  depth_chart: OlDepthChart;
  penalties: number;        // Penalty yards
}

export interface OlInjuryData {
  position: string;
  player_id: string;
  status: 'out' | 'questionable' | 'doubtful' | 'probable';
  career_snaps: number;
  is_starter: boolean;
}

// Import OlDepthChart from schema to avoid duplication
import type { OlDepthChart } from './schema';

export class OlSourceAdapter {
  private static instance: OlSourceAdapter;
  private cache = new Map<string, OlSourceData>();

  static getInstance(): OlSourceAdapter {
    if (!OlSourceAdapter.instance) {
      OlSourceAdapter.instance = new OlSourceAdapter();
    }
    return OlSourceAdapter.instance;
  }

  async fetchTeamData(teamId: string, season: number, week: number): Promise<OlSourceData> {
    const cacheKey = `${teamId}-${season}-${week}`;
    
    if (this.cache.has(cacheKey)) {
      console.debug('[OLC] OL data cache hit', { teamId, season, week });
      return this.cache.get(cacheKey)!;
    }

    console.info('[OLC] Fetching OL data from sources', { teamId, season, week });

    try {
      const [pffData, espnData, injuryData, depthData] = await Promise.all([
        this.fetchPffData(teamId, season, week),
        this.fetchEspnData(teamId, season, week),
        this.fetchInjuryData(teamId, season, week),
        this.fetchDepthChart(teamId, season, week),
      ]);

      const sourceData: OlSourceData = {
        pff_pb: pffData.pass_block_grade,
        espn_pbwr: espnData.pass_block_win_rate,
        espn_rbwr: espnData.run_block_win_rate,
        pressure_rate: pffData.pressure_rate,
        adjusted_sack_rate: pffData.adjusted_sack_rate,
        ybc_per_rush: espnData.yards_before_contact,
        injuries: injuryData,
        depth_chart: depthData,
        penalties: pffData.penalty_yards,
      };

      this.cache.set(cacheKey, sourceData);
      console.debug('[OLC] OL data cached', { teamId, season, week, cacheSize: this.cache.size });

      return sourceData;
    } catch (error) {
      console.error('[OLC] Failed to fetch OL data', { teamId, season, week, error });
      throw error;
    }
  }

  private async fetchPffData(teamId: string, season: number, week: number) {
    // Adapter for PFF data - would integrate with actual PFF API
    // For now, return realistic stub data
    return {
      pass_block_grade: 65 + Math.random() * 30,
      pressure_rate: 0.15 + Math.random() * 0.15,
      adjusted_sack_rate: 0.04 + Math.random() * 0.06,
      penalty_yards: Math.floor(Math.random() * 50),
    };
  }

  private async fetchEspnData(teamId: string, season: number, week: number) {
    // Adapter for ESPN metrics
    return {
      pass_block_win_rate: 0.55 + Math.random() * 0.25,
      run_block_win_rate: 0.60 + Math.random() * 0.25,
      yards_before_contact: 1.8 + Math.random() * 1.2,
    };
  }

  private async fetchInjuryData(teamId: string, season: number, week: number): Promise<OlInjuryData[]> {
    // Simulate injury data - would integrate with injury API
    const positions = ['LT', 'LG', 'C', 'RG', 'RT'];
    const injuries: OlInjuryData[] = [];

    // Random chance of injuries
    for (const pos of positions) {
      if (Math.random() < 0.15) { // 15% chance of injury per position
        injuries.push({
          position: pos,
          player_id: `${teamId}-${pos}-backup`,
          status: Math.random() < 0.5 ? 'questionable' : 'out',
          career_snaps: Math.floor(Math.random() * 1000),
          is_starter: Math.random() < 0.7,
        });
      }
    }

    return injuries;
  }

  private async fetchDepthChart(teamId: string, season: number, week: number): Promise<OlDepthChart> {
    // Simulate depth chart data
    const positions = ['LT', 'LG', 'C', 'RG', 'RT'] as const;
    const depthChart: Partial<OlDepthChart> = {};

    for (const pos of positions) {
      depthChart[pos] = [
        {
          player_id: `${teamId}-${pos}-starter`,
          snaps: 800 + Math.floor(Math.random() * 400),
          is_starter: true,
        },
        {
          player_id: `${teamId}-${pos}-backup`,
          snaps: Math.floor(Math.random() * 200),
          is_starter: false,
        },
      ];
    }

    return depthChart as OlDepthChart;
  }

  clearCache(): void {
    this.cache.clear();
    console.info('[OLC] OL source cache cleared');
  }
}