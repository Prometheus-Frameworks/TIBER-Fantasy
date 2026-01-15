# State Machine Diagrams - Tiber Fantasy

This document contains state machine diagrams for the major stateful components in the codebase.

**Generated**: 2026-01-10
**PNG Images**: `docs/diagrams/*.png`
**Source Files**: `docs/diagrams/*.mmd`

---

## 0. System Overview

This diagram shows how all the major components connect together.

```mermaid
flowchart TB
    subgraph Frontend["Frontend (React)"]
        ForgeLab["ForgeLab Page<br/>Filter/Inspect/Export States"]
        PlayerPage["PlayerPage<br/>Multi-Query Coordination"]
        Dashboard["TiberDashboard<br/>Tab Navigation"]
        RankingsTab["RankingsTab<br/>Filter + Drawer States"]
    end

    subgraph FORGE["FORGE Engine (Core Scoring)"]
        direction TB
        ForgeEngine["forgeEngine.ts<br/>ELT Pipeline"]
        AlphaEngine["alphaEngine.ts<br/>Calibration Pipeline"]
        RecursiveAlpha["recursiveAlphaEngine.ts<br/>Week-over-Week State"]
        FootballLens["forgeFootballLens.ts<br/>Position Rules"]
        DynastyCtx["Dynasty Context<br/>QB Injury Detection"]
        ForgeState["forgeStateService.ts<br/>State Persistence"]
    end

    subgraph Decision["Decision Engines"]
        StartSit["startSitAgent.ts<br/>START/FLEX/SIT"]
    end

    subgraph Infra["Infrastructure"]
        Scheduler["IntelligentScheduler<br/>SLA-Aware Jobs"]
        DB[(PostgreSQL<br/>forge_player_state)]
    end

    subgraph DataSources["External Data"]
        Sleeper["Sleeper API"]
        MSF["MySportsFeeds"]
        NFLData["NFL-Data-Py"]
    end

    ForgeLab -->|"GET /api/forge/scores"| ForgeEngine
    PlayerPage -->|"GET /api/player/:id"| ForgeEngine
    RankingsTab -->|"GET /api/rankings"| ForgeEngine
    Dashboard --> RankingsTab

    ForgeEngine -->|"1. Fetch Context"| DataSources
    ForgeEngine -->|"2. Build Metrics"| AlphaEngine
    AlphaEngine -->|"3. Calculate Pillars"| FootballLens
    FootballLens -->|"4. Apply Rules"| RecursiveAlpha
    RecursiveAlpha -->|"5. Blend Prior"| ForgeState
    ForgeState <-->|"Read/Write State"| DB

    AlphaEngine -->|"WR Only"| DynastyCtx
    DynastyCtx -->|"QB Metrics"| DataSources

    ForgeEngine -->|"Player Scores"| StartSit
    StartSit -->|"Matchup Data"| DataSources

    Scheduler -->|"Trigger Recompute"| ForgeEngine
    Scheduler -->|"Check Freshness"| DB
```

**Key Data Flows:**
1. **Frontend → FORGE**: API requests for player scores
2. **FORGE Pipeline**: FetchContext → BuildMetrics → ComputePillars → FootballLens → RecursiveAlpha
3. **State Persistence**: Week N state saved to `forge_player_state` for Week N+1 recursion
4. **External Data**: Sleeper (projections), MySportsFeeds (injuries), NFL-Data-Py (stats)

---

## 1. FORGE Recursive Alpha Engine

The core two-pass scoring system that maintains week-over-week player state.

```mermaid
stateDiagram-v2
    [*] --> CheckWeek

    CheckWeek --> FirstWeek: week == 1
    CheckWeek --> RecursiveWeek: week > 1

    state FirstWeek {
        [*] --> CalculateRawAlpha
        CalculateRawAlpha --> SetBaseline
        SetBaseline --> InitializeState
        InitializeState --> [*]
    }

    state RecursiveWeek {
        [*] --> FetchPreviousState
        FetchPreviousState --> CalculateExpected: state found
        FetchPreviousState --> FallbackToBaseline: no state

        CalculateExpected --> CalculateRawAlpha2
        FallbackToBaseline --> CalculateRawAlpha2

        CalculateRawAlpha2 --> CalculateSurprise
        CalculateSurprise --> CheckVolatility

        CheckVolatility --> ReducePositiveSurprise: volatility > 10
        CheckVolatility --> AmplifySurprise: volatility < 5
        CheckVolatility --> NormalAdjustment: else

        ReducePositiveSurprise --> ApplyMomentum
        AmplifySurprise --> ApplyMomentum
        NormalAdjustment --> ApplyMomentum

        ApplyMomentum --> ClampFinal
        ClampFinal --> [*]
    }

    FirstWeek --> PersistState
    RecursiveWeek --> PersistState
    PersistState --> [*]
```

