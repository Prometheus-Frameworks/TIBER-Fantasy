import React from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList
} from "recharts";
import { tierColor } from "../lib/sosColors";
import { TeamLogo } from "./TeamLogo";

type Item = {
  team: string;
  opponent: string;
  sos_score: number; // final score 0-100
};

type Props = { items: Item[]; limit?: number };

export const SOSBarChart: React.FC<Props> = ({ items, limit = 16 }) => {
  const data = [...items]
    .sort((a, b) => b.sos_score - a.sos_score)
    .slice(0, limit)
    .map((d) => ({
      ...d,
      colorClass: tierColor(d.sos_score),
    }));

  // Inline color mapping via CSS classes is tricky in Recharts, so we'll use a single series
  // and style the bars via a function fallback on fill (CSS variables).
  return (
    <div className="w-full h-[520px]">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="team" />
          <YAxis domain={[0, 100]} />
          <Tooltip
            formatter={(val: any, _name, entry: any) => [`${val}`, `Score`]}
            labelFormatter={(team) => {
              const row = data.find((d) => d.team === team);
              return row ? `${row.team} vs ${row.opponent}` : `${team}`;
            }}
          />
          <Bar dataKey="sos_score" isAnimationActive fill="#8884d8">
            <LabelList dataKey="sos_score" position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend with logos (top N) */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        {data.map((d) => (
          <div key={d.team} className={`flex items-center gap-2 px-2 py-1 rounded border ${d.colorClass}`}>
            <TeamLogo team={d.team} size={18} />
            <div className="text-sm">{d.team} vs {d.opponent}</div>
            <div className="ml-auto font-semibold">{Math.round(d.sos_score)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};