import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, Search, Settings, Brain, Crown } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function MobileNav() {
  const [location] = useLocation();

  const tabs = [
    { id: "dashboard", label: "Team", icon: BarChart3, href: "/" },
    { id: "analytics", label: "Analytics", icon: Brain, href: "/analytics" },
    { id: "premium", label: "Premium", icon: Crown, href: "/premium" },
    { id: "sync", label: "Sync", icon: Users, href: "/sync" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
      <div className="grid grid-cols-4 h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location === tab.href || (tab.href === "/" && location === "/dashboard");
          
          return (
            <Link key={tab.id} href={tab.href}>
              <Button
                variant="ghost"
                className={`flex flex-col items-center justify-center space-y-1 h-full rounded-none w-full ${
                  isActive ? "text-field-green bg-green-50" : "text-gray-500"
                }`}
              >
                <Icon size={20} />
                <span className="text-xs font-medium">{tab.label}</span>
              </Button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
