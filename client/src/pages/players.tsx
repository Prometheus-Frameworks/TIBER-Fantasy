import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import MobileNav from "@/components/mobile-nav";
import type { Player } from "@shared/schema";

export default function PlayersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  
  const { data: recommendations, isLoading } = useQuery<Player[]>({
    queryKey: ["/api/teams/1/recommendations"],
  });

  const filteredPlayers = recommendations?.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.team.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === "all" || player.position === positionFilter;
    return matchesSearch && matchesPosition;
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mr-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Find Players</h1>
              <p className="text-sm text-gray-500">Search waiver wire and available players</p>
            </div>
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              placeholder="Search players by name or team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Positions</SelectItem>
              <SelectItem value="QB">Quarterback</SelectItem>
              <SelectItem value="RB">Running Back</SelectItem>
              <SelectItem value="WR">Wide Receiver</SelectItem>
              <SelectItem value="TE">Tight End</SelectItem>
              <SelectItem value="K">Kicker</SelectItem>
              <SelectItem value="DEF">Defense</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        <div className="grid gap-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-field-green mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading players...</p>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No players found matching your search criteria.</p>
            </div>
          ) : (
            filteredPlayers.map((player) => (
              <Card key={player.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-field-green rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold">{player.position}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{player.name}</h3>
                      <p className="text-sm text-gray-600">{player.team} • {player.position}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="secondary">{player.injuryStatus}</Badge>
                        <span className="text-sm text-gray-500">
                          {player.ownershipPercentage}% owned
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-field-green">
                      {player.projectedPoints?.toFixed(1)} pts
                    </div>
                    <div className="text-sm text-gray-500">projected</div>
                    <div className="text-sm text-gray-600">
                      Avg: {player.avgPoints?.toFixed(1)}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <MobileNav />
    </div>
  );
}