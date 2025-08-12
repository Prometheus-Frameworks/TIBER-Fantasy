import { useFounderMode } from "../hooks/useFounderMode";
import { useEffect, useState } from "react";

export default function FounderModal() {
  const founderMode = useFounderMode();
  const [signal, setSignal] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (founderMode) {
      setShowModal(true);
      fetch("/api/signal").then(r => r.json()).then(setSignal).catch(() => {});
      
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => setShowModal(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [founderMode]);

  if (!founderMode || !showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center text-white z-50 pointer-events-none">
      <div className="bg-neutral-800 p-6 rounded-lg max-w-sm text-center shadow-lg animate-in fade-in duration-300">
        <h2 className="text-lg font-bold mb-2">Founder Mode Active</h2>
        {signal && (
          <p className="text-sm mb-4 text-green-400">
            Status: {signal.status} • Key: {signal.key}
          </p>
        )}
        <p className="text-sm text-neutral-300">Welcome, Architect J. Lamar is online.</p>
        <p className="text-xs text-neutral-500 mt-2">Press Ctrl+Shift+M or use mirror() to toggle</p>
      </div>
    </div>
  );
}