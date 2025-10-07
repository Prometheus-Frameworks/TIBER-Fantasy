import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeftRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PlayerUsageData {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  games_played: number;
  alignment_outside_pct: number;
  alignment_slot_pct: number;
  target_share_pct: number;
  carries_gap_pct: number;
  carries_zone_pct: number;
  latest_week: number;
  latest_targets: number;
  week6_opponent?: string;
  week6_location?: string;
}

interface CompareResponse {
  data: PlayerUsageData[];
}

export default function PlayerCompare() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split('?')[1]);
  const player1Name = params.get('player1') || '';
  const player2Name = params.get('player2') || '';

  const { data, isLoading, error } = useQuery<CompareResponse>({
    queryKey: ['/api/player-usage-compare', player1Name, player2Name],
    enabled: !!player1Name && !!player2Name,
  });

  if (!player1Name || !player2Name) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Player Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Please provide both player1 and player2 URL parameters.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Example: /compare?player1=romeo+doubs&player2=rashid+shaheed
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Player Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data?.data || data.data.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Player Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No data found for the specified players.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const players = data.data;
  const player1 = players[0];
  const player2 = players[1] || players[0]; // Fallback if only one player found

  const formatPct = (val: number | null | undefined) => 
    val != null ? `${val.toFixed(1)}%` : 'N/A';

  const formatNumber = (val: number | null | undefined) => 
    val != null ? val.toFixed(1) : 'N/A';

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Player Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" data-testid="compare-table">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Stat</th>
                  <th className="text-center py-3 px-4 font-medium" data-testid="player1-header">
                    {player1.player_name}
                  </th>
                  <th className="text-center py-3 px-4 font-medium" data-testid="player2-header">
                    {player2.player_name}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b" data-testid="row-team">
                  <td className="py-3 px-4 text-muted-foreground">Team</td>
                  <td className="py-3 px-4 text-center" data-testid="player1-team">{player1.team}</td>
                  <td className="py-3 px-4 text-center" data-testid="player2-team">{player2.team}</td>
                </tr>
                <tr className="border-b" data-testid="row-position">
                  <td className="py-3 px-4 text-muted-foreground">Position</td>
                  <td className="py-3 px-4 text-center" data-testid="player1-position">{player1.position}</td>
                  <td className="py-3 px-4 text-center" data-testid="player2-position">{player2.position}</td>
                </tr>
                <tr className="border-b" data-testid="row-games">
                  <td className="py-3 px-4 text-muted-foreground">Games Played</td>
                  <td className="py-3 px-4 text-center" data-testid="player1-games">{player1.games_played}</td>
                  <td className="py-3 px-4 text-center" data-testid="player2-games">{player2.games_played}</td>
                </tr>
                <tr className="border-b" data-testid="row-target-share">
                  <td className="py-3 px-4 text-muted-foreground">Avg Target Share</td>
                  <td className="py-3 px-4 text-center" data-testid="player1-target-share">
                    {formatPct(player1.target_share_pct)}
                  </td>
                  <td className="py-3 px-4 text-center" data-testid="player2-target-share">
                    {formatPct(player2.target_share_pct)}
                  </td>
                </tr>
                <tr className="border-b" data-testid="row-outside">
                  <td className="py-3 px-4 text-muted-foreground">Outside Alignment %</td>
                  <td className="py-3 px-4 text-center" data-testid="player1-outside">
                    {formatPct(player1.alignment_outside_pct)}
                  </td>
                  <td className="py-3 px-4 text-center" data-testid="player2-outside">
                    {formatPct(player2.alignment_outside_pct)}
                  </td>
                </tr>
                <tr className="border-b" data-testid="row-slot">
                  <td className="py-3 px-4 text-muted-foreground">Slot Alignment %</td>
                  <td className="py-3 px-4 text-center" data-testid="player1-slot">
                    {formatPct(player1.alignment_slot_pct)}
                  </td>
                  <td className="py-3 px-4 text-center" data-testid="player2-slot">
                    {formatPct(player2.alignment_slot_pct)}
                  </td>
                </tr>
                <tr className="border-b" data-testid="row-gap">
                  <td className="py-3 px-4 text-muted-foreground">Gap Carries %</td>
                  <td className="py-3 px-4 text-center" data-testid="player1-gap">
                    {formatPct(player1.carries_gap_pct)}
                  </td>
                  <td className="py-3 px-4 text-center" data-testid="player2-gap">
                    {formatPct(player2.carries_gap_pct)}
                  </td>
                </tr>
                <tr className="border-b" data-testid="row-zone">
                  <td className="py-3 px-4 text-muted-foreground">Zone Carries %</td>
                  <td className="py-3 px-4 text-center" data-testid="player1-zone">
                    {formatPct(player1.carries_zone_pct)}
                  </td>
                  <td className="py-3 px-4 text-center" data-testid="player2-zone">
                    {formatPct(player2.carries_zone_pct)}
                  </td>
                </tr>
                <tr className="border-b" data-testid="row-latest-targets">
                  <td className="py-3 px-4 text-muted-foreground">Latest Targets</td>
                  <td className="py-3 px-4 text-center" data-testid="player1-latest-targets">
                    {formatNumber(player1.latest_targets)}
                  </td>
                  <td className="py-3 px-4 text-center" data-testid="player2-latest-targets">
                    {formatNumber(player2.latest_targets)}
                  </td>
                </tr>
                {player1.week6_opponent && (
                  <tr data-testid="row-week6">
                    <td className="py-3 px-4 text-muted-foreground">Week 6 Matchup</td>
                    <td className="py-3 px-4 text-center" data-testid="player1-week6">
                      {player1.week6_location} {player1.week6_opponent}
                    </td>
                    <td className="py-3 px-4 text-center" data-testid="player2-week6">
                      {player2.week6_location} {player2.week6_opponent}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
