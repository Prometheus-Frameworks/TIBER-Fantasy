import axios from 'axios';

interface SleeperApiComplianceReport {
  api_endpoint: string;
  week: number;
  snap_pct_field_exists: boolean;
  total_players_checked: number;
  available_fields: string[];
  compliance_status: 'FIELD_NOT_AVAILABLE' | 'DATA_EXTRACTED';
}

interface StrictSnapExtractionResult {
  extraction_status: 'FAILED' | 'SUCCESS';
  reason: string;
  compliance_reports: SleeperApiComplianceReport[];
  extracted_data: any[];
  mandatory_prometheus_compliance: {
    snap_pct_field_available: boolean;
    can_complete_extraction: boolean;
    blocking_issue: string | null;
  };
}

export class SleeperStrictSnapService {
  /**
   * PROMETHEUS COMPLIANCE: Strict extraction protocol
   * NO inference, NO substitution, NO guessing
   */
  async extractSnapPercentagesStrict(): Promise<StrictSnapExtractionResult> {
    console.log('🚨 INITIATING PROMETHEUS COMPLIANCE EXTRACTION');
    console.log('Protocol: STRICT - No inference, no substitution, no guessing');
    
    const complianceReports: SleeperApiComplianceReport[] = [];
    const extractedData: any[] = [];
    
    try {
      // Test weeks 1, 5, 10, 15 for comprehensive verification
      const testWeeks = [1, 5, 10, 15];
      
      for (const week of testWeeks) {
        console.log(`🔍 Examining Week ${week} for snap_pct field...`);
        
        const endpoint = `https://api.sleeper.app/v1/stats/nfl/regular/2024/${week}`;
        
        try {
          const response = await axios.get(endpoint, { timeout: 10000 });
          const weekData = response.data;
          
          if (!weekData || typeof weekData !== 'object') {
            console.log(`❌ Week ${week}: Invalid response data`);
            continue;
          }
          
          // Exhaustive search for snap_pct field
          let snapPctFound = false;
          let totalPlayersChecked = 0;
          const allFields = new Set<string>();
          
          for (const [playerId, playerStats] of Object.entries(weekData)) {
            totalPlayersChecked++;
            
            if (playerStats && typeof playerStats === 'object') {
              const stats = playerStats as Record<string, any>;
              
              // Collect all available fields
              Object.keys(stats).forEach(field => allFields.add(field));
              
              // Direct snap_pct field check
              if ('snap_pct' in stats) {
                snapPctFound = true;
                console.log(`✅ SNAP_PCT FOUND: Player ${playerId}, Value: ${stats.snap_pct}`);
                
                // If found, we would extract here (but it won't be found)
                extractedData.push({
                  player_id: playerId,
                  week: week,
                  snap_pct: stats.snap_pct
                });
              }
            }
          }
          
          // Generate compliance report
          const report: SleeperApiComplianceReport = {
            api_endpoint: endpoint,
            week: week,
            snap_pct_field_exists: snapPctFound,
            total_players_checked: totalPlayersChecked,
            available_fields: Array.from(allFields).sort(),
            compliance_status: snapPctFound ? 'DATA_EXTRACTED' : 'FIELD_NOT_AVAILABLE'
          };
          
          complianceReports.push(report);
          
          console.log(`📊 Week ${week}: Checked ${totalPlayersChecked} players, snap_pct found: ${snapPctFound}`);
          
        } catch (error) {
          console.error(`❌ Error accessing Week ${week}:`, error);
        }
        
        // Rate limiting between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Final compliance assessment
      const snapPctAvailable = complianceReports.some(report => report.snap_pct_field_exists);
      
      const result: StrictSnapExtractionResult = {
        extraction_status: snapPctAvailable ? 'SUCCESS' : 'FAILED',
        reason: snapPctAvailable 
          ? 'snap_pct field found and extracted'
          : 'snap_pct field does not exist in Sleeper API',
        compliance_reports: complianceReports,
        extracted_data: extractedData,
        mandatory_prometheus_compliance: {
          snap_pct_field_available: snapPctAvailable,
          can_complete_extraction: snapPctAvailable,
          blocking_issue: snapPctAvailable ? null : 'API_FIELD_NOT_AVAILABLE'
        }
      };
      
      console.log('🚨 PROMETHEUS COMPLIANCE RESULT:');
      console.log(`Field Available: ${snapPctAvailable}`);
      console.log(`Can Complete Extraction: ${snapPctAvailable}`);
      console.log(`Blocking Issue: ${result.mandatory_prometheus_compliance.blocking_issue}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ CRITICAL EXTRACTION ERROR:', error);
      
      return {
        extraction_status: 'FAILED',
        reason: `Critical error during extraction: ${error}`,
        compliance_reports: complianceReports,
        extracted_data: [],
        mandatory_prometheus_compliance: {
          snap_pct_field_available: false,
          can_complete_extraction: false,
          blocking_issue: 'CRITICAL_API_ERROR'
        }
      };
    }
  }

  /**
   * PROMETHEUS COMPLIANCE: Get all available fields for transparency
   */
  async getAvailableFields(week: number = 10): Promise<{
    success: boolean;
    available_fields: string[];
    snap_related_fields: string[];
    total_unique_fields: number;
    sample_endpoint: string;
  }> {
    try {
      console.log(`🔍 Cataloging all available fields from Week ${week}...`);
      
      const endpoint = `https://api.sleeper.app/v1/stats/nfl/regular/2024/${week}`;
      const response = await axios.get(endpoint, { timeout: 10000 });
      
      const allFields = new Set<string>();
      const snapRelatedFields = new Set<string>();
      
      for (const [playerId, playerStats] of Object.entries(response.data || {})) {
        if (playerStats && typeof playerStats === 'object') {
          const stats = playerStats as Record<string, any>;
          
          Object.keys(stats).forEach(field => {
            allFields.add(field);
            
            // Check for snap or percentage related fields
            if (field.toLowerCase().includes('snap') || 
                field.toLowerCase().includes('pct') ||
                field.toLowerCase().includes('percent')) {
              snapRelatedFields.add(field);
            }
          });
        }
      }
      
      const availableFieldsArray = Array.from(allFields).sort();
      const snapRelatedFieldsArray = Array.from(snapRelatedFields).sort();
      
      console.log(`📋 Found ${availableFieldsArray.length} unique fields`);
      console.log(`🎯 Snap-related fields: ${snapRelatedFieldsArray.join(', ')}`);
      
      return {
        success: true,
        available_fields: availableFieldsArray,
        snap_related_fields: snapRelatedFieldsArray,
        total_unique_fields: availableFieldsArray.length,
        sample_endpoint: endpoint
      };
      
    } catch (error) {
      console.error('❌ Error cataloging fields:', error);
      return {
        success: false,
        available_fields: [],
        snap_related_fields: [],
        total_unique_fields: 0,
        sample_endpoint: `https://api.sleeper.app/v1/stats/nfl/regular/2024/${week}`
      };
    }
  }

  /**
   * PROMETHEUS COMPLIANCE: Document why extraction cannot be completed
   */
  async generateComplianceReport(): Promise<{
    timestamp: string;
    protocol: string;
    api_source: string;
    field_requested: string;
    field_available: boolean;
    extraction_possible: boolean;
    blocking_reason: string;
    alternative_fields: string[];
    compliance_status: string;
  }> {
    console.log('📋 Generating Prometheus compliance report...');
    
    const extractionResult = await this.extractSnapPercentagesStrict();
    const fieldsInfo = await this.getAvailableFields();
    
    return {
      timestamp: new Date().toISOString(),
      protocol: 'TIBER_SLEEPER_SNAP_EXTRACTION_STRICT',
      api_source: 'https://api.sleeper.app/v1/stats/nfl/regular/2024/{week}',
      field_requested: 'snap_pct',
      field_available: extractionResult.mandatory_prometheus_compliance.snap_pct_field_available,
      extraction_possible: extractionResult.mandatory_prometheus_compliance.can_complete_extraction,
      blocking_reason: extractionResult.mandatory_prometheus_compliance.blocking_issue || 'None',
      alternative_fields: fieldsInfo.snap_related_fields,
      compliance_status: extractionResult.extraction_status === 'SUCCESS' ? 'COMPLIANT' : 'NON_COMPLIANT_API_LIMITATION'
    };
  }
}

export const sleeperStrictSnapService = new SleeperStrictSnapService();