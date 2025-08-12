import { founderModeAtom } from "../state/founderMode";
import { useEffect, useState } from "react";

export function useFounderMode() {
  const [founderMode, setFounderMode] = useState(founderModeAtom.get);

  useEffect(() => {
    const unsubscribe = founderModeAtom.subscribe(setFounderMode);
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Global mirror() function for console activation
    (window as any).mirror = (on: boolean = true) => {
      founderModeAtom.set(on);
      console.log(on ? "Founder Mode ON — Architect J & Lamar active." : "Founder Mode OFF");
    };

    // Keyboard shortcut: Ctrl+Shift+M
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "m") {
        founderModeAtom.set(!founderModeAtom.get());
        console.log("Founder Mode toggled");
      }
    };

    window.addEventListener("keydown", handleKeydown);
    
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  return founderMode;
}