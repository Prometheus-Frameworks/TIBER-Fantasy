import { Switch, Route, useLocation, Redirect } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTopProgress } from "@/hooks/useTopProgress";
import ChatHomepage from "@/pages/ChatHomepage";
import RankingsHub from "@/pages/RankingsHub";
import TiberTiers from "@/pages/TiberTiers";
import SchedulePage from "@/pages/SchedulePage";
import ForgeHub from "@/pages/admin/ForgeHub";
import PlayerMapping from "@/pages/admin/PlayerMapping";
import PlayerMappingTest from "@/pages/admin/PlayerMappingTest";
import PlayerResearch from "@/pages/admin/PlayerResearch";
import ApiLexicon from "@/pages/admin/ApiLexicon";
import HomepageRedesign from "@/pages/admin/HomepageRedesign";
import RagStatus from "@/pages/RagStatus";
import ForgeLab from "@/pages/ForgeLab";
import TiberDataLab from "@/pages/TiberDataLab";
import WRRankingsSandbox from "@/pages/WRRankingsSandbox";
import QBRankingsSandbox from "@/pages/QBRankingsSandbox";
import PlayerPage from "@/pages/PlayerPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* Main Route - New TIBER Homepage */}
      <Route path="/">
        {() => <HomepageRedesign isPreview={false} />}
      </Route>
      
      {/* Legacy Chat Homepage (fallback during migration) */}
      <Route path="/legacy-chat" component={ChatHomepage} />
      
      {/* Tiber Tiers - FORGE-powered fantasy rankings */}
      <Route path="/tiers" component={TiberTiers} />
      
      {/* Player Profile - Dedicated player page */}
      <Route path="/player/:playerId" component={PlayerPage} />
      
      {/* Rankings - Redirect to Tiber Tiers */}
      <Route path="/rankings">
        {() => <Redirect to="/tiers" />}
      </Route>
      
      {/* Schedule / SoS */}
      <Route path="/schedule" component={SchedulePage} />
      
      {/* Admin: FORGE Hub - Central control room */}
      <Route path="/admin/forge-hub" component={ForgeHub} />
      
      {/* Admin: Player Mapping */}
      <Route path="/admin/player-mapping" component={PlayerMapping} />
      
      {/* Admin: Player Mapping Test (legacy) */}
      <Route path="/admin/player-mapping-test" component={PlayerMappingTest} />
      
      {/* Admin: Player Research */}
      <Route path="/admin/player-research" component={PlayerResearch} />
      
      {/* Admin: API Lexicon - Forge/Tiber endpoint reference */}
      <Route path="/admin/api-lexicon" component={ApiLexicon} />
      
      {/* Admin: Homepage Redesign Preview */}
      <Route path="/admin/homepage-redesign">
        {() => <HomepageRedesign isPreview={true} />}
      </Route>
      
      {/* Admin: RAG Status */}
      <Route path="/admin/rag-status" component={RagStatus} />
      
      {/* Admin: FORGE Lab - Interactive scoring sandbox */}
      <Route path="/admin/forge-lab" component={ForgeLab} />
      
      {/* Tiber Data Lab - Snapshot-based NFL data spine */}
      <Route path="/tiber-data-lab" component={TiberDataLab} />
      
      {/* Admin: Ranking Sandboxes */}
      <Route path="/admin/wr-rankings-sandbox" component={WRRankingsSandbox} />
      <Route path="/admin/qb-rankings-sandbox" component={QBRankingsSandbox} />
      
      {/* Dev: FORGE Dev Lab redirect (until separate component is built) */}
      <Route path="/dev/forge">
        {() => <Redirect to="/admin/forge-lab" />}
      </Route>
      
      {/* Admin: Catch-all redirect to FORGE Hub (must be LAST of admin routes) */}
      <Route path="/admin">
        {() => <Redirect to="/admin/forge-hub" />}
      </Route>
      
      {/* 404 Catch-all */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  useTopProgress(); // Enable automatic loading bar
  const [location] = useLocation();
  
  // Telemetry: Log route changes to track user flow
  useEffect(() => {
    console.log(JSON.stringify({ src:'router', path: location, ts: Date.now() }));
  }, [location]);
  
  return (
    <TooltipProvider>
      <Router />
      <Toaster />
    </TooltipProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
