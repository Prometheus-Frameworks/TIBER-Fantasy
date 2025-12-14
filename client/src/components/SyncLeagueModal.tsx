import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Link2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface SyncLeagueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSynced?: (newLeagueId: string, leagueName?: string) => void;
}

export function SyncLeagueModal({ open, onOpenChange, onSynced }: SyncLeagueModalProps) {
  const [leagueIdExternal, setLeagueIdExternal] = useState('');
  const [season] = useState(2025);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/league-sync/sleeper', {
        user_id: 'default_user',
        sleeper_league_id: leagueIdExternal.trim(),
      });
      return response.json();
    },
    onSuccess: (data) => {
      const newLeagueId = data?.league?.id || data?.leagueId || leagueIdExternal.trim();
      const leagueName = data?.league?.league_name || data?.league?.leagueName;
      if (onSynced) {
        onSynced(newLeagueId, leagueName);
      }
      setLeagueIdExternal('');
      onOpenChange(false);
    },
  });

  const handleSync = () => {
    if (leagueIdExternal.trim()) {
      syncMutation.mutate();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && leagueIdExternal.trim() && !syncMutation.isPending) {
      handleSync();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f1016] border border-purple-500/20 text-zinc-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <Link2 className="h-5 w-5 text-purple-400" />
            Sync a Sleeper League
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="league-id" className="text-zinc-300">
              Sleeper League ID
            </Label>
            <Input
              id="league-id"
              placeholder="e.g., 1048281845948174336"
              value={leagueIdExternal}
              onChange={(e) => setLeagueIdExternal(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-[#0a0a0f] border-zinc-700 text-zinc-200 placeholder:text-zinc-500 focus:border-purple-500/50"
              data-testid="input-league-id"
            />
            <p className="text-xs text-zinc-500">
              Find your League ID in Sleeper app settings or your league URL.
            </p>
          </div>

          {syncMutation.isError && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              Failed to sync league. Please check your League ID and try again.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            data-testid="button-cancel-sync"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSync}
            disabled={!leagueIdExternal.trim() || syncMutation.isPending}
            className="bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
            data-testid="button-sync-league"
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              'Sync'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
