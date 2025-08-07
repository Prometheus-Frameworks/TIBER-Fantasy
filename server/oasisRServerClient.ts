/**
 * OASIS R Server Client (v1.0)
 * Integrates with nflverse R ecosystem for authentic OASIS-style analysis
 * Credits: @EaglesXsandOs for OASIS methodology
 * Uses nflfastR for EPA calculations and offensive architecture scoring
 */

import { spawn } from 'child_process';
import path from 'path';

export interface OASISRData {
  teamId: string;
  teamName: string;
  offensiveArchitecture: {
    epa_per_play: number;
    success_rate: number;
    explosive_play_rate: number;
    red_zone_efficiency: number;
    third_down_efficiency: number;
  };
  schemeMetrics: {
    tempo: 'High' | 'Medium' | 'Low';
    run_concept_frequency: Record<string, number>;
    formation_usage: Record<string, number>;
    personnel_groupings: Record<string, number>;
  };
  playerContext: Array<{
    playerId: string;
    playerName: string;
    position: 'QB' | 'RB' | 'WR' | 'TE';
    epa_per_target?: number;
    air_yards_share?: number;
    target_share?: number;
    red_zone_targets?: number;
  }>;
}

export interface OASISEnhancedContext {
  oasisTags: string[];
  offensiveScheme: string;
  tempo: 'High' | 'Medium' | 'Low';
  redZoneUsage: string;
  runConcepts: string[];
  // Enhanced OASIS data from R
  epaBasedMetrics: {
    offensive_epa: number;
    pass_epa: number;
    rush_epa: number;
    red_zone_epa: number;
  };
  architectureScores: {
    scheme_efficiency: number;
    personnel_optimization: number;
    situational_success: number;
  };
}

class OASISRServerClient {
  private rScriptPath = path.join(process.cwd(), 'server', 'scripts');

