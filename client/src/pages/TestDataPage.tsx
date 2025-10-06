import { useQuery } from '@tanstack/react-query';

export default function TestDataPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/test-usage-data'],
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Season Average Usage Data Test</h1>
      <p>Total players: {data?.total || 0}</p>
      
      <table border={1} cellPadding={8} style={{ borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr>
            <th>Player ID</th>
            <th>Games</th>
            <th>Outside %</th>
            <th>Slot %</th>
            <th>Target Share %</th>
            <th>Latest Week</th>
            <th>Latest Snap %</th>
            <th>Max Targets</th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((player: any) => (
            <tr key={player.player_id}>
              <td>{player.player_id}</td>
              <td>{player.games_played}</td>
              <td>{player.avg_outside_pct || '-'}</td>
              <td>{player.avg_slot_pct || '-'}</td>
              <td>{player.avg_target_share || '-'}</td>
              <td>{player.latest_week || '-'}</td>
              <td>{player.latest_snap_share || '-'}</td>
              <td>{player.max_targets || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
