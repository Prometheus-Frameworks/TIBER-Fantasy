/**
 * Team Analytics Data Loader
 * 
 * Imports team analytics data from screenshot_data_bank.json into PostgreSQL
 * Maps 10 screenshot datasets into 4 database tables:
 * - team_offensive_context: EPA, explosive plays, blocking, passing efficiency
 * - team_defensive_context: EPA allowed, explosive plays allowed, pass rush
 * - team_receiver_alignment_matchups: FPG by alignment (outside WR, slot, TE)
 * - team_coverage_matchups: FPG by coverage type (zone, man, 2-high, 1-high)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../../infra/db';
import { sql } from 'drizzle-orm';
import {
  teamOffensiveContext,
  teamDefensiveContext,
  teamReceiverAlignmentMatchups,
  teamCoverageMatchups,
} from '../../../shared/schema';

interface ScreenshotData {
  collection_date: string;
  total_screenshots: number;
  received_count: number;
  purpose: string;
  screenshots: {
    [key: string]: {
      name: string;
      description: string;
      data_type: string;
      fields: string[];
      raw_data: string;
    };
  };
}

/**
 * Parse CSV data from screenshot raw_data field
 */
function parseCSV(rawData: string): Array<Record<string, string>> {
  const lines = rawData.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    
    return row;
  });
}

/**
 * Convert percentage string to decimal (e.g., "45.9%" -> 0.459)
 */
