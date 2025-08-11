// Knowledge Auto-captured & AI Search Extension - Background Script
'use strict';

// Disable non-critical console output in production
(function() {
  const c = globalThis.console;
  if (!c) return;
  const noop = function() {};
  try {
    c.log = noop;
    c.info = noop;
    c.debug = noop;
    c.trace = noop;
  } catch (_) {}
})();

// Official Web Store build gating for default proxy usage
const OFFICIAL_EXTENSION_ID = 'ncjpgepmkgekadjmigeajanfgfcjhebm';
function getDefaultProxyUrl() {
  try {
    const runtimeId = (chrome && chrome.runtime && chrome.runtime.id) || '';
    const allowedFromConfig = (globalThis.window && window.VERTEX_CONFIG && Array.isArray(window.VERTEX_CONFIG.allowedExtensionIds))
      ? window.VERTEX_CONFIG.allowedExtensionIds
      : null;
    const allowList = allowedFromConfig && allowedFromConfig.length > 0
      ? allowedFromConfig
      : [OFFICIAL_EXTENSION_ID];
    const isAllowed = allowList.includes(runtimeId);
    return isAllowed ? 'https://vertex-ai-proxy-603340132885.us-central1.run.app' : '';
  } catch (_) {
    return '';
  }
}

// === CONFIGURATION ===
const CONFIG = {
  SUPPORTED_PROTOCOLS: ['http:', 'https:'],
  UNSUPPORTED_PROTOCOLS: ['chrome:', 'chrome-extension:', 'edge:', 'about:'],
  EMBEDDING_DIMENSIONS: 1536,
  MAX_TEXT_LENGTH: 10000,
  SEARCH_RESULTS_LIMIT: 50,
  CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  NOTIFICATION_DURATION: 5000
};

// === BROWSER COMPATIBILITY ===
const browser = globalThis.chrome || globalThis.browser;

// === UTILITIES ===
const Utils = {
  // Storage utilities
    async get(key) {
    return new Promise(resolve => {
      chrome.storage.local.get([key], result => resolve(result[key]));
    });
  },

  async set(key, value) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  },

  async remove(keys) {
    return new Promise(resolve => {
      chrome.storage.local.remove(keys, resolve);
    });
  },
  
  // Text processing utilities
  cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?;:()-]/g, '')
      .trim();
  },
  
  truncateText(text, maxLength) {
    return text.length > maxLength 
      ? text.substring(0, maxLength) + '...'
      : text;
  },
  
  countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  },
  
  // URL utilities
  isValidUrl(url) {
    try {
      const urlObj = new URL(url);
      return CONFIG.SUPPORTED_PROTOCOLS.includes(urlObj.protocol);
    } catch {
      return false;
    }
  },
  
  isSystemPage(url) {
    return CONFIG.UNSUPPORTED_PROTOCOLS.some(protocol => url.startsWith(protocol));
  },
  
  // Time utilities
  getCurrentTimestamp() {
    return Date.now();
  },
  
  // Math utilities
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  },
  
  // Async utilities
  async withTimeout(promise, timeoutMs) {
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    );
    return Promise.race([promise, timeout]);
  },
  
  // Notification utilities
  async showNotification(message, type = 'basic') {
    try {
      // Check if notifications API is available
      if (!chrome.notifications) {
        return;
      }
      
      // Chrome notifications API only accepts: 'basic', 'image', 'list', 'progress'
      // Map our custom types to 'basic' since we're just showing simple messages
      const chromeType = 'basic';
      
      await chrome.notifications.create({
        type: chromeType,
        iconUrl: 'icon48.png',
        title: 'Knowledge Auto-captured & AI Search',
        message: message
      });
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }
};

// === INDEXEDDB STORAGE (for archived articles) ===
const IndexedDBStorage = {
  dbName: 'KnowledgeCaptureDB',
  dbVersion: 1,
  storeName: 'archived_articles',
  
  async openDB() {
    return new Promise((resolve, reject) => {
      console.log('IndexedDB: Opening database:', this.dbName, 'version:', this.dbVersion);
      
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = (event) => {
        console.error('IndexedDB: Failed to open database:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        console.log('IndexedDB: Database opened successfully');
        resolve(event.target.result);
      };
      
      request.onupgradeneeded = (event) => {
        console.log('IndexedDB: Database upgrade needed');
        const db = event.target.result;
        
        try {
          if (!db.objectStoreNames.contains(this.storeName)) {
            console.log('IndexedDB: Creating object store:', this.storeName);
            const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('title', 'title', { unique: false });
            console.log('IndexedDB: Object store created with indexes');
          }
        } catch (upgradeError) {
          console.error('IndexedDB: Error during upgrade:', upgradeError);
          reject(upgradeError);
        }
      };
      
      request.onblocked = (event) => {
        console.warn('IndexedDB: Database open blocked - close other tabs using this extension');
      };
    });
  },
  
  async saveEntry(entry) {
    try {
      console.log('IndexedDB: Attempting to save entry:', entry.title, 'ID:', entry.id);
      
      // Validate entry has required fields
      if (!entry.id) {
        throw new Error('Entry missing required ID field');
      }
      
      const db = await this.openDB();
      console.log('IndexedDB: Database opened successfully');
      
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise((resolve, reject) => {
        const request = store.put(entry);
        request.onsuccess = () => {
          console.log('IndexedDB: Entry saved successfully');
          resolve();
        };
        request.onerror = (event) => {
          console.error('IndexedDB: Store.put error:', event.target.error);
          reject(event.target.error);
        };
      });
      
      // Wait for transaction to complete
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
      });
      
      db.close();
      console.log('IndexedDB: Saved entry to archive:', entry.title);
      return true;
    } catch (error) {
      console.error('IndexedDB: Error saving entry:', error);
      console.error('IndexedDB: Error details:', error.name, error.message);
      return false;
    }
  },
  
  async getEntries() {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const entries = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      db.close();
      console.log('IndexedDB: Retrieved', entries.length, 'archived entries');
      return entries;
    } catch (error) {
      console.error('IndexedDB: Error getting entries:', error);
      return [];
    }
  },
  
  async deleteEntry(id) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise((resolve, reject) => {
        const request = store.delete(String(id));
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      db.close();
      console.log('IndexedDB: Deleted entry:', id);
      return true;
    } catch (error) {
      console.error('IndexedDB: Error deleting entry:', error);
      return false;
    }
  },
  
  async clearAll() {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      db.close();
      console.log('IndexedDB: Cleared all archived entries');
      return true;
    } catch (error) {
      console.error('IndexedDB: Error clearing entries:', error);
      return false;
    }
  },
  
  async testConnection() {
    try {
      console.log('IndexedDB: Testing connection...');
      const db = await this.openDB();
      console.log('IndexedDB: Connection test successful');
      db.close();
      return true;
    } catch (error) {
      console.error('IndexedDB: Connection test failed:', error);
      return false;
    }
  }
};

