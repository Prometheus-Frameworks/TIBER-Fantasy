interface TiberBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
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

export default function TiberBadge({ score, size = "md", showLabel = true, className = "" }: TiberBadgeProps) {
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
    <div 
      className={`inline-flex items-center gap-1.5 rounded-md border-2 ${color} ${bg} ${sizeClasses[size]} font-medium ${className}`}
      title={`TIBER Score: ${score}/100 (${tier})`}
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
  );
}
