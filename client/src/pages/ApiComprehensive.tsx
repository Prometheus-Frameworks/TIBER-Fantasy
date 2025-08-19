import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, RefreshCw, Users, Calendar } from "lucide-react";

export default function ApiComprehensive() {
  const [syncSource, setSyncSource] = useState<"sleeper" | "espn" | "yahoo">("sleeper");

  const { data: version } = useQuery({
    queryKey: ["/api/version"],
    queryFn: () => api.version()
  });

  const { data: health } = useQuery({
    queryKey: ["/api/health"],
    queryFn: () => api.health()
  });

  const { data: adpStatus } = useQuery({
    queryKey: ["/api/adp/status"],
    queryFn: () => api.adpStatus(),
    refetchInterval: 5000
  });

  const { data: usageLeaders } = useQuery({
    queryKey: ["/api/usage-leaders"],
    queryFn: () => api.usageLeaders({ metric: "tgt_share", limit: 5 })
  });

  const { data: redraftWeeks } = useQuery({
    queryKey: ["/api/redraft/weeks"],
    queryFn: () => api.redraftWeeks(2024)
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Comprehensive API Client
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Complete type-safe API coverage with real NFL data integration
          </p>
        </div>
        
        {version && (
          <Badge variant="secondary" className="font-mono">
            {version.build.slice(-12)}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* System Health */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Database className="h-5 w-5 text-green-600 mr-2" />
            <CardTitle className="text-lg">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            {health ? (
              <div className="space-y-2">
                {Object.entries(health).map(([service, status]) => (
                  <div key={service} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{service}</span>
                    <Badge variant={status === "ok" ? "secondary" : "destructive"}>
                      {status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking health...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ADP Sync Status */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <RefreshCw className="h-5 w-5 text-blue-600 mr-2" />
            <CardTitle className="text-lg">ADP Sync</CardTitle>
          </CardHeader>
          <CardContent>
            {adpStatus ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Status:</span>
                  <Badge variant={adpStatus.data.status === "success" ? "secondary" : "outline"}>
                    {adpStatus.data.status}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Source:</span>
                  <span className="text-sm font-medium">{adpStatus.data.source}</span>
                </div>
                {adpStatus.data.rows && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Records:</span>
                    <span className="text-sm font-medium">{adpStatus.data.rows}</span>
                  </div>
                )}
                <Button 
                  size="sm" 
                  onClick={() => api.adpSync(syncSource)}
                  className="w-full"
                >
                  Sync {syncSource.toUpperCase()}
                </Button>
              </div>
            ) : (
              <div className="text-center text-gray-500">Loading status...</div>
            )}
          </CardContent>
        </Card>

        {/* Usage Leaders */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Users className="h-5 w-5 text-purple-600 mr-2" />
            <CardTitle className="text-lg">Target Share Leaders</CardTitle>
          </CardHeader>
          <CardContent>
            {usageLeaders ? (
              <div className="space-y-2">
                {usageLeaders.data.slice(0, 5).map((leader, idx) => (
                  <div key={leader.id} className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium">{leader.name}</div>
                      <div className="text-xs text-gray-500">{leader.team} {leader.pos}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {(leader.value * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500">Loading leaders...</div>
            )}
          </CardContent>
        </Card>

        {/* Available Weeks */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Calendar className="h-5 w-5 text-orange-600 mr-2" />
            <CardTitle className="text-lg">Available Data Weeks (2024)</CardTitle>
          </CardHeader>
          <CardContent>
            {redraftWeeks ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  Season {redraftWeeks.data.season}: {redraftWeeks.data.weeks?.length || 0} weeks available
                </div>
                <div className="flex flex-wrap gap-1">
                  {redraftWeeks.data.weeks?.map(week => (
                    <Badge key={week} variant="outline" className="text-xs">
                      W{week}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500">Loading weeks...</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enhanced API Client Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-semibold text-green-600">✓ Complete Coverage</div>
              <div className="text-gray-600">All OpenAPI endpoints</div>
            </div>
            <div>
              <div className="font-semibold text-green-600">✓ Legacy Support</div>
              <div className="text-gray-600">Backward compatibility</div>
            </div>
            <div>
              <div className="font-semibold text-green-600">✓ Real-time Sync</div>
              <div className="text-gray-600">ADP data management</div>
            </div>
            <div>
              <div className="font-semibold text-green-600">✓ Usage Analytics</div>
              <div className="text-gray-600">Performance metrics</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}