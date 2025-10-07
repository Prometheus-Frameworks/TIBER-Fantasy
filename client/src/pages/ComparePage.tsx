import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';

export default function ComparePage() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split('?')[1]);
  const player1 = params.get('player1') || '';
  const player2 = params.get('player2') || '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/player-usage-compare', player1, player2],
    enabled: !!player1 && !!player2,
  });

  if (!player1 || !player2) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Player Comparison</h1>
        <p>Please provide both player1 and player2 in the URL</p>
        <p>Example: /compare?player1=romeo+doubs&player2=rashid+shaheed</p>
      </div>
    );
  }

  if (isLoading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (error) return <div style={{ padding: '20px' }}>Error loading player data</div>;

  const players = (data as any)?.data || [];

  if (players.length === 0) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Player Comparison</h1>
        <p>No players found matching: {player1} and {player2}</p>
      </div>
    );
  }

  const p1 = players[0];
  const p2 = players[1];

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '30px' }}>Player Comparison</h1>
      
      <table border={1} cellPadding={12} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ textAlign: 'left', width: '30%' }}>Stat</th>
            <th style={{ textAlign: 'center', width: '35%' }}>{p1?.player_name || 'Player 1'}</th>
            <th style={{ textAlign: 'center', width: '35%' }}>{p2?.player_name || 'Player 2'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Position</strong></td>
            <td data-testid="player1-position" style={{ textAlign: 'center' }}>{p1?.position || '-'}</td>
            <td data-testid="player2-position" style={{ textAlign: 'center' }}>{p2?.position || '-'}</td>
          </tr>
          <tr>
            <td><strong>Team</strong></td>
            <td data-testid="player1-team" style={{ textAlign: 'center' }}>{p1?.team || '-'}</td>
            <td data-testid="player2-team" style={{ textAlign: 'center' }}>{p2?.team || '-'}</td>
          </tr>
          <tr style={{ backgroundColor: '#fffbea' }}>
            <td><strong>Week 6 Opponent</strong></td>
            <td data-testid="player1-opponent" style={{ textAlign: 'center' }}>
              {p1?.week6_location && p1?.week6_opponent 
                ? `${p1.week6_location} ${p1.week6_opponent}` 
                : '-'}
            </td>
            <td data-testid="player2-opponent" style={{ textAlign: 'center' }}>
              {p2?.week6_location && p2?.week6_opponent 
                ? `${p2.week6_location} ${p2.week6_opponent}` 
                : '-'}
            </td>
          </tr>
          <tr>
            <td><strong>Games Played</strong></td>
            <td data-testid="player1-games" style={{ textAlign: 'center' }}>{p1?.games_played || '-'}</td>
            <td data-testid="player2-games" style={{ textAlign: 'center' }}>{p2?.games_played || '-'}</td>
          </tr>
          <tr>
            <td><strong>Target Share %</strong></td>
            <td data-testid="player1-target-share" style={{ textAlign: 'center' }}>{p1?.target_share_pct || '-'}</td>
            <td data-testid="player2-target-share" style={{ textAlign: 'center' }}>{p2?.target_share_pct || '-'}</td>
          </tr>
          <tr>
            <td><strong>Outside Alignment %</strong></td>
            <td data-testid="player1-outside" style={{ textAlign: 'center' }}>{p1?.alignment_outside_pct || '-'}</td>
            <td data-testid="player2-outside" style={{ textAlign: 'center' }}>{p2?.alignment_outside_pct || '-'}</td>
          </tr>
          <tr>
            <td><strong>Slot Alignment %</strong></td>
            <td data-testid="player1-slot" style={{ textAlign: 'center' }}>{p1?.alignment_slot_pct || '-'}</td>
            <td data-testid="player2-slot" style={{ textAlign: 'center' }}>{p2?.alignment_slot_pct || '-'}</td>
          </tr>
          <tr style={{ backgroundColor: '#e8f5e9' }}>
            <td><strong>Latest Snap Share %</strong></td>
            <td data-testid="player1-snap-share" style={{ textAlign: 'center' }}>{p1?.latest_snap_share_pct || '-'}</td>
            <td data-testid="player2-snap-share" style={{ textAlign: 'center' }}>{p2?.latest_snap_share_pct || '-'}</td>
          </tr>
          {(p1?.carries_gap_pct || p2?.carries_gap_pct) && (
            <tr>
              <td><strong>Gap Carries %</strong></td>
              <td data-testid="player1-gap-carries" style={{ textAlign: 'center' }}>{p1?.carries_gap_pct || '-'}</td>
              <td data-testid="player2-gap-carries" style={{ textAlign: 'center' }}>{p2?.carries_gap_pct || '-'}</td>
            </tr>
          )}
          {(p1?.carries_zone_pct || p2?.carries_zone_pct) && (
            <tr>
              <td><strong>Zone Carries %</strong></td>
              <td data-testid="player1-zone-carries" style={{ textAlign: 'center' }}>{p1?.carries_zone_pct || '-'}</td>
              <td data-testid="player2-zone-carries" style={{ textAlign: 'center' }}>{p2?.carries_zone_pct || '-'}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
