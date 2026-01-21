import useSWR, { type SWRConfiguration } from "swr";

// Fetcher with retry logic and exponential backoff
async function fetcherWithRetry<T>(
  url: string,
  retries = 3,
  backoff = 300,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      // If this was the last retry, throw the error
      if (i === retries - 1) throw error;

      // Wait with exponential backoff before retrying
      const delay = backoff * 2 ** i;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

// Default SWR configuration with retry logic
export const defaultSWRConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  shouldRetryOnError: true,
};

// Custom hook for fetching with automatic retry
export function useFetch<T>(url: string | null, config?: SWRConfiguration) {
  return useSWR<T>(url, (url: string) => fetcherWithRetry<T>(url), {
    ...defaultSWRConfig,
    ...config,
  });
}
