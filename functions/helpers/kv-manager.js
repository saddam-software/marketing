// functions/helpers/kv-manager.js
// ============================================================
//  KV Manager - with in-memory fallback when KV is unavailable
// ============================================================

export class KVMANAGER {
  constructor(kvNamespace) {
    this.kv = kvNamespace;
    // In-memory fallback store (used if kv is null)
    this.memoryStore = new Map();
    this.useMemory = !kvNamespace;
  }

  async get(key, defaultValue = null) {
    if (this.useMemory) {
      return this.memoryStore.has(key) ? this.memoryStore.get(key) : defaultValue;
    }
    try {
      const value = await this.kv.get(key);
      return value !== null ? value : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async put(key, value, options = {}) {
    if (this.useMemory) {
      this.memoryStore.set(key, value);
      return;
    }
    await this.kv.put(key, value, options);
  }

  async delete(key) {
    if (this.useMemory) {
      this.memoryStore.delete(key);
      return;
    }
    await this.kv.delete(key);
  }

  async getJSON(key, defaultValue = null) {
    const data = await this.get(key);
    if (!data) return defaultValue;
    try {
      return JSON.parse(data);
    } catch {
      return defaultValue;
    }
  }

  async putJSON(key, obj, options = {}) {
    await this.put(key, JSON.stringify(obj), options);
  }

  async pushToList(key, items) {
    if (!Array.isArray(items)) items = [items];
    if (items.length === 0) return;

    let list = await this.getJSON(key, []);
    const set = new Set(list);
    for (const item of items) {
      set.add(item);
    }
    const newList = Array.from(set);
    await this.putJSON(key, newList);
  }

  async getList(key) {
    return await this.getJSON(key, []);
  }

  async increment(key, amount = 1) {
    const current = parseInt(await this.get(key, '0'), 10);
    const newValue = current + amount;
    await this.put(key, String(newValue));
    return newValue;
  }
}
