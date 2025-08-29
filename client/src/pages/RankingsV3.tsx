import React, { useState } from "react";
import { useLocation } from "wouter";
import RankingsV3Table from "../components/RankingsV3Table";

export default function RankingsV3Page() {
  const [location, setLocation] = useLocation();
  
  // Extract mode from URL params or default to dynasty
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const initialMode = (urlParams.get('mode') as "dynasty" | "redraft") || "dynasty";
  
  const [mode, setMode] = useState<"dynasty" | "redraft">(initialMode);
  
  const handleModeChange = (newMode: "dynasty" | "redraft") => {
    setMode(newMode);
    setLocation(`/rankings/v3?mode=${newMode}`);
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🚀 DeepSeek v3 Rankings
          </h1>
          <p className="text-gray-600">
            Advanced 6-component methodology with full season coverage, VOR calculations, and debug transparency
          </p>
        </div>
        
        <div className="mb-6 flex gap-2">
          <button 
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              mode === "dynasty" 
                ? "bg-blue-600 text-white" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => handleModeChange("dynasty")}
          >
            Dynasty
          </button>
          <button 
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              mode === "redraft" 
                ? "bg-blue-600 text-white" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => handleModeChange("redraft")}
          >
            Redraft
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6">
            <RankingsV3Table mode={mode} />
          </div>
        </div>
        
        <div className="mt-6 text-sm text-gray-500 text-center">
          <p>
            <span className="font-medium">🚀 DeepSeek v3 Rankings System</span> • Production-grade with W1-W17 coverage
          </p>
          <p className="mt-1">
            Debug Mode: ON • 6-component methodology • VOR-based • Tier clustering • DeepSeek v3 Engine
          </p>
        </div>
      </div>
    </div>
  );
}