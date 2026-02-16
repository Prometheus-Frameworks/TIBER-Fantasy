import HealthBadge from "./HealthBadge";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-8">
        <div className="flex items-center gap-6">
          <div className="text-sm text-body">© {new Date().getFullYear()} On The Clock</div>
          <div className="text-xs opacity-70 space-x-4">
            <a href="/architecture" className="underline hover:opacity-100 transition-opacity">
              Architecture
            </a>
            <a href="/metrics-dictionary" className="underline hover:opacity-100 transition-opacity">
              Metrics
            </a>
          </div>
        </div>
        <HealthBadge />
      </div>
    </footer>
  );
}