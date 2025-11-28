import AlphaRankingsLayout from '../components/AlphaRankingsLayout';
import ForgeTransparencyPanel from '../components/ForgeTransparencyPanel';
import { Clock } from 'lucide-react';

export default function TERankings() {
  return (
    <AlphaRankingsLayout position="TE">
      <div className="bg-[#141824] border border-slate-700 rounded-xl p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
            <Clock className="h-8 w-8 text-slate-500" />
          </div>
          <h2 className="text-xl font-semibold text-white">TE Rankings Coming Soon</h2>
          <p className="text-slate-400 max-w-md">
            FORGE TE calibration is in progress. Check back soon for Sandbox α vs FORGE α 
            comparison for tight ends.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="px-3 py-1 bg-slate-800 text-slate-400 text-sm rounded-full">
              Sandbox α: Available
            </span>
            <span className="px-3 py-1 bg-yellow-900/30 text-yellow-400 text-sm rounded-full border border-yellow-700/50">
              FORGE α: Calibrating
            </span>
          </div>
        </div>
      </div>

      <ForgeTransparencyPanel position="TE" />
    </AlphaRankingsLayout>
  );
}