**State Definitions:**
- `FetchPreviousState`: Retrieves alphaPrev, tierPrev, volatility, momentum from `forge_player_state`
- `CalculateExpected`: `alphaPrev * 0.7 + baseline * 0.3`
- `CalculateSurprise`: `rawAlpha - expectedAlpha`
- `PersistState`: Saves to `forge_player_state` for next week's recursion

**File:** `server/modules/forge/recursiveAlphaEngine.ts`

---

## 2. FORGE Engine ELT Pipeline

The main scoring pipeline following Bronze → Silver → Gold data transformation.

```mermaid
stateDiagram-v2
    [*] --> FetchContext

    state FetchContext {
        [*] --> LoadRoleBank
        LoadRoleBank --> LoadTeamContext
        LoadTeamContext --> LoadSoSData
        LoadSoSData --> LoadQBContext
        LoadQBContext --> [*]
    }

    FetchContext --> BuildMetrics: context ready

    state BuildMetrics {
        [*] --> CreateMetricLookup
        CreateMetricLookup --> NormalizeMetrics
        NormalizeMetrics --> ComputeDerivedMetrics
        ComputeDerivedMetrics --> [*]
    }

    BuildMetrics --> ComputePillars: metrics ready

    state ComputePillars {
        [*] --> VolumeScore
        VolumeScore --> EfficiencyScore
        EfficiencyScore --> TeamContextScore
        TeamContextScore --> StabilityScore
        StabilityScore --> DynastyContext: position == WR
        StabilityScore --> [*]: position != WR
        DynastyContext --> [*]
    }

    ComputePillars --> ApplyFootballLens

    state ApplyFootballLens {
        [*] --> CheckTDSpike
        CheckTDSpike --> CheckVolumeMismatch
        CheckVolumeMismatch --> CheckPolarization
        CheckPolarization --> FlagIssues
        FlagIssues --> [*]
    }

    ApplyFootballLens --> OutputScore
    OutputScore --> [*]
```

**File:** `server/modules/forge/forgeEngine.ts`

---

## 3. FORGE Alpha Calibration Pipeline

The scoring calculation and calibration process.

```mermaid
stateDiagram-v2
    [*] --> ExtractFeatures

    ExtractFeatures --> CalculateSubScores

    state CalculateSubScores {
        [*] --> VolumeScore
        VolumeScore --> EfficiencyScore
        EfficiencyScore --> StabilityScore
        StabilityScore --> ContextFitScore
        ContextFitScore --> ApplyPPRModifier
        ApplyPPRModifier --> [*]
    }

    CalculateSubScores --> WeightedBlend

    state WeightedBlend {
        [*] --> LoadPositionWeights
        LoadPositionWeights --> ApplyWeights
        ApplyWeights --> SumWeightedScores
        SumWeightedScores --> [*]
    }

    WeightedBlend --> ApplyModifiers

    state ApplyModifiers {
        [*] --> EnvironmentModifier
        EnvironmentModifier --> MatchupModifier
        MatchupModifier --> [*]
    }

    ApplyModifiers --> CalibrateAlpha

    state CalibrateAlpha {
        [*] --> DetectZScore
        DetectZScore --> PositionCalibration
        PositionCalibration --> ClampRange
        ClampRange --> [*]
    }

    CalibrateAlpha --> CheckViewMode

    CheckViewMode --> ApplyDynastyAge: viewMode == dynasty
    CheckViewMode --> CalculateTrajectory: else

    state ApplyDynastyAge {
        [*] --> CheckAge
        CheckAge --> ApplyBoost: age < 27
        CheckAge --> ApplyDecay: age > 27
        CheckAge --> Neutral: age == 27
        ApplyBoost --> [*]
        ApplyDecay --> [*]
        Neutral --> [*]
    }

    ApplyDynastyAge --> CalculateTrajectory
    CalculateTrajectory --> CalculateConfidence
    CalculateConfidence --> [*]
```

**Trajectory States:**
- `Rising`: recent weighted avg > season avg by 6+
- `Declining`: recent weighted avg < season avg by 6+
- `Flat`: within 6 points

**File:** `server/modules/forge/alphaEngine.ts`

---

## 4. Dynasty Context Computation (WR Only)

Complex injury-aware QB evaluation for dynasty scoring.

```mermaid
stateDiagram-v2
    [*] --> CheckPosition

    CheckPosition --> Skip: position != WR
    CheckPosition --> StartComputation: position == WR
    Skip --> [*]

    StartComputation --> FetchQBData

    state FetchQBData {
        [*] --> GetCurrentSeasonQB
        GetCurrentSeasonQB --> CheckGamesPlayed

        CheckGamesPlayed --> HealthyStarter: games >= 8
        CheckGamesPlayed --> PartialSeason: 5 <= games < 8
        CheckGamesPlayed --> PotentialInjury: games < 5
    }

    state HealthyStarter {
        [*] --> FetchCurrentMetrics
        FetchCurrentMetrics --> FetchHistorical
        FetchHistorical --> BlendHealthy
        note right of BlendHealthy
            10% lastHealthy
            30% career
            60% current
        end note
        BlendHealthy --> [*]
    }

    state PartialSeason {
        [*] --> FetchPartialCurrent
        FetchPartialCurrent --> FetchHistoricalHeavy
        FetchHistoricalHeavy --> BlendPartial
        note right of BlendPartial
            40% current
            60% historical
        end note
        BlendPartial --> [*]
    }

    state PotentialInjury {
        [*] --> SearchFranchiseQB
        SearchFranchiseQB --> FoundFranchise: QB found
        SearchFranchiseQB --> NoFranchise: not found

        FoundFranchise --> CheckInjured
        CheckInjured --> InjuredFranchise: games < 5
        CheckInjured --> NotInjured: games >= 5

        InjuredFranchise --> BlendInjured
        note right of BlendInjured
            60% lastHealthy
            30% career
            10% current (0)
        end note

        NotInjured --> UseBestAvailable
        NoFranchise --> UseDefault

        BlendInjured --> [*]
        UseBestAvailable --> [*]
        UseDefault --> [*]
    }

    HealthyStarter --> CalculateContinuity
    PartialSeason --> CalculateContinuity
    PotentialInjury --> CalculateContinuity

    state CalculateContinuity {
        [*] --> TeamPassVolume
        TeamPassVolume --> TeamPace
        TeamPace --> BlendContinuity
        note right of BlendContinuity
            60% passVolume
            40% pace
        end note
        BlendContinuity --> [*]
    }

    CalculateContinuity --> CareerEfficiency
    CareerEfficiency --> FinalBlend

    state FinalBlend {
        [*] --> Combine
        note right of Combine
            40% qbLongTerm
            30% continuity
            30% efficiency
        end note
        Combine --> Clamp
        Clamp --> [*]
    }

    FinalBlend --> [*]
```

**File:** `server/modules/forge/forgeEngine.ts` (lines 641-850)

---

## 5. ForgeLab Page Component

React component state machine for the FORGE Lab interface.

```mermaid
stateDiagram-v2
    [*] --> Idle

    state Idle {
        [*] --> WaitingForInput
    }

    Idle --> Loading: fetch triggered

    state Loading {
        [*] --> FetchingScores
        FetchingScores --> ScoresReceived: success
        FetchingScores --> FetchError: error
    }

    Loading --> Loaded: scores received
    Loading --> Error: fetch failed

    state Loaded {
        [*] --> DisplayScores
        DisplayScores --> FilterChange: position/week changed
        FilterChange --> FetchingScores
    }

    state Error {
        [*] --> ShowError
        ShowError --> Retry: user retry
    }

    Error --> Loading: retry

    Loaded --> Inspecting: inspect player

    state Inspecting {
        [*] --> FetchingPlayerData
        FetchingPlayerData --> PlayerLoaded: success
        FetchingPlayerData --> InspectError: error

        PlayerLoaded --> DisplayInspection
        DisplayInspection --> CloseInspection: close clicked
    }

    Inspecting --> Loaded: close inspection

    Loaded --> Exporting: export clicked

    state Exporting {
        [*] --> GeneratingSnapshot
        GeneratingSnapshot --> SnapshotReady: success
        GeneratingSnapshot --> ExportError: error

        SnapshotReady --> DisplaySnapshotInfo
    }

    Exporting --> Loaded: export complete
```

