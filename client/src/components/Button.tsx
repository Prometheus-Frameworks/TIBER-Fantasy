import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  loading?: boolean;
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className="", variant="primary", loading=false, disabled, children, ...rest }, ref
){
  const base = "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition active:translate-y-[1px]";
  const styles = variant === "primary"
    ? "text-white bg-gradient-to-r from-gold to-plum shadow hover:from-gold/90 hover:to-plum/90 disabled:opacity-50"
    : "text-ink hover:bg-haze disabled:opacity-50";
  
  return (
    <button
      ref={ref}
      className={`${base} ${styles} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

export default Button;