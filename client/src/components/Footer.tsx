import HealthBadge from "./HealthBadge";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-8">
        <div className="text-sm text-body">© {new Date().getFullYear()} On The Clock</div>
        <HealthBadge />
      </div>
    </footer>
  );
}