**State Variables:**
- `position`: QB | RB | WR | TE | ALL
- `loading`: boolean
- `scores[]`: ForgeScore[]
- `inspectId`: string | null
- `inspecting`: boolean
- `exporting`: boolean

**File:** `client/src/pages/ForgeLab.tsx`

---

## 6. PlayerPage Component

Multi-fetch async coordination for player detail view.

```mermaid
stateDiagram-v2
    [*] --> ParseRoute

    ParseRoute --> FetchIdentity: playerId extracted

    state FetchIdentity {
        [*] --> QueryingIdentity
        QueryingIdentity --> IdentityFound: success
        QueryingIdentity --> IdentityNotFound: 404
    }

    FetchIdentity --> PlayerNotFound: not found
    FetchIdentity --> LoadPlayerData: identity found

    state LoadPlayerData {
        [*] --> ParallelFetch

        state ParallelFetch {
            FetchWeeks
            FetchScores
            FetchContext
            FetchNeighbors
            FetchSimilar
            FetchLeagues
        }

        ParallelFetch --> DataReady: all complete
        ParallelFetch --> PartialData: some failed
    }

    LoadPlayerData --> DisplayPlayer

    state DisplayPlayer {
        [*] --> OverviewTab

        OverviewTab --> UsageTab: tab click
        UsageTab --> CompsTab: tab click
        CompsTab --> LeagueTab: tab click
        LeagueTab --> NotesTab: tab click
        NotesTab --> OverviewTab: tab click

        OverviewTab --> WeekChange: week selected
        UsageTab --> WeekChange
        WeekChange --> RefetchWeekData
        RefetchWeekData --> OverviewTab
    }

    DisplayPlayer --> ParseRoute: route change
    PlayerNotFound --> [*]
```

**Tab States:**
- `overview`: General player info + FORGE score
- `usage`: Usage metrics and trends
- `comps`: Similar player comparisons
- `league`: League ownership data
- `notes`: User notes

**File:** `client/src/pages/PlayerPage.tsx`

---

## 7. TiberDashboard / RankingsTab

Tab navigation and filter state management.

```mermaid
stateDiagram-v2
    [*] --> ParseURL

    ParseURL --> SelectTab: tab param found
    ParseURL --> DefaultTab: no param

    DefaultTab --> HomeTab

    state TabNavigation {
        HomeTab --> RankingsTab: click
        RankingsTab --> MatchupsTab: click
        MatchupsTab --> StrategyTab: click
        StrategyTab --> WeeklyTakesTab: click
        WeeklyTakesTab --> MovesTab: click
        MovesTab --> LeaguesTab: click
        LeaguesTab --> AdminTab: click
        AdminTab --> HomeTab: click
    }

    state RankingsTab {
        [*] --> InitFilters

        state InitFilters {
            [*] --> SetDefaultPosition
            SetDefaultPosition --> SetDefaultWeek
            SetDefaultWeek --> SetDefaultView
            SetDefaultView --> [*]
        }

        InitFilters --> FetchRankings

        state FilterState {
            PositionFilter: ALL | QB | RB | WR | TE
            WeekFilter: 1-18
            ViewMode: weekly | roles
        }

        FetchRankings --> DisplayRankings

        state DisplayRankings {
            [*] --> ShowList
            ShowList --> ExpandSection: section header click
            ExpandSection --> CollapseSection: same header click
            ShowList --> OpenDrawer: player row click
        }

        state PlayerDrawer {
            [*] --> DrawerOpening
            DrawerOpening --> DrawerOpen: animation complete
            DrawerOpen --> DrawerClosing: close click
            DrawerClosing --> ClearPlayer: 300ms delay
            ClearPlayer --> [*]
        }

        DisplayRankings --> PlayerDrawer: select player
        PlayerDrawer --> DisplayRankings: drawer closed

        DisplayRankings --> FilterChange: filter changed
        FilterChange --> FetchRankings
    }

    SelectTab --> TabNavigation
```

**File:** `client/src/components/tabs/RankingsTab.tsx`

---

## 8. Start/Sit Decision Engine

Multi-factor recommendation system.

