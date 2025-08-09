import WeeklyDataTable from "@/components/WeeklyDataTable";
import RookieSpotlight from "@/components/RookieSpotlight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, TrendingUp, BarChart3 } from "lucide-react";

export default function WeeklyData() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          2024 Weekly Player Data
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Comprehensive weekly performance data from the OTC pipeline. 
          Track player targets, rushing attempts, fantasy points, and depth chart positions across the 2024 NFL season.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Source</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">nflfastR</div>
            <p className="text-xs text-muted-foreground">
              Via nfl-data-py pipeline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Records</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7,027</div>
            <p className="text-xs text-muted-foreground">
              Player-week combinations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">QB/RB/WR/TE</div>
            <p className="text-xs text-muted-foreground">
              Fantasy skill positions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Spotlight Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WeeklyDataTable />
        </div>
        <div className="space-y-4">
          <RookieSpotlight week={1} limit={5} />
          <RookieSpotlight team="KC" week={1} limit={3} />
        </div>
      </div>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pipeline Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Data Collection</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Weekly stats from nflfastR API</li>
                <li>• Depth charts from nflverse</li>
                <li>• Team name standardization (JAX → JAC)</li>
                <li>• Position filtering and validation</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Data Processing</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Multi-source data merging</li>
                <li>• JSONL format for efficient streaming</li>
                <li>• Fantasy vs IDP position separation</li>
                <li>• Automated pipeline via run_pipeline.sh</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}