import NProgress from "nprogress";

/**
 * Fetch wrapper that shows the top loading bar during requests
 * Use this for manual fetch calls outside of React Query
 */
export async function fetchWithProgress(input: RequestInfo, init?: RequestInit): Promise<Response> {
  NProgress.start();
  try {
    return await fetch(input, init);
  } finally {
    NProgress.done(true);
  }
}

/**
 * Axios-style wrapper for manual requests with loading bar
 */
export async function apiRequestWithProgress(url: string, options: RequestInit = {}): Promise<any> {
  const response = await fetchWithProgress(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}