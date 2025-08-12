import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, Users, Clock, Scale } from "lucide-react";
import { Username } from "@/components/ui/Username";

interface ConsensusMetadata {
  contributors: number;
  lastUpdatedISO: string;
  equalWeight: true;
  format: "dynasty" | "redraft";
  season?: number;
}

interface FireLeaderboardEntry {
  username: string;
  fireScore: number;
}

export default function ConsensusTransparency() {
  const { data: dynastyMeta } = useQuery<ConsensusMetadata>({
    queryKey: ["/api/consensus/meta", "dynasty"],
    queryFn: () => fetch("/api/consensus/meta?format=dynasty").then(r => r.json()),
  });

  const { data: redraftMeta } = useQuery<ConsensusMetadata>({
    queryKey: ["/api/consensus/meta", "redraft"],
    queryFn: () => fetch("/api/consensus/meta?format=redraft&season=2025").then(r => r.json()),
  });

  const { data: fireLeaderboard } = useQuery<FireLeaderboardEntry[]>({
    queryKey: ["/api/leaderboard/fire"],
    queryFn: () => fetch("/api/leaderboard/fire?limit=10").then(r => r.json()),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Scale className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            OTC Consensus Transparency
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Equal-weight consensus system overview and community insights
          </p>
        </div>
      </div>

      {/* Core Principles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Consensus Principles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Equal Weight</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Every consenting contributor counts as exactly 1 vote, regardless of experience or fire score.
              </p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Explicit Consent</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Only users who explicitly opt-in have their rankings included in consensus calculations.
              </p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Right to Withdraw</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Contributors can withdraw consent at any time, immediately excluding their rankings.
              </p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Fire = Social Only</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                🔥 badges affect visibility and recognition, never consensus calculations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Dynasty Consensus
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Contributors</span>
              <Badge variant="secondary">
                {dynastyMeta?.contributors || 0} active
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Last Updated</span>
              <span className="text-sm font-mono">
                {dynastyMeta?.lastUpdatedISO 
                  ? new Date(dynastyMeta.lastUpdatedISO).toLocaleDateString()
                  : "Never"
                }
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Weighting</span>
              <Badge variant="outline">Equal Weight ✓</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Redraft Consensus (2025)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Contributors</span>
              <Badge variant="secondary">
                {redraftMeta?.contributors || 0} active
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Last Updated</span>
              <span className="text-sm font-mono">
                {redraftMeta?.lastUpdatedISO 
                  ? new Date(redraftMeta.lastUpdatedISO).toLocaleDateString()
                  : "Never"
                }
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Weighting</span>
              <Badge variant="outline">Equal Weight ✓</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fire Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔥 
            Community Recognition
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Top contributors by community fire score (social recognition only - does not affect consensus calculations)
          </p>
          
          {fireLeaderboard && fireLeaderboard.length > 0 ? (
            <div className="space-y-2">
              {fireLeaderboard.map((entry, idx) => (
                <div key={entry.username} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-500 w-6">
                      #{idx + 1}
                    </span>
                    <Username name={entry.username} fireScore={entry.fireScore} />
                  </div>
                  <Badge variant="outline">
                    {entry.fireScore} 🔥
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">
              No fire events recorded yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle>Technical Implementation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Consensus Calculation</h4>
            <p>
              For each player position, we collect all rankings from consenting users and calculate 
              the consensus rank as the rounded average of all submitted ranks.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Data Sources</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Dynasty: Long-term player valuations (no season scope)</li>
              <li>Redraft: Season-specific rankings for 2025</li>
              <li>User contributions: Voluntary submissions with explicit consent</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Privacy & Control</h4>
            <p>
              Users maintain full control over their participation. Consent can be withdrawn at any time, 
              immediately removing their influence from future consensus calculations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}