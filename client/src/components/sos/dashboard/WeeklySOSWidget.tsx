import { useEffect, useState } from 'react';
import SOSWidget from './SOSWidget';
import SOSTable from '../SOSTable';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WeeklySOSWidgetProps {
  id?: number;
  title?: string;
  config?: {
    positions?: string[];
    teams?: string[];
    showTiers?: boolean;
    sortBy?: 'team' | 'score' | 'tier';
  };
  isEditable?: boolean;
  isVisible?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: () => void;
}

type WeeklyItem = { 
  team: string; 
  position: string; 
  week: number; 
  opponent: string; 
  sos_score: number; 
  tier: 'green' | 'yellow' | 'red' 
};

export default function WeeklySOSWidget({
  id,
  title = 'Weekly Matchups',
  config = {},
  isEditable = false,
  isVisible = true,
  onEdit,
  onDelete,
  onToggleVisibility
}: WeeklySOSWidgetProps) {
  const [position, setPosition] = useState<'RB' | 'WR' | 'QB' | 'TE'>(
    config.positions?.[0] as 'RB' | 'WR' | 'QB' | 'TE' || 'RB'
  );
  const [week, setWeek] = useState<number>(1);
  const [items, setItems] = useState<WeeklyItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sos/weekly?position=${position}&week=${week}`)
      .then(r => r.json())
      .then(d => {
        let filteredItems = d.items || [];
        
        // Apply team filter if specified
        if (config.teams && config.teams.length > 0) {
          filteredItems = filteredItems.filter((item: WeeklyItem) => 
            config.teams!.includes(item.team)
          );
        }
        
        // Apply sorting
        if (config.sortBy === 'score') {
          filteredItems.sort((a: WeeklyItem, b: WeeklyItem) => b.sos_score - a.sos_score);
        } else if (config.sortBy === 'tier') {
          const tierOrder = { green: 3, yellow: 2, red: 1 };
          filteredItems.sort((a: WeeklyItem, b: WeeklyItem) => 
            tierOrder[b.tier] - tierOrder[a.tier]
          );
        } else {
          filteredItems.sort((a: WeeklyItem, b: WeeklyItem) => a.team.localeCompare(b.team));
        }
        
        setItems(filteredItems);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [position, week, config.teams, config.sortBy]);

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
        <div className="flex gap-3">
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
          
          <Select value={week.toString()} onValueChange={(value) => setWeek(parseInt(value))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 18 }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  Week {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <SOSTable items={items} />
        )}
      </div>
    </SOSWidget>
  );
}