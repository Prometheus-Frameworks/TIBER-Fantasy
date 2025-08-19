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

  // Update URL with new search params
  const updateSearchParams = useCallback((params: URLSearchParams, replace: boolean = true) => {
    const newUrl = `${location}?${params.toString()}`;
    if (replace) {
      window.history.replaceState({}, '', newUrl);
    } else {
      setLocation(newUrl);
    }
  }, [location, setLocation]);

  // Sync URL -> state with safe defaults
  useEffect(() => {
    if (loading || !leagueContext) return;

    const teamIdFromUrl = searchParams.get('teamId');
    if (!leagueContext.teams.length) {
      setSelectedTeamId(null);
      return;
    }

    const firstTeamId = leagueContext.teams[0].teamId;

    // If no teamId in URL, set it
    if (!teamIdFromUrl) {
      setSelectedTeamId(firstTeamId);
      const next = new URLSearchParams(searchParams);
      next.set('teamId', firstTeamId);
      updateSearchParams(next, true);
      return;
    }

    // If teamId present but invalid, normalize to first
    const exists = teamIds.includes(teamIdFromUrl);
    if (!exists) {
      setSelectedTeamId(firstTeamId);
      const next = new URLSearchParams(searchParams);
      next.set('teamId', firstTeamId);
      updateSearchParams(next, true);
      return;
    }

    // Valid teamId
    if (selectedTeamId !== teamIdFromUrl) {
      setSelectedTeamId(teamIdFromUrl);
    }
  }, [loading, leagueContext, searchParams, updateSearchParams, teamIds, selectedTeamId]);

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

  const handleTeamSelect = useCallback((teamId: string) => {
    if (teamId === selectedTeamId) return;
    setSelectedTeamId(teamId);
    const next = new URLSearchParams(searchParams);
    next.set('teamId', teamId);
    updateSearchParams(next, true);
  }, [searchParams, updateSearchParams, selectedTeamId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{leagueContext.league.name}</h1>
          <p className="text-sm text-gray-500">
            Season {leagueContext.league.season} • Scoring: {leagueContext.league.scoring.toUpperCase()}
          </p>
        </div>
        <button
          onClick={refetch}
          className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Team selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {leagueContext.teams.map(team => (
          <button
            key={team.teamId}
            onClick={() => handleTeamSelect(team.teamId)}
            className={[
              "rounded-lg border p-3 text-left hover:shadow transition",
              selectedTeamId === team.teamId ? "border-blue-600 ring-1 ring-blue-300" : "border-gray-200"
            ].join(' ')}
            aria-pressed={selectedTeamId === team.teamId}
          >
            <div className="font-medium truncate">{team.displayName}</div>
            <div className="text-xs text-gray-500">{team.players.length} players</div>
          </button>
        ))}
      </div>

      {/* Roster view for selected team */}
      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold mb-3">Roster</h2>
        {selectedTeam.players.length === 0 ? (
          <div className="text-sm text-gray-500">No players on this roster.</div>
        ) : (
          <ul className="divide-y">
            {selectedTeam.players.map(pid => {
              const p = leagueContext.players[pid];
              return (
                <li key={pid} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p?.full_name || 'Unknown Player'}</div>
                    <div className="text-xs text-gray-500">
                      {p?.position ?? 'UNK'} • {p?.team ?? 'FA'}
                    </div>
                  </div>
                  {/* Placeholder: add actions later */}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
