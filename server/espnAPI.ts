/**
 * ESPN API Integration Service
 * Provides real-time NFL data for enhanced fantasy analytics
 */

interface ESPNTeam {
  id: string;
  uid: string;
  slug: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  name: string;
  color: string;
  alternateColor: string;
  isActive: boolean;
  logos: Array<{
    href: string;
    width: number;
    height: number;
  }>;
}

interface ESPNGame {
  id: string;
  uid: string;
  date: string;
  name: string;
  shortName: string;
  season: {
    year: number;
    type: number;
  };
  week: {
    number: number;
  };
  competitions: Array<{
    id: string;
    uid: string;
    date: string;
    attendance: number;
    type: {
      id: string;
      abbreviation: string;
    };
    timeValid: boolean;
    neutralSite: boolean;
    conferenceCompetition: boolean;
    playByPlayAvailable: boolean;
    recent: boolean;
    venue: {
      id: string;
      fullName: string;
      address: {
        city: string;
        state: string;
      };
      indoor: boolean;
    };
    competitors: Array<{
      id: string;
      uid: string;
      type: string;
      order: number;
      homeAway: string;
      team: ESPNTeam;
      score: string;
      curatedRank: {
        current: number;
      };
      statistics: any[];
      records: Array<{
        name: string;
        abbreviation: string;
        type: string;
        summary: string;
      }>;
    }>;
    status: {
      clock: number;
      displayClock: string;
      period: number;
      type: {
        id: string;
        name: string;
        state: string;
        completed: boolean;
        description: string;
        detail: string;
        shortDetail: string;
      };
    };
  }>;
}

interface ESPNScoreboard {
  leagues: Array<{
    id: string;
    uid: string;
    name: string;
    abbreviation: string;
    slug: string;
    season: {
      year: number;
      startDate: string;
      endDate: string;
      displayName: string;
      type: {
        id: string;
        type: number;
        name: string;
        abbreviation: string;
      };
    };
    calendarType: string;
    calendarIsWhitelist: boolean;
    calendarStartDate: string;
    calendarEndDate: string;
  }>;
  season: {
    type: number;
    year: number;
  };
  week: {
    number: number;
  };
  events: ESPNGame[];
}

interface ESPNNewsArticle {
  categories: Array<{
    id: number;
    description: string;
    type: string;
    sportId: number;
    leagueId: number;
    league: {
      id: number;
      description: string;
      links: {
        api: {
          leagues: {
            href: string;
          };
        };
        web: {
          leagues: {
            href: string;
          };
        };
        mobile: {
          leagues: {
            href: string;
          };
        };
      };
    };
    uid: string;
    createDate: string;
    teamId?: number;
    team?: {
      id: number;
      description: string;
      links: any;
    };
    athleteId?: number;
    athlete?: {
      id: number;
      description: string;
      links: any;
    };
  }>;
  description: string;
  id: number;
  headline: string;
  images: Array<{
    name: string;
    width: number;
    alt: string;
    caption: string;
    url: string;
    height: number;
  }>;
  lastModified: string;
  originalPublishDate: string;
  type: string;
  premiumContent: boolean;
  links: {
    api: {
      news: {
        href: string;
      };
      self: {
        href: string;
      };
    };
    web: {
      href: string;
      short: {
        href: string;
      };
    };
    mobile: {
      href: string;
    };
  };
}

export class ESPNAPIService {
  private baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
  
  /**
   * Get current week NFL scoreboard
   */
  async getCurrentScoreboard(): Promise<ESPNScoreboard> {
    try {
      const response = await fetch(`${this.baseUrl}/scoreboard`);
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch ESPN scoreboard:', error);
      throw error;
    }
  }

  /**
   * Get scoreboard for specific date
   */
  async getScoreboardByDate(date: string): Promise<ESPNScoreboard> {
    try {
      const response = await fetch(`${this.baseUrl}/scoreboard?dates=${date}`);
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch ESPN scoreboard by date:', error);
      throw error;
    }
  }

