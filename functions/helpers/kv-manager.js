// functions/helpers/kv-manager.js
// ============================================================
//  KV Manager - Wrapper for Cloudflare KV with helper methods
//  for storing, retrieving, and managing lists and objects.
// ============================================================

export class KVMANAGER {
  constructor(kvNamespace) {
    this.kv = kvNamespace;
  }

  /**
   * Get a value from KV, with optional default.
   */
  async get(key, defaultValue = null) {
    try {
      const value = await this.kv.get(key);
      return value !== null ? value : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Set a value in KV.
   */
  async put(key, value, options = {}) {
    await this.kv.put(key, value, options);
  }

  /**
   * Delete a key.
   */
  async delete(key) {
    await this.kv.delete(key);
  }

  /**
   * Get a JSON object from KV.
   */
  async getJSON(key, defaultValue = null) {
    const data = await this.get(key);
    if (!data) return defaultValue;
    try {
      return JSON.parse(data);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Store a JSON object.
   */
  async putJSON(key, obj, options = {}) {
    await this.put(key, JSON.stringify(obj), options);
  }

  /**
   * Push one or more items to a list stored under a key.
   * The list is stored as a JSON array.
   */
  async pushToList(key, items) {
    if (!Array.isArray(items)) items = [items];
    if (items.length === 0) return;

    let list = await this.getJSON(key, []);
    // Deduplicate (if list is large, performance may degrade)
    const set = new Set(list);
    for (const item of items) {
      set.add(item);
    }
    const newList = Array.from(set);
    await this.putJSON(key, newList);
  }

  /**
   * Get the entire list from a key.
   */
  async getList(key) {
    return await this.getJSON(key, []);
  }

  /**
   * Increment a counter.
   */
  async increment(key, amount = 1) {
    const current = parseInt(await this.get(key, '0'), 10);
    const newValue = current + amount;
    await this.put(key, String(newValue));
    return newValue;
  }
}
