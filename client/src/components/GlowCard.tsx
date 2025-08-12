import { motion } from "framer-motion";

export default function GlowCard({
  title, subtitle, icon, href
}: { title:string; subtitle?:string; icon?:React.ReactNode; href?:string }) {
  const Wrapper:any = href ? "a" : "div";
  return (
    <Wrapper href={href} className="group relative block">
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-gold via-plum to-purple-600 opacity-20 blur transition-all duration-300 group-hover:opacity-40" />
      <motion.div
        whileHover={{ y:-2, scale:1.01 }}
        transition={{ type:"spring", stiffness:300, damping:24 }}
        className="relative rounded-2xl border border-line bg-white/90 p-5 shadow-sm hover:shadow-md"
      >
        <div className="flex items-center gap-3">
          {icon && <div className="text-2xl text-plum">{icon}</div>}
          <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
        </div>
        {subtitle && <p className="mt-1 text-sm text-body">{subtitle}</p>}
      </motion.div>
    </Wrapper>
  );
}