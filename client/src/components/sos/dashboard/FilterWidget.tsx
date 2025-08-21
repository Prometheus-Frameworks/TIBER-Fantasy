import { useState, useEffect } from 'react';
import SOSWidget from './SOSWidget';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface FilterWidgetProps {
  id?: number;
  title?: string;
  config?: {
    positions?: string[];
    teams?: string[];
    weekRange?: { start: number; end: number };
  };
  isEditable?: boolean;
  isVisible?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: () => void;
  onFiltersChange?: (filters: any) => void;
}

const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LAC', 'LA', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
];

const POSITIONS = ['QB', 'RB', 'WR', 'TE'];

export default function FilterWidget({
  id,
  title = 'Quick Filters',
  config = {},
  isEditable = false,
  isVisible = true,
  onEdit,
  onDelete,
  onToggleVisibility,
  onFiltersChange
}: FilterWidgetProps) {
  const [selectedPositions, setSelectedPositions] = useState<string[]>(config.positions || ['RB']);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(config.teams || []);
  const [weekStart, setWeekStart] = useState<number>(config.weekRange?.start || 1);
  const [weekEnd, setWeekEnd] = useState<number>(config.weekRange?.end || 5);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    const filters = {
      positions: selectedPositions,
      teams: selectedTeams,
      weekRange: { start: weekStart, end: weekEnd },
      favoritesOnly: showFavoritesOnly
    };
    
    if (onFiltersChange) {
      onFiltersChange(filters);
    }
  }, [selectedPositions, selectedTeams, weekStart, weekEnd, showFavoritesOnly, onFiltersChange]);

  const handlePositionToggle = (position: string) => {
    setSelectedPositions(prev => 
      prev.includes(position) 
        ? prev.filter(p => p !== position)
        : [...prev, position]
    );
  };

  const handleTeamToggle = (team: string) => {
    setSelectedTeams(prev => 
      prev.includes(team) 
        ? prev.filter(t => t !== team)
        : [...prev, team]
    );
  };

  const clearAllFilters = () => {
    setSelectedPositions(['RB']);
    setSelectedTeams([]);
    setWeekStart(1);
    setWeekEnd(5);
    setShowFavoritesOnly(false);
  };

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
        {/* Positions */}
        <div>
          <Label className="text-sm font-medium">Positions</Label>
          <div className="flex gap-2 mt-2">
            {POSITIONS.map(position => (
              <Button
                key={position}
                size="sm"
                variant={selectedPositions.includes(position) ? 'default' : 'outline'}
                onClick={() => handlePositionToggle(position)}
              >
                {position}
              </Button>
            ))}
          </div>
        </div>

        {/* Week Range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium">Week Start</Label>
            <Input
              type="number"
              min={1}
              max={18}
              value={weekStart}
              onChange={(e) => setWeekStart(parseInt(e.target.value) || 1)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Week End</Label>
            <Input
              type="number"
              min={1}
              max={18}
              value={weekEnd}
              onChange={(e) => setWeekEnd(parseInt(e.target.value) || 5)}
              className="mt-1"
            />
          </div>
        </div>

        {/* Teams */}
        <div>
          <Label className="text-sm font-medium">Teams ({selectedTeams.length} selected)</Label>
          <div className="grid grid-cols-8 gap-1 mt-2 max-h-32 overflow-y-auto">
            {NFL_TEAMS.map(team => (
              <Button
                key={team}
                size="sm"
                variant={selectedTeams.includes(team) ? 'default' : 'outline'}
                onClick={() => handleTeamToggle(team)}
                className="text-xs h-8"
              >
                {team}
              </Button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" onClick={clearAllFilters}>
            Clear All
          </Button>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="favorites"
              checked={showFavoritesOnly}
              onCheckedChange={(checked) => setShowFavoritesOnly(checked as boolean)}
            />
            <Label htmlFor="favorites" className="text-sm">Favorites Only</Label>
          </div>
        </div>
      </div>
    </SOSWidget>
  );
}