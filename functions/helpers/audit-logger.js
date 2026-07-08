// functions/helpers/audit-logger.js
// ============================================================
//  Audit Logger - Logs user actions with timestamps,
//  supports retrieval by date and automatic cleanup.
// ============================================================

export class AuditLogger {
  constructor(kvManager) {
    this.kv = kvManager;
    this.retentionDays = 90; // Keep logs for 90 days
    this.cleanupCounterKey = 'audit:cleanup:counter';
  }

  /**
   * Log an event.
   * @param {string} action - Action type (e.g., LOGIN, SCRAPE_EMAILS)
   * @param {object} details - Additional data (username, count, etc.)
   */
  async log(action, details = {}) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timestamp = now.toISOString();

    const logEntry = {
      timestamp,
      action,
      ...details,
    };

    // Store in a list per date
    const key = `audit:logs:${dateStr}`;
    const logs = await this.kv.getJSON(key, []);
    logs.push(logEntry);

    // Keep only last 1000 entries per day (limit)
    if (logs.length > 1000) logs.shift();

    await this.kv.putJSON(key, logs);

    // Run cleanup periodically (every 20 logs)
    await this.cleanupOldLogs();
  }

  /**
   * Retrieve logs for a specific date.
   */
  async getLogsForDate(dateStr, limit = 50) {
    const key = `audit:logs:${dateStr}`;
    const logs = await this.kv.getJSON(key, []);
    // Return latest first
    return logs.slice(-limit).reverse();
  }

  /**
   * Clean up logs older than retention period.
   * Uses a counter to avoid scanning on every log.
   */
  async cleanupOldLogs() {
    // Increment counter and only run cleanup every 20 logs
    let counter = parseInt(await this.kv.get(this.cleanupCounterKey, '0'), 10);
    counter++;
    if (counter < 20) {
      await this.kv.put(this.cleanupCounterKey, String(counter));
      return;
    }
    // Reset counter
    await this.kv.put(this.cleanupCounterKey, '0');

    // Determine cutoff date
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - this.retentionDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    // If we have a real KV namespace (not in-memory fallback)
    const kv = this.kv.kv;
    if (!kv) {
      // In-memory mode – we can't list keys, so skip cleanup
      return;
    }

    try {
      // List all audit log keys
      const listResult = await kv.list({ prefix: 'audit:logs:' });
      const keys = listResult.keys || [];

      // Delete keys older than cutoff
      for (const keyObj of keys) {
        const key = keyObj.name;
        // Extract date from key: "audit:logs:2025-01-01" -> "2025-01-01"
        const datePart = key.split(':').pop();
        if (datePart && datePart < cutoffStr) {
          await this.kv.delete(key);
        }
      }
    } catch (err) {
      // Silently fail cleanup – it's not critical for logging
      console.warn('Audit log cleanup failed:', err.message);
    }
  }
}
