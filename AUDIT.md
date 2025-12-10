# Tiber Fantasy Rebuild - Codebase Audit

## Current State
- **100+ page files** in `client/src/pages/`
- **80+ routes** in `App.tsx`
- Extremely fragmented navigation

## Decision: Full Tiber Fantasy Rebuild

### ✅ KEEP & MIGRATE to Tiber Tabs

**Priority P0 (Must Have for Launch):**
1. **Rankings Tab** → Migrate from:
   - `TiberDashboard.tsx` (current Power Rankings tab)
   - OVR API (already working with caching)
   
2. **Matchups Tab** → Migrate from:
   - `DvPMatchups.tsx` (Defense vs Position)
   - `TiberDashboard.tsx` (current DvP tab)
   
3. **Strategy Tab** → Migrate from:
   - `SOSAnalyticsPage.tsx` (SOS analytics)
   - `SOSPage.tsx` (SOS rankings)
   - `PlayerCompass.tsx` (Player evaluation - simplified version)

**Priority P1 (Should Have):**
4. **Moves Tab** → Migrate from:
   - `TradeAnalyzer.tsx` or `TradeAnalyzerNew.tsx` (Trade evaluation)
   - Start with placeholder "Coming Soon"

5. **Home Tab** → Create new:
   - Hero section
   - Stats cards (top performers, trending)
   - Quick actions

6. **Leagues Tab** → Placeholder:
   - "Coming Soon" state for league sync

### 🗑️ DELETE - Unused/Redundant Pages

**Remove all of these (90+ files):**
- All `/mock/*` pages (Systems, Draft, Rookies, etc.)
- All test/demo pages (ApiTest, ApiDemo, TestDataPage, etc.)
- Old ranking systems (Rankings.tsx, RankingsV3.tsx, TIBERConsensus.tsx)
- Duplicate trade analyzers (keep one for Moves tab)
- All Compass variants (RBCompass, WRCompass, TECompass, etc.) - consolidate into Strategy tab
- Consensus pages (ConsensusHub, ConsensusSeeding, etc.)
- Analytics pages (AdvancedAnalytics, Analytics, RBAnalytics, etc.)
- Profile pages (PlayerProfile.tsx - multiple versions)
- Landing pages (home.tsx, dashboard.tsx, Dynasty.tsx, Redraft.tsx, etc.)
- Specialized analysis (DynastyDeclineAnalysis, RBTouchdownRegression, etc.)
- News/Articles (News.tsx, Articles.tsx, ArticleDetail.tsx)
- All "old" versions and deprecated routes

