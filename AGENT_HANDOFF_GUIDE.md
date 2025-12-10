# Agent Handoff Guide - On The Clock Platform

## 🎯 Quick Context Transfer

### Project Identity
**On The Clock (TIBER)** - Open-source fantasy football platform focused on dynasty leagues, built with React/TypeScript + Node.js/Express backend. Mission: democratize advanced analytics without paywalls.

### Core Architecture Overview
```
Frontend: React 18 + TypeScript + Tailwind + shadcn/ui
Backend: Node.js Express + TypeScript  
Data: PostgreSQL + Drizzle ORM + Multi-API integration
APIs: Sleeper (free), MySportsFeeds, SportsDataIO
```

## 📋 Essential Files for Agent Onboarding

### 1. Primary Context Document
**File**: `replit.md`
- **Critical**: Read this FIRST - contains user preferences, architecture decisions, and complete feature inventory
- **Update Rule**: Always update when making architectural changes or user expresses preferences

### 2. Current Implementation Status  
**File**: `LIVE_DATA_INTEGRATION_COMPLETE.md`
- Latest major feature completion status
- API integration details and data flow

### 3. Navigation & Routing
**File**: `client/src/config/nav.ts`
- Centralized navigation configuration
- All platform routes and structure

## 🔧 Key Technical Patterns

### Data Flow Architecture
```
1. Multi-Source APIs → Static Capture Service → Persistent Storage
2. Live Data Processor → OVR Engine → Hot List Extraction
3. Player Pool System → Consensus Engine → Rankings Display
```

### Critical Service Files
- `server/routes.ts` - All API endpoints (2400+ lines)
- `server/services/hotListService.ts` - Core extraction logic  
- `shared/schema.ts` - Database models and types
- `client/src/lib/queryClient.ts` - API client configuration

## 🎮 Platform Features Inventory

### Major Systems (Operational)
1. **Player Compass** - 4-directional player evaluation system
2. **TIBER Consensus** - Dynamic rankings with surge detection  
3. **Hot List** - Live player extraction with 4 buckets (Risers, Elite, Surge, Value)
4. **Redraft Hub** - 7-tab interface with live NFL data
5. **VORP Rankings** - Value Over Replacement Player calculations
6. **Live Data Pipeline** - Multi-source integration with fallback strategies

### Data Sources (Live)
- **Sleeper API**: Primary (free, no key needed) - 3,755+ players
- **MySportsFeeds**: Secondary (trial period) - Injury reports, roster updates
- **SportsDataIO**: Tertiary (trial period) - Weekly stats, player profiles

## 🔍 Agent Communication Patterns

### When Taking Over
1. **Check Workflow Status**: Application should be running on port 5000
2. **Verify Data Sources**: `GET /api/players/hot-list/sources`
3. **Test Core Endpoints**: `/api/health`, `/api/player-pool`, `/api/players/hot-list`

### User Interaction Style
- **Language**: Simple, everyday terms (avoid technical jargon)
- **Updates**: Document architectural changes in `replit.md`
- **Communication**: Professional, concise, action-focused
- **Philosophy**: Truth-first, evidence-based fantasy advice

## 🛠️ Common Development Tasks

### Adding New Features
1. Update `shared/schema.ts` for data models
2. Add API routes in `server/routes.ts`
3. Create frontend components in `client/src/`
4. Update navigation in `client/src/config/nav.ts`
5. Document in `replit.md`

### Data Integration
- Use `DataCaptureService` for persistent static data
- Use `LiveDataProcessor` for weekly updates
- Always implement fallback strategies for API failures

### Frontend Patterns
- TanStack Query for data fetching
- shadcn/ui for components
- Wouter for routing
- TypeScript interfaces from shared schema

## 🔑 Critical Endpoints for Testing

```bash
# Health check
GET /api/health

# Data sources status  
GET /api/players/hot-list/sources

# Live data capture
POST /api/data/capture

# Hot List buckets
GET /api/players/hot-list?bucket=risers&limit=10

# Player pool
GET /api/player-pool?pos=WR&limit=20

# TIBER Consensus
GET /api/consensus
```

## 📊 Current Platform State

### Operational Systems
- ✅ Live data integration with 9,736+ players processed
- ✅ Static data capture (2.6MB+ reference data saved)
- ✅ Hot List extraction with 4-bucket system
- ✅ Player Compass evaluation engine
- ✅ Multi-format rankings (Dynasty/Redraft)

### User Preferences (from replit.md)
- Dynasty league focus (QB, RB, WR, TE only)
- Anti-paywall mission (100% free platform)
- Evidence-based analysis over opinions
- Mobile-optimized, clean UI design

## 🚀 Quick Start Commands

```bash
# Start development server
npm run dev

# Test live data capture  
curl -X POST "http://localhost:5000/api/data/capture"

# Check Hot List status
curl "http://localhost:5000/api/players/hot-list/health"

# Activate live mode
curl -X POST "http://localhost:5000/api/players/hot-list/mode/live"
```

## 💡 Agent Handoff Best Practices

### Before Starting Work
1. Read `replit.md` completely
2. Check workflow status and logs
3. Verify API endpoints are responsive
4. Review recent changes in project files

### Communication Protocol
- Ask about user preferences if unclear
- Update documentation for architectural changes
- Test thoroughly before reporting completion
- Use the mark_completed_and_get_feedback tool for user verification

### Problem-Solving Approach
- Check logs in workflow console first
- Use diagnostic endpoints for data source issues
- Implement graceful fallbacks for API failures
- Document solutions for future reference

This guide should help any agent quickly understand the codebase architecture, current state, and development patterns to continue work effectively.