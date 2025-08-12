interface UsernameProps {
  name: string;
  fireScore: number;
  className?: string;
}

export function Username({ name, fireScore, className = "" }: UsernameProps) {
  const tier = fireScore >= 5000 ? 5000 : fireScore >= 500 ? 500 : fireScore >= 50 ? 50 : 0;
  
  const baseClasses = tier ? "username-hot" : "";
  const combinedClasses = `${baseClasses} ${className}`.trim();
  
  return (
    <span className={combinedClasses}>
      {name}
      {tier ? ` — lvl ${tier}🔥` : ""}
    </span>
  );
}

// Add these styles to your global CSS
export const usernameStyles = `
.username-hot {
  position: relative;
  text-shadow: 0 0 8px rgba(255, 111, 0, 0.6);
}

.username-hot::after {
  content: " 🔥";
}
`;