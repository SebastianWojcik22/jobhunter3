import { logger } from './logger.js';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffFactor?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, backoffFactor = 2 } = options;
  let lastError: unknown;
  let delay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        logger.warn(`${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`, {
          error: err instanceof Error ? err.message : String(err),
        });
        await sleep(delay);
        delay *= backoffFactor;
      }
    }
  }
  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