// === EMBEDDINGS STORAGE (Vertex AI vectors) ===
const EmbeddingsStorage = {
  dbName: 'vertex-embeddings',
  vectorsStore: 'vectors',

  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.vectorsStore)) {
          db.createObjectStore(this.vectorsStore, { keyPath: 'id' });
        }
      };
    });
  },

  async deleteVector(id) {
    try {
      const db = await this.openDB();
      const tx = db.transaction([this.vectorsStore], 'readwrite');
      const store = tx.objectStore(this.vectorsStore);
      await new Promise((resolve, reject) => {
        const req = store.delete(String(id));
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      db.close();
      return true;
    } catch (error) {
      // Non-fatal; embeddings cleanup failure shouldn't block entry deletion
      console.error('EmbeddingsStorage: Failed to delete vector for id', id, error);
      return false;
    }
  },

  async clearAllVectors() {
    try {
      const db = await this.openDB();
      const tx = db.transaction([this.vectorsStore], 'readwrite');
      const store = tx.objectStore(this.vectorsStore);
      await new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      db.close();
      return true;
    } catch (error) {
      console.error('EmbeddingsStorage: Failed to clear vectors', error);
      return false;
    }
  },

  async countVectorsForEntryIds(entryIds) {
    // Returns number of vectors whose id is in entryIds
    try {
      const db = await this.openDB();
      const tx = db.transaction([this.vectorsStore], 'readonly');
      const store = tx.objectStore(this.vectorsStore);
      const keys = await new Promise((resolve, reject) => {
        // getAllKeys is widely supported in MV3 IndexedDB
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      db.close();
      const idSet = new Set(entryIds.map(String));
      let count = 0;
      for (const key of keys) {
        if (idSet.has(String(key))) count += 1;
      }
      return count;
    } catch (error) {
      console.error('EmbeddingsStorage: Failed to count vectors by entry ids', error);
      return 0;
    }
  }
};

// Helper to count all stored vectors regardless of entry ids
EmbeddingsStorage.countAllVectors = async function() {
  try {
    const db = await this.openDB();
    const tx = db.transaction([this.vectorsStore], 'readonly');
    const store = tx.objectStore(this.vectorsStore);
    const keys = await new Promise((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return (keys || []).length;
  } catch (e) {
    return 0;
  }
};

// === USAGE MANAGER (Freemium caps) ===
const UsageManager = {
  KEY: 'usage',
  MAX_EMBEDS: 100,
  MAX_SEARCHES: 200,

  async getUsage() {
    const raw = await Utils.get(this.KEY) || {};
    // First-time initialization: seed embed count from existing vectors
    if (!raw.initialized) {
      const existingVectors = await EmbeddingsStorage.countAllVectors();
      const seeded = {
        embeds: existingVectors || 0,
        searches: raw.searches || 0,
        initialized: true
      };
      await Utils.set(this.KEY, seeded);
      return { embeds: seeded.embeds, searches: seeded.searches };
    }
    return { embeds: raw.embeds || 0, searches: raw.searches || 0 };
  },

  async consume(type) {
    const usage = await this.getUsage();
    if (type === 'embed') {
      if (usage.embeds >= this.MAX_EMBEDS) {
        console.log('UsageManager: EMBED cap reached', usage.embeds, '/', this.MAX_EMBEDS);
        return { allowed: false, remaining: 0, cap: this.MAX_EMBEDS };
      }
      usage.embeds += 1;
      console.log('UsageManager: EMBED consumed ->', usage.embeds, '/', this.MAX_EMBEDS);
    } else if (type === 'search') {
      if (usage.searches >= this.MAX_SEARCHES) {
        console.log('UsageManager: SEARCH cap reached', usage.searches, '/', this.MAX_SEARCHES);
        return { allowed: false, remaining: 0, cap: this.MAX_SEARCHES };
      }
      usage.searches += 1;
      console.log('UsageManager: SEARCH consumed ->', usage.searches, '/', this.MAX_SEARCHES);
    } else {
      return { allowed: false, error: 'Unknown usage type' };
    }
    await Utils.set(this.KEY, usage);
    const remaining = type === 'embed'
      ? Math.max(0, this.MAX_EMBEDS - usage.embeds)
      : Math.max(0, this.MAX_SEARCHES - usage.searches);
    return { allowed: true, remaining };
  },

  async getStatus() {
    const usage = await this.getUsage();
    return {
      embeds: usage.embeds,
      searches: usage.searches,
      maxEmbeds: this.MAX_EMBEDS,
      maxSearches: this.MAX_SEARCHES
    };
  }
};

// === EMBEDDINGS BACKFILL QUEUE ===
const EmbeddingBackfill = {
  QUEUE_KEY: 'embeddingQueue',
  RETRIES_KEY: 'embeddingRetryCounts',
  MAX_RETRIES: 5,
  PROCESS_DELAY_MS: 800,
  BACKOFF_BASE_MS: 5000,
  isProcessing: false,

  async init() {
    try {
      // Kick off a scan and process on startup
      await this.bootstrapScan();
      this.processQueue();
    } catch (_) {
      // ignore
    }
  },

  async loadQueue() {
    const list = await Utils.get(this.QUEUE_KEY);
    return Array.isArray(list) ? list.map(String) : [];
  },

  async saveQueue(queue) {
    await Utils.set(this.QUEUE_KEY, queue.map(String));
  },

  async loadRetries() {
    const obj = await Utils.get(this.RETRIES_KEY);
    return obj && typeof obj === 'object' ? obj : {};
  },

  async saveRetries(map) {
    await Utils.set(this.RETRIES_KEY, map);
  },

  async enqueue(id) {
    try {
      const strId = String(id);
      // Skip if vector already exists
      if (await EmbeddingManager.hasVector(strId)) return;
      const queue = await this.loadQueue();
      if (!queue.includes(strId)) {
        queue.push(strId);
        await this.saveQueue(queue);
        // Try to process soon
        this.processQueue();
      }
    } catch (_) {}
  },

  async dequeue() {
    const queue = await this.loadQueue();
    const id = queue.shift();
    await this.saveQueue(queue);
    return id;
  },

  async bootstrapScan() {
    // Find entries without vectors and enqueue them
    try {
      const entries = await Storage.getEntries();
      const allEntryIds = entries.map(e => String(e.id));
      // Get existing vector ids via count function's helper path: use getAllKeys by calling countVectors then diff
      const db = await EmbeddingsStorage.openDB();
      const tx = db.transaction(['vectors'], 'readonly');
      const store = tx.objectStore('vectors');
      const keys = await new Promise((resolve, reject) => {
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      db.close();
      const have = new Set((keys || []).map(k => String(k)));
      const missing = allEntryIds.filter(id => !have.has(String(id)));
      if (missing.length === 0) return;
      const queue = await this.loadQueue();
      let changed = false;
      for (const id of missing) {
        if (!queue.includes(String(id))) {
          queue.push(String(id));
          changed = true;
        }
      }
      if (changed) await this.saveQueue(queue);
    } catch (e) {
      // ignore scan errors
    }
  },

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      let guard = 0;
      while (guard++ < 10000) { // safety guard
        const queue = await this.loadQueue();
        if (queue.length === 0) break;
        const id = await this.dequeue();
        // Fetch entry by id
        const entries = await Storage.getEntries();
        const entry = entries.find(e => String(e.id) === String(id));
        if (!entry) {
          // Entry no longer exists; ensure vector cleanup and drop retry state
          const retries = await this.loadRetries();
          if (retries[id]) { delete retries[id]; await this.saveRetries(retries); }
          continue;
        }
        // If already has vector, skip
        if (await EmbeddingManager.hasVector(String(id))) {
          const retries = await this.loadRetries();
          if (retries[id]) { delete retries[id]; await this.saveRetries(retries); }
          continue;
        }
        // Attempt embedding
        let ok = false;
        try {
          ok = await EmbeddingManager.ensureVectorForEntry(entry);
        } catch (_) {
          ok = false;
        }
        if (!ok) {
          // Retry with backoff
          const retries = await this.loadRetries();
          const attempts = (retries[id] || 0) + 1;
          if (attempts <= this.MAX_RETRIES) {
            retries[id] = attempts;
            await this.saveRetries(retries);
            // Requeue to tail
            const q = await this.loadQueue();
            q.push(String(id));
            await this.saveQueue(q);
            // Delay with exponential backoff
            const backoff = Math.min(this.BACKOFF_BASE_MS * Math.pow(2, attempts - 1), 60_000);
            await new Promise(r => setTimeout(r, backoff));
          } else {
            // Give up for now; leave it for a future bootstrapScan
            if (retries[id]) { delete retries[id]; await this.saveRetries(retries); }
          }
        } else {
          // Success, small pacing delay
          await new Promise(r => setTimeout(r, this.PROCESS_DELAY_MS));
          const retries = await this.loadRetries();
          if (retries[id]) { delete retries[id]; await this.saveRetries(retries); }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
};

// === EMBEDDING MANAGER (auto-embed on save) ===
const EmbeddingManager = {
  proxyUrl: (globalThis.window && window.VERTEX_CONFIG && window.VERTEX_CONFIG.proxyUrl) || getDefaultProxyUrl(),
  model: (globalThis.window && window.VERTEX_CONFIG && window.VERTEX_CONFIG.model) || 'text-embedding-004',

  async hasVector(id) {
    try {
      const db = await EmbeddingsStorage.openDB();
      const tx = db.transaction(['vectors'], 'readonly');
      const store = tx.objectStore('vectors');
      const existing = await new Promise((resolve, reject) => {
        const req = store.get(String(id));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return !!existing;
    } catch (_) {
      return false;
    }
  },

  extractText(entry) {
    const parts = [];
    if (entry.title) parts.push(entry.title);
    if (entry.content) parts.push(entry.content);
    if (entry.text) parts.push(entry.text);
    return parts.join('\n\n').substring(0, 3000);
  },

  async embed(text) {
    if (!this.proxyUrl || !this.proxyUrl.trim()) {
      throw new Error('Proxy URL not configured');
    }
    // Allow custom proxy override from settings if present
    try {
      const settings = await Utils.get('extensionSettings');
      if (settings && settings.customProxyUrl) {
        this.proxyUrl = settings.customProxyUrl;
      }
    } catch (_) {}
    const payload = { text, task_type: 'RETRIEVAL_DOCUMENT' };
    const resp = await fetch(`${this.proxyUrl}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Extension-ID': chrome.runtime.id },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Proxy error ${resp.status}: ${t}`);
    }
    const data = await resp.json();
    if (!data.embedding) throw new Error('Invalid embed response');
    return data.embedding;
  },

  async ensureVectorForEntry(entry) {
    try {
      const id = String(entry.id);
      if (await this.hasVector(id)) return true;
      // If custom proxy configured, bypass freemium cap
      let hasCustomProxy = false;
      try {
        const settings = await Utils.get('extensionSettings') || {};
        hasCustomProxy = !!(settings.customProxyUrl && String(settings.customProxyUrl).trim());
      } catch (_) {}
      if (!hasCustomProxy) {
        // Check freemium cap before embedding
        const gate = await UsageManager.consume('embed');
        if (!gate.allowed) {
          // Notify popup to show upsell only once per page
          try {
            await chrome.runtime.sendMessage({ action: 'usage_cap_reached', type: 'embed' });
          } catch (_) {}
          // Persist pending warning for next popup open and pause auto-capture
          try {
            const payload = { type: 'embed', ts: Date.now() };
            await chrome.storage.local.set({ pendingUsageCapWarning: payload, autoCapturePaused: true });
          } catch (_) {}
          // Also show a system notification so users see it immediately
          try {
            await Utils.showNotification('Free embedding limit reached. Set a Custom Vertex Proxy URL in Settings to continue.');
          } catch (_) {}
          // Broadcast to all tabs to show on-page banner and pause auto-capture
          try {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
              try { await chrome.tabs.sendMessage(tab.id, { action: 'usage_cap_embed' }); } catch (_) {}
            }
          } catch (_) {}
          return false;
        }
      }
      const text = this.extractText(entry);
      if (!text || text.trim().length === 0) return false;
      const vector = await this.embed(text);
      const db = await EmbeddingsStorage.openDB();
      const tx = db.transaction(['vectors'], 'readwrite');
      const store = tx.objectStore('vectors');
      await new Promise((resolve, reject) => {
        const req = store.put({ id, vector });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      db.close();
      return true;
    } catch (e) {
      console.error('EmbeddingManager: ensureVectorForEntry failed:', e);
      return false;
    }
  }
};

// === STORAGE MANAGER ===
const Storage = {
  // Storage configuration
  MAX_RECENT_ENTRIES: 50, // Keep 50 most recent articles in chrome.storage.local
  STORAGE_WARNING_THRESHOLD: 4.5 * 1024 * 1024, // 4.5MB warning threshold (5MB limit)
  
  KEYS: {
    ENTRIES: 'entries',
    API_KEY: 'openai_api_key',
    SEARCH_STATE: 'searchState',
    SETUP_NOTE: 'setupNoteDismissed',
    USER_HEIGHT: 'userAnswerContentHeight',
    LAST_ERROR: 'lastError',
    SELECTED_ARTICLES: 'selectedArticles'
  },
  
  async getEntries() {
    // Get recent entries from chrome.storage.local (this should always work)
    const recentEntries = await Utils.get(this.KEYS.ENTRIES) || [];
    
    // Try to get archived entries from IndexedDB (this might fail)
    let archivedEntries = [];
    try {
      archivedEntries = await IndexedDBStorage.getEntries();
    } catch (error) {
      console.error('Storage: IndexedDB failed, using only recent entries:', error);
      // If IndexedDB fails, just return recent entries
      return recentEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    
    // Combine and sort by timestamp (most recent first)
    const allEntries = [...recentEntries, ...archivedEntries];
    allEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    console.log(`Storage: Retrieved ${recentEntries.length} recent + ${archivedEntries.length} archived = ${allEntries.length} total entries`);
    return allEntries;
  },
  
  async getRecentEntries() {
    // Get only recent entries from chrome.storage.local
    const recentEntries = await Utils.get(this.KEYS.ENTRIES) || [];
    return recentEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },
  
  async setEntries(entries) {
    await Utils.set(this.KEYS.ENTRIES, entries);
  },
  
  async addEntry(entry) {
    try {
      // Check storage before adding
      await this.checkAndManageStorage();
      
      // Add to recent entries in chrome.storage.local
      const recentEntries = await Utils.get(this.KEYS.ENTRIES) || [];
      recentEntries.push(entry);
      
      // Sort by timestamp (most recent first)
      recentEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Keep only MAX_RECENT_ENTRIES in chrome.storage.local
      if (recentEntries.length > this.MAX_RECENT_ENTRIES) {
        const entriesToArchive = recentEntries.slice(this.MAX_RECENT_ENTRIES);
        const recentToKeep = recentEntries.slice(0, this.MAX_RECENT_ENTRIES);
        
        // Archive older entries to IndexedDB
        for (const entryToArchive of entriesToArchive) {
          try {
            await IndexedDBStorage.saveEntry(entryToArchive);
          } catch (archiveError) {
            console.error('Storage: Failed to archive entry:', archiveError);
          }
        }
        
        await Utils.set(this.KEYS.ENTRIES, recentToKeep);
        console.log(`Storage: Archived ${entriesToArchive.length} entries, keeping ${recentToKeep.length} recent`);
      } else {
        await Utils.set(this.KEYS.ENTRIES, recentEntries);
      }

      // Gating: if no custom proxy and embed cap reached, do NOT embed
      try {
        const settings = await Utils.get('extensionSettings') || {};
        const hasCustomProxy = !!(settings.customProxyUrl && settings.customProxyUrl.trim());
        const status = await UsageManager.getStatus();
        if (!hasCustomProxy && status.embeds >= UsageManager.MAX_EMBEDS) {
          // Warn once per save attempt
          try { await Utils.showNotification('Free embedding limit reached. Set a Custom Vertex Proxy URL in Settings to continue.'); } catch (_) {}
        } else {
          // Ensure embedding exists for this new/updated entry (fire-and-forget)
          EmbeddingManager.ensureVectorForEntry(entry);
          // Also enqueue for reliable backfill in case of transient failures
          EmbeddingBackfill.enqueue(entry.id);
        }
      } catch (_) {
        // Best-effort gating; if it fails, skip embedding to be safe
      }
    } catch (error) {
      console.error('Storage: Error adding entry:', error);
      
      // If we get a quota error, try emergency archive
      if (error.message && error.message.includes('quota')) {
        console.log('Storage: Quota error detected, triggering emergency archive');
        await this.emergencyArchive();
        
        // Try to add the entry again after emergency archive
        try {
          const recentEntries = await Utils.get(this.KEYS.ENTRIES) || [];
          recentEntries.push(entry);
          recentEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          await Utils.set(this.KEYS.ENTRIES, recentEntries);
          console.log(`Storage: Successfully added entry after emergency archive`);
        } catch (retryError) {
          console.error('Storage: Failed to add entry even after emergency archive:', retryError);
        }
      }
    }
  },
  
  async updateEntry(entryId, updates) {
    const entries = await this.getEntries();
    const index = entries.findIndex(e => e.id === entryId);
    if (index !== -1) {
      entries[index] = { ...entries[index], ...updates };
      await this.setEntries(entries);
    }
  },
  
  async deleteEntry(entryId) {
    // Try to delete from recent entries first
    const recentEntries = await Utils.get(this.KEYS.ENTRIES) || [];
    const recentFiltered = recentEntries.filter(e => String(e.id) !== String(entryId));
    
    if (recentFiltered.length < recentEntries.length) {
      // Entry was in recent storage
      await Utils.set(this.KEYS.ENTRIES, recentFiltered);
      console.log('Storage: Deleted entry from recent storage:', entryId);
    } else {
      // Entry might be in archived storage
      await IndexedDBStorage.deleteEntry(entryId);
      console.log('Storage: Deleted entry from archived storage:', entryId);
    }

    // Always attempt to delete the corresponding embedding vector
    await EmbeddingsStorage.deleteVector(entryId);
  },
  
  async clearEntries() {
    await this.setEntries([]);
    await IndexedDBStorage.clearAll();
    await EmbeddingsStorage.clearAllVectors();
    // console cleanup: keep minimal logs
  },
  
  // Storage management methods
  async checkAndManageStorage() {
    try {
      // Check chrome.storage.local usage
      const usage = await chrome.storage.local.getBytesInUse();
      const usageMB = (usage / 1024 / 1024).toFixed(2);
      // debug usage only when needed
      
      // More aggressive threshold - archive when we reach 4MB
      if (usage > 4 * 1024 * 1024) {
        console.log('Storage: Quota limit reached, emergency archive triggered');
        await this.emergencyArchive();
      } else if (usage > this.STORAGE_WARNING_THRESHOLD) {
        // archive proactively without verbose logs
        await this.archiveOldEntries();
      }
    } catch (error) {
      console.error('Storage: Error checking storage usage:', error);
    }
  },
  
  async archiveOldEntries() {
    try {
      const recentEntries = await Utils.get(this.KEYS.ENTRIES) || [];
      
      if (recentEntries.length > this.MAX_RECENT_ENTRIES / 2) {
        // Archive half of the entries to make room
        const sortedEntries = recentEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const toKeep = sortedEntries.slice(0, this.MAX_RECENT_ENTRIES / 2);
        const toArchive = sortedEntries.slice(this.MAX_RECENT_ENTRIES / 2);
        
        // Archive older entries
        for (const entry of toArchive) {
          await IndexedDBStorage.saveEntry(entry);
        }
        
        // Keep only recent entries in chrome.storage.local
        await Utils.set(this.KEYS.ENTRIES, toKeep);
        
        // quiet log
      }
    } catch (error) {
      console.error('Storage: Error during archive:', error);
    }
  },
  
  async emergencyArchive() {
    try {
      const recentEntries = await Utils.get(this.KEYS.ENTRIES) || [];
      
      if (recentEntries.length > 10) {
        // Keep only the 10 most recent entries in emergency
        const sortedEntries = recentEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const toKeep = sortedEntries.slice(0, 10);
        const toArchive = sortedEntries.slice(10);
        
        // Archive older entries
        for (const entry of toArchive) {
          try {
            await IndexedDBStorage.saveEntry(entry);
          } catch (archiveError) {
            console.error('Storage: Failed to archive entry:', archiveError);
            // Continue with other entries even if one fails
          }
        }
        
        // Keep only recent entries in chrome.storage.local
        await Utils.set(this.KEYS.ENTRIES, toKeep);
        
        // quiet log
      }
    } catch (error) {
      console.error('Storage: Error during emergency archive:', error);
    }
  },
  
  async getStorageStats() {
    try {
      // Get recent entries (this should always work)
      const recentEntries = await Utils.get(this.KEYS.ENTRIES) || [];
      // quiet log
      
      // Get archived entries (this might fail)
      let archivedEntries = [];
      try {
        archivedEntries = await IndexedDBStorage.getEntries();
        // quiet log
      } catch (indexedDBError) {
        console.error('Storage: IndexedDB failed, using fallback:', indexedDBError);
        archivedEntries = [];
      }
      
      // Get storage usage (simplified to avoid consuming more space)
      let usage = 0;
      try {
        usage = await chrome.storage.local.getBytesInUse();
        // quiet log
      } catch (usageError) {
        console.error('Storage: Failed to get usage:', usageError);
      }
      
      // Get embedding counts
      let embeddedCount = 0; // across all existing entries (recent + archived)
      let embeddedRecentCount = 0; // across recent tier only
      try {
        const allEntries = [...recentEntries, ...archivedEntries];
        const allEntryIds = allEntries.map(e => e.id);
        embeddedCount = await EmbeddingsStorage.countVectorsForEntryIds(allEntryIds);
        embeddedRecentCount = await EmbeddingsStorage.countVectorsForEntryIds(recentEntries.map(e => e.id));
      } catch (embeddingError) {
        console.error('Storage: Failed to get embedding count:', embeddingError);
        embeddedCount = 0;
        embeddedRecentCount = 0;
      }
      
      const stats = {
        recentCount: recentEntries.length,
        archivedCount: archivedEntries.length,
        totalCount: recentEntries.length + archivedEntries.length,
        chromeStorageUsage: usage,
        chromeStorageUsageMB: (usage / 1024 / 1024).toFixed(2),
        embeddedCount: embeddedCount,
        embeddedRecentCount: embeddedRecentCount
      };
      
      // quiet log
      // Opportunistically trigger a backfill if we detect missing vectors
      try {
        if (stats.embeddedCount < stats.totalCount) {
          // Fire-and-forget; do not block stats
          EmbeddingBackfill.bootstrapScan().then(() => EmbeddingBackfill.processQueue());
        }
      } catch (_) { /* ignore */ }
      return stats;
    } catch (error) {
      console.error('Storage: Error getting storage stats:', error);
      return {
        recentCount: 0,
        archivedCount: 0,
        totalCount: 0,
        chromeStorageUsage: 0,
        chromeStorageUsageMB: '0.00',
        embeddedCount: 0
      };
    }
  },
  
  async getApiKey() {
    return await Utils.get(this.KEYS.API_KEY);
  },
  
  async setApiKey(apiKey) {
    await Utils.set(this.KEYS.API_KEY, apiKey);
  },
  
  async clearErrorStates() {
    const errorKeys = [
      this.KEYS.SEARCH_STATE,
      this.KEYS.LAST_ERROR,
      'errorState',
      'searchError',
      'semanticError'
    ];
    await Utils.remove(errorKeys);
  },
  
  async getStats() {
    const entries = await this.getEntries();
    const entryCount = entries.length;
    const totalWords = entries.reduce((sum, entry) => sum + (entry.wordCount || 0), 0);
    const totalSize = JSON.stringify(entries).length;
    
    return { entryCount, totalWords, totalSize };
  },
  
  async getSelectedArticleIds() {
    return await Utils.get(this.KEYS.SELECTED_ARTICLES) || [];
  },
  
  async setSelectedArticleIds(selectedIds) {
    await Utils.set(this.KEYS.SELECTED_ARTICLES, selectedIds);
  }
};

// === CONTENT SCRIPT MANAGER ===
const ContentScript = {
  async isReady(tabId) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      return response?.status === 'ready';
    } catch {
      return false;
    }
  },
  
  async inject(tabId) {
    try {
      // Content script should already be injected via manifest
      // Just wait a bit for it to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      console.error('Content script injection failed:', error);
      return false;
    }
  },
  
  async ensureReady(tabId) {
    if (await this.isReady(tabId)) {
      return true;
    }
    return await this.inject(tabId);
  },
  
  async extractText(tabId) {
    try {
      // First check if content script is ready
      if (!await this.isReady(tabId)) {
        // Try to inject and wait
        await this.inject(tabId);
        // Wait a bit more for initialization
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Check again
        if (!await this.isReady(tabId)) {
          throw new Error('Content script not available - cannot extract text from this page');
        }
      }
      
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'extract_text'
      });
      
      if (!response?.text) {
        throw new Error('No text extracted from page');
      }
      
      return response.text;
    } catch (error) {
      console.error('Text extraction error:', error);
      
      if (error.message.includes('Could not establish connection')) {
        throw new Error('Cannot access this page. Try refreshing the page or use a different tab.');
      }
      
      if (error.message.includes('Content script not available')) {
        throw new Error('Page not accessible. Try refreshing or use a different tab.');
      }
      
      throw error;
    }
  }
};

// === AI PROCESSING ===
const AI = {
  async cleanText(rawText) {
    if (!rawText || rawText.trim().length === 0) {
      return '';
    }
    
    // Use basic text cleaning (no OpenAI dependency)
    let cleaned = Utils.cleanText(rawText);
    
    // If text is too long, truncate
    if (cleaned.length > CONFIG.MAX_TEXT_LENGTH) {
      cleaned = Utils.truncateText(cleaned, CONFIG.MAX_TEXT_LENGTH);
    }
    
    return cleaned;
  },

};

// === SEARCH ENGINE ===
const Search = {
  async keywordSearch(query) {
    const entries = await Storage.getEntries();
    const queryLower = query.toLowerCase();
    
    const results = entries
      .map(entry => {
        const titleMatch = entry.title.toLowerCase().includes(queryLower);
        const textMatch = entry.text.toLowerCase().includes(queryLower);
        
        if (!titleMatch && !textMatch) return null;
        
        // Calculate relevance score
        const titleScore = titleMatch ? 10 : 0;
        const textScore = textMatch ? 5 : 0;
        const recencyScore = (Date.now() - new Date(entry.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        
        return {
          ...entry,
          relevanceScore: titleScore + textScore - recencyScore * 0.1
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return results;
  },
  
  async semanticSearch(query, filters = {}) {
    try {
      console.log('Background: Performing semantic search for:', query);
      
      // Check if we have the new semantic search available
      if (window.semanticSearchV2) {
        console.log('Background: Using SemanticSearchV2');
        const searchResult = await window.semanticSearchV2.semanticSearch(query, CONFIG.SEARCH_RESULTS_LIMIT);
        
        // Get the actual entries for the returned IDs
        const entries = await Storage.getEntries();
        const entryMap = new Map(entries.map(entry => [entry.id, entry]));
        
        const results = searchResult.results
          .map(({ id, score }) => {
            const entry = entryMap.get(id);
            if (!entry) return null;
            
            return {
              ...entry,
              similarity: Math.round(score * 100) / 100,
              searchType: 'semantic'
            };
          })
          .filter(Boolean);

        // Notify UI about fallback if needed
        if (searchResult.isFallback) {
          chrome.runtime.sendMessage({ action: 'hnswCold' });
        }

        console.log(`Background: SemanticSearchV2 returned ${results.length} results (${searchResult.isFallback ? 'fallback' : 'HNSW'})`);
        return this.applyFilters(results, filters);
      } else {
        // Fallback to old semantic search
        console.log('Background: Using fallback semantic search');
        return await this.fallbackSemanticSearch(query, filters);
      }
    } catch (error) {
      console.error('Background: Semantic search failed:', error);
      return { results: [], error: error.message };
    }
  },
  
  async fallbackSemanticSearch(query, filters) {
    // Fallback to enhanced keyword search
    const entries = await Storage.getEntries();
    const queryWords = query.toLowerCase().split(/\s+/);
    
    const results = entries
      .map(entry => {
        const content = `${entry.title} ${entry.text}`.toLowerCase();
        const matchScore = queryWords.reduce((score, word) => {
          const occurrences = (content.match(new RegExp(word, 'g')) || []).length;
          return score + occurrences;
        }, 0);
        
        return matchScore > 0 ? { ...entry, similarity: matchScore / queryWords.length } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20);
    
    return this.applyFilters(results, filters);
  },
  
  applyFilters(results, filters) {
    if (!filters) return results;
    
    let filtered = [...results];
    
    // Apply time filter
    if (filters.timeFilter && filters.timeFilter !== 'any') {
      const now = Date.now();
      const timeRanges = {
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000
      };
      
      const timeRange = timeRanges[filters.timeFilter];
      if (timeRange) {
        filtered = filtered.filter(entry => {
          const entryTime = new Date(entry.timestamp).getTime();
          return (now - entryTime) <= timeRange;
        });
      }
    }
    
    return filtered;
  }
};

// === TEXT EXTRACTION ===
const TextExtractor = {
  async extractFromTab(tab) {
    if (!this.isValidTab(tab)) {
      throw new Error('Cannot extract text from system pages');
    }
    
    const text = await ContentScript.extractText(tab.id);
    const cleanedText = await AI.cleanText(text);
    
    if (!cleanedText || cleanedText.trim().length === 0) {
      throw new Error('No meaningful content found');
    }
    
    return this.createEntry(tab, cleanedText);
  },
  
  isValidTab(tab) {
    return Utils.isValidUrl(tab.url) && !Utils.isSystemPage(tab.url);
  },
  
  createEntry(tab, text) {
    return {
      id: Utils.getCurrentTimestamp(),
      url: tab.url,
      title: tab.title || 'Untitled',
      text: text,
      timestamp: new Date().toISOString(),
      wordCount: Utils.countWords(text)
    };
  },
  
  validateEntry(entry) {
    // Check required fields
    if (!entry || typeof entry !== 'object') {
      console.error('TextExtractor: Entry is not an object:', entry);
      return false;
    }
    
    if (!entry.url || typeof entry.url !== 'string') {
      console.error('TextExtractor: Entry missing valid URL:', entry);
      return false;
    }
    
    if (!entry.text || typeof entry.text !== 'string' || entry.text.trim().length === 0) {
      console.error('TextExtractor: Entry missing valid text content:', entry);
      return false;
    }
    
    if (!entry.title || typeof entry.title !== 'string') {
      entry.title = 'Untitled'; // Fix missing title
      console.log('TextExtractor: Fixed missing title for entry');
    }
    
    if (!entry.timestamp) {
      entry.timestamp = new Date().toISOString(); // Fix missing timestamp
      console.log('TextExtractor: Fixed missing timestamp for entry');
    }
    
    if (!entry.wordCount || typeof entry.wordCount !== 'number') {
      entry.wordCount = Utils.countWords(entry.text); // Fix missing word count
      console.log('TextExtractor: Fixed missing word count for entry');
    }
    
    return true;
  },
  
  async saveEntry(entry, skipDuplicateCheck = false) {
    // Validate and fix entry data
    if (!this.validateEntry(entry)) {
      throw new Error('Invalid entry data provided');
    }
    
    // Ensure entry has an ID
    if (!entry.id) {
      entry.id = Utils.getCurrentTimestamp();
      console.log('TextExtractor: Generated missing ID for entry:', entry.id);
    }
    
    // Check for duplicates (unless explicitly skipped)
    if (!skipDuplicateCheck) {
      const entries = await Storage.getEntries();
      const existing = entries.find(e => e.url === entry.url);
      
      if (existing) {
        const shouldReplace = await this.askUserForReplacement(entry, existing);
        if (!shouldReplace) {
          return false;
        }
        await Storage.deleteEntry(existing.id);
      }
    }
    
    await Storage.addEntry(entry);
    
    return true;
  },
  
  async askUserForReplacement(newEntry, existingEntry) {
    try {
      console.log('Asking user for replacement decision...');
      
      // Try to communicate with the popup using runtime message
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'showDuplicateModal',
          originalEntry: existingEntry,
          newEntry: newEntry
        });
        
        if (response && response.success) {
          return response.shouldReplace;
        }
      } catch (runtimeError) {
        console.log('Runtime message failed:', runtimeError.message);
      }
      
      // Fallback: show notification and keep original (don't auto-replace)
      await Utils.showNotification(`⚠️ Article "${existingEntry.title}" already exists. Keeping original version.`);
      return false; // Keep original instead of replacing
      
    } catch (error) {
      console.error('Failed to handle duplicate:', error);
      return false; // Default to keep original on error
    }
  }
};

// Global flag to prevent duplicate notebook operations
let isNotebookOperationInProgress = false;
// Track tabs created by our extension to prevent auto-detection
let extensionCreatedTabs = new Set();

// === MESSAGE HANDLERS ===
const MessageHandler = {
  handlers: {
    ping: () => ({ status: 'ok', timestamp: Date.now() }),
    
    get_entries: async () => {
      const entries = await Storage.getEntries();
      return { entries };
    },
    
    get_recent_entries: async () => {
      const entries = await Storage.getRecentEntries();
      return { entries };
    },
    
    search_keywords: async (message) => {
      const results = await Search.keywordSearch(message.query);
      return { results };
    },
    
    search_similar: async (message) => {
      const results = await Search.semanticSearch(message.query, message.filters);
      return { results };
    },
    
    search: async (message) => {
      // New semantic search endpoint
      if (window.semanticSearchV2) {
        const searchResult = await window.semanticSearchV2.semanticSearch(message.q, message.k || 10);
        return searchResult;
      } else {
        // Fallback to old search
        const results = await Search.semanticSearch(message.q, {});
        return { results: results.results || results };
      }
    },
    
    clear_entries: async () => {
      await Storage.clearEntries();
      return { success: true };
    },
    
    get_stats: async () => {
      const stats = await Storage.getStats();
      return { stats };
    },
    
    get_storage_stats: async () => {
      const stats = await Storage.getStorageStats();
      return { stats };
    },

    showNotification: async (message) => {
      try {
        const text = message && message.message ? message.message : 'Notification';
        await Utils.showNotification(text);
        return { success: true };
      } catch (e) {
        console.error('Background: showNotification failed:', e);
        return { success: false, error: e.message };
      }
    },
    
    usage_consume: async (message) => {
      // message.usageType in {'embed','search'}
      const type = message.usageType === 'search' ? 'search' : 'embed';
      const res = await UsageManager.consume(type);
      return res;
    },
    
    usage_status: async () => {
      const status = await UsageManager.getStatus();
      // Also include whether a custom proxy is configured
      const settings = await Utils.get('extensionSettings') || {};
      return { ...status, hasCustomProxy: !!(settings.customProxyUrl && settings.customProxyUrl.trim()) };
    },

    broadcast_usage_cap_embed: async () => {
      try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          try { await chrome.tabs.sendMessage(tab.id, { action: 'usage_cap_embed' }); } catch (_) {}
        }
      } catch (_) {}
      return { success: true };
    },

    open_extension_settings: async () => {
      try {
        // Best effort: open the popup (or side panel if configured) so user can switch to Settings
        if (chrome.sidePanel && chrome.sidePanel.open) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) await chrome.sidePanel.open({ windowId: tab.windowId });
        } else {
          await chrome.action.setPopup({ popup: 'popup.html' });
          // Request the popup script to switch to settings when it loads
          try { await chrome.runtime.sendMessage({ action: 'open_settings_tab' }); } catch (_) {}
          if (chrome.action.openPopup) {
            try { await chrome.action.openPopup(); return { success: true }; } catch (_) {}
          }
          // Fallback: open the extension page in a new tab directly at the settings route
          const url = chrome.runtime.getURL('popup.html#settings');
          await chrome.tabs.create({ url });
        }
        return { success: true };
      } catch (e) {
        // Fallback to a notification if we can't programmatically open
        await Utils.showNotification('Open the extension and go to Settings → Custom Vertex Proxy URL.');
        return { success: false, error: e.message };
      }
    },
    
    test_indexeddb: async () => {
      const result = await IndexedDBStorage.testConnection();
      return { success: result };
    },
    
    check_duplicate: async (message) => {
      const entries = await Storage.getEntries();
      const existing = entries.find(e => e.url === message.entry.url);
      
      if (existing) {
        return {
          isDuplicate: true,
          existingEntry: existing
        };
      }
      
      return {
        isDuplicate: false
      };
    },
    
    clear_error_states: async () => {
      await Storage.clearErrorStates();
      return { success: true };
    },
    
    set_api_key: async (message) => {
      await Storage.setApiKey(message.apiKey);
      return { success: true };
    },
    
    delete_entry: async (message) => {
      await Storage.deleteEntry(message.entryId);
      return { success: true };
    },
    
    capture_page: async (message) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          throw new Error('No active tab found');
        }
        
        const entry = await TextExtractor.extractFromTab(tab);
        const saveResult = await TextExtractor.saveEntry(entry);
        
        if (saveResult === true) {
          return { success: true, entry: entry, action: 'saved' };
        } else if (saveResult === false) {
          return { success: true, entry: entry, action: 'kept_original' };
        } else {
          return { success: false, error: 'Unexpected save result' };
        }
      } catch (error) {
        console.error('Capture button: Page capture failed:', error);
        return { success: false, error: error.message };
      }
    },

    update_auto_capture_setting: async (message) => {
      try {
        // Broadcast the setting change to all content scripts
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'update_auto_capture_setting',
              enabled: message.enabled,
              webReminderEnabled: message.webReminderEnabled,
              autoCaptureDelayMs: message.autoCaptureDelayMs
            });
          } catch (error) {
            // Ignore errors for tabs that don't have content scripts
          }
        }
        // If a custom proxy was set, clear the paused flag to resume auto-capture
        try {
          const settings = await Utils.get('extensionSettings') || {};
          const hasCustomProxy = !!(settings.customProxyUrl && String(settings.customProxyUrl).trim());
          if (hasCustomProxy) {
            await chrome.storage.local.remove('autoCapturePaused');
          }
        } catch (_) {}
        return { success: true };
      } catch (error) {
        console.error('Failed to update auto-capture setting:', error);
        return { success: false, error: error.message };
      }
    },
    
    refresh_display: async (message) => {
      try {
        // Broadcast to all popup instances
        chrome.runtime.sendMessage({
          action: 'refresh_display'
        }).catch(() => {
          // Popup might not be open, ignore
        });
        return { success: true };
      } catch (error) {
        console.error('Background: Error refreshing display:', error);
        return { success: false, error: error.message };
      }
    },

    save_entry: async (message) => {
      try {
        const saveResult = await TextExtractor.saveEntry(message.entry, message.skipDuplicateCheck);
        
        if (saveResult === true) {
          return { success: true, entry: message.entry, action: 'saved' };
        } else if (saveResult === false) {
          return { success: true, entry: message.entry, action: 'kept_original' };
        } else {
          return { success: false, error: 'Unexpected save result' };
        }
      } catch (error) {
        console.error('Background: save_entry failed:', error);
        return { success: false, error: error.message };
      }
    }
  },
  
  async handle(message, sender, sendResponse) {
    try {
      const handler = this.handlers[message.action];
      if (!handler) {
        throw new Error(`Unknown action: ${message.action}`);
      }
      
      const result = await handler(message, sender);
      sendResponse(result);
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ error: error.message });
    }
  }
};

