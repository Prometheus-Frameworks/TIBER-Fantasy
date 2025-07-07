/**
 * ADP Status Indicator - Shows sync status and allows manual refresh
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Settings, CheckCircle, AlertCircle } from "lucide-react";

interface ADPStatus {
  lastSync: string | null;
  source: string;
  enabled: boolean;
  autoSyncActive: boolean;
  nextSync: string;
}

export function ADPStatusIndicator() {
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  // Get current sync status
  const { data: status } = useQuery<ADPStatus>({
    queryKey: ['/api/adp/status'],
    refetchInterval: 30000 // Check every 30 seconds
  });

  // Manual sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/adp/sync', { method: 'POST' });
      if (!response.ok) throw new Error('Sync failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/players/enhanced-adp'] });
      queryClient.invalidateQueries({ queryKey: ['/api/adp/status'] });
    }
  });

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncMutation.mutateAsync();
    } finally {
      setIsSyncing(false);
    }
  };

  if (!status) return null;

  const lastSyncTime = status.lastSync 
    ? new Date(status.lastSync).toLocaleTimeString()
    : 'Never';

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
      {/* Status Badge */}
      <Badge 
        variant={status.enabled ? "default" : "secondary"}
        className="text-xs"
      >
        {status.enabled ? (
          <>
            <CheckCircle className="w-3 h-3 mr-1" />
            Auto-Sync Active
          </>
        ) : (
          <>
            <AlertCircle className="w-3 h-3 mr-1" />
            Manual Only
          </>
        )}
      </Badge>

      {/* Source Info */}
      <div className="text-xs text-slate-600">
        Source: <span className="font-medium capitalize">{status.source}</span>
      </div>

      {/* Last Sync */}
      <div className="text-xs text-slate-600">
        Last: <span className="font-medium">{lastSyncTime}</span>
      </div>

      {/* Manual Sync Button */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleManualSync}
        disabled={isSyncing || syncMutation.isPending}
        className="text-xs h-7"
      >
        <RefreshCw className={`w-3 h-3 mr-1 ${(isSyncing || syncMutation.isPending) ? 'animate-spin' : ''}`} />
        Sync Now
      </Button>

      {/* Settings Hint */}
      <div className="text-xs text-slate-400">
        Next: {status.nextSync}
      </div>
    </div>
  );
}