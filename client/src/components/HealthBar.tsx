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
    <div className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-40 ${className || ''}`}>
      <div className="rounded-full bg-white/90 backdrop-blur px-3 py-1.5 shadow-card border border-line flex items-center gap-2">
        <span 
          className="w-2 h-2 rounded-full" 
          style={{ background: isOk ? '#16a34a' : '#ef4444' }}
        />
        <span className="text-xs text-ink">
          {isOk ? 'Healthy' : 'Degraded'}
        </span>
        <span className="text-[10px] text-body">
          Spine • Ratings • Logs
        </span>
      </div>
    </div>
  );
}