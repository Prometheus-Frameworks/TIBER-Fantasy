import { useEffect, useState } from 'react';
import SOSWidget from './SOSWidget';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ROSSOSWidgetProps {
  id?: number;
  title?: string;
  config?: {
    positions?: string[];
    teams?: string[];
    weekRange?: { start: number; end: number };
    chartType?: 'bar' | 'table';
    showTiers?: boolean;
  };
  isEditable?: boolean;
  isVisible?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: () => void;
}

type ROSItem = {
  team: string;
  position: string;
  weeks: number[];
  avg_score: number;
  tier: 'green' | 'yellow' | 'red';
};

export default function ROSSOSWidget({
  id,
  title = 'Rest of Season',
  config = {},
  isEditable = false,
  isVisible = true,
  onEdit,
  onDelete,
  onToggleVisibility
}: ROSSOSWidgetProps) {
  const [position, setPosition] = useState<'RB' | 'WR' | 'QB' | 'TE'>(
    config.positions?.[0] as 'RB' | 'WR' | 'QB' | 'TE' || 'RB'
  );
  const [startWeek, setStartWeek] = useState<number>(config.weekRange?.start || 1);
  const [window, setWindow] = useState<number>((config.weekRange?.end || 5) - (config.weekRange?.start || 1) + 1);
  const [items, setItems] = useState<ROSItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sos/ros?position=${position}&startWeek=${startWeek}&window=${window}`)
      .then(r => r.json())
      .then(d => {
        let filteredItems = d.items || [];
        
        // Apply team filter if specified
        if (config.teams && config.teams.length > 0) {
          filteredItems = filteredItems.filter((item: ROSItem) => 
            config.teams!.includes(item.team)
          );
        }
        
        setItems(filteredItems);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [position, startWeek, window, config.teams]);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'green': return '#22c55e';
      case 'yellow': return '#eab308'; 
      case 'red': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const chartData = items.map(item => ({
    team: item.team,
    score: item.avg_score,
    fill: getTierColor(item.tier)
  }));

  return (
    <SOSWidget
      id={id}
      title={title}
      isEditable={isEditable}
      isVisible={isVisible}
      onEdit={onEdit}
      onDelete={onDelete}
      onToggleVisibility={onToggleVisibility}
    >
      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Select value={position} onValueChange={(value) => setPosition(value as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RB">RB</SelectItem>
              <SelectItem value="WR">WR</SelectItem>
              <SelectItem value="QB">QB</SelectItem>
              <SelectItem value="TE">TE</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={startWeek.toString()} onValueChange={(value) => setStartWeek(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 15 }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  Week {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={window.toString()} onValueChange={(value) => setWindow(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 weeks</SelectItem>
              <SelectItem value="4">4 weeks</SelectItem>
              <SelectItem value="5">5 weeks</SelectItem>
              <SelectItem value="6">6 weeks</SelectItem>
              <SelectItem value="8">8 weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : config.chartType === 'bar' ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="team" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="score" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border rounded">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-2">Team</th>
                  <th className="p-2">Avg Score</th>
                  <th className="p-2">Weeks</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 font-medium">{item.team}</td>
                    <td className={`p-2 font-semibold text-center ${
                      item.tier === 'green' ? 'bg-green-100 text-green-900' :
                      item.tier === 'yellow' ? 'bg-yellow-100 text-yellow-900' :
                      'bg-red-100 text-red-900'
                    }`}>
                      {item.avg_score}
                    </td>
                    <td className="p-2 text-sm text-gray-600">
                      {item.weeks.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SOSWidget>
  );
}