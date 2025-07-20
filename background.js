// SmartGrab AI Search Extension - Background Script
'use strict';

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
      await chrome.notifications.create({
        type: type,
        iconUrl: 'icon48.png',
        title: 'SmartGrab AI Search',
        message: message
      });
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }
};

// === STORAGE MANAGER ===
const Storage = {
  KEYS: {
    ENTRIES: 'entries',
    API_KEY: 'openai_api_key',
    SEARCH_STATE: 'searchState',
    SETUP_NOTE: 'setupNoteDismissed',
    USER_HEIGHT: 'userAnswerContentHeight',
    LAST_ERROR: 'lastError'
  },
  
  async getEntries() {
    return await Utils.get(this.KEYS.ENTRIES) || [];
  },
  
  async setEntries(entries) {
    await Utils.set(this.KEYS.ENTRIES, entries);
  },
  
  async addEntry(entry) {
    const entries = await this.getEntries();
    entries.push(entry);
    await this.setEntries(entries);
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
    const entries = await this.getEntries();
    const filtered = entries.filter(e => e.id !== entryId);
    await this.setEntries(filtered);
  },
  
  async clearEntries() {
    await this.setEntries([]);
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
      // Content script injection is now handled by manifest.json
      // No need to manually inject content.js
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
    if (!await this.ensureReady(tabId)) {
      throw new Error('Content script not available');
    }
    
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'extract_text'
    });
    
    if (!response?.text) {
      throw new Error('No text extracted from page');
    }
    
    return response.text;
  }
};

// === AI PROCESSING ===
const AI = {
  async getApiKey() {
    const apiKey = await Storage.getApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    return apiKey;
  },
  
  async cleanText(rawText) {
    if (!rawText || rawText.trim().length === 0) {
      return '';
    }
    
    // Basic cleaning first
    let cleaned = Utils.cleanText(rawText);
    
    // If text is too long, truncate
    if (cleaned.length > CONFIG.MAX_TEXT_LENGTH) {
      cleaned = Utils.truncateText(cleaned, CONFIG.MAX_TEXT_LENGTH);
    }
    
    // Try AI cleaning if API key is available
    try {
      const apiKey = await this.getApiKey();
      return await this.aiCleanText(cleaned, apiKey);
    } catch (error) {
      console.warn('AI cleaning failed, using basic cleaning:', error.message);
      return cleaned;
    }
  },
  
  async aiCleanText(text, apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: 'Clean and format this text for better readability. Remove navigation elements, ads, and irrelevant content. Keep only the main content.'
        }, {
          role: 'user',
          content: text
        }],
        max_tokens: 2000,
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0]?.message?.content || text;
  },
  
  async generateEmbedding(text) {
    try {
      const apiKey = await this.getApiKey();
      
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: text
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.data[0]?.embedding;
    } catch (error) {
      console.log('Embedding generation skipped:', error.message);
      return null; // Return null instead of throwing error
    }
  },
  
  async generateEmbeddingForEntry(entry) {
    try {
      const textForEmbedding = `${entry.title} ${entry.text}`.slice(0, 8000);
      const embedding = await this.generateEmbedding(textForEmbedding);
      
      if (embedding) {
        await Storage.updateEntry(entry.id, { embedding });
        console.log(`Generated embedding for entry: ${entry.title}`);
      } else {
        console.log(`Skipped embedding generation for entry: ${entry.title}`);
      }
      
      return embedding;
    } catch (error) {
      console.log('Embedding generation skipped:', error.message);
      return null;
    }
  }
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
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, CONFIG.SEARCH_RESULTS_LIMIT);
    
    return results;
  },
  
  async semanticSearch(query, filters = {}) {
    const entries = await Storage.getEntries();
    
    // Generate embedding for query
    const queryEmbedding = await AI.generateEmbedding(query);
    if (!queryEmbedding) {
      console.log('No query embedding available, using fallback search');
      return await this.fallbackSemanticSearch(query, filters);
    }
    
    // Count entries with embeddings
    const entriesWithEmbeddings = entries.filter(entry => entry.embedding);
    console.log(`Found ${entriesWithEmbeddings.length} entries with embeddings out of ${entries.length} total`);
    
    // If less than 3 entries have embeddings, use fallback
    if (entriesWithEmbeddings.length < 3) {
      console.log('Too few entries with embeddings, using fallback search');
      return await this.fallbackSemanticSearch(query, filters);
    }
    
    // Find similar entries
    const results = entriesWithEmbeddings
      .map(entry => {
        const similarity = Utils.cosineSimilarity(queryEmbedding, entry.embedding);
        return { ...entry, similarity };
      })
      .filter(entry => entry.similarity > 0.1) // Minimum similarity threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20);
    
    // If no good matches, use fallback
    if (results.length === 0) {
      console.log('No semantic matches found, using fallback search');
      return await this.fallbackSemanticSearch(query, filters);
    }
    
    console.log(`Found ${results.length} semantic search results`);
    return this.applyFilters(results, filters);
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
  
  async saveEntry(entry) {
    // Check for duplicates
    const entries = await Storage.getEntries();
    const existing = entries.find(e => e.url === entry.url);
    
    if (existing) {
      const shouldReplace = await this.askUserForReplacement(entry, existing);
      if (!shouldReplace) {
        return false;
      }
      await Storage.deleteEntry(existing.id);
    }
    
    await Storage.addEntry(entry);
    
    // Generate embedding in background
    AI.generateEmbeddingForEntry(entry).catch(console.error);
    
    return true;
  },
  
  async askUserForReplacement(newEntry, existingEntry) {
    // For now, always replace (in a real implementation, you'd show a dialog)
    return true;
  }
};

