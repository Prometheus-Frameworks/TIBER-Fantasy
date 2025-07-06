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
import PlayerProfile from "@/pages/player-profile";
import EnhancedDynasty from "@/pages/enhanced-dynasty";
import About from "@/pages/about";
import EnhancedNFLRankings from "@/pages/enhanced-nfl-rankings";
import NotFound from "@/pages/not-found";
import SleeperDatabase from "@/pages/sleeper-database";

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
      <Route path="/rankings" component={SimpleRankingsPage} />
      <Route path="/ranking-analysis" component={RankingAnalysisPage} />
      <Route path="/player-search" component={PlayerSearchDemo} />
      <Route path="/value-rankings" component={ValueRankingsPage} />
      <Route path="/league-rankings" component={LeagueRankingsPage} />
      <Route path="/league-analysis" component={LeagueAnalysisPage} />
      <Route path="/fantasy-moves" component={FantasyMovesPage} />
      <Route path="/trending" component={TrendingPlayersPage} />
      <Route path="/compare-league" component={CompareLeaguePage} />
      <Route path="/enhanced-dynasty" component={EnhancedDynasty} />
      <Route path="/enhanced-nfl" component={EnhancedNFLRankings} />
      <Route path="/about" component={About} />
      <Route path="/player/:id" component={PlayerProfile} />
      <Route path="/lineup" component={LineupOptimizer} />
      <Route path="/analytics" component={LineupOptimizer} />
      <Route path="/premium" component={PremiumAnalytics} />
      <Route path="/sleeper-database" component={SleeperDatabase} />
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