// === EXTENSION LIFECYCLE ===
const ExtensionManager = {
  init() {
    this.setupEventListeners();
    this.scheduleCleanup();
    // Start embeddings backfill on startup (non-blocking)
    try { EmbeddingBackfill.init(); } catch (_) {}
  },
  
  setupEventListeners() {
    // Extension lifecycle
    chrome.runtime.onStartup.addListener(this.onStartup.bind(this));
    chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
    
    // User interactions
    chrome.action?.onClicked.addListener(this.onActionClicked.bind(this));
    
    // Command shortcuts
    if (chrome.commands) {
      chrome.commands.onCommand.addListener(this.onCommand.bind(this));
      
      // Log available commands for debugging
      chrome.commands.getAll().then(commands => {
    
      }).catch(error => {
        console.error('Failed to get commands:', error);
      });
    } else {
      console.error('Chrome commands API not available');
    }
    
    // Tab monitoring for NotebookLM auto-detection
    chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this));
    
    // Side panel setup
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      try {
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      } catch (error) {
        console.error('Failed to set side panel behavior:', error);
      }
    } else {
      console.log('Side panel API not available, will use popup fallback');
    }
    
    // Message handling
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle incoming messages
      
      if (message.action === 'addArticlesToNotebookLM') {
        // Handle NotebookLM export
        addArticlesToNotebookLM(message.notebookId, message.articles);
        sendResponse({ success: true });
        return true; // Keep sendResponse alive for async operations
      
      } else if (message.action === 'save_selected_articles') {
        // Save selected articles
        Storage.setSelectedArticleIds(message.selectedIds);
        sendResponse({ success: true });
        return true;
      } else if (message.action === 'get_selected_articles') {
        // Get selected articles
        Storage.getSelectedArticleIds().then(selectedIds => {
          sendResponse({ selectedIds: selectedIds });
        });
        return true;
      } else if (message.action) {
        // Handle other actions
        // Handle other messages with MessageHandler
        MessageHandler.handle(message, sender, sendResponse);
        return true; // Keep sendResponse alive for async operations
      } else {
        console.log('Background: Message without action property:', message);
        sendResponse({ error: 'Message missing action property' });
        return false;
      }
    });
  },
  
  onStartup() {
    // Extension startup
  },
  
  onInstalled(details) {
    Storage.clearErrorStates();
    
    // Set up side panel
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      try {
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      } catch (error) {
        console.error('Failed to set side panel behavior on install:', error);
      }
    } else {
      console.log('Side panel API not available on install');
    }
    
    // Log available commands and test command registration
    if (chrome.commands) {
      chrome.commands.getAll().then(commands => {
        
        
        // Test if our command is properly registered
        const capturePage = commands.find(cmd => cmd.name === 'capture_page');
        if (capturePage) {
          console.log('✅ capture_page command found:', capturePage);
        } else {
          console.error('❌ capture_page command NOT found in available commands');
        }
      }).catch(error => {
        console.error('Failed to get commands:', error);
      });
    } else {
      console.error('❌ Chrome commands API not available');
    }
  },
  
  async onActionClicked(tab) {
    try {
      console.log('=== EXTENSION ICON CLICKED ===');
      console.log('Tab info:', tab);
      console.log('Chrome APIs available:');
      console.log('- chrome.sidePanel:', !!chrome.sidePanel);
      console.log('- chrome.sidePanel.open:', !!(chrome.sidePanel && chrome.sidePanel.open));
      console.log('- chrome.sidePanel.setPanelBehavior:', !!(chrome.sidePanel && chrome.sidePanel.setPanelBehavior));
      
      // Try to open side panel if available
      if (chrome.sidePanel && chrome.sidePanel.open) {
        console.log('Attempting to open side panel...');
        await chrome.sidePanel.open({ windowId: tab.windowId });
        console.log('Side panel opened successfully');
      } else {
        console.log('Side panel API not available, showing notification...');
        // Show a notification to the user
        await Utils.showNotification('Side panel not available in this Chrome version. Please use the extension in popup mode.', 'warning');
        
        // Try to set popup as fallback
        try {
          await chrome.action.setPopup({ popup: 'popup.html' });
          console.log('Popup set as fallback');
        } catch (popupError) {
          console.error('Failed to set popup fallback:', popupError);
        }
      }
    } catch (error) {
      console.error('Error in onActionClicked:', error);
      await Utils.showNotification('Failed to open extension interface', 'error');
    }
  },

  // Monitor tab updates for NotebookLM auto-detection and auto-capture
  async onTabUpdated(tabId, changeInfo, tab) {
    // Only process when tab is completely loaded and URL exists
    if (changeInfo.status === 'complete' && tab.url) {
      console.log('NotebookLM: Tab updated - ID:', tabId, 'URL:', tab.url);
      
      // Check for auto-capture on all pages (not just NotebookLM)
      await this.triggerAutoCapture(tabId, tab.url);
      
      // Check for NotebookLM auto-detection
      const notebookUrlPattern = /^https:\/\/notebooklm\.google\.com.*\/notebook\/([a-zA-Z0-9_-]+)/;
      const match = tab.url.match(notebookUrlPattern);
      
      if (match) {
        const notebookId = match[1];
        console.log('NotebookLM: Auto-detected notebook opened:', notebookId, 'Tab ID:', tabId);
        console.log('NotebookLM: Extension created tabs:', Array.from(extensionCreatedTabs));
        console.log('NotebookLM: Is operation in progress:', isNotebookOperationInProgress);
        
        // Check if a notebook operation is already in progress
        if (isNotebookOperationInProgress) {
          console.log('NotebookLM: Operation already in progress, skipping auto-detection');
          return;
        }
        
        // Check if we have pending articles to export
        const entries = await Storage.getEntries();
        const selectedArticleIds = await Storage.getSelectedArticleIds();
        const selectedEntries = entries.filter(entry => selectedArticleIds.includes(String(entry.id)));
        
        if (selectedEntries.length > 0) {
          console.log('NotebookLM: Found selected articles, auto-triggering export');
          
          // Set flag to prevent duplicate operations
          isNotebookOperationInProgress = true;
          
          // Show notification about auto-export
          await Utils.showNotification(
            `Auto-detected NotebookLM notebook! Starting export of ${selectedEntries.length} selected articles...`,
            'basic'
          );
          
          // Send message to popup if it's open
          try {
            chrome.runtime.sendMessage({
              type: 'NOTEBOOKLM_AUTO_DETECTED',
              message: `Auto-detected NotebookLM notebook! Starting export of ${selectedEntries.length} selected articles...`,
              notebookId: notebookId,
              articleCount: selectedEntries.length
            });
          } catch (error) {
            console.log('Popup not open, continuing with background export');
          }
          
          // Trigger the export process with longer delay for page readiness
          setTimeout(() => {
            addArticlesToNotebookLM(notebookId, selectedEntries);
          }, 3000); // Longer delay to ensure NotebookLM page is fully ready
        } else {
          console.log('NotebookLM: No selected articles found for auto-export');
          
          // Still notify popup about detection
          try {
            chrome.runtime.sendMessage({
              type: 'NOTEBOOKLM_AUTO_DETECTED',
              message: 'NotebookLM notebook detected! Select articles and click "Export to NotebookLM" to start.',
              notebookId: notebookId,
              articleCount: 0
            });
          } catch (error) {
            console.log('Popup not open');
          }
        }
      }
    }
  },

  // Trigger auto-capture for a specific tab
  async triggerAutoCapture(tabId, url) {
    try {
      // Skip certain URLs
      if (url.startsWith('chrome://') || 
          url.startsWith('chrome-extension://') || 
          url.startsWith('moz-extension://') ||
          url.includes('notebooklm.google.com')) {
        return;
      }

      // Get auto-capture setting and paused state
      const { extensionSettings, autoCapturePaused } = await chrome.storage.local.get(['extensionSettings','autoCapturePaused']);
      const settings = extensionSettings || {};
      const autoCaptureEnabled = (settings.autoCaptureEnabled !== undefined) ? settings.autoCaptureEnabled : true;
      const hasCustomProxy = !!(settings.customProxyUrl && String(settings.customProxyUrl).trim());
      if (autoCapturePaused && !hasCustomProxy) {
        // Pause auto-capture globally until user provides a custom proxy URL, but show banner on page
        try { await chrome.tabs.sendMessage(tabId, { action: 'usage_cap_embed' }); } catch (_) {}
        return;
      }
      
      if (!autoCaptureEnabled) {
        return;
      }

      // Send message to content script to trigger auto-capture
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: 'trigger_auto_capture'
        });
      } catch (error) {
        // Content script might not be ready yet, ignore
      }
    } catch (error) {
      console.error('Background: Error in triggerAutoCapture:', error);
    }
  },
  
  async onCommand(command) {
    if (command === 'capture_page') {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab) {
          await this.extractTextFromTab(tab);
        } else {
          console.error('No active tab found');
          Utils.showNotification('No active tab found', 'error');
        }
      } catch (error) {
        console.error('Command execution failed:', error);
        Utils.showNotification('Failed to capture page text', 'error');
      }
    } else {
      console.log('Unknown command:', command);
    }
  },
  
  async extractTextFromTab(tab) {
    try {
      // Send loading notification to popup
      await this.notifyPopupNotification('📄 Capturing...', 'info');
      
      const entry = await TextExtractor.extractFromTab(tab);
      const saveResult = await TextExtractor.saveEntry(entry);
      
      if (saveResult === true) {
        try {
          await this.notifyPopupNotification(`✅ Captured: ${entry.title}`, 'success');
        } catch (error) {
          console.error('Failed to send success notification:', error);
        }
      } else if (saveResult === false) {
        try {
          await this.notifyPopupNotification(`📄 Kept original: ${entry.title}`, 'info');
        } catch (error) {
          console.error('Failed to send kept original notification:', error);
        }
      } else {
        await this.notifyPopupNotification('❌ Unexpected error during capture', 'error');
      }
      
      // Notify popup to refresh display after successful capture
      try {
        await this.notifyPopupRefresh();
        // Also set a timestamp for when popup opens
        await chrome.storage.local.set({ 'lastCaptureCheck': Date.now() });
      } catch (error) {
        console.error('Failed to notify popup refresh:', error);
      }
    } catch (error) {
      console.error('Text extraction failed:', error);
      await this.notifyPopupNotification(`❌ Failed to capture text: ${error.message}`, 'error');
    }
  },
  
  async notifyPopupNotification(message, type = 'info') {
    try {
      await chrome.runtime.sendMessage({ 
        action: 'showNotification', 
        message: message, 
        type: type 
      });
    } catch (error) {
      // Popup might not be open, which is fine
      console.log('Popup not open for notification:', error.message);
    }
  },
  
  async notifyPopupRefresh() {
    try {
      // Try to send message to popup to refresh display
      await chrome.runtime.sendMessage({ action: 'refreshDisplay' });
    } catch (error) {
      // Popup might not be open, which is fine
      console.log('Popup not open or failed to send refresh message:', error.message);
    }
  },
  
  scheduleCleanup() {
    // Run cleanup every 24 hours
    setInterval(async () => {
      try {
        await Storage.clearErrorStates();
        
        // Clean up old entries if needed
        const stats = await Storage.getStats();
        if (stats.totalSize > 50 * 1024 * 1024) { // 50MB limit
          console.log('Storage cleanup needed');
          // Implement cleanup logic here
        }
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }, CONFIG.CLEANUP_INTERVAL);
  },

  // Debug helpers fully removed
};

