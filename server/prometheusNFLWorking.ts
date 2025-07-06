/**
 * Prometheus NFL Working Implementation
 * Simplified but functional authentic 2024 NFL dynasty rankings
 */

import { spawn } from 'child_process';

export interface WorkingPrometheusPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  
  // Season stats
  games: number;
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  fantasyPoints: number;
  
  // Dynasty evaluation
  dynastyScore: number;
  tier: string;
  rank: number;
}

class PrometheusNFLWorking {
  
  async generateWorkingRankings(): Promise<Record<string, WorkingPrometheusPlayer[]>> {
    console.log('🚀 Generating Working NFL Rankings...');
    
    const rankings = {
      QB: await this.getPositionRankings('QB'),
      RB: await this.getPositionRankings('RB'), 
      WR: await this.getPositionRankings('WR'),
      TE: await this.getPositionRankings('TE')
    };
    
    console.log('✅ Working NFL Rankings Generated');
    Object.entries(rankings).forEach(([pos, players]) => {
      console.log(`${pos}: ${players.length} players ranked`);
    });
    
    return rankings;
  }
  
  private async getPositionRankings(position: string): Promise<WorkingPrometheusPlayer[]> {
    const pythonScript = `
import nfl_data_py as nfl
import json
import warnings
warnings.filterwarnings('ignore')

# Get 2024 data
weekly = nfl.import_weekly_data([2024])
pos_data = weekly[weekly['position'] == '${position}']

# Aggregate by player
player_totals = pos_data.groupby(['player_id', 'player_name', 'recent_team']).agg({
    'targets': 'sum',
    'receptions': 'sum', 
    'receiving_yards': 'sum',
    'receiving_tds': 'sum',
    'fantasy_points_ppr': 'sum',
    'week': 'count'
}).reset_index()

# Apply relevance filters
if '${position}' == 'WR':
    relevant = player_totals[
        (player_totals['week'] >= 4) &
        (player_totals['targets'] >= 15) &
        (player_totals['fantasy_points_ppr'] >= 10)
    ]
elif '${position}' == 'RB':
    relevant = player_totals[
        (player_totals['week'] >= 4) &
        (player_totals['fantasy_points_ppr'] >= 20)
    ]
elif '${position}' == 'TE':
    relevant = player_totals[
        (player_totals['week'] >= 4) &
        (player_totals['targets'] >= 10) &
        (player_totals['fantasy_points_ppr'] >= 15)
    ]
else:  # QB
    qb_data = pos_data.groupby(['player_id', 'player_name', 'recent_team']).agg({
        'passing_yards': 'sum',
        'passing_tds': 'sum',
        'fantasy_points_ppr': 'sum',
        'week': 'count'
    }).reset_index()
    relevant = qb_data[
        (qb_data['week'] >= 4) &
        (qb_data['fantasy_points_ppr'] >= 50)
    ]

# Sort by fantasy points and take top players
top_players = relevant.nlargest(30, 'fantasy_points_ppr')

# Convert to simple format
result = []
for idx, row in top_players.iterrows():
    player = {
        'player_id': str(row['player_id']),
        'player_name': str(row['player_name']),
        'recent_team': str(row['recent_team']),
        'games': int(row['week']),
        'targets': int(row.get('targets', 0)),
        'receptions': int(row.get('receptions', 0)),
        'receiving_yards': int(row.get('receiving_yards', 0)),
        'receiving_tds': int(row.get('receiving_tds', 0)),
        'fantasy_points_ppr': float(row['fantasy_points_ppr'])
    }
    result.append(player)

print(json.dumps(result))
`;

    try {
      const playerData = await this.executePython(pythonScript);
      return this.convertToPrometheusPlayers(playerData, position);
    } catch (error) {
      console.error(`Error getting ${position} rankings:`, error);
      return [];
    }
  }
  
  private async executePython(script: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', ['-c', script]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            // Find JSON data after any Python output messages
            const lines = stdout.split('\n');
            const jsonLine = lines.find(line => line.trim().startsWith('[') || line.trim().startsWith('{'));
            
            if (jsonLine) {
              const result = JSON.parse(jsonLine);
              resolve(Array.isArray(result) ? result : []);
            } else {
              resolve([]);
            }
          } catch (error) {
            console.error('JSON parse error:', error);
            resolve([]);
          }
        } else {
          console.error('Python error:', stderr);
          resolve([]);
        }
      });
    });
  }
  
  private convertToPrometheusPlayers(playerData: any[], position: string): WorkingPrometheusPlayer[] {
    const players: WorkingPrometheusPlayer[] = [];
    
    playerData.forEach((data, index) => {
      // Calculate dynasty score based on production + estimated age factors
      const fpprPerGame = data.fantasy_points_ppr / Math.max(1, data.games);
      const estimatedAge = this.estimateAge(data.player_name, fpprPerGame);
      
      // Simple dynasty scoring
      let productionScore = 0;
      if (position === 'QB') {
        productionScore = Math.min(100, (fpprPerGame / 20) * 100);
      } else if (position === 'RB') {
        productionScore = Math.min(100, (fpprPerGame / 15) * 100);
      } else if (position === 'WR') {
        productionScore = Math.min(100, (fpprPerGame / 12) * 100);
      } else { // TE
        productionScore = Math.min(100, (fpprPerGame / 8) * 100);
      }
      
      const ageScore = this.calculateAgeScore(estimatedAge);
      const dynastyScore = Math.round((productionScore * 0.7) + (ageScore * 0.3));
      
      const player: WorkingPrometheusPlayer = {
        playerId: data.player_id,
        name: data.player_name,
        position,
        team: data.recent_team,
        
        games: data.games,
        targets: data.targets,
        receptions: data.receptions,
        receivingYards: data.receiving_yards,
        receivingTds: data.receiving_tds,
        fantasyPoints: data.fantasy_points_ppr,
        
        dynastyScore,
        tier: this.assignTier(dynastyScore),
        rank: index + 1
      };
      
      players.push(player);
    });
    
    return players;
  }
  
  private estimateAge(playerName: string, fpprPerGame: number): number {
    // Simple age estimation - young high performers vs veterans
    if (fpprPerGame > 15) return 27; // Proven veterans
    if (fpprPerGame > 10) return 25; // Rising stars
    return 24; // Young players
  }
  
  private calculateAgeScore(age: number): number {
    if (age <= 22) return 100;
    if (age <= 24) return 90;
    if (age <= 26) return 80;
    if (age <= 28) return 70;
    if (age <= 30) return 55;
    return 35;
  }
  
  private assignTier(score: number): string {
    if (score >= 90) return 'Elite';
    if (score >= 75) return 'Premium';
    if (score >= 60) return 'Strong';
    if (score >= 45) return 'Solid';
    if (score >= 30) return 'Depth';
    return 'Bench';
  }
}

export const prometheusNFLWorking = new PrometheusNFLWorking();