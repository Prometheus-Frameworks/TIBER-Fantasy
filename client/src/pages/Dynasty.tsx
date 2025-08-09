import RookieClass2025 from "@/components/RookieClass2025";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, TrendingUp, Users, Calendar, Trophy } from "lucide-react";

export default function DynastyPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Crown className="h-8 w-8 text-yellow-600" />
          Dynasty 2025
        </h1>
        <p className="text-muted-foreground">
          Long-term strategy and prospect evaluation for dynasty leagues
        </p>
      </div>

      {/* Dynasty Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Capital</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2025</div>
            <p className="text-xs text-muted-foreground">
              Rookie draft class
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Age Curves</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Analytics</div>
            <p className="text-xs text-muted-foreground">
              Decline detection active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trade Value</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Live</div>
            <p className="text-xs text-muted-foreground">
              Market efficiency tracking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projections</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3-Year</div>
            <p className="text-xs text-muted-foreground">
              Dynasty timeline active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rookie Class Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Rookie Class 2025 Dynasty Value</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RookieClass2025 season={2024} week={18} limit={6} />
          <RookieClass2025 season={2024} week={17} limit={6} />
        </div>
      </section>

      {/* Dynasty Tools Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Dynasty Tools & Analytics</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg text-muted-foreground">Age Cliff Detection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Identify players approaching performance decline phases
              </p>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg text-muted-foreground">Trade Calculator</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Multi-year value projections and trade fairness analysis
              </p>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg text-muted-foreground">Prospect Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                College scouting reports and draft capital projections
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Dynasty Strategy Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-muted-foreground">Dynasty Strategy Hub</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Contending Windows
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Identify optimal timing for championship pushes based on roster composition and age curves.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Rebuild Phase</span>
                  <span className="text-red-600">0-2 years</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Competing Phase</span>
                  <span className="text-green-600">2-4 years</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Transition Phase</span>
                  <span className="text-yellow-600">4+ years</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Asset Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Maximize roster value through strategic trading and draft capital allocation.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Draft Picks</span>
                  <span className="font-medium">Premium Assets</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Young Players</span>
                  <span className="font-medium">Growth Potential</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Veterans</span>
                  <span className="font-medium">Win-Now Value</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}