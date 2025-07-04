import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, Search, Settings, Brain, Crown, Trophy, TrendingUp } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function MobileNav() {
  const [location] = useLocation();

  const tabs = [
    { id: "dashboard", label: "Team", icon: BarChart3, href: "/" },
    { id: "rankings", label: "Rankings", icon: Trophy, href: "/rankings" },
    { id: "moves", label: "Moves", icon: TrendingUp, href: "/fantasy-moves" },
    { id: "arbitrage", label: "Value", icon: Search, href: "/arbitrage" },
    { id: "sync", label: "Sync", icon: Users, href: "/sync" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50 safe-area-inset-bottom">
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location === tab.href || (tab.href === "/" && location === "/dashboard");
          
          return (
            <Link key={tab.id} href={tab.href}>
              <Button
                variant="ghost"
                className={`flex flex-col items-center justify-center space-y-1 h-full rounded-none w-full touch-manipulation transition-colors duration-150 ${
                  isActive ? "text-field-green bg-green-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon size={22} className="mb-1" />
                <span className="text-xs font-medium leading-tight">{tab.label}</span>
              </Button>
            </Link>
          );
        })}
      </div>
      {/* iOS home indicator safe area */}
      <div className="h-safe-bottom bg-white"></div>
    </nav>
  );
}
