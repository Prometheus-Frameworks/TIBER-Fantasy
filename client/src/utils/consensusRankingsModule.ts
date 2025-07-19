// Consensus Rankings Fetch + Render — Drop-In Module
// Integrates with existing tier bubble API endpoints

interface ConsensusPlayer {
  playerId: number;
  playerName: string;
  position: string;
  team: string;
  averageRank: number;
  rankCount: number;
  standardDeviation: number;
  minRank: number;
  maxRank: number;
  consensusRank: number;
  format: string;
  dynastyType?: string;
}

interface ConsensusRankingsResponse {
  success: boolean;
  data: {
    consensus_rankings: ConsensusPlayer[];
    tier_bubbles: Array<{
      tier_number: number;
      avg_rank_range: { min: number; max: number };
      consensus_strength: 'tight' | 'loose';
      players: Array<{
        player_id: string;
        player_name: string;
        position: string;
        team: string;
        average_rank: number;
        standard_deviation: number;
        min_rank: number;
        max_rank: number;
        rank_count: number;
      }>;
    }>;
  };
}

export async function loadConsensusRankings(
  format: 'redraft' | 'dynasty' = 'dynasty',
  dynastyType: 'rebuilder' | 'contender' = 'contender',
  containerId: string = 'rankings-list'
): Promise<void> {
  try {
    // Fetch from actual API endpoint
    const url = `/api/rankings/consensus?format=${format}${format === 'dynasty' ? `&dynastyType=${dynastyType}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: ConsensusRankingsResponse = await response.json();
    
    if (!data.success || !data.data.consensus_rankings) {
      throw new Error('Invalid response format');
    }
    
    const players = data.data.consensus_rankings;
    const container = document.getElementById(containerId);
    
    if (!container) {
      console.error(`Container with ID '${containerId}' not found`);
      return;
    }
    
    container.innerHTML = '';
    
    players.forEach(player => {
      const card = document.createElement('div');
      card.className = 'player-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 mb-2 hover:shadow-md transition-shadow';
      
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400">
              ${player.consensusRank}
            </div>
            <div>
              <strong class="text-gray-900 dark:text-white">${player.playerName}</strong><br>
              <small class="text-gray-500 dark:text-gray-400">${player.position} – ${player.team}</small><br>
              <small class="text-gray-400 dark:text-gray-500">Avg: ${player.averageRank?.toFixed(1) ?? 'N/A'} • ${player.rankCount} votes</small>
            </div>
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            Range: ${player.minRank}-${player.maxRank}
          </div>
        </div>
      `;
      
      container.appendChild(card);
    });
    
    console.log(`✅ Loaded ${players.length} consensus rankings for ${format}${format === 'dynasty' ? ` (${dynastyType})` : ''}`);
    
  } catch (error) {
    console.error('Failed to load consensus rankings:', error);
    
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="text-center py-8 text-red-500">
          Failed to load consensus rankings: ${error instanceof Error ? error.message : 'Unknown error'}
        </div>
      `;
    }
  }
}

export async function loadTierBubbles(
  format: 'redraft' | 'dynasty' = 'dynasty',
  dynastyType: 'rebuilder' | 'contender' = 'contender',
  containerId: string = 'tier-bubbles-container'
): Promise<void> {
  try {
    const url = `/api/rankings/tier-bubbles?format=${format}${format === 'dynasty' ? `&dynastyType=${dynastyType}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: ConsensusRankingsResponse = await response.json();
    
    if (!data.success || !data.data.tier_bubbles) {
      throw new Error('Invalid tier bubble response format');
    }
    
    const tierBubbles = data.data.tier_bubbles;
    const container = document.getElementById(containerId);
    
    if (!container) {
      console.error(`Container with ID '${containerId}' not found`);
      return;
    }
    
    container.innerHTML = '';
    
    tierBubbles.forEach(tier => {
      // Create tier section
      const tierSection = document.createElement('div');
      tierSection.className = 'tier-section mb-6';
      
      // Tier label
      const tierLabel = document.createElement('div');
      tierLabel.className = 'tier-label text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3';
      tierLabel.textContent = `Tier ${tier.tier_number}`;
      
      // Bubble container
      const bubble = document.createElement('div');
      const tierColors = [
        'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700',
        'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700',
        'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-700',
        'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700',
        'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-700',
        'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-700',
      ];
      const colorClass = tierColors[(tier.tier_number - 1) % tierColors.length];
      bubble.className = `bubble border-2 rounded-lg p-4 ${colorClass}`;
      
      // Player cards container
      const playersContainer = document.createElement('div');
      playersContainer.className = 'flex flex-wrap gap-3';
      
      // Sort players alphabetically to avoid ranking bias
      const sortedPlayers = [...tier.players].sort((a, b) => a.player_name.localeCompare(b.player_name));
      
      sortedPlayers.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 min-w-0 flex-1 min-w-[160px] max-w-[200px] cursor-pointer hover:shadow-md transition-shadow';
        
        playerCard.innerHTML = `
          <div class="font-medium text-gray-900 dark:text-white">
            ${player.player_name}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            ${player.position} – ${player.team}
          </div>
          <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Avg: ${player.average_rank.toFixed(1)}
          </div>
        `;
        
        playersContainer.appendChild(playerCard);
      });
      
      bubble.appendChild(playersContainer);
      tierSection.appendChild(tierLabel);
      tierSection.appendChild(bubble);
      container.appendChild(tierSection);
    });
    
    console.log(`✅ Loaded ${tierBubbles.length} tier bubbles for ${format}${format === 'dynasty' ? ` (${dynastyType})` : ''}`);
    
  } catch (error) {
    console.error('Failed to load tier bubbles:', error);
    
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="text-center py-8 text-red-500">
          Failed to load tier bubbles: ${error instanceof Error ? error.message : 'Unknown error'}
        </div>
      `;
    }
  }
}

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    // Auto-load if containers exist
    if (document.getElementById('rankings-list')) {
      loadConsensusRankings();
    }
    if (document.getElementById('tier-bubbles-container')) {
      loadTierBubbles();
    }
  });
}