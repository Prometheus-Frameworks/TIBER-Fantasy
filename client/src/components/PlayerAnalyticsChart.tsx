/**
 * Interactive Player Analytics Charts
 * Shows performance trends, target share evolution, and dynasty value progression
 */

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
} from 'chart.js';
import { Line, Bar, Radar } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale
);

interface PlayerAnalyticsChartProps {
  playerId: string;
  playerName: string;
  position: string;
}

export default function PlayerAnalyticsChart({ playerId, playerName, position }: PlayerAnalyticsChartProps) {
  
  // Fantasy Points Progression (Weekly)
  const fantasyPointsData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8', 'Week 9', 'Week 10'],
    datasets: [
      {
        label: 'Fantasy Points (PPR)',
        data: generateWeeklyPoints(position),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Projected Points',
        data: generateProjectedPoints(position),
        borderColor: 'rgb(156, 163, 175)',
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        borderDash: [5, 5],
        fill: false,
      }
    ],
  };

  // Target Share Evolution (for WR/TE/RB)
  const targetShareData = {
    labels: ['Week 1-4', 'Week 5-8', 'Week 9-12', 'Week 13-16', 'Week 17+'],
    datasets: [
      {
        label: 'Target Share %',
        data: generateTargetShare(position),
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2,
      }
    ],
  };

  // Dynasty Value Radar Chart
  const dynastyRadarData = {
    labels: ['Production', 'Opportunity', 'Age', 'Efficiency', 'Stability'],
    datasets: [
      {
        label: playerName,
        data: generateDynastyMetrics(position),
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        borderColor: 'rgb(168, 85, 247)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(168, 85, 247)',
      }
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      r: {
        angleLines: {
          display: false
        },
        suggestedMin: 0,
        suggestedMax: 100,
        pointLabels: {
          font: {
            size: 12
          }
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Performance Trends</TabsTrigger>
          <TabsTrigger value="opportunity">Target/Touch Share</TabsTrigger>
          <TabsTrigger value="dynasty">Dynasty Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Fantasy Points Progression</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Line data={fantasyPointsData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opportunity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {position === 'QB' ? 'Passing Attempts Share' : 
                 position === 'RB' ? 'Touch Share Evolution' : 'Target Share Evolution'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Bar data={targetShareData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dynasty" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dynasty Value Component Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Radar data={dynastyRadarData} options={radarOptions} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper functions to generate realistic data based on position
function generateWeeklyPoints(position: string): number[] {
  const basePoints = {
    QB: 20,
    RB: 12,
    WR: 10,
    TE: 8
  };

  const base = basePoints[position as keyof typeof basePoints] || 10;
  return Array.from({ length: 10 }, (_, i) => {
    const variance = (Math.random() - 0.5) * base * 0.6;
    const trend = position === 'QB' ? i * 0.5 : i * 0.3; // QBs improve more over season
    return Math.max(0, base + variance + trend);
  });
}

function generateProjectedPoints(position: string): number[] {
  const basePoints = {
    QB: 22,
    RB: 13,
    WR: 11,
    TE: 9
  };

  const base = basePoints[position as keyof typeof basePoints] || 11;
  return Array.from({ length: 10 }, () => base + (Math.random() - 0.5) * 3);
}

function generateTargetShare(position: string): number[] {
  if (position === 'QB') {
    return [62, 65, 68, 70, 72]; // Passing attempt share
  }
  
  const baseShare = {
    RB: 15,
    WR: 20,
    TE: 12
  };

  const base = baseShare[position as keyof typeof baseShare] || 15;
  return Array.from({ length: 5 }, (_, i) => {
    const progression = i * 2; // Increasing share over season
    return base + progression + (Math.random() - 0.5) * 4;
  });
}

function generateDynastyMetrics(position: string): number[] {
  // Generate realistic dynasty component scores based on position
  const baseMetrics = {
    QB: [85, 75, 80, 70, 85], // QBs score high on production and stability
    RB: [70, 85, 60, 75, 65], // RBs score high on opportunity, lower on age
    WR: [75, 70, 75, 80, 70], // WRs balance across categories
    TE: [65, 60, 85, 75, 80]  // TEs score high on age/stability
  };

  const base = baseMetrics[position as keyof typeof baseMetrics] || [70, 70, 70, 70, 70];
  return base.map(score => score + (Math.random() - 0.5) * 20);
}