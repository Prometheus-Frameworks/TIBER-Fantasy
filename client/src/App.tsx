import { Switch, Route, useLocation, Redirect } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTopProgress } from "@/hooks/useTopProgress";
import ChatHomepage from "@/pages/ChatHomepage";
import RankingsHub from "@/pages/RankingsHub";
import SchedulePage from "@/pages/SchedulePage";
import ForgeHub from "@/pages/admin/ForgeHub";
import PlayerMapping from "@/pages/admin/PlayerMapping";
import PlayerResearch from "@/pages/admin/PlayerResearch";
import ApiLexicon from "@/pages/admin/ApiLexicon";
import ForgeLab from "@/pages/ForgeLab";
import WRRankingsSandbox from "@/pages/WRRankingsSandbox";
import QBRankingsSandbox from "@/pages/QBRankingsSandbox";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* Main Route - TIBER Chat Homepage */}
      <Route path="/" component={ChatHomepage} />
      
      {/* Rankings - FORGE-powered player rankings */}
      <Route path="/rankings" component={RankingsHub} />
      
      {/* Schedule / SoS */}
      <Route path="/schedule" component={SchedulePage} />
      
      {/* Admin: FORGE Hub - Central control room */}
      <Route path="/admin/forge-hub" component={ForgeHub} />
      <Route path="/admin">
        {() => <Redirect to="/admin/forge-hub" />}
      </Route>
      
      {/* Admin: Player Mapping */}
      <Route path="/admin/player-mapping" component={PlayerMapping} />
      
      {/* Admin: Player Research */}
      <Route path="/admin/player-research" component={PlayerResearch} />
      
      {/* Admin: API Lexicon - Forge/Tiber endpoint reference */}
      <Route path="/admin/api-lexicon" component={ApiLexicon} />
      
      {/* Admin: FORGE Lab - Interactive scoring sandbox */}
      <Route path="/admin/forge-lab" component={ForgeLab} />
      
      {/* Admin: Ranking Sandboxes */}
      <Route path="/admin/wr-rankings-sandbox" component={WRRankingsSandbox} />
      <Route path="/admin/qb-rankings-sandbox" component={QBRankingsSandbox} />
      
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
