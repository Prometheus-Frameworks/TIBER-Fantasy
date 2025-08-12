import { motion } from "framer-motion";
import Button from "./Button";

interface GlowCTAProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
  loading?: boolean;
}

export default function GlowCTA({ children, onClick, href="/consensus", className = "", loading = false }: GlowCTAProps) {
  if (href && !onClick) {
    return (
      <div className="relative">
        {/* Pulsing background effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-gold to-plum rounded-xl opacity-30 animate-ping-slow"></div>
        
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <a
            href={href}
            className={`relative inline-flex items-center justify-center rounded-xl px-5 py-3 font-medium
                       text-white bg-gradient-to-r from-gold to-plum shadow
                       hover:from-gold/90 hover:to-plum/90 transition-all duration-200 active:translate-y-[1px] ${className}`}
          >
            <span className="relative">{children}</span>
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Pulsing background effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-gold to-plum rounded-xl opacity-30 animate-ping-slow"></div>
      
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Button
          onClick={onClick}
          loading={loading}
          className={`relative px-5 py-3 rounded-xl shadow-lg hover:shadow-xl ${className}`}
        >
          {children}
        </Button>
      </motion.div>
    </div>
  );
}