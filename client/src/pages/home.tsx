import { Link } from "wouter";
import { QUICK_ACTIONS } from "../config/nav";
import { Compass, Users, Trophy, Zap } from "lucide-react";

function PrometheusCard({ icon: Icon, title, desc, href }: {
  icon: any; title: string; desc: string; href: string;
}) {
  return (
    <Link
      href={href}
      className="block relative promethean-card rounded-xl p-6 constellation-pattern group transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500 to-purple-600">
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-yellow-500 to-purple-600 opacity-20 pulse-gold"></div>
        </div>
        <div className="text-lg font-bold text-white mb-2">{title}</div>
        <p className="text-sm text-gray-300 leading-relaxed">{desc}</p>
        <div className="mt-4 text-xs text-yellow-500 font-medium group-hover:text-purple-400 transition-colors">
          EXPLORE SYSTEM →
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen promethean-bg">
      {/* HERO */}
      <section className="relative overflow-hidden network-grid">
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center">
          {/* Main Brand */}
          <div className="mb-8">
            <h1 className="text-6xl font-black leading-tight text-white mb-4">
              <span className="bg-gradient-to-r from-yellow-500 via-yellow-400 to-purple-500 bg-clip-text text-transparent">
                ON THE CLOCK
              </span>
            </h1>
            <p className="text-xl text-gray-300 font-medium">Fantasy Football. Evolved.</p>
            <div className="mt-4 h-1 w-24 mx-auto bg-gradient-to-r from-yellow-500 to-purple-600 rounded-full"></div>
          </div>

          {/* Quick Actions Grid */}
          <div className="mt-12">
            <h2 className="text-sm font-bold text-yellow-500 uppercase tracking-wider mb-6">PROMETHEUS SYSTEMS</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {QUICK_ACTIONS.map((action) => (
                <Link 
                  key={action.href}
                  href={action.href} 
                  className="group relative promethean-card rounded-lg p-4 text-center transition-all duration-300 hover:scale-105"
                >
                  <div className="relative z-10">
                    <div className="h-8 w-8 mx-auto mb-2 rounded-full bg-gradient-to-r from-yellow-500 to-purple-600 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors">
                      {action.label}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{action.description}</div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-purple-600/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CORE SYSTEMS */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Core Systems</h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Advanced analytics and decision-making tools built for the modern fantasy manager.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          <PrometheusCard 
            icon={Compass} 
            title="Player Compass" 
            desc="Context-aware guidance with scenario analysis, risk assessment, and dynasty decision support for every roster move." 
            href="/compass" 
          />
          <PrometheusCard 
            icon={Users} 
            title="OTC Consensus" 
            desc="Community-driven rankings with transparent methodology, expert boards, and real-time movement tracking." 
            href="/consensus" 
          />
          <PrometheusCard 
            icon={Trophy} 
            title="Draft Command" 
            desc="Prep and dominate your draft with real-time ADP, target sheets, and adaptive strategy algorithms." 
            href="/draft-room" 
          />
        </div>
      </section>

      {/* PROMETHEUS IDENTITY */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="promethean-card rounded-2xl p-8 constellation-pattern relative overflow-hidden">
          <div className="relative z-10 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-yellow-500 to-purple-600 flex items-center justify-center glow-purple">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Built by the Duo</h3>
            <p className="text-gray-300 mb-6 leading-relaxed">
              Open-source intelligence for the fantasy football community. No paywalls, no gatekeeping—just advanced tools that help you make better decisions.
            </p>
            <div className="text-xs text-yellow-500 font-medium">
              SERVE NOT TAKE
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}