```mermaid
stateDiagram-v2
    [*] --> BuildProfile

    state BuildProfile {
        [*] --> FetchUsage
        FetchUsage --> FetchMatchup
        FetchMatchup --> FetchInjury
        FetchInjury --> ProfileReady
        ProfileReady --> [*]
    }

    BuildProfile --> ScoreFactors

    state ScoreFactors {
        [*] --> ScoreUsage
        ScoreUsage --> ScoreMatchup
        ScoreMatchup --> ScoreVolatility

        state ScoreUsage {
            [*] --> CalculateUsageScore
            CalculateUsageScore --> UsageBoost: score > 70
            CalculateUsageScore --> UsageNeutral: 40-70
            CalculateUsageScore --> UsageDowngrade: score < 40
        }

        state ScoreMatchup {
            [*] --> CalculateSoSScore
            CalculateSoSScore --> MatchupBoost: score > 70
            CalculateSoSScore --> MatchupNeutral: 40-70
            CalculateSoSScore --> MatchupDowngrade: score < 40
        }

        state ScoreVolatility {
            [*] --> CheckInjury
            CheckInjury --> InjuryDowngrade: healthScore < 80
            CheckInjury --> NoInjuryImpact: healthScore >= 80
        }

        ScoreVolatility --> [*]
    }

    ScoreFactors --> GenerateVerdict

    state GenerateVerdict {
        [*] --> WeightFactors
        WeightFactors --> SumScores
        SumScores --> ApplyRules
        ApplyRules --> DetermineVerdict

        DetermineVerdict --> START: totalScore > 70
        DetermineVerdict --> FLEX: 40 <= totalScore <= 70
        DetermineVerdict --> SIT: totalScore < 40
    }

    GenerateVerdict --> FlagSignals

    state FlagSignals {
        [*] --> IdentifyTopSignals
        IdentifyTopSignals --> IdentifyRiskFlags
        IdentifyRiskFlags --> [*]
    }

    FlagSignals --> [*]
```

**Verdict States:**
- `START`: High confidence play (>70)
- `FLEX`: Context-dependent (40-70)
- `SIT`: Avoid this week (<40)

**File:** `server/modules/startSit/startSitAgent.ts`

---

## 9. Intelligent Scheduler Service

SLA-aware job scheduling system.

```mermaid
stateDiagram-v2
    [*] --> EvaluateTriggers

    state EvaluateTriggers {
        [*] --> CheckTimeTrigger
        CheckTimeTrigger --> CheckDataChangeTrigger
        CheckDataChangeTrigger --> CheckSLATrigger
        CheckSLATrigger --> CheckErrorTrigger
        CheckErrorTrigger --> PriorityDecision

        PriorityDecision --> CriticalPriority: SLA breach
        PriorityDecision --> HighPriority: data stale
        PriorityDecision --> MediumPriority: time-based
        PriorityDecision --> LowPriority: maintenance
    }

    EvaluateTriggers --> AssessSystemLoad

    state AssessSystemLoad {
        [*] --> MeasureCPU
        MeasureCPU --> MeasureMemory
        MeasureMemory --> CheckConnections
        CheckConnections --> CheckActiveJobs
        CheckActiveJobs --> CalculateErrorRate
        CalculateErrorRate --> LoadAssessed
    }

    AssessSystemLoad --> DecideAction

    state DecideAction {
        [*] --> CheckLoadThreshold
        CheckLoadThreshold --> ProceedWithJob: load OK
        CheckLoadThreshold --> DeferJob: load high

        ProceedWithJob --> CheckIdempotency
        CheckIdempotency --> SkipDuplicate: already processed
        CheckIdempotency --> ExecuteJob: new job
    }

    DecideAction --> ExecuteOrDefer

    state ExecuteOrDefer {
        Execute --> JobRunning
        JobRunning --> JobSuccess: completed
        JobRunning --> JobFailed: error

        JobFailed --> ApplyBackoff
        ApplyBackoff --> RetryJob: retries left
        ApplyBackoff --> MarkFailed: max retries
    }

    ExecuteOrDefer --> LogMetrics
    LogMetrics --> ScheduleNextCycle
    ScheduleNextCycle --> EvaluateTriggers
```

**Freshness States:**
- `fresh`: lastCommit <= lastProcessing
- `stale`: processing behind by < threshold
- `critical`: processing behind by >= threshold

