import { Link, useLocation } from "wouter";
import { Trophy } from "lucide-react";

const tabs = [
  { href: "/", label: "Home" },
  { href: "/redraft", label: "Redraft" },
  { href: "/dynasty", label: "Dynasty" },
  { href: "/rankings", label: "Rankings" },
  { href: "/analytics", label: "Analytics" },
  { href: "/articles", label: "Articles & Analysis" },
  { href: "/weekly-data", label: "Weekly Data" },
  { href: "/trade-analyzer", label: "Trade Analyzer" },
  { href: "/oasis", label: "OASIS" },
];

export default function Navigation() {
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-6xl px-2 sm:px-4 py-3 sm:py-4">
          <Link href="/">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600 flex-shrink-0" />
              <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                On The Clock
              </span>
            </div>
          </Link>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-2 sm:px-4 flex gap-2 sm:gap-6 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => {
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
    </>
  );
}