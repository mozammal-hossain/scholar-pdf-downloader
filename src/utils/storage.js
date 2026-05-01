const StorageManager = {
  async getSettings() {
    const defaults = {
      downloadFolder: 'scholar',
      concurrency: 2,
      delayMs: 500,
      rateLimitCooldownMs: 600000
    };
    const result = await chrome.storage.local.get('settings');
    return result.settings || defaults;
  },

  async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
  },

  async getStats() {
    const defaults = {
      totalDownloaded: 0,
      totalFailed: 0,
      totalSkipped: 0,
      lastDownloadDate: null
    };
    const result = await chrome.storage.local.get('stats');
    return result.stats || defaults;
  },

  async updateStats(updates) {
    const current = await this.getStats();
    const updated = { ...current, ...updates };
    await chrome.storage.local.set({ stats: updated });
    return updated;
  },

  async incrementStat(key, amount = 1) {
    const current = await this.getStats();
    current[key] = (current[key] || 0) + amount;
    await chrome.storage.local.set({ stats: current });
    return current;
  },

  async getDownloadedPapers() {
    const result = await chrome.storage.local.get('downloadedPapers');
    return result.downloadedPapers || {};
  },

  async markPaperAsDownloaded(paperTitle, metadata) {
    const papers = await this.getDownloadedPapers();
    papers[paperTitle] = {
      doi: metadata.doi,
      downloadDate: new Date().toISOString(),
      filePath: metadata.filePath
    };
    await chrome.storage.local.set({ downloadedPapers: papers });
  },

  async isPaperDownloaded(paperTitle) {
    const papers = await this.getDownloadedPapers();
    return !!papers[paperTitle];
  },

  async saveMetadata(query, metadata) {
    const key = `metadata_${query}`;
    await chrome.storage.local.set({ [key]: metadata });
  },

  async getMetadata(query) {
    const key = `metadata_${query}`;
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  },

  async clear() {
    await chrome.storage.local.clear();
  }
};
