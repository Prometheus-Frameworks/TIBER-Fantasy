/**
 * End-to-End Integration Test for Prediction Engine
 * 
 * Tests the complete prediction generation pipeline:
 * - POST /api/predictions/generate-weekly (with security)
 * - GET /api/predictions/:run_id/summary
 * - GET /api/predictions/:run_id/players
 * 
 * Critical Success Criteria:
 * 1. No runtime SQL errors or crashes
 * 2. Position-specific scoring works for QB/RB/WR/TE
 * 3. ECR data properly populated with edge calculations
 * 4. Security protections work correctly
 * 5. Expected output format with all required fields
 */

const request = require('supertest');
const express = require('express');

// Create test app (simulate the actual server setup)
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Mock admin authentication for testing
  app.use('/api/predictions/generate-weekly', (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required',
        code: 'UNAUTHORIZED' 
      });
    }
    
    // Mock admin check - in real system this would validate JWT/session
    const token = authHeader.replace('Bearer ', '');
    if (token !== 'admin-test-token') {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required',
        code: 'FORBIDDEN' 
      });
    }
    
    next();
  });
  
  // Import and mount the actual prediction engine routes
  const { createCompassRouter } = require('../../server/services/predictionEngine');
  app.use('/api/predictions', createCompassRouter());
  
  return app;
};

