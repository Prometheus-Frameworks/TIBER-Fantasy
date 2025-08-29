import { loadSeedCoeffs, type Coeffs } from './xfpTrainer';

export class XfpRepository {
  private coeffsCache: Record<string, Coeffs> | null = null;
  
  async loadAll(): Promise<Record<string, Coeffs>> {
    // Force reload for testing - remove cache
    this.coeffsCache = null;

    try {
      // TODO: Check DB table xfp_coeffs first when we have database integration
      // For now, always load from seeds
      const coeffs = loadSeedCoeffs();
      this.coeffsCache = coeffs;
      
      console.log('[xFP Repository] Loaded seed coefficients for positions:', Object.keys(coeffs));
      return coeffs;
      
    } catch (error) {
      console.error('[xFP Repository] Failed to load coefficients:', error);
      throw error;
    }
  }

  async getModelInfo(): Promise<Record<string, { r2: number; sample: number; source: string }>> {
    const coeffs = await this.loadAll();
    
    return Object.entries(coeffs).reduce((acc, [pos, coeff]) => {
      acc[pos] = {
        r2: coeff.r2,
        sample: coeff.sample,
        source: coeff.sample > 0 ? 'trained' : 'seed'
      };
      return acc;
    }, {} as Record<string, { r2: number; sample: number; source: string }>);
  }

  clearCache(): void {
    this.coeffsCache = null;
  }
}

export const xfpRepository = new XfpRepository();