  /**
   * Execute R script using nflverse packages for OASIS analysis
   */
  private async executeRScript(scriptContent: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const rProcess = spawn('Rscript', ['--vanilla', '-e', scriptContent]);
      
      let stdout = '';
      let stderr = '';
      
      rProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      rProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      rProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Extract JSON from R output (last line typically)
            const lines = stdout.trim().split('\n');
            const jsonLine = lines[lines.length - 1];
            const result = JSON.parse(jsonLine);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse R output: ${error}`));
          }
        } else {
          reject(new Error(`R script failed with code ${code}: ${stderr}`));
        }
      });
      
      rProcess.on('error', (error) => {
        reject(new Error(`Failed to start R process: ${error.message}`));
      });
    });
  }

  /**
   * Get OASIS data for all NFL teams using nflverse
   */
  async getTeamOASISData(season: number = 2024): Promise<OASISRData[]> {
    const rScript = `
# Load nflverse packages for OASIS-style analysis
# Credits: @EaglesXsandOs for OASIS methodology
suppressMessages({
  library(nflfastR)
  library(nflreadr)
  library(dplyr)
  library(jsonlite)
})

# Load play-by-play data
pbp <- load_pbp(${season})

# Calculate OASIS-style offensive architecture metrics
team_oasis <- pbp %>%
  filter(!is.na(posteam), !is.na(epa)) %>%
  group_by(posteam) %>%
  summarise(
    team_name = first(posteam_team),
    # Core EPA metrics (OASIS foundation)
    epa_per_play = mean(epa, na.rm = TRUE),
    pass_epa = mean(epa[pass == 1], na.rm = TRUE),
    rush_epa = mean(epa[rush == 1], na.rm = TRUE),
    
    # Success rate (OASIS architecture component)
    success_rate = mean(epa > 0, na.rm = TRUE),
    
    # Explosive plays (20+ yards)
    explosive_play_rate = mean(yards_gained >= 20, na.rm = TRUE),
    
    # Situational efficiency
    red_zone_efficiency = mean(epa[yardline_100 <= 20], na.rm = TRUE),
    third_down_efficiency = mean(epa[down == 3], na.rm = TRUE),
    
    # Tempo estimation (plays per minute)
    total_plays = n(),
    .groups = 'drop'
  ) %>%
  mutate(
    # OASIS tempo classification
    tempo = case_when(
      total_plays >= quantile(total_plays, 0.67, na.rm = TRUE) ~ "High",
      total_plays >= quantile(total_plays, 0.33, na.rm = TRUE) ~ "Medium",
      TRUE ~ "Low"
    ),
    
    # OASIS architecture scores (0-100 scale)
    scheme_efficiency = pmax(0, pmin(100, 50 + (epa_per_play * 50))),
    personnel_optimization = pmax(0, pmin(100, success_rate * 100)),
    situational_success = pmax(0, pmin(100, 50 + (red_zone_efficiency * 25)))
  )

# Convert to JSON for Node.js integration
cat(toJSON(team_oasis, auto_unbox = TRUE, pretty = FALSE))
`;

    try {
      const result = await this.executeRScript(rScript);
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      console.error('Error fetching OASIS team data:', error);
      return [];
    }
  }

  /**
   * Get enhanced OASIS context for a specific team
   */
  async getEnhancedOASISContext(teamId: string, season: number = 2024): Promise<OASISEnhancedContext | null> {
    const rScript = `
# Enhanced OASIS context for specific team
# Credits: @EaglesXsandOs for OASIS methodology
suppressMessages({
  library(nflfastR)
  library(nflreadr) 
  library(dplyr)
  library(jsonlite)
})

pbp <- load_pbp(${season})

# Filter for specific team
team_pbp <- pbp %>% 
  filter(posteam == "${teamId}", !is.na(epa))

if(nrow(team_pbp) == 0) {
  cat('{"error": "No data found for team"}')
  quit()
}

# Calculate enhanced OASIS metrics
enhanced_context <- team_pbp %>%
  summarise(
    # Core EPA metrics
    offensive_epa = mean(epa, na.rm = TRUE),
    pass_epa = mean(epa[pass == 1], na.rm = TRUE),
    rush_epa = mean(epa[rush == 1], na.rm = TRUE),
    red_zone_epa = mean(epa[yardline_100 <= 20], na.rm = TRUE),
    
    # OASIS architecture components
    scheme_efficiency = pmax(0, pmin(100, 50 + (mean(epa, na.rm = TRUE) * 50))),
    personnel_optimization = mean(epa > 0, na.rm = TRUE) * 100,
    situational_success = pmax(0, pmin(100, 50 + (mean(epa[yardline_100 <= 20], na.rm = TRUE) * 25))),
    
    # Tempo and scheme classification
    total_plays = n(),
    avg_time_to_snap = mean(time_to_snap, na.rm = TRUE)
  ) %>%
  mutate(
    tempo = case_when(
      total_plays >= 1100 ~ "High",
      total_plays >= 1000 ~ "Medium", 
      TRUE ~ "Low"
    )
  )

# Add OASIS tags based on performance thresholds
oasis_tags <- c()
if(enhanced_context$offensive_epa > 0.1) oasis_tags <- c(oasis_tags, "High Efficiency Offense")
if(enhanced_context$pass_epa > 0.15) oasis_tags <- c(oasis_tags, "Elite Passing Attack")
if(enhanced_context$rush_epa > 0.05) oasis_tags <- c(oasis_tags, "Effective Ground Game")
if(enhanced_context$red_zone_epa > 0.2) oasis_tags <- c(oasis_tags, "Red Zone Specialists")
if(enhanced_context$tempo == "High") oasis_tags <- c(oasis_tags, "High Tempo Offense")

result <- list(
  oasisTags = oasis_tags,
  offensiveScheme = if(enhanced_context$pass_epa > enhanced_context$rush_epa) "Pass Heavy" else "Run Heavy",
  tempo = enhanced_context$tempo,
  epaBasedMetrics = list(
    offensive_epa = enhanced_context$offensive_epa,
    pass_epa = enhanced_context$pass_epa,
    rush_epa = enhanced_context$rush_epa,
    red_zone_epa = enhanced_context$red_zone_epa
  ),
  architectureScores = list(
    scheme_efficiency = enhanced_context$scheme_efficiency,
    personnel_optimization = enhanced_context$personnel_optimization,
    situational_success = enhanced_context$situational_success
  )
)

cat(toJSON(result, auto_unbox = TRUE, pretty = FALSE))
`;

    try {
      const result = await this.executeRScript(rScript);
      return result.error ? null : result;
    } catch (error) {
      console.error(`Error fetching enhanced OASIS context for ${teamId}:`, error);
      return null;
    }
  }

  /**
   * Check if R and required packages are available
   */
  async validateREnvironment(): Promise<{ available: boolean; packages: string[]; message: string }> {
    const checkScript = `
# Check R environment for OASIS integration
required_packages <- c("nflfastR", "nflreadr", "dplyr", "jsonlite")
installed_packages <- installed.packages()[,"Package"]
missing_packages <- setdiff(required_packages, installed_packages)

if(length(missing_packages) == 0) {
  result <- list(
    available = TRUE,
    packages = required_packages,
    message = "R environment ready for OASIS integration"
  )
} else {
  result <- list(
    available = FALSE, 
    packages = installed_packages[installed_packages %in% required_packages],
    message = paste("Missing packages:", paste(missing_packages, collapse = ", "))
  )
}

suppressMessages(library(jsonlite))
cat(toJSON(result, auto_unbox = TRUE))
`;

    try {
      const result = await this.executeRScript(checkScript);
      return result;
    } catch (error) {
      return {
        available: false,
        packages: [],
        message: `R environment check failed: ${error}`
      };
    }
  }
}

export const oasisRServerClient = new OASISRServerClient();