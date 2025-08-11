# API Routes Inventory

Based on discovery, here are all the API routes and their handlers:

| HTTP Method | Path | Handler File | Function Name | Data Source |
|-------------|------|--------------|---------------|-------------|
| GET | `/api/redraft/weekly` | `server/routes/redraftWeeklyRoutes.ts` | `getWeeklyData` | `warehouse/2024_weekly.jsonl` |
| GET | `/api/redraft/weeks` | `server/routes/redraftWeeklyRoutes.ts` | `getAvailableWeeks` | `warehouse/2024_weekly.jsonl` |
| GET | `/api/redraft/teams` | `server/routes/redraftWeeklyRoutes.ts` | `getAvailableTeams` | `warehouse/2024_weekly.jsonl` |
| GET | `/api/redraft/rookies` | `server/routes/redraftWeeklyRoutes.ts` | `getRookies` | `warehouse/2024_weekly.jsonl` |
| GET | `/api/wr-ratings/rankings` | `server/routes.ts` | inline | `data/WR_2024_Ratings_With_Tags.csv` |
| GET | `/api/wr-ratings/player/:playerName` | `server/routes.ts` | inline | `data/WR_2024_Ratings_With_Tags.csv` |
| GET | `/api/wr-ratings/stats` | `server/routes.ts` | inline | `data/WR_2024_Ratings_With_Tags.csv` |
| GET | `/api/rb-compass` | `server/routes.ts` | inline | Static data + calculations |
| GET | `/api/te-compass` | `server/routes.ts` | inline | Static data + calculations |
| GET | `/api/te-compass/:name` | `server/routes.ts` | inline | Static data + calculations |
| GET | `/api/te-compass/compare/:name1/:name2` | `server/routes.ts` | inline | Static data + calculations |
| GET | `/api/te-compass/tiers` | `server/routes.ts` | inline | Static data + calculations |
| GET | `/api/rookie-evaluation` | `server/routes.ts` | inline | Static rookies data |
| GET | `/api/rookie-evaluation/csv` | `server/routes.ts` | inline | Static rookies data |
| GET | `/api/python-rookie` | `server/routes.ts` | inline | Python script execution |
| GET | `/api/rankings` | `server/routes.ts` | inline | Mixed calculations |
| GET | `/api/rankings/validate` | `server/routes.ts` | inline | Validation logic |
| GET | `/api/rankings/validate/report` | `server/routes.ts` | inline | Validation logic |
| GET | `/api/rankings/prometheus` | `server/routes.ts` | inline | Static benchmark data |
| GET | `/api/rankings/prometheus/:position` | `server/routes.ts` | inline | Static benchmark data |
| GET | `/api/players/search` | `server/routes.ts` | inline | Database/Static |
| GET | `/api/players/trending` | `server/routes.ts` | inline | Sleeper API |
| GET | `/api/players/with-dynasty-value` | `server/routes.ts` | inline | Mixed calculations |
| GET | `/api/players/enhanced-adp` | `server/routes.ts` | inline | Sleeper API + DB |
| GET | `/api/snap` | `server/routes.ts` | inline | Sleeper API |
| GET | `/api/snap/player/:playerName` | `server/routes.ts` | inline | Sleeper API |
| POST | `/api/snap/collect-weekly` | `server/routes.ts` | inline | Sleeper API |
| GET | `/api/weekly-spike-analysis` | `server/routes.ts` | inline | NFL-Data-Py via Python |
| GET | `/api/analytics/prometheus-benchmarks` | `server/routes.ts` | inline | Static + calculations |
| POST | `/api/analytics/batch-evaluation` | `server/routes.ts` | inline | Evaluation logic |
| GET | `/api/intel/current` | `server/routes.ts` | inline | `data/preseason_week1_intel.json` |
| POST | `/api/intel/add` | `server/routes.ts` | inline | File append operations |
| GET | `/api/oasis/teams` | `server/services/oasisApiService.ts` | `getTeams` | External R API |
| GET | `/api/oasis/metrics/offense` | `server/services/oasisApiService.ts` | `getOffenseMetrics` | External R API |
| GET | `/api/oasis/targets/distribution` | `server/services/oasisApiService.ts` | `getTargetsDistribution` | External R API |

## Response Shapes

### WR Routes
```typescript
interface WRRating {
  player_name: string;
  team: string;
  position: string;
  adjusted_rating: number;
  fantasy_points_per_game: number;
  games_played: number;
  targets_per_game: number;
  receptions_per_game: number;
  yards_per_game: number;
  tds_per_game: number;
  target_share: number;
  air_yards_share: number;
  wopr: number;
  adot: number;
  yac_over_expected: number;
  separation: number;
  pff_grade: number;
  age: number;
  experience: number;
  draft_round: number;
  size_score: number;
  speed_score: number;
  hands_score: number;
  route_score: number;
  contested_score: number;
  yac_score: number;
  tags: string;
}
```

