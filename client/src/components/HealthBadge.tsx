import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  services: {
    sleeper_sync: {
      status: string;
      players_count: number;
      cache_stale: boolean;
      last_sync: string;
    };
    logs_projections: {
      status: string;
      game_logs: number;
      projections: number;
      season_stats: number;
      last_updated: string;
    };
    ratings_engine: {
      status: string;
      total_players: number;
      by_position: Record<string, number>;
      by_tier: Record<string, number>;
    };
    legacy: Record<string, string>;
  };
}

interface HealthBadgeProps {
  isDemoMode?: boolean;
}

const HealthBadge: React.FC<HealthBadgeProps> = ({ isDemoMode = false }) => {
  const [signal, setSignal] = React.useState<null | string>(null);

  React.useEffect(() => {
    fetch("/api/signal")
      .then(r => r.json())
      .then(j => setSignal(j?.key || null))
      .catch(() => {});
  }, []);

  const { data: healthData, isLoading, error } = useQuery<HealthStatus>({
    queryKey: ['/api/health'],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 2,
    staleTime: 10000, // 10 seconds
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      default:
        return <Activity className="h-3 w-3 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
        <Activity className="h-3 w-3 mr-1 animate-pulse" />
        Checking...
      </div>
    );
  }

  if (error || !healthData) {
    return (
      <div className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 border border-red-200">
        <AlertTriangle className="h-3 w-3 mr-1" />
        API Error
      </div>
    );
  }

  const overallStatus = healthData.status;
  const playerCount = healthData.services.sleeper_sync.players_count;
  const version = healthData.version;
  
  return (
    <div className="flex items-center space-x-2">
      {/* Main Status Badge */}
      <div className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(overallStatus)}`}>
        {getStatusIcon(overallStatus)}
        <span className="ml-1 capitalize">{overallStatus}</span>
      </div>

      {/* Quick Stats */}
      <div className="hidden sm:flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-2">
        <span>{playerCount?.toLocaleString()} players</span>
        <span>•</span>
        <span>{version}</span>
        {signal ? `Signal: ${signal}` : "Signal: n/a"}
        {isDemoMode && (
          <>
            <span>•</span>
            <span className="text-yellow-600 font-medium">DEMO</span>
          </>
        )}
      </div>

      {/* Service Status Indicators (on hover) */}
      <div className="group relative">
        <div className="flex items-center space-x-1">
          {Object.entries(healthData.services).map(([service, data]) => {
            if (service === 'legacy') return null;
            const status = typeof data === 'object' && 'status' in data ? data.status : 'unknown';
            return (
              <div key={service} className={`w-2 h-2 rounded-full ${status === 'ok' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            );
          })}
        </div>

        {/* Hover Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          <div className="font-semibold mb-2">Service Status</div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span>Sleeper Sync:</span>
              <span className={healthData.services.sleeper_sync.status === 'ok' ? 'text-green-400' : 'text-red-400'}>
                {healthData.services.sleeper_sync.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ratings Engine:</span>
              <span className={healthData.services.ratings_engine.status === 'ok' ? 'text-green-400' : 'text-red-400'}>
                {healthData.services.ratings_engine.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Logs & Projections:</span>
              <span className={healthData.services.logs_projections.status === 'ok' ? 'text-green-400' : 'text-red-400'}>
                {healthData.services.logs_projections.status}
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Updated: {new Date(healthData.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthBadge;