import RookieClass2025 from "@/components/RookieClass2025";
import UsageLeaders from "@/components/UsageLeaders";
import RedraftList from "./RedraftList";
import { useState } from 'react';

// Feature flag for production readiness
const READY = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_REDRAFT_READY === "1";

export default function RedraftPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'wr-rankings'>('overview');

  if (!READY && activeTab === 'overview') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Redraft 2025</h1>
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <h2 className="text-lg font-medium text-gray-600 mb-2">Coming Soon</h2>
          <p className="text-sm text-gray-500">
            Redraft tools are being prepared for the 2025 season. Check back soon!
          </p>
        </div>
        <div className="mt-6">
          <button 
            onClick={() => setActiveTab('wr-rankings')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Preview: 2025 WR Rankings
          </button>
        </div>
      </div>
    );
  }
  
  if (activeTab === 'wr-rankings') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('overview')}
            className="text-blue-600 hover:underline text-sm"
          >
            ← Back to Redraft Tools
          </button>
        </div>
        <RedraftList />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Redraft 2025</h1>
      
      <div className="mb-6">
        <button 
          onClick={() => setActiveTab('wr-rankings')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mr-4"
        >
          View WR Rankings
        </button>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-2">Usage Leaders (Week 1)</h2>
        <UsageLeaders season={2024} week={1} limit={50} />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Rookie Spotlight — Class of 2025</h2>
        <RookieClass2025 season={2024} week={1} />
      </section>
    </div>
  );
}