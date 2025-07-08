import { Switch, Route } from "wouter";
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
import ValueRankingsPage from "@/pages/value-rankings";
import LeagueRankingsPage from "@/pages/league-rankings";
import PositionRankingsPage from "@/pages/position-rankings";
import SimpleRankingsPage from "@/pages/simple-rankings";
import RankingAnalysisPage from "@/pages/ranking-analysis";
import PlayerSearchDemo from "@/pages/player-search-demo";
import LeagueAnalysisPage from "@/pages/league-analysis";
import FantasyMovesPage from "@/pages/fantasy-moves";
import TrendingPlayersPage from "@/pages/trending-players";
import CompareLeaguePage from "@/pages/compare-league";
import EnhancedPlayerProfile from "@/pages/enhanced-player-profile";
import EnhancedDynasty from "@/pages/enhanced-dynasty";
import EnhancedRankings from "@/pages/enhanced-rankings";
import About from "@/pages/about";
import EnhancedNFLRankings from "@/pages/enhanced-nfl-rankings";
import PrometheusRankings from "@/pages/prometheus-rankings";
import DataSourcesPage from "@/pages/data-sources";
import CleanADP from "@/pages/CleanADP";
import DraftAnalysis from "@/pages/DraftAnalysis";
import DraftRoom from "@/pages/DraftRoom";
import PlayerProfile from "@/pages/PlayerProfile";
import DynastyDeclineAnalysis from "@/pages/DynastyDeclineAnalysis";
import RBTouchdownRegression from "@/pages/RBTouchdownRegression";
import WRTouchdownRegression from "@/pages/WRTouchdownRegression";
import FullPlayerPool from "@/pages/FullPlayerPool";
import NotFound from "@/pages/not-found";
import SleeperDatabase from "@/pages/sleeper-database";
import PrometheusBenchmarks from "@/pages/PrometheusBenchmarks";

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
      <Route path="/rankings" component={EnhancedNFLRankings} />
      <Route path="/enhanced-nfl" component={EnhancedNFLRankings} />
      <Route path="/compare-league" component={CompareLeaguePage} />
      <Route path="/enhanced-dynasty" component={EnhancedDynasty} />
      <Route path="/data-sources" component={DataSourcesPage} />
      <Route path="/adp" component={CleanADP} />
      <Route path="/draft-analysis" component={DraftAnalysis} />
      <Route path="/draft-room" component={DraftRoom} />
      <Route path="/player/:id" component={PlayerProfile} />
      <Route path="/enhanced-player/:id" component={EnhancedPlayerProfile} />
      <Route path="/player-pool" component={FullPlayerPool} />
      <Route path="/about" component={About} />
      <Route path="/lineup" component={LineupOptimizer} />
      <Route path="/analytics" component={LineupOptimizer} />
      <Route path="/premium" component={PremiumAnalytics} />
      <Route path="/sleeper-database" component={SleeperDatabase} />
      <Route path="/prometheus-benchmarks" component={PrometheusBenchmarks} />
      <Route path="/dynasty-decline-analysis" component={DynastyDeclineAnalysis} />
      <Route path="/rb-touchdown-regression" component={RBTouchdownRegression} />
      <Route path="/wr-touchdown-regression" component={WRTouchdownRegression} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
