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
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-6xl px-2 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600 flex-shrink-0" />
                <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                  On The Clock
                </span>
              </div>
            </Link>
            
            {/* Mobile menu button */}
            <button
              className="sm:hidden p-2 text-gray-500 dark:text-gray-400"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Navigation Tabs */}
      <nav className="hidden sm:block w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-2 sm:px-4 flex gap-2 sm:gap-6 overflow-x-auto scrollbar-hide">
          {NAV_LINKS.map(tab => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`py-3 px-2 sm:px-0 border-b-2 whitespace-nowrap text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${
                  active 
                    ? "border-yellow-600 text-yellow-600 dark:text-yellow-500" 
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Navigation Row */}
      <nav className="sm:hidden w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="px-2 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {NAV_LINKS.slice(0, 6).map(tab => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`py-2 px-3 rounded-full whitespace-nowrap text-xs font-medium transition-colors flex-shrink-0 ${
                  active 
                    ? "bg-yellow-600 text-white" 
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
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
        <div className="sm:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="px-4 py-2 space-y-1">
            {NAV_LINKS.map(tab => {
              const active = isActive(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`block py-2 px-3 rounded text-sm font-medium transition-colors ${
                    active 
                      ? "bg-yellow-600 text-white" 
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="font-medium">{tab.label}</div>
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