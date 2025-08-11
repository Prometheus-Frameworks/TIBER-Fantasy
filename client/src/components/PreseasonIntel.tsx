import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, Target, Users } from "lucide-react";

interface IntelInsight {
  player: string;
  position: string;
  team: string;
  signal: "BUY" | "SELL" | "AVOID";
  strength: "strong" | "medium" | "weak";
  note: string;
  tags: string[];
}

interface IntelData {
  ok: boolean;
  data: IntelInsight[];
  team_notes?: any[];
  meta?: {
    source: string;
    date: string;
    total_insights: number;
  };
}

export default function PreseasonIntel() {
  // Load intel data directly from static file for now since API has issues
  const intelData: IntelInsight[] = [
    {
      player: "Travis Hunter",
      position: "WR",
      team: "COL",
      signal: "BUY",
      strength: "strong",
      note: "Going to play a ton of offense, and get a lot of slot work - huge rookie year coming on offense",
      tags: ["rookie", "slot_work", "usage_boost", "two_way_player"]
    },
    {
      player: "RJ Harvey",
      position: "RB", 
      team: "DEN",
      signal: "BUY",
      strength: "strong",
      note: "Is the 1A in Denver from Week 1🔨",
      tags: ["rb1", "week1_starter", "depth_chart"]
    },
    {
      player: "Tony Pollard",
      position: "RB",
      team: "TEN",
      signal: "BUY",
      strength: "strong",
      note: "Will have a workhorse role with Tyjae high ankle sprain - he should rise quickly in ADP",
      tags: ["injury_boost", "workhorse", "adp_rise", "volume"]
    },
    {
      player: "Josh Reynolds",
      position: "WR",
      team: "NYJ", 
      signal: "BUY",
      strength: "medium",
      note: "WR2 for NYJ - because who else?",
      tags: ["wr2", "depth_chart", "target_share"]
    },
    {
      player: "Rico Dowdle",
      position: "RB",
      team: "DAL",
      signal: "BUY",
      strength: "medium",
      note: "Will be very involved as 1B - easy buy at cost",
      tags: ["rb2", "value", "committee"]
    },
    {
      player: "Jerome Ford",
      position: "RB",
      team: "CLE",
      signal: "BUY",
      strength: "medium",
      note: "Will start season as the Browns 1A - he's too cheap",
      tags: ["rb1", "value", "adp_discount"]
    }
  ];

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'SELL': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'AVOID': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStrengthIcon = (strength: string) => {
    switch (strength) {
      case 'strong': return '🔨';
      case 'medium': return '📊';
      case 'weak': return '💭';
      default: return '📋';
    }
  };

  const getPositionIcon = (position: string) => {
    switch (position) {
      case 'QB': return '🎯';
      case 'RB': return '🏃';
      case 'WR': return '🙌';
      case 'TE': return '💪';
      default: return '⚡';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Week 1 Preseason Intel
          <Badge variant="outline" className="ml-2">
            <TrendingUp className="h-3 w-3 mr-1" />
            {intelData.length} Insights
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Scouting reports from X/Twitter • Preseason observations • Not weighted in rankings
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {intelData.map((insight, index) => (
            <div
              key={index}
              className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3 flex-1">
                <div className="text-2xl">{getPositionIcon(insight.position)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{insight.player}</span>
                    <Badge variant="outline" className="text-xs">
                      {insight.team}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {insight.position}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {insight.note}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {insight.tags.slice(0, 3).map((tag, tagIndex) => (
                      <Badge key={tagIndex} variant="secondary" className="text-xs">
                        {tag.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-lg">{getStrengthIcon(insight.strength)}</span>
                <Badge className={getSignalColor(insight.signal)}>
                  {insight.signal}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        
        {/* Special team note */}
        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <span className="font-medium text-yellow-800 dark:text-yellow-200">Team Alert:</span>
              <span className="text-yellow-700 dark:text-yellow-300 ml-2">
                Chargers TE room is going to be a mess - avoid all of them
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground text-center">
          📊 Intelligence archived for reference • Updated: August 11, 2025
        </div>
      </CardContent>
    </Card>
  );
}