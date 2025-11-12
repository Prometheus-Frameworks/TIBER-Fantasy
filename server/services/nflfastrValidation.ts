import { spawn } from 'child_process';
import * as path from 'path';
import jargonMapping from '../data/nflfastr_jargon_mapping.json';

interface ValidationRequest {
  jargon_term: string;
  player_id?: string;
  player_name?: string;
  team?: string;
  season?: number;
}

interface ValidationResult {
  metric: string;
  value: number | Record<string, number> | null;
  queryable: boolean;
  data_as_of: string;
  calculation_used: string;
  sample_size?: number;
  error?: string;
}

/**
 * Validates observation metrics against live NFLfastR data
 */
export async function validateMetric(request: ValidationRequest): Promise<ValidationResult> {
  const mapping = jargonMapping[request.jargon_term as keyof typeof jargonMapping];
  
  if (!mapping) {
    throw new Error(`Unknown jargon term: ${request.jargon_term}`);
  }
  
  if (!mapping.queryable) {
    return {
      metric: request.jargon_term,
      value: null,
      queryable: false,
      data_as_of: new Date().toISOString(),
      calculation_used: mapping.description
    };
  }
  
  const season = request.season || 2025;
  const identifier = request.player_name || request.team;
  
  if (!identifier) {
    throw new Error('player_name or team required for queryable metrics');
  }

  const pythonScriptPath = path.join(__dirname, '../python/query_nflfastr.py');
  
  const pythonResult = await executePythonQuery(
    pythonScriptPath,
    request.jargon_term,
    identifier,
    season
  );
  
  const calculationUsed = 'calculation' in mapping ? mapping.calculation : mapping.description;
  
  // Handle null result (no data available for player/team)
  if (pythonResult === null || pythonResult === undefined) {
    return {
      metric: request.jargon_term,
      value: null,
      queryable: true,
      data_as_of: new Date().toISOString(),
      calculation_used: calculationUsed,
      error: 'No data available for this player/team in the specified season'
    };
  }
  
  // Handle error result
  if (pythonResult.error) {
    return {
      metric: request.jargon_term,
      value: null,
      queryable: true,
      data_as_of: new Date().toISOString(),
      calculation_used: calculationUsed,
      error: pythonResult.error
    };
  }
  
  return {
    metric: request.jargon_term,
    value: pythonResult.value,
    queryable: true,
    data_as_of: new Date().toISOString(),
    calculation_used: calculationUsed,
    sample_size: pythonResult.sample_size
  };
}

/**
 * Executes Python NFLfastR query and returns parsed result
 */
async function executePythonQuery(
  scriptPath: string,
  metric: string,
  identifier: string,
  season: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [scriptPath, metric, identifier, season.toString()]);
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });
    
    python.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

/**
 * Enriches pattern chunks with live data when queryable metrics present
 */
export async function enrichChunkWithLiveData(chunk: any, playerId?: string, playerName?: string): Promise<any> {
  const queryableMetrics = chunk.metadata?.metrics_used?.filter((m: any) => m.queryable) || [];
  
  if (queryableMetrics.length === 0) {
    return chunk;
  }

  console.log(`🔍 [NFLfastR] Enriching chunk with ${queryableMetrics.length} queryable metrics...`);
  
  const liveDataResults = await Promise.allSettled(
    queryableMetrics.map((metric: any) => 
      validateMetric({
        jargon_term: metric.jargon_term,
        player_id: playerId || chunk.metadata.player_id,
        player_name: playerName || chunk.metadata.player_example,
        team: chunk.metadata.team,
        season: 2025
      }).catch(err => {
        console.warn(`⚠️  [NFLfastR] Failed to validate ${metric.jargon_term}:`, err.message);
        return null;
      })
    )
  );

  const liveData = liveDataResults
    .filter((result): result is PromiseFulfilledResult<ValidationResult> => 
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value);
  
  console.log(`✅ [NFLfastR] Enriched with ${liveData.length} live metrics`);
  
  return {
    ...chunk,
    live_data: liveData
  };
}
