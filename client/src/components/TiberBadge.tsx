interface TiberBreakdown {
  firstDownScore: number;
  epaScore: number;
  usageScore: number;
  tdScore: number;
  teamScore: number;
}

interface TiberBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showBreakdown?: boolean;
  breakdown?: TiberBreakdown;
  className?: string;
}

function getTierInfo(score: number): { tier: string; color: string; textColor: string; bg: string } {
  if (score >= 80) {
    return {
      tier: "Breakout",
      color: "border-emerald-500",
      textColor: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/30"
    };
  } else if (score >= 50) {
    return {
      tier: "Stable",
      color: "border-amber-500",
      textColor: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/30"
    };
  } else {
    return {
      tier: "Regression",
      color: "border-red-500",
      textColor: "text-red-700 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/30"
    };
  }
}

export default function TiberBadge({ score, size = "md", showLabel = true, showBreakdown = false, breakdown, className = "" }: TiberBadgeProps) {
  const { tier, color, textColor, bg } = getTierInfo(score);
  
  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm"
  };

  const numberSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };

  return (
    <div className={className}>
      <div 
        className={`inline-flex items-center gap-1.5 rounded-md border-2 ${color} ${bg} ${sizeClasses[size]} font-medium`}
        title={`TIBER: Tactical Index for Breakout Efficiency and Regression\nScore: ${score}/100 (${tier})`}
        data-testid={`tiber-badge-${score}`}
      >
        {showLabel && (
          <span className={`font-semibold ${textColor} tracking-tight`}>
            TIBER
          </span>
        )}
        <span className={`${numberSize[size]} font-bold ${textColor} tabular-nums`}>
          {Math.round(score)}
        </span>
      </div>

      {showBreakdown && breakdown && (
        <div className="mt-2 text-xs space-y-1 text-gray-600 dark:text-gray-400">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <span className="text-emerald-600 dark:text-emerald-400">🎯</span>
              First Downs:
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{breakdown.firstDownScore}/35</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <span className="text-blue-600 dark:text-blue-400">⚡</span>
              EPA:
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{breakdown.epaScore}/25</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <span className="text-purple-600 dark:text-purple-400">📊</span>
              Usage:
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{breakdown.usageScore}/25</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <span className="text-orange-600 dark:text-orange-400">🏈</span>
              TD:
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{breakdown.tdScore}/10</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <span className="text-gray-600 dark:text-gray-400">🏟️</span>
              Team:
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{breakdown.teamScore}/5</span>
          </div>
        </div>
      )}
    </div>
  );
}
