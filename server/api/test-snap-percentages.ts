import { Request, Response } from 'express';

/**
 * Test endpoint for snap percentage functionality
 */
export async function testSnapPercentages(req: Request, res: Response) {
  try {
    console.log('🧪 TESTING: Snap percentage service');
    
    // Import the service dynamically to catch any import errors
    const { snapPercentageService } = await import('../services/snapPercentageService');
    
    console.log('✅ Service imported successfully');
    
    // Test the service method
    const result = await snapPercentageService.getTop50WRSnapPercentages();
    
    console.log(`✅ Service returned ${result.length} WRs`);
    
    res.json({
      success: true,
      serviceWorking: true,
      wrCount: result.length,
      sampleData: result.slice(0, 3), // First 3 WRs as sample
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Snap percentage test failed:', error);
    res.status(500).json({
      success: false,
      serviceWorking: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    });
  }
}