import { useLocation } from "wouter";

export function useNav() {
  const [, setLocation] = useLocation();
  return (to: string, replace = false) =>
    setLocation(to, { replace });
}