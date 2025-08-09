import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

interface TeamData {
  team?: string;
  abbr?: string;
  oasis_score?: number;
  [key: string]: any;
}

export default function Oasis() {
  // Fetch all OASIS data endpoints
  const { data: teamsData, isLoading: teamsLoading, error: teamsError } = useQuery({
    queryKey: ['/api/oasis/teams'],
    staleTime: 5 * 60 * 1000,
    retry: 2
  });

  const { data: offenseData, isLoading: offenseLoading } = useQuery({
    queryKey: ['/api/oasis/metrics/offense'],
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  const { data: targetsData, isLoading: targetsLoading } = useQuery({
    queryKey: ['/api/oasis/targets/distribution'],
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Console logging for debugging
  useEffect(() => {
    if (Array.isArray(teamsData) && teamsData.length > 0) {
      console.log("[OASIS] teams sample:", teamsData[0]);
    }
    if (Array.isArray(offenseData) && offenseData.length > 0) {
      console.log("[OASIS] offense sample:", offenseData[0]);
    }
    if (Array.isArray(targetsData) && targetsData.length > 0) {
      console.log("[OASIS] targets sample:", targetsData[0]);
    }
  }, [teamsData, offenseData, targetsData]);

  // Process teams data
  const teams: TeamData[] = Array.isArray(teamsData) ? teamsData : [];
  const hasOasisScore = teams.length > 0 && teams[0]?.oasis_score !== undefined;
  
  // Sort teams by oasis_score if available
  const sortedTeams = hasOasisScore 
    ? teams.filter(t => t.oasis_score !== undefined).sort((a, b) => (b.oasis_score || 0) - (a.oasis_score || 0)).slice(0, 10)
    : teams.slice(0, 10);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            OASIS: Team Environments
          </h1>
          <p className="text-gray-600">
            Offensive Architecture Scoring & Insight System
          </p>
        </div>

        {/* Warning banner if oasis_score is missing */}
        {teams.length > 0 && !hasOasisScore && (
          <Alert className="mb-6">
            <AlertDescription>
              Warning: oasis_score field not found in API response. Check console for data structure.
            </AlertDescription>
          </Alert>
        )}

        {/* Loading state */}
        {teamsLoading && (
          <div className="text-center py-8">
            <div className="text-gray-600">Loading teams data...</div>
          </div>
        )}

        {/* Error state */}
        {teamsError && (
          <Alert className="mb-6">
            <AlertDescription>
              Error loading teams data: {teamsError instanceof Error ? teamsError.message : 'Unknown error'}
            </AlertDescription>
          </Alert>
        )}

        {/* Teams list */}
        {sortedTeams.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {hasOasisScore ? 'Top 10 Teams by OASIS Score' : 'Teams (First 10)'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sortedTeams.map((team, index) => (
                  <div
                    key={team.team || team.abbr || index}
                    className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-500 w-6">
                        {index + 1}
                      </span>
                      <div className="font-semibold">
                        {team.team || team.abbr || 'Unknown Team'}
                      </div>
                    </div>
                    {hasOasisScore && (
                      <div className="font-bold text-lg">
                        {team.oasis_score?.toFixed(1) || 'N/A'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug info */}
        <div className="mt-8 text-xs text-gray-500">
          <div>Teams: {teamsLoading ? 'Loading...' : teams.length}</div>
          <div>Offense: {offenseLoading ? 'Loading...' : Array.isArray(offenseData) ? offenseData.length : 'N/A'}</div>
          <div>Targets: {targetsLoading ? 'Loading...' : Array.isArray(targetsData) ? targetsData.length : 'N/A'}</div>
        </div>
      </div>
    </div>
  );
}