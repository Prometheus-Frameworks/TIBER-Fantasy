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
      <header style={{ backgroundColor: 'var(--dark-bg)' }}>
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-3">
              <span className="text-2xl" style={{ color: 'var(--gold)' }}>🏆</span>
              <span className="font-bold text-xl text-white">
                ON THE CLOCK
              </span>
            </div>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden sm:flex items-center gap-8">
            <Link href="/" className="text-sm font-medium text-white hover:text-yellow-400 transition-colors">
              Home
            </Link>
            <Link href="/consensus" className="text-sm font-medium text-white hover:text-yellow-400 transition-colors">
              OTC Consensus
            </Link>
            <Link href="/consensus/transparency" className="text-sm font-medium text-white hover:text-yellow-400 transition-colors">
              Consensus Transparency
            </Link>
          </nav>
          
          {/* Mobile menu button */}
          <button
            className="sm:hidden p-2 text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>



      {/* Mobile Navigation Row */}
      <nav className="sm:hidden w-full" style={{ backgroundColor: 'var(--dark-bg)' }}>
        <div className="px-2 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
          <Link href="/" className="py-2 px-3 rounded-md whitespace-nowrap text-xs font-medium text-white hover:text-yellow-400 transition-colors flex-shrink-0">
            Home
          </Link>
          <Link href="/consensus" className="py-2 px-3 rounded-md whitespace-nowrap text-xs font-medium text-white hover:text-yellow-400 transition-colors flex-shrink-0">
            OTC Consensus
          </Link>
          <Link href="/consensus/transparency" className="py-2 px-3 rounded-md whitespace-nowrap text-xs font-medium text-white hover:text-yellow-400 transition-colors flex-shrink-0">
            Transparency
          </Link>
        </div>
      </nav>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden" style={{ backgroundColor: 'var(--dark-bg)' }}>
          <div className="px-4 py-2 space-y-1">
            <Link
              href="/"
              className="block py-3 px-3 rounded-lg text-sm font-medium text-white hover:text-yellow-400 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/consensus"
              className="block py-3 px-3 rounded-lg text-sm font-medium text-white hover:text-yellow-400 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              OTC Consensus
            </Link>
            <Link
              href="/consensus/transparency"
              className="block py-3 px-3 rounded-lg text-sm font-medium text-white hover:text-yellow-400 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Consensus Transparency
            </Link>
          </div>
        </div>
      )}
    </>
  );
}