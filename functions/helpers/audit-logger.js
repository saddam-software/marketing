// functions/helpers/audit-logger.js
// ============================================================
//  Audit Logger - Logs user actions with timestamps,
//  supports retrieval by date and automatic cleanup.
// ============================================================

export class AuditLogger {
  constructor(kvManager) {
    this.kv = kvManager;
    this.retentionDays = 90; // Keep logs for 90 days
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

    // Also store as individual entry for faster query? Not needed for this demo.

    // Clean up old logs (run occasionally, not on every log)
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
   * This is called on each log, but only checks every 100 logs to avoid overhead.
   */
  async cleanupOldLogs() {
    // We'll use a counter to avoid scanning every time
    const counterKey = 'audit:cleanup:counter';
    let counter = parseInt(await this.kv.get(counterKey, '0'), 10);
    counter++;
    if (counter < 20) {
      await this.kv.put(counterKey, String(counter));
      return; // Only run cleanup every 20 logs
    }
    await this.kv.put(counterKey, '0');

    // Determine cutoff date
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - this.retentionDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    // List all audit keys (we need to enumerate - we can use list with prefix)
    // Since KV doesn't support listing efficiently, we'll skip for now.
    // In production, you'd maintain a list of dates.
    // For this demo, we'll just do nothing.
    // A better approach: store a separate list of dates, and remove old ones.
    console.log('Audit log cleanup skipped (placeholder)');
  }
}