**Specific files to DELETE:**
```
client/src/pages/:
- about.tsx
- AdaptiveConsensusDemo.tsx
- ADP.tsx
- AdvancedAnalytics.tsx
- Advice.tsx
- Analytics.tsx
- ApiComprehensive.tsx
- ApiDemo.tsx
- ApiTest.tsx
- ArticleDetail.tsx
- Articles.tsx
- CleanADP.tsx
- CommunityPosts.tsx
- compare-league.tsx
- ComparePage.tsx
- CompareRankings.tsx
- CompetenceMode.tsx
- ConsensusSeeding.tsx
- ConsensusTransparency.tsx
- CurvesDemo.tsx
- dashboard.tsx
- data-sources.tsx
- DataIngestion.tsx
- DefenseRankings.tsx
- DraftAnalysis.tsx
- DraftRoom.tsx
- dynasty-values.tsx
- Dynasty.tsx
- DynastyDeclineAnalysis.tsx
- enhanced-dynasty.tsx
- enhanced-player-profile.tsx
- fantasy-moves.tsx
- FlexMatchups.tsx
- FullPlayerPool.tsx
- home.tsx
- HotList.tsx
- how-you-can-contribute.tsx
- InjuryProfilesDemo.tsx
- Leaders.tsx
- LeadersPage.tsx
- league-analysis.tsx
- leagues.tsx
- lineup-optimizer.tsx
- login.tsx
- Methodology.tsx
- MockLanding.tsx
- News.tsx
- Oasis.tsx
- TRACKSTARTeamContext.tsx
- player-analysis.tsx
- player-analytics.tsx
- player-profile.tsx
- player-search-demo.tsx
- PlayerCompare.tsx
- PlayerComparison.tsx
- PlayerDatabase.tsx
- PlayerEvaluation.tsx
- PlayerProfile.tsx
- players.tsx
- PlayerShowcase.tsx
- PowerRankings.tsx (old version)
- premium-analytics.tsx
- ProjectionsTest.tsx
- PrometheanVision.tsx
- PrometheusBenchmarks.tsx
- PrometheusStressTest.tsx
- QBEnvironmentContext.tsx
- QBEvaluationLogic.tsx
- Rankings.tsx
- RankingsV3.tsx
- RBAnalytics.tsx
- RBCompass.tsx
- RBDraftCapitalContext.tsx
- RBTouchdownRegression.tsx
- Redraft.tsx
- RedraftHub.tsx
- RedraftHubNew.tsx
- RedraftList.tsx
- Reflect.tsx
- ResearchAnalysis.tsx
- RisersAndFallers.tsx
- RookieEvaluator.tsx
- RookieRisers.tsx
- SignalFlare.tsx
- signup.tsx
- SimplifiedADP.tsx
- sleeper-connect.tsx
- sleeper-database.tsx
- SnapCounts.tsx
- SOSDashboardPage.tsx (migrate logic to Strategy tab)
- SOSDocumentationPage.tsx
- StartSit.tsx
- team-context.tsx
- team-sync.tsx
- teams.tsx
- TECompass.tsx
- TestADP.tsx
- TestDataPage.tsx
- TETouchdownRegression.tsx
- Tiber.tsx (old version)
- TiberData.tsx
- trade-history.tsx
- TradeEvaluator.tsx
- trades.tsx
- trending-players.tsx
- trends.tsx
- value-arbitrage.tsx
- Waivers.tsx
- WeeklyData.tsx
- WRCompass.tsx
- WRForecastEvaluation.tsx
- WRTouchdownRegression.tsx
- compass/* (entire folder - consolidate into Strategy tab)
- consensus/* (entire folder)
- experts/* (entire folder)
- mock/* (entire folder)
- players/* (entire folder - except migrate logic to Strategy)
- rankings/* (entire folder)
- redraft/* (entire folder)
```

## New Structure

```
client/src/
├── pages/
│   └── TiberDashboard.tsx          (Single entry point - 6 tabs)
├── components/
│   ├── tabs/
│   │   ├── HomeTab.tsx
│   │   ├── RankingsTab.tsx
│   │   ├── MatchupsTab.tsx
│   │   ├── StrategyTab.tsx
│   │   ├── MovesTab.tsx
│   │   └── LeaguesTab.tsx
│   └── shared/
│       ├── PlayerCard.tsx
│       ├── StatCard.tsx
│       ├── LoadingState.tsx
│       └── ComingSoon.tsx
└── App.tsx (simplified routing)
```

## Backend - KEEP AS-IS
- ✅ OVR API + caching (`/api/ovr`)
- ✅ DvP API (`/api/dvp`)
- ✅ SOS API (`/api/sos`)
- ✅ EPA processor
- ✅ ETL pipeline (Bronze→Silver→Gold)
- ✅ All database schemas and services

## Branding Changes
- Replace all "On The Clock" → "Tiber Fantasy"
- Update Navigation.tsx
- Update Footer.tsx
- Update page titles and meta tags

## Implementation Plan
1. ✅ Audit complete
2. Create new tab components
3. Rebuild TiberDashboard with 6-tab structure
4. Migrate working features (OVR, DvP, SOS) into tabs
5. Delete all unused files
6. Simplify App.tsx routing to single `/` route
7. Update branding across all components
8. Add SEO and polish
9. Test thoroughly
