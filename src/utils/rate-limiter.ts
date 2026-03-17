import { sleep } from './retry.js';

/**
 * Simple sequential rate limiter – enforces a minimum delay between calls.
 * Usage: await rateLimiter.wait() before each outbound request.
 */
export class RateLimiter {
  private lastCallAt = 0;

  constructor(private readonly minDelayMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallAt;
    if (elapsed < this.minDelayMs) {
      await sleep(this.minDelayMs - elapsed);
    }
    this.lastCallAt = Date.now();
  }
}
