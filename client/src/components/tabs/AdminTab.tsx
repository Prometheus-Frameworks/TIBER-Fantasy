import { Link } from 'wouter';
import { Settings, FlaskConical } from 'lucide-react';

export default function AdminTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Admin Tools
        </h2>
        <p className="text-gray-400 text-sm">
          Development and testing utilities for algorithm development
        </p>
      </div>

      <div className="grid gap-4">
        <Link href="/admin/wr-rankings-sandbox">
          <div className="bg-[#1e2330] border border-gray-700 rounded-xl p-6 hover:border-blue-500/50 transition-all cursor-pointer group">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center group-hover:from-blue-500/30 group-hover:to-purple-500/30 transition-all">
                <FlaskConical className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">
                  WR Rankings Sandbox
                </h3>
                <p className="text-sm text-gray-400">
                  Test and develop WR ranking algorithms with real 2025 data. Experiment with different weighting formulas before rolling out changes.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-blue-400">
                  <span>Open Sandbox</span>
                  <span>→</span>
                </div>
              </div>
            </div>
          </div>
        </Link>

        <div className="bg-[#1e2330] border border-gray-700 rounded-xl p-6 opacity-50">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-500/20 to-gray-600/20 rounded-lg flex items-center justify-center">
              <Settings className="w-6 h-6 text-gray-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-400 mb-1">
                More Tools Coming Soon
              </h3>
              <p className="text-sm text-gray-500">
                Additional admin utilities for RB, TE, and QB ranking development
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
