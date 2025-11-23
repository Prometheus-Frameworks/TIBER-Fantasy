import { useState, useEffect } from 'react';
import { User, Bell, Home, TrendingUp, Shield, Target, Shuffle, Users, FlaskConical, BarChart3, Eye, Lightbulb, Search, LineChart, Trophy, Settings } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import HomeTab from '@/components/tabs/HomeTab';
import RankingsTab from '@/components/tabs/RankingsTab';
import MatchupsTab from '@/components/tabs/MatchupsTab';
import StrategyTab from '@/components/tabs/StrategyTab';
import MovesTab from '@/components/tabs/MovesTab';
import LeaguesTab from '@/components/tabs/LeaguesTab';
import EPARankingsTab from '@/components/tabs/EPARankingsTab';
import QBStatsReviewTab from '@/components/tabs/QBStatsReviewTab';
import WeeklyTakesTab from '@/components/tabs/WeeklyTakesTab';
import AdminTab from '@/components/tabs/AdminTab';
import PlayerSearchBar from '@/components/PlayerSearchBar';

const tabs = [
  { id: 'home', label: 'Home', icon: Home, component: HomeTab },
  { id: 'rankings', label: 'Rankings', icon: TrendingUp, component: RankingsTab },
  { id: 'epa-rankings', label: 'EPA Rankings', icon: BarChart3, component: EPARankingsTab },
  { id: 'qb-stats', label: 'QB Stats', icon: Eye, component: QBStatsReviewTab },
  { id: 'matchups', label: 'Matchups', icon: Shield, component: MatchupsTab },
  { id: 'strategy', label: 'Strategy', icon: Target, component: StrategyTab },
  { id: 'weekly-takes', label: 'Weekly Takes', icon: Lightbulb, component: WeeklyTakesTab },
  { id: 'moves', label: 'Moves', icon: Shuffle, component: MovesTab },
  { id: 'leagues', label: 'Leagues', icon: Users, component: LeaguesTab },
  { id: 'admin', label: 'Admin', icon: Settings, component: AdminTab },
];

function TiberDashboard() {
  const [location] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get('tab') || 'home';
  const [selectedTab, setSelectedTab] = useState(tabFromUrl);

  // Update tab when URL changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab') || 'home';
    setSelectedTab(tab);
  }, [location]);

  const handleTabChange = (tabId: string) => {
    setSelectedTab(tabId);
    // Update URL without page reload
    const newUrl = tabId === 'home' ? '/' : `/?tab=${tabId}`;
    window.history.pushState({}, '', newUrl);
  };

  const currentTab = tabs.find(t => t.id === selectedTab) || tabs[0];
  const CurrentComponent = currentTab.component;

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-gray-100">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#141824] border-b border-gray-800 backdrop-blur-sm bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-white">
                T
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  TIBER FANTASY
                </span>
                <span className="text-[9px] text-gray-500 font-medium tracking-wider -mt-0.5">
                  TACTICAL INDEX FOR BREAKOUT EFFICIENCY & REGRESSION
                </span>
              </div>
            </Link>

            {/* Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <PlayerSearchBar />
            </div>

            {/* Right Nav */}
            <div className="flex items-center gap-2">
              <Link href="/leaders" className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 transition-colors text-sm font-medium" data-testid="link-nav-leaders">
                <Trophy className="w-4 h-4" />
                Leaders
              </Link>
              <Link href="/analytics" className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 transition-colors text-sm font-medium">
                <LineChart className="w-4 h-4" />
                Analytics
              </Link>
              <Link href="/compare" className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-colors text-sm font-medium">
                <Search className="w-4 h-4" />
                Compare
              </Link>
              <button className="p-2 hover:bg-[#1e2330] rounded-lg transition-colors" data-testid="button-notifications">
                <Bell className="w-5 h-5 text-gray-400" />
              </button>
              <button className="p-2 hover:bg-[#1e2330] rounded-lg transition-colors" data-testid="button-user-menu">
                <User className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar Navigation */}
          <aside className="md:w-64 flex-shrink-0">
            <div className="bg-[#141824] border border-gray-800 rounded-xl p-4 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">
              <nav className="space-y-1">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = selectedTab === tab.id;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border border-blue-500/50'
                          : 'text-gray-400 hover:bg-[#1e2330] hover:text-gray-300'
                      }`}
                      data-testid={`tab-${tab.id}`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Quick Stats */}
              <div className="mt-6 pt-6 border-t border-gray-800">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Platform Stats</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Players</span>
                    <span className="text-gray-300 font-mono">11,400+</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Teams</span>
                    <span className="text-gray-300 font-mono">28</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Response</span>
                    <span className="text-green-400 font-mono">&lt;20ms</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="bg-[#141824] border border-gray-800 rounded-xl p-6">
              <CurrentComponent />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default TiberDashboard;
