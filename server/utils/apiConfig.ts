/**
 * API Configuration utility for production-ready endpoint handling
 * Provides dynamic base URL resolution and request timeouts
 */

export interface ApiRequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class ApiConfig {
  private static instance: ApiConfig;
  private baseUrl: string;

  private constructor() {
    // Dynamic base URL resolution for different environments
    this.baseUrl = this.resolveBaseUrl();
  }

  public static getInstance(): ApiConfig {
    if (!ApiConfig.instance) {
      ApiConfig.instance = new ApiConfig();
    }
    return ApiConfig.instance;
  }

  private resolveBaseUrl(): string {
    // Priority order: explicit env var -> detected from request context -> localhost fallback
    if (process.env.API_BASE_URL) {
      return process.env.API_BASE_URL;
    }

    // In production deployment, this should be set to the proper domain
    if (process.env.NODE_ENV === 'production') {
      return process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER || 'replit'}.repl.co`
        : 'http://localhost:5000';
    }

    return 'http://localhost:5000';
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public buildUrl(path: string): string {
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${cleanPath}`;
  }

  /**
   * Enhanced fetch with timeout, retries, and error handling
   */
  public async fetchWithTimeout(
    url: string, 
    options: RequestInit & ApiRequestOptions = {}
  ): Promise<Response> {
    const {
      timeout = 10000,      // 10 second default timeout
      retries = 2,          // 2 retries by default
      retryDelay = 1000,    // 1 second delay between retries
      ...fetchOptions
    } = options;

    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === retries) {
          break;
        }

        // Don't retry on 4xx errors (client errors)
        if (lastError.message.includes('HTTP 4')) {
          break;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }

    throw new Error(`API request failed after ${retries + 1} attempts: ${lastError.message}`);
  }

  /**
   * Convenience method for internal API calls
   */
  public async internalApiCall(
    endpoint: string, 
    options: RequestInit & ApiRequestOptions = {}
  ): Promise<any> {
    const url = this.buildUrl(endpoint);
    
    try {
      const response = await this.fetchWithTimeout(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      return await response.json();
    } catch (error) {
      console.error(`[ApiConfig] Internal API call failed for ${endpoint}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiConfig = ApiConfig.getInstance();

// Helper functions for common patterns
export const buildApiUrl = (path: string): string => apiConfig.buildUrl(path);
export const internalFetch = (endpoint: string, options?: RequestInit & ApiRequestOptions) => 
  apiConfig.internalApiCall(endpoint, options);