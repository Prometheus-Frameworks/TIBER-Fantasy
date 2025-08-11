import { useEffect, useState, useTransition } from "react";
import { mapPlayerLite, PlayerLite } from "@/data/adapters";

export default function RedraftList() {
  const [rows, setRows] = useState<PlayerLite[]>([]);
  const [q, setQ] = useState("");
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr("");
        // Primary: Try redraft rankings endpoint
        let response = await fetch('/api/redraft/rankings?pos=WR&season=2025&limit=50');
        let res = await response.json();
        let data = (res.data || []).map(mapPlayerLite);
        
        // Fallback: If rankings empty, try dynasty value endpoint
        if (!data.length) {
          response = await fetch('/api/dynasty/value?pos=WR&season=2025&limit=50');
          const fb = await response.json();
          data = (fb.data || []).map(mapPlayerLite);
        }
        
        // Final fallback: Try VORP rankings which we know works
        if (!data.length) {
          response = await fetch('/api/rankings?position=WR&limit=50');
          const vorp = await response.json();
          data = (vorp.players || vorp.data || []).map(mapPlayerLite);
        }
        
        if (alive) setRows(data);
      } catch (e:any) {
        setErr(e?.message || "load failed");
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const id = setTimeout(async () => {
      try {
        if (q.trim().length < 2) return; // keep rankings view
        const response = await fetch(`/api/redraft/players?search=${encodeURIComponent(q)}&pos=WR&limit=50`);
        const res = await response.json();
        setRows((res.data || []).map(mapPlayerLite));
      } catch (e:any) { 
        console.error("search", e); 
      }
    }, 200);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">2025 Redraft WR Rankings</h1>
        <p className="text-gray-600">Top wide receivers for redraft leagues</p>
      </div>
      
      <input
        placeholder="Search WRs (min 2 chars)"
        value={q}
        onChange={(e)=>startTransition(()=>setQ(e.target.value))}
        className="w-full border rounded px-3 py-2 mb-4"
      />
      {isPending && <div className="text-sm opacity-60 mt-1">Searching…</div>}
      {err && <div className="text-red-600 text-sm mt-2">{err}</div>}

      {rows.length === 0 ? (
        <div className="mt-6 opacity-70">No players yet. Try a different query.</div>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((p, idx) => (
            <li key={p.id} className="border rounded p-3 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 text-sm font-medium">
                  {idx + 1}
                </div>
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm opacity-70">{p.team} • {p.pos}</div>
                </div>
              </div>
              <button className="text-blue-600 text-sm hover:underline">View</button>
            </li>
          ))}
        </ul>
      )}

      {import.meta.env.DEV && (
        <div className="text-xs opacity-60 mt-4">
          rows: {rows.length} • q: "{q}"
        </div>
      )}
    </div>
  );
}