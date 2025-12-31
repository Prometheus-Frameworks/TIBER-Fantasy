import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, MinusCircle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AuditCheck {
  key: string;
  status: 'healthy' | 'warning' | 'critical' | 'skipped' | 'info';
  value?: number;
  details: Record<string, unknown>;
}

interface FeatureAuditResponse {
  success: boolean;
  data: {
    status: 'healthy' | 'warning' | 'critical';
    generatedAt: string;
    checks: AuditCheck[];
  };
}

const STATUS_CONFIG = {
  healthy: { color: 'bg-emerald-500', textColor: 'text-emerald-400', icon: CheckCircle2, label: 'Healthy' },
  warning: { color: 'bg-amber-500', textColor: 'text-amber-400', icon: AlertTriangle, label: 'Warning' },
  critical: { color: 'bg-red-500', textColor: 'text-red-400', icon: XCircle, label: 'Critical' },
  info: { color: 'bg-blue-500', textColor: 'text-blue-400', icon: CheckCircle2, label: 'Info' },
  skipped: { color: 'bg-gray-500', textColor: 'text-gray-400', icon: MinusCircle, label: 'Skipped' },
};

const CHECK_LABELS: Record<string, string> = {
  'identity.roster_bridge_coverage': 'Roster Bridge',
  'identity.global_sleeper_id_population': 'Global Sleeper IDs',
  'metricMatrix.vectorCoverage': 'Vector Coverage',
  'metricMatrix.percentScaleSanity': 'Percent Scale',
  'metricMatrix.cacheFreshness': 'Cache Freshness',
  'playerProfile.routes': 'Player Routes',
  'research.similarAndNeighbors': 'Research Hub',
  'ownership.service': 'Ownership Service',
};

function StatusDot({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const config = STATUS_CONFIG[status];
  return (
    <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
  );
}

function CheckRow({ check }: { check: AuditCheck }) {
  const label = CHECK_LABELS[check.key] || check.key;
  const config = STATUS_CONFIG[check.status];
  const valueStr = check.value !== undefined 
    ? `${Math.round(check.value * 100)}%` 
    : null;
  
  const actionHint = check.details?.actionHint as string | undefined;
  const isRosterBridge = check.key === 'identity.roster_bridge_coverage';
  const showHint = isRosterBridge && (check.status === 'skipped' || check.status === 'critical') && actionHint;

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={check.status} />
          <span className="text-sm text-gray-300">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {valueStr && (
            <span className={`text-xs font-mono ${config.textColor}`}>{valueStr}</span>
          )}
        </div>
      </div>
      {showHint && (
        <p className="text-xs text-gray-500 ml-4.5 mt-0.5 pl-4">{actionHint}</p>
      )}
    </div>
  );
}

export default function SystemIntegrityCard() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<FeatureAuditResponse>({
    queryKey: ['/api/system/feature-audit'],
    refetchInterval: 60000,
  });

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const overallStatus = data?.data?.status || 'skipped';
  const overallConfig = STATUS_CONFIG[overallStatus];
  const OverallIcon = overallConfig.icon;
  const checks = data?.data?.checks || [];
  const generatedAt = data?.data?.generatedAt 
    ? new Date(data.data.generatedAt).toLocaleTimeString() 
    : null;

  return (
    <Card 
      className="bg-[#141824] border-gray-800 h-full"
      data-testid="card-system-integrity"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <CardTitle className="text-white text-base">System Integrity</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="h-7 w-7 p-0 text-gray-400 hover:text-white"
            data-testid="button-refresh-audit"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading && !data ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="h-5 w-5 animate-spin text-gray-500" />
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <XCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Failed to load</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 pt-1">
              <div className="flex items-center gap-2">
                <OverallIcon className={`h-5 w-5 ${overallConfig.textColor}`} />
                <Badge 
                  className={`${overallConfig.color} text-white text-xs`}
                  data-testid="badge-overall-status"
                >
                  {overallConfig.label}
                </Badge>
              </div>
              {generatedAt && (
                <span className="text-xs text-gray-500" data-testid="text-generated-time">
                  {generatedAt}
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              {checks.map(check => (
                <CheckRow key={check.key} check={check} />
              ))}
            </div>

            <div className="mt-3 pt-2 border-t border-gray-800">
              <p className="text-xs text-gray-500">
                {checks.length} checks • {checks.filter(c => c.status === 'healthy').length} healthy
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
