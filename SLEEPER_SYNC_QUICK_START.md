# Sleeper Sync Quick Start
**30-Minute Integration Guide**

## 🚀 Fastest Path to Live Sleeper Data

### 1. Install Dependencies (2 minutes)
```bash
npm install axios lru-cache zod
```

### 2. Copy Service File (5 minutes)
Create `server/services/sleeperSyncService.ts`:
```typescript
import axios from 'axios';
import LRUCache from 'lru-cache';

export class SleeperSyncService {
  private playersCache = new LRUCache<string, any>({ max: 10, ttl: 10 * 60 * 1000 });

  async getPlayers(): Promise<any[]> {
    const cacheKey = 'sleeper_players';
    let cached = this.playersCache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get('https://api.sleeper.app/v1/players/nfl');
      const playersArray = Object.entries(response.data).map(([id, player]: [string, any]) => ({
        player_id: id, ...player
      })).filter((p: any) => ['QB', 'RB', 'WR', 'TE'].includes(p.position));
      
      this.playersCache.set(cacheKey, playersArray);
      console.log(`✅ Live sync: ${playersArray.length} players`);
      return playersArray;
    } catch (error) {
      console.error('❌ Sleeper API error:', error);
      return [];
    }
  }
}

export const sleeperSyncService = new SleeperSyncService();
```

### 3. Create Live Route (10 minutes)
Create `server/routes/compassRoutes.ts`:
```typescript
import { Request, Response } from 'express';
import LRUCache from 'lru-cache';

const respCache = new LRUCache<string, any>({ max: 200, ttl: 5 * 60 * 1000 });

export const registerCompassRoutes = (app: any) => {
  app.get("/api/compass/:position", async (req: Request, res: Response) => {
    const position = String(req.params.position || "").toUpperCase();
    if (!["WR", "RB", "TE", "QB"].includes(position)) {
      return res.status(400).json({ ok: false, error: "Invalid position" });
    }

    console.log(`🔄 Live Compass: ${position} with Sleeper-synced data`);

    const { sleeperSyncService } = await import('../services/sleeperSyncService');
    const allPlayers = await sleeperSyncService.getPlayers();
    const pool = allPlayers.filter((p: any) => p.position === position);
    
    const results = pool.slice(0, 50).map((p: any) => ({
      id: p.player_id,
      name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      team: p.team,
      position: p.position,
      compass: { north: 5, east: 5, south: 5, west: 5, score: 5 },
      tier: 'Active'
    }));

    res.json({
      ok: true,
      position,
      data: results,
      meta: { source: "Sleeper sync → Compass v2.0" }
    });
  });
};
```

### 4. Register Route (5 minutes)
In your main server file, ADD THIS BEFORE any legacy routes:
```typescript
const { registerCompassRoutes } = await import('./routes/compassRoutes');
registerCompassRoutes(app);
```

### 5. Test (5 minutes)
```bash
# Test endpoint
curl "http://localhost:5000/api/compass/WR?pageSize=10"

# Should return live player names, not "None"
```

### 6. Verify Success (3 minutes)
Look for these indicators:
- ✅ Console shows: `🔄 Live Compass: WR with Sleeper-synced data`
- ✅ Response includes: `"source": "Sleeper sync → Compass v2.0"`
- ✅ Player names are real: "Justin Jefferson", "Ja'Marr Chase"

## 🔧 Quick Fixes

### Names Show "None"?
Update the name mapping in your route:
```typescript
name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
```

### Still Getting Legacy Data?
Make sure live routes are registered BEFORE legacy ones:
```typescript
// ✅ GOOD - Live routes first
registerCompassRoutes(app);

// ❌ BAD - Legacy routes blocking
app.get('/api/compass/:position', legacyHandler);
```

### Route Conflicts?
Rename legacy routes to avoid conflicts:
```typescript
app.get('/api/compass-legacy/:position', legacyHandler);
```

## ✅ Success = Live NFL Player Data in 30 Minutes!