export default function GlowCTA({ children, href="/consensus" }:{
  children: React.ReactNode; href?: string;
}) {
  return (
    <a
      href={href}
      className="relative inline-flex items-center justify-center rounded-xl px-5 py-3 font-medium
                 text-white bg-gradient-to-r from-gold to-plum shadow
                 hover:from-gold/90 hover:to-plum/90 transition-all duration-200"
    >
      <span className="absolute inset-0 rounded-xl animate-ping-slow bg-gradient-to-r from-gold to-plum opacity-20" />
      <span className="relative">{children}</span>
    </a>
  );
}