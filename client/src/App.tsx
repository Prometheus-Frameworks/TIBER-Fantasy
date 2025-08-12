import { Switch, Route } from "wouter";
import { lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import TeamSync from "@/pages/team-sync";
import LineupOptimizer from "@/pages/lineup-optimizer";
import PremiumAnalytics from "@/pages/premium-analytics";
import PlayersPage from "@/pages/players";
import TrendsPage from "@/pages/trends";
import TradesPage from "@/pages/trades";
import ValueArbitragePage from "@/pages/value-arbitrage";
import PlayerAnalysisPage from "@/pages/player-analysis";
import TradeHistoryPage from "@/pages/trade-history";
import DynastyValuesPage from "@/pages/dynasty-values";

import PlayerSearchDemo from "@/pages/player-search-demo";
import LeagueAnalysisPage from "@/pages/league-analysis";
import FantasyMovesPage from "@/pages/fantasy-moves";
import TrendingPlayersPage from "@/pages/trending-players";
import CompareLeaguePage from "@/pages/compare-league";
import EnhancedPlayerProfile from "@/pages/enhanced-player-profile";
import EnhancedDynasty from "@/pages/enhanced-dynasty";
import About from "@/pages/about";
import DataSourcesPage from "@/pages/data-sources";
import CleanADP from "@/pages/CleanADP";
import Oasis from "@/pages/Oasis";
import DraftRoom from "@/pages/DraftRoom";
import PlayerProfile from "@/pages/PlayerProfile";
import Rankings from "@/pages/Rankings";
import RankingsHub from "@/pages/rankings/RankingsHub";
import RedraftRankings from "@/pages/rankings/RedraftRankings";
import DynastyRankings from "@/pages/rankings/DynastyRankings";
import DynastyDeclineAnalysis from "@/pages/DynastyDeclineAnalysis";
import RBTouchdownRegression from "@/pages/RBTouchdownRegression";
import WRTouchdownRegression from "@/pages/WRTouchdownRegression";
import TETouchdownRegression from "@/pages/TETouchdownRegression";
import QBEvaluationLogic from "@/pages/QBEvaluationLogic";
import QBEnvironmentContext from "@/pages/QBEnvironmentContext";
import WRForecastEvaluation from "@/pages/WRForecastEvaluation";
import WRAnalyticsTable from "@/components/WRAnalyticsTable";
import RBAnalytics from "@/pages/RBAnalytics";
import QBAnalyticsTable from "@/components/QBAnalyticsTable";
import TEAnalyticsTable from "@/components/TEAnalyticsTable";
import TEEvaluationTest from "@/pages/TEEvaluationTest";
import BatchEvaluationTest from "@/pages/BatchEvaluationTest";
import PrometheusStressTest from "@/pages/PrometheusStressTest";
import OASISTeamContext from "@/pages/OASISTeamContext";
import FullPlayerPool from "@/pages/FullPlayerPool";
import TradeEvaluator from "@/pages/TradeEvaluator";
import ProjectionsTest from "@/pages/ProjectionsTest";
import DataIngestion from "@/pages/DataIngestion";
import Reflect from "@/pages/Reflect";
import NotFound from "@/pages/not-found";
import SleeperDatabase from "@/pages/sleeper-database";
import PrometheusBenchmarks from "@/pages/PrometheusBenchmarks";
import CommunityPosts from "@/pages/CommunityPosts";
import AdvancedAnalytics from "@/pages/AdvancedAnalytics";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Teams from "@/pages/teams";
// FantasyProTest removed - service deprecated
import HowYouCanContribute from "@/pages/how-you-can-contribute";
import RBDraftCapitalContext from "@/pages/RBDraftCapitalContext";
import PlayerCompass from "@/pages/PlayerCompass";
import RBCompass from "@/pages/RBCompass";
import TECompass from "@/pages/TECompass";
import WRCompass from "@/pages/WRCompass";
import RookieEvaluator from "@/pages/RookieEvaluator";

import TiberData from "@/pages/TiberData";
import TradeAnalyzer from "@/pages/TradeAnalyzer";
import TradeAnalyzerNew from "@/pages/TradeAnalyzerNew";
import Waivers from "@/pages/Waivers";
import WeeklyData from "@/pages/WeeklyData";
import Redraft from "@/pages/Redraft";
import RedraftHub from "@/pages/RedraftHubNew";
import Dynasty from "@/pages/Dynasty";
import Navigation from "@/components/Navigation";
import Analytics from "@/pages/Analytics";
import Articles from "@/pages/Articles";
import HealthBadge from "@/components/HealthBadge";
import Footer from "@/components/Footer";
import FounderModal from "@/components/FounderModal";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/sync" component={TeamSync} />
      <Route path="/players" component={PlayersPage} />
      <Route path="/trends" component={TrendsPage} />
      <Route path="/trades" component={TradesPage} />
      <Route path="/arbitrage" component={ValueArbitragePage} />
      <Route path="/player-analysis" component={PlayerAnalysisPage} />
      <Route path="/trade-history/:id" component={TradeHistoryPage} />
      <Route path="/dynasty-values" component={DynastyValuesPage} />
      <Route path="/rankings" component={RankingsHub} />
      <Route path="/rankings/redraft" component={RedraftRankings} />
      <Route path="/rankings/dynasty" component={DynastyRankings} />
      <Route path="/compare-league" component={CompareLeaguePage} />
      <Route path="/enhanced-dynasty" component={EnhancedDynasty} />
      <Route path="/player-compass" component={PlayerCompass} />
      <Route path="/wr-compass" component={WRCompass} />
      <Route path="/rb-compass" component={RBCompass} />
      <Route path="/te-compass" component={TECompass} />
      <Route path="/rookie-evaluator" component={RookieEvaluator} />
      <Route path="/tiber-data" component={TiberData} />
      <Route path="/trade-analyzer" component={TradeAnalyzer} />
      <Route path="/trade-analyzer-new" component={TradeAnalyzerNew} />
      <Route path="/waivers" component={Waivers} />
      <Route path="/weekly-data" component={WeeklyData} />
      <Route path="/redraft" component={RedraftHub} />
      <Route path="/dynasty" component={Dynasty} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/articles" component={Articles} />
      <Route path="/api-test" component={lazy(() => import("@/pages/ApiTest"))} />
      <Route path="/api-demo" component={lazy(() => import("@/pages/ApiDemo"))} />
      <Route path="/api-comprehensive" component={lazy(() => import("@/pages/ApiComprehensive"))} />
      <Route path="/data-sources" component={DataSourcesPage} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/teams" component={Teams} />
      <Route path="/adp" component={CleanADP} />
      <Route path="/oasis" component={Oasis} />
      <Route path="/draft-room" component={DraftRoom} />
      <Route path="/player/:id" component={PlayerProfile} />
      <Route path="/enhanced-player/:id" component={EnhancedPlayerProfile} />
      <Route path="/player-pool" component={FullPlayerPool} />
      <Route path="/about" component={About} />
      <Route path="/how-you-can-contribute" component={HowYouCanContribute} />
      <Route path="/lineup" component={LineupOptimizer} />
      <Route path="/analytics" component={AdvancedAnalytics} />
      <Route path="/analytics/wide-receivers" component={AdvancedAnalytics} />
      <Route path="/analytics/running-backs" component={AdvancedAnalytics} />
      <Route path="/analytics/quarterbacks" component={AdvancedAnalytics} />
      <Route path="/analytics/tight-ends" component={AdvancedAnalytics} />
      <Route path="/premium" component={PremiumAnalytics} />
      <Route path="/sleeper-database" component={SleeperDatabase} />
      <Route path="/community-posts" component={CommunityPosts} />
      <Route path="/prometheus-benchmarks" component={PrometheusBenchmarks} />
      <Route path="/dynasty-decline-analysis" component={DynastyDeclineAnalysis} />
      <Route path="/rb-touchdown-regression" component={RBTouchdownRegression} />
      <Route path="/rb-draft-capital-context" component={RBDraftCapitalContext} />
      <Route path="/wr-touchdown-regression" component={WRTouchdownRegression} />
      <Route path="/te-touchdown-regression" component={TETouchdownRegression} />
      <Route path="/qb-evaluation-logic" component={QBEvaluationLogic} />
      <Route path="/qb-environment-context" component={QBEnvironmentContext} />
      <Route path="/wr-forecast-evaluation" component={WRForecastEvaluation} />
      <Route path="/te-evaluation-test" component={TEEvaluationTest} />
      <Route path="/batch-evaluation-test" component={BatchEvaluationTest} />
      <Route path="/prometheus-stress-test" component={PrometheusStressTest} />
      <Route path="/oasis-team-context" component={OASISTeamContext} />
      <Route path="/trade-evaluator" component={TradeEvaluator} />
      <Route path="/projections-test" component={ProjectionsTest} />
      <Route path="/data-ingestion" component={DataIngestion} />
      <Route path="/reflect" component={Reflect} />
      {/* FantasyProTest route removed - service deprecated */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Check for demo mode
  const isDemoMode = window.location.search.includes('demo=1');
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Navigation />
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Router />
        </main>
        <footer className="border-t bg-white dark:bg-gray-800 py-3 px-4">
          <div className="mx-auto max-w-6xl flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                build: v1.0.3-{new Date().toISOString().slice(0, 16)}
              </span>
              <HealthBadge isDemoMode={isDemoMode} />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Backend Spine: Live • Ratings Engine: Active
            </div>
          </div>
        </footer>
        <Footer />
        <FounderModal />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
