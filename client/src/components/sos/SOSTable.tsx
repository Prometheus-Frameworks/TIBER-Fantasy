import { TeamLogo } from "../TeamLogo";
import { tierColor } from "../../lib/sosColors";

type Row = {
  team:string;
  opponent:string;
  sos_score:number;
  tier:'green'|'yellow'|'red';
  components?: { FPA: number; EPA: number; PACE: number; RZ: number; VEN: string };
};
type Props = { items: Row[]; debug?: boolean };

export default function SOSTable({items, debug}: Props) {
  const cls = (score: number) => tierColor(score);

  return (
    <table className="w-full border rounded overflow-hidden">
      <thead>
        <tr className="bg-gray-50 text-left">
          <th className="p-2">Team</th>
          <th className="p-2">Opponent</th>
          <th className="p-2">Ease</th>
        </tr>
      </thead>
      <tbody>
        {items.map((r,i)=>(
          <tr key={i} className="border-t">
            <td className="p-2 font-medium">
              <div className="flex items-center gap-2">
                <TeamLogo team={r.team} size={20} />
                <span>{r.team}</span>
              </div>
            </td>
            <td className="p-2">
              <div className="flex items-center gap-2">
                <TeamLogo team={r.opponent} size={18} />
                <span>{r.opponent}</span>
              </div>
            </td>
            <td className={`p-2 font-semibold text-center ${cls(r.sos_score)}`}>
              {r.sos_score}
              {debug && r.components && (
                <div className="text-xs text-gray-600 mt-1">
                  FPA {r.components.FPA} | EPA {r.components.EPA} | Pace {r.components.PACE} | RZ {r.components.RZ} | Ven {r.components.VEN}
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}