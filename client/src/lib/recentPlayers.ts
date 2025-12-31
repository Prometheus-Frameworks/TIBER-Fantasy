const STORAGE_KEY = 'tiber_recent_players_v1';
const MAX_RECENTS = 8;

export interface RecentPlayer {
  playerId: string;
  name: string;
  team: string;
  position: string;
  viewedAt: number;
}

export function getRecentPlayers(): RecentPlayer[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function addRecentPlayer(player: Omit<RecentPlayer, 'viewedAt'>): void {
  try {
    const current = getRecentPlayers();
    const filtered = current.filter(p => p.playerId !== player.playerId);
    const updated: RecentPlayer[] = [
      { ...player, viewedAt: Date.now() },
      ...filtered,
    ].slice(0, MAX_RECENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silent fail for localStorage issues
  }
}

export function clearRecentPlayers(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silent fail
  }
}