### Weekly Data Routes
```typescript
interface WeeklyPlayer {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  season: number;
  week: number;
  targets?: number;
  receptions?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  rush_attempts?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  fantasy_points?: number;
  fantasy_points_ppr?: number;
}
```

### Compass Routes
```typescript
interface CompassScore {
  north: number;    // Volume/Talent
  east: number;     // Scheme/Environment  
  south: number;    // Age/Risk
  west: number;     // Market/Value
}

interface PlayerCompass {
  player_name: string;
  position: string;
  team: string;
  compass: CompassScore;
  tier: string;
  summary: string;
}
```

### Rookie Routes
```typescript
interface RookieEvaluation {
  name: string;
  position: string;
  college: string;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  dynasty_score: number;
  traits: string[];
  dynasty_flags: string[];
}
```

### Intelligence Feed Routes
```typescript
interface IntelEntry {
  date: string;
  source: string;
  type: string;
  team: string;
  details: {
    player_name?: string;
    position?: string;
    movement?: string;
    dynasty_impact?: 'major_positive' | 'positive' | 'neutral' | 'concerning' | 'negative';
    note: string;
  };
}
```

### OASIS Routes
```typescript
interface OASISTeam {
  team: string;
  oasis_score: number;
  pass_rate: number;
  pace: number;
  red_zone_efficiency: number;
}

interface OASISOffense {
  team: string;
  passing_epa: number;
  rushing_epa: number;
  total_plays: number;
  avg_depth_of_target: number;
}
```

## ✅ Previously Missing Endpoints (NOW IMPLEMENTED)

| Endpoint | Status | Purpose | Response Shape |
|----------|--------|---------|----------------|
| `GET /api/analytics/vorp` | ✅ WORKING | VORP rankings with dynasty weighting | `{id, name, team, pos, age, vorp, tier}[]` |
| `GET /api/wr` | ✅ WORKING | WR search and filtering | `{id, name, team, pos, compass, alias, age, adp}[]` |
| `GET /api/rookies` | ✅ WORKING | Rookie evaluation summaries | `{rookies: {id, name, position, college, tier, dynasty_score, traits, dynasty_flags}[]}` |
| `GET /api/weekly` | ✅ WORKING | Weekly data aggregation (alias to redraft/weekly) | `{data: WeeklyPlayer[]}` |
| `GET /api/usage-leaders` | ❌ PARTIAL | Target share/snap leaders (WR service issue) | `{leaders: {player_name, position, team, target_share, snap_percentage, usage_score}[]}` |
| `GET /api/health` | ✅ WORKING | Service health check | `{status, timestamp, checks}` |

## API Status Summary (as of 1:07 AM)

### ✅ WORKING ENDPOINTS (Core functionality ready)
- `/api/analytics/vorp` - Returns WR VORP data with tiers
- `/api/wr` - WR search with compass scores
- `/api/rookies` - Rookie evaluation data (50 players across QB/RB/WR/TE)
- `/api/weekly` - Weekly player stats with null coercion
- `/api/health` - Health checks all services
- `/api/intel/current` - Intelligence feed (preseason archive)
- `/api/redraft/weekly` - Core weekly data warehouse
- `/api/wr-ratings/rankings` - WR ratings from CSV
- `/api/oasis/*` - Team environment data (when R API configured)

### ❌ PARTIALLY WORKING
- `/api/usage-leaders` - WR filtering logic needs adjustment
- `/api/oasis/teams` - Requires OASIS_R_BASE environment variable

### 🔧 TECHNICAL FIXES IMPLEMENTED
1. Fixed `loadWRData()` function references → `wrRatingsService.getAllWRPlayers()`
2. Added null coercion for weekly data (`v == null ? 0 : v`)
3. Implemented compass score calculations for WR endpoint
4. Added comprehensive error handling and logging
5. Created health check with service status monitoring

## Data Source Summary

- **WR Data**: CSV file (`data/WR_2024_Ratings_With_Tags.csv`) - loaded at startup
- **Weekly Data**: JSONL warehouse (`warehouse/2024_weekly.jsonl`) - 7,027 player records
- **Rookie Data**: Static JS objects and Python evaluation scripts
- **VORP**: Calculated from player projections and age penalties
- **Intelligence**: JSON file (`data/preseason_week1_intel.json`) - preseason observations
- **OASIS**: External R API proxy with ETag caching
- **Compass**: Calculated scores based on position-specific algorithms