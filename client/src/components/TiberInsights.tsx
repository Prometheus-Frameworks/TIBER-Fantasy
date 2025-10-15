import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Gem } from 'lucide-react';

interface InsightPlayer {
  name: string;
  team: string;
  position: string;
  tiberScore: number;
  tier: string;
}

interface TiberInsightsResponse {
  success: boolean;
  week: number;
  season: number;
  breakouts: InsightPlayer[];
  regressions: InsightPlayer[];
  gems: InsightPlayer[];
  totalPlayers: number;
}

interface InsightCardProps {
  title: string;
  icon: React.ReactNode;
  players: InsightPlayer[];
  bgColor: string;
  titleColor: string;
  subtitle: string;
}

function InsightCard({ title, icon, players, bgColor, titleColor, subtitle }: InsightCardProps) {
  return (
    <div className={`border border-gray-700 rounded-lg p-4 ${bgColor}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className={`font-semibold ${titleColor}`}>
          {title}
        </h3>
      </div>
      <p className="text-xs text-gray-400 mb-3">{subtitle}</p>
      
      <div className="space-y-2">
        {players && players.length > 0 ? (
          players.map(player => (
            <div key={player.name} className="text-sm">
              <div className="font-medium text-gray-100">{player.name}</div>
              <div className="text-xs text-gray-400">
                TIBER {player.tiberScore} · {player.position}, {player.team}
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-gray-500">No players found</div>
        )}
      </div>
    </div>
  );
}

export default function TiberInsights() {
  const { data: insights, isLoading } = useQuery<TiberInsightsResponse>({
    queryKey: ['/api/tiber/insights', { week: 6 }],
    queryFn: async () => {
      const res = await fetch('/api/tiber/insights?week=6');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="bg-[#1e2330] border border-gray-700 rounded-lg p-6 animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="h-48 bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1e2330] border border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100">
            🧠 TIBER Insights
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Week {insights?.week} · {insights?.totalPlayers || 0} players analyzed
          </p>
        </div>
        <span className="text-xs text-gray-500">
          Updated daily with latest data
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Breakout Candidates */}
        <InsightCard
          title="Top Breakouts"
          icon={<TrendingUp className="w-4 h-4 text-green-400" />}
          players={insights?.breakouts || []}
          bgColor="bg-green-500/5"
          titleColor="text-green-400"
          subtitle="High efficiency + rising usage"
        />

        {/* Regression Risks */}
        <InsightCard
          title="Regression Watch"
          icon={<TrendingDown className="w-4 h-4 text-red-400" />}
          players={insights?.regressions || []}
          bgColor="bg-red-500/5"
          titleColor="text-red-400"
          subtitle="Sell high before the drop"
        />

        {/* Hidden Gems */}
        <InsightCard
          title="Hidden Gems"
          icon={<Gem className="w-4 h-4 text-blue-400" />}
          players={insights?.gems || []}
          bgColor="bg-blue-500/5"
          titleColor="text-blue-400"
          subtitle="Undervalued breakout candidates"
        />
      </div>
    </div>
  );
}
