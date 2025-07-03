import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CalendarIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon, PlusIcon } from "lucide-react";
import type { DynastyTradeHistory } from "@shared/schema";

export default function TradeHistory() {
  const { id } = useParams();
  const teamId = parseInt(id!);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tradeForm, setTradeForm] = useState({
    playersGiven: [{ playerName: "", position: "", age: "" }],
    playersReceived: [{ playerName: "", position: "", age: "" }],
    draftPicksGiven: [{ year: "", round: "", pick: "" }],
    draftPicksReceived: [{ year: "", round: "", pick: "" }],
    tradeValue: "",
    tradeGrade: "",
    notes: "",
    season: "2024",
    week: ""
  });

  const { data: trades, isLoading } = useQuery<DynastyTradeHistory[]>({
    queryKey: [`/api/teams/${teamId}/trades`],
  });

  const addTradeMutation = useMutation({
    mutationFn: async (tradeData: any) => {
      const payload = {
        ...tradeData,
        playersGiven: JSON.stringify(tradeData.playersGiven.filter((p: any) => p.playerName.trim())),
        playersReceived: JSON.stringify(tradeData.playersReceived.filter((p: any) => p.playerName.trim())),
        draftPicksGiven: JSON.stringify(tradeData.draftPicksGiven.filter((p: any) => p.year.trim())),
        draftPicksReceived: JSON.stringify(tradeData.draftPicksReceived.filter((p: any) => p.year.trim())),
        tradeValue: tradeData.tradeValue ? parseFloat(tradeData.tradeValue) : null,
        week: tradeData.week ? parseInt(tradeData.week) : null,
        season: parseInt(tradeData.season)
      };
      
      return apiRequest(`/api/teams/${teamId}/trades`, "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/trades`] });
      setIsDialogOpen(false);
      setTradeForm({
        playersGiven: [{ playerName: "", position: "", age: "" }],
        playersReceived: [{ playerName: "", position: "", age: "" }],
        draftPicksGiven: [{ year: "", round: "", pick: "" }],
        draftPicksReceived: [{ year: "", round: "", pick: "" }],
        tradeValue: "",
        tradeGrade: "",
        notes: "",
        season: "2024",
        week: ""
      });
      toast({
        title: "Trade Added",
        description: "Trade has been successfully added to your history.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add trade. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addPlayer = (type: 'given' | 'received') => {
    const key = type === 'given' ? 'playersGiven' : 'playersReceived';
    setTradeForm(prev => ({
      ...prev,
      [key]: [...prev[key], { playerName: "", position: "", age: "" }]
    }));
  };

  const removePlayer = (type: 'given' | 'received', index: number) => {
    const key = type === 'given' ? 'playersGiven' : 'playersReceived';
    setTradeForm(prev => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index)
    }));
  };

  const updatePlayer = (type: 'given' | 'received', index: number, field: string, value: string) => {
    const key = type === 'given' ? 'playersGiven' : 'playersReceived';
    setTradeForm(prev => ({
      ...prev,
      [key]: prev[key].map((player, i) => 
        i === index ? { ...player, [field]: value } : player
      )
    }));
  };

  const getTradeGradeBadge = (grade: string) => {
    const gradeColors: Record<string, string> = {
      'A+': 'bg-green-600 text-white',
      'A': 'bg-green-500 text-white',
      'B+': 'bg-green-400 text-white',
      'B': 'bg-yellow-500 text-white',
      'C+': 'bg-yellow-400 text-black',
      'C': 'bg-orange-400 text-white',
      'D+': 'bg-orange-500 text-white',
      'D': 'bg-red-500 text-white',
      'F': 'bg-red-600 text-white'
    };
    
    return (
      <Badge className={gradeColors[grade] || 'bg-gray-400 text-white'}>
        {grade}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dynasty Trade History</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Trade</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Trade</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Players Given */}
              <div>
                <Label className="text-lg font-semibold">Players Given Away</Label>
                {tradeForm.playersGiven.map((player, index) => (
                  <div key={index} className="flex gap-2 mt-2">
                    <Input
                      placeholder="Player Name"
                      value={player.playerName}
                      onChange={(e) => updatePlayer('given', index, 'playerName', e.target.value)}
                    />
                    <Input
                      placeholder="Position"
                      value={player.position}
                      onChange={(e) => updatePlayer('given', index, 'position', e.target.value)}
                    />
                    <Input
                      placeholder="Age"
                      value={player.age}
                      onChange={(e) => updatePlayer('given', index, 'age', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removePlayer('given', index)}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addPlayer('given')}
                  className="mt-2"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Player
                </Button>
              </div>

              {/* Players Received */}
              <div>
                <Label className="text-lg font-semibold">Players Received</Label>
                {tradeForm.playersReceived.map((player, index) => (
                  <div key={index} className="flex gap-2 mt-2">
                    <Input
                      placeholder="Player Name"
                      value={player.playerName}
                      onChange={(e) => updatePlayer('received', index, 'playerName', e.target.value)}
                    />
                    <Input
                      placeholder="Position"
                      value={player.position}
                      onChange={(e) => updatePlayer('received', index, 'position', e.target.value)}
                    />
                    <Input
                      placeholder="Age"
                      value={player.age}
                      onChange={(e) => updatePlayer('received', index, 'age', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removePlayer('received', index)}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addPlayer('received')}
                  className="mt-2"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Player
                </Button>
              </div>

              {/* Trade Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Trade Grade</Label>
                  <Select 
                    value={tradeForm.tradeGrade} 
                    onValueChange={(value) => setTradeForm(prev => ({ ...prev, tradeGrade: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C+">C+</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D+">D+</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                      <SelectItem value="F">F</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trade Value</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 1.2"
                    value={tradeForm.tradeValue}
                    onChange={(e) => setTradeForm(prev => ({ ...prev, tradeValue: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Season</Label>
                  <Input
                    type="number"
                    value={tradeForm.season}
                    onChange={(e) => setTradeForm(prev => ({ ...prev, season: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Week</Label>
                  <Input
                    type="number"
                    placeholder="Optional"
                    value={tradeForm.week}
                    onChange={(e) => setTradeForm(prev => ({ ...prev, week: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  placeholder="Trade reasoning, context, or analysis..."
                  value={tradeForm.notes}
                  onChange={(e) => setTradeForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <Button 
                onClick={() => addTradeMutation.mutate(tradeForm)}
                disabled={addTradeMutation.isPending}
              >
                {addTradeMutation.isPending ? "Adding..." : "Add Trade"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!trades || trades.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No trades recorded yet. Add your first trade to start tracking your dynasty moves.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {trades.map((trade) => {
            const playersGiven = JSON.parse(trade.playersGiven || '[]');
            const playersReceived = JSON.parse(trade.playersReceived || '[]');
            
            return (
              <Card key={trade.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">
                      Trade #{trade.id} - {trade.season} {trade.week && `Week ${trade.week}`}
                    </CardTitle>
                    <div className="flex gap-2 items-center">
                      {trade.tradeGrade && getTradeGradeBadge(trade.tradeGrade)}
                      <Badge variant="outline" className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {trade.tradeDate ? new Date(trade.tradeDate).toLocaleDateString() : 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                        <TrendingDownIcon className="h-4 w-4" />
                        Traded Away
                      </h4>
                      <div className="space-y-1">
                        {playersGiven.map((player: any, index: number) => (
                          <div key={index} className="text-sm">
                            <span className="font-medium">{player.playerName}</span>
                            {player.position && <span className="text-muted-foreground"> ({player.position})</span>}
                            {player.age && <span className="text-muted-foreground"> - Age {player.age}</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-green-600 mb-2 flex items-center gap-2">
                        <TrendingUpIcon className="h-4 w-4" />
                        Received
                      </h4>
                      <div className="space-y-1">
                        {playersReceived.map((player: any, index: number) => (
                          <div key={index} className="text-sm">
                            <span className="font-medium">{player.playerName}</span>
                            {player.position && <span className="text-muted-foreground"> ({player.position})</span>}
                            {player.age && <span className="text-muted-foreground"> - Age {player.age}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {trade.notes && (
                    <>
                      <Separator className="my-4" />
                      <div>
                        <h4 className="font-semibold mb-2">Notes</h4>
                        <p className="text-sm text-muted-foreground">{trade.notes}</p>
                      </div>
                    </>
                  )}

                  {trade.tradeValue && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex justify-between text-sm">
                        <span>Trade Value:</span>
                        <span className={`font-medium ${
                          trade.tradeValue > 1 ? 'text-green-600' : 
                          trade.tradeValue < 1 ? 'text-red-600' : 
                          'text-gray-600'
                        }`}>
                          {trade.tradeValue.toFixed(1)}x
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}