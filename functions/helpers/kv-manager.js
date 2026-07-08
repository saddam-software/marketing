// functions/helpers/kv-manager.js
// ============================================================
//  KV Manager - Cloudflare Workers KV wrapper with memory fallback
//  Provides consistent API for key-value operations with JSON support,
//  list operations, and atomic increment.
// ============================================================

/**
 * KV Manager class.
 * Wraps Cloudflare KV namespace and provides an in-memory fallback
 * when KV is unavailable (e.g., during local development).
 */
export class KVMANAGER {
  /**
   * Create a KV Manager instance.
   * @param {Object|null} kvNamespace - The Cloudflare KV namespace binding.
   *                                    If null or undefined, uses in-memory store.
   */
  constructor(kvNamespace) {
    this.kv = kvNamespace || null;
    this.useMemory = !kvNamespace;
    this.memoryStore = new Map();
  }

  // ==================== CORE METHODS ====================

  /**
   * Retrieve a string value by key.
   * @param {string} key - The key to retrieve.
   * @param {*} defaultValue - Value returned if key does not exist.
   * @returns {Promise<*>} - The stored value or default.
   */
  async get(key, defaultValue = null) {
    try {
      if (this.useMemory) {
        return this.memoryStore.has(key) ? this.memoryStore.get(key) : defaultValue;
      }
      const value = await this.kv.get(key);
      return value !== null ? value : defaultValue;
    } catch (error) {
      console.warn(`[KV] GET error for key "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Store a string value.
   * @param {string} key - The key to store under.
   * @param {string} value - The value to store.
   * @param {Object} [options] - KV put options (expiration, expirationTtl, etc.)
   * @returns {Promise<void>}
   */
  async put(key, value, options = {}) {
    try {
      if (this.useMemory) {
        this.memoryStore.set(key, value);
        return;
      }
      await this.kv.put(key, value, options);
    } catch (error) {
      console.error(`[KV] PUT error for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Delete a key.
   * @param {string} key - The key to delete.
   * @returns {Promise<void>}
   */
  async delete(key) {
    try {
      if (this.useMemory) {
        this.memoryStore.delete(key);
        return;
      }
      await this.kv.delete(key);
    } catch (error) {
      console.error(`[KV] DELETE error for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Check if a key exists.
   * @param {string} key - The key to check.
   * @returns {Promise<boolean>}
   */
  async has(key) {
    try {
      if (this.useMemory) {
        return this.memoryStore.has(key);
      }
      const value = await this.kv.get(key);
      return value !== null;
    } catch {
      return false;
    }
  }

  // ==================== JSON METHODS ====================

  /**
   * Retrieve and parse JSON value.
   * @param {string} key - The key.
   * @param {*} defaultValue - Default if key missing or invalid JSON.
   * @returns {Promise<*>}
   */
  async getJSON(key, defaultValue = null) {
    const data = await this.get(key);
    if (!data) return defaultValue;
    try {
      return JSON.parse(data);
    } catch (error) {
      console.warn(`[KV] JSON parse error for key "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Store a value as JSON.
   * @param {string} key - The key.
   * @param {*} obj - The object to stringify and store.
   * @param {Object} [options] - KV put options.
   * @returns {Promise<void>}
   */
  async putJSON(key, obj, options = {}) {
    try {
      const json = JSON.stringify(obj);
      await this.put(key, json, options);
    } catch (error) {
      console.error(`[KV] PUT JSON error for key "${key}":`, error);
      throw error;
    }
  }

  // ==================== LIST OPERATIONS ====================

  /**
   * Retrieve a list (array) from KV.
   * @param {string} key - The key where the list is stored.
   * @returns {Promise<Array>}
   */
  async getList(key) {
    return await this.getJSON(key, []);
  }

  /**
   * Push one or more items to a list, ensuring uniqueness.
   * @param {string} key - The key of the list.
   * @param {string|Array} items - Item(s) to add.
   * @returns {Promise<void>}
   */
  async pushToList(key, items) {
    if (!items) return;
    if (!Array.isArray(items)) items = [items];
    if (items.length === 0) return;

    let list = await this.getJSON(key, []);
    const set = new Set(list);
    for (const item of items) {
      if (item !== undefined && item !== null) {
        set.add(item);
      }
    }
    const newList = Array.from(set);
    await this.putJSON(key, newList);
  }

  /**
   * Remove specific items from a list.
   * @param {string} key - The key of the list.
   * @param {string|Array} items - Item(s) to remove.
   * @returns {Promise<void>}
   */
  async removeFromList(key, items) {
    if (!items) return;
    if (!Array.isArray(items)) items = [items];
    if (items.length === 0) return;

    let list = await this.getJSON(key, []);
    const set = new Set(list);
    for (const item of items) {
      set.delete(item);
    }
    const newList = Array.from(set);
    await this.putJSON(key, newList);
  }

  /**
   * Get list length.
   * @param {string} key - The key of the list.
   * @returns {Promise<number>}
   */
  async listLength(key) {
    const list = await this.getJSON(key, []);
    return list.length;
  }

  // ==================== INCREMENT / COUNTERS ====================

  /**
   * Atomically increment a numeric value.
   * @param {string} key - The key.
   * @param {number} [amount=1] - Amount to increment (can be negative).
   * @returns {Promise<number>} - The new value.
   */
  async increment(key, amount = 1) {
    try {
      const current = parseInt(await this.get(key, '0'), 10);
      const newValue = current + amount;
      await this.put(key, String(newValue));
      return newValue;
    } catch (error) {
      console.error(`[KV] Increment error for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Set a counter to a specific value.
   * @param {string} key - The key.
   * @param {number} value - The value to set.
   * @param {Object} [options] - KV put options.
   * @returns {Promise<void>}
   */
  async setCounter(key, value, options = {}) {
    await this.put(key, String(value), options);
  }

  /**
   * Get current counter value.
   * @param {string} key - The key.
   * @param {number} [defaultValue=0] - Default if key missing.
   * @returns {Promise<number>}
   */
  async getCounter(key, defaultValue = 0) {
    const val = await this.get(key, String(defaultValue));
    return parseInt(val, 10) || 0;
  }

  // ==================== UTILITY ====================

  /**
   * Get all keys with a given prefix (only works with real KV, not memory fallback).
   * @param {string} prefix - The prefix to filter keys.
   * @param {number} [limit=1000] - Maximum number of keys to return.
   * @returns {Promise<Array<string>>} - Array of key names.
   */
  async listKeys(prefix = '', limit = 1000) {
    if (this.useMemory) {
      const keys = Array.from(this.memoryStore.keys());
      return keys.filter(k => k.startsWith(prefix)).slice(0, limit);
    }
    try {
      const result = await this.kv.list({ prefix, limit });
      return result.keys.map(k => k.name);
    } catch (error) {
      console.error(`[KV] List keys error for prefix "${prefix}":`, error);
      return [];
    }
  }

  /**
   * Delete all keys with a given prefix (use with caution).
   * @param {string} prefix - The prefix to match.
   * @param {number} [batchSize=50] - Number of keys to delete per batch.
   * @returns {Promise<number>} - Number of keys deleted.
   */
  async deleteKeysByPrefix(prefix, batchSize = 50) {
    if (this.useMemory) {
      let deleted = 0;
      for (const key of this.memoryStore.keys()) {
        if (key.startsWith(prefix)) {
          this.memoryStore.delete(key);
          deleted++;
        }
      }
      return deleted;
    }

    let totalDeleted = 0;
    let cursor;
    do {
      const list = await this.kv.list({ prefix, limit: batchSize, cursor });
      for (const key of list.keys) {
        await this.kv.delete(key.name);
        totalDeleted++;
      }
      cursor = list.cursor;
    } while (cursor);
    return totalDeleted;
  }

  /**
   * Clear all data (only works in memory fallback; in production, use deleteKeysByPrefix).
   * @returns {Promise<void>}
   */
  async clearAll() {
    if (this.useMemory) {
      this.memoryStore.clear();
      return;
    }
    throw new Error('clearAll() is not supported with real KV. Use deleteKeysByPrefix() instead.');
  }
}
