import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Trophy, Users, Target } from "lucide-react";

export default function Navigation() {
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center space-x-2">
              <Trophy className="h-8 w-8 text-yellow-600" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                Prometheus
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            <Link href="/rankings">
              <Button 
                variant={isActive("/rankings") ? "default" : "ghost"}
                size="sm"
                className="flex items-center space-x-1"
              >
                <TrendingUp className="h-4 w-4" />
                <span>Rankings</span>
              </Button>
            </Link>

            <Link href="/adp">
              <Button 
                variant={isActive("/adp") ? "default" : "ghost"}
                size="sm"
                className="flex items-center space-x-1"
              >
                <Target className="h-4 w-4" />
                <span>ADP</span>
                <Badge variant="secondary" className="ml-1 text-xs bg-blue-100 text-blue-800">
                  Live
                </Badge>
              </Button>
            </Link>

            <Link href="/compare-league">
              <Button 
                variant={isActive("/compare-league") ? "default" : "ghost"}
                size="sm"
                className="flex items-center space-x-1"
              >
                <Users className="h-4 w-4" />
                <span>Compare</span>
              </Button>
            </Link>

            <Link href="/enhanced-dynasty">
              <Button 
                variant={isActive("/enhanced-dynasty") ? "default" : "ghost"}
                size="sm"
              >
                Analytics
              </Button>
            </Link>

            <Link href="/about">
              <Button 
                variant={isActive("/about") ? "default" : "ghost"}
                size="sm"
              >
                About
              </Button>
            </Link>
          </div>

          {/* Mobile menu placeholder */}
          <div className="md:hidden">
            <Button variant="ghost" size="sm">
              Menu
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}