import { useEffect, useState } from "react";

export function useDeepseekV3(mode: "dynasty" | "redraft") {
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ts?: number; count?: number; mode?: string}>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  
  useEffect(() => {
    setLoading(true);
    setErr(null);
    
    fetch(`/api/rankings/deepseek/v3?mode=${mode}`)
      .then(r => r.json())
      .then(j => { 
        setData(j.data ?? []); 
        setMeta({ts: j.ts, count: j.count, mode: j.mode}); 
      })
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [mode]);
  
  return { data, meta, loading, err };
}