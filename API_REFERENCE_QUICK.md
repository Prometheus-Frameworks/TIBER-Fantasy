# OTC Platform - Quick API Reference for Agents

## 🔧 Core System Endpoints

### Health & Status
```bash
GET /api/health                    # System health check
GET /api/signal                    # Duo identity protocol status  
GET /api/players/hot-list/sources  # Data source availability
GET /api/players/hot-list/health   # Hot List system status
```

### Data Management
```bash
POST /api/data/capture             # Execute static data capture
GET  /api/data/captures            # List available static captures
POST /api/players/hot-list/refresh # Manual live data refresh
POST /api/players/hot-list/mode/live # Activate live data mode
```

## 🎯 Player & Rankings Systems

### Player Pool
```bash
GET /api/player-pool              # All players with filtering
    ?pos=WR                       # Filter by position
    &team=KC                      # Filter by team  
    &search=jefferson             # Search by name
    &limit=50                     # Limit results
```

### Hot List Extraction
```bash
GET /api/players/hot-list         # Hot List players
    ?bucket=risers                # Buckets: risers, elite, surge, targets
    &pos=WR                       # Filter by position
    &limit=12                     # Results per bucket
```

### Rankings & Consensus
```bash
GET /api/ratings                  # Base player ratings
    ?format=dynasty               # dynasty | redraft
    &pos=WR                       # Position filter
    &limit=200                    # Result limit

GET /api/consensus                # OTC Consensus rankings
GET /api/consensus/splits         # Dynasty vs Redraft comparison
```

### VORP System
```bash
GET /api/vorp                     # Value Over Replacement Player
    ?format=dynasty               # Dynasty mode with age penalties
    &pos=FLEX                     # FLEX allocation logic
```

## 🧭 Player Compass System

### WR Compass
```bash
GET /api/wr-compass               # WR Player Compass data
    ?search=jefferson             # Search specific players
    &tier=elite                   # Filter by tier
```

### Trade Analysis
```bash
GET /api/trade-analyzer           # Trade evaluation tool
POST /api/trade-analyzer/evaluate # Analyze specific trades
```

## 📊 Live Data Integration

### Sleeper API Integration
```bash
GET /api/sleeper/players          # Sleeper player sync
GET /api/adp/qb                   # QB Average Draft Position
    ?format=1qb                   # 1qb | superflex
```

### NFL Data
```bash
GET /api/sync/rosters             # NFL roster data
GET /api/depth-charts             # Team depth charts
    ?fantasy=1                    # Fantasy-relevant filtering
GET /api/intel                    # Intelligence feed
```

## 🏈 Redraft Hub
```bash
GET /api/redraft                  # Redraft hub data
GET /api/redraft/waiver           # Waiver wire recommendations
GET /api/redraft/qb               # QB-specific redraft data
GET /api/redraft/rb               # RB-specific redraft data  
GET /api/redraft/wr               # WR-specific redraft data
GET /api/redraft/te               # TE-specific redraft data
GET /api/redraft/analyzer         # Trade analyzer for redraft
```

## 🎓 Specialized Systems

### Rookie Evaluation
```bash
GET /api/rookies                  # 2025 rookie database
GET /api/rookies/evaluate         # Rookie evaluation engine
```

### Competence Mode (AI Assistant)
```bash
GET /api/competence               # Truth-first AI guidance
POST /api/competence/query        # Submit questions for analysis
```

### OVR Integration
```bash
GET /api/ovr/compass              # OVR Player Compass
GET /api/ovr/hot-list             # OVR-based Hot List
POST /api/ovr/upload              # Upload OVR CSV data
GET /api/ovr/health               # OVR system status
```

### Snap Counts Analysis
```bash
GET /api/snap-counts/claim/:pos/:pp # Snap count evidence claims
GET /api/snap-counts/examples/:label # Historical examples
GET /api/snap-counts/health       # System health check
```

## 🔍 Quick Debugging

### Check Platform Status
```bash
curl "http://localhost:5000/api/health"
curl "http://localhost:5000/api/players/hot-list/sources"
```

### Test Data Flow
```bash
# Capture static data
curl -X POST "http://localhost:5000/api/data/capture"

# Refresh live data
curl -X POST "http://localhost:5000/api/players/hot-list/refresh"

# Test Hot List extraction
curl "http://localhost:5000/api/players/hot-list?bucket=risers&limit=5"
```

### Verify Core Systems
```bash
# Player pool
curl "http://localhost:5000/api/player-pool?limit=10"

# Rankings
curl "http://localhost:5000/api/ratings?format=dynasty&limit=10"

# Consensus
curl "http://localhost:5000/api/consensus"
```

## 📱 Frontend Routes
- `/` - Landing/Home page
- `/rankings` - OTC Consensus hub
- `/redraft` - Season HQ (7-tab interface)
- `/hot-list` - Live Hot List interface
- `/competence` - AI assistant
- `/wr-compass` - WR Player Compass
- `/trade-analyzer` - Trade evaluation tool

## 🎛️ Response Patterns

### Standard Success Response
```json
{
  "ok": true,
  "data": [...],
  "count": 50,
  "metadata": {...}
}
```

### Hot List Response
```json
{
  "players": [...],
  "metadata": {
    "week": "2025-18",
    "bucket": "risers",
    "totalExtracted": 25,
    "lastUpdate": "2025-08-17T19:22:20.447Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Description",
  "details": "Technical details"
}
```