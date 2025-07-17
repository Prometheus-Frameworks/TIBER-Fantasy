import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import WRAnalyticsTable from "@/components/WRAnalyticsTable";
import RBAnalytics from "@/pages/RBAnalytics";
import QBAnalyticsTable from "@/components/QBAnalyticsTable";
import TEAnalyticsTable from "@/components/TEAnalyticsTable";

type PositionType = "WR" | "RB" | "QB" | "TE";

const positions = [
  { value: "WR", label: "Wide Receivers (WR)" },
  { value: "RB", label: "Running Backs (RB)" },
  { value: "QB", label: "Quarterbacks (QB)" },
  { value: "TE", label: "Tight Ends (TE)" }
];

export default function AdvancedAnalytics() {
  const [location] = useLocation();
  const [selectedPosition, setSelectedPosition] = useState<PositionType>("WR");

  // Auto-select position based on URL path
  useEffect(() => {
    if (location.includes('/wide-receivers')) {
      setSelectedPosition("WR");
    } else if (location.includes('/running-backs')) {
      setSelectedPosition("RB");
    } else if (location.includes('/quarterbacks')) {
      setSelectedPosition("QB");
    } else if (location.includes('/tight-ends')) {
      setSelectedPosition("TE");
    }
  }, [location]);

  const renderTable = () => {
    switch (selectedPosition) {
      case "WR":
        return <WRAnalyticsTable />;
      case "RB":
        return <RBAnalytics />;
      case "QB":
        return <QBAnalyticsTable />;
      case "TE":
        return <TEAnalyticsTable />;
      default:
        return <WRAnalyticsTable />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Advanced Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Comprehensive NFL player analytics with 2024 season data from NFL-Data-Py
          </p>
        </div>

        {/* Position Selector */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Position:
            </label>
            <Select value={selectedPosition} onValueChange={(value) => setSelectedPosition(value as PositionType)}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose position" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((position) => (
                  <SelectItem key={position.value} value={position.value}>
                    {position.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Analytics Table Display */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          {renderTable()}
        </div>
      </div>
    </div>
  );
}