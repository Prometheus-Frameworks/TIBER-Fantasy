/**
 * OASIS External API Service
 * Fetches real-time OASIS data from external R server
 * Replaces static datasets with live API integration
 */

export interface OasisTeamData {
  name: string;
  city: string;
  oasisScore: number;
  color: string;
  [key: string]: any; // Allow additional fields from API
}

// Fallback dataset for API failures (minimal essential data)
const fallbackOasisData: OasisTeamData[] = [
  { name: "Bills", city: "Buffalo", oasisScore: 92, color: "#00338D" },
  { name: "Dolphins", city: "Miami", oasisScore: 89, color: "#008E97" },
  { name: "Chiefs", city: "Kansas City", oasisScore: 87, color: "#E31837" },
  { name: "Ravens", city: "Baltimore", oasisScore: 85, color: "#241773" },
  { name: "Cowboys", city: "Dallas", oasisScore: 83, color: "#041E42" }
];

export class OasisApiService {
  private readonly apiUrl = 'https://cd34bf715e62430e9951d206b4fe0898.app.posit.cloud/p/275ee926/oasis';
  private sessionCache: OasisTeamData[] | null = null;
  private lastFetchTime: number = 0;
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes session cache

  /**
   * Fetch OASIS data from external API with fallback handling
   */
  async fetchOasisData(): Promise<OasisTeamData[]> {
    // Check session cache first
    if (this.sessionCache && (Date.now() - this.lastFetchTime) < this.cacheTTL) {
      console.log('OASIS: Returning cached data');
      return this.sessionCache;
    }

    try {
      console.log('OASIS: Fetching data from external API...');
      
      const response = await fetch(this.apiUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Reflecting FF Analytics',
          'Accept': 'application/json'
        },
        // 10 second timeout
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        console.warn(`OASIS API fetch failed. Status: ${response.status} ${response.statusText}`);
        return this.handleFallback('API response not ok');
      }

      const rawData = await response.json();
      console.log('OASIS API fetch successful.');
      
      // Process and validate the data
      const processedData = this.processApiData(rawData);
      
      // Cache for session
      this.sessionCache = processedData;
      this.lastFetchTime = Date.now();
      
      return processedData;

    } catch (error) {
      console.error('OASIS API fetch error:', error);
      return this.handleFallback(`Fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process raw API data and handle null values
   */
  private processApiData(rawData: any): OasisTeamData[] {
    if (!Array.isArray(rawData)) {
      console.warn('OASIS API returned non-array data, attempting to extract teams');
      
      // Try to find teams array in response
      if (rawData.teams && Array.isArray(rawData.teams)) {
        rawData = rawData.teams;
      } else if (rawData.data && Array.isArray(rawData.data)) {
        rawData = rawData.data;
      } else {
        throw new Error('Invalid API response format');
      }
    }

    return rawData.map((team: any, index: number) => {
      // Handle null values as 'NA' or provide defaults
      const processedTeam: OasisTeamData = {
        name: team.name || team.teamName || 'NA',
        city: team.city || team.cityName || 'NA',
        oasisScore: this.parseNumber(team.oasisScore || team.score || team.rating, 50),
        color: team.color || team.teamColor || this.getDefaultColor(index),
        ...team // Include any additional fields from API
      };

      // Log null value warnings
      if (team.name === null || team.name === undefined) {
        console.warn(`OASIS: Null team name detected for team ${index}, using 'NA'`);
      }
      if (team.oasisScore === null || team.oasisScore === undefined) {
        console.warn(`OASIS: Null oasisScore detected for team ${team.name || index}, using default`);
      }

      return processedTeam;
    });
  }

  /**
   * Parse numeric values with fallback
   */
  private parseNumber(value: any, defaultValue: number): number {
    if (value === null || value === undefined || value === 'NA') {
      return defaultValue;
    }
    
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(parsed) ? defaultValue : Math.max(0, Math.min(100, parsed));
  }

  /**
   * Get default color for team by index
   */
  private getDefaultColor(index: number): string {
    const defaultColors = [
      '#00338D', '#008E97', '#E31837', '#241773', '#041E42',
      '#AA0000', '#0076B6', '#FB4F14', '#004C54', '#0080C6'
    ];
    return defaultColors[index % defaultColors.length] || '#666666';
  }

  /**
   * Handle API failures with fallback data
   */
  private handleFallback(reason: string): OasisTeamData[] {
    console.warn(`OASIS: Using fallback dataset. Reason: ${reason}`);
    
    // Don't cache fallback data
    this.sessionCache = null;
    this.lastFetchTime = 0;
    
    return fallbackOasisData;
  }

  /**
   * Clear session cache (for testing/debugging)
   */
  clearCache(): void {
    this.sessionCache = null;
    this.lastFetchTime = 0;
    console.log('OASIS: Session cache cleared');
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): { cached: boolean; age: number; ttl: number } {
    return {
      cached: this.sessionCache !== null,
      age: Date.now() - this.lastFetchTime,
      ttl: this.cacheTTL
    };
  }
}

// Export singleton instance
export const oasisApiService = new OasisApiService();