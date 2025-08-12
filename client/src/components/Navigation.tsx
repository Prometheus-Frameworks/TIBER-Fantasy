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
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <span className="font-extrabold text-xl tracking-tight text-ink">
                On The Clock
              </span>
            </div>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map(tab => {
              const active = isActive(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-3 py-2 text-sm font-medium transition-colors active:translate-y-[1px] ${
                    active 
                      ? "text-ink border-b-2 border-gold" 
                      : "text-body hover:text-ink"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          
          {/* Mobile menu button */}
          <button
            className="sm:hidden p-2 text-body"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>



      {/* Mobile Navigation Row */}
      <nav className="sm:hidden w-full border-b border-line bg-white">
        <div className="px-2 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {NAV_LINKS.slice(0, 6).map(tab => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`py-2 px-3 rounded-md whitespace-nowrap text-xs font-medium transition-colors flex-shrink-0 active:translate-y-[1px] ${
                  active 
                    ? "text-white bg-ink" 
                    : "text-body hover:text-ink bg-haze"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-white border-b border-line">
          <div className="px-4 py-2 space-y-1">
            {NAV_LINKS.map(tab => {
              const active = isActive(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`block py-3 px-3 rounded-lg text-sm font-medium transition-colors ${
                    active 
                      ? "text-white bg-ink" 
                      : "text-body hover:text-ink bg-haze"
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