// Route Audit Page - Comprehensive Navigation Testing
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertTriangle, ExternalLink } from "lucide-react";

interface RouteTest {
  path: string;
  label: string;
  status: 'working' | 'mock' | 'missing';
  source: 'navigation' | 'home' | 'direct';
  description: string;
}

export default function RouteAudit() {
  const [testResults, setTestResults] = useState<RouteTest[]>([
    // Navigation Links
    { path: "/", label: "Home", status: 'working', source: 'navigation', description: "Main landing page" },
    { path: "/redraft", label: "Redraft", status: 'working', source: 'navigation', description: "Season HQ" },
    { path: "/dynasty", label: "Dynasty", status: 'working', source: 'navigation', description: "Dynasty tools" },
    { path: "/compass", label: "Compass", status: 'working', source: 'navigation', description: "Player Compass hub" },
    { path: "/consensus", label: "Consensus", status: 'working', source: 'navigation', description: "OTC Consensus rankings" },
    { path: "/snap-counts", label: "Snap Counts", status: 'working', source: 'navigation', description: "Snap count analysis" },
    { path: "/research", label: "Research & Analysis", status: 'working', source: 'navigation', description: "Depth charts and intel" },
    { path: "/competence", label: "Competence Mode", status: 'working', source: 'navigation', description: "Truth-first AI assistant" },
    { path: "/articles", label: "Articles", status: 'working', source: 'navigation', description: "Strategy content" },
    
    // Home Page Links
    { path: "/systems", label: "Systems Overview", status: 'mock', source: 'home', description: "All systems hub (MOCK)" },
    { path: "/draft", label: "Draft Command", status: 'mock', source: 'home', description: "Draft tools (MOCK)" },
    { path: "/rookies", label: "2025 Rookies", status: 'mock', source: 'home', description: "Rookie analysis (MOCK)" },
    { path: "/consensus/transparency", label: "Consensus Transparency", status: 'mock', source: 'home', description: "Methodology (MOCK)" },
    { path: "/dashboard", label: "Dashboard", status: 'working', source: 'home', description: "League sync" },

    // Compass Sub-Routes
    { path: "/compass/wr", label: "WR Compass", status: 'working', source: 'direct', description: "WR analysis" },
    { path: "/compass/rb", label: "RB Compass", status: 'working', source: 'direct', description: "RB analysis" },
    { path: "/compass/te", label: "TE Compass", status: 'working', source: 'direct', description: "TE analysis" },
    { path: "/compass/qb", label: "QB Compass", status: 'working', source: 'direct', description: "QB analysis" },

    // Consensus Sub-Routes
    { path: "/consensus/dynasty", label: "Dynasty Rankings", status: 'working', source: 'direct', description: "Dynasty consensus" },
    { path: "/consensus/redraft", label: "Redraft Rankings", status: 'working', source: 'direct', description: "Redraft consensus" },
  ]);

  const getStatusIcon = (status: RouteTest['status']) => {
    switch (status) {
      case 'working': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'mock': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'missing': return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: RouteTest['status']) => {
    switch (status) {
      case 'working': return <Badge className="bg-green-100 text-green-800">Working</Badge>;
      case 'mock': return <Badge className="bg-orange-100 text-orange-800">Mock</Badge>;
      case 'missing': return <Badge className="bg-red-100 text-red-800">Missing</Badge>;
    }
  };

  const getSourceBadge = (source: RouteTest['source']) => {
    switch (source) {
      case 'navigation': return <Badge variant="outline">Nav</Badge>;
      case 'home': return <Badge variant="outline">Home</Badge>;
      case 'direct': return <Badge variant="outline">Direct</Badge>;
    }
  };

  const workingCount = testResults.filter(r => r.status === 'working').length;
  const mockCount = testResults.filter(r => r.status === 'mock').length;
  const missingCount = testResults.filter(r => r.status === 'missing').length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            ← Back to Home
          </Button>
        </Link>
        
        <h1 className="text-3xl font-bold text-ink mb-4">Route Audit & Testing</h1>
        <p className="text-body text-lg">
          Comprehensive navigation testing for all clickable elements and routing
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{workingCount}</p>
                <p className="text-sm text-body">Working Routes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{mockCount}</p>
                <p className="text-sm text-body">Mock Pages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{missingCount}</p>
                <p className="text-sm text-body">Missing Routes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Route Testing Table */}
      <Card>
        <CardHeader>
          <CardTitle>Navigation Testing Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {testResults.map((route, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-haze/50 transition-colors">
                <div className="flex items-center gap-4">
                  {getStatusIcon(route.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={route.path} className="font-medium hover:text-plum transition-colors">
                        {route.label}
                        <ExternalLink className="w-3 h-3 ml-1 inline" />
                      </Link>
                      {getStatusBadge(route.status)}
                      {getSourceBadge(route.source)}
                    </div>
                    <p className="text-sm text-body">{route.description}</p>
                    <code className="text-xs bg-haze px-2 py-1 rounded">{route.path}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Visual Inspection Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Mock Page Identification</h3>
            <ul className="text-sm text-body space-y-1">
              <li>• Mock pages have gold/purple gradient borders</li>
              <li>• Clear status badges (RED/ORANGE/BLUE) indicate page status</li>
              <li>• Route information is displayed prominently</li>
              <li>• Easy navigation back to working areas</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Testing Process</h3>
            <ul className="text-sm text-body space-y-1">
              <li>• Click each link above to verify routing works</li>
              <li>• Mock pages should be clearly identifiable</li>
              <li>• All navigation should be functional</li>
              <li>• Report any broken or missing routes</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}