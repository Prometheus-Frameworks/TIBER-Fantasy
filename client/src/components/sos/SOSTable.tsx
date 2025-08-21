type Row = {
  team:string;
  opponent:string;
  sos_score:number;
  tier:'green'|'yellow'|'red';
  components?: { FPA: number; EPA: number; PACE: number; RZ: number; VEN: string };
};
type Props = { items: Row[]; debug?: boolean };

export default function SOSTable({items, debug}: Props) {
  const cls = (t:'green'|'yellow'|'red') =>
    t==='green' ? 'bg-green-100 text-green-900' :
    t==='yellow' ? 'bg-yellow-100 text-yellow-900' :
    'bg-red-100 text-red-900';

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
            <td className="p-2 font-medium">{r.team}</td>
            <td className="p-2">{r.opponent}</td>
            <td className={`p-2 font-semibold text-center ${cls(r.tier)}`}>
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