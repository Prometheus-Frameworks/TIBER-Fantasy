import React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ConsensusHub() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          OTC Consensus Rankings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Community-driven rankings with transparent methodology. Pure signal, no noise.
        </p>
      </div>

      {/* Main Navigation Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                Dynasty
              </Badge>
              Dynasty Rankings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Long-term value rankings focused on sustained production and career trajectory.
            </p>
            <div className="flex gap-2">
              <Link href="/consensus/dynasty">
                <Button className="w-full">View Dynasty Rankings</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                2025
              </Badge>
              Redraft Rankings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Single-season rankings optimized for 2025 fantasy football production.
            </p>
            <div className="flex gap-2">
              <Link href="/consensus/redraft">
                <Button className="w-full">View Redraft Rankings</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Management Tools */}
      <Card>
        <CardHeader>
          <CardTitle>Management Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Professional tools for consensus management and tier assignment.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/consensus/tiers">
              <Button variant="outline" size="sm">
                Tier Manager
              </Button>
            </Link>
            <Link href="/consensus/seed">
              <Button variant="outline" size="sm">
                Consensus Seeding
              </Button>
            </Link>
            <Link href="/consensus-transparency">
              <Button variant="outline" size="sm">
                Transparency Report
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Expert Perspectives */}
      <Card>
        <CardHeader>
          <CardTitle>Expert Perspectives</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Individual ranking perspectives from verified experts and contributors.
          </p>
          <div className="flex gap-2">
            <Link href="/consensus/expert/architect-j">
              <Button variant="outline" size="sm">
                Architect J Profile
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}