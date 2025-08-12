import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Compass } from "lucide-react";
import { Link } from "wouter";

interface PlayerRowProps {
  player: {
    id: string;
    playerId: string;
    rank: number;
    tier?: number;
    score?: number;
    name?: string;
  };
  showActions?: boolean;
  format?: "dynasty" | "redraft";
}

export default function PlayerRow({ player, showActions = false, format = "dynasty" }: PlayerRowProps) {
  const playerName = player.name || player.playerId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="grid grid-cols-12 gap-2 py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded transition-colors group">
      <div className="col-span-1 font-medium">
        {player.rank}
      </div>
      <div className="col-span-5">
        <Link href={`/players/${player.playerId}#consensus`}>
          <div className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">
            {playerName}
          </div>
        </Link>
      </div>
      <div className="col-span-2">
        {player.tier && (
          <Badge variant="outline" className="text-xs">
            Tier {player.tier}
          </Badge>
        )}
      </div>
      <div className="col-span-2 text-sm font-medium">
        {player.score?.toFixed(1) || 'N/A'}
      </div>
      <div className="col-span-2 flex items-center gap-2">
        {showActions && (
          <Link href={`/players/${player.playerId}#compass`}>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Compass className="h-4 w-4 mr-1" />
              Evaluate
            </Button>
          </Link>
        )}
        <ExternalLink className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  );
}