// === MESSAGE HANDLERS ===
const MessageHandler = {
  handlers: {
    ping: () => ({ status: 'ok', timestamp: Date.now() }),
    
    get_entries: async () => {
      const entries = await Storage.getEntries();
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
    
    clear_entries: async () => {
      await Storage.clearEntries();
      return { success: true };
    },
    
    get_stats: async () => {
      const stats = await Storage.getStats();
      return { stats };
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
        const saved = await TextExtractor.saveEntry(entry);
        
        if (saved) {
          return { success: true, entry: entry };
        } else {
          return { success: false, error: 'Text capture cancelled' };
        }
      } catch (error) {
        console.error('Page capture failed:', error);
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
    console.log('SmartGrab AI Search Extension - Background script initialized');
  },
  
  setupEventListeners() {
    // Extension lifecycle
    chrome.runtime.onStartup.addListener(this.onStartup.bind(this));
    chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
    
    // User interactions
    chrome.action?.onClicked.addListener(this.onActionClicked.bind(this));
    chrome.commands?.onCommand.addListener(this.onCommand.bind(this));
    
    // Message handling
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Background: Received message:', message);
      
      if (message.action === 'automateNotebookLM') {
        console.log('Background: Handling automateNotebookLM action');
        automateNotebookLM(message.notebookId);
        sendResponse({ success: true });
        return true; // Keep sendResponse alive for async operations
      } else if (message.action === 'addArticlesToNotebookLM') {
        console.log('Background: Handling addArticlesToNotebookLM action');
        addArticlesToNotebookLM(message.notebookId, message.articles);
        sendResponse({ success: true });
        return true; // Keep sendResponse alive for async operations
      } else if (message.action) {
        console.log('Background: Handling other action:', message.action);
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
    console.log('Extension startup');
  },
  
  onInstalled(details) {
    console.log('Extension installed/updated:', details.reason);
    Storage.clearErrorStates();
    
    // Log available commands
    chrome.commands?.getAll().then(commands => {
      console.log('Available commands:', commands);
    });
  },
  
  async onActionClicked(tab) {
    try {
      if (chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (error) {
      console.error('Failed to open side panel:', error);
    }
  },
  
  async onCommand(command) {
    if (command === 'trigger_action') {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          await this.extractTextFromTab(tab);
        }
      } catch (error) {
        console.error('Command execution failed:', error);
        Utils.showNotification('Failed to capture page text');
      }
    }
  },
  
  async extractTextFromTab(tab) {
    try {
      const entry = await TextExtractor.extractFromTab(tab);
      const saved = await TextExtractor.saveEntry(entry);
      
      if (saved) {
        Utils.showNotification(`Captured: ${entry.title}`);
      } else {
        Utils.showNotification('Text capture cancelled');
      }
    } catch (error) {
      console.error('Text extraction failed:', error);
      Utils.showNotification(`Failed to capture text: ${error.message}`);
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
  }
};

/**
 * Open NotebookLM notebook and trigger UI automation (based on NLM_YT_automator pattern)
 * @param {string} notebookId - The NotebookLM notebook ID
 * @param {Array} driveFiles - Optional, can be empty for now
 */
async function automateNotebookLM(notebookId, driveFiles = []) {
  console.log('NotebookLM: Starting automation for notebook:', notebookId);
  
  try {
    // 1. Open the notebook in a new tab
    const url = `https://notebooklm.google.com/u/0/notebook/${notebookId}`;
    console.log('NotebookLM: Opening URL:', url);
    
    const { id: tabId } = await chrome.tabs.create({ url });
    console.log('NotebookLM: Created tab with ID:', tabId);

    // 2. Wait for the tab to load and send the automation message
    chrome.tabs.onUpdated.addListener(function listener(tId, info) {
      if (tId === tabId && info.status === "complete") {
        console.log('NotebookLM: Tab loaded, sending automation message');
        
        // Remove the listener to avoid multiple injections
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Wait a bit for the content script to initialize, then send the automation message
        setTimeout(() => {
          console.log('NotebookLM: Sending automation message to content script');
          chrome.tabs.sendMessage(tabId, {
            type: "AUTOMATE_ADD_SOURCES",
            driveFiles: driveFiles || []
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('NotebookLM: Error sending message:', chrome.runtime.lastError.message);
              // Try to show error in the tab
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (errorMsg) => {
                  const errorDiv = document.createElement('div');
                  errorDiv.style.cssText = `
                    position: fixed; top: 10px; right: 10px; z-index: 10000;
                    background: #f44336; color: white; padding: 10px; border-radius: 5px;
                    font-family: Arial, sans-serif; font-size: 14px; max-width: 300px;
                  `;
                  errorDiv.textContent = `Automation Error: ${errorMsg}`;
                  document.body.appendChild(errorDiv);
                  setTimeout(() => errorDiv.remove(), 10000);
                },
                args: [chrome.runtime.lastError.message]
              });
            } else if (response) {
              console.log('NotebookLM: Content script response:', response);
            } else {
              console.log('NotebookLM: No immediate response from content script');
            }
          });
        }, 1000); // Increased delay to ensure script is ready
      }
    });
    
  } catch (error) {
    console.error('NotebookLM: Failed to start automation:', error);
  }
}

/**
 * Add all captured articles as sources to a NotebookLM notebook
 * @param {string} notebookId - The NotebookLM notebook ID
 * @param {Array} articles - Array of captured articles to add as sources
 */
async function addArticlesToNotebookLM(notebookId, articles) {
  console.log('NotebookLM: Adding articles as sources to notebook:', notebookId);
  console.log('NotebookLM: Articles to add:', articles);
  
  try {
    // 1. Open the notebook in a new tab
    const url = `https://notebooklm.google.com/u/0/notebook/${notebookId}`;
    console.log('NotebookLM: Opening URL:', url);
    
    const { id: tabId } = await chrome.tabs.create({ url });
    console.log('NotebookLM: Created tab with ID:', tabId);

    // 2. Wait for the tab to load and send the automation message
    chrome.tabs.onUpdated.addListener(function listener(tId, info) {
      if (tId === tabId && info.status === "complete") {
        console.log('NotebookLM: Tab loaded, sending automation message');
        
        // Remove the listener to avoid multiple injections
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Wait a bit for the content script to initialize, then send the automation message
        setTimeout(() => {
          console.log('NotebookLM: Sending automation message to content script');
          chrome.tabs.sendMessage(tabId, {
            type: "AUTOMATE_ADD_ARTICLES",
            articles: articles
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('NotebookLM: Error sending message:', chrome.runtime.lastError.message);
              // Try to show error in the tab
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (errorMsg) => {
                  const errorDiv = document.createElement('div');
                  errorDiv.style.cssText = `
                    position: fixed; top: 10px; right: 10px; z-index: 10000;
                    background: #f44336; color: white; padding: 10px; border-radius: 5px;
                    font-family: Arial, sans-serif; font-size: 14px; max-width: 300px;
                  `;
                  errorDiv.textContent = `Automation Error: ${errorMsg}`;
                  document.body.appendChild(errorDiv);
                  setTimeout(() => errorDiv.remove(), 10000);
                },
                args: [chrome.runtime.lastError.message]
              });
            } else if (response) {
              console.log('NotebookLM: Content script response:', response);
            } else {
              console.log('NotebookLM: No immediate response from content script');
            }
          });
        }, 1000); // Increased delay to ensure script is ready
      }
    });
    
  } catch (error) {
    console.error('NotebookLM: Failed to add articles:', error);
  }
}

// Example usage (call from popup or UI):
// automateNotebookLM('your-notebook-id-here');

// === INITIALIZATION ===
(() => {
  ExtensionManager.init();
})(); 