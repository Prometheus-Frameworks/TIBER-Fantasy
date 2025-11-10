import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
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
import NotFound from "@/pages/not-found";

function Router() {
  // Check if user wants dashboard tabs view
  const urlParams = new URLSearchParams(window.location.search);
  const hasTabParam = urlParams.has('tab');

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
