import { Link } from "wouter";

interface SystemCardProps {
  title: string;
  desc: string;
  href: string;
  icon?: string;
}

export default function SystemCard({ title, desc, href, icon = "⚙️" }: SystemCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-line bg-white shadow-card hover:shadow-md transition"
    >
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{icon}</span>
          <h3 className="text-base font-semibold text-ink">{title}</h3>
        </div>
        <p className="text-sm text-body">{desc}</p>
      </div>
    </Link>
  );
}