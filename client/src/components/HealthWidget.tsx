import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Activity, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface HealthCheck {
  status: string;
  timestamp: string;
  checks: {
    wr: string;
    rookies: string;
    vorp: string;
    weekly: string;
    intel: string;
    oasis: string;
  };
}

export default function HealthWidget() {
  const [showDetails, setShowDetails] = useState(false);
  
  const { data: health, isLoading } = useQuery<HealthCheck>({
    queryKey: ['/api/health'],
    queryFn: () => fetch('/api/health').then(r => r.json()),
    refetchInterval: 30000, // Check every 30 seconds
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'stale':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'down':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'stale':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'down':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const overallStatus = health?.status || 'unknown';
  const allChecks = health?.checks || {};
  const downServices = Object.entries(allChecks).filter(([, status]) => status === 'down').length;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4" />
          API Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(overallStatus)}
            <Badge className={getStatusColor(overallStatus)}>
              {overallStatus.toUpperCase()}
            </Badge>
          </div>
          
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                Details
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>API Health Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  Last Check: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'Unknown'}
                </div>
                
                <div className="space-y-2">
                  {Object.entries(allChecks).map(([service, status]) => (
                    <div key={service} className="flex items-center justify-between p-2 border rounded">
                      <span className="font-medium capitalize">{service}</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status)}
                        <Badge className={getStatusColor(status)}>
                          {status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
                  <strong>Raw Response:</strong>
                  <pre className="mt-2 text-xs overflow-auto">
                    {JSON.stringify(health, null, 2)}
                  </pre>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {downServices > 0 && (
          <div className="mt-2 text-xs text-red-600">
            {downServices} service{downServices > 1 ? 's' : ''} down
          </div>
        )}
        
        {isLoading && (
          <div className="mt-2 text-xs text-gray-500">
            Checking...
          </div>
        )}
      </CardContent>
    </Card>
  );
}