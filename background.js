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
    LAST_ERROR: 'lastError',
    SELECTED_ARTICLES: 'selectedArticles'
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
      // Manually inject content script
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      // Wait a bit for the script to initialize
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
    if (!await this.ensureReady(tabId)) {
      throw new Error('Content script not available - cannot extract text from this page');
    }
    
    try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'extract_text'
    });
    
    if (!response?.text) {
      throw new Error('No text extracted from page');
    }
    
    return response.text;
    } catch (error) {
      if (error.message.includes('Could not establish connection')) {
        throw new Error('Cannot access this page. Try refreshing the page or use a different tab.');
      }
      throw error;
    }
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
    
    // Tab monitoring for NotebookLM auto-detection
    chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this));
    
    // Side panel setup
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      try {
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        console.log('Side panel behavior set successfully');
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
      } else if (message.action === 'testSidePanel') {
        // Test side panel functionality
        MessageHandler.testSidePanel();
        sendResponse({ success: true });
        return true;
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
    console.log('Extension startup');
  },
  
  onInstalled(details) {
    console.log('Extension installed/updated:', details.reason);
    Storage.clearErrorStates();
    
    // Set up side panel
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      try {
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        console.log('Side panel behavior set on install');
      } catch (error) {
        console.error('Failed to set side panel behavior on install:', error);
      }
    } else {
      console.log('Side panel API not available on install');
    }
    
    // Log available commands
    chrome.commands?.getAll().then(commands => {
      console.log('Available commands:', commands);
    });
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

  // Monitor tab updates for NotebookLM auto-detection
  async onTabUpdated(tabId, changeInfo, tab) {
    // Only process when tab is completely loaded and URL is a NotebookLM notebook
    if (changeInfo.status === 'complete' && tab.url) {
      console.log('NotebookLM: Tab updated - ID:', tabId, 'URL:', tab.url);
      
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
  },

  // Debug function to test side panel functionality
  async testSidePanel() {
    console.log('=== TESTING SIDE PANEL ===');
    console.log('Chrome version:', navigator.userAgent);
    console.log('Chrome APIs:');
    console.log('- chrome.sidePanel:', !!chrome.sidePanel);
    console.log('- chrome.sidePanel.open:', !!(chrome.sidePanel && chrome.sidePanel.open));
    console.log('- chrome.sidePanel.setPanelBehavior:', !!(chrome.sidePanel && chrome.sidePanel.setPanelBehavior));
    
    if (chrome.sidePanel) {
      try {
        console.log('Testing side panel open...');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
          console.log('Side panel test successful!');
        }
      } catch (error) {
        console.error('Side panel test failed:', error);
      }
    } else {
      console.log('Side panel API not available');
    }
  }
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
      title: '🧠 SmartGrab - Auto-Injecting',
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
          
          // Store original function for cleanup
          window.smartgrabOriginalBeforeUnload = originalBeforeUnload;
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
        }
      });
    }
    
    // Helper function to start the injection process
    function startInjectionProcess() {
      // First, validate that the tab still exists
      chrome.tabs.get(tabId).then((tab) => {
        console.log('NotebookLM: Tab validation successful, tab exists:', tab.id);
        
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
      title: '✅ SmartGrab - Injection Complete',
      message: `Successfully added ${articles.length} articles to NotebookLM!`,
      priority: 1
    });
    
    // Remove tab protection
    if (tabId) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // Restore original beforeunload
          if (window.smartgrabOriginalBeforeUnload) {
            window.onbeforeunload = window.smartgrabOriginalBeforeUnload;
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
      title: '❌ SmartGrab - Injection Failed',
      message: `Failed to add articles: ${errorMessage}`,
      priority: 2
    });
    
    // Remove tab protection
    if (tabId) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // Restore original beforeunload
          if (window.smartgrabOriginalBeforeUnload) {
            window.onbeforeunload = window.smartgrabOriginalBeforeUnload;
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