**File:** `server/services/IntelligentScheduler.ts`

---

## 10. Football Lens Validation Rules

Position-specific issue detection state machine.

```mermaid
stateDiagram-v2
    [*] --> CheckPosition

    CheckPosition --> WRRules: position == WR
    CheckPosition --> RBRules: position == RB
    CheckPosition --> TERules: position == TE
    CheckPosition --> QBRules: position == QB

    state WRRules {
        [*] --> CheckWRVolume

        CheckWRVolume --> LowVolHighEff: volume < 40 && efficiency > 70
        CheckWRVolume --> HighVolLowEff: volume > 70 && efficiency < 40
        CheckWRVolume --> WRNormal: else

        LowVolHighEff --> ScaleEfficiency90
        note right of ScaleEfficiency90: TD spike detection

        HighVolLowEff --> FlagForceFed
        WRNormal --> [*]
        ScaleEfficiency90 --> [*]
        FlagForceFed --> [*]
    }

    state RBRules {
        [*] --> CheckRBMetrics

        CheckRBMetrics --> HighVolLowEffRB: volume > 70 && efficiency < 40
        CheckRBMetrics --> WorkhorseBadOff: workhorse && offenseRank < 20
        CheckRBMetrics --> LowVolHighEffRB: volume < 40 && efficiency > 70
        CheckRBMetrics --> RBNormal: else

        HighVolLowEffRB --> FlagPerfRisk
        WorkhorseBadOff --> ScaleTeamContext
        LowVolHighEffRB --> ScaleEfficiency92
        note right of ScaleEfficiency92: Upside opportunity

        RBNormal --> [*]
        FlagPerfRisk --> [*]
        ScaleTeamContext --> [*]
        ScaleEfficiency92 --> [*]
    }

    state TERules {
        [*] --> CheckTEVolume

        CheckTEVolume --> LowVolHighEffTE: volume < 40 && efficiency > 70
        CheckTEVolume --> TENormal: else

        LowVolHighEffTE --> ScaleEfficiency88
        note right of ScaleEfficiency88: TD regression risk

        TENormal --> [*]
        ScaleEfficiency88 --> [*]
    }

    state QBRules {
        [*] --> CheckQBMetrics

        CheckQBMetrics --> HighEffLowStab: efficiency > 70 && stability < 40
        CheckQBMetrics --> HighVolLowEffQB: volume > 70 && efficiency < 40
        CheckQBMetrics --> QBNormal: else

        HighEffLowStab --> FlagBoomBust
        HighVolLowEffQB --> FlagGarbageTime

        QBNormal --> [*]
        FlagBoomBust --> [*]
        FlagGarbageTime --> [*]
    }

    WRRules --> GlobalChecks
    RBRules --> GlobalChecks
    TERules --> GlobalChecks
    QBRules --> GlobalChecks

    state GlobalChecks {
        [*] --> CheckPolarization
        CheckPolarization --> FlagContextSensitive: pillars polarized
        CheckPolarization --> CheckSampleSize

        CheckSampleSize --> FlagVolatility: games < 3
        CheckSampleSize --> NoFlags: else

        FlagContextSensitive --> CheckSampleSize
        FlagVolatility --> [*]
        NoFlags --> [*]
    }

    GlobalChecks --> [*]
```

**File:** `server/modules/forge/forgeFootballLens.ts`

---

## Summary

| Component | Primary Pattern | Key Files |
|-----------|----------------|-----------|
| Recursive Alpha | Week-over-week state persistence | `recursiveAlphaEngine.ts`, `forgeStateService.ts` |
| FORGE Engine | ELT Pipeline (Bronze→Silver→Gold) | `forgeEngine.ts` |
| Alpha Calibration | Multi-stage transformation | `alphaEngine.ts` |
| Dynasty Context | Injury-aware branching | `forgeEngine.ts:641-850` |
| ForgeLab | Async data fetch + UI state | `ForgeLab.tsx` |
| PlayerPage | Multi-query coordination | `PlayerPage.tsx` |
| RankingsTab | Filter + drawer pattern | `RankingsTab.tsx` |
| Start/Sit | Multi-factor decision tree | `startSitAgent.ts` |
| Scheduler | SLA-aware job control | `IntelligentScheduler.ts` |
| Football Lens | Position-specific rule engine | `forgeFootballLens.ts` |
