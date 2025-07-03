import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TrendingUp, Database, Calculator, Crown } from "lucide-react";
import MobileNav from "@/components/mobile-nav";

export default function PremiumAnalytics() {
  const { toast } = useToast();
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [premiumData, setPremiumData] = useState({
    yardsPerRouteRun: "",
    yardsAfterContact: "",
    routesRun: "",
    airyards: "",
    cushion: "",
    separationScore: "",
    receivingGrade: "",
    contested_catches: "",
    contested_catch_rate: "",
    endzone_targets: "",
    firstdown_rate: "",
    premiumDataSource: "Manual",
    premiumDataWeek: "18"
  });

  const { data: teamPlayers } = useQuery({
    queryKey: ["/api/teams/1/players"],
  });

  const updatePremiumMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/players/${selectedPlayer}/premium`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to update premium analytics");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Premium Analytics Updated",
        description: "Advanced metrics have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/1/players"] });
      setPremiumData({
        yardsPerRouteRun: "",
        yardsAfterContact: "",
        routesRun: "",
        airyards: "",
        cushion: "",
        separationScore: "",
        receivingGrade: "",
        contested_catches: "",
        contested_catch_rate: "",
        endzone_targets: "",
        firstdown_rate: "",
        premiumDataSource: "Manual",
        premiumDataWeek: "18"
      });
      setSelectedPlayer(null);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to save premium analytics data.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer) {
      toast({
        title: "No Player Selected",
        description: "Please select a player first.",
        variant: "destructive",
      });
      return;
    }

    const dataToSubmit = Object.fromEntries(
      Object.entries(premiumData).map(([key, value]) => [
        key,
        value === "" ? null : isNaN(Number(value)) ? value : Number(value)
      ])
    );

    updatePremiumMutation.mutate(dataToSubmit);
  };

  const receivingPlayers = (teamPlayers as any[])?.filter((p: any) => 
    p.position === "WR" || p.position === "TE"
  ) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Crown className="h-8 w-8 text-yellow-500" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Premium Analytics
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Manually enter advanced NFL metrics from PFF, NextGen Stats, or other premium sources
          </p>
        </div>

        <Tabs defaultValue="entry" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entry" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Entry
            </TabsTrigger>
            <TabsTrigger value="view" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              View Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entry">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Advanced Metrics Entry
                </CardTitle>
                <CardDescription>
                  Enter premium analytics data for your players. Data sources: PFF, NextGen Stats, FantasyPros Advanced Stats
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="player">Select Player</Label>
                      <Select value={selectedPlayer?.toString() || ""} onValueChange={(value) => setSelectedPlayer(Number(value))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a WR or TE" />
                        </SelectTrigger>
                        <SelectContent>
                          {receivingPlayers.map((player: any) => (
                            <SelectItem key={player.id} value={player.id.toString()}>
                              {player.name} ({player.position}) - {player.team}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="source">Data Source</Label>
                      <Select value={premiumData.premiumDataSource} onValueChange={(value) => setPremiumData({...premiumData, premiumDataSource: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PFF">Pro Football Focus</SelectItem>
                          <SelectItem value="NextGen">NFL NextGen Stats</SelectItem>
                          <SelectItem value="FantasyPros">FantasyPros Advanced</SelectItem>
                          <SelectItem value="Manual">Manual Entry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="yprr">YPRR (Yards Per Route Run)</Label>
                      <Input
                        id="yprr"
                        type="number"
                        step="0.01"
                        placeholder="2.45"
                        value={premiumData.yardsPerRouteRun}
                        onChange={(e) => setPremiumData({...premiumData, yardsPerRouteRun: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="yaco">YACo (Yards After Contact)</Label>
                      <Input
                        id="yaco"
                        type="number"
                        step="0.01"
                        placeholder="3.2"
                        value={premiumData.yardsAfterContact}
                        onChange={(e) => setPremiumData({...premiumData, yardsAfterContact: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="routes">Routes Run</Label>
                      <Input
                        id="routes"
                        type="number"
                        placeholder="456"
                        value={premiumData.routesRun}
                        onChange={(e) => setPremiumData({...premiumData, routesRun: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="airyards">Air Yards per Target</Label>
                      <Input
                        id="airyards"
                        type="number"
                        step="0.01"
                        placeholder="8.5"
                        value={premiumData.airyards}
                        onChange={(e) => setPremiumData({...premiumData, airyards: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="separation">Separation Score</Label>
                      <Input
                        id="separation"
                        type="number"
                        step="0.01"
                        placeholder="2.8"
                        value={premiumData.separationScore}
                        onChange={(e) => setPremiumData({...premiumData, separationScore: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pffgrade">PFF Receiving Grade</Label>
                      <Input
                        id="pffgrade"
                        type="number"
                        step="0.1"
                        placeholder="85.2"
                        value={premiumData.receivingGrade}
                        onChange={(e) => setPremiumData({...premiumData, receivingGrade: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contested">Contested Catches</Label>
                      <Input
                        id="contested"
                        type="number"
                        placeholder="12"
                        value={premiumData.contested_catches}
                        onChange={(e) => setPremiumData({...premiumData, contested_catches: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contestedrate">Contested Catch Rate (%)</Label>
                      <Input
                        id="contestedrate"
                        type="number"
                        step="0.01"
                        placeholder="65.2"
                        value={premiumData.contested_catch_rate}
                        onChange={(e) => setPremiumData({...premiumData, contested_catch_rate: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="firstdown">First Down Rate (%)</Label>
                      <Input
                        id="firstdown"
                        type="number"
                        step="0.01"
                        placeholder="22.5"
                        value={premiumData.firstdown_rate}
                        onChange={(e) => setPremiumData({...premiumData, firstdown_rate: e.target.value})}
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={updatePremiumMutation.isPending || !selectedPlayer}
                    className="w-full"
                  >
                    {updatePremiumMutation.isPending ? "Saving..." : "Save Premium Analytics"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="view">
            <div className="grid gap-6">
              {receivingPlayers.map((player: any) => (
                <Card key={player.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{player.name} ({player.position})</span>
                      <Badge variant="outline">{player.team}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-slate-600 dark:text-slate-400">YPRR</p>
                        <p className="text-lg font-bold">{player.yardsPerRouteRun || "—"}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-600 dark:text-slate-400">YACo</p>
                        <p className="text-lg font-bold">{player.yardsAfterContact || "—"}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-600 dark:text-slate-400">Routes</p>
                        <p className="text-lg font-bold">{player.routesRun || "—"}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-600 dark:text-slate-400">PFF Grade</p>
                        <p className="text-lg font-bold">{player.receivingGrade || "—"}</p>
                      </div>
                    </div>
                    {player.premiumDataSource && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-slate-500">
                          Source: {player.premiumDataSource} | Week {player.premiumDataWeek} | 
                          Updated: {player.premiumDataUpdated ? new Date(player.premiumDataUpdated).toLocaleDateString() : "Never"}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <MobileNav />
    </div>
  );
}