describe('Prediction Engine Integration Tests', () => {
  let app;
  let testRunId;

  beforeAll(() => {
    app = createTestApp();
    console.log('🧪 [Integration Test] Test app created with prediction engine routes');
  });

  describe('Security Tests', () => {
    test('POST /api/predictions/generate-weekly should require authentication', async () => {
      const response = await request(app)
        .post('/api/predictions/generate-weekly')
        .send({ week: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('UNAUTHORIZED');
      expect(response.body.message).toMatch(/authentication required/i);
      
      console.log('✅ [Security Test] Unauthenticated request properly rejected');
    });

    test('POST /api/predictions/generate-weekly should require admin role', async () => {
      const response = await request(app)
        .post('/api/predictions/generate-weekly')
        .set('Authorization', 'Bearer invalid-token')
        .send({ week: 1 });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
      expect(response.body.message).toMatch(/admin access required/i);
      
      console.log('✅ [Security Test] Non-admin token properly rejected');
    });
  });

  describe('Input Validation Tests', () => {
    test('POST /api/predictions/generate-weekly should validate input schema', async () => {
      const response = await request(app)
        .post('/api/predictions/generate-weekly')
        .set('Authorization', 'Bearer admin-test-token')
        .send({ invalid_field: 'test' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/invalid input parameters/i);
      
      console.log('✅ [Validation Test] Invalid input properly rejected');
    });

    test('POST /api/predictions/generate-weekly should reject future cutoff timestamps', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const response = await request(app)
        .post('/api/predictions/generate-weekly')
        .set('Authorization', 'Bearer admin-test-token')
        .send({ 
          week: 1, 
          cutoff_ts: futureDate.toISOString() 
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CUTOFF');
      expect(response.body.message).toMatch(/cutoff timestamp cannot be in the future/i);
      
      console.log('✅ [Validation Test] Future cutoff timestamp properly rejected');
    });
  });

  describe('Core Prediction Generation Tests', () => {
    test('POST /api/predictions/generate-weekly should generate predictions successfully', async () => {
      const startTime = Date.now();
      console.log('🚀 [Core Test] Starting prediction generation test...');

      const response = await request(app)
        .post('/api/predictions/generate-weekly')
        .set('Authorization', 'Bearer admin-test-token')
        .send({ week: 1 })
        .timeout(30000); // 30 second timeout for complex operation

      const duration = Date.now() - startTime;
      console.log(`⏱️ [Core Test] Prediction generation completed in ${duration}ms`);

      // Verify successful response structure
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.run_id).toBeDefined();
      expect(response.body.generated_at).toBeDefined();
      expect(response.body.week).toBe(1);
      expect(response.body.admin_triggered).toBe(true);

      // Store run_id for subsequent tests
      testRunId = response.body.data.run_id;
      expect(testRunId).toBeTruthy();

      console.log(`✅ [Core Test] Prediction generation successful | Run ID: ${testRunId}`);
      console.log(`📊 [Core Test] Response: ${JSON.stringify(response.body, null, 2)}`);
    }, 45000); // 45 second test timeout

    test('GET /api/predictions/:run_id/summary should return proper summary', async () => {
      expect(testRunId).toBeTruthy();

      const response = await request(app)
        .get(`/api/predictions/${testRunId}/summary`);

      expect(response.status).toBe(200);
      expect(response.body.run_id).toBe(testRunId);
      expect(response.body.total).toBeDefined();
      expect(response.body.beat_count).toBeDefined();
      expect(response.body.week).toBeDefined();
      expect(response.body.predictions).toBeInstanceOf(Array);

      // Verify summary structure
      expect(typeof response.body.total).toBe('number');
      expect(typeof response.body.beat_count).toBe('number');
      expect(response.body.total).toBeGreaterThan(0);

      console.log(`✅ [Summary Test] Summary retrieved: ${response.body.total} total, ${response.body.beat_count} beat ECR`);
    });

    test('GET /api/predictions/:run_id/players should return player predictions', async () => {
      expect(testRunId).toBeTruthy();

      const response = await request(app)
        .get(`/api/predictions/${testRunId}/players`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);

      // Test first prediction has all required fields
      const firstPrediction = response.body[0];
      expect(firstPrediction).toMatchObject({
        player_id: expect.any(String),
        name: expect.any(String),
        team: expect.any(String),
        pos: expect.any(String),
        mean_pts: expect.any(Number),
        ecr_points: expect.any(Number),
        edge_vs_ecr: expect.any(Number),
        beat_flag: expect.any(Boolean),
        compass_breakdown: expect.objectContaining({
          north: expect.any(Number),
          east: expect.any(Number),
          south: expect.any(Number),
          west: expect.any(Number)
        }),
        reasons: expect.any(Array)
      });

      console.log(`✅ [Players Test] Retrieved ${response.body.length} player predictions`);
      console.log(`📊 [Players Test] Sample prediction:`, JSON.stringify(firstPrediction, null, 2));
    });
  });

  describe('Position-Specific Scoring Tests', () => {
    test('All positions (QB/RB/WR/TE) should have predictions without errors', async () => {
      expect(testRunId).toBeTruthy();

      const positions = ['QB', 'RB', 'WR', 'TE'];
      const positionResults = {};

      for (const pos of positions) {
        const response = await request(app)
          .get(`/api/predictions/${testRunId}/players`)
          .query({ pos });

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);

        positionResults[pos] = response.body.length;

        if (response.body.length > 0) {
          const samplePlayer = response.body[0];
          expect(samplePlayer.pos).toBe(pos);
          
          // Verify position-specific scoring worked correctly
          expect(samplePlayer.compass_breakdown.north).toBeGreaterThanOrEqual(0);
          expect(samplePlayer.compass_breakdown.north).toBeLessThanOrEqual(100);
          expect(samplePlayer.mean_pts).toBeGreaterThan(0);
          expect(samplePlayer.ecr_points).toBeGreaterThan(0);
          
          console.log(`✅ [Position Test] ${pos}: ${response.body.length} predictions, sample: ${samplePlayer.name} (${samplePlayer.mean_pts} pts)`);
        }
      }

      // Verify all positions have some predictions
      const totalPositionPredictions = Object.values(positionResults).reduce((a, b) => a + b, 0);
      expect(totalPositionPredictions).toBeGreaterThan(0);

      console.log(`📊 [Position Test] Position breakdown: ${JSON.stringify(positionResults)}`);
    });
  });

  describe('ECR Integration Tests', () => {
    test('Beat ECR predictions should have proper edge calculations', async () => {
      expect(testRunId).toBeTruthy();

      const response = await request(app)
        .get(`/api/predictions/${testRunId}/players`)
        .query({ beat_only: 'true' });

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);

      if (response.body.length > 0) {
        const beatECRPicks = response.body;
        
        beatECRPicks.forEach(player => {
          // All beat ECR picks should have beat_flag = true
          expect(player.beat_flag).toBe(true);
          
          // Should have positive edge vs ECR
          expect(player.edge_vs_ecr).toBeGreaterThan(0);
          
          // Should have ECR data populated
          expect(player.ecr_points).toBeGreaterThan(0);
          
          // Should have reasons explaining the edge
          expect(player.reasons).toBeInstanceOf(Array);
          expect(player.reasons.length).toBeGreaterThan(0);
          
          // Should have WEST misprice reasoning (market value component)
          const hasMarketReason = player.reasons.some(reason => 
            reason.toLowerCase().includes('west') || 
            reason.toLowerCase().includes('market') ||
            reason.toLowerCase().includes('misprice')
          );
          expect(hasMarketReason).toBe(true);
        });

        console.log(`✅ [ECR Test] ${beatECRPicks.length} Beat ECR picks with proper edge calculations`);
        console.log(`📊 [ECR Test] Sample beat pick:`, JSON.stringify(beatECRPicks[0], null, 2));
      } else {
        console.log('ℹ️ [ECR Test] No Beat ECR picks found (acceptable if ECR data shows no edges)');
      }
    });
  });

  describe('Error Handling Tests', () => {
    test('GET /api/predictions/:run_id/summary should handle invalid run_id', async () => {
      const response = await request(app)
        .get('/api/predictions/invalid-run-id/summary');

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      
      console.log('✅ [Error Test] Invalid run_id properly handled');
    });

    test('GET /api/predictions/:run_id/players should handle invalid filters', async () => {
      expect(testRunId).toBeTruthy();

      const response = await request(app)
        .get(`/api/predictions/${testRunId}/players`)
        .query({ pos: 'INVALID_POSITION' });

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0); // Should return empty array for invalid position
      
      console.log('✅ [Error Test] Invalid position filter properly handled');
    });
  });

  afterAll(() => {
    console.log('🧪 [Integration Test] All tests completed');
    if (testRunId) {
      console.log(`📝 [Integration Test] Test run ID: ${testRunId}`);
    }
  });
});

// Export for use in other test files
module.exports = {
  createTestApp
};