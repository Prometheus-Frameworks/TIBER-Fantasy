import React, { useEffect, useState } from 'react';

interface Player {
  player_name: string;
  position: string;
  team: string;
  projected_fpts: number;
  vorp?: number;
  tier?: number;
  receptions?: number;
  birthdate?: string;
}

const Rankings = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/rankings')
      .then(res => {
        if (!res.ok) throw new Error('Fetch failed');
        return res.json();
      })
      .then(data => setPlayers(data))
      .catch(() => setError('Rankings unavailable. Please check back soon.'));
  }, []);

  if (error) {
    return <div style={{ textAlign: 'center', color: '#888' }}>{error}</div>;
  }

  if (!players.length) {
    return <div style={{ textAlign: 'center', color: '#888' }}>Loading rankings...</div>;
  }

  // Check if backend provides tier data
  const hasTiers = players.some(player => player.tier !== undefined);

  if (hasTiers) {
    // Group by tier (backend pre-sorts by VORP)
    const tiers = players.reduce((acc, player) => {
      const tierNum = player.tier || 1;
      if (!acc[tierNum]) acc[tierNum] = [];
      acc[tierNum].push(player);
      return acc;
    }, {} as Record<number, Player[]>);

    return (
      <div style={{ fontFamily: 'Arial, sans-serif', margin: '20px' }}>
        <h1>Player Rankings (Sorted by VORP)</h1>
        {Object.keys(tiers).map(tierNum => (
          <div key={tierNum}>
            <div style={{ background: '#ddd', padding: '10px', margin: '10px 0', fontWeight: 'bold' }}>
              Tier {tierNum}
            </div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {tiers[Number(tierNum)].map((player, index) => {
                const vorpColor = (player.vorp || 0) > 80 ? 'green' : (player.vorp || 0) >= 50 ? 'orange' : 'red';
                return (
                  <li key={index} style={{ 
                    background: '#f0f8ff', 
                    border: '1px solid #ddd', 
                    padding: '10px', 
                    margin: '5px 0', 
                    borderRadius: '4px' 
                  }}>
                    {player.player_name} ({player.position} - {player.team}) - 
                    Projected FPTS: {player.projected_fpts} - 
                    <span style={{ color: vorpColor, fontWeight: 'bold' }}>
                      VORP: {player.vorp?.toFixed(1) || 'N/A'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  // Flat list when no tiers (backend flag)
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', margin: '20px' }}>
      <h1>Player Rankings (Sorted by VORP)</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {players.map((player, index) => {
          const vorpColor = (player.vorp || 0) > 300 ? 'green' : 
                           (player.vorp || 0) >= 200 ? 'orange' : 'red';
          return (
            <li key={index} style={{ 
              background: '#f0f8ff', 
              border: '1px solid #ddd', 
              padding: '10px', 
              margin: '5px 0', 
              borderRadius: '4px' 
            }}>
              <span style={{ fontWeight: 'bold', marginRight: '10px' }}>#{index + 1}</span>
              {player.player_name} ({player.position} - {player.team}) - 
              Projected FPTS: {player.projected_fpts} - 
              <span style={{ color: vorpColor, fontWeight: 'bold' }}>
                VORP: {player.vorp?.toFixed(1) || 'N/A'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Rankings;