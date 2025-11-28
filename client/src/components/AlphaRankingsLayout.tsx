import { Link, useLocation } from 'wouter';
import { ArrowLeft, RefreshCw } from 'lucide-react';

type Position = 'WR' | 'RB' | 'TE' | 'QB';

interface AlphaRankingsLayoutProps {
  position: Position;
  children: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const POSITION_LABELS: Record<Position, string> = {
  WR: 'Wide Receivers',
  RB: 'Running Backs', 
  TE: 'Tight Ends',
  QB: 'Quarterbacks',
};

const POSITION_ROUTES: Record<Position, string> = {
  WR: '/rankings/wr',
  RB: '/rankings/rb',
  TE: '/rankings/te',
  QB: '/rankings/qb',
};

export default function AlphaRankingsLayout({
  position,
  children,
  onRefresh,
  isRefreshing = false,
}: AlphaRankingsLayoutProps) {
  const [location] = useLocation();
  
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors" data-testid="back-link">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white" data-testid="page-title">
                {position} Rankings
              </h1>
              <p className="text-sm text-slate-400">
                2025 season • Sandbox α vs FORGE α comparison
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-800/50 rounded-lg p-1 border border-slate-700" data-testid="position-tabs">
              {(['WR', 'RB', 'TE', 'QB'] as Position[]).map((pos) => {
                const isActive = position === pos;
                const route = POSITION_ROUTES[pos];
                return (
                  <Link
                    key={pos}
                    href={route}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                    data-testid={`tab-${pos.toLowerCase()}`}
                  >
                    {pos}
                  </Link>
                );
              })}
            </div>
            
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors disabled:opacity-50"
                data-testid="refresh-button"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
