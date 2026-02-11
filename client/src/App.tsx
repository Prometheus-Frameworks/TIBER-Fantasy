import { Switch, Route, useLocation, Redirect } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import TiberLayout from "@/components/TiberLayout";
import Dashboard from "@/pages/Dashboard";
import TiberTiers from "@/pages/TiberTiers";
import SchedulePage from "@/pages/SchedulePage";
import TiberDataLab from "@/pages/TiberDataLab";
import ChatHomepage from "@/pages/ChatHomepage";
import PlayerPage from "@/pages/PlayerPage";
import ForgeTransparency from "@/pages/ForgeTransparency";
import ForgeHub from "@/pages/admin/ForgeHub";
import PlayerMapping from "@/pages/admin/PlayerMapping";
import PlayerMappingTest from "@/pages/admin/PlayerMappingTest";
import PlayerResearch from "@/pages/admin/PlayerResearch";
import ApiLexicon from "@/pages/admin/ApiLexicon";
import ForgeSimulation from "@/pages/admin/ForgeSimulation";
import ForgeLab from "@/pages/ForgeLab";
import RagStatus from "@/pages/RagStatus";
import WRRankingsSandbox from "@/pages/WRRankingsSandbox";
import QBRankingsSandbox from "@/pages/QBRankingsSandbox";
import XIntelligence from "@/pages/XIntelligence";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <TiberLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/tiers" component={TiberTiers} />
        <Route path="/tiber-data-lab" component={TiberDataLab} />
        <Route path="/schedule" component={SchedulePage} />
        <Route path="/legacy-chat" component={ChatHomepage} />
        <Route path="/player/:playerId" component={PlayerPage} />
        <Route path="/forge" component={ForgeTransparency} />
        <Route path="/rankings">
          {() => <Redirect to="/tiers" />}
        </Route>
        <Route path="/x-intel" component={XIntelligence} />
        <Route path="/admin/forge-hub" component={ForgeHub} />
        <Route path="/admin/player-mapping" component={PlayerMapping} />
        <Route path="/admin/player-mapping-test" component={PlayerMappingTest} />
        <Route path="/admin/player-research" component={PlayerResearch} />
        <Route path="/admin/api-lexicon" component={ApiLexicon} />
        <Route path="/admin/rag-status" component={RagStatus} />
        <Route path="/admin/forge-lab" component={ForgeLab} />
        <Route path="/admin/forge-simulation" component={ForgeSimulation} />
        <Route path="/admin/wr-rankings-sandbox" component={WRRankingsSandbox} />
        <Route path="/admin/qb-rankings-sandbox" component={QBRankingsSandbox} />
        <Route path="/dev/forge">
          {() => <Redirect to="/admin/forge-lab" />}
        </Route>
        <Route path="/admin">
          {() => <Redirect to="/admin/forge-hub" />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </TiberLayout>
  );
}

function AppContent() {
  const [location] = useLocation();
  
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
