/**
 * FORGE Calibration Smoke Tests
 * 
 * Light regression tests to ensure:
 * 1. Endpoints return both rawAlpha and alpha
 * 2. Alpha scores are numeric and in sane ranges
 * 3. Calibration doesn't silently break
 */

import { describe, it, beforeAll, afterAll } from 'mocha';
import { expect } from 'chai';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:5000';

describe('FORGE Calibration', () => {
  
  describe('GET /api/forge/batch', () => {
    it('returns both rawAlpha and alpha for WR scores', async () => {
      const res = await fetch(`${API_BASE}/api/forge/batch?position=WR&season=2025&week=10&limit=10`);
      expect(res.status).to.equal(200);
      
      const data = await res.json();
      expect(data.success).to.equal(true);
      expect(Array.isArray(data.scores)).to.equal(true);
      expect(data.scores.length).to.be.greaterThan(0);
      
      for (const score of data.scores) {
        expect(typeof score.rawAlpha).to.equal('number', `rawAlpha should be number for ${score.playerName}`);
        expect(typeof score.alpha).to.equal('number', `alpha should be number for ${score.playerName}`);
        expect(score.alpha).to.be.greaterThanOrEqual(0);
        expect(score.alpha).to.be.lessThanOrEqual(100);
        expect(score.rawAlpha).to.be.greaterThanOrEqual(0);
        expect(score.rawAlpha).to.be.lessThanOrEqual(100);
      }
    });
    
    it('calibrates WR scores to spread into 25-90 range', async () => {
      const res = await fetch(`${API_BASE}/api/forge/batch?position=WR&season=2025&week=10&limit=100`);
      expect(res.status).to.equal(200);
      
      const data = await res.json();
      const alphas = data.scores.map((s: any) => s.alpha).filter((a: number) => a > 30);
      
      if (alphas.length > 0) {
        const maxAlpha = Math.max(...alphas);
        const minAlpha = Math.min(...alphas);
        
        expect(maxAlpha).to.be.greaterThan(70, 'Top WRs should score above 70 after calibration');
        expect(minAlpha).to.be.lessThan(60, 'Lower WRs should score below 60 after calibration');
      }
    });
  });
  
  describe('GET /api/forge/score/:playerId', () => {
    it('returns rawAlpha and alpha for a single player', async () => {
      const res = await fetch(`${API_BASE}/api/forge/score/jaxon-smith-njigba?season=2025&week=10`);
      expect(res.status).to.equal(200);
      
      const data = await res.json();
      expect(data.success).to.equal(true);
      expect(data.score).to.exist;
      expect(typeof data.score.rawAlpha).to.equal('number');
      expect(typeof data.score.alpha).to.equal('number');
      expect(data.score.alpha).to.be.greaterThanOrEqual(0);
      expect(data.score.alpha).to.be.lessThanOrEqual(100);
    });
  });
  
  describe('GET /api/forge/debug/distribution', () => {
    it('returns distribution stats for WR position', async () => {
      const res = await fetch(`${API_BASE}/api/forge/debug/distribution?position=WR&season=2025&week=10`);
      expect(res.status).to.equal(200);
      
      const data = await res.json();
      expect(data.success).to.equal(true);
      expect(data.distribution).to.exist;
      expect(typeof data.distribution.p10).to.equal('number');
      expect(typeof data.distribution.p90).to.equal('number');
      expect(typeof data.distribution.min).to.equal('number');
      expect(typeof data.distribution.max).to.equal('number');
      
      expect(data.distribution.p10).to.be.lessThanOrEqual(data.distribution.p90);
      expect(data.distribution.min).to.be.lessThanOrEqual(data.distribution.p10);
      expect(data.distribution.p90).to.be.lessThanOrEqual(data.distribution.max);
    });
    
    it('provides calibration suggestion', async () => {
      const res = await fetch(`${API_BASE}/api/forge/debug/distribution?position=RB&season=2025&week=10`);
      expect(res.status).to.equal(200);
      
      const data = await res.json();
      expect(data.calibrationSuggestion).to.exist;
      expect(typeof data.calibrationSuggestion.p10).to.equal('number');
      expect(typeof data.calibrationSuggestion.p90).to.equal('number');
      expect(data.calibrationSuggestion.outMin).to.equal(25);
      expect(data.calibrationSuggestion.outMax).to.equal(90);
    });
  });
  
  describe('RB/TE/QB pass-through (no calibration)', () => {
    it('RB scores are pass-through (alpha equals rawAlpha)', async () => {
      const res = await fetch(`${API_BASE}/api/forge/batch?position=RB&season=2025&week=10&limit=5`);
      expect(res.status).to.equal(200);
      
      const data = await res.json();
      for (const score of data.scores) {
        expect(score.alpha).to.equal(score.rawAlpha, `RB ${score.playerName} should have alpha === rawAlpha (no calibration)`);
      }
    });
    
    it('TE scores are pass-through (alpha equals rawAlpha)', async () => {
      const res = await fetch(`${API_BASE}/api/forge/batch?position=TE&season=2025&week=10&limit=5`);
      expect(res.status).to.equal(200);
      
      const data = await res.json();
      for (const score of data.scores) {
        expect(score.alpha).to.equal(score.rawAlpha, `TE ${score.playerName} should have alpha === rawAlpha (no calibration)`);
      }
    });
    
    it('QB scores are pass-through (alpha equals rawAlpha)', async () => {
      const res = await fetch(`${API_BASE}/api/forge/batch?position=QB&season=2025&week=10&limit=5`);
      expect(res.status).to.equal(200);
      
      const data = await res.json();
      for (const score of data.scores) {
        expect(score.alpha).to.equal(score.rawAlpha, `QB ${score.playerName} should have alpha === rawAlpha (no calibration)`);
      }
    });
  });
});
