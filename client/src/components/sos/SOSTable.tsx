type Props = { items: {team:string;opponent:string;sos_score:number;tier:'green'|'yellow'|'red'}[] };

export default function SOSTable({items}: Props) {
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
            <td className={`p-2 font-semibold text-center ${cls(r.tier)}`}>{r.sos_score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}