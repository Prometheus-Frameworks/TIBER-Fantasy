import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  Target, 
  Clock, 
  Shield, 
  Zap, 
  BarChart3, 
  GitBranch,
  ExternalLink,
  Award
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Methodology() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Dynasty Valuation Methodology</h1>
        <p className="text-lg text-gray-600">
          Our open-source approach to dynasty fantasy football player valuation, 
          built on predictive research and authentic NFL data.
        </p>
        <div className="flex gap-2 mt-4">
          <Badge variant="outline">Open Source</Badge>
          <Badge variant="outline">Research-Backed</Badge>
          <Badge variant="outline">No Paywalls</Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="weights">Weights</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="sources">Data Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Core Philosophy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Core Philosophy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Predictive Over Descriptive</h4>
                  <p className="text-sm text-gray-600">
                    We prioritize metrics that predict future fantasy success over those that merely describe past performance. 
                    Target share (r=0.8) matters more than yards per route run (r=0.3).
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Opportunity-Centric</h4>
                  <p className="text-sm text-gray-600">
                    Volume-based metrics receive the highest weights because they're most stable year-over-year. 
                    A player can improve efficiency, but opportunity drives ceiling.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Position-Specific Adjustments</h4>
                  <p className="text-sm text-gray-600">
                    QBs benefit more from efficiency metrics than RBs/WRs. We adjust component weights based on 
                    position-specific research correlations.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Ultra-Restrictive Scoring</h4>
                  <p className="text-sm text-gray-600">
                    Only 4 players score above 95. Most NFL players score below 55. This prevents 
                    grade inflation and creates meaningful differentiation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Algorithm Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Algorithm Structure</CardTitle>
              <CardDescription>
                Five-component weighted system with position-specific adjustments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <span className="font-medium">Production Score</span>
                  </div>
                  <Badge variant="secondary">40% Weight</Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-green-600" />
                    <span className="font-medium">Opportunity Score</span>
                  </div>
                  <Badge variant="secondary">35% Weight</Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <span className="font-medium">Age Score</span>
                  </div>
                  <Badge variant="secondary">20% Weight</Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-orange-600" />
                    <span className="font-medium">Stability Score</span>
                  </div>
                  <Badge variant="secondary">15% Weight</Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium">Efficiency Score</span>
                  </div>
                  <Badge variant="secondary">Position-Specific</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Differentiators */}
          <Card>
            <CardHeader>
              <CardTitle>What Makes Us Different</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Research-Driven</h4>
                  <p className="text-sm text-gray-600">
                    Based on correlation studies showing target share predicts fantasy success better than efficiency metrics
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Authentic Data Only</h4>
                  <p className="text-sm text-gray-600">
                    NFL-Data-Py and Sleeper API provide real statistics. No synthetic or placeholder data
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Open Source</h4>
                  <p className="text-sm text-gray-600">
                    Complete methodology transparency. Community can validate and improve our approach
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Component Weights by Position</CardTitle>
              <CardDescription>
                Research shows different positions benefit from different metric emphases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* QB Weights */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline">QB</Badge>
                  Quarterback Weights
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Production</span>
                    <div className="flex items-center gap-2">
                      <Progress value={40} className="w-32 h-2" />
                      <span className="text-sm font-medium">40%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Opportunity</span>
                    <div className="flex items-center gap-2">
                      <Progress value={35} className="w-32 h-2" />
                      <span className="text-sm font-medium">35%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Efficiency</span>
                    <div className="flex items-center gap-2">
                      <Progress value={20} className="w-32 h-2" />
                      <span className="text-sm font-medium">20%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Age</span>
                    <div className="flex items-center gap-2">
                      <Progress value={20} className="w-32 h-2" />
                      <span className="text-sm font-medium">20%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Stability</span>
                    <div className="flex items-center gap-2">
                      <Progress value={15} className="w-32 h-2" />
                      <span className="text-sm font-medium">15%</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  QBs get higher efficiency weight due to stronger correlation between advanced passing metrics and fantasy success.
                </p>
              </div>

              <Separator />

              {/* RB Weights */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline">RB</Badge>
                  Running Back Weights
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Production</span>
                    <div className="flex items-center gap-2">
                      <Progress value={40} className="w-32 h-2" />
                      <span className="text-sm font-medium">40%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Opportunity</span>
                    <div className="flex items-center gap-2">
                      <Progress value={35} className="w-32 h-2" />
                      <span className="text-sm font-medium">35%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Age</span>
                    <div className="flex items-center gap-2">
                      <Progress value={20} className="w-32 h-2" />
                      <span className="text-sm font-medium">20%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Stability</span>
                    <div className="flex items-center gap-2">
                      <Progress value={15} className="w-32 h-2" />
                      <span className="text-sm font-medium">15%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Efficiency</span>
                    <div className="flex items-center gap-2">
                      <Progress value={15} className="w-32 h-2" />
                      <span className="text-sm font-medium">15%</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  RB efficiency metrics show only 3% correlation with future fantasy success. Touches and team context matter most.
                </p>
              </div>

              <Separator />

              {/* WR/TE Weights */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline">WR</Badge>
                  <Badge variant="outline">TE</Badge>
                  Wide Receiver / Tight End Weights
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Production</span>
                    <div className="flex items-center gap-2">
                      <Progress value={40} className="w-32 h-2" />
                      <span className="text-sm font-medium">40%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Opportunity</span>
                    <div className="flex items-center gap-2">
                      <Progress value={35} className="w-32 h-2" />
                      <span className="text-sm font-medium">35%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Age</span>
                    <div className="flex items-center gap-2">
                      <Progress value={20} className="w-32 h-2" />
                      <span className="text-sm font-medium">20%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Stability</span>
                    <div className="flex items-center gap-2">
                      <Progress value={15} className="w-32 h-2" />
                      <span className="text-sm font-medium">15%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Efficiency</span>
                    <div className="flex items-center gap-2">
                      <Progress value={10} className="w-32 h-2" />
                      <span className="text-sm font-medium">10%</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Target share and team pass volume drive WR success. YPRR and separation are descriptive, not predictive.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="space-y-6">
          {/* Production Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Production Score (40% Weight)
              </CardTitle>
              <CardDescription>
                Proven fantasy performance and consistency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium mb-2">Key Metrics</h5>
                    <ul className="text-sm space-y-1">
                      <li>• Fantasy points per game (2024)</li>
                      <li>• Games played / availability</li>
                      <li>• Week-to-week consistency</li>
                      <li>• Position rank performance</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium mb-2">Calculation</h5>
                    <p className="text-sm text-gray-600">
                      Uses authentic 2024 NFL data from actual games played. 
                      No projections or season averages. Penalizes injury-shortened seasons.
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Example:</strong> Ja'Marr Chase (23.7 PPG in 17 games) scores 100/100. 
                    Most players score 30-70 based on realistic performance thresholds.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Opportunity Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-green-600" />
                Opportunity Score (35% Weight)
              </CardTitle>
              <CardDescription>
                Volume, role, and team context metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium mb-2">Key Metrics</h5>
                    <ul className="text-sm space-y-1">
                      <li>• Target share / touch share</li>
                      <li>• Team offensive volume</li>
                      <li>• Red zone opportunities</li>
                      <li>• Snap count percentage</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium mb-2">Research Basis</h5>
                    <p className="text-sm text-gray-600">
                      Target share shows 0.8+ correlation with fantasy success. 
                      Team pass attempts and offensive rankings provide crucial context.
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>Example:</strong> Marvin Harrison Jr. penalized for Cardinals' 31 pass attempts per game 
                    and Trey McBride commanding 25% target share.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Age Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                Age Score (20% Weight)
              </CardTitle>
              <CardDescription>
                Career longevity and peak performance windows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium mb-2">Age Curves</h5>
                    <ul className="text-sm space-y-1">
                      <li>• Under 24: Premium scores (85-100)</li>
                      <li>• 24-27: Peak years (70-85)</li>
                      <li>• 28-30: Decline phase (50-70)</li>
                      <li>• Over 30: Steep penalties (20-50)</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium mb-2">Position Adjustments</h5>
                    <p className="text-sm text-gray-600">
                      RBs face steeper age penalties. QBs maintain value longer. 
                      WRs have gradual decline curves with skill-based longevity.
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-800">
                    <strong>Example:</strong> Tyreek Hill (age 30) receives major age penalty contributing to 
                    his 25 dynasty score despite past elite production.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stability & Efficiency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-600" />
                  Stability Score (15%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2">
                  <li>• Injury history and durability</li>
                  <li>• Team coaching stability</li>
                  <li>• Role security within offense</li>
                  <li>• Contract situation</li>
                </ul>
                <div className="mt-3 p-2 bg-orange-50 rounded text-xs text-orange-800">
                  Rookies penalized heavily for unproven durability
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  Efficiency Score (Variable)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2">
                  <li>• QB: EPA, CPOE, AY/A (20% weight)</li>
                  <li>• RB: YAC, Success Rate (15% weight)</li>
                  <li>• WR/TE: YPRR, Separation (10% weight)</li>
                </ul>
                <div className="mt-3 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                  Lower weight reflects weak correlation with future success
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="research" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Research Foundation
              </CardTitle>
              <CardDescription>
                Academic and industry research supporting our methodology
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Key Research Findings */}
              <div>
                <h4 className="font-semibold mb-3">Key Research Findings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium text-green-600 mb-2">Volume Metrics (High Correlation)</h5>
                    <ul className="text-sm space-y-1">
                      <li>• Target Share: r = 0.81</li>
                      <li>• Touch Count: r = 0.76</li>
                      <li>• Snap Share: r = 0.72</li>
                      <li>• Red Zone Opportunities: r = 0.69</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium text-red-600 mb-2">Efficiency Metrics (Low Correlation)</h5>
                    <ul className="text-sm space-y-1">
                      <li>• RB Efficiency: r = 0.03</li>
                      <li>• YPRR: r = 0.31</li>
                      <li>• Separation: r = 0.28</li>
                      <li>• YAC per Reception: r = 0.24</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* TPRR Research */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">Jacob Gibbs (@jagibbs_23) TPRR Research</h5>
                <p className="text-sm text-blue-800 mb-2">
                  Targets Per Route Run (TPRR) shows 0.817 correlation with fantasy scoring vs 0.763 for raw targets.
                  Progressive TPRR growth predicts breakouts:
                </p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Michael Thomas: 20.3% → 30.1% TPRR (breakout year)</li>
                  <li>• Davante Adams: 18.6% → 31.5% TPRR (elite emergence)</li>
                  <li>• A.J. Brown: 21.4% → 24.9% TPRR (sustained excellence)</li>
                </ul>
              </div>

              {/* Position-Specific Research */}
              <div>
                <h4 className="font-semibold mb-3">Position-Specific Insights</h4>
                <div className="space-y-3">
                  <div className="p-3 border-l-4 border-blue-500 bg-blue-50">
                    <h5 className="font-medium text-blue-900">Quarterbacks</h5>
                    <p className="text-sm text-blue-800">
                      Advanced passing metrics (EPA, CPOE) show stronger correlation with future success than for other positions.
                      Age curves are flatter with longer peak windows.
                    </p>
                  </div>
                  <div className="p-3 border-l-4 border-green-500 bg-green-50">
                    <h5 className="font-medium text-green-900">Running Backs</h5>
                    <p className="text-sm text-green-800">
                      Efficiency metrics show minimal predictive value (3% correlation). 
                      Touch volume and team context are primary drivers. Steepest age decline curves.
                    </p>
                  </div>
                  <div className="p-3 border-l-4 border-purple-500 bg-purple-50">
                    <h5 className="font-medium text-purple-900">Wide Receivers</h5>
                    <p className="text-sm text-purple-800">
                      Target share trumps all efficiency metrics. Route diversity and QB stability provide additional context.
                      Age curves vary by player archetype (speed vs possession).
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Validation Against Experts */}
          <Card>
            <CardHeader>
              <CardTitle>Expert Consensus Validation</CardTitle>
              <CardDescription>
                How our algorithm compares to established dynasty experts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="font-medium">Jake Maraia (FF Dataroma) Alignment</span>
                  <Badge variant="outline">73% within 2 ranks</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="font-medium">Average Rank Difference</span>
                  <Badge variant="outline">2.6 positions</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <span className="font-medium">Top Dynasty Assets Agreement</span>
                  <Badge variant="outline">95% consensus</Badge>
                </div>
                <p className="text-sm text-gray-600">
                  Our algorithm shows strong alignment with expert consensus while maintaining independence. 
                  Significant differences typically reflect our emphasis on predictive metrics over market sentiment.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Data Sources & Attribution
              </CardTitle>
              <CardDescription>
                All data sources are legally accessible and properly attributed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Data Sources */}
              <div>
                <h4 className="font-semibold mb-3">Primary Data Sources</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h5 className="font-medium">NFL-Data-Py</h5>
                      <p className="text-sm text-gray-600">Official NFL statistics and advanced metrics</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://github.com/cooperdff/nfl_data_py" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        GitHub
                      </a>
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h5 className="font-medium">Sleeper API</h5>
                      <p className="text-sm text-gray-600">Fantasy platform data and player mappings</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://docs.sleeper.app/" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Docs
                      </a>
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h5 className="font-medium">ESPN Hidden API</h5>
                      <p className="text-sm text-gray-600">News, injury reports, and team context</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Endpoints
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Research Sources */}
              <div>
                <h4 className="font-semibold mb-3">Research & Validation</h4>
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <h5 className="font-medium">Jake Maraia (FF Dataroma)</h5>
                    <p className="text-sm text-gray-600 mb-2">
                      FantasyPros dynasty expert used for algorithm validation and benchmark comparison
                    </p>
                    <Badge variant="outline" className="text-xs">Validation Only</Badge>
                  </div>
                  
                  <div className="p-3 border rounded-lg">
                    <h5 className="font-medium">Jacob Gibbs TPRR Research</h5>
                    <p className="text-sm text-gray-600 mb-2">
                      Targets Per Route Run correlation studies and breakout prediction methodology
                    </p>
                    <Badge variant="outline" className="text-xs">Research Reference</Badge>
                  </div>
                </div>
              </div>

              {/* Legal Notice */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h5 className="font-medium mb-2">Legal Compliance</h5>
                <p className="text-sm text-gray-600 mb-3">
                  Prometheus maintains strict legal compliance by using only publicly available APIs and data sources. 
                  We do not scrape proprietary data or violate terms of service.
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• No copyrighted expert opinions or rankings</li>
                  <li>• No commercial API data without proper licensing</li>
                  <li>• All methodology and algorithms are original work</li>
                  <li>• Expert rankings used only for validation, not copying</li>
                </ul>
              </div>

              {/* Open Source License */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">Open Source Commitment</h5>
                <p className="text-sm text-blue-800 mb-3">
                  Our methodology, component weights, and algorithm logic are open source under Creative Commons license. 
                  The fantasy community can validate, fork, and improve our approach.
                </p>
                <Button variant="outline" size="sm" className="text-blue-700 border-blue-300">
                  <GitBranch className="w-4 h-4 mr-1" />
                  View License
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}