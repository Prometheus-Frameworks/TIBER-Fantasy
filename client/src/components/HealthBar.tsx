import { useState, useEffect } from "react";

interface HealthBarProps {
  className?: string;
}

export default function HealthBar({ className }: HealthBarProps) {
  const [health, setHealth] = useState<any>(null);
  const [isOk, setIsOk] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch("/api/health");
        const data = await response.json();
        setHealth(data);
        setIsOk(data?.status === "healthy");
      } catch (error) {
        setIsOk(false);
        setHealth(null);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (health === null) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="flex items-center gap-2 rounded-full border border-line bg-white/90 px-3 py-1.5 shadow-card backdrop-blur">
        <span className={`relative inline-block h-2.5 w-2.5 rounded-full ${isOk ? "bg-emerald-500" : "bg-red-500"}`}>
          <span className={`absolute inset-0 rounded-full ${isOk ? "animate-pulse bg-emerald-500/30" : "bg-red-500/30"}`} />
        </span>
        <span className="text-xs text-ink">
          {isOk === null ? "Checking..." : isOk ? "Healthy" : "Issues"}
        </span>
      </div>
    </div>
  );
}