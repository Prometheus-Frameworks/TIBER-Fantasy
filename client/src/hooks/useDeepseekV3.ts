import { useEffect, useState } from "react";

export function useDeepseekV3(mode: "dynasty" | "redraft", position?: string) {
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ts?: number; count?: number; mode?: string; position?: string}>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  
  useEffect(() => {
    setLoading(true);
    setErr(null);
    
    const positionParam = position ? `&position=${position}` : '';
    fetch(`/api/rankings/deepseek/v3.1?mode=${mode}${positionParam}`)
      .then(r => r.json())
      .then(j => { 
        setData(j.data ?? []); 
        setMeta({ts: j.ts, count: j.count, mode: j.mode, position: j.position}); 
      })
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [mode, position]);
  
  return { data, meta, loading, err };
}