function percentToDecimal(value: string): number | null {
  if (!value || value === '' || value === 'N/A') return null;
  const cleaned = value.replace('%', '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num / 100;
}

/**
 * Convert string to number, handling empty/invalid values
 */
function toNumber(value: string): number | null {
  if (!value || value === '' || value === 'N/A') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Load team offensive and defensive context from screenshots 1-8
 */
async function loadTeamContext() {
  console.log('📊 Loading team offensive and defensive context data...');
  
  const dataPath = join(process.cwd(), 'server', 'data', 'screenshot_data_bank.json');
  const screenshotData: ScreenshotData = JSON.parse(readFileSync(dataPath, 'utf-8'));
  
  // Data structures to accumulate team context data
  const offensiveData: Map<string, any> = new Map();
  const defensiveData: Map<string, any> = new Map();
  
  // Screenshot 1: Passing EPA
  const passingEPA = parseCSV(screenshotData.screenshots.screenshot_1.raw_data);
  passingEPA.forEach(row => {
    const offTeam = row['Offense'];
    const defTeam = row['Defense'];
    
    if (offTeam) {
      if (!offensiveData.has(offTeam)) {
        offensiveData.set(offTeam, { team: offTeam });
      }
      const data = offensiveData.get(offTeam);
      data.pass_epa = toNumber(row['OFF_EPA_per_DB']);
    }
    
    if (defTeam) {
      if (!defensiveData.has(defTeam)) {
        defensiveData.set(defTeam, { team: defTeam });
      }
      const data = defensiveData.get(defTeam);
      data.pass_epa_allowed = toNumber(row['DEF_DB_EPA']);
    }
  });
  
  // Screenshot 2: Rushing EPA
  const rushingEPA = parseCSV(screenshotData.screenshots.screenshot_2.raw_data);
  rushingEPA.forEach(row => {
    const offTeam = row['Offense'];
    const defTeam = row['Defense'];
    
    if (offTeam) {
      if (!offensiveData.has(offTeam)) {
        offensiveData.set(offTeam, { team: offTeam });
      }
      offensiveData.get(offTeam).rush_epa = toNumber(row['OFF_Rush_EPA']);
    }
    
    if (defTeam) {
      if (!defensiveData.has(defTeam)) {
        defensiveData.set(defTeam, { team: defTeam });
      }
      defensiveData.get(defTeam).rush_epa_allowed = toNumber(row['DEF_Rush_EPA']);
    }
  });
  
  // Screenshot 3: Explosive plays
  const explosivePlays = parseCSV(screenshotData.screenshots.screenshot_3.raw_data);
  explosivePlays.forEach(row => {
    const offTeam = row['Offense'];
    const defTeam = row['Defense'];
    
    if (offTeam) {
      if (!offensiveData.has(offTeam)) {
        offensiveData.set(offTeam, { team: offTeam });
      }
      const data = offensiveData.get(offTeam);
      const passExp = percentToDecimal(row['Off_Exp_Pass_%']);
      const runExp = percentToDecimal(row['Off_Exp_Run_%']);
      // Count explosive plays (combining pass + run, normalized to integer count estimate)
      data.explosive_20_plus = passExp && runExp ? Math.round((passExp + runExp) * 100) : null;
    }
    
    if (defTeam) {
      if (!defensiveData.has(defTeam)) {
        defensiveData.set(defTeam, { team: defTeam });
      }
      const data = defensiveData.get(defTeam);
      const passExp = percentToDecimal(row['Def_Exp_Pass_%']);
      const runExp = percentToDecimal(row['Def_Exp_Run_%']);
      data.explosive_20_plus_allowed = passExp && runExp ? Math.round((passExp + runExp) * 100) : null;
    }
  });
  
  // Screenshot 4: Run blocking (YBC)
  const runBlocking = parseCSV(screenshotData.screenshots.screenshot_4.raw_data);
  runBlocking.forEach(row => {
    const offTeam = row['Offense'];
    const defTeam = row['Defense'];
    
    if (offTeam) {
      if (!offensiveData.has(offTeam)) {
        offensiveData.set(offTeam, { team: offTeam });
      }
      offensiveData.get(offTeam).ybc_per_att = toNumber(row['OFF_YBCo_ATT']);
    }
    
    if (defTeam) {
      if (!defensiveData.has(defTeam)) {
        defensiveData.set(defTeam, { team: defTeam });
      }
      defensiveData.get(defTeam).ybc_per_att_allowed = toNumber(row['DEF_YBCo_ATT']);
    }
  });
  
  // Screenshot 5: Gap rushing
  const gapRushing = parseCSV(screenshotData.screenshots.screenshot_5.raw_data);
  gapRushing.forEach(row => {
    const offTeam = row['Offense'];
    const defTeam = row['Defense'];
    
    if (offTeam) {
      if (!offensiveData.has(offTeam)) {
        offensiveData.set(offTeam, { team: offTeam });
      }
      const data = offensiveData.get(offTeam);
      data.gap_run_pct = percentToDecimal(row['OFF_MG_ATT_pct']);
      data.run_success_rate = percentToDecimal(row['OFF_GAP_SR']);
    }
    
    if (defTeam) {
      if (!defensiveData.has(defTeam)) {
        defensiveData.set(defTeam, { team: defTeam });
      }
      defensiveData.get(defTeam).gap_run_success_rate = percentToDecimal(row['DEF_GAP_SR']);
    }
  });
  
  // Screenshot 6: Zone rushing
  const zoneRushing = parseCSV(screenshotData.screenshots.screenshot_6.raw_data);
  zoneRushing.forEach(row => {
    const offTeam = row['Offense'];
    const defTeam = row['Defense'];
    
    if (offTeam) {
      if (!offensiveData.has(offTeam)) {
        offensiveData.set(offTeam, { team: offTeam });
      }
      offensiveData.get(offTeam).zone_run_pct = percentToDecimal(row['OFF_ZONE_ATT_pct']);
    }
    
    if (defTeam) {
      if (!defensiveData.has(defTeam)) {
        defensiveData.set(defTeam, { team: defTeam });
      }
      defensiveData.get(defTeam).zone_run_success_rate = percentToDecimal(row['DEF_ZONE_SR']);
    }
  });
  
  // Screenshot 7: Pass protection/rush
  const passProtection = parseCSV(screenshotData.screenshots.screenshot_7.raw_data);
  passProtection.forEach(row => {
    const offTeam = row['Offense'];
    const defTeam = row['Defense'];
    
    if (offTeam) {
      if (!offensiveData.has(offTeam)) {
        offensiveData.set(offTeam, { team: offTeam });
      }
      offensiveData.get(offTeam).pressure_rate_allowed = percentToDecimal(row['OFF_Press_Rate_Allowed']);
    }
    
    if (defTeam) {
      if (!defensiveData.has(defTeam)) {
        defensiveData.set(defTeam, { team: defTeam });
      }
      defensiveData.get(defTeam).pressure_rate_generated = percentToDecimal(row['DEF_Pressure_Rate']);
    }
  });
  
  // Screenshot 8: Passing efficiency (YPA, CPOE)
  const passingEfficiency = parseCSV(screenshotData.screenshots.screenshot_8.raw_data);
  passingEfficiency.forEach(row => {
    const offTeam = row['Offense'];
    const defTeam = row['Defense'];
    
    if (offTeam) {
      if (!offensiveData.has(offTeam)) {
        offensiveData.set(offTeam, { team: offTeam });
      }
      const data = offensiveData.get(offTeam);
      data.ypa = toNumber(row['YPA']);
      data.cpoe = percentToDecimal(row['CPOE']);
    }
    
    if (defTeam) {
      if (!defensiveData.has(defTeam)) {
        defensiveData.set(defTeam, { team: defTeam });
      }
      const data = defensiveData.get(defTeam);
      data.ypa_allowed = toNumber(row['YPA_Allowed']);
      data.cpoe_allowed = percentToDecimal(row['CPOE_Allowed']);
    }
  });
  
  // Insert offensive context data (using camelCase keys for Drizzle)
  const offensiveRecords = Array.from(offensiveData.values()).map(data => ({
    season: 2024,
    week: 4, // Week 4 data from screenshots
    team: data.team,
    passEpa: data.pass_epa,
    rushEpa: data.rush_epa,
    explosive20Plus: data.explosive_20_plus,
    ypa: data.ypa,
    cpoe: data.cpoe,
    ybcPerAtt: data.ybc_per_att,
    gapRunPct: data.gap_run_pct,
    zoneRunPct: data.zone_run_pct,
    runSuccessRate: data.run_success_rate,
    pressureRateAllowed: data.pressure_rate_allowed,
  }));
  
  
  // Insert defensive context data (using camelCase keys for Drizzle)
  const defensiveRecords = Array.from(defensiveData.values()).map(data => ({
    season: 2024,
    week: 4,
    team: data.team,
    passEpaAllowed: data.pass_epa_allowed,
    rushEpaAllowed: data.rush_epa_allowed,
    explosive20PlusAllowed: data.explosive_20_plus_allowed,
    ypaAllowed: data.ypa_allowed,
    cpoeAllowed: data.cpoe_allowed,
    ybcPerAttAllowed: data.ybc_per_att_allowed,
    gapRunSuccessRate: data.gap_run_success_rate,
    zoneRunSuccessRate: data.zone_run_success_rate,
    pressureRateGenerated: data.pressure_rate_generated,
  }));
  
  // Delete existing data for this season/week and do fresh inserts
  await db.delete(teamOffensiveContext)
    .where(sql`season = 2024 AND week = 4`);
  
  await db.delete(teamDefensiveContext)
    .where(sql`season = 2024 AND week = 4`);
  
  // Batch insert all records
  if (offensiveRecords.length > 0) {
    await db.insert(teamOffensiveContext).values(offensiveRecords);
  }
  
  if (defensiveRecords.length > 0) {
    await db.insert(teamDefensiveContext).values(defensiveRecords);
  }
  
  console.log(`✅ Loaded ${offensiveRecords.length} offensive context records`);
  console.log(`✅ Loaded ${defensiveRecords.length} defensive context records`);
}

/**
 * Load receiver alignment matchups from screenshot 9
 */
async function loadReceiverAlignmentMatchups() {
  console.log('📊 Loading receiver alignment matchup data...');
  
  const dataPath = join(process.cwd(), 'server', 'data', 'screenshot_data_bank.json');
  const screenshotData: ScreenshotData = JSON.parse(readFileSync(dataPath, 'utf-8'));
  
  const alignmentData = parseCSV(screenshotData.screenshots.screenshot_9.raw_data);
  
  // Accumulate data by team (each CSV row has offense AND defense teams)
  const teamData: Map<string, any> = new Map();
  
  alignmentData.forEach(row => {
    const offTeam = row['Offense'];
    const defTeam = row['Defense'];
    
    // Add offensive metrics for offense team
    if (offTeam) {
      if (!teamData.has(offTeam)) {
        teamData.set(offTeam, { team: offTeam });
      }
      const data = teamData.get(offTeam);
      data.offOutsideWrFpg = toNumber(row['OFF_OutWide_FPG']);
      data.offSlotFpg = toNumber(row['OFF_Slot_FPG']);
      data.offTeFpg = toNumber(row['OFF_TE_FPG']);
    }
    
    // Add defensive metrics for defense team
    if (defTeam) {
      if (!teamData.has(defTeam)) {
        teamData.set(defTeam, { team: defTeam });
      }
      const data = teamData.get(defTeam);
      data.defOutsideWrFpgAllowed = toNumber(row['DEF_OutWide_FPG']);
      data.defSlotFpgAllowed = toNumber(row['DEF_Slot_FPG']);
      data.defTeFpgAllowed = toNumber(row['DEF_TE_FPG']);
    }
  });
  
  // Convert to records array
  const records = Array.from(teamData.values()).map(data => ({
    season: 2024,
    week: 4,
    team: data.team,
    offOutsideWrFpg: data.offOutsideWrFpg,
    offSlotFpg: data.offSlotFpg,
    offTeFpg: data.offTeFpg,
    defOutsideWrFpgAllowed: data.defOutsideWrFpgAllowed,
    defSlotFpgAllowed: data.defSlotFpgAllowed,
    defTeFpgAllowed: data.defTeFpgAllowed,
  }));
  
  // Delete existing data and do fresh insert
  await db.delete(teamReceiverAlignmentMatchups)
    .where(sql`season = 2024 AND week = 4`);
  
  if (records.length > 0) {
    await db.insert(teamReceiverAlignmentMatchups).values(records);
  }
  
  console.log(`✅ Loaded ${records.length} receiver alignment matchup records`);
}

/**
 * Load coverage matchups from screenshot 10
 */
async function loadCoverageMatchups() {
  console.log('📊 Loading coverage matchup data...');
  
  const dataPath = join(process.cwd(), 'server', 'data', 'screenshot_data_bank.json');
  const screenshotData: ScreenshotData = JSON.parse(readFileSync(dataPath, 'utf-8'));
  
  const coverageData = parseCSV(screenshotData.screenshots.screenshot_10.raw_data);
  
  // Accumulate data by team (each CSV row has offense AND defense teams)
  const teamData: Map<string, any> = new Map();
  
  coverageData.forEach(row => {
    const offTeam = row['Offense'];
    const defTeam = row['Defense'];
    
    // Add offensive metrics for offense team
    if (offTeam) {
      if (!teamData.has(offTeam)) {
        teamData.set(offTeam, { team: offTeam });
      }
      const data = teamData.get(offTeam);
      data.offZoneFpdb = toNumber(row['OFF_ZONE_FPDB']);
      data.offManFpdb = toNumber(row['OFF_MAN_FPDB']);
      data.offTwoHighFpdb = toNumber(row['OFF_2H_FPDB']);
      data.offOneHighFpdb = toNumber(row['OFF_1H_FPDB']);
    }
    
    // Add defensive metrics for defense team
    if (defTeam) {
      if (!teamData.has(defTeam)) {
        teamData.set(defTeam, { team: defTeam });
      }
      const data = teamData.get(defTeam);
      data.defZonePct = percentToDecimal(row['DEF_ZONE_PCT']);
      data.defManPct = percentToDecimal(row['DEF_MAN_PCT']);
      data.defTwoHighPct = percentToDecimal(row['DEF_2HIGH_PCT']);
      data.defOneHighPct = percentToDecimal(row['DEF_1HIGH_PCT']);
      data.defZoneFpdbAllowed = toNumber(row['ZONE_FPDB']);
      data.defManFpdbAllowed = toNumber(row['MAN_FPDB']);
      data.defTwoHighFpdbAllowed = toNumber(row['2H_FPDB']);
      data.defOneHighFpdbAllowed = toNumber(row['1H_FPDB']);
    }
  });
  
  // Convert to records array
  const records = Array.from(teamData.values()).map(data => ({
    season: 2024,
    week: 4,
    team: data.team,
    offZoneFpdb: data.offZoneFpdb,
    offManFpdb: data.offManFpdb,
    offTwoHighFpdb: data.offTwoHighFpdb,
    offOneHighFpdb: data.offOneHighFpdb,
    defZonePct: data.defZonePct,
    defManPct: data.defManPct,
    defTwoHighPct: data.defTwoHighPct,
    defOneHighPct: data.defOneHighPct,
    defZoneFpdbAllowed: data.defZoneFpdbAllowed,
    defManFpdbAllowed: data.defManFpdbAllowed,
    defTwoHighFpdbAllowed: data.defTwoHighFpdbAllowed,
    defOneHighFpdbAllowed: data.defOneHighFpdbAllowed,
  }));
  
  // Delete existing data and do fresh insert
  await db.delete(teamCoverageMatchups)
    .where(sql`season = 2024 AND week = 4`);
  
  if (records.length > 0) {
    await db.insert(teamCoverageMatchups).values(records);
  }
  
  console.log(`✅ Loaded ${records.length} coverage matchup records`);
}

/**
 * Main loader function - loads all team analytics data
 */
export async function loadAllTeamAnalytics() {
  console.log('🚀 Starting team analytics data load...');
  
  try {
    await loadTeamContext();
    await loadReceiverAlignmentMatchups();
    await loadCoverageMatchups();
    
    console.log('✅ All team analytics data loaded successfully!');
    return { success: true };
  } catch (error) {
    console.error('❌ Error loading team analytics data:', error);
    throw error;
  }
}

// Run if called directly (ES module check)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  loadAllTeamAnalytics()
    .then(() => {
      console.log('✅ Data load complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Data load failed:', error);
      process.exit(1);
    });
}
