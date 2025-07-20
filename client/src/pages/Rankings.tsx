import { useEffect, useState } from 'react';

interface Player {
  player_name: string;
  position: string;
  team: string;
  projected_fpts: number;
  vorp_score?: number;
}

export default function Rankings() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔍 Fetching rankings from /api/rankings...');
    fetch('/api/rankings')
      .then(res => {
        console.log('📊 Response status:', res.status);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        console.log('✅ Rankings data received:', data);
        const playersArray = Array.isArray(data) ? data : (data.players || []);
        setPlayers(playersArray);
        setLoading(false);
      })
      .catch(error => {
        console.error('❌ Error fetching rankings:', error);
        setError('Rankings unavailable. Please check back soon.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading rankings...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-2">⚠️ Error</div>
          <div className="text-gray-600">{error}</div>
        </div>
      </div>
    );
  }

  if (!players.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600">No players data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Player Rankings
        </h1>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-blue-600 text-white">
            <h2 className="text-lg font-semibold">
              Top {players.length} Fantasy Football Players
            </h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {players.map((player, index) => (
              <div key={index} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">
                            #{index + 1}
                          </span>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {player.player_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {player.position} - {player.team}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">
                      {player.projected_fpts} pts
                    </div>
                    {player.vorp_score !== undefined && (
                      <div className="text-sm text-gray-500">
                        VORP: {typeof player.vorp_score === 'number' ? player.vorp_score.toFixed(1) : player.vorp_score}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Rankings updated in real-time</p>
        </div>
      </div>
    </div>
  );
}