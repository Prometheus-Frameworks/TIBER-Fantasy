import RookieSpotlight from "@/components/RookieSpotlight";
import RookieClass2025 from "@/components/RookieClass2025";
import WeeklyDataTable from "@/components/WeeklyDataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Calendar, Target } from "lucide-react";

export default function RedraftPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Redraft 2025</h1>
        <p className="text-muted-foreground">
          Essential tools and insights for your 2025 redraft leagues
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Week 22</div>
            <p className="text-xs text-muted-foreground">
              2024 Season Complete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Analytics</div>
            <p className="text-xs text-muted-foreground">
              Weekly breakouts tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rookie Class</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2025</div>
            <p className="text-xs text-muted-foreground">
              Draft prospects available
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rookie Spotlight Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Rookie Spotlight (Class of 2025)</h2>
        </div>
        
        <RookieClass2025 season={2024} week={1} />
      </section>

      {/* Weekly Performance Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Weekly Performance Data</h2>
        </div>
        
        <WeeklyDataTable />
      </section>

      {/* Future Sections Placeholder */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-muted-foreground">Coming Soon</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg text-muted-foreground">ADP Tracker</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Real-time average draft position data and trends
              </p>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg text-muted-foreground">Weekly Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Target share and snap count analytics
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}