  /**
   * Get latest NFL news
   */
  async getLatestNews(): Promise<ESPNNewsArticle[]> {
    try {
      const response = await fetch(`${this.baseUrl}/news`);
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }
      const data = await response.json();
      return data.articles || [];
    } catch (error) {
      console.error('Failed to fetch ESPN news:', error);
      throw error;
    }
  }

  /**
   * Get all NFL teams
   */
  async getAllTeams(): Promise<ESPNTeam[]> {
    try {
      const response = await fetch(`${this.baseUrl}/teams`);
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }
      const data = await response.json();
      return data.sports?.[0]?.leagues?.[0]?.teams?.map((t: any) => t.team) || [];
    } catch (error) {
      console.error('Failed to fetch ESPN teams:', error);
      throw error;
    }
  }

  /**
   * Get specific team information
   */
  async getTeam(teamId: string): Promise<ESPNTeam | null> {
    try {
      const response = await fetch(`${this.baseUrl}/teams/${teamId}`);
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }
      const data = await response.json();
      return data.team || null;
    } catch (error) {
      console.error('Failed to fetch ESPN team:', error);
      throw error;
    }
  }

  /**
   * Get game summary/details
   */
  async getGameSummary(gameId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/summary?event=${gameId}`);
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch ESPN game summary:', error);
      throw error;
    }
  }

  /**
   * Extract injury-related news for fantasy impact
   */
  async getInjuryNews(): Promise<ESPNNewsArticle[]> {
    try {
      const allNews = await this.getLatestNews();
      return allNews.filter(article => 
        article.headline.toLowerCase().includes('injury') ||
        article.headline.toLowerCase().includes('injured') ||
        article.headline.toLowerCase().includes('questionable') ||
        article.headline.toLowerCase().includes('doubtful') ||
        article.headline.toLowerCase().includes('out') ||
        article.description.toLowerCase().includes('injury')
      );
    } catch (error) {
      console.error('Failed to fetch injury news:', error);
      return [];
    }
  }

  /**
   * Get games happening today for "this player plays tonight" insights
   */
  async getTodaysGames(): Promise<ESPNGame[]> {
    try {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const scoreboard = await this.getScoreboardByDate(today);
      return scoreboard.events || [];
    } catch (error) {
      console.error('Failed to fetch today\'s games:', error);
      return [];
    }
  }

  /**
   * Check if a team is playing today
   */
  async isTeamPlayingToday(teamAbbreviation: string): Promise<boolean> {
    try {
      const todaysGames = await this.getTodaysGames();
      return todaysGames.some(game => 
        game.competitions[0]?.competitors?.some(competitor =>
          competitor.team.abbreviation.toLowerCase() === teamAbbreviation.toLowerCase()
        )
      );
    } catch (error) {
      console.error('Failed to check if team is playing today:', error);
      return false;
    }
  }

  /**
   * Get team's next game for schedule analysis
   */
  async getTeamNextGame(teamAbbreviation: string): Promise<ESPNGame | null> {
    try {
      // Get this week's games
      const scoreboard = await this.getCurrentScoreboard();
      const teamGame = scoreboard.events.find(game =>
        game.competitions[0]?.competitors?.some(competitor =>
          competitor.team.abbreviation.toLowerCase() === teamAbbreviation.toLowerCase()
        )
      );
      return teamGame || null;
    } catch (error) {
      console.error('Failed to get team next game:', error);
      return null;
    }
  }

  /**
   * Generate fantasy-relevant insights from ESPN data
   */
  async getFantasyInsights() {
    try {
      const [todaysGames, injuryNews, teams] = await Promise.all([
        this.getTodaysGames(),
        this.getInjuryNews(),
        this.getAllTeams()
      ]);

      return {
        gamesCount: todaysGames.length,
        teamsPlayingToday: todaysGames.flatMap(game => 
          game.competitions[0]?.competitors?.map(c => c.team.abbreviation) || []
        ),
        recentInjuries: injuryNews.slice(0, 5).map(article => ({
          headline: article.headline,
          description: article.description,
          publishDate: article.originalPublishDate
        })),
        totalTeams: teams.length,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to generate fantasy insights:', error);
      return {
        gamesCount: 0,
        teamsPlayingToday: [],
        recentInjuries: [],
        totalTeams: 0,
        lastUpdated: new Date().toISOString(),
        error: 'Failed to fetch ESPN data'
      };
    }
  }
}

export const espnAPI = new ESPNAPIService();