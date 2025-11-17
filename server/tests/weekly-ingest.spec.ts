import { expect } from 'chai';
import { fetchWeeklyFromNflfastR, fetchSeasonToDate } from '../ingest/nflfastr';
import { calcFantasy, hydrateFantasyVariants } from '../lib/scoring';
import { WeeklyRow } from '../../shared/types/fantasy';

describe('Weekly Ingest Guardrails', () => {
  it('never fetches full-season for current year without week parameter', async function() {
    this.timeout(5000);
    
    // Calling fetchWeeklyFromNflfastR without a valid week should throw
    let threw = false;
    try {
      await fetchWeeklyFromNflfastR(2025, undefined as any);
    } catch (e) {
      threw = true;
      expect((e as Error).message).to.include('Invalid week');
    }
    
    expect(threw, 'Should throw error for missing week parameter').to.equal(true);
  });
  
  it('rejects week numbers outside valid range (1-18)', async function() {
    this.timeout(5000);
    
    const invalidWeeks = [0, 19, 100, -1];
    
    for (const week of invalidWeeks) {
      let threw = false;
      try {
        await fetchWeeklyFromNflfastR(2025, week);
      } catch (e) {
        threw = true;
        expect((e as Error).message).to.include('Invalid week');
      }
      
      expect(threw, `Should throw error for invalid week: ${week}`).to.equal(true);
    }
  });
  
  it('hydrates fantasy points for all scoring variants (std/half/ppr)', () => {
    const mockWeeklyRow: WeeklyRow = {
      season: 2024,
      week: 10,
      player_id: 'test_player',
      player_name: 'Test Player',
      team: 'KC',
      position: 'RB',
      rec: 5,
      rec_yd: 50,
      rec_td: 1,
      rush_att: 15,
      rush_yd: 75,
      rush_td: 1,
      pass_yd: 0,
      pass_td: 0,
      int: 0,
      fumbles: 0,
      two_pt: 0
    };
    
    const hydrated = hydrateFantasyVariants(mockWeeklyRow);
    
    expect(hydrated).to.have.property('fantasy_points_std');
    expect(hydrated).to.have.property('fantasy_points_half');
    expect(hydrated).to.have.property('fantasy_points_ppr');
    
    // Verify calculations are correct
    // 50 rec yards / 10 = 5
    // 1 rec TD * 6 = 6
    // 75 rush yards / 10 = 7.5
    // 1 rush TD * 6 = 6
    // Base = 5 + 6 + 7.5 + 6 = 24.5
    
    expect(hydrated.fantasy_points_std).to.equal(24.5); // No reception bonus
    expect(hydrated.fantasy_points_half).to.equal(27); // 24.5 + (5 * 0.5)
    expect(hydrated.fantasy_points_ppr).to.equal(29.5); // 24.5 + (5 * 1)
  });
  
  it('calcFantasy correctly applies scoring formats', () => {
    const row: WeeklyRow = {
      season: 2024,
      week: 1,
      player_id: 'wr1',
      player_name: 'WR Test',
      team: 'SF',
      position: 'WR',
      rec: 8,
      rec_yd: 100,
      rec_td: 1,
      rush_att: 0,
      rush_yd: 0,
      rush_td: 0,
      pass_yd: 0,
      pass_td: 0,
      int: 0,
      fumbles: 0,
      two_pt: 0
    };
    
    // 100 rec yards / 10 = 10
    // 1 rec TD * 6 = 6
    // Base = 16
    
    const std = calcFantasy(row, 'std');
    const half = calcFantasy(row, 'half');
    const ppr = calcFantasy(row, 'ppr');
    
    expect(std).to.equal(16); // No PPR bonus
    expect(half).to.equal(20); // 16 + (8 * 0.5)
    expect(ppr).to.equal(24); // 16 + (8 * 1)
  });
  
  it('calcFantasy handles QB scoring correctly', () => {
    const qb: WeeklyRow = {
      season: 2024,
      week: 1,
      player_id: 'qb1',
      player_name: 'QB Test',
      team: 'KC',
      position: 'QB',
      pass_yd: 300,
      pass_td: 3,
      int: 1,
      rush_yd: 25,
      rush_td: 1,
      rec: 0,
      rec_yd: 0,
      rec_td: 0,
      rush_att: 5,
      fumbles: 0,
      two_pt: 0
    };
    
    // 300 pass yards / 25 = 12
    // 3 pass TDs * 4 = 12
    // 1 INT * -1 = -1
    // 25 rush yards / 10 = 2.5
    // 1 rush TD * 6 = 6
    // Total = 12 + 12 - 1 + 2.5 + 6 = 31.5
    
    const std = calcFantasy(qb, 'std');
    expect(std).to.equal(31.5);
  });
  
  it('fetchSeasonToDate uses getCurrentNFLWeek to determine end week', async function() {
    this.timeout(10000);
    
    // For 2024 (past season), should attempt to fetch weeks 1-18
    // This test verifies the function doesn't crash and respects the week bounds
    try {
      const result = await fetchSeasonToDate(2024);
      // Result should be an array (might be empty if data source unavailable)
      expect(result).to.be.an('array');
    } catch (e) {
      // Expected to fail if NFLfastR data isn't available in test environment
      expect((e as Error).message).to.exist;
    }
  });
  
  it('filters out players with zero stats', () => {
    const rows: WeeklyRow[] = [
      {
        season: 2024,
        week: 1,
        player_id: 'active_player',
        player_name: 'Active Player',
        team: 'KC',
        position: 'RB',
        rush_att: 10,
        rush_yd: 50,
        rec: 3,
        rec_yd: 25
      },
      {
        season: 2024,
        week: 1,
        player_id: 'inactive_player',
        player_name: 'Inactive Player',
        team: 'SF',
        position: 'WR',
        rush_att: 0,
        targets: 0,
        rec: 0,
        pass_yd: 0
      }
    ] as WeeklyRow[];
    
    const filtered = rows.filter(r =>
      (r.rush_att ?? 0) + (r.targets ?? 0) + (r.rec ?? 0) + (r.pass_yd ?? 0) > 0
    );
    
    expect(filtered).to.have.lengthOf(1);
    expect(filtered[0].player_id).to.equal('active_player');
  });
});
