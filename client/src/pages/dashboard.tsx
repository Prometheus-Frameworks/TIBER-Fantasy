import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useLeagueContext } from '@/hooks/useLeagueContext';

// UI Components for loading, error, and empty states
interface LoadingSpinnerProps { message?: string; }
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Loading...' }) => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" aria-label="loading" />
    <span className="ml-3 text-gray-600">{message}</span>
  </div>
);

const ErrorMessage: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
    <div className="text-red-800 mb-4">{message}</div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
      >
        Try Again
      </button>
    )}
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
    <div className="text-gray-600">{message}</div>
  </div>
);

function Dashboard() {
  const [location, setLocation] = useLocation();
  const { leagueContext, loading, error, refetch } = useLeagueContext();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Get search params from current URL
  const searchParams = useMemo(() => {
    const url = new URL(window.location.href);
    return url.searchParams;
  }, [location]);

  // Memo to avoid re-computing
  const teamIds = useMemo(() => (leagueContext?.teams ?? []).map(t => t.teamId), [leagueContext]);

  // Update URL with new search params - always creates new URLSearchParams
  const updateSearchParams = useCallback((newTeamId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('teamId', newTeamId);
    const newUrl = `${location.split('?')[0]}?${next.toString()}`;
    window.history.replaceState({}, '', newUrl);
    // Trigger location change for wouter
    setLocation(newUrl);
  }, [location, searchParams, setLocation]);

  // Sync URL -> state with safe defaults
  useEffect(() => {
    if (loading || !leagueContext) return;

    const urlTeam = searchParams.get('teamId');
    if (!leagueContext.teams.length) {
      setSelectedTeamId(null);
      return;
    }

    const first = leagueContext.teams[0].teamId;

    // No team in URL → set first
    if (!urlTeam) {
      setSelectedTeamId(first);
      const next = new URLSearchParams(searchParams);
      next.set('teamId', first);
      const newUrl = `${location.split('?')[0]}?${next.toString()}`;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    // Invalid team in URL → normalize to first
    if (!teamIds.includes(urlTeam)) {
      setSelectedTeamId(first);
      const next = new URLSearchParams(searchParams);
      next.set('teamId', first);
      const newUrl = `${location.split('?')[0]}?${next.toString()}`;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    // Valid team - only set state, don't write URL
    if (selectedTeamId !== urlTeam) {
      setSelectedTeamId(urlTeam);
    }
  }, [loading, leagueContext, searchParams, teamIds, selectedTeamId, location]);

  // Stable team change handler
  const handleTeamChange = useCallback((newTeamId: string) => {
    if (newTeamId === selectedTeamId) return; // No-op if same team
    setSelectedTeamId(newTeamId);
    updateSearchParams(newTeamId);
  }, [selectedTeamId, updateSearchParams]);

  // Loading state
  if (loading) return <LoadingSpinner message="Loading team data..." />;

  // Error state
  if (error) {
    return <ErrorMessage message="Unable to load team data. Please try again." onRetry={refetch} />;
  }

  // No league context / teams
  if (!leagueContext) return <EmptyState message="No league data available." />;
  if (!leagueContext.teams.length) return <EmptyState message="No teams found in this league." />;
  if (!selectedTeamId) return <LoadingSpinner message="Selecting team..." />;

  const selectedTeam = leagueContext.teams.find(t => t.teamId === selectedTeamId);
  if (!selectedTeam) return <ErrorMessage message="Selected team not found." onRetry={refetch} />;

  // Map players with fallback for unknown players
  const teamPlayers = selectedTeam.players.map(pid => {
    const p = leagueContext.players[pid];
    return p || { 
      player_id: pid, 
      full_name: 'Unknown Player', 
      position: 'UNK', 
      team: null, 
      free_agent: true 
    };
  });

  return (
    <div className="dashboard-container">
      {/* League Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <h1 className="text-2xl font-bold text-gray-900">{leagueContext.league.name}</h1>
        <p className="text-gray-600">
          {leagueContext.league.season} • {leagueContext.league.scoring.toUpperCase()} Scoring
        </p>
      </div>

      {/* Team Selector */}
      <div className="bg-white border-b border-gray-200 p-4">
        <label htmlFor="team-select" className="block text-sm font-medium text-gray-700 mb-2">
          Select Team:
        </label>
        <select
          id="team-select"
          value={selectedTeamId ?? ''}
          onChange={(e) => handleTeamChange(e.target.value)}
          className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          {leagueContext.teams.map(team => (
            <option key={team.teamId} value={team.teamId}>
              {team.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Team Details */}
      <div className="p-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">{selectedTeam.displayName}</h2>
            <p className="text-gray-600">
              {teamPlayers.length} players • Owner: {selectedTeam.ownerId}
            </p>
          </div>

          {/* Players List */}
          <div className="p-6">
            {teamPlayers.length === 0 ? (
              <EmptyState message="No players on this team." />
            ) : (
              <div className="space-y-3">
                {teamPlayers.map((player) => (
                  <div key={player.player_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                          {player.position}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{player.full_name}</h3>
                        <p className="text-sm text-gray-500">
                          {player.team || 'Free Agent'}{(player as any).status ? ` • ${(player as any).status}` : ''}
                        </p>
                      </div>
                    </div>
                    {(player as any).free_agent && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        FA
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
