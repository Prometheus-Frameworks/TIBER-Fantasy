import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Play, RotateCcw } from 'lucide-react';

export default function LiveTierTraining() {
  const [pushResults, setPushResults] = useState<Record<string, 'success' | 'failed' | null>>({
    'qb-elite': null,
    'qb-tier2': null,
    'wr-elite': null,
    'rb-elite': null
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'complete'>('idle');

  const executePush = async (tierId: string, tierData: any) => {
    try {
      const response = await fetch('/api/consensus/push-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId,
          players: tierData.players,
          tier: tierData.tier,
          format: tierData.format
        })
      });

      if (response.ok) {
        setPushResults(prev => ({ ...prev, [tierId]: 'success' }));
        return true;
      } else {
        setPushResults(prev => ({ ...prev, [tierId]: 'failed' }));
        return false;
      }
    } catch (error) {
      console.error(`Push failed for ${tierId}:`, error);
      setPushResults(prev => ({ ...prev, [tierId]: 'failed' }));
      return false;
    }
  };

  const runFullTest = async () => {
    setTestStatus('running');
    setPushResults({
      'qb-elite': null,
      'qb-tier2': null,
      'wr-elite': null,
      'rb-elite': null
    });

    // QB Elite Tier Test
    await executePush('qb-elite', {
      tier: '1',
      format: 'redraft',
      players: [
        { playerId: 'josh-allen', rank: 1, score: 95 },
        { playerId: 'lamar-jackson', rank: 2, score: 93.5 },
        { playerId: 'patrick-mahomes', rank: 3, score: 92.8 }
      ]
    });

    // QB Tier 2 Test  
    await executePush('qb-tier2', {
      tier: '2B',
      format: 'redraft',
      players: [
        { playerId: 'jalen-hurts', rank: 4, score: 91.2 },
        { playerId: 'jayden-daniels', rank: 5, score: 90.8 },
        { playerId: 'joe-burrow', rank: 6, score: 90.5 }
      ]
    });

    setTestStatus('complete');
  };

  const resetTest = () => {
    setTestStatus('idle');
    setPushResults({
      'qb-elite': null,
      'qb-tier2': null,
      'wr-elite': null,
      'rb-elite': null
    });
  };

  const qbTier2Debate = {
    rushingCeiling: [
      { name: 'Jalen Hurts', reason: 'rush push, elite weapons' },
      { name: 'Jayden Daniels', reason: 'QB5 rookie finish' }
    ],
    passingElite: [
      { name: 'Joe Burrow', reason: 'Chase/Higgins ceiling' },
      { name: 'Patrick Mahomes', reason: 'historic arm talent' }
    ]
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 mb-4">
          🚨 2025 QB Redraft Elite Tier
        </Badge>
        <h1 className="text-3xl font-bold">Live Tier Training - Redraft 2025</h1>
        <p className="text-gray-600">Real-time consensus tier management and validation</p>
      </div>

      {/* Push Status Alerts */}
      <div className="space-y-2">
        {pushResults['qb-tier2'] === 'failed' && (
          <Alert className="border-red-200 bg-red-50">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              <strong>PUSH FAILED</strong> - Could not execute green light for QB Tier 2B. 
              <br />
              <small className="text-red-600">Lamar's championship correlation games</small>
            </AlertDescription>
          </Alert>
        )}

        {pushResults['qb-elite'] === 'success' && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              <strong>GREEN LIGHT: Push QB Elite Tier Live</strong>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* QB Tier 2 Debate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            QB Tier 2 Debate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600">
            <strong>Option A: Rushing + Ceiling QBs</strong>
            <ul className="mt-2 space-y-1 ml-4">
              {qbTier2Debate.rushingCeiling.map((qb, i) => (
                <li key={i}>• {qb.name} ({qb.reason})</li>
              ))}
            </ul>
          </div>

          <div className="text-sm text-gray-600">
            <strong>Option B: Pure Passing Elite</strong>
            <ul className="mt-2 space-y-1 ml-4">
              {qbTier2Debate.passingElite.map((qb, i) => (
                <li key={i}>• {qb.name} ({qb.reason})</li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              variant="default" 
              className="bg-purple-600 hover:bg-purple-700"
              size="sm"
            >
              Rushing + Ceiling
            </Button>
            <Button 
              variant="default" 
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              Passing Elite
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Tier Push Testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={runFullTest}
              disabled={testStatus === 'running'}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {testStatus === 'running' ? 'Running Tests...' : 'Run Tier Push Test'}
            </Button>
            
            <Button 
              variant="outline"
              onClick={resetTest}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
          </div>

          {/* Test Results Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(pushResults).map(([tierId, status]) => (
              <div key={tierId} className="flex items-center gap-2 p-2 border rounded">
                {status === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                {status === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
                {status === null && <div className="w-4 h-4 bg-gray-300 rounded-full" />}
                <span className="capitalize">{tierId.replace('-', ' ')}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}