# On The Clock (Tiber) - Complete API Map

## Core System Endpoints

### Authentication & Health
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/signal` | GET | `founder` (optional) | OTC signature protocol endpoint, reveals credits in founder mode |
| `/api/version` | GET | None | Returns build version, commit, and process ID |
| `/api/health` | GET | None | Comprehensive health check for all services (Sleeper, logs, ratings) |

## Backend Spine Services

### Sleeper Sync Service
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/sleeper/sync` | GET | None | Manual trigger for Sleeper players sync |
| `/api/sleeper/players` | GET | `position`, `search`, `limit` | Get Sleeper players with filtering |
| `/api/sleeper/status` | GET | None | Get current Sleeper sync status |

### Logs & Projections Service
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/logs/player/:playerId` | GET | `season` (default: 2024) | Get player game logs by ID |
| `/api/projections/player/:playerId` | GET | `season` (default: 2025) | Get player projections by ID |

### Ratings Engine Service
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/ratings` | GET | `position`, `format`, `limit` | Get ratings by position/format |
| `/api/ratings/player/:playerId` | GET | None | Get specific player ratings |

## Player Compass System (Live Sleeper Data)

### Position-Specific Compass
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/compass/WR` | GET | `format`, `page`, `pageSize`, `team`, `search` | WR compass with 4-directional scoring |
| `/api/compass/RB` | GET | `format`, `page`, `pageSize`, `team`, `search` | RB compass with dynasty/redraft modes |
| `/api/compass/TE` | GET | `format`, `page`, `pageSize`, `team`, `search` | TE compass with position-specific logic |
| `/api/compass/QB` | GET | `format`, `page`, `pageSize`, `team`, `search` | QB compass with rushing analysis |

## Rankings & Draft Systems

### VORP Rankings
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/rankings` | GET | `position`, `mode`, `num_teams`, `debug` | Enhanced VORP rankings with dynasty/redraft |
| `/api/rankings/redraft` | GET | `num_teams`, `debug`, `format` | Redraft-specific VORP rankings |
| `/api/rankings/dynasty` | GET | `num_teams`, `debug`, `format` | Dynasty-specific VORP rankings |
| `/api/rankings/qb` | GET | `num_teams`, `debug`, `format` | QB-only VORP rankings |
| `/api/rankings/rb` | GET | `num_teams`, `debug`, `format` | RB-only VORP rankings |
| `/api/rankings/wr` | GET | `num_teams`, `debug`, `format` | WR-only VORP rankings |
| `/api/rankings/te` | GET | `num_teams`, `debug`, `format` | TE-only VORP rankings |

### New Engine Endpoints (Sleeper-Powered)
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/redraft` | GET | `pos`, `team`, `search`, `page`, `pageSize` | ADP-based redraft rankings |
| `/api/dynasty` | GET | `pos`, `team`, `search`, `page`, `pageSize` | Compass-powered dynasty rankings |

### API Client Compatible
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/redraft/rankings` | GET | `pos`, `season`, `format`, `limit` | API client redraft rankings |

## ADP & Draft Capital

### ADP Management
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/adp/sync` | POST | `source` (optional) | Manual ADP sync trigger |
| `/api/adp/status` | GET | None | Current ADP sync status |
| `/api/adp/config` | PUT | `source`, `syncInterval`, `enabled` | Update ADP sync configuration |
| `/api/adp/qb` | GET | `format` | QB ADP data (1QB/Superflex) |

## Content Management System

### Articles
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/articles` | GET | `category`, `featured`, `published`, `search`, `limit`, `offset` | Get all articles with filtering |
| `/api/articles/:slug` | GET | None | Get specific article by slug |
| `/api/articles/categories` | GET | None | Get all article categories |

## Player Pool & Search

### Player Management
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/player-pool` | GET | `pos`, `team`, `search`, `limit` | Unified player pool with filtering |
| `/api/players-index` | GET | None | Get player index for search functionality |

## Analytics & Intelligence

### Snap Count Analysis
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/snap/:position` | GET | None | Position-specific snap percentage data |
| `/api/snap/pipeline/status` | GET | None | Snap data pipeline status |
| `/api/snap/verify-sleeper-fields` | GET | None | Verify Sleeper API snap fields |
| `/api/snap/collect-weekly/:position` | POST | None | Collect weekly snap percentages |
| `/api/snap/player/:playerName` | GET | None | Player-specific snap data |
| `/api/snap/extract-strict` | POST | None | Prometheus-compliant strict snap extraction |
| `/api/snap/available-fields` | GET | `week` | Get available Sleeper API fields |
| `/api/snap/compliance-report` | GET | None | Generate Prometheus compliance report |

## Specialized Analysis Tools

### Trade Analyzer
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/trade-analyzer` | Various | Multiple | Trade analysis with compass visualization |

### Rookie Evaluation
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/rookie-evaluation` | Various | Multiple | Rookie player evaluation system |
| `/api/python-rookie` | Various | Multiple | Python-powered rookie analysis |

### Consensus System
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/consensus` | Various | Multiple | Community consensus rankings |
| `/api/consensus/why` | GET | Various | Explanatory consensus analysis |

## Legacy & Deprecated Endpoints

### Legacy Compass (Deprecated)
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/compass-legacy-algorithm/:position` | GET | `algorithm`, `source` | Legacy compass with algorithm selection (DEPRECATED) |

### Tiber Data Tools
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/tiber/verify-2024-game-logs` | GET | None | Verify 2024 game log access |
| `/api/tiber/parse-full-game-logs` | GET | None | Parse 2024 game logs analysis |
| `/api/tiber/export-positional-game-logs` | GET | None | Export positional game log samples |
| `/api/tiber/sleeper-2024-direct` | GET | None | Direct Sleeper API 2024 data test |
| `/api/force-stats` | GET | None | TIBER override critical NFL stats endpoint |

### Special Features
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/grok-projections` | GET | None | Grok AI projections integration |

## Data Sources & Integration

- **Primary**: Sleeper API (3,755+ active players)
- **Secondary**: MySportsFeeds API, SportsDataIO
- **Analytics**: Player Compass (4-directional scoring)
- **Community**: OTC Consensus rankings
- **Intelligence**: Snap count analysis, injury reports

## Response Formats

All endpoints return JSON with standard structure:
```json
{
  "ok": true,
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 50
  }
}
```

## Authentication

- Most endpoints are public
- Founder mode reveals additional data via `x-founder: 1` header or `founder=1` query
- Article system supports view count tracking

## Cache Strategy

- Response caching: 5-minute TTL for most endpoints
- Per-player caching: 10-minute TTL for compass calculations
- Manual cache invalidation available through sync endpoints

---

**Total Active Endpoints**: 116+ live endpoints across all systems
**Last Updated**: August 18, 2025
**Version**: v1.0.3 (Live Sleeper Integration Complete)