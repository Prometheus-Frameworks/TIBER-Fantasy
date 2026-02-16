import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import RoleBankRankings from '../components/RoleBankRankings';

export default function RoleContextRankings() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/tiber-data-lab" className="text-slate-400 hover:text-white transition-colors" data-testid="back-link">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>
              <Link href="/tiber-data-lab" style={{ color: "#9ca3af", textDecoration: "none" }}>Data Lab</Link>
              <ChevronRight size={12} />
              <span style={{ color: "#d1d5db", fontWeight: 500 }}>Role Banks</span>
            </div>
            <h1 className="text-2xl font-bold text-white" data-testid="page-title">
              Role Banks
            </h1>
            <p className="text-sm text-slate-400">
              Season-level analytical classification systems for WR, RB, TE, and QB role archetypes
            </p>
          </div>
        </div>

        <RoleBankRankings />
      </div>
    </div>
  );
}
