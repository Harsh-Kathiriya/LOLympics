/**
 * Performs a fetch with automatic retries on transient failures.
 *
 * Retries on HTTP 429 and 5xx status codes. Uses exponential back-off with jitter.
 *
 * @param url  The resource to fetch.
 * @param init Optional fetch init options.
 * @param maxRetries  Number of retry attempts (default 5).
 * @param baseDelayMs Initial back-off delay in milliseconds (default 400ms).
 */
export async function retryFetch(
  url: RequestInfo | URL,
  init: RequestInit = {},
  maxRetries = 5,
  baseDelayMs = 400
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const response = await fetch(url, init);

    // Success – return immediately
    if (response.ok) return response;

    // If we have exhausted retries or the status code is not transient, return response
    const transientStatuses = [429, 500, 502, 503, 504];
    if (attempt >= maxRetries || !transientStatuses.includes(response.status)) {
      return response;
    }

    // Wait using exponential back-off with jitter before next retry
    const delayMs = baseDelayMs * 2 ** attempt + Math.random() * 100;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    attempt++;
  }
} 