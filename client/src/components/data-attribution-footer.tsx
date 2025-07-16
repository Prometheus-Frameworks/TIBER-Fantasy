import { Shield, ExternalLink } from "lucide-react";

export default function DataAttributionFooter() {
  return (
    <div className="bg-gray-900 text-white border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold">Data Sources & Attribution</h3>
          </div>
          <p className="text-gray-400 text-sm max-w-2xl mx-auto">
            Prometheus uses authentic data from verified sources to provide accurate fantasy football analysis.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="text-center">
            <h4 className="font-medium text-white mb-2">League Data</h4>
            <p className="text-sm text-gray-400">
              League synchronization via{" "}
              <a 
                href="https://sleeper.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
              >
                Sleeper API
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
          
          <div className="text-center">
            <h4 className="font-medium text-white mb-2">NFL Statistics</h4>
            <p className="text-sm text-gray-400">
              NFL data via{" "}
              <a 
                href="https://github.com/cooperdff/nfl_data_py" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
              >
                NFL-Data-Py
                <ExternalLink className="w-3 h-3" />
              </a>
              {" "}(MIT License)
            </p>
          </div>
          
          <div className="text-center">
            <h4 className="font-medium text-white mb-2">Dynasty Values</h4>
            <p className="text-sm text-gray-400">
              Proprietary algorithms based on{" "}
              <span className="text-blue-400">
                NFL performance data
              </span>
            </p>
          </div>
          
          <div className="text-center">
            <h4 className="font-medium text-white mb-2">Trade Analysis</h4>
            <p className="text-sm text-gray-400">
              Trade data by{" "}
              <a 
                href="https://fantasycalc.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
              >
                FantasyCalc
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>
        
        <div className="border-t border-gray-800 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
            <div className="mb-2 md:mb-0">
              <p>
                Prometheus is an independent fantasy football analytics platform.
                All trademarks belong to their respective owners.
              </p>
            </div>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Data Sources</a>
              <a href="/signals-and-notes.html" className="hover:text-white transition-colors text-gray-500 text-xs">·</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}