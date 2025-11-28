import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import RoleBankRankings from '../components/RoleBankRankings';

export default function RoleContextRankings() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/rankings/wr" className="text-slate-400 hover:text-white transition-colors" data-testid="back-link">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white" data-testid="page-title">
              Role Context Rankings
            </h1>
            <p className="text-sm text-slate-400">
              Advanced role-based analysis • WR/RB/TE role tiers and context
            </p>
          </div>
        </div>

        <div className="bg-[#141824] border border-slate-700 rounded-xl p-4 mb-6">
          <p className="text-sm text-slate-400">
            This view provides detailed role context analysis including snap share trends, 
            route participation, target distribution, and role stability metrics.
          </p>
        </div>

        <RoleBankRankings />
      </div>
    </div>
  );
}
