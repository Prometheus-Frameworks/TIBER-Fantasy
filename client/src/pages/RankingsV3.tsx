import React, { useState } from "react";
import { useLocation } from "wouter";
import RankingsV3Table from "../components/RankingsV3Table";

export default function RankingsV3Page() {
  const [location, setLocation] = useLocation();
  
  // Extract mode and position from URL params
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const initialMode = (urlParams.get('mode') as "dynasty" | "redraft") || "dynasty";
  const initialPosition = urlParams.get('position') || "ALL";
  
  const [mode, setMode] = useState<"dynasty" | "redraft">(initialMode);
  const [position, setPosition] = useState<string>(initialPosition);
  
  const handleModeChange = (newMode: "dynasty" | "redraft") => {
    setMode(newMode);
    updateURL(newMode, position);
  };
  
  const handlePositionChange = (newPosition: string) => {
    setPosition(newPosition);
    updateURL(mode, newPosition);
  };
  
  const updateURL = (currentMode: string, currentPosition: string) => {
    const params = new URLSearchParams();
    params.set('mode', currentMode);
    if (currentPosition !== "ALL") {
      params.set('position', currentPosition);
    }
    setLocation(`/rankings/v3?${params.toString()}`);
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🚀 DeepSeek v3.1 Rankings
          </h1>
          <p className="text-gray-600">
            xFP anchoring system with Expected Fantasy Points (60% weight) + OLS regression coefficients
          </p>
        </div>
        
        {/* Mode Toggle */}
        <div className="mb-4 flex gap-2">
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
        
        {/* Position Toggle */}
        <div className="mb-6 flex gap-2 flex-wrap">
          <button 
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              position === "ALL" 
                ? "bg-purple-600 text-white" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => handlePositionChange("ALL")}
          >
            All Positions
          </button>
          {["QB", "RB", "WR", "TE"].map((pos) => (
            <button 
              key={pos}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                position === pos 
                  ? "bg-purple-600 text-white" 
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
              onClick={() => handlePositionChange(pos)}
            >
              {pos}
            </button>
          ))}
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6">
            <RankingsV3Table mode={mode} position={position === "ALL" ? undefined : position} />
          </div>
        </div>
        
        <div className="mt-6 text-sm text-gray-500 text-center">
          <p>
            <span className="font-medium">🚀 DeepSeek v3.1 Rankings System</span> • xFP Anchoring with OLS Regression
          </p>
          <p className="mt-1">
            Expected Fantasy Points (60% weight) • Player-specific analytics • Live Sleeper data • DeepSeek v3.1 Engine
          </p>
        </div>
      </div>
    </div>
  );
}