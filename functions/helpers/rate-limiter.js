// functions/helpers/rate-limiter.js
// ============================================================
//  Rate Limiter - Token bucket rate limiting using KV.
// ============================================================

export class RateLimiter {
  constructor(kvManager) {
    this.kv = kvManager;
  }

  /**
   * Check if the request is allowed.
   * @param {string} key - Unique key per client (e.g., IP + endpoint)
   * @param {number} maxAttempts - Maximum attempts in the window
   * @param {number} windowSeconds - Time window in seconds
   * @returns {Promise<boolean>} - True if allowed, false if blocked.
   */
  async check(key, maxAttempts, windowSeconds) {
    const record = await this.kv.getJSON(key, null);
    const now = Date.now();

    if (!record) {
      // First attempt
      await this.kv.putJSON(key, {
        count: 1,
        firstAttempt: now,
        blockedUntil: null,
      }, { expirationTtl: windowSeconds });
      return true;
    }

    // If blocked, check if block expired
    if (record.blockedUntil && record.blockedUntil > now) {
      return false;
    }

    // If window expired, reset
    if (now - record.firstAttempt > windowSeconds * 1000) {
      await this.kv.putJSON(key, {
        count: 1,
        firstAttempt: now,
        blockedUntil: null,
      }, { expirationTtl: windowSeconds });
      return true;
    }

    // Increment count
    record.count += 1;

    if (record.count > maxAttempts) {
      // Block for the remainder of the window
      const blockUntil = record.firstAttempt + windowSeconds * 1000;
      record.blockedUntil = blockUntil;
      await this.kv.putJSON(key, record, { expirationTtl: windowSeconds });
      return false;
    }

    await this.kv.putJSON(key, record, { expirationTtl: windowSeconds });
    return true;
  }
}