/**
 * Open NotebookLM notebook and trigger UI automation (based on NLM_YT_automator pattern)
 * @param {string} notebookId - The NotebookLM notebook ID
 * @param {Array} driveFiles - Optional, can be empty for now
 */


/**
 * Add all captured articles as sources to a NotebookLM notebook
 * @param {string} notebookId - The NotebookLM notebook ID
 * @param {Array} articles - Array of captured articles to add as sources
 */
async function addArticlesToNotebookLM(notebookId, articles) {
  // Add articles to NotebookLM notebook
  
  // Set flag to prevent duplicate operations
  isNotebookOperationInProgress = true;
  
  let tabId = null;
  let progressNotificationId = null;
  let isExistingTab = false;
  
  try {
    // 1. Check if the notebook is already open in an existing tab
    // Look for existing NotebookLM tab
    
    // Use flexible URL matching to find existing tabs - don't assume u/0 pattern
    const allTabs = await chrome.tabs.query({});
    const existingTabs = allTabs.filter(tab => {
      if (!tab.url) return false;
      // Check if URL contains the notebook ID and is a NotebookLM URL
      return tab.url.includes('notebooklm.google.com') && tab.url.includes(`/notebook/${notebookId}`);
    });
    
    const notebookUrl = existingTabs.length > 0 ? existingTabs[0].url : `https://notebooklm.google.com/notebook/${notebookId}`;
    
    // Check existing tabs
    
    if (existingTabs.length > 0) {
      // Use the first existing tab
      tabId = existingTabs[0].id;
      isExistingTab = true;
      // Validate the existing tab is in a good state
      try {
        const tabInfo = await chrome.tabs.get(tabId);
        
        // Check if tab is in a valid state
        if (tabInfo.status === 'loading' || tabInfo.status === 'complete') {
          // Activate the existing tab
          await chrome.tabs.update(tabId, { active: true });
        } else {
          // Create new tab if existing one is in bad state
          const tab = await chrome.tabs.create({ url: notebookUrl });
          tabId = tab.id;
          isExistingTab = false;
          extensionCreatedTabs.add(tabId);
        }
      } catch (error) {
        console.error('NotebookLM: Error validating existing tab, creating new one:', error);
        // Create new tab if existing one is invalid
        const tab = await chrome.tabs.create({ url: notebookUrl });
        tabId = tab.id;
        isExistingTab = false;
        extensionCreatedTabs.add(tabId);
        // Tab created due to validation error
      }
    } else {
      // Create new tab if notebook is not already open
      const tab = await chrome.tabs.create({ url: notebookUrl });
      tabId = tab.id;
      isExistingTab = false;
      extensionCreatedTabs.add(tabId);
      // New tab created
      
      // Add a small delay to ensure tracking is set before onTabUpdated fires
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 2. Show progress notification
    const notificationMessage = isExistingTab 
      ? `Adding ${articles.length} articles to existing NotebookLM tab...\n\n⚠️ Please DO NOT close the NotebookLM tab until injection is complete!`
      : `Adding ${articles.length} articles to NotebookLM...\n\n⚠️ Please DO NOT close the NotebookLM tab until injection is complete!`;
    
    progressNotificationId = await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
              title: '🧠 Knowledge Auto-captured & AI Search - Auto-Injecting',
      message: notificationMessage,
      priority: 2,
      requireInteraction: true
    });

    // 3. Add tab protection - prevent accidental closure
    const tabProtection = () => {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // Add beforeunload warning
          const originalBeforeUnload = window.onbeforeunload;
          window.onbeforeunload = (e) => {
            e.preventDefault();
            e.returnValue = '⚠️ Auto-injection in progress! Closing this tab will interrupt the process. Are you sure you want to leave?';
            return e.returnValue;
          };

          // Also add bfcache-safe cleanup hooks
          const cleanupProtection = () => {
            try {
              if (window.knowledgeCaptureOriginalBeforeUnload) {
                window.onbeforeunload = window.knowledgeCaptureOriginalBeforeUnload;
              } else {
                window.onbeforeunload = null;
              }
            } catch (_) {}
          };
          window.addEventListener('pagehide', cleanupProtection, { once: true });
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
              cleanupProtection();
            }
          }, { once: true });

          // Store original function for cleanup
          window.knowledgeCaptureOriginalBeforeUnload = originalBeforeUnload;

          // Safety timeout to ensure it never lingers
          try {
            window.setTimeout(cleanupProtection, 3 * 60 * 1000); // 3 minutes
          } catch (_) {}
        }
      });
    };

    // 4. Wait for the tab to load and ensure content script is injected
    if (isExistingTab) {
      // For existing tabs, proceed with injection immediately
      // Using existing tab
      
      // Add tab protection and start injection
      tabProtection();
      
      // Add a small delay to ensure tab is stable, then start injection
      setTimeout(() => {
        startInjectionProcess();
      }, 500);
    } else {
      // For new tabs, wait for load completion
    chrome.tabs.onUpdated.addListener(function listener(tId, info) {
      if (tId === tabId && info.status === "complete") {
          // Ensure content script is injected in new tab
        
        // Remove the listener to avoid multiple injections
        chrome.tabs.onUpdated.removeListener(listener);
        
          // Add tab protection
          tabProtection();
          
          // Ensure we only inject into NotebookLM
          chrome.tabs.get(tabId).then((tabInfo) => {
            const isNotebookLm = !!(tabInfo && typeof tabInfo.url === 'string' && tabInfo.url.startsWith('https://notebooklm.google.com/'));
            if (!isNotebookLm) {
              cleanupAndShowError('Target tab is not a NotebookLM page.');
              return;
            }
            // First, ensure the content script is injected
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['notebooklm_automation.js']
            }).then(() => {
              // Content script injected
              startInjectionProcess();
            }).catch((error) => {
              console.error('NotebookLM: Failed to inject content script:', error);
              cleanupAndShowError('Failed to inject content script');
            });
          }).catch((error) => {
            console.error('NotebookLM: Failed to get tab info before injection:', error);
            cleanupAndShowError('Failed to verify target tab');
          });
        }
      });
    }
    
    // Helper function to start the injection process
    function startInjectionProcess() {
      // First, validate that the tab still exists and is NotebookLM
      chrome.tabs.get(tabId).then((tab) => {
        console.log('NotebookLM: Tab validation successful, tab exists:', tab.id);
        const isNotebookLm = !!(tab && typeof tab.url === 'string' && tab.url.startsWith('https://notebooklm.google.com/'));
        if (!isNotebookLm) {
          cleanupAndShowError('Target tab is not a NotebookLM page.');
          return;
        }
        
        // First, ensure the content script is injected
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['notebooklm_automation.js']
        }).then(() => {
          // Content script injected

          // Wait for the content script to be ready by checking for the indicator
          const checkReady = () => {
            // Validate tab exists before each check
            chrome.tabs.get(tabId).then(() => {
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {
                  // Check if we're actually on a notebook page (not just NotebookLM home)
                  if (!window.location.href.includes('/notebook/')) {
                    console.log('NotebookLM: Not on a notebook page yet');
                    return false;
                  }
                  
                  // Check for indicator first
                  const indicator = document.getElementById('notebooklm-automation-indicator');
                  if (indicator) {
                    return true;
                  }
                  
                  // Fallback: check if content script functions are available
                  if (typeof addArticlesAsSources === 'function') {
                    return true;
                  }
                  
                  // Fallback: check if message listener is set up
                  if (window.notebooklmAutomationReady) {
                    return true;
                  }
                  
                  return false;
                }
              }).then((results) => {
                if (results[0] && results[0].result) {
                  console.log('NotebookLM: Content script is ready, sending automation message');
          chrome.tabs.sendMessage(tabId, {
            type: "AUTOMATE_ADD_ARTICLES",
            articles: articles
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('NotebookLM: Error sending message:', chrome.runtime.lastError.message);
                      cleanupAndShowError(chrome.runtime.lastError.message);
            } else if (response) {
              console.log('NotebookLM: Content script response:', response);
                      // Start monitoring for completion
                      monitorInjectionProgress();
            } else {
              console.log('NotebookLM: No immediate response from content script');
                      monitorInjectionProgress();
            }
          });
                } else {
                  // Content script not ready yet, retry after a short delay
                  // Add timeout to prevent infinite waiting
                  if (checkReady.attempts === undefined) {
                    checkReady.attempts = 0;
                  }
                  checkReady.attempts++;
                  
                  if (checkReady.attempts > 100) { // 10 seconds max - longer for NotebookLM to fully load
                    console.error('NotebookLM: Content script readiness timeout after 10 seconds');
                    cleanupAndShowError('NotebookLM page took too long to load. Please try again.');
                    return;
                  }
                  
                  setTimeout(checkReady, 100);
                }
              }).catch((error) => {
                console.error('NotebookLM: Error checking content script readiness:', error);
                cleanupAndShowError('Failed to check content script readiness');
              });
            }).catch((error) => {
              console.error('NotebookLM: Tab no longer exists during readiness check:', error);
              cleanupAndShowError('NotebookLM tab was closed during injection');
            });
          };
          
          // Start checking for readiness
          checkReady();
        }).catch((error) => {
          console.error('NotebookLM: Failed to inject content script:', error);
          cleanupAndShowError('Failed to inject content script');
        });
      }).catch((error) => {
        console.error('NotebookLM: Tab validation failed, tab does not exist:', error);
        cleanupAndShowError('NotebookLM tab was closed or does not exist');
      });
    }
    
  } catch (error) {
    console.error('NotebookLM: Failed to add articles:', error);
    cleanupAndShowError('Failed to start injection process');
}

  // Monitor injection progress and cleanup
  function monitorInjectionProgress() {
    let checkCount = 0;
    const maxChecks = 120; // 60 seconds max - NotebookLM can be slow
    
    const checkProgress = () => {
      // Check injection progress
      chrome.tabs.sendMessage(tabId, { type: "CHECK_INJECTION_STATUS" }, (response) => {
        if (chrome.runtime.lastError) {
          // Tab might be closed or content script not responding
          if (checkCount < maxChecks) {
            checkCount++;
            setTimeout(checkProgress, 500);
          } else {
            cleanupAndShowError('Injection timeout - tab may have been closed');
          }
          return;
        }
        
        if (response && response.status === "completed") {
          // Injection completed successfully
          console.log('NotebookLM: Injection completed successfully!');
          cleanupAndShowSuccess();
        } else if (response && response.status === "error") {
          // Injection failed
          cleanupAndShowError(response.error || 'Injection failed');
        } else if (response && response.status === "in_progress") {
          // Still in progress
                      // Automation still in progress
          if (checkCount < maxChecks) {
            checkCount++;
            setTimeout(checkProgress, 500);
          } else {
            cleanupAndShowError('Injection timeout');
          }
        } else {
          // No response or unexpected status
          console.log('NotebookLM: Unexpected response:', response);
          if (checkCount < maxChecks) {
            checkCount++;
            setTimeout(checkProgress, 500);
          } else {
            cleanupAndShowError('Injection timeout - no response from content script');
          }
        }
      });
    };
    
    // Start monitoring
    setTimeout(checkProgress, 1000);
  }

  // Cleanup function
  function cleanupAndShowSuccess() {
    console.log('NotebookLM: Injection completed successfully');
    
    // Clear the flag
    isNotebookOperationInProgress = false;

    // Remove progress notification
    if (progressNotificationId) {
      chrome.notifications.clear(progressNotificationId);
    }
    
    // Show success notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
              title: '✅ Knowledge Auto-captured & AI Search - Injection Complete',
      message: `Successfully added ${articles.length} articles to NotebookLM!`,
      priority: 1
    });
    
    // Remove tab protection
    if (tabId) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // Restore original beforeunload
          if (window.knowledgeCaptureOriginalBeforeUnload) {
            window.onbeforeunload = window.knowledgeCaptureOriginalBeforeUnload;
          }
        }
      });
    }
  }

  function cleanupAndShowError(errorMessage) {
    console.error('NotebookLM: Injection failed:', errorMessage);
    
    // Clear the flag
    isNotebookOperationInProgress = false;

    // Remove progress notification
    if (progressNotificationId) {
      chrome.notifications.clear(progressNotificationId);
    }
    
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
              title: '❌ Knowledge Auto-captured & AI Search - Injection Failed',
      message: `Failed to add articles: ${errorMessage}`,
      priority: 2
    });
    
    // Remove tab protection
    if (tabId) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // Restore original beforeunload
          if (window.knowledgeCaptureOriginalBeforeUnload) {
            window.onbeforeunload = window.knowledgeCaptureOriginalBeforeUnload;
          }
        }
      });
    }
  }
}


// === INITIALIZATION ===
(() => {
  ExtensionManager.init();
})(); 