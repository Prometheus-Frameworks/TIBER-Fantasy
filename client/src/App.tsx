import { Switch, Route, useLocation, Redirect } from "wouter";
import { useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTopProgress } from "@/hooks/useTopProgress";
import ChatHomepage from "@/pages/ChatHomepage";
import TiberDashboard from "@/pages/TiberDashboard";
import PlayerComparePilot from "@/pages/PlayerComparePilot";
import AnalyticsPage from "@/pages/AnalyticsPage";
import LeadersPage from "@/pages/LeadersPage";
import TeamReportsPage from "@/pages/TeamReportsPage";
import RagStatus from "@/pages/RagStatus";
import WRRankingsSandbox from "@/pages/WRRankingsSandbox";
import WRRankings from "@/pages/WRRankings";
import RBRankings from "@/pages/RBRankings";
import TERankings from "@/pages/TERankings";
import QBRankings from "@/pages/QBRankings";
import RoleContextRankings from "@/pages/RoleContextRankings";
import QBRankingsSandbox from "@/pages/QBRankingsSandbox";
import ForgeLab from "@/pages/ForgeLab";
import ForgeLabEquationSandbox from "@/pages/ForgeLabEquationSandbox";
import MatchupsPage from "@/pages/MatchupsPage";
import ForgeHub from "@/pages/admin/ForgeHub";
import PlayerMappingTest from "@/pages/admin/PlayerMappingTest";
import PlayerMapping from "@/pages/admin/PlayerMapping";
import PlayerResearch from "@/pages/admin/PlayerResearch";
import ApiLexicon from "@/pages/admin/ApiLexicon";
import NotFound from "@/pages/not-found";

// Custom hook to reactively track URL search params (wouter only tracks pathname)
function useSearchParams() {
  const [search, setSearch] = useState(window.location.search);
  
  useEffect(() => {
    const updateSearch = () => setSearch(window.location.search);
    
    // Listen to popstate (browser back/forward button)
    window.addEventListener('popstate', updateSearch);
    
    // Wouter uses pushState for Link navigation, which doesn't fire popstate
    // Patch pushState/replaceState to detect all navigation
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);
    
    window.history.pushState = function(...args) {
      originalPushState(...args);
      updateSearch();
    };
    
    window.history.replaceState = function(...args) {
      originalReplaceState(...args);
      updateSearch();
    };
    
    return () => {
      window.removeEventListener('popstate', updateSearch);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);
  
  return new URLSearchParams(search);
}

function Router() {
  // Reactively track search params (wouter's useLocation only tracks pathname)
  const searchParams = useSearchParams();
  const hasTabParam = searchParams.has('tab');

  return (
    <Switch>
      {/* Main Route - Chat Homepage (NotebookLM-style) or Dashboard with tabs */}
      <Route path="/">
        {hasTabParam ? <TiberDashboard /> : <ChatHomepage />}
      </Route>
      
      {/* Player Compare Pilot */}
      <Route path="/compare" component={PlayerComparePilot} />
      
      {/* Analytics */}
      <Route path="/analytics" component={AnalyticsPage} />
      
      {/* Leaders */}
      <Route path="/leaders" component={LeadersPage} />
      
      {/* Team Reports */}
      <Route path="/team-reports" component={TeamReportsPage} />
      
      {/* Admin: RAG Status */}
      <Route path="/admin/rag-status" component={RagStatus} />
      
      {/* Rankings entry point - defaults to WR */}
      <Route path="/rankings">
        {() => <Redirect to="/rankings/wr" />}
      </Route>
      
      {/* User-facing Rankings with FORGE */}
      <Route path="/rankings/wr" component={WRRankings} />
      <Route path="/rankings/rb" component={RBRankings} />
      <Route path="/rankings/te" component={TERankings} />
      <Route path="/rankings/qb" component={QBRankings} />
      
      {/* Advanced: Role Context Rankings */}
      <Route path="/rankings/role-context" component={RoleContextRankings} />
      
      {/* FORGE Matchups */}
      <Route path="/matchups" component={MatchupsPage} />
      <Route path="/matchups/season" component={MatchupsPage} />
      <Route path="/matchups/week" component={MatchupsPage} />
      
      {/* Admin: WR Rankings Sandbox */}
      <Route path="/admin/wr-rankings-sandbox" component={WRRankingsSandbox} />
      
      {/* Admin: QB Rankings Sandbox */}
      <Route path="/admin/qb-rankings-sandbox" component={QBRankingsSandbox} />
      
      {/* Dev: FORGE Lab */}
      <Route path="/dev/forge" component={ForgeLab} />
      
      {/* Admin: FORGE Lab Equation Sandbox */}
      <Route path="/admin/forge-lab" component={ForgeLabEquationSandbox} />
      
      {/* Admin: FORGE Hub - Central control room */}
      <Route path="/admin/forge-hub" component={ForgeHub} />
      <Route path="/admin">
        {() => <Redirect to="/admin/forge-hub" />}
      </Route>
      
      {/* Admin: Player Mapping Test (Legacy) */}
      <Route path="/admin/player-mapping-test" component={PlayerMappingTest} />
      
      {/* Admin: Player Mapping */}
      <Route path="/admin/player-mapping" component={PlayerMapping} />
      
      {/* Admin: Player Research */}
      <Route path="/admin/player-research" component={PlayerResearch} />
      
      {/* Admin: API Lexicon - Forge/Tiber endpoint reference */}
      <Route path="/admin/api-lexicon" component={ApiLexicon} />
      
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
