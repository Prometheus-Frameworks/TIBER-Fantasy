import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Users, Smartphone, Globe, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function TeamSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [espnData, setEspnData] = useState({ leagueId: "", teamId: "" });
  const [sleeperData, setSleeperData] = useState({ leagueId: "", userId: "" });
  const [manualData, setManualData] = useState({ playerNames: "", teamName: "" });

  // ESPN sync mutation
  const espnMutation = useMutation({
    mutationFn: async (data: { leagueId: string; teamId: string }) => {
      const response = await apiRequest("POST", "/api/teams/1/sync/espn", {
        leagueId: data.leagueId,
        espnTeamId: data.teamId
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "ESPN Team Synced",
        description: `Successfully imported ${data.playersFound} players from ESPN`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", 1] });
      // Redirect to dashboard after successful sync
      setTimeout(() => setLocation("/"), 2000);
    },
    onError: (error) => {
      toast({
        title: "ESPN Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Sleeper sync mutation
  const sleeperMutation = useMutation({
    mutationFn: async (data: { leagueId: string; userId: string }) => {
      const response = await apiRequest("POST", "/api/teams/1/sync/sleeper", {
        leagueId: data.leagueId,
        userId: data.userId
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sleeper Team Synced",
        description: `Successfully imported ${data.playersFound} players from Sleeper`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", 1] });
      // Redirect to dashboard after successful sync
      setTimeout(() => setLocation("/"), 2000);
    },
    onError: (error) => {
      toast({
        title: "Sleeper Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manual import mutation
  const manualMutation = useMutation({
    mutationFn: async (data: { playerNames: string[]; teamName: string }) => {
      const response = await apiRequest("POST", "/api/teams/1/sync/manual", {
        playerNames: data.playerNames,
        teamName: data.teamName
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Manual Import Complete",
        description: `Successfully imported ${data.playersFound} players`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", 1] });
      // Redirect to dashboard after successful sync
      setTimeout(() => setLocation("/"), 2000);
    },
    onError: (error) => {
      toast({
        title: "Manual Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEspnSync = () => {
    if (!espnData.leagueId || !espnData.teamId) {
      toast({
        title: "Missing Information",
        description: "Please provide both League ID and Team ID",
        variant: "destructive",
      });
      return;
    }
    espnMutation.mutate(espnData);
  };

  const handleSleeperSync = () => {
    if (!sleeperData.leagueId || !sleeperData.userId) {
      toast({
        title: "Missing Information", 
        description: "Please provide both League ID and User ID",
        variant: "destructive",
      });
      return;
    }
    sleeperMutation.mutate(sleeperData);
  };

  const handleManualImport = () => {
    if (!manualData.playerNames.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide player names",
        variant: "destructive",
      });
      return;
    }
    
    const playerNames = manualData.playerNames
      .split("\n")
      .map(name => name.trim())
      .filter(name => name.length > 0);
      
    manualMutation.mutate({
      playerNames,
      teamName: manualData.teamName || "My Team"
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Import Your Fantasy Team</h1>
          <p className="text-muted-foreground">
            Connect your existing fantasy team from popular platforms to get comprehensive analysis and recommendations.
          </p>
        </div>

        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Team sync will replace your current roster. Your existing team data will be backed up automatically.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="espn" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="espn" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              ESPN
            </TabsTrigger>
            <TabsTrigger value="sleeper" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Sleeper
            </TabsTrigger>
            <TabsTrigger value="yahoo" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Yahoo
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="espn">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  ESPN Fantasy
                </CardTitle>
                <CardDescription>
                  Import your team from ESPN Fantasy Football. You'll need your League ID and Team ID from your ESPN league URL.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="espn-league-id">League ID</Label>
                    <Input
                      id="espn-league-id"
                      placeholder="e.g., 12345678"
                      value={espnData.leagueId}
                      onChange={(e) => setEspnData(prev => ({ ...prev, leagueId: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="espn-team-id">Team ID</Label>
                    <Input
                      id="espn-team-id"
                      placeholder="e.g., 1"
                      value={espnData.teamId}
                      onChange={(e) => setEspnData(prev => ({ ...prev, teamId: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>How to find your IDs:</strong> Go to your ESPN league page. 
                    The URL will look like: <code>fantasy.espn.com/football/team?leagueId=LEAGUE_ID&teamId=TEAM_ID</code>
                  </p>
                </div>

                <Button 
                  onClick={handleEspnSync}
                  disabled={espnMutation.isPending}
                  className="w-full"
                >
                  {espnMutation.isPending ? "Syncing..." : "Import from ESPN"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sleeper">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Sleeper Fantasy
                </CardTitle>
                <CardDescription>
                  Import your team from Sleeper Fantasy Football. You'll need your League ID and User ID.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sleeper-league-id">League ID</Label>
                    <Input
                      id="sleeper-league-id"
                      placeholder="e.g., 987654321"
                      value={sleeperData.leagueId}
                      onChange={(e) => setSleeperData(prev => ({ ...prev, leagueId: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sleeper-user-id">User ID</Label>
                    <Input
                      id="sleeper-user-id"
                      placeholder="e.g., 123456789"
                      value={sleeperData.userId}
                      onChange={(e) => setSleeperData(prev => ({ ...prev, userId: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>How to find your IDs:</strong> In the Sleeper app, go to League → Settings. 
                    Your League ID is shown there. User ID can be found in your profile URL.
                  </p>
                </div>

                <Button 
                  onClick={handleSleeperSync}
                  disabled={sleeperMutation.isPending}
                  className="w-full"
                >
                  {sleeperMutation.isPending ? "Syncing..." : "Import from Sleeper"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="yahoo">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Yahoo Fantasy
                </CardTitle>
                <CardDescription>
                  Yahoo Fantasy requires special authentication. Use manual import for now.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Yahoo sync requires OAuth authentication which is not yet implemented. 
                    Please use the manual import option below.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Manual Import
                </CardTitle>
                <CardDescription>
                  Manually enter your player names (one per line) to import your team.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Team Name (Optional)</Label>
                  <Input
                    id="team-name"
                    placeholder="e.g., My Championship Team"
                    value={manualData.teamName}
                    onChange={(e) => setManualData(prev => ({ ...prev, teamName: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="player-names">Player Names</Label>
                  <textarea
                    id="player-names"
                    className="w-full min-h-[200px] p-3 border border-input rounded-md bg-background text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder={`Josh Allen
Christian McCaffrey
Tyreek Hill
Travis Kelce
...`}
                    value={manualData.playerNames}
                    onChange={(e) => setManualData(prev => ({ ...prev, playerNames: e.target.value }))}
                  />
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Enter one player name per line. Use full names for best matching results.
                    The system will attempt to match players to our database automatically.
                  </p>
                </div>

                <Button 
                  onClick={handleManualImport}
                  disabled={manualMutation.isPending}
                  className="w-full"
                >
                  {manualMutation.isPending ? "Importing..." : "Import Players"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                What Happens Next
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Your imported players will be analyzed against our comprehensive NFL database</li>
                <li>• We'll identify weak positions and provide detailed recommendations</li>
                <li>• Performance tracking will begin automatically for future weeks</li>
                <li>• You can re-sync your team anytime to get the latest roster updates</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}