import React, { useEffect, useState } from 'react';

interface Player {
  player_name: string;
  position: string;
  team: string;
  projected_fpts: number;
  vorp?: number;
  tier?: number;
  final_rating?: number;
  receptions?: number;
  birthdate?: string;
}

const Rankings = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState<'1qb' | 'superflex'>('1qb');
  const [mode, setMode] = useState<'redraft' | 'dynasty'>('redraft');
  const [qbRushAdjust, setQbRushAdjust] = useState(true);

  const fetchRankings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/rankings?mode=${mode}&format=${format}&qb_rush_adjust=${qbRushAdjust}`);
      if (!response.ok) throw new Error('Fetch failed');
      const data = await response.json();
      setPlayers(data);
    } catch {
      setError('Rankings unavailable. Please check back soon.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, [format, mode, qbRushAdjust]);

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>Loading Rankings...</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', color: '#d32f2f', padding: '40px' }}>{error}</div>;
  }

  // Control panel styles
  const toggleButtonStyle = (isActive: boolean) => ({
    padding: '8px 16px',
    margin: '0 4px',
    border: '1px solid #ddd',
    backgroundColor: isActive ? '#007bff' : '#f8f9fa',
    color: isActive ? 'white' : '#333',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: isActive ? 'bold' : 'normal'
  });

  const PlayerCard = ({ player, index }: { player: Player; index: number }) => {
    const ratingColor = (rating: number) => {
      if (rating >= 90) return '#28a745'; // Green for elite
      if (rating >= 75) return '#17a2b8'; // Blue for premium
      if (rating >= 60) return '#ffc107'; // Yellow for solid
      if (rating >= 45) return '#fd7e14'; // Orange for depth
      return '#dc3545'; // Red for low tier
    };

    const rating = player.final_rating || 50;
    return (
      <li style={{ 
        background: '#f8f9fa', 
        border: '1px solid #dee2e6', 
        padding: '12px', 
        margin: '8px 0', 
        borderRadius: '6px',
        borderLeft: `4px solid ${ratingColor(rating)}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
              {player.player_name} ({player.position} - {player.team})
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: ratingColor(rating) }}>
              Rating: {rating}/99
            </div>
            {player.tier && (
              <div style={{ fontSize: '14px', color: '#6c757d', marginTop: '2px' }}>
                Tier {player.tier}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', fontSize: '14px', color: '#6c757d' }}>
            <div>VORP: {player.vorp?.toFixed(1) || 'N/A'}</div>
            <div>Projected FPTS: {player.projected_fpts}</div>
          </div>
        </div>
      </li>
    );
  };

  // Check if backend provides tier data
  const hasTiers = players.some(player => player.tier !== undefined);

  if (hasTiers) {
    // Group by tier
    const tiers = players.reduce((acc, player) => {
      const tierNum = player.tier || 1;
      if (!acc[tierNum]) acc[tierNum] = [];
      acc[tierNum].push(player);
      return acc;
    }, {} as Record<number, Player[]>);

    return (
      <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Player Rankings</h1>
        
        {/* Control Panel */}
        <div style={{ 
          background: '#ffffff', 
          padding: '20px', 
          borderRadius: '8px', 
          border: '1px solid #dee2e6',
          marginBottom: '30px',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Format:</label>
            <button 
              style={toggleButtonStyle(format === '1qb')}
              onClick={() => setFormat('1qb')}
            >
              1QB
            </button>
            <button 
              style={toggleButtonStyle(format === 'superflex')}
              onClick={() => setFormat('superflex')}
            >
              Superflex
            </button>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Mode:</label>
            <button 
              style={toggleButtonStyle(mode === 'redraft')}
              onClick={() => setMode('redraft')}
            >
              Redraft
            </button>
            <button 
              style={toggleButtonStyle(mode === 'dynasty')}
              onClick={() => setMode('dynasty')}
            >
              Dynasty
            </button>
          </div>
          <div>
            <label style={{ fontWeight: 'bold', marginRight: '10px' }}>QB Rush Adjust:</label>
            <button 
              style={toggleButtonStyle(qbRushAdjust)}
              onClick={() => setQbRushAdjust(true)}
            >
              On
            </button>
            <button 
              style={toggleButtonStyle(!qbRushAdjust)}
              onClick={() => setQbRushAdjust(false)}
            >
              Off
            </button>
          </div>
        </div>

        {/* Tiered Rankings */}
        {Object.keys(tiers).sort((a, b) => Number(a) - Number(b)).map(tierNum => (
          <div key={tierNum} style={{ marginBottom: '30px' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #6c757d, #495057)', 
              color: 'white',
              padding: '12px 20px', 
              margin: '10px 0', 
              fontWeight: 'bold',
              borderRadius: '6px',
              fontSize: '18px'
            }}>
              Tier {tierNum} ({tiers[Number(tierNum)].length} players)
            </div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {tiers[Number(tierNum)].map((player, index) => (
                <PlayerCard key={`${tierNum}-${index}`} player={player} index={index} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  // Flat list when no tiers
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Player Rankings</h1>
      
      {/* Control Panel */}
      <div style={{ 
        background: '#ffffff', 
        padding: '20px', 
        borderRadius: '8px', 
        border: '1px solid #dee2e6',
        marginBottom: '30px',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Format:</label>
          <button 
            style={toggleButtonStyle(format === '1qb')}
            onClick={() => setFormat('1qb')}
          >
            1QB
          </button>
          <button 
            style={toggleButtonStyle(format === 'superflex')}
            onClick={() => setFormat('superflex')}
          >
            Superflex
          </button>
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Mode:</label>
          <button 
            style={toggleButtonStyle(mode === 'redraft')}
            onClick={() => setMode('redraft')}
          >
            Redraft
          </button>
          <button 
            style={toggleButtonStyle(mode === 'dynasty')}
            onClick={() => setMode('dynasty')}
          >
            Dynasty
          </button>
        </div>
        <div>
          <label style={{ fontWeight: 'bold', marginRight: '10px' }}>QB Rush Adjust:</label>
          <button 
            style={toggleButtonStyle(qbRushAdjust)}
            onClick={() => setQbRushAdjust(true)}
          >
            On
          </button>
          <button 
            style={toggleButtonStyle(!qbRushAdjust)}
            onClick={() => setQbRushAdjust(false)}
          >
            Off
          </button>
        </div>
      </div>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {players.map((player, index) => (
          <PlayerCard key={index} player={player} index={index} />
        ))}
      </ul>
    </div>
  );
};

export default Rankings;