import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Settings, Save, RotateCcw } from 'lucide-react';
import WeeklySOSWidget from '../components/sos/dashboard/WeeklySOSWidget';
import ROSSOSWidget from '../components/sos/dashboard/ROSSOSWidget';
import FilterWidget from '../components/sos/dashboard/FilterWidget';

interface Dashboard {
  id: number;
  name: string;
  isDefault: boolean;
  config: any;
  widgets: Widget[];
}

interface Widget {
  id: number;
  dashboardId: number;
  widgetType: string;
  position: { x: number; y: number; w: number; h: number };
  config: any;
  isVisible: boolean;
}

export default function SOSDashboardPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [globalFilters, setGlobalFilters] = useState<any>({});

  useEffect(() => {
    loadDashboards();
  }, []);

  const loadDashboards = async () => {
    try {
      const response = await fetch('/api/sos/dashboard/dashboards');
      const data = await response.json();
      setDashboards(data.dashboards);
      
      if (data.dashboards.length > 0) {
        const defaultDashboard = data.dashboards.find((d: Dashboard) => d.isDefault) || data.dashboards[0];
        setActiveDashboard(defaultDashboard);
      }
    } catch (error) {
      console.error('Failed to load dashboards:', error);
    } finally {
      setLoading(false);
    }
  };

  const addWidget = async (type: string) => {
    if (!activeDashboard) return;
    
    const defaultConfigs = {
      weekly: { positions: ['RB'], showTiers: true, chartType: 'table' },
      ros: { positions: ['RB'], weekRange: { start: 1, end: 5 }, chartType: 'bar' },
      filter: {}
    };

    const position = { 
      x: 0, 
      y: activeDashboard.widgets.length * 2, 
      w: type === 'filter' ? 12 : 6, 
      h: type === 'filter' ? 2 : 4 
    };

    try {
      const response = await fetch('/api/sos/dashboard/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboardId: activeDashboard.id,
          widgetType: type,
          position,
          config: defaultConfigs[type as keyof typeof defaultConfigs] || {}
        })
      });

      if (response.ok) {
        loadDashboards(); // Refresh dashboard data
      }
    } catch (error) {
      console.error('Failed to add widget:', error);
    }
  };

  const deleteWidget = async (widgetId: number) => {
    try {
      const response = await fetch(`/api/sos/dashboard/widgets/${widgetId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadDashboards(); // Refresh dashboard data
      }
    } catch (error) {
      console.error('Failed to delete widget:', error);
    }
  };

  const toggleWidgetVisibility = async (widgetId: number, isVisible: boolean) => {
    try {
      const response = await fetch(`/api/sos/dashboard/widgets/${widgetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible: !isVisible })
      });

      if (response.ok) {
        loadDashboards(); // Refresh dashboard data
      }
    } catch (error) {
      console.error('Failed to toggle widget visibility:', error);
    }
  };

  const renderWidget = (widget: Widget) => {
    const baseProps = {
      id: widget.id,
      config: widget.config,
      isEditable: isEditing,
      isVisible: widget.isVisible,
      onDelete: () => deleteWidget(widget.id),
      onToggleVisibility: () => toggleWidgetVisibility(widget.id, widget.isVisible)
    };

    switch (widget.widgetType) {
      case 'weekly':
        return <WeeklySOSWidget key={widget.id} {...baseProps} />;
      case 'ros':
        return <ROSSOSWidget key={widget.id} {...baseProps} />;
      case 'filter':
        return (
          <FilterWidget 
            key={widget.id} 
            {...baseProps} 
            onFiltersChange={setGlobalFilters}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            SOS Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Customize your strength of schedule analysis
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Settings className="w-4 h-4 mr-2" />
            {isEditing ? 'Done Editing' : 'Edit Layout'}
          </Button>
        </div>
      </div>

      {/* Dashboard Selector */}
      {dashboards.length > 1 && (
        <div className="mb-6">
          <div className="flex gap-2">
            {dashboards.map(dashboard => (
              <Button
                key={dashboard.id}
                variant={activeDashboard?.id === dashboard.id ? 'default' : 'outline'}
                onClick={() => setActiveDashboard(dashboard)}
              >
                {dashboard.name}
                {dashboard.isDefault && ' (Default)'}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Add Widget Controls */}
      {isEditing && (
        <Card className="p-4 mb-6">
          <h3 className="font-medium mb-3">Add Widget</h3>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addWidget('weekly')}>
              <Plus className="w-4 h-4 mr-2" />
              Weekly Matchups
            </Button>
            <Button size="sm" onClick={() => addWidget('ros')}>
              <Plus className="w-4 h-4 mr-2" />
              Rest of Season
            </Button>
            <Button size="sm" onClick={() => addWidget('filter')}>
              <Plus className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
        </Card>
      )}

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeDashboard?.widgets
          .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
          .map(renderWidget)}
      </div>

      {/* Empty State */}
      {activeDashboard && activeDashboard.widgets.length === 0 && (
        <Card className="p-8 text-center">
          <h3 className="text-lg font-medium mb-2">No widgets yet</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Add some widgets to start building your custom SOS dashboard
          </p>
          <Button onClick={() => setIsEditing(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Start Editing
          </Button>
        </Card>
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-slate-500">
        <a 
          href="/docs/SOS-how-it-works.md" 
          target="_blank"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          📖 Learn how SOS scoring works
        </a>
      </div>
    </div>
  );
}