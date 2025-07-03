import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, Search, Settings } from "lucide-react";

export default function MobileNav() {
  const [activeTab, setActiveTab] = useState("analysis");

  const tabs = [
    { id: "analysis", label: "Analysis", icon: BarChart3 },
    { id: "lineup", label: "Lineup", icon: Users },
    { id: "players", label: "Players", icon: Search },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden">
      <div className="grid grid-cols-4 h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant="ghost"
              className={`flex flex-col items-center justify-center space-y-1 h-full rounded-none ${
                isActive ? "field-green" : "text-gray-500"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{tab.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
