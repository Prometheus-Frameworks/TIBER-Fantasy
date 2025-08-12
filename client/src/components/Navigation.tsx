import { Link, useLocation } from "wouter";
import { Trophy, Menu, X } from "lucide-react";
import { useState } from "react";
import { NAV_LINKS } from "../config/nav";

export default function Navigation() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <>
      {/* Header */}
      <header style={{ backgroundColor: 'var(--promethean-black)' }} className="border-b border-yellow-600/30">
        <div className="mx-auto max-w-6xl px-2 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="relative">
                  <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500 flex-shrink-0" />
                  <div className="absolute inset-0 h-6 w-6 sm:h-8 sm:w-8 bg-purple-600 rounded-full opacity-20 pulse-gold"></div>
                </div>
                <span className="text-xl sm:text-2xl font-bold text-white truncate">
                  On The Clock
                </span>
              </div>
            </Link>
            
            {/* Mobile menu button */}
            <button
              className="sm:hidden p-2 text-gray-300 hover:text-yellow-500 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Navigation Tabs */}
      <nav style={{ backgroundColor: 'var(--promethean-black)' }} className="hidden sm:block w-full border-b border-yellow-600/20">
        <div className="mx-auto max-w-6xl px-2 sm:px-4 flex gap-2 sm:gap-8 overflow-x-auto scrollbar-hide">
          {NAV_LINKS.map(tab => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`py-4 px-2 sm:px-0 border-b-2 whitespace-nowrap text-xs sm:text-sm font-bold transition-all duration-300 flex-shrink-0 relative group ${
                  active 
                    ? "border-yellow-500 text-yellow-500" 
                    : "border-transparent text-gray-400 hover:text-yellow-400 hover:border-purple-500"
                }`}
              >
                {tab.label}
                {!active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-500 to-purple-600 opacity-0 group-hover:opacity-50 transition-opacity"></div>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Navigation Row */}
      <nav style={{ backgroundColor: 'var(--promethean-black)' }} className="sm:hidden w-full border-b border-yellow-600/20">
        <div className="px-2 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {NAV_LINKS.slice(0, 6).map(tab => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`py-2 px-3 rounded-full whitespace-nowrap text-xs font-bold transition-all duration-300 flex-shrink-0 ${
                  active 
                    ? "bg-gradient-to-r from-yellow-500 to-purple-600 text-white" 
                    : "bg-gray-800 text-gray-400 hover:text-yellow-400 hover:bg-gray-700"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div style={{ backgroundColor: 'var(--promethean-black)' }} className="sm:hidden border-b border-yellow-600/20">
          <div className="px-4 py-2 space-y-1">
            {NAV_LINKS.map(tab => {
              const active = isActive(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`block py-3 px-3 rounded-lg text-sm font-bold transition-all duration-300 ${
                    active 
                      ? "bg-gradient-to-r from-yellow-500 to-purple-600 text-white" 
                      : "text-gray-400 hover:text-yellow-400 hover:bg-gray-800"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="font-bold">{tab.label}</div>
                  {tab.description && (
                    <div className="text-xs opacity-75 mt-0.5">{tab.description}</div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}