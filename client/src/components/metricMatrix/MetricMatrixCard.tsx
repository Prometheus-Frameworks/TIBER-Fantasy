import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface MetricMatrixResponse {
  success: boolean;
  data: {
    playerId: string;
    playerName: string | null;
    position: string | null;
    team: string | null;
    season: number | null;
    week: number | null;
    mode: string;
    axes: Array<{
      key: string;
      label: string;
      value: number;
      components: Array<{ key: string; value: number | null }>;
    }>;
    confidence: number;
    missingInputs: string[];
  };
}

interface MetricMatrixCardProps {
  playerId: string;
  season: number;
  week: number;
  enabled?: boolean;
}

export default function MetricMatrixCard({ playerId, season, week, enabled = true }: MetricMatrixCardProps) {
  const { data: metricMatrix, isLoading, isError } = useQuery<MetricMatrixResponse>({
    queryKey: ['/api/metric-matrix/player-vector', playerId, season, week],
    queryFn: async () => {
      const params = new URLSearchParams({ playerId, season: String(season), week: String(week) });
      const res = await fetch(`/api/metric-matrix/player-vector?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch metric matrix');
      return res.json();
    },
    enabled: enabled && !!playerId,
  });

  const renderAxisBar = (label: string, value: number) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm text-gray-300">
        <span>{label}</span>
        <span className="font-semibold">{value.toFixed(0)} / 100</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-red-500/60 to-purple-500/80"
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
    </div>
  );

  return (
    <Card className="bg-[#111217] border border-gray-800/50">
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Metric Matrix
            </h3>
            <p className="text-xs text-gray-500">0–30 low · 30–50 moderate · 50–70 strong · 70+ elite</p>
          </div>
          <Badge variant="outline" className="text-xs bg-gray-900 border-gray-700 text-gray-200">
            {metricMatrix?.data?.confidence != null
              ? `${(metricMatrix.data.confidence * 100).toFixed(0)}%`
              : '...'}
          </Badge>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="space-y-1" data-testid={`metric-skeleton-${idx}`}>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20 bg-gray-800" />
                  <Skeleton className="h-4 w-12 bg-gray-800" />
                </div>
                <Skeleton className="h-2 w-full bg-gray-800" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p className="text-xs text-gray-500">
            Metric Matrix unavailable right now. Check back later.
          </p>
        )}

        {!isLoading && !isError && metricMatrix?.data?.axes && (
          <div className="space-y-3">
            {metricMatrix.data.axes.map((axis) => (
              <div key={axis.key} data-testid={`metric-axis-${axis.key}`}>
                {renderAxisBar(axis.label, axis.value)}
              </div>
            ))}
            {metricMatrix.data.missingInputs && metricMatrix.data.missingInputs.length > 0 && (
              <p className="text-xs text-gray-600 pt-1" data-testid="metric-missing-inputs">
                Missing: {metricMatrix.data.missingInputs.slice(0, 4).join(', ')}
                {metricMatrix.data.missingInputs.length > 4 && ` +${metricMatrix.data.missingInputs.length - 4} more`}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
