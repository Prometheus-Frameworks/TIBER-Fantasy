import { Link, useLocation } from "wouter";
import { Trophy, Menu, X, ChevronDown } from "lucide-react";
import { useState } from "react";
import { NAV_LINKS, ADMIN_NAV_LINKS } from "../config/nav";

export default function Navigation() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState<string | null>(null);

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  const isDropdownActive = (dropdown: any[]) => {
    return dropdown.some(item => isActive(item.href!));
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
            {NAV_LINKS.map((tab, index) => {
              if (tab.dropdown) {
                const active = isDropdownActive(tab.dropdown);
                return (
                  <div key={`dropdown-${index}`} className="relative group">
                    <button
                      className={`px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
                        active 
                          ? "text-ink border-b-2 border-gold" 
                          : "text-body hover:text-ink"
                      }`}
                    >
                      {tab.label}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    
                    {/* Desktop Dropdown */}
                    <div className="absolute top-full left-0 min-w-48 bg-white border border-line rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="py-1">
                        {tab.dropdown.map(item => (
                          <Link
                            key={item.href}
                            href={item.href!}
                            className="block px-4 py-2 text-sm text-body hover:text-ink hover:bg-gray-100 transition-colors"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }
              
              const active = isActive(tab.href!);
              return (
                <Link
                  key={tab.href}
                  href={tab.href!}
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
            
            {/* Admin Dropdown */}
            <div className="relative group">
              <button
                className={`px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
                  isDropdownActive(ADMIN_NAV_LINKS)
                    ? "text-ink border-b-2 border-gold" 
                    : "text-body hover:text-ink"
                }`}
              >
                Admin
                <ChevronDown className="h-3 w-3" />
              </button>
              
              <div className="absolute top-full left-0 min-w-48 bg-white border border-line rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="py-1">
                  {ADMIN_NAV_LINKS.map(item => (
                    <Link
                      key={item.href}
                      href={item.href!}
                      className="block px-4 py-2 text-sm text-body hover:text-ink hover:bg-gray-100 transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
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
          {NAV_LINKS.slice(0, 6).map((tab, index) => {
            if (tab.dropdown) {
              const active = isDropdownActive(tab.dropdown);
              return (
                <button
                  key={`mobile-dropdown-${index}`}
                  onClick={() => setMobileDropdownOpen(mobileDropdownOpen === tab.label ? null : tab.label)}
                  className={`py-2 px-3 rounded-md whitespace-nowrap text-xs font-medium transition-colors flex-shrink-0 flex items-center gap-1 ${
                    active 
                      ? "text-white bg-ink" 
                      : "text-body hover:text-ink bg-haze"
                  }`}
                >
                  {tab.label}
                  <ChevronDown className="h-3 w-3" />
                </button>
              );
            }
            
            const active = isActive(tab.href!);
            return (
              <Link
                key={tab.href}
                href={tab.href!}
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

      {/* Mobile Dropdown Content */}
      {mobileDropdownOpen && (
        <div className="sm:hidden bg-white border-b border-line">
          <div className="px-4 py-2">
            {NAV_LINKS.find(tab => tab.label === mobileDropdownOpen)?.dropdown?.map(item => (
              <Link
                key={item.href}
                href={item.href!}
                className="block py-2 px-3 rounded-lg text-sm font-medium text-body hover:text-ink hover:bg-gray-100 transition-colors"
                onClick={() => setMobileDropdownOpen(null)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-white border-b border-line">
          <div className="px-4 py-2 space-y-1">
            {NAV_LINKS.map((tab, index) => {
              if (tab.dropdown) {
                return (
                  <div key={`full-mobile-dropdown-${index}`}>
                    <div className="py-3 px-3 rounded-lg text-sm font-medium text-body">
                      <div className="font-medium">{tab.label}</div>
                      {tab.description && (
                        <div className="text-xs opacity-75 mt-0.5">{tab.description}</div>
                      )}
                    </div>
                    <div className="ml-4 space-y-1">
                      {tab.dropdown.map(item => {
                        const active = isActive(item.href!);
                        return (
                          <Link
                            key={item.href}
                            href={item.href!}
                            className={`block py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              active 
                                ? "text-white bg-ink" 
                                : "text-body hover:text-ink bg-haze"
                            }`}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <div className="font-medium">{item.label}</div>
                            {item.description && (
                              <div className="text-xs opacity-75 mt-0.5">{item.description}</div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              
              const active = isActive(tab.href!);
              return (
                <Link
                  key={tab.href}
                  href={tab.href!}
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
            
            {/* Admin Section */}
            <div>
              <div className="py-3 px-3 rounded-lg text-sm font-medium text-body">
                <div className="font-medium">Admin</div>
              </div>
              <div className="ml-4 space-y-1">
                {ADMIN_NAV_LINKS.map(item => {
                  const active = isActive(item.href!);
                  return (
                    <Link
                      key={item.href}
                      href={item.href!}
                      className={`block py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        active 
                          ? "text-white bg-ink" 
                          : "text-body hover:text-ink bg-haze"
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="font-medium">{item.label}</div>
                      {item.description && (
                        <div className="text-xs opacity-75 mt-0.5">{item.description}</div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}