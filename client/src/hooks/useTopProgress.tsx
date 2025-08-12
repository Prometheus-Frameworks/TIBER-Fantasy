import { useEffect } from "react";
import NProgress from "nprogress";
import "nprogress/nprogress.css"; // base styles
import "../styles/nprogress.css";  // our custom theme
import { useIsFetching } from "@tanstack/react-query";

// Configure NProgress for smooth, professional feel
NProgress.configure({ 
  showSpinner: false, 
  trickleSpeed: 120, 
  minimum: 0.08 
});

export function useTopProgress() {
  const isFetching = useIsFetching(); // any React Query requests in-flight?
  const busy = isFetching > 0;

  useEffect(() => {
    let timeout: number | null = null;
    
    if (busy) {
      // Small delay prevents flicker on very fast operations
      timeout = window.setTimeout(() => NProgress.start(), 100);
    } else {
      if (timeout) window.clearTimeout(timeout);
      NProgress.done(true);
    }
    
    return () => { 
      if (timeout) window.clearTimeout(timeout); 
    };
  }, [busy]);
}