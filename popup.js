// Knowledge Auto-captured & AI Search Extension - Popup Script
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

// === BROWSER COMPATIBILITY ===
const browser = globalThis.chrome || globalThis.browser;

// === GLOBAL STATE ===
const AppState = {
  homeSelectedArticles: new Set(),
  isSelectionMode: true,
  allEntries: [],
  currentSearch: '',
  currentSearchMode: 'semantic',
  lastSearchResults: [],
  isSearching: false,
  searchCancelled: false,
  userAnswerContentHeight: 200,
  currentSort: 'date-desc', // 'date-desc', 'date-asc', 'alpha'
  searchFilterState: {
    timeFilter: 'any',
    resultsFilter: 'any',
    advancedFilter: 'off',
    dateFrom: '',
    dateTo: '',
    isActive: false
  },
  // Auto-capture setting (default to true for new users)
  autoCaptureEnabled: true,
  // On-page reminder for auto-capture (webpage toast); extension notification always on
  webReminderEnabled: true,
  // Auto-capture dwell delay in ms; 'default' means built-in 3000 ms
  autoCaptureDelayMs: 'default'
};

// === UTILITIES ===
const Utils = {
  // DOM utilities
  $(selector) { return document.querySelector(selector); },
  $$(selector) { return document.querySelectorAll(selector); },
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },
  
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

  async remove(key) {
    return new Promise(resolve => {
      chrome.storage.local.remove([key], resolve);
    });
  },
  
  // UI utilities
  showElement(element, show = true) {
    if (element) element.style.display = show ? 'block' : 'none';
  },
  
  hideElement(element) {
    this.showElement(element, false);
  },
  
  toggleClass(element, className, condition) {
    if (element) {
        element.classList.toggle(className, condition);
    }
  },
  
  setDisabled(element, disabled) {
    if (element) element.disabled = disabled;
  },
  
  // Messaging utilities
  async sendMessage(message) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(message, resolve);
    });
  },
  
  // Time utilities
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  },
  
  // Text utilities
  truncateText(text, maxLength) {
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  },
  
  // Async utilities
  async withTimeout(promise, timeoutMs) {
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    );
    return Promise.race([promise, timeout]);
  },
  
  // Notification utilities
  showNotification(message, type = 'info') {
    const notification = Utils.$('.notification') || this.createNotificationElement();
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    setTimeout(() => notification.style.display = 'none', 3000);
  },
  
  createNotificationElement() {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
      position: fixed; top: 10px; right: 10px; z-index: 1000;
      background: #333; color: white; padding: 10px 15px;
      border-radius: 5px; display: none;
    `;
    document.body.appendChild(notification);
    return notification;
  }
};

// === DOM ELEMENTS ===
const Elements = {
  // Cache all DOM elements
  init() {
    // Search elements
    this.searchInput = Utils.$('#searchInput');
    this.searchClear = Utils.$('#searchClear');
    this.searchLoading = Utils.$('#searchLoading');
    this.searchResults = Utils.$('#searchResults');
    this.loadingIndicator = Utils.$('#loadingIndicator');
    this.resultCount = Utils.$('#resultCount');
    this.searchTerm = Utils.$('#searchTerm');
    this.noResults = Utils.$('#noResults');
    
    // Entry elements
    this.entriesContainer = Utils.$('#entries');
    this.emptyState = Utils.$('#emptyState');
    this.clearBtn = Utils.$('#clearBtn');
    this.entryCount = Utils.$('#entryCount');
    this.totalWords = Utils.$('#totalWords');
    this.stats = Utils.$('#stats');
    this.capturePageBtn = Utils.$('#capturePageBtn');
    
    // Settings elements
    this.apiKeyInput = Utils.$('#apiKeyInput');
    this.saveApiKeyBtn = Utils.$('#saveApiKeyBtn');
    this.apiStatus = Utils.$('#apiStatus');
    this.apiStatusIndicator = Utils.$('#apiStatusIndicator');
    this.apiStatusText = Utils.$('#apiStatusText');
    this.dbStats = Utils.$('#dbStats');
    this.modelInfo = Utils.$('#modelInfo');
    this.exportBtn = Utils.$('#exportBtn');
    
    // Tab elements
    this.tabs = Utils.$$('.tab');
    this.tabContents = Utils.$$('.tab-content');
    this.searchOptions = Utils.$$('.search-option');
    
    // Filter elements
    this.toggleFilters = Utils.$('#toggleFilters');
    this.searchFilters = Utils.$('#searchFilters');
    this.timeFilter = Utils.$('#timeFilter');
    this.resultsFilter = Utils.$('#resultsFilter');
    this.advancedFilter = Utils.$('#advancedFilter');
    this.customDateRange = Utils.$('#customDateRange');
    this.dateFrom = Utils.$('#dateFrom');
    this.dateTo = Utils.$('#dateTo');
    this.applyFilters = Utils.$('#applyFilters');
    this.resetFilters = Utils.$('#resetFilters');
    this.activeFilters = Utils.$('#activeFilters');
    
    // Advanced search elements
    this.advancedSearch = Utils.$('#advancedSearch');
    this.advancedSearchBtn = Utils.$('#advancedSearchBtn');
    this.allWords = Utils.$('#allWords');
    this.exactPhrase = Utils.$('#exactPhrase');
    this.anyWords = Utils.$('#anyWords');
    this.noneWords = Utils.$('#noneWords');
    
    // Setup and misc elements
    this.setupNote = Utils.$('#setupNote');
    this.dismissSetupNote = Utils.$('#dismissSetupNote');
    this.shortcutsLink = Utils.$('#shortcutsLink');
    this.clearErrorStatesBtn = Utils.$('#clearErrorStatesBtn');

    this.showReloadBtn = Utils.$('#showReloadBtn');
    
    // NotebookLM elements
    this.exportToNotebookLM = Utils.$('#exportToNotebookLM');
    this.detectNotebook = Utils.$('#detectNotebook');
    
    // Delete elements
    this.deleteSelectedBtn = Utils.$('#deleteSelectedBtn');
    
    // Shortcut elements
    this.shortcutLink = Utils.$('#shortcutLink');
    
    // Selection elements
    this.toggleSelectionBtn = Utils.$('#toggleSelectionBtn');
    this.selectionHint = Utils.$('#selectionHint');
    this.homeSelectedCount = Utils.$('#homeSelectedCount');
    this.selectToggleBtn = Utils.$('#selectToggleBtn');
    this.selectionToolbar = Utils.$('#selectionToolbar');
    
    // Sorting elements
    this.sortDropdown = Utils.$('#sortDropdown');
    
    // Settings elements
    this.settingsIconBtn = Utils.$('#settingsIconBtn');
    this.autoCaptureToggle = Utils.$('#autoCaptureToggle');
    this.webReminderToggle = Utils.$('#webReminderToggle');
    this.autoCaptureDelaySelect = Utils.$('#autoCaptureDelaySelect');
    this.customProxyUrlInput = Utils.$('#customProxyUrlInput');
    this.applyProxyBtn = Utils.$('#applyProxyBtn');
    this.testProxyBtn = Utils.$('#testProxyBtn');
    
    // Export elements
    this.exportJsonBtn = Utils.$('#exportJsonBtn');
    this.exportMdBtn = Utils.$('#exportMdBtn');
    this.exportTxtBtn = Utils.$('#exportTxtBtn');
    this.closeSettingsBtn = Utils.$('#closeSettingsBtn');
    
    // Semantic search elements (removed unused elements)
    this.semanticSearchContainer = Utils.$('#semanticSearchContainer');

  }
};

// === SEARCH FUNCTIONALITY ===
const Search = {
  async handleInput(e) {
    // Handle search input events
    
    // Prevent any default form submission behavior
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // Also prevent any browser search behavior
    if (e.target.type === 'search') {
      e.target.type = 'text';
    }
    
    const query = e.target.value.trim();
    
    AppState.currentSearch = query;
    
    if (!query) {
      this.clearResults();
      return;
    }
    
    await this.saveState();
  },
  
  async handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      
      const query = e.target.value.trim();
      if (query) {
        try {
          await this.performSearch(query);
        } catch (error) {
          console.error('Search: Error in handleKeydown:', error);
        }
      }
    }
  },
  
  async performSearch(query) {
    if (AppState.isSearching) return;
    
    AppState.isSearching = true;
    this.showLoading(true);
    
    // Switch to search tab to show results
    UI.switchTab('search');
    
    try {
      let results;
      if (AppState.currentSearchMode === 'semantic') {
        results = await this.performSemanticSearch(query);
      } else {
        results = await this.performKeywordSearch(query);
      }
      
      AppState.lastSearchResults = results;
      this.displayResults(results, query);
      await this.saveState();
      
    } catch (error) {
      console.error('Search error:', error);
      Utils.showNotification('Search failed. Please try again.', 'error');
    } finally {
      AppState.isSearching = false;
      this.showLoading(false);
    }
  },
  
  async performKeywordSearch(query) {
    // Clear selections when starting keyword search
    AppState.homeSelectedArticles.clear();
    
    // Update UI to reflect cleared selections
    Data.updateSelectionUI();
    Data.updateCheckboxStates();
    Data.updateToggleButtonText();
    
    const response = await Utils.sendMessage({
      action: 'search_keywords',
      query: query
    });
    
    if (response?.results) {
      const filteredResults = this.applyFilters(response.results, query);
      return filteredResults; // Show all results, no limit
    }
    return [];
  },
  
  async performSemanticSearch(query) {
    try {
      // Check if search was cancelled before starting
      if (AppState.searchCancelled) {
        AppState.searchCancelled = false;
        this.showLoading(false);
        this.hideSearchLoading();
        AppState.isSearching = false;
        return [];
      }
      
      // Clear selections when starting semantic search
      AppState.homeSelectedArticles.clear();
      
      // Update UI to reflect cleared selections
      Data.updateSelectionUI();
      Data.updateCheckboxStates();
      Data.updateToggleButtonText();
      
      // Show loading indicator
      this.showLoading(true);
      this.showSearchLoading();
      
      // Initialize Vertex AI Search if not already done
      if (!window.vertexAISearch) {
          window.vertexAISearch = new window.VertexAISearch();
          await window.vertexAISearch.init();
        Utils.showNotification('Vertex AI Search is ready!', 'Success');
      }
      
      // Check if search was cancelled after initialization
      if (AppState.searchCancelled) {
        AppState.searchCancelled = false;
        this.showLoading(false);
        this.hideSearchLoading();
        AppState.isSearching = false;
        return [];
      }
      
      // Get all entries for search
      const entries = AppState.allEntries || [];
      if (entries.length === 0) {
        this.showLoading(false);
        this.hideSearchLoading();
        return [];
      }
      
      // Get number of articles (default 10)
      const numArticles = 10;
      
      // Get conversation history for follow-up capability
      const conversationHistory = AppState.conversationHistory || [];
      
      // Perform conversational search with citations
      // Use a timeout-based approach to allow cancellation
      const searchPromise = window.vertexAISearch.conversationalSearch(query, numArticles, conversationHistory);
      
      // Create a cancellation promise that resolves when search is cancelled
      const cancellationPromise = new Promise((resolve) => {
        const checkCancellation = () => {
          if (AppState.searchCancelled) {
            resolve(null);
      } else {
            setTimeout(checkCancellation, 100); // Check every 100ms
          }
        };
        checkCancellation();
      });
      
      // Race between search completion and cancellation
      const conversationalResult = await Promise.race([searchPromise, cancellationPromise]);
      
      // If cancelled, return early
      if (!conversationalResult) {
        AppState.searchCancelled = false;
        this.showLoading(false);
        this.hideSearchLoading();
        AppState.isSearching = false;
        return [];
      }
      

      
      // Store the conversational result for display
      AppState.lastConversationalResult = conversationalResult;
      
      // Store conversation history for follow-up questions
      if (!AppState.conversationHistory) {
        AppState.conversationHistory = [];
      }
      AppState.conversationHistory.push(
        { role: 'user', content: query },
        { role: 'assistant', content: conversationalResult.response }
      );
      
      // Keep only last 6 turns (3 exchanges) to avoid token limits
      if (AppState.conversationHistory.length > 6) {
        AppState.conversationHistory = AppState.conversationHistory.slice(-6);
      }
      
      // Convert sources to standard result format for compatibility
      const results = conversationalResult.sources?.map(source => ({
        id: source.id,
        title: source.title,
        url: source.url,
        similarity: source.similarity,
        searchType: 'conversational',
        content: source.content
      })) || [];
      

      
      // Apply filters
      const filteredResults = this.applyFilters(results, query);
      
      this.showLoading(false);
      this.hideSearchLoading();
      return filteredResults;
      
    } catch (error) {
      console.error('Search: Conversational search failed:', error);
      Utils.showNotification('AI search failed, using keyword search instead', 'warning');
      
      // Fallback to keyword search
      try {
        const fallbackResults = await this.performKeywordSearch(query);
        this.showLoading(false);
        this.hideSearchLoading();
        return fallbackResults;
      } catch (fallbackError) {
        console.error('Search: Fallback search also failed:', fallbackError);
        this.showLoading(false);
        this.hideSearchLoading();
        return [];
      }
    }
  },
  
  applyFilters(results, query) {
    let filtered = [...results];
    
    // Apply time filter only for keyword search (not semantic search)
    if (AppState.currentSearchMode === 'keyword' && AppState.searchFilterState.timeFilter !== 'any') {
      filtered = this.applyTimeFilter(filtered);
    }
    
    // Apply results filter (verbatim)
    if (AppState.searchFilterState.resultsFilter === 'verbatim') {
      filtered = this.applyVerbatimFilter(filtered, query);
    }
    
    // Apply advanced search filter
    if (AppState.searchFilterState.advancedFilter === 'on') {
      filtered = this.applyAdvancedFilter(filtered);
    }
    
    return filtered;
  },
  
  applyTimeFilter(results) {
    const timeFilter = AppState.searchFilterState.timeFilter;
    
    // Handle custom date range
    if (timeFilter === 'custom' && AppState.searchFilterState.dateFrom && AppState.searchFilterState.dateTo) {
      // Convert date strings to start and end of day timestamps
      const startDate = new Date(AppState.searchFilterState.dateFrom + 'T00:00:00.000Z').getTime();
      const endDate = new Date(AppState.searchFilterState.dateTo + 'T23:59:59.999Z').getTime();
      
      return results.filter(result => {
        // Handle different timestamp formats
        let timestamp;
        
        if (typeof result.timestamp === 'number') {
          timestamp = result.timestamp;
        } else if (typeof result.timestamp === 'string') {
          timestamp = new Date(result.timestamp).getTime();
        } else if (result.timestamp) {
          timestamp = new Date(result.timestamp).getTime();
        } else {
          return false;
        }
        
        // Check if timestamp is valid
        if (isNaN(timestamp)) {
          return false;
        }
        
        // Check if timestamp is within custom date range (inclusive of full days)
        return timestamp >= startDate && timestamp <= endDate;
      });
    }
    
    // Handle predefined time ranges
    const now = Date.now();
    const timeRanges = {
      'hour': 60 * 60 * 1000,
      'day': 24 * 60 * 60 * 1000,
      'week': 7 * 24 * 60 * 60 * 1000,
      'month': 30 * 24 * 60 * 60 * 1000,
      'year': 365 * 24 * 60 * 60 * 1000
    };
    
    const timeRange = timeRanges[timeFilter];
    
    if (!timeRange) {
      return results;
    }
    
    return results.filter(result => {
      // Handle different timestamp formats
      let timestamp;
      
      if (typeof result.timestamp === 'number') {
        timestamp = result.timestamp;
      } else if (typeof result.timestamp === 'string') {
        timestamp = new Date(result.timestamp).getTime();
      } else if (result.timestamp) {
        timestamp = new Date(result.timestamp).getTime();
      } else {
        return false;
      }
      
      // Check if timestamp is valid
      if (isNaN(timestamp)) {
        return false;
      }
      
      const timeDiff = now - timestamp;
      return timeDiff <= timeRange;
    });
  },
  
  applyVerbatimFilter(results, query) {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    return results.filter(result => {
      const content = (result.text + ' ' + result.title).toLowerCase();
      // For verbatim, ALL search terms must be present
      return searchTerms.every(term => content.includes(term));
    });
  },
  
  applyAdvancedFilter(results) {
    const filters = {
      allWords: Elements.allWords?.value?.trim(),
      exactPhrase: Elements.exactPhrase?.value?.trim(),
      anyWords: Elements.anyWords?.value?.trim(),
      noneWords: Elements.noneWords?.value?.trim()
    };
    
    return results.filter(result => {
      const content = (result.text + ' ' + result.title).toLowerCase();
      
      // All words must be present
      if (filters.allWords) {
        const allWords = filters.allWords.toLowerCase().split(' ');
        if (!allWords.every(word => content.includes(word))) return false;
      }
      
      // Exact phrase must be present
      if (filters.exactPhrase) {
        if (!content.includes(filters.exactPhrase.toLowerCase())) return false;
      }
      
      // At least one of any words must be present
      if (filters.anyWords) {
        const anyWords = filters.anyWords.toLowerCase().split(' ');
        if (!anyWords.some(word => content.includes(word))) return false;
      }
      
      // None of the excluded words should be present
      if (filters.noneWords) {
        const noneWords = filters.noneWords.toLowerCase().split(' ');
        if (noneWords.some(word => content.includes(word))) return false;
      }
      
      return true;
    });
  },
  

  
  displayResults(results, query) {
    // Always hide noResults first
    Utils.hideElement(Elements.noResults);
    
    // Check if we have conversational search results
    const hasConversationalResults = AppState.lastConversationalResult && AppState.lastConversationalResult.response;
    
    // If no results and no conversational results, show no results message
    if ((!results || results.length === 0) && !hasConversationalResults && AppState.currentSearch) {
      // Ensure search tab is visible
      const searchTab = document.getElementById('searchTab');
      if (searchTab) {
        searchTab.style.display = 'block';
      }
      
      // Hide entries container when no results
      if (Elements.entriesContainer) {
        Utils.hideElement(Elements.entriesContainer);
      }
      
      // Update the no results message based on search mode
      if (Elements.noResults) {
        const noResultsTitle = Elements.noResults.querySelector('p:first-child');
        const noResultsSubtitle = Elements.noResults.querySelector('p:last-child');
        
        if (AppState.currentSearchMode === 'keyword') {
          noResultsTitle.textContent = '🔍 No matching keyword(s) found';
          noResultsSubtitle.textContent = 'Try different keywords or check your spelling';
        } else {
          noResultsTitle.textContent = '🔍 No results found';
          noResultsSubtitle.textContent = 'Try different keywords or check your spelling';
        }
      }
      
      Utils.showElement(Elements.noResults);
      return;
    }
    
    // If no results and no current search, we're returning to main page
    if ((!results || results.length === 0) && !hasConversationalResults && !AppState.currentSearch) {
      return;
    }
    
    let entriesHTML = '';
    
    // Add conversational response for AI results
    if (hasConversationalResults) {
      entriesHTML += this.createConversationalResponseHTML(AppState.lastConversationalResult, query);
    }
    
    // For conversational results, don't show individual articles - they're referenced in the response
    if (hasConversationalResults) {
      // Citations are integrated into the response
    } else {
      // For regular search, show all results (no limit)
      const allResults = results;
      
      // Add results count indicator if we have results
      if (allResults.length > 0) {
        const resultsCount = allResults.length;
        const showingText = `Showing ${resultsCount} result${resultsCount === 1 ? '' : 's'}`;
        entriesHTML += `
          <div style="text-align: center; padding: 10px 0; color: #64748B; font-size: 12px; border-bottom: 1px solid #E2E8F0; margin-bottom: 15px;">
            ${showingText}
          </div>
        `;
      }
      
      entriesHTML += allResults.map(result => this.createEntryHTML(result, query)).join('');
    }
    
    if (Elements.entriesContainer) {
      Elements.entriesContainer.innerHTML = entriesHTML;
      Utils.showElement(Elements.entriesContainer);
    } else {
      console.error('Search: entriesContainer not found!');
    }
    
    // Set up event listeners for the new entries
    Data.setupEntryEventListeners();
    
    // Initialize citation interaction for conversational results
    if (hasConversationalResults) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        Data.setupCitationInteractions();
      }, 50);
    }
    
    // Enhanced result interactions removed - we only show the summary now
  },
  
  createEntryHTML(result, query) {
    // Check if required fields exist
    if (!result.title) {
      console.error('Search: Missing title for result:', result);
      return '';
    }
    
    const timestamp = Utils.formatTimestamp(result.timestamp);
    const isSelected = AppState.homeSelectedArticles.has(String(result.id));
    const checkboxVisible = 'block';
    
    // Determine if this is an enhanced semantic search result
    const isEnhanced = result.searchType === 'enhanced_semantic' || result.searchType === 'enhanced_fallback';
    
    // Remove the enhanced search type badge since we're not showing detailed results
    const searchTypeBadge = '';
    
    // Extract author from URL or use a default
    const url = result.url || '';
    const author = this.extractAuthorFromUrl(url);
    
    // Skip showing enhanced content in individual results - we show it in the summary instead
    let enhancedContent = '';
    
    // Add highlighting for search results (both keyword and semantic when verbatim is active)
    const isKeywordSearch = AppState.currentSearchMode === 'keyword';
    const isVerbatimActive = AppState.searchFilterState.resultsFilter === 'verbatim';
    const shouldHighlight = isKeywordSearch || isVerbatimActive;
    const highlightedTitle = shouldHighlight ? this.highlightSearchTerms(result.title, query) : Utils.escapeHtml(result.title);
    
    // For keyword search or verbatim mode, show first highlighted sentence
    let keywordSearchContent = '';
    
    if (shouldHighlight) {
      // Show first highlighted sentence if available
      if (query && result.text) {
        const firstHighlightedSentence = this.findFirstHighlightedSentence(result.text, query);
        if (firstHighlightedSentence) {
          keywordSearchContent = `
            <div class="keyword-search-content" style="margin-top: 8px; padding: 8px; background: var(--clr-gray-50); border-radius: 6px; border-left: 3px solid var(--clr-primary-10);">
              <div class="highlighted-sentence" style="color: var(--clr-gray-700); font-size: 13px; line-height: 1.4;">
                ${this.highlightSearchTerms(firstHighlightedSentence, query)}
              </div>
            </div>
          `;
        }
      }
    }
    
    const html = `
      <div class="entry" data-entry-id="${result.id}">
        <div class="entry-header">
          <div class="entry-selection">
            <input type="checkbox" class="entry-checkbox" 
                   style="display: ${checkboxVisible};"
                   ${isSelected ? 'checked' : ''}
                   data-entry-id="${result.id}">
          </div>
          <div class="entry-info">
            <h3 class="entry-title" title="${Utils.escapeHtml(result.title)}">
              <a href="${result.url || '#'}" target="_blank" class="entry-title-link" style="color: inherit; text-decoration: none; cursor: pointer;">
                ${highlightedTitle}
              </a>
            </h3>
            <div class="entry-meta">
            <span class="author">${author}</span>
          <span class="timestamp">${timestamp}</span>
              ${searchTypeBadge}
        </div>
            ${keywordSearchContent}
            ${enhancedContent}
        </div>
        </div>

      </div>
    `;
    
    return html;
  },
  
  highlightSearchTerms(text, query) {
    if (!query) return Utils.escapeHtml(text);
    
    let highlighted = Utils.escapeHtml(text);
    
    // Check if verbatim filter is active
    const isVerbatim = AppState.searchFilterState.resultsFilter === 'verbatim';
    
    if (isVerbatim) {
      // For verbatim mode, highlight the exact phrase
      const exactPhrase = query.toLowerCase();
      // Use word boundaries to ensure we match complete words/phrases, not partial matches
      const regex = new RegExp(`\\b(${Utils.escapeRegExp(exactPhrase)})\\b`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
      
      // Also try to match title case variations
      const titleCasePhrase = query.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
      if (titleCasePhrase !== exactPhrase) {
        const titleCaseRegex = new RegExp(`\\b(${Utils.escapeRegExp(titleCasePhrase)})\\b`, 'gi');
        highlighted = highlighted.replace(titleCaseRegex, '<mark>$1</mark>');
      }
    } else {
      // For normal mode, highlight individual terms
      const terms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
      
      // Sort terms by length (longest first) to avoid partial matches
      terms.sort((a, b) => b.length - a.length);
    
    terms.forEach(term => {
        // Create case-insensitive regex that matches whole words or parts of words
      const regex = new RegExp(`(${Utils.escapeRegExp(term)})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    }
    
    return highlighted;
  },
  
  findFirstHighlightedSentence(text, query) {
    if (!query || !text) return null;
    
    // Check if verbatim filter is active
    const isVerbatim = AppState.searchFilterState.resultsFilter === 'verbatim';
    
    // Split text into sentences while preserving punctuation
    const sentenceRegex = /[^.!?]*[.!?]+/g;
    const sentences = [];
    let match;
    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentence = match[0].trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
    }
    
    // Find the first sentence that contains the search terms
    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      let hasMatch = false;
      
      if (isVerbatim) {
        // For verbatim mode, look for the exact phrase
        const exactPhrase = query.toLowerCase();
        hasMatch = sentenceLower.includes(exactPhrase);
        
        // Also check for title case variation
        if (!hasMatch) {
          const titleCasePhrase = query.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
          hasMatch = sentence.includes(titleCasePhrase);
        }
      } else {
        // For normal mode, look for individual terms
        const terms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
        hasMatch = terms.some(term => sentenceLower.includes(term));
      }
      
      if (hasMatch) {
        // Return the complete sentence with punctuation
        return sentence.trim();
      }
    }
    
    return null;
  },
  
  // New: Create conversational response HTML like NotebookLM
  createConversationalResponseHTML(result, query) {
    if (!result.response) return '';
    
    // Format the response with inline citations as clickable links
    let formattedResponse = result.response;
    
    // Convert [1], [2] citations to clickable links
    formattedResponse = formattedResponse.replace(/\[(\d+)\]/g, (match, num) => {
      return `<a href="#citation-${num}" class="citation-link" data-citation="${num}">[${num}]</a>`;
    });
    
    // Format bullet points properly - convert each line starting with • to a proper list item
    formattedResponse = formattedResponse
      .split('\n')
      .map(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('•')) {
          return `<div style="margin: 8px 0; padding-left: 0; display: flex; align-items: flex-start;">
            <span style="color: var(--clr-primary-10); font-weight: bold; margin-right: 8px; line-height: 1.7;">•</span>
            <span style="flex: 1; line-height: 1.7;">${trimmedLine.substring(1).trim()}</span>
          </div>`;
        } else if (trimmedLine.startsWith('*')) {
          // Convert asterisks to bullet points if AI still uses them
          return `<div style="margin: 8px 0; padding-left: 0; display: flex; align-items: flex-start;">
            <span style="color: var(--clr-primary-10); font-weight: bold; margin-right: 8px; line-height: 1.7;">•</span>
            <span style="flex: 1; line-height: 1.7;">${trimmedLine.substring(1).trim()}</span>
          </div>`;
        } else if (trimmedLine) {
          return `<div style="margin: 8px 0; line-height: 1.7;">${trimmedLine}</div>`;
        }
        return '';
      })
      .join('');
    
    // Create citations section if we have citations
    let citationsHTML = '';
    if (result.citations && result.citations.length > 0) {
      citationsHTML = `
        <div style="margin: 24px 0 0 0; padding: 20px; background: var(--clr-gray-50); border-radius: 12px; border: 1px solid var(--clr-gray-200);">
          <h4 style="margin: 0 0 16px 0; color: var(--clr-heading); font-size: 15px; font-weight: 600; display: flex; align-items: center;">
            <span style="background: var(--clr-primary-10); color: white; width: 20px; height: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center; margin-right: 8px; font-size: 10px;">📚</span>
            Sources
          </h4>
          <div class="citations-list">
            ${result.citations.map(citation => {
              const isSelected = AppState.homeSelectedArticles.has(String(citation.id));
              return `
                <div id="citation-${citation.number}" class="citation-item" style="display: flex; align-items: center; gap: 12px; margin: 12px 0; padding: 12px; background: white; border-radius: 8px; border: 1px solid var(--clr-gray-200); transition: all 0.2s;">
                  <input type="checkbox" class="citation-checkbox entry-checkbox" 
                         style="margin-right: 8px; cursor: pointer;"
                         ${isSelected ? 'checked' : ''}
                         data-entry-id="${citation.id}">
                  <span class="citation-number" data-citation-num="${citation.number}" style="background: var(--clr-primary-10); color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;" title="Click to jump to citation in AI response">${citation.number}</span>
                  <a href="${citation.url}" target="_blank" class="citation-title" style="color: var(--clr-gray-800); text-decoration: none; font-weight: 500; font-size: 14px; flex: 1; line-height: 1.4;">${citation.title}</a>
                  <span class="similarity-score" style="color: var(--clr-gray-600); font-size: 12px; font-weight: 500; min-width: 60px; text-align: right;">${(citation.similarity * 100).toFixed(0)}%</span>
                  <button class="summarize-btn" data-article-id="${citation.id}" style="background: var(--clr-primary-10); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; cursor: pointer; transition: all 0.2s;">📄 Summarize</button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    
    return `
      <div class="conversational-response" style="background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%); padding: 24px; border-radius: 16px; margin: 0 0 20px 0; box-shadow: 0 4px 20px rgba(71, 111, 214, 0.08); border: 1px solid var(--clr-gray-100);">
        <div style="display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid var(--clr-primary-10);">
          <div style="background: linear-gradient(135deg, var(--clr-primary-10) 0%, var(--clr-primary-90) 100%); color: white; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 18px;">
            🧠
          </div>
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--clr-heading);">
              AI Response
            </h3>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: var(--clr-gray-600); font-weight: 500;">
              "${query}"
            </p>
          </div>
        </div>
        
        <div class="response-content" style="background: white; padding: 20px; border-radius: 12px; border: 1px solid var(--clr-gray-200); margin-bottom: 16px;">
          <div style="color: var(--clr-gray-800); font-size: 15px; line-height: 1.7; font-weight: 400;">
            ${formattedResponse}
          </div>
        </div>
        
        ${citationsHTML}
      </div>
    `;
  },

  createSearchSummaryHTML(enhancedResult, query) {
    if (!enhancedResult.summary) return '';
    
    const summaryLines = enhancedResult.summary.split('\n').filter(line => line.trim());
    const formattedSummary = summaryLines.map(line => {
      if (line.startsWith('**') && line.endsWith('**')) {
        // Bold headers - white text for good contrast
        const headerText = line.replace(/\*\*/g, '');
        if (headerText === 'References:') {
          // Add select all/none controls for References section
          return `
            <div style="margin: 24px 0 16px 0; padding: 16px; background: white; border-radius: 12px; border: 1px solid var(--clr-gray-200); box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);">
              <h4 style="margin: 0 0 16px 0; color: var(--clr-heading); font-size: 16px; font-weight: 600; display: flex; align-items: center;">
                <span style="background: var(--clr-primary-10); color: white; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-right: 8px; font-size: 12px;">📚</span>
                ${headerText}
              </h4>
              <div class="reference-controls" style="margin: 0 0 16px 0; display: flex; gap: 12px; align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--clr-gray-100);">
                <button id="selectAllReferences" class="reference-control-btn" style="background: var(--clr-success); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;">✓ Select All</button>
                <button id="selectNoneReferences" class="reference-control-btn" style="background: var(--clr-gray-500); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;">✗ Select None</button>
                <span id="selectedReferencesCount" style="color: var(--clr-gray-600); font-size: 12px; margin-left: auto; font-weight: 500;">10 selected</span>
              </div>
          `;
        }
        return `<h4 style="margin: 12px 0 8px 0; color: var(--clr-heading); font-size: 14px; font-weight: 600;">${headerText}</h4>`;
      } else if (line.startsWith('•')) {
        // Bullet points with numbered references
        let formattedLine = line;
        
        // Convert numbered references [[1]] to clickable citations
        formattedLine = formattedLine.replace(/\[\[(\d+)\]\]/g, '<a href="#ref-$1" class="reference-citation" data-ref-num="$1">[$1]</a>');
        
        return `<div style="margin: 16px 0; padding: 12px 16px; background: white; border-radius: 8px; border-left: 3px solid var(--clr-primary-10); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); color: var(--clr-gray-800) !important; font-size: 14px; line-height: 1.6; font-weight: 500 !important;">${formattedLine}</div>`;
      } else if (line.match(/^\[\d+\]/)) {
        // Reference links - format as clickable links with checkboxes
        const linkMatch = line.match(/^\[(\d+)\]\s*\[\[([^|]+)\|([^\]]+)\]\]/);
        if (linkMatch) {
          const [, refNum, title, url] = linkMatch;
          return `<div id="ref-${refNum}" class="reference-item" style="display: flex; align-items: center; gap: 12px; margin: 8px 0; padding: 12px; background: var(--clr-gray-50); border-radius: 8px; border: 1px solid var(--clr-gray-200); transition: all 0.2s; cursor: pointer;">
            <input type="checkbox" id="ref-checkbox-${refNum}" class="reference-checkbox" data-ref-num="${refNum}" data-url="${url}" data-title="${title}" style="margin: 0; cursor: pointer; transform: scale(1.2);" checked>
            <span class="reference-number" style="color: var(--clr-primary-10); font-weight: 700; min-width: 35px; font-size: 14px;">[${refNum}]</span>
            <a href="${url}" target="_blank" class="reference-link" style="color: var(--clr-gray-800); text-decoration: none; font-weight: 500; font-size: 14px; flex: 1;">${title}</a>
          </div>`;
        }
        return `<div style="margin: 4px 0; color: #0F172A !important; font-size: 12px; line-height: 1.4; font-weight: 600 !important;">${line}</div>`;
      } else if (line.match(/^\d+\./)) {
        // Numbered lists - light text with good contrast
        return `<li style="margin: 4px 0; color: #0F172A !important; font-size: 12px; line-height: 1.4; font-weight: 600 !important;">${line.replace(/^\d+\.\s*/, '')}</li>`;
      } else if (line.trim()) {
        // Regular paragraphs - light text with good contrast
        return `<p style="margin: 8px 0; color: #0F172A !important; font-size: 12px; line-height: 1.5; font-weight: 600 !important;">${line}</p>`;
      }
      return '';
    }).join('');
    
    return `
      <div class="search-summary" style="background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%); color: var(--clr-body); padding: 20px; border-radius: 16px; margin: 0 0 20px 0; box-shadow: 0 4px 20px rgba(71, 111, 214, 0.08); border: 1px solid var(--clr-gray-100);">
        <div style="display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid var(--clr-primary-10);">
          <div style="background: linear-gradient(135deg, var(--clr-primary-10) 0%, var(--clr-primary-90) 100%); color: white; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 16px;">
            🧠
          </div>
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--clr-heading);">
              Key Insights
            </h3>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--clr-gray-600); font-weight: 500;">
              for "${query}"
            </p>
          </div>
        </div>
        <div class="summary-content" style="color: var(--clr-gray-800) !important; font-size: 14px; line-height: 1.6; font-weight: 500 !important;">
          ${formattedSummary}
        </div>
      </div>
    `;
  },
  
  createEnhancedContentHTML(result, query) {
    let content = '<div class="enhanced-content" style="margin-top: 12px; padding: 12px; background: #F8FAFC; border-radius: 8px; border-left: 3px solid var(--clr-primary-10); border: 1px solid #E2E8F0;">';
    
    // Add key highlights first
    if (result.keyHighlights && result.keyHighlights.length > 0) {
      content += '<div class="key-highlights" style="margin-bottom: 12px;">';
      content += '<h5 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 600; color: #1C3F99; text-transform: uppercase;">🔍 Key Matches</h5>';
      
      result.keyHighlights.slice(0, 2).forEach(highlight => {
        content += `<div class="highlight-item" style="margin: 6px 0; padding: 6px 8px; background: #FFFFFF; border-radius: 4px; font-size: 11px; line-height: 1.3; color: #334155; border: 1px solid #E2E8F0;">${highlight.highlighted}</div>`;
      });
      content += '</div>';
    }
    
    // Add relevant snippets
    if (result.snippets && result.snippets.length > 0) {
      content += '<div class="relevant-snippets">';
      content += '<h5 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 600; color: #1C3F99; text-transform: uppercase;">📄 Relevant Passages</h5>';
      
      result.snippets.slice(0, 2).forEach((snippet, index) => {
        content += `
          <div class="snippet-item" style="margin: 8px 0; padding: 8px; background: #FFFFFF; border-radius: 6px; border-left: 2px solid #10B981; border: 1px solid #E2E8F0;">
            <div class="snippet-text" style="font-size: 12px; line-height: 1.4; color: #334155;">${snippet.highlighted}</div>
          </div>
        `;
      });
      content += '</div>';
    }
    
    content += '</div>';
    return content;
  },
  
  createEnhancedActionsHTML(entryId) {
    return `
      <div class="enhanced-actions" style="margin-top: 8px; padding: 8px 12px; background: var(--clr-gray-50); border-radius: 0 0 12px 12px; display: flex; gap: 8px; font-size: 11px;">
        <button class="enhanced-action-btn expand-passages" data-entry-id="${entryId}" style="background: var(--clr-info); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px;">📖 View All Passages</button>
        <button class="enhanced-action-btn view-context" data-entry-id="${entryId}" style="background: var(--clr-success); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px;">🔍 View Context</button>
        <button class="enhanced-action-btn copy-enhanced" data-entry-id="${entryId}" style="background: var(--clr-warning); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px;">📋 Copy with References</button>
      </div>
    `;
  },
  
  extractAuthorFromUrl(url) {
    if (!url) return 'Unknown Author';
    
    const urlPatterns = [
      { pattern: 'paulgraham.com', author: 'Paul Graham' },
      { pattern: 'samaltman.com', author: 'Sam Altman' },
      { pattern: 'gwern.net', author: 'Gwern Branwen' },
      { pattern: 'lesswrong.com', author: 'LessWrong' },
      { pattern: 'marginalrevolution.com', author: 'Marginal Revolution' },
      { pattern: 'stratechery.com', author: 'Ben Thompson' },
      { pattern: 'waitbutwhy.com', author: 'Tim Urban' }
    ];
    
    for (const { pattern, author } of urlPatterns) {
      if (url.includes(pattern)) return author;
    }
    
    // Extract domain as fallback
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch {
      return 'Unknown Author';
    }
  },
  
  setupEnhancedResultListeners() {
    // Set up event listeners for enhanced search result interactions
    document.querySelectorAll('.enhanced-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const entryId = e.target.getAttribute('data-entry-id');
        const action = e.target.classList.contains('expand-passages') ? 'expand' :
                      e.target.classList.contains('view-context') ? 'context' : 'copy';
        
        this.handleEnhancedAction(entryId, action);
      });
    });
  },
  
  async handleEnhancedAction(entryId, action) {
    const entry = AppState.allEntries.find(e => String(e.id) === String(entryId));
    if (!entry) return;
    
    switch (action) {
      case 'expand':
        this.showAllPassages(entry);
        break;
      case 'context':
        this.showEnhancedContext(entry);
        break;
      case 'copy':
        await this.copyWithReferences(entry);
        break;
    }
  },
  
  showAllPassages(entry) {
    // Find enhanced search result data for this entry
    const enhancedEntry = AppState.lastEnhancedSearchResult?.results.find(r => String(r.id) === String(entry.id));
    if (!enhancedEntry || !enhancedEntry.relevantPassages) {
      Utils.showNotification('No additional passages found', 'info');
      return;
    }
    
    let passagesHTML = '<div class="all-passages-modal">';
    passagesHTML += `<h3>All Relevant Passages from "${entry.title}"</h3>`;
    
    enhancedEntry.relevantPassages.forEach((passage, index) => {
      passagesHTML += `
        <div class="passage-item" style="margin: 12px 0; padding: 12px; background: var(--clr-gray-50); border-radius: 8px; border-left: 3px solid var(--clr-primary-10);">
          <div class="passage-content" style="font-size: 13px; line-height: 1.5;">${passage.highlighted}</div>
        </div>
      `;
    });
    
    passagesHTML += '</div>';
    
    UI.showModal('All Relevant Passages', passagesHTML);
  },
  
  showEnhancedContext(entry) {
    // Show the full article with enhanced highlighting
    const enhancedEntry = AppState.lastEnhancedSearchResult?.results.find(r => String(r.id) === String(entry.id));
    
    let contextHTML = `<div class="enhanced-context">`;
    contextHTML += `<h3>${entry.title}</h3>`;
    contextHTML += `<div class="context-meta" style="margin: 8px 0; font-size: 12px; color: var(--clr-gray-600);">`;
    contextHTML += `<a href="${entry.url}" target="_blank" style="color: var(--clr-primary-10);">${entry.url}</a>`;
    contextHTML += `</div>`;
    
    if (enhancedEntry && enhancedEntry.keyHighlights) {
      contextHTML += `<div class="context-highlights" style="margin: 16px 0; padding: 12px; background: var(--clr-gray-50); border-radius: 8px;">`;
      contextHTML += `<h4 style="margin: 0 0 8px 0; font-size: 13px; color: var(--clr-primary-90);">🔍 Key Highlights in Context</h4>`;
      enhancedEntry.keyHighlights.forEach(highlight => {
        contextHTML += `<div class="context-highlight" style="margin: 8px 0; padding: 8px; background: white; border-radius: 4px; font-size: 12px;">${highlight.highlighted}</div>`;
      });
      contextHTML += `</div>`;
    }
    
    contextHTML += `<div class="full-content" style="margin-top: 16px; font-size: 13px; line-height: 1.6;">${Utils.escapeHtml(entry.text || entry.content || '')}</div>`;
    contextHTML += `</div>`;
    
    UI.showModal('Enhanced Context View', contextHTML);
  },
  
  async copyWithReferences(entry) {
    const enhancedEntry = AppState.lastEnhancedSearchResult?.results.find(r => String(r.id) === String(entry.id));
    
    let textToCopy = `${entry.title}\nSource: ${entry.url}\n\n`;
    
    if (enhancedEntry && enhancedEntry.snippets) {
      textToCopy += `Key Passages:\n`;
      enhancedEntry.snippets.forEach((snippet, index) => {
        // Remove HTML tags from highlighted text
        const cleanText = snippet.text.replace(/<[^>]*>/g, '');
        textToCopy += `${index + 1}. ${cleanText}\n`;
      });
      textToCopy += '\n';
    }
    
    textToCopy += `Full Content:\n${entry.text || entry.content || ''}`;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      Utils.showNotification('Copied with references to clipboard!', 'success');
    } catch (error) {
      console.error('Copy failed:', error);
      Utils.showNotification('Copy failed', 'error');
    }
  },
  

  
  async copyResult(entryId) {
    const entry = AppState.allEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    try {
      await navigator.clipboard.writeText(entry.text);
      Utils.showNotification('Copied to clipboard!', 'success');
    } catch (error) {
      console.error('Copy failed:', error);
      Utils.showNotification('Copy failed', 'error');
    }
  },
  
  viewResult(entryId) {
    const entry = AppState.allEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    UI.showFullTextModal(entry, AppState.currentSearch);
  },
  
    
  
  clearResults() {
    // Cancel any ongoing search
    if (AppState.isSearching) {
      AppState.searchCancelled = true;
      AppState.isSearching = false;
      this.showLoading(false);
      this.hideSearchLoading();
    }
    
    AppState.currentSearch = '';
    AppState.lastSearchResults = [];
    AppState.lastConversationalResult = null;
    AppState.conversationHistory = [];
    
    // Clear selections when returning to home page
    AppState.homeSelectedArticles.clear();
    
    // Update UI to reflect cleared selections
    Data.updateSelectionUI();
    Data.updateCheckboxStates();
    Data.updateToggleButtonText();
    
    Utils.hideElement(Elements.searchResults);
    Utils.hideElement(Elements.noResults);
    
    // Ensure search results are completely hidden
    if (Elements.searchResults) {
      Elements.searchResults.style.display = 'none';
    }
    
    // Ensure no results message is completely hidden
    if (Elements.noResults) {
      Elements.noResults.style.display = 'none';
    }
    
    // Clear search input
    if (Elements.searchInput) Elements.searchInput.value = '';
    
    // Return to main page by loading regular entries
    // Hide the search tab to show the main content
    const searchTab = document.getElementById('searchTab');
    if (searchTab) {
      searchTab.style.display = 'none';
    }
    
    // Ensure the main entries container is visible
    if (Elements.entriesContainer) {
      Elements.entriesContainer.style.display = 'block';
    }
    
    Data.loadEntries();
    
    // Update clear button visibility
    this.updateClearButtonVisibility();
    
    this.saveState();
  },
  
  clearResultsOnly() {
    // Cancel any ongoing search
    if (AppState.isSearching) {
      AppState.searchCancelled = true;
      AppState.isSearching = false;
      this.showLoading(false);
      this.hideSearchLoading();
    }
    
    AppState.lastSearchResults = [];
    AppState.lastConversationalResult = null;
    AppState.conversationHistory = [];
    
    // Clear selections when switching search modes
    AppState.homeSelectedArticles.clear();
    
    // Update UI to reflect cleared selections
    Data.updateSelectionUI();
    Data.updateCheckboxStates();
    Data.updateToggleButtonText();
    
    Utils.hideElement(Elements.searchResults);
    Utils.hideElement(Elements.noResults);
    
    // Ensure search results are completely hidden
    if (Elements.searchResults) {
      Elements.searchResults.style.display = 'none';
    }
    
    // Ensure no results message is completely hidden
    if (Elements.noResults) {
      Elements.noResults.style.display = 'none';
    }
    
    // Return to main page by loading regular entries
    Data.loadEntries();
    
    // Update clear button visibility
    this.updateClearButtonVisibility();
  },
  
  showLoading(show) {
    Utils.showElement(Elements.loadingIndicator, show);
  },
  
  async saveState() {
    await Utils.set('searchState', {
      currentSearch: AppState.currentSearch,
      currentSearchMode: AppState.currentSearchMode,
      searchFilterState: AppState.searchFilterState
    });
  },
  
  async restoreState() {
    const saved = await Utils.get('searchState');
    if (saved) {
      AppState.currentSearch = saved.currentSearch || '';
      AppState.currentSearchMode = saved.currentSearchMode || 'semantic';
      AppState.searchFilterState = { ...AppState.searchFilterState, ...saved.searchFilterState };
      
      if (Elements.searchInput) Elements.searchInput.value = AppState.currentSearch;
      UI.updateSearchOptions();
      
      // Sync filter dropdowns with restored state
      if (Elements.timeFilter) Elements.timeFilter.value = AppState.searchFilterState.timeFilter || 'any';
      if (Elements.resultsFilter) Elements.resultsFilter.value = AppState.searchFilterState.resultsFilter || 'verbatim';
      if (Elements.advancedFilter) Elements.advancedFilter.value = AppState.searchFilterState.advancedFilter || 'off';
      
      this.updateClearButtonVisibility();
    }
  },
  
  updateClearButtonVisibility() {
    if (Elements.searchClear && Elements.searchInput) {
      const hasText = Elements.searchInput.value.trim().length > 0;
      Elements.searchClear.style.display = hasText ? 'flex' : 'none';
    }
  },
  
  showSearchLoading() {
    if (Elements.searchLoading) {
      Elements.searchLoading.style.display = 'block';
    }
    // Keep clear button visible during loading so users can cancel the search
    // The clear button will still be controlled by updateClearButtonVisibility() based on text content
  },
  
  hideSearchLoading() {
    if (Elements.searchLoading) {
      Elements.searchLoading.style.display = 'none';
    }
    // Restore clear button visibility if there's text
    this.updateClearButtonVisibility();
  }
};

// === SORTING FUNCTIONALITY ===
const Sorting = {
  init() {
    this.setupSortButtons();
    this.updateSortButtons();
  },
  
  setupSortButtons() {
    Elements.sortDropdown?.addEventListener('change', (e) => this.setSort(e.target.value));
  },
  
  setSort(sortType) {
    AppState.currentSort = sortType;
    this.updateSortButtons();
    this.sortAndDisplayEntries();
    this.saveSortState();
  },
  
  updateSortButtons() {
    // Update dropdown value to match current sort
    if (Elements.sortDropdown) {
      Elements.sortDropdown.value = AppState.currentSort;
    }
  },
  
  sortAndDisplayEntries() {
    const sortedEntries = this.sortEntries(AppState.allEntries);
    Data.displayEntries(sortedEntries);
  },
  
  sortEntries(entries) {
    const sorted = [...entries];
    
    switch (AppState.currentSort) {
      case 'date-desc':
        return sorted.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      case 'date-asc':
        return sorted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      case 'alpha':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return sorted;
    }
  },
  
  async saveSortState() {
    await Utils.set('sortState', { currentSort: AppState.currentSort });
  },
  
  async restoreSortState() {
    const saved = await Utils.get('sortState');
    if (saved && saved.currentSort) {
      AppState.currentSort = saved.currentSort;
      this.updateSortButtons();
    }
  }
};

// === UI MANAGEMENT ===
const UI = {
  init() {
    this.setupTabs();
    this.setupSearchOptions();
    this.setupEventListeners();
    this.updateSearchOptions();
    
    // Ensure filter toolbar starts hidden for both search modes (hidden by default)
    if (Elements.searchFilters) {
      Utils.hideElement(Elements.searchFilters);
      Elements.searchFilters.style.display = 'none';
      Elements.searchFilters.setAttribute('data-hidden', 'true');
    }
    
    // Ensure filter toggle button starts hidden for semantic search only
    if (Elements.toggleFilters && AppState.currentSearchMode === 'semantic') {
      Utils.hideElement(Elements.toggleFilters);
    }
    
    // Set up message listener for auto-detection
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'NOTEBOOKLM_AUTO_DETECTED') {
    
        
        // Update UI to show auto-detection status
        if (Elements.exportToNotebookLM) {
          Elements.exportToNotebookLM.textContent = '🔄 Auto-Exporting...';
          Elements.exportToNotebookLM.disabled = true;
          
          // Re-enable after a delay
          setTimeout(() => {
            if (Elements.exportToNotebookLM) {
              Elements.exportToNotebookLM.textContent = 'Export to NotebookLM';
              Elements.exportToNotebookLM.disabled = false;
            }
          }, 5000);
        }
        
        // Show notification
        Utils.showNotification(message.message || 'Auto-detected NotebookLM notebook!', 'success');
      }
    });
  },
  
  setupTabs() {
    Elements.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        this.switchTab(targetTab);
      });
    });
  },
  
  switchTab(tabName) {
    // Hide all tab contents
    Elements.tabContents.forEach(tab => {
      tab.style.display = 'none';
      tab.classList.remove('active');
    });
    
    // Show the selected tab
    const selectedTab = document.getElementById(tabName + 'Tab');
    if (selectedTab) {
      selectedTab.style.display = 'block';
      selectedTab.classList.add('active');
    } else {
      console.error('Tab not found:', tabName + 'Tab');
    }
    
    // Update UI based on the selected tab
    if (tabName === 'settings') {
      // Clear any search results when switching to settings
      Search.clearResultsOnly();
    }
  },
  
  showSettingsTab() {
    this.switchTab('settings');
    // Load storage stats when settings tab is shown
    this.loadStorageStats();
    // Load usage stats (embeds/searches caps)
    this.loadUsageStats?.();
  },

  async loadUsageStats() {
    try {
      const searchesUsedEl = document.getElementById('searchesUsed');
      if (searchesUsedEl) searchesUsedEl.textContent = 'Loading...';

      const status = await Utils.sendMessage({ action: 'usage_status' });
      const searches = status?.searches ?? 0;
      const maxSearches = status?.maxSearches ?? 200;

      if (searchesUsedEl) searchesUsedEl.textContent = `${searches}/${maxSearches}`;
    } catch (e) {
      const searchesUsedEl = document.getElementById('searchesUsed');
      if (searchesUsedEl) searchesUsedEl.textContent = '0/200';
    }
  },
  
  async loadStorageStats() {
    try {
      // Set loading state
      const recentCount = document.getElementById('recentCount');
      const archivedCount = document.getElementById('archivedCount');
      const totalCount = document.getElementById('totalCount');
      const storageUsage = document.getElementById('storageUsage');
      const embeddedCount = document.getElementById('embeddedCount');
      const searchesUsedEl = document.getElementById('searchesUsed');
      
      if (recentCount) recentCount.textContent = 'Loading...';
      if (archivedCount) archivedCount.textContent = 'Loading...';
      if (totalCount) totalCount.textContent = 'Loading...';
      if (storageUsage) storageUsage.textContent = 'Loading...';
      if (embeddedCount) embeddedCount.textContent = 'Loading...';
      if (searchesUsedEl) searchesUsedEl.textContent = 'Loading...';
      
      // Try to get storage stats with timeout
      const response = await Utils.withTimeout(
        Utils.sendMessage({ action: 'get_storage_stats' }),
        5000 // 5 second timeout
      );
      
      if (response && response.stats) {
        const stats = response.stats;
        // Also fetch usage status for searches used
        let usageStatus = null;
        try { usageStatus = await Utils.sendMessage({ action: 'usage_status' }); } catch (_) {}
        
        // Update storage stats display
        if (recentCount) recentCount.textContent = stats.recentCount || 0;
        if (archivedCount) archivedCount.textContent = stats.archivedCount || 0;
        if (totalCount) totalCount.textContent = stats.totalCount || 0;
        if (storageUsage) storageUsage.textContent = `${stats.chromeStorageUsageMB || '0.00'} MB`;
        if (embeddedCount) {
          // Show embedded vectors across existing entries, denominator is total articles
          const embedded = stats.embeddedCount || 0;
          const denominator = stats.totalCount || 0;
          embeddedCount.textContent = `${embedded}/${denominator}`;
        }
        if (searchesUsedEl) {
          const searches = usageStatus?.searches ?? 0;
          const maxSearches = usageStatus?.maxSearches ?? 200;
          searchesUsedEl.textContent = `${searches}/${maxSearches}`;
        }
      } else {
        // Fallback to basic stats from chrome.storage.local only
        const recentEntries = await Utils.get('entries') || [];
        const usage = await chrome.storage.local.getBytesInUse();
        
        if (recentCount) recentCount.textContent = recentEntries.length;
        if (archivedCount) archivedCount.textContent = '0';
        if (totalCount) totalCount.textContent = recentEntries.length;
        if (storageUsage) storageUsage.textContent = `${(usage / 1024 / 1024).toFixed(2)} MB`;
        if (embeddedCount) embeddedCount.textContent = `0/${recentEntries.length}`;
        if (searchesUsedEl) searchesUsedEl.textContent = '0/200';
      }
    } catch (error) {
      console.error('Failed to load storage stats:', error);
      
      // Set fallback values on error
      const recentCount = document.getElementById('recentCount');
      const archivedCount = document.getElementById('archivedCount');
      const totalCount = document.getElementById('totalCount');
      const storageUsage = document.getElementById('storageUsage');
      const embeddedCount = document.getElementById('embeddedCount');
      const searchesUsedEl = document.getElementById('searchesUsed');
      
      if (recentCount) recentCount.textContent = '0';
      if (archivedCount) archivedCount.textContent = '0';
      if (totalCount) totalCount.textContent = '0';
      if (storageUsage) storageUsage.textContent = '0.00 MB';
      if (embeddedCount) embeddedCount.textContent = '0/0';
      if (searchesUsedEl) searchesUsedEl.textContent = '0/200';
    }
  },
  
  setupSearchOptions() {
    Elements.searchOptions.forEach(option => {
      option.addEventListener('click', async () => {
        const previousMode = AppState.currentSearchMode;
        AppState.currentSearchMode = option.dataset.mode;
        
        // Clear filters when switching to semantic search
        if (previousMode === 'keyword' && AppState.currentSearchMode === 'semantic') {
          Filters.reset();
        }
        
        this.updateSearchOptions();
        await Search.saveState();
        
        // Clear current results when switching modes to improve UX
        // This ensures that when user presses Enter, they get results in the new mode
        if (previousMode !== AppState.currentSearchMode) {
          // Cancel any ongoing semantic search immediately when switching modes
          if (AppState.isSearching) {
            AppState.searchCancelled = true;
            AppState.isSearching = false;
            Search.showLoading(false);
            Search.hideSearchLoading();
          }
          
          // If switching from semantic to keyword search, return to main page
          if (previousMode === 'semantic' && AppState.currentSearchMode === 'keyword') {
            Search.clearResults();
          } else {
            Search.clearResultsOnly();
          }
        }
      });
    });
  },
  
  updateSearchOptions() {
    Elements.searchOptions.forEach(option => {
      const shouldBeActive = option.dataset.mode === AppState.currentSearchMode;
      
      if (shouldBeActive) {
        // Set active styles - light blue background with blue frame
        option.style.setProperty('background', 'var(--clr-btn-bg)', 'important'); // Light background
        option.style.setProperty('border', '1.5px solid var(--clr-primary-10)', 'important'); // Blue frame
        option.style.setProperty('color', 'var(--clr-heading)', 'important');
      } else {
        // Set inactive styles
        option.style.setProperty('background', 'var(--clr-btn-bg)', 'important');
        option.style.setProperty('border', '1.5px solid var(--clr-btn-border)', 'important');
        option.style.setProperty('color', 'var(--clr-heading)', 'important');
      }
      
      Utils.toggleClass(option, 'active', shouldBeActive);
    });
    
    // Update search input placeholder
    if (Elements.searchInput) {
      const newPlaceholder = AppState.currentSearchMode === 'semantic' 
        ? "Semantic search your saved text..."
        : "Keyword search your saved text...";
      Elements.searchInput.placeholder = newPlaceholder;
    }
    
    // Show/hide entire filter toolbar for keyword search only (hidden by default)
    if (Elements.searchFilters) {
      if (AppState.currentSearchMode === 'keyword') {
        // Keep filters hidden by default, but available for toggle
        Utils.hideElement(Elements.searchFilters);
        Elements.searchFilters.style.display = 'none';
        Elements.searchFilters.setAttribute('data-hidden', 'true');
    } else {
        Utils.hideElement(Elements.searchFilters);
        // Force hide with inline style and data attribute to override any CSS
        Elements.searchFilters.style.display = 'none';
        Elements.searchFilters.setAttribute('data-hidden', 'true');
      }
    }
    
    // Show/hide filter toggle button for keyword search only
    if (Elements.toggleFilters) {
      if (AppState.currentSearchMode === 'keyword') {
        Utils.showElement(Elements.toggleFilters, true);
      } else {
        Utils.hideElement(Elements.toggleFilters);
      }
    }
    
    // Adjust clear button position based on search mode
    if (Elements.searchClear) {
      if (AppState.currentSearchMode === 'semantic') {
        // In semantic search, no filter button, so clear button goes all the way to the right
        Elements.searchClear.style.right = '12px';
      } else {
        // In keyword search, filter button is present, so clear button needs space
        Elements.searchClear.style.right = '70px';
      }
    }
    

  },
  
  showHNSWNotification(message, type = 'info') {
    // Remove existing notification
    this.hideHNSWNotification();
    
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'hnsw-notification';
    notification.className = `notification ${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'warning' ? '#fef3c7' : '#dbeafe'};
      color: ${type === 'warning' ? '#92400e' : '#1e40af'};
      border: 1px solid ${type === 'warning' ? '#f59e0b' : '#3b82f6'};
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;
    
    notification.textContent = message;
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: inherit;
      opacity: 0.7;
    `;
    closeBtn.onclick = () => this.hideHNSWNotification();
    notification.appendChild(closeBtn);
    
    // Auto-hide after 6 seconds
    setTimeout(() => this.hideHNSWNotification(), 6000);
    
    document.body.appendChild(notification);
  },
  
  hideHNSWNotification() {
    const notification = document.getElementById('hnsw-notification');
    if (notification) {
      notification.remove();
    }
  },
  
  setupEventListeners() {
    // Search listeners

    
    if (Elements.searchInput) {
      Elements.searchInput.addEventListener('input', (e) => {
    
        Search.handleInput(e);
        Search.updateClearButtonVisibility();
      });
      
      Elements.searchInput.addEventListener('keydown', (e) => {
        Search.handleKeydown(e);
      });
      
      // Prevent any form submission
      Elements.searchInput.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
    }
    
    Elements.searchClear?.addEventListener('click', Search.clearResults.bind(Search));
    
    // Entry management
    Elements.clearBtn?.addEventListener('click', Data.clearAllEntries.bind(Data));
    Elements.exportBtn?.addEventListener('click', Data.exportData.bind(Data));
    Elements.capturePageBtn?.addEventListener('click', Data.capturePage.bind(Data));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Cmd+Shift+S for capture
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        Data.capturePage();
      }
      
      // Escape key to clear search
      if (e.key === 'Escape' && Elements.searchInput && Elements.searchInput === document.activeElement) {
        e.preventDefault();
        Search.clearResults();
      }
    });
    
    // Global event listeners to prevent unwanted navigation
    document.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    });
    
    // Monitor for any navigation attempts
    const originalOpen = window.open;
    window.open = function(...args) {
      return originalOpen.apply(this, args);
    };
    
    // Settings
    Elements.saveApiKeyBtn?.addEventListener('click', Data.saveApiKey.bind(Data));
    if (Elements.autoCaptureDelaySelect) {
      Elements.autoCaptureDelaySelect.addEventListener('change', (e) => {
        const val = e.target.value;
        Data.changeAutoCaptureDelay(val);
      });
    }
    if (Elements.applyProxyBtn) {
      Elements.applyProxyBtn.addEventListener('click', async () => {
        const url = Elements.customProxyUrlInput?.value?.trim() || '';
        await Data.applyCustomProxy(url);
      });
    }
    if (Elements.testProxyBtn) {
      Elements.testProxyBtn.addEventListener('click', async () => {
        const url = Elements.customProxyUrlInput?.value?.trim() || '';
        await Data.testCustomProxy(url);
      });
    }
    
    // Test button
    const testTextExtractionBtn = document.getElementById('testTextExtractionBtn');
    if (testTextExtractionBtn) {
      testTextExtractionBtn.addEventListener('click', async () => {
        try {
          await Utils.sendMessage({ action: 'testTextExtraction' });
          Utils.showNotification('Text extraction test initiated', 'info');
        } catch (error) {
          console.error('Failed to test text extraction:', error);
          Utils.showNotification('Test failed: ' + error.message, 'error');
        }
      });
    }
    
    // Duplicate modal event listeners
    const duplicateModal = document.getElementById('duplicateModal');
    const keepOriginalBtn = document.getElementById('keepOriginalBtn');
    const replaceBtn = document.getElementById('replaceBtn');
    const duplicateModalCloseBtn = document.getElementById('duplicateModalCloseBtn');
    
    // Close button event listener
    if (duplicateModalCloseBtn) {
      duplicateModalCloseBtn.addEventListener('click', () => {
        duplicateModal.style.display = 'none';
        // Default to keeping original when closing
        if (window.duplicateModalResolve) {
          window.duplicateModalResolve(false); // Keep original
          window.duplicateModalResolve = null;
        }
      });
      
      // Add hover effects via JavaScript (CSP compliant)
      duplicateModalCloseBtn.addEventListener('mouseenter', () => {
        duplicateModalCloseBtn.style.background = 'var(--clr-gray-100)';
        duplicateModalCloseBtn.style.color = 'var(--clr-heading)';
      });
      
      duplicateModalCloseBtn.addEventListener('mouseleave', () => {
        duplicateModalCloseBtn.style.background = 'none';
        duplicateModalCloseBtn.style.color = 'var(--clr-gray-600)';
      });
    }
    
    // Close modal when clicking on overlay
    if (duplicateModal) {
      duplicateModal.addEventListener('click', (e) => {
        if (e.target === duplicateModal) {
          duplicateModal.style.display = 'none';
          // Default to keeping original when closing
          if (window.duplicateModalResolve) {
            window.duplicateModalResolve(false); // Keep original
            window.duplicateModalResolve = null;
          }
        }
      });
    }
    
    if (keepOriginalBtn && replaceBtn) {
      keepOriginalBtn.addEventListener('click', () => {
        duplicateModal.style.display = 'none';
        // Send response to background script
        if (window.duplicateModalResolve) {
          window.duplicateModalResolve(false); // Keep original
          window.duplicateModalResolve = null;
        }
      });
      
      replaceBtn.addEventListener('click', () => {
        duplicateModal.style.display = 'none';
        // Send response to background script
        if (window.duplicateModalResolve) {
          window.duplicateModalResolve(true); // Replace
          window.duplicateModalResolve = null;
        }
      });
    }
    
    // Filters
    Elements.toggleFilters?.addEventListener('click', Filters.toggleVisibility.bind(Filters));
    Elements.timeFilter?.addEventListener('change', Filters.handleTimeChange.bind(Filters));
    Elements.resultsFilter?.addEventListener('change', Filters.handleResultsChange.bind(Filters));
    Elements.advancedFilter?.addEventListener('change', Filters.handleAdvancedChange.bind(Filters));
    
    // Date input listeners for filter state saving (no auto-search)
    Elements.dateFrom?.addEventListener('change', Filters.saveFilterState.bind(Filters));
    Elements.dateTo?.addEventListener('change', Filters.saveFilterState.bind(Filters));
    
    // Advanced search button
    Elements.advancedSearchBtn?.addEventListener('click', Filters.performAdvancedSearch.bind(Filters));
    

    

    
    // NotebookLM listeners

    
    // Add event listeners with retry logic
    const addButtonListeners = () => {
      if (Elements.exportToNotebookLM) {
    
        // Remove existing listeners to avoid duplicates
        Elements.exportToNotebookLM.removeEventListener('click', handleExportClick);
        Elements.exportToNotebookLM.addEventListener('click', handleExportClick);
      } else {
        console.error('UI: exportToNotebookLM element not found!');
      }
    };
    
    const handleExportClick = () => {
  
      try {
        Data.handleExportSearchResults();
      } catch (error) {
        console.error('UI: Error calling handleExportSearchResults:', error);
      }
    };
    
    // Try to add listeners immediately
    addButtonListeners();
    
    // Listen for HNSW status messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'hnswCold') {
        this.showHNSWNotification('⚠️ Semantic index is still warming up—results may be slower for a minute.', 'warning');
      } else if (message.action === 'hnswWarm') {
        this.hideHNSWNotification();
      } else if (message.action === 'showDuplicateModal') {
        // Handle duplicate modal request
        if (typeof Data.showDuplicateModal === 'function') {
          Data.showDuplicateModal(message.originalEntry, message.newEntry)
            .then(shouldReplace => {
              sendResponse({ success: true, shouldReplace: shouldReplace });
            })
            .catch(error => {
              console.error('📱 POPUP: Duplicate modal error:', error);
              sendResponse({ success: false, error: error.message });
            });
        } else {
          console.error('📱 POPUP: Data.showDuplicateModal is not a function!');
          sendResponse({ success: false, error: 'showDuplicateModal function not found' });
        }
        return true; // Keep sendResponse alive for async operation
      }
    });
    
    // Also try again after a short delay to ensure DOM is ready
    setTimeout(addButtonListeners, 100);
    
    // Detect current notebook button
    Elements.detectNotebook?.addEventListener('click', async () => {
      try {
        const currentNotebookId = await NotebookLM.getCurrentNotebook();
        if (currentNotebookId) {
          Utils.showNotification('Current notebook detected!', 'success');
        } else {
          Utils.showNotification('No NotebookLM notebook found. Please open a notebook first.', 'warning');
        }
      } catch (error) {
        console.error('UI: Error detecting notebook:', error);
        Utils.showNotification('Failed to detect notebook: ' + error.message, 'error');
      }
    });
    
    // Selection toggle button
    if (Elements.selectToggleBtn) {
      Elements.selectToggleBtn.addEventListener('click', () => {
        // Check if we're in semantic search mode with results
        const isInSemanticSearch = AppState.currentSearch && AppState.currentSearchMode === 'semantic' && AppState.lastConversationalResult && AppState.lastConversationalResult.citations;
        const isInKeywordSearch = AppState.currentSearch && AppState.currentSearchMode === 'keyword' && AppState.lastSearchResults && AppState.lastSearchResults.length > 0;
        
        let isAllSelected = false;
        
        if (isInSemanticSearch) {
          // Check if all visible citations are selected
          const visibleCitations = AppState.lastConversationalResult.citations;
          isAllSelected = visibleCitations.length > 0 && visibleCitations.every(citation => 
            AppState.homeSelectedArticles.has(String(citation.id))
          );
        } else if (isInKeywordSearch) {
          // Check if all visible keyword search results are selected
          const visibleResults = AppState.lastSearchResults;
          isAllSelected = visibleResults.length > 0 && visibleResults.every(result => 
            AppState.homeSelectedArticles.has(String(result.id))
          );
        } else {
          // Check if all entries are selected (home page behavior)
          isAllSelected = AppState.homeSelectedArticles.size === AppState.allEntries.length && AppState.allEntries.length > 0;
        }
        
        const mode = isAllSelected ? 'none' : 'all';
        Data.selectHomeArticlesBulk(mode);
        Data.updateToggleButtonText();
      });
    }
    
    // Delete selected button
    if (Elements.deleteSelectedBtn) {
      Elements.deleteSelectedBtn.addEventListener('click', () => {
        Data.deleteSelectedEntries();
      });
    }
    
    // Misc
    Elements.dismissSetupNote?.addEventListener('click', this.dismissSetupNote.bind(this));
    Elements.shortcutsLink?.addEventListener('click', this.openShortcutsPage.bind(this));
    Elements.shortcutLink?.addEventListener('click', this.openShortcutsPage.bind(this));
    
    // Settings button functionality - toggle between search and settings
    Elements.settingsIconBtn?.addEventListener('click', () => {
      const currentTab = document.querySelector('.tab-content.active');
      if (currentTab && currentTab.id === 'settingsTab') {
        // If settings is open, close it and go back to search
        UI.switchTab('search');
      } else {
        // If search is open, open settings
        UI.switchTab('settings');
      }
    });
    
    // Add event listener for empty state shortcut link
    const emptyStateShortcutLink = document.getElementById('emptyStateShortcutLink');
    if (emptyStateShortcutLink) {
      emptyStateShortcutLink.addEventListener('click', this.openShortcutsPage.bind(this));
    }
    Elements.clearErrorStatesBtn?.addEventListener('click', Data.clearErrorStates.bind(Data));
    
    // Update embeddings button
    const updateEmbeddingsBtn = document.getElementById('updateEmbeddingsBtn');
    if (updateEmbeddingsBtn) {
      updateEmbeddingsBtn.addEventListener('click', Data.updateEmbeddings.bind(Data));
    }

    // Export button event listeners
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => Data.exportData('json'));
    }

    const exportMdBtn = document.getElementById('exportMdBtn');
    if (exportMdBtn) {
      exportMdBtn.addEventListener('click', () => Data.exportData('markdown'));
    }

    const exportTxtBtn = document.getElementById('exportTxtBtn');
    if (exportTxtBtn) {
      exportTxtBtn.addEventListener('click', () => Data.exportData('text'));
    }

    // Close settings button
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener('click', () => UI.switchTab('search'));
    }

    // Auto-capture toggle
    if (Elements.autoCaptureToggle) {
      Elements.autoCaptureToggle.addEventListener('change', () => Data.toggleAutoCapture());
    }

    // On-page reminder toggle
    if (Elements.webReminderToggle) {
      Elements.webReminderToggle.addEventListener('change', () => Data.toggleWebReminder());
    }
  },
  
  showFullTextModal(entry, searchQuery = '') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${Utils.escapeHtml(entry.title)}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-text">${Search.highlightSearchTerms(entry.text, searchQuery)}</div>
        </div>
        <div class="modal-footer">
          <button class="btn-copy-modal">Copy Text</button>
          <button class="btn-close-modal">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    const closeModal = () => {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleKeyDown);
    };
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.btn-close-modal').addEventListener('click', closeModal);
    modal.querySelector('.btn-copy-modal').addEventListener('click', () => {
      Search.copyResult(entry.id);
      closeModal();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    document.addEventListener('keydown', handleKeyDown);
  },
  
  showModal(title, content, options = {}) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    const { 
      showCopyButton = false, 
      copyText = '', 
      maxWidth = '600px',
      onClose = null 
    } = options;
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: ${maxWidth}; max-height: 80vh; overflow-y: auto;">
        <div class="modal-header">
          <h3>${Utils.escapeHtml(title)}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        <div class="modal-footer">
          ${showCopyButton ? '<button class="btn-copy-modal">Copy</button>' : ''}
          <button class="btn-close-modal">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    const closeModal = () => {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleKeyDown);
      if (onClose) onClose();
    };
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.btn-close-modal').addEventListener('click', closeModal);
    
    if (showCopyButton) {
      modal.querySelector('.btn-copy-modal').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(copyText);
          Utils.showNotification('Copied to clipboard!', 'success');
        } catch (error) {
          console.error('Copy failed:', error);
          Utils.showNotification('Copy failed', 'error');
        }
      });
    }
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    document.addEventListener('keydown', handleKeyDown);
    
    return modal;
  },
  
  async dismissSetupNote() {
    Utils.hideElement(Elements.setupNote);
    await Utils.set('setupNoteDismissed', true);
  },
  
  openShortcutsPage(event) {
    event.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  },
  
  formatShortcutForDisplay(shortcut) {
    if (!shortcut) return '';
    
    // Handle Unicode symbol format (⇧⌘S) and convert to readable format
    let formatted = shortcut;
    
    // Replace Unicode symbols with text
    formatted = formatted.replace(/⇧/g, 'Shift+');
    formatted = formatted.replace(/⌘/g, 'Command+');
    formatted = formatted.replace(/⌥/g, 'Option+');
    formatted = formatted.replace(/⌃/g, 'Control+');
    
    // Also handle text format
    formatted = formatted.replace(/Command\+/g, 'Command+');
    formatted = formatted.replace(/Ctrl\+/g, 'Ctrl+');
    formatted = formatted.replace(/Shift\+/g, 'Shift+');
    formatted = formatted.replace(/Alt\+/g, 'Alt+');
    
    // Remove trailing +
    formatted = formatted.replace(/\+$/, '');
    
    return formatted;
  },

  async updateShortcutDisplay() {
    try {
      // Get the current shortcut key from Chrome commands API
      const commands = await chrome.commands.getAll();
      const triggerAction = commands.find(cmd => cmd.name === 'capture_page');
      
      if (triggerAction && triggerAction.shortcut) {
        // Format and update the shortcut link text
        const formattedShortcut = this.formatShortcutForDisplay(triggerAction.shortcut);
        if (Elements.shortcutLink) {
          Elements.shortcutLink.textContent = formattedShortcut;
        }
        // Also update the empty state shortcut link
        const emptyStateShortcutLink = document.getElementById('emptyStateShortcutLink');
        if (emptyStateShortcutLink) {
          emptyStateShortcutLink.textContent = formattedShortcut;
        }
    
      } else {
        // Fallback to default shortcuts
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const defaultShortcut = isMac ? 'Command + Shift + S' : 'Ctrl + Shift + S';
        
        if (Elements.shortcutLink) {
          Elements.shortcutLink.textContent = defaultShortcut;
        }
        // Also update the empty state shortcut link
        const emptyStateShortcutLink = document.getElementById('emptyStateShortcutLink');
        if (emptyStateShortcutLink) {
          emptyStateShortcutLink.textContent = defaultShortcut;
        }
    
      }
    } catch (error) {
      console.error('Failed to update shortcut display:', error);
      // Fallback to default shortcuts
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const defaultShortcut = isMac ? 'Command + Shift + S' : 'Ctrl + Shift + S';
      
      if (Elements.shortcutLink) {
        Elements.shortcutLink.textContent = defaultShortcut;
      }
      // Also update the empty state shortcut link
      const emptyStateShortcutLink = document.getElementById('emptyStateShortcutLink');
      if (emptyStateShortcutLink) {
        emptyStateShortcutLink.textContent = defaultShortcut;
      }
    }
  },
  
  toggleSelectionMode(forceState) {
    if (forceState !== undefined) {
      AppState.isSelectionMode = forceState;
    } else {
      AppState.isSelectionMode = !AppState.isSelectionMode;
    }
    
    // Update toggle button text
    if (Elements.toggleSelectionBtn) {
      Elements.toggleSelectionBtn.textContent = AppState.isSelectionMode ? 'Exit Selection' : 'Select Articles';
    }
    
    // Update selection hint visibility
    if (Elements.selectionHint) {
      Utils.showElement(Elements.selectionHint, AppState.isSelectionMode);
    }
    
    // Update entry checkboxes visibility
    const checkboxes = Utils.$$('.entry-checkbox');
    checkboxes.forEach(checkbox => {
      Utils.showElement(checkbox, AppState.isSelectionMode);
    });
    
    // Update selection toolbar
    Data.updateSelectionUI();
  },

  updateButtonStates() {
    const hasNotebook = this.notebookDropdown?.value;
    const hasSelected = AppState.homeSelectedArticles.size > 0;
    
    if (this.importToNotebookBtn) {
      this.importToNotebookBtn.disabled = !hasNotebook;
    }
    if (this.exportToNotebookLMBtn) {
      this.exportToNotebookLMBtn.disabled = !hasNotebook;
    }
    if (this.deleteSelectedBtn) {
      this.deleteSelectedBtn.disabled = !hasSelected;
    }
  },

  async refreshButtonStates() {
    // Update Add All Articles button state
    const addAllArticlesBtn = document.getElementById('addAllArticlesToNotebookLM');
    if (addAllArticlesBtn) {
      try {
        const hasArticles = AppState.allEntries && AppState.allEntries.length > 0;
        const hasNotebook = document.getElementById('notebookDropdown')?.value;
        
        if (hasArticles && hasNotebook) {
          addAllArticlesBtn.disabled = false;
          addAllArticlesBtn.title = `Add ${AppState.allEntries.length} articles to the selected notebook`;
        } else if (!hasArticles) {
          addAllArticlesBtn.disabled = true;
          addAllArticlesBtn.title = "No articles to add. Please capture some articles first.";
        } else if (!hasNotebook) {
          addAllArticlesBtn.disabled = true;
          addAllArticlesBtn.title = "Please select a NotebookLM notebook first";
        }
      } catch (error) {
        console.error('Error checking article count:', error);
        addAllArticlesBtn.disabled = true;
        addAllArticlesBtn.title = "Error checking articles";
      }
    }
  }
};

// === FILTERS ===
const Filters = {
  toggleVisibility() {
    // Only allow toggling filters in keyword search mode
    if (AppState.currentSearchMode !== 'keyword') {
      return; // Don't allow toggling in semantic search mode
    }
    
    const isVisible = Elements.searchFilters.style.display !== 'none' && !Elements.searchFilters.hasAttribute('data-hidden');
    Utils.showElement(Elements.searchFilters, !isVisible);
    
    if (!isVisible) {
      // Show filters
      Elements.searchFilters.style.display = 'block';
      Elements.searchFilters.removeAttribute('data-hidden');
    } else {
      // Hide filters
      Elements.searchFilters.style.display = 'none';
      Elements.searchFilters.setAttribute('data-hidden', 'true');
    }
    
    // Just toggle visibility, don't change button text
    // The button remains as a tool icon (🔧) and just opens/closes the filters
  },
  
  handleTimeChange() {
    AppState.searchFilterState.timeFilter = Elements.timeFilter.value;
    this.updateCustomDateRange();
    this.updateActiveDisplay();
    this.saveFilterState();
  },
  
  handleResultsChange() {
    AppState.searchFilterState.resultsFilter = Elements.resultsFilter.value;
    this.updateActiveDisplay();
    this.saveFilterState();
  },
  
  handleAdvancedChange() {
    AppState.searchFilterState.advancedFilter = Elements.advancedFilter.value;
    Utils.showElement(Elements.advancedSearch, Elements.advancedFilter.value === 'on');
    this.updateActiveDisplay();
    this.saveFilterState();
  },
  
  updateCustomDateRange() {
    const showCustom = Elements.timeFilter.value === 'custom';
    Utils.showElement(Elements.customDateRange, showCustom);
    
    // Set default dates if custom range is shown and dates are empty
    if (showCustom) {
      if (!Elements.dateFrom.value) {
        // Set default start date to 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        Elements.dateFrom.value = sevenDaysAgo.toISOString().split('T')[0];
      }
      if (!Elements.dateTo.value) {
        // Set default end date to today
        const today = new Date();
        Elements.dateTo.value = today.toISOString().split('T')[0];
      }
    }
  },
  
  saveFilterState() {
    if (Elements.timeFilter.value === 'custom') {
      AppState.searchFilterState.dateFrom = Elements.dateFrom.value;
      AppState.searchFilterState.dateTo = Elements.dateTo.value;
    }
    
    AppState.searchFilterState.isActive = true;
    Search.saveState();
    this.updateActiveDisplay();
  },
  
  applyFilters() {
    if (Elements.timeFilter.value === 'custom') {
      AppState.searchFilterState.dateFrom = Elements.dateFrom.value;
      AppState.searchFilterState.dateTo = Elements.dateTo.value;
    }
    
    AppState.searchFilterState.isActive = true;
    Search.saveState();
    
    if (AppState.currentSearch) {
      Search.performSearch(AppState.currentSearch);
    }
    
    this.updateActiveDisplay();
  },
  
  reset() {
    AppState.searchFilterState = {
      timeFilter: 'any',
      resultsFilter: 'any',
      advancedFilter: 'off',
      dateFrom: '',
      dateTo: '',
      isActive: false
    };
    
    // Reset form elements
    if (Elements.timeFilter) Elements.timeFilter.value = 'any';
    if (Elements.resultsFilter) Elements.resultsFilter.value = 'any';
    if (Elements.advancedFilter) Elements.advancedFilter.value = 'off';
    if (Elements.dateFrom) Elements.dateFrom.value = '';
    if (Elements.dateTo) Elements.dateTo.value = '';
    
    // Reset advanced search
    [Elements.allWords, Elements.exactPhrase, Elements.anyWords, Elements.noneWords]
      .forEach(el => { if (el) el.value = ''; });
    
    Utils.hideElement(Elements.advancedSearch);
    Utils.hideElement(Elements.customDateRange);
    
    this.updateActiveDisplay();
    this.saveFilterState();
  },
  
  updateActiveDisplay() {
    if (!Elements.activeFilters) return;
    
    const activeFilters = [];
    
    if (AppState.searchFilterState.timeFilter !== 'any') {
      activeFilters.push(`Time: ${AppState.searchFilterState.timeFilter}`);
    }
    
    if (AppState.searchFilterState.resultsFilter !== 'any') {
      activeFilters.push(`Results: ${AppState.searchFilterState.resultsFilter}`);
    }
    
    if (AppState.searchFilterState.advancedFilter === 'on') {
      activeFilters.push('Advanced search');
    }
    
    Elements.activeFilters.innerHTML = activeFilters.length > 0 
      ? `Active filters: ${activeFilters.join(', ')}`
      : '';
  },
  
  performAdvancedSearch() {
    // Check if advanced search is enabled
    if (AppState.searchFilterState.advancedFilter !== 'on') {
      Utils.showNotification('Please enable Advanced search first', 'warning');
      return;
    }
    
    // Get all entries and apply advanced filters
    const allEntries = AppState.allEntries || [];
    let filteredResults = [...allEntries];
    
    // Apply advanced filters
    filteredResults = Search.applyAdvancedFilter(filteredResults);
    
    // Apply other active filters (time, verbatim)
    if (AppState.searchFilterState.timeFilter !== 'any') {
      filteredResults = Search.applyTimeFilter(filteredResults);
    }
    
    if (AppState.searchFilterState.resultsFilter === 'verbatim') {
      // For advanced search, we don't have a specific query, so skip verbatim filter
      // or apply it to the combined search terms
    }
    
    // Display results
    if (filteredResults.length > 0) {
      // For highlighting, only use the "any of these words" since that's what actually matched
      // The "all these words" and "exact phrase" are requirements, not highlights
      const highlightQuery = Elements.anyWords?.value?.trim() || '';
      
      Search.displayResults(filteredResults, highlightQuery);
      AppState.lastSearchResults = filteredResults;
      AppState.currentSearch = 'Advanced Search';
      AppState.currentSearchMode = 'keyword';
      
      // Clear search input to avoid interference with advanced search results
      if (Elements.searchInput) {
        Elements.searchInput.value = '';
      }
      
      Utils.showNotification(`Found ${filteredResults.length} results with advanced filters`, 'success');
    } else {
      Search.displayResults([], '');
      Utils.showNotification('No results found with the specified advanced filters', 'info');
    }
  }
};

// === DATA MANAGEMENT ===
const Data = {
  async loadEntries() {
    try {
      const response = await Utils.sendMessage({ action: 'get_entries' });
      AppState.allEntries = response?.entries || [];
      
      // Get recent entries to track which ones are recent vs archived
      const recentResponse = await Utils.sendMessage({ action: 'get_recent_entries' });
      if (recentResponse?.entries) {
        AppState.recentEntryIds = new Set(recentResponse.entries.map(entry => String(entry.id)));
      }
      
      this.displayEntries(AppState.allEntries);
      // Update checkboxes after displaying entries
      setTimeout(() => this.updateCheckboxStates(), 100);
    } catch (error) {
      console.error('Failed to load entries:', error);
      AppState.allEntries = [];
      this.displayEntries([]);
    }
  },
  
  displayEntries(entries) {
    if (!Elements.entriesContainer) return;
    

    
    // Note: Removed the search results check as it was preventing proper display of entries
    // when clearing search results
    
    if (entries.length === 0) {
      Utils.showElement(Elements.emptyState);
      Utils.hideElement(Elements.entriesContainer);
      return;
    }
    
    Utils.hideElement(Elements.emptyState);
    Utils.showElement(Elements.entriesContainer);
    

    
    // Apply current sort to entries
    const sortedEntries = Sorting.sortEntries(entries);
    

    
    const entriesHTML = sortedEntries.map(entry => this.createEntryHTML(entry)).join('');
    Elements.entriesContainer.innerHTML = entriesHTML;
    
    // Ensure event listeners are set up after DOM is ready
    setTimeout(() => {
    this.setupEntryEventListeners();
    this.setupScrollExpansion();
      // Update checkbox states and selection UI after setup
      this.updateCheckboxStates();
      this.updateSelectionUI();
      this.updateToggleButtonText();
    }, 10);
  },
  
  createEntryHTML(entry) {
    const timestamp = Utils.formatTimestamp(entry.timestamp);
    const isSelected = AppState.homeSelectedArticles.has(String(entry.id));
    // Always show checkboxes since we have Select All/None buttons
    const checkboxVisible = 'block';
    
    // Extract author from URL or use a default
    const url = entry.url || '';
    const author = url.includes('paulgraham.com') ? 'Paul Graham' : 
                   url.includes('samaltman.com') ? 'Sam Altman' : 
                   'Unknown Author';
    
    // Check if this entry is in recent storage or archived
    // We'll determine this by checking if it's in the recent entries list
    const isRecent = AppState.recentEntryIds ? AppState.recentEntryIds.has(String(entry.id)) : true;
    const storageBadge = isRecent ? 
      '<span style="background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 500; margin-left: 8px;">Recent</span>' :
      '<span style="background: #f3e5f5; color: #7b1fa2; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 500; margin-left: 8px;">Archived</span>';
    
    return `
      <div class="entry" data-entry-id="${entry.id}">
        <div class="entry-header">
          <div class="entry-selection">
            <input type="checkbox" class="entry-checkbox" 
                   style="display: ${checkboxVisible};"
                   ${isSelected ? 'checked' : ''}
                   data-entry-id="${entry.id}">
          </div>
          <div class="entry-info">
            <h3 class="entry-title" title="${Utils.escapeHtml(entry.title)}">
              <a href="${entry.url || '#'}" target="_blank" class="entry-title-link" style="color: inherit; text-decoration: none; cursor: pointer;">
                ${Utils.escapeHtml(entry.title)}
              </a>
              ${storageBadge}
            </h3>
            <div class="entry-meta">
              <span class="author">${author}</span>
          <span class="timestamp">${timestamp}</span>
        </div>
          </div>
        </div>
      </div>
    `;
  },
  
  handleEntrySelection(entryId, isSelected) {
    const stringId = String(entryId);
    if (isSelected) {
      AppState.homeSelectedArticles.add(stringId);
    } else {
      AppState.homeSelectedArticles.delete(stringId);
    }
    this.updateSelectionUI();
    this.saveSelectedArticles();
  },
  
  async handleExportSearchResults() {
    try {
  
      
      // Check if any articles are selected
      if (AppState.homeSelectedArticles.size === 0) {
        Utils.showNotification('No articles selected for export', 'warning');
        return;
      }
      
      // Update button state
      const exportBtn = document.getElementById('exportToNotebookLM');
      if (exportBtn) {
        const originalText = exportBtn.textContent;
        exportBtn.textContent = '🔄 Exporting...';
        exportBtn.disabled = true;
        
        try {
          // Use the existing NotebookLM export functionality
          await NotebookLM.performExport();
          
          // Restore button state
          exportBtn.textContent = originalText;
          exportBtn.disabled = false;
        } catch (error) {
          // Restore button state on error
          exportBtn.textContent = originalText;
          exportBtn.disabled = false;
          throw error;
        }
      }
    } catch (error) {
      console.error('Error exporting search results:', error);
      Utils.showNotification('Failed to export to NotebookLM: ' + error.message, 'error');
    }
  },
  
  scrollToReference(refNum) {
    const element = document.getElementById(`ref-${refNum}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief highlight effect
      element.style.background = 'rgba(255, 255, 255, 0.3)';
      setTimeout(() => {
        element.style.background = 'rgba(255, 255, 255, 0.1)';
      }, 1000);
    }
  },
  
  selectAllReferences(selectAll) {
    const checkboxes = document.querySelectorAll('.reference-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = selectAll;
    });
    this.updateReferenceSelection();
  },
  
  updateReferenceSelection() {
    const checkboxes = document.querySelectorAll('.reference-checkbox');
    const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    
    // Update the count displays
    const referenceCountElement = document.getElementById('selectedReferencesCount');
    
    if (referenceCountElement) {
      referenceCountElement.textContent = `${selectedCount} selected`;
    }
    
    // Update the top export button
    const exportButton = document.getElementById('exportToNotebookLM');
    if (exportButton) {
      if (selectedCount === 0) {
        exportButton.textContent = '🧠 No References Selected';
        exportButton.disabled = true;
        exportButton.style.opacity = '0.5';
        exportButton.style.cursor = 'not-allowed';
      } else {
        exportButton.textContent = `🧠 Export ${selectedCount} Selected to NotebookLM`;
        exportButton.disabled = false;
        exportButton.style.opacity = '1';
        exportButton.style.cursor = 'pointer';
      }
    }
  },
  
  getSelectedReferences() {
    const checkboxes = document.querySelectorAll('.reference-checkbox:checked');
    return Array.from(checkboxes).map(checkbox => ({
      refNum: checkbox.dataset.refNum,
      url: checkbox.dataset.url,
      title: checkbox.dataset.title
    }));
  },

  // New: Setup citation interactions for conversational results
  setupCitationInteractions() {
    // Handle citation link clicks (scroll to source)
    document.querySelectorAll('.citation-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const citationNum = e.target.dataset.citation;
        
        // Find the citation data to get the entry ID
        const citationElement = document.getElementById(`citation-${citationNum}`);
        if (citationElement) {
          const entryId = citationElement.querySelector('.citation-checkbox')?.dataset.entryId;
          
          if (entryId) {
            // Find the corresponding search result entry
            const resultEntry = document.querySelector(`[data-entry-id="${entryId}"]`);
            if (resultEntry) {
              // Scroll to the search result entry
              resultEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // Add highlight effect to the entry
              resultEntry.style.backgroundColor = 'rgba(71, 111, 214, 0.1)';
              resultEntry.style.border = '2px solid var(--clr-primary-10)';
              resultEntry.style.borderRadius = '8px';
              
              setTimeout(() => {
                resultEntry.style.backgroundColor = '';
                resultEntry.style.border = '';
                resultEntry.style.borderRadius = '';
              }, 2000);
            }
          }
        }
      });
    });

    // Handle summarize button clicks
    document.querySelectorAll('.summarize-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const articleId = e.target.dataset.articleId;
        await this.showArticleSummary(articleId);
      });
    });

    // Handle citation checkbox clicks (for selection in semantic search)
    document.querySelectorAll('.citation-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const entryId = e.target.dataset.entryId;
        this.handleEntrySelection(entryId, e.target.checked);
      });
    });

    // Handle citation number clicks (jump to citation in AI response)
    document.querySelectorAll('.citation-number').forEach(numberSpan => {
      numberSpan.addEventListener('click', (e) => {
        const citationNum = e.target.dataset.citationNum;
        const citationLink = document.querySelector(`.citation-link[data-citation="${citationNum}"]`);
        
        if (citationLink) {
          // Scroll to the citation link in the AI response
          citationLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add highlight effect to the citation link
          citationLink.style.backgroundColor = 'rgba(71, 111, 214, 0.2)';
          citationLink.style.borderRadius = '4px';
          citationLink.style.padding = '2px 4px';
          citationLink.style.fontWeight = 'bold';
          
          setTimeout(() => {
            citationLink.style.backgroundColor = '';
            citationLink.style.borderRadius = '';
            citationLink.style.padding = '';
            citationLink.style.fontWeight = '';
          }, 2000);
        }
      });
    });

  },

  // New: Show article summary in a modal
  async showArticleSummary(articleId) {
    if (!window.vertexAISearch) return;

    try {
      // Show loading
      const button = document.querySelector(`[data-article-id="${articleId}"]`);
      const originalText = button.textContent;
      button.textContent = '⏳ Summarizing...';
      button.disabled = true;

      // Get summary from Vertex AI
      const summaryResult = await window.vertexAISearch.summarizeArticle(articleId);
      
      // Create and show modal
      this.createSummaryModal(summaryResult);
      
      // Restore button
      button.textContent = originalText;
      button.disabled = false;

    } catch (error) {
      console.error('Data: Failed to summarize article:', error);
      Utils.showNotification('Failed to summarize article', 'error');
      
      // Restore button
      const button = document.querySelector(`[data-article-id="${articleId}"]`);
      if (button) {
        button.textContent = '📄 Summarize';
        button.disabled = false;
      }
    }
  },

  // Create summary modal
  createSummaryModal(summaryResult) {
    // Remove existing modal
    const existingModal = document.getElementById('summary-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'summary-modal';
    modal.innerHTML = `
      <div class="modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
        <div class="modal-content" style="background: white; border-radius: 12px; padding: 24px; max-width: 600px; max-height: 80vh; overflow-y: auto; margin: 20px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);">
          <div class="modal-header" style="display: flex; justify-content: between; align-items: flex-start; margin-bottom: 20px;">
            <div style="flex: 1;">
              <h3 style="margin: 0; color: var(--clr-heading); font-size: 18px; font-weight: 600; line-height: 1.3;">
                ${summaryResult.title}
              </h3>
              <p style="margin: 8px 0 0 0; color: var(--clr-gray-600); font-size: 12px;">
                ${summaryResult.wordCount} words • AI Summary
              </p>
            </div>
            <button class="close-modal" style="background: none; border: none; font-size: 24px; color: var(--clr-gray-500); cursor: pointer; padding: 0; margin-left: 16px;">×</button>
          </div>
          
          <div class="summary-content" style="color: var(--clr-gray-800); font-size: 14px; line-height: 1.6;">
            ${this.formatSummaryContent(summaryResult.summary)}
          </div>
          
          <div class="modal-footer" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--clr-gray-200); display: flex; gap: 12px; justify-content: flex-end;">
            <a href="${summaryResult.url}" target="_blank" class="btn-secondary" style="padding: 8px 16px; background: var(--clr-gray-100); color: var(--clr-gray-700); text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500;">
              📖 Read Full Article
            </a>
            <button class="close-modal btn-primary" style="padding: 8px 16px; background: var(--clr-primary-10); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
              Close
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Handle close events
    modal.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });

    // Close on overlay click
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) modal.remove();
    });

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  },

  // Format summary content with proper HTML structure
  formatSummaryContent(summaryText) {
    if (!summaryText) return '';
    
    let formattedContent = summaryText
      .split('\n')
      .map(line => {
        const trimmedLine = line.trim();
        
        // Format bold sections like **Brief Overview:**
        if (trimmedLine.startsWith('**') && trimmedLine.includes(':**')) {
          const headerText = trimmedLine.replace(/\*\*/g, '');
          return `<h4 style="margin: 16px 0 8px 0; color: var(--clr-primary-10); font-size: 15px; font-weight: 600;">${headerText}</h4>`;
        }
        
        // Format bullet points
        if (trimmedLine.startsWith('•')) {
          return `<div style="margin: 6px 0; padding-left: 0; display: flex; align-items: flex-start;">
            <span style="color: var(--clr-primary-10); font-weight: bold; margin-right: 8px; line-height: 1.6;">•</span>
            <span style="flex: 1; line-height: 1.6;">${trimmedLine.substring(1).trim()}</span>
          </div>`;
        }
        
        // Format regular paragraphs
        if (trimmedLine) {
          return `<p style="margin: 8px 0; line-height: 1.6;">${trimmedLine}</p>`;
        }
        
        return '';
      })
      .join('');
    
    return formattedContent;
  },
  
  showDuplicateModal(originalEntry, newEntry) {

    return new Promise((resolve) => {
      // Store the resolve function globally so the button handlers can access it
      window.duplicateModalResolve = resolve;
      
      // Populate the modal with entry information
      const originalTitle = document.getElementById('originalTitle');
      const originalDate = document.getElementById('originalDate');
      const newTitle = document.getElementById('newTitle');
      const newDate = document.getElementById('newDate');
      

      
      if (originalTitle) originalTitle.textContent = originalEntry.title || 'Untitled';
      if (originalDate) originalDate.textContent = `Captured: ${Utils.formatTimestamp(originalEntry.timestamp)}`;
      if (newTitle) newTitle.textContent = newEntry.title || 'Untitled';
      if (newDate) newDate.textContent = `Captured: ${Utils.formatTimestamp(newEntry.timestamp)}`;
      
      // Show the modal
      const duplicateModal = document.getElementById('duplicateModal');
      if (duplicateModal) {
        duplicateModal.style.display = 'flex';
      } else {
        console.error('📱 POPUP: duplicateModal element not found!');
      }
    });
  },
  
  updateSelectionUI() {
    const selectedCount = AppState.homeSelectedArticles.size;
    const selectionInfo = Utils.$('.selection-info');
    
    if (selectionInfo) {
      selectionInfo.textContent = `${selectedCount} selected`;
      Utils.showElement(selectionInfo, selectedCount > 0);
    }
    
    // Update home selection count
    if (Elements.homeSelectedCount) {
      Elements.homeSelectedCount.textContent = selectedCount;
    }
    
    // Update toggle button text
    this.updateToggleButtonText();
    
    // Update button states (including delete button)
    UI.updateButtonStates();
  },
  
  selectHomeArticlesBulk(mode) {
    // Check if we're in semantic search mode with results
    const isInSemanticSearch = AppState.currentSearch && AppState.currentSearchMode === 'semantic' && AppState.lastConversationalResult && AppState.lastConversationalResult.citations;
    
    // Check if we're in keyword search mode with results
    const isInKeywordSearch = AppState.currentSearch && AppState.currentSearchMode === 'keyword' && AppState.lastSearchResults && AppState.lastSearchResults.length > 0;
    
    switch (mode) {
      case 'all':
        if (isInSemanticSearch) {
          // Select all articles visible in current semantic search results
          AppState.lastConversationalResult.citations.forEach(citation => {
            AppState.homeSelectedArticles.add(String(citation.id));
          });
        } else if (isInKeywordSearch) {
          // Select all articles visible in current keyword search results
          AppState.lastSearchResults.forEach(result => {
            AppState.homeSelectedArticles.add(String(result.id));
          });
        } else {
          // Select all articles in the database (home page behavior)
        AppState.allEntries.forEach(entry => AppState.homeSelectedArticles.add(String(entry.id)));
        }
        break;
      case 'none':
        if (isInSemanticSearch) {
          // Deselect only articles visible in current semantic search results
          AppState.lastConversationalResult.citations.forEach(citation => {
            AppState.homeSelectedArticles.delete(String(citation.id));
          });
        } else if (isInKeywordSearch) {
          // Deselect only articles visible in current keyword search results
          AppState.lastSearchResults.forEach(result => {
            AppState.homeSelectedArticles.delete(String(result.id));
          });
        } else {
          // Clear all selections (home page behavior)
        AppState.homeSelectedArticles.clear();
        }
        break;
      case 'recent':
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        if (isInSemanticSearch) {
          // Select recent articles from current search results
          AppState.lastConversationalResult.citations
            .filter(citation => {
              const entry = AppState.allEntries.find(e => String(e.id) === String(citation.id));
              return entry && entry.timestamp > oneWeekAgo;
            })
            .forEach(citation => AppState.homeSelectedArticles.add(String(citation.id)));
        } else if (isInKeywordSearch) {
          // Select recent articles from current keyword search results
          AppState.lastSearchResults
            .filter(result => result.timestamp > oneWeekAgo)
            .forEach(result => AppState.homeSelectedArticles.add(String(result.id)));
        } else {
          // Select recent articles from all entries (home page behavior)
        AppState.allEntries
          .filter(entry => entry.timestamp > oneWeekAgo)
          .forEach(entry => AppState.homeSelectedArticles.add(String(entry.id)));
        }
        break;
    }
    
    // Update UI state and checkboxes
    this.updateSelectionUI();
    this.updateCheckboxStates();
    this.saveSelectedArticles();
  },
  
  expandEntry(button) {
    const entryElement = button.closest('.entry');
    const entryId = entryElement.dataset.entryId;
    const entry = AppState.allEntries.find(e => e.id === entryId);
    
    if (entry) {
      const textElement = entryElement.querySelector('.entry-text');
      textElement.innerHTML = Utils.escapeHtml(entry.text);
      button.style.display = 'none';
    }
  },
  
  updateToggleButtonText() {
    if (Elements.selectToggleBtn) {
      // Check if we're in semantic search mode with results
      const isInSemanticSearch = AppState.currentSearch && AppState.currentSearchMode === 'semantic' && AppState.lastConversationalResult && AppState.lastConversationalResult.citations;
      
      // Check if we're in keyword search mode with results
      const isInKeywordSearch = AppState.currentSearch && AppState.currentSearchMode === 'keyword' && AppState.lastSearchResults && AppState.lastSearchResults.length > 0;
      
      let isAllSelected = false;
      
      if (isInSemanticSearch) {
        // Check if all visible citations are selected
        const visibleCitations = AppState.lastConversationalResult.citations;
        isAllSelected = visibleCitations.length > 0 && visibleCitations.every(citation => 
          AppState.homeSelectedArticles.has(String(citation.id))
        );
      } else if (isInKeywordSearch) {
        // Check if all visible keyword search results are selected
        const visibleResults = AppState.lastSearchResults;
        isAllSelected = visibleResults.length > 0 && visibleResults.every(result => 
          AppState.homeSelectedArticles.has(String(result.id))
        );
      } else {
        // Check if all entries are selected (home page behavior)
        isAllSelected = AppState.homeSelectedArticles.size === AppState.allEntries.length && AppState.allEntries.length > 0;
      }
      
      const newText = isAllSelected ? 'Select None' : 'Select All';
      Elements.selectToggleBtn.textContent = newText;
    }
  },
  
  async saveSelectedArticles() {
    try {
      const selectedIds = Array.from(AppState.homeSelectedArticles);
      await Utils.sendMessage({ 
        action: 'save_selected_articles', 
        selectedIds: selectedIds 
      });
  
    } catch (error) {
      console.error('Failed to save selected articles:', error);
    }
  },
  
  async loadSelectedArticles() {
    try {
      // Clear selections on reload - don't load from storage
      AppState.homeSelectedArticles.clear();
      
      // Note: UI updates will be handled after entries are displayed in initialization
    } catch (error) {
      console.error('Failed to clear selected articles:', error);
    }
  },
  
  updateCheckboxStates() {
    const checkboxes = Utils.$$('.entry-checkbox');
    
    checkboxes.forEach(checkbox => {
      // Try to get entryId from parent .entry first, then from data attribute
      let entryId;
      const entryElement = checkbox.closest('.entry');
      if (entryElement) {
        entryId = entryElement.dataset.entryId;
      } else {
        // For citation checkboxes, get entryId from data attribute
        entryId = checkbox.dataset.entryId;
      }
      
      if (entryId) {
        const shouldBeChecked = AppState.homeSelectedArticles.has(String(entryId));
        checkbox.checked = shouldBeChecked;
        // Force a visual update
        checkbox.style.display = 'block';
      }
    });
  },
  
  async copyEntry(entryId) {
    const entry = AppState.allEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    try {
      await navigator.clipboard.writeText(entry.text);
      Utils.showNotification('Copied to clipboard!', 'success');
    } catch (error) {
      console.error('Copy failed:', error);
      Utils.showNotification('Copy failed', 'error');
    }
  },
  
  viewEntry(entryId) {
    const entry = AppState.allEntries.find(e => String(e.id) === String(entryId));
    if (entry) {
      UI.showFullTextModal(entry);
    }
  },
  
  async deleteEntry(entryId) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      // Remove from UI immediately
      const entryElement = Utils.$(`[data-entry-id="${entryId}"]`);
      if (entryElement) entryElement.remove();
      
      // Remove from state
      AppState.allEntries = AppState.allEntries.filter(e => e.id !== entryId);
      AppState.homeSelectedArticles.delete(entryId);
      
      // Update backend
      await Utils.sendMessage({ action: 'delete_entry', entryId });
      
      // Refresh display
      this.displayEntries(AppState.allEntries);
      this.loadStats();
      
      Utils.showNotification('Entry deleted', 'success');
    } catch (error) {
      console.error('Delete failed:', error);
      Utils.showNotification('Delete failed', 'error');
    }
  },
  
  async deleteSelectedEntries() {
    const selectedIds = Array.from(AppState.homeSelectedArticles);
    
    if (selectedIds.length === 0) {
      Utils.showNotification('No articles selected for deletion', 'info');
      return;
    }
    
    const confirmMessage = selectedIds.length === 1 
      ? 'Are you sure you want to delete this article?' 
      : `Are you sure you want to delete ${selectedIds.length} selected articles?`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      // First, update backend for all selected entries
      for (const entryId of selectedIds) {
        await Utils.sendMessage({ action: 'delete_entry', entryId: String(entryId) });
      }
      
      // Clear selection immediately
      AppState.homeSelectedArticles.clear();
      
      // Force clear search results to ensure displayEntries works
      if (Elements.searchResults) {
        Elements.searchResults.style.display = 'none';
      }
      
      // Force clear the entries container
      if (Elements.entriesContainer) {
        Elements.entriesContainer.innerHTML = '';
      }
      
      // Force reload entries from backend to ensure consistency
      await this.loadEntries();
      
      // Update selection UI after reload
      this.updateSelectionUI();
      
      const successMessage = selectedIds.length === 1 
        ? 'Article deleted' 
        : `${selectedIds.length} articles deleted`;
      Utils.showNotification(successMessage, 'success');
    } catch (error) {
      console.error('Bulk delete failed:', error);
      Utils.showNotification('Delete failed', 'error');
    }
  },
  
  async clearAllEntries() {
    if (!confirm('Are you sure you want to clear all entries? This cannot be undone.')) return;
    
    try {
      await Utils.sendMessage({ action: 'clear_entries' });
      AppState.allEntries = [];
      AppState.homeSelectedArticles.clear();
      this.displayEntries([]);
      this.loadStats();
      Utils.showNotification('All entries cleared', 'success');
    } catch (error) {
      console.error('Clear failed:', error);
      Utils.showNotification('Clear failed', 'error');
    }
  },
  
  async loadStats() {
    try {
      const response = await Utils.sendMessage({ action: 'get_stats' });
      if (response?.stats) {
        if (Elements.entryCount) Elements.entryCount.textContent = response.stats.entryCount;
        if (Elements.totalWords) Elements.totalWords.textContent = response.stats.totalWords;
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  },
  


  async updateAIModelStatus() {
    try {
      const statusElement = document.getElementById('aiModelStatus');
      if (!statusElement) return;

      if (!window.semanticSearch) {
        statusElement.textContent = 'Not initialized';
        statusElement.style.color = '#FF8A80';
        return;
      }

      const status = window.semanticSearch.getStatus();
      
      if (status.isLoading) {
        statusElement.textContent = 'Loading...';
        statusElement.style.color = '#FFE082';
      } else if (status.isModelLoaded) {
        statusElement.textContent = 'Ready';
        statusElement.style.color = '#4CAF50';
      } else {
        statusElement.textContent = 'Not loaded';
        statusElement.style.color = '#FF8A80';
      }
    } catch (error) {
      console.error('Failed to update AI model status:', error);
    }
  },
  
  async updateEmbeddingStatus() {
    try {
      if (!window.semanticSearch) return;
      
      const entries = AppState.allEntries || [];
      if (entries.length === 0) return;
      
      // Get embedding status from Vertex AI Search
      const status = window.semanticSearch.getStatus();
      const embeddedCount = status.documentCount || 0;
      const totalCount = entries.length;
      const unembeddedCount = totalCount - embeddedCount;
      
      // Update embedding status display
      const embeddingStatusElement = document.getElementById('embeddingStatus');
      if (embeddingStatusElement) {
        if (unembeddedCount > 0) {
          embeddingStatusElement.textContent = `${unembeddedCount} articles need embedding`;
          embeddingStatusElement.style.color = '#FF8A80';
          embeddingStatusElement.style.fontWeight = '600';
          
          // Show notification if this is the first time we detect unembedded articles
          if (!AppState.embeddingNotificationShown) {
            Utils.showNotification(`${unembeddedCount} articles need embedding for semantic search. Click "Update Embeddings" to process them.`, 'warning');
            AppState.embeddingNotificationShown = true;
          }
        } else {
          embeddingStatusElement.textContent = 'All articles embedded';
          embeddingStatusElement.style.color = '#4CAF50';
          embeddingStatusElement.style.fontWeight = '500';
        }
      }
      
      // Update the update embeddings button
      const updateEmbeddingsBtn = document.getElementById('updateEmbeddingsBtn');
      if (updateEmbeddingsBtn) {
        updateEmbeddingsBtn.style.display = unembeddedCount > 0 ? 'block' : 'none';
        updateEmbeddingsBtn.textContent = `Update Embeddings (${unembeddedCount})`;
      }
      
    } catch (error) {
      console.error('Failed to update embedding status:', error);
    }
  },
  
  async updateEmbeddings() {
    try {
      const updateEmbeddingsBtn = document.getElementById('updateEmbeddingsBtn');
      if (updateEmbeddingsBtn) {
        updateEmbeddingsBtn.textContent = '🔄 Updating...';
        updateEmbeddingsBtn.disabled = true;
      }
      
      Utils.showNotification('Starting embedding update...', 'info');
      
      // Trigger embedding update by performing a dummy semantic search
      if (window.semanticSearch) {
        await window.semanticSearch.semanticSearch('test', 1);
        Utils.showNotification('Embeddings updated successfully!', 'success');
      } else {
        Utils.showNotification('Semantic search not available', 'error');
      }
      
      // Update the status
      await this.updateEmbeddingStatus();
      
    } catch (error) {
      console.error('Failed to update embeddings:', error);
      Utils.showNotification('Failed to update embeddings: ' + error.message, 'error');
    } finally {
      const updateEmbeddingsBtn = document.getElementById('updateEmbeddingsBtn');
      if (updateEmbeddingsBtn) {
        updateEmbeddingsBtn.disabled = false;
        await this.updateEmbeddingStatus(); // Refresh the button text
      }
    }
  },
  
  async saveApiKey() {
    const apiKey = Elements.apiKeyInput?.value?.trim();
    
    if (!apiKey) {
      Utils.showNotification('Please enter an API key', 'error');
      return;
    }
    
    if (apiKey === '••••••••••••••••') {
      Utils.showNotification('API key already configured', 'info');
      return;
    }
    
    try {
      await Utils.sendMessage({ action: 'set_api_key', apiKey });
      Utils.showNotification('API key saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save API key:', error);
      Utils.showNotification('Failed to save API key', 'error');
    }
  },
  
  async exportData(format = 'json') {
    try {
      const stats = await this.getStats();
      const timestamp = new Date().toISOString().split('T')[0];
      let content, filename, mimeType;

      switch (format) {
        case 'json':
      const exportData = {
        timestamp: Date.now(),
        version: '2.0.0',
        entries: AppState.allEntries,
        stats: stats,
        searchFilterState: AppState.searchFilterState
      };
          content = JSON.stringify(exportData, null, 2);
          filename = `knowledge-capture-export-${timestamp}.json`;
          mimeType = 'application/json';
          break;

        case 'markdown':
          content = this.generateMarkdownExport();
          filename = `knowledge-capture-export-${timestamp}.md`;
          mimeType = 'text/markdown';
          break;

        case 'text':
          content = this.generateTextExport();
          filename = `knowledge-capture-export-${timestamp}.txt`;
          mimeType = 'text/plain';
          break;

        default:
          throw new Error('Unsupported export format');
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      Utils.showNotification(`${format.toUpperCase()} export completed successfully`, 'success');
    } catch (error) {
      console.error('Export failed:', error);
      Utils.showNotification('Export failed', 'error');
    }
  },

  generateMarkdownExport() {
    let markdown = `# SecondBrain AI Search Export\n\n`;
    markdown += `**Export Date:** ${new Date().toLocaleDateString()}\n`;
    markdown += `**Total Entries:** ${AppState.allEntries.length}\n\n`;
    markdown += `---\n\n`;

    AppState.allEntries.forEach((entry, index) => {
      markdown += `## ${index + 1}. ${entry.title}\n\n`;
      markdown += `**URL:** ${entry.url}\n\n`;
      markdown += `**Captured:** ${new Date(entry.timestamp).toLocaleString()}\n\n`;
      markdown += `**Content:**\n\n${entry.text}\n\n`;
      markdown += `---\n\n`;
    });

    return markdown;
  },

  generateTextExport() {
    let text = `SecondBrain AI Search Export\n`;
    text += `Export Date: ${new Date().toLocaleDateString()}\n`;
    text += `Total Entries: ${AppState.allEntries.length}\n\n`;
    text += `==========================================\n\n`;

    AppState.allEntries.forEach((entry, index) => {
      text += `${index + 1}. ${entry.title}\n`;
      text += `URL: ${entry.url}\n`;
      text += `Captured: ${new Date(entry.timestamp).toLocaleString()}\n\n`;
      text += `Content:\n${entry.text}\n\n`;
      text += `==========================================\n\n`;
    });

    return text;
  },
  
  async getStats() {
    const entryCount = AppState.allEntries.length;
    const totalWords = AppState.allEntries.reduce((sum, entry) => 
      sum + (entry.text ? entry.text.split(' ').length : 0), 0
    );
    
    return { entryCount, totalWords };
  },
  
  async clearErrorStates() {
    try {
      await Utils.sendMessage({ action: 'clear_error_states' });
      // Removed notification since this is called automatically during initialization
    } catch (error) {
      console.error('Failed to clear error states:', error);
      // Only show error notification if it's a manual action
      if (error.message !== 'Extension context invalidated') {
      Utils.showNotification('Failed to clear error states', 'error');
      }
    }
  },
  
  async capturePage() {
    try {
      // Show loading state
      Utils.setDisabled(Elements.capturePageBtn, true);
      if (Elements.capturePageBtn) Elements.capturePageBtn.textContent = '📄 Capturing...';
      
      // Send capture request
      const response = await Utils.sendMessage({ action: 'capture_page' });
      
      if (response.success) {
        if (response.action === 'saved') {
        Utils.showNotification(`✅ Captured: ${response.entry.title}`, 'success');
        // Hide onboarding note after first successful capture
        try {
          const onboardingEl = document.getElementById('onboardingNote');
          if (onboardingEl) onboardingEl.style.display = 'none';
        } catch (_) {}
        } else if (response.action === 'kept_original') {
          Utils.showNotification(`📄 Kept original: ${response.entry.title}`, 'info');
        } else {
          Utils.showNotification(`✅ Captured: ${response.entry.title}`, 'success');
        }
        
        // Reload the articles list to show the new capture
        await this.loadEntries();
        await this.loadStats();
        
            // Update embedding status since we have a new article
    await this.updateEmbeddingStatus();
        
        // Switch to home view if in search mode
        if (AppState.currentSearch) {
          Search.clearResults();
        }
      } else {
        throw new Error(response.error || 'Capture failed');
      }
    } catch (error) {
      console.error('Page capture failed:', error);
      Utils.showNotification(`Failed to capture page: ${error.message}`, 'error');
    } finally {
      // Reset button state
      Utils.setDisabled(Elements.capturePageBtn, false);
      if (Elements.capturePageBtn) Elements.capturePageBtn.textContent = '📄 Capture Page';
    }
  },
  
  // Handle refresh display message from background script
  async handleRefreshDisplay() {
    try {
  
      await this.loadEntries();
      await this.loadStats();
      await this.updateEmbeddingStatus();
      // Also hide onboarding if entries now exist
      try {
        const { entries } = await chrome.runtime.sendMessage({ action: 'get_entries' });
        const hasEntries = Array.isArray(entries) && entries.length > 0;
        const onboardingEl = document.getElementById('onboardingNote');
        if (onboardingEl) onboardingEl.style.display = hasEntries ? 'none' : 'block';
      } catch (_) {}
    } catch (error) {
      console.error('Failed to refresh display:', error);
    }
  },
  
  // Check for recent captures when popup opens
  async checkForRecentCaptures() {
    try {
      // Get the last time we checked for captures
      const lastCheck = await Utils.get('lastCaptureCheck') || 0;
      const currentTime = Date.now();
      
      // If it's been less than 10 seconds since last check, refresh the display
      if (currentTime - lastCheck < 10000) {

        await this.loadEntries();
        await this.loadStats();
        await this.updateEmbeddingStatus();
        
        // Clear the timestamp so we don't keep refreshing
        await Utils.set('lastCaptureCheck', 0);
      }
    } catch (error) {
      console.error('Failed to check for recent captures:', error);
    }
  },
  
  setupEntryEventListeners() {
    if (!Elements.entriesContainer) return;
    
    // Remove existing listeners to prevent duplicates
    Elements.entriesContainer.removeEventListener('click', this.handleEntryClick);
    Elements.entriesContainer.removeEventListener('change', this.handleEntryChange);
    
    // Add event delegation for entry actions, export button, and reference controls
    this.handleEntryClick = (e) => {
      // Export button handled directly in UI setup, not through event delegation
      
      // Handle select all references button
      if (e.target.id === 'selectAllReferences') {
        this.selectAllReferences(true);
        return;
      }
      
      // Handle select none references button
      if (e.target.id === 'selectNoneReferences') {
        this.selectAllReferences(false);
        return;
      }
      
      // Handle reference citation clicks
      if (e.target.classList.contains('reference-citation')) {
        const refNum = e.target.dataset.refNum;
        if (refNum) {
          this.scrollToReference(refNum);
        }
        e.preventDefault();
        return;
      }
      

      
      const button = e.target.closest('button[data-action]');
      if (!button) return;
      
      const action = button.dataset.action;
      const entryId = button.dataset.entryId;
      
      
      switch (action) {
        case 'copy':
          this.copyEntry(entryId);
          break;
        case 'view':
        case 'view-full':
          this.viewEntry(entryId);
          break;
        case 'delete':
          this.deleteEntry(entryId);
          break;
        case 'expand':
          this.expandEntry(button);
          break;
      }
    };
    
    this.handleEntryChange = (e) => {
      // Handle reference checkboxes
      if (e.target.classList.contains('reference-checkbox')) {
        this.updateReferenceSelection();
        return;
      }
      
      // Handle entry checkboxes
      const checkbox = e.target.closest('.entry-checkbox');
      if (!checkbox) return;
      
      const entryId = checkbox.dataset.entryId;
      const isSelected = checkbox.checked;
      this.handleEntrySelection(entryId, isSelected);
    };
    
    Elements.entriesContainer.addEventListener('click', this.handleEntryClick);
    Elements.entriesContainer.addEventListener('change', this.handleEntryChange);
  },
  
  setupScrollExpansion() {
    // Simple scroll-based expansion logic
    const container = Elements.entriesContainer;
    if (!container) return;
    
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      
      // If scrolled near bottom, expand truncated entries
      if (scrollTop + clientHeight > scrollHeight - 100) {
        const expandButtons = container.querySelectorAll('.expand-btn:not(.expanded)');
        expandButtons.forEach(button => {
          button.classList.add('expanded');
          this.expandEntry(button);
        });
      }
    };
    
    container.addEventListener('scroll', handleScroll);
  },

  // === SETTINGS MANAGEMENT ===
  async loadSettings() {
    try {
      const settings = await Utils.get('extensionSettings') || {};
      AppState.autoCaptureEnabled = settings.autoCaptureEnabled !== undefined ? settings.autoCaptureEnabled : true;
      AppState.webReminderEnabled = settings.webReminderEnabled !== undefined ? settings.webReminderEnabled : true;
      AppState.autoCaptureDelayMs = settings.autoCaptureDelayMs !== undefined ? settings.autoCaptureDelayMs : 'default';
      AppState.customProxyUrl = settings.customProxyUrl || '';
      
      // Update UI to reflect current setting
      if (Elements.autoCaptureToggle) {
        Elements.autoCaptureToggle.checked = AppState.autoCaptureEnabled;
      }
      if (Elements.webReminderToggle) {
        Elements.webReminderToggle.checked = AppState.webReminderEnabled;
      }
      if (Elements.autoCaptureDelaySelect) {
        Elements.autoCaptureDelaySelect.value = String(AppState.autoCaptureDelayMs);
      }
      if (Elements.customProxyUrlInput) {
        Elements.customProxyUrlInput.value = AppState.customProxyUrl || '';
      }

      // If no custom proxy and caps are exhausted, force keyword mode and disable semantic UI affordances
      try {
        const status = await Utils.sendMessage({ action: 'usage_status' });
        const embedsLeft = Math.max(0, (status.maxEmbeds || 100) - (status.embeds || 0));
        const searchesLeft = Math.max(0, (status.maxSearches || 200) - (status.searches || 0));
        const outOfProxy = !AppState.customProxyUrl || AppState.customProxyUrl.trim() === '';
        if (outOfProxy && searchesLeft === 0) {
          AppState.currentSearchMode = 'keyword';
        }
      } catch (_) {}
    } catch (error) {
      console.error('Failed to load settings:', error);
      AppState.autoCaptureEnabled = true;
      AppState.webReminderEnabled = true;
      AppState.autoCaptureDelayMs = 'default';
      AppState.customProxyUrl = '';
    }
  },

  async saveSettings() {
    try {
      const settings = {
        autoCaptureEnabled: AppState.autoCaptureEnabled,
        webReminderEnabled: AppState.webReminderEnabled,
        autoCaptureDelayMs: AppState.autoCaptureDelayMs,
        customProxyUrl: AppState.customProxyUrl || ''
      };
      await Utils.set('extensionSettings', settings);
      
      // Notify content scripts about the setting change
      await Utils.sendMessage({ 
        action: 'update_auto_capture_setting', 
        enabled: AppState.autoCaptureEnabled,
        webReminderEnabled: AppState.webReminderEnabled,
        autoCaptureDelayMs: AppState.autoCaptureDelayMs
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  },

  async toggleAutoCapture() {
    AppState.autoCaptureEnabled = !AppState.autoCaptureEnabled;
    await this.saveSettings();
    
    // Update UI
    if (Elements.autoCaptureToggle) {
      Elements.autoCaptureToggle.checked = AppState.autoCaptureEnabled;
    }
    
    // Show notification
    const status = AppState.autoCaptureEnabled ? 'enabled' : 'disabled';
    Utils.showNotification(`Auto-capture ${status}`, 'success');
  },

  async toggleWebReminder() {
    AppState.webReminderEnabled = !AppState.webReminderEnabled;
    await this.saveSettings();
    if (Elements.webReminderToggle) {
      Elements.webReminderToggle.checked = AppState.webReminderEnabled;
    }
    const status = AppState.webReminderEnabled ? 'enabled' : 'disabled';
    Utils.showNotification(`On-page reminder ${status}`, 'success');
  },

  async changeAutoCaptureDelay(value) {
    AppState.autoCaptureDelayMs = value;
    await this.saveSettings();
    Utils.showNotification('Auto-capture delay updated', 'success');
  },

  async applyCustomProxy(url) {
    AppState.customProxyUrl = url || '';
    await this.saveSettings();
    Utils.showNotification(url ? 'Custom proxy applied' : 'Custom proxy cleared', 'success');
  },

  async testCustomProxy(url) {
    try {
      if (!url) throw new Error('Enter a proxy URL first');
      const resp = await fetch(`${url}/health`, { headers: { 'X-Extension-ID': chrome.runtime.id } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      Utils.showNotification('Proxy health OK', 'success');
    } catch (e) {
      Utils.showNotification(`Proxy test failed: ${e.message}`, 'error');
    }
  }
};

// === NOTEBOOKLM CONTENT SCRIPT AUTOMATION ===
// The extension uses content script automation to interact with NotebookLM
// This approach injects scripts into the NotebookLM page to automate the UI

// === NOTEBOOKLM OBJECT (Content Script Automation) ===
const NotebookLM = {
  // State
  notebooks: [],
  sources: [],
  selectedNotebookId: '',
  recentNotebooks: [],

  // UI Elements
  get exportToNotebookLMBtn() { return Elements.exportToNotebookLM; },
  get detectNotebook() { return Elements.detectNotebook; },

  // State
  notebooks: [],
  sources: [],
  isButtonActionRunning: false,

  getSelectedEntryIds() {
    // Get selected entries from the main search tab
    const selected = Array.from(AppState.homeSelectedArticles);
    console.log('NotebookLM: Selected entry IDs:', selected);
    return selected;
  },

  getEntryById(id) {
    id = String(id); // Ensure string comparison
    console.log('NotebookLM: Looking for entry with ID:', id);
    console.log('NotebookLM: this.sources:', this.sources);
    console.log('NotebookLM: AppState.allEntries:', AppState.allEntries);
    
    // First try to find in NotebookLM sources
    if (this.sources && Array.isArray(this.sources)) {
      let entry = this.sources.find(e => String(e.id) === id);
      if (entry) {
        console.log('NotebookLM: Found entry in sources:', entry);
        return entry;
      }
    }
    
    // If not found, try to find in Home tab entries (AppState.allEntries)
    if (AppState.allEntries && Array.isArray(AppState.allEntries)) {
      let entry = AppState.allEntries.find(e => String(e.id) === id);
      if (entry) {
        console.log('NotebookLM: Found entry in home entries:', entry);
        return entry;
      }
    }
    
    console.log('NotebookLM: Entry not found in any source for ID:', id);
    console.log('NotebookLM: Available sources count:', this.sources?.length || 0);
    console.log('NotebookLM: Available home entries count:', AppState.allEntries?.length || 0);
    return null;
  },

  // Clear stored notebook preferences (for testing/reset)
  async clearNotebookPreferences() {
    try {
      await Utils.remove('selectedNotebookId');
      await Utils.remove('recentNotebooks');
      this.selectedNotebookId = '';
      this.recentNotebooks = [];
      console.log('NotebookLM: Cleared all notebook preferences');
      Utils.showNotification('Notebook preferences cleared', 'info');
    } catch (error) {
      console.error('NotebookLM: Error clearing preferences:', error);
    }
  },

  // Get current notebook from URL (when user is on NotebookLM)
  async getCurrentNotebook() {
    try {
      const tabs = await chrome.tabs.query({ url: 'https://notebooklm.google.com/*' });
      console.log('NotebookLM: Found NotebookLM tabs:', tabs.length);
      if (tabs.length > 0) {
        // Check all NotebookLM tabs to find one with a specific notebook
        for (const tab of tabs) {
          console.log('NotebookLM: Checking tab URL:', tab.url);
          // More flexible regex to match different URL patterns
          const match = tab.url.match(/\/notebook\/([a-zA-Z0-9_-]+)/);
          if (match) {
            const notebookId = match[1];
            console.log('NotebookLM: Detected current notebook ID:', notebookId, 'in tab:', tab.id);
            return notebookId;
          }
        }
      }
      console.log('NotebookLM: No specific notebook found in any tab');
      return null;
    } catch (error) {
      console.error('NotebookLM: Error getting current notebook:', error);
      return null;
    }
  },

  // Show notebook selection UI (auto-detection approach)
  async showNotebookSelector() {
    console.log('NotebookLM: showNotebookSelector called');
    
    // Check if NotebookLM is already open, if not open it
    console.log('NotebookLM: Querying for existing NotebookLM tabs...');
    const existingTabs = await chrome.tabs.query({ url: 'https://notebooklm.google.com/*' });
    console.log('NotebookLM: Found existing tabs:', existingTabs.length, existingTabs.map(t => t.url));
    
    if (existingTabs.length === 0) {
      // No NotebookLM tab - open new one
      console.log('NotebookLM: No NotebookLM tab found, opening new tab...');
      try {
        const notebooklmTab = await chrome.tabs.create({ url: 'https://notebooklm.google.com' });
        console.log('NotebookLM: Successfully opened NotebookLM tab:', notebooklmTab.id, notebooklmTab.url);
        await chrome.tabs.update(notebooklmTab.id, { active: true });
        console.log('NotebookLM: Successfully switched to new tab');
      } catch (error) {
        console.error('NotebookLM: Failed to open NotebookLM tab:', error);
        Utils.showNotification('Failed to open NotebookLM: ' + error.message, 'error');
        return;
      }
    } else {
      // NotebookLM already open - switch to existing tab
      console.log('NotebookLM: NotebookLM already open, switching to existing tab:', existingTabs[0].id);
      try {
        await chrome.tabs.update(existingTabs[0].id, { active: true });
        console.log('NotebookLM: Successfully switched to existing tab');
      } catch (error) {
        console.error('NotebookLM: Failed to switch to existing tab:', error);
      }
    }
    
    const dialog = document.createElement('div');
    dialog.className = 'notebook-selector-modal';
    dialog.innerHTML = `
      <div class="notebook-selector-content">
        <div style="position: relative;">
          <button class="notebook-dialog-close" style="position: absolute; top: 0; right: 0; background: none; border: none; font-size: 18px; color: #666; cursor: pointer; padding: 4px; border-radius: 4px; transition: color 0.2s;" title="Close">×</button>
          <h3>📖 Export to NotebookLM</h3>
          <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">
            1. Open a notebook in NotebookLM.<br>
            <br>
            2. Export will start automatically when a notebook is opened.
          </p>
        </div>
      </div>
    `;
    
    console.log('NotebookLM: Dialog HTML created');
    
    // Add close button functionality
    const closeButton = dialog.querySelector('.notebook-dialog-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        console.log('NotebookLM: Manual close button clicked');
        dialog.remove();
        chrome.runtime.onMessage.removeListener(autoCloseListener);
        clearInterval(fallbackInterval);
      });
      
      // Add hover effect
      closeButton.addEventListener('mouseenter', () => {
        closeButton.style.color = '#333';
      });
      closeButton.addEventListener('mouseleave', () => {
        closeButton.style.color = '#666';
      });
    }
    
    console.log('NotebookLM: Dialog configured with manual close option');
    
    // Set up auto-close when notebook is detected
    const autoCloseListener = (message, sender, sendResponse) => {
      console.log('NotebookLM: Received message in auto-close listener:', message);
      if (message.type === 'NOTEBOOKLM_AUTO_DETECTED' && message.notebookId) {
        console.log('NotebookLM: Auto-detection received, closing dialog and auto-exporting');
        dialog.remove();
        // Remove this listener since dialog is closed
        chrome.runtime.onMessage.removeListener(autoCloseListener);
        // Auto-trigger export with the detected notebook
        this.performExportWithNotebook(message.notebookId);
      }
    };
    
    chrome.runtime.onMessage.addListener(autoCloseListener);
    
    // Also set up a fallback: check for notebook detection periodically
    const checkNotebookDetection = async () => {
      try {
        const currentNotebookId = await this.getCurrentNotebook();
        if (currentNotebookId) {
          console.log('NotebookLM: Fallback detection found notebook:', currentNotebookId);
          dialog.remove();
          chrome.runtime.onMessage.removeListener(autoCloseListener);
          // Auto-trigger export with the detected notebook
          this.performExportWithNotebook(currentNotebookId);
          return true;
        }
        return false;
      } catch (error) {
        console.error('NotebookLM: Error in fallback detection:', error);
        return false;
    }
    };
    
    // Check every 2 seconds for up to 30 seconds
    let checkCount = 0;
    const maxChecks = 15;
    const fallbackInterval = setInterval(async () => {
      checkCount++;
      const detected = await checkNotebookDetection();
      if (detected || checkCount >= maxChecks) {
        clearInterval(fallbackInterval);
      }
    }, 2000);
    
    console.log('NotebookLM: Adding dialog to document.body');
    document.body.appendChild(dialog);
    console.log('NotebookLM: Modal should now be visible');
    
    // Force a reflow to ensure the modal is visible
    dialog.offsetHeight;
    console.log('NotebookLM: Modal should now be visible');
  },

  // Export with specific notebook ID
  async performExportWithNotebook(notebookId) {
    console.log('NotebookLM: Exporting to notebook:', notebookId);
    
    // Get selected articles
    const selectedEntryIds = Array.from(AppState.homeSelectedArticles);
    if (!selectedEntryIds || selectedEntryIds.length === 0) {
      Utils.showNotification('Please select at least one article to export', 'error');
      return;
    }
    
    // Use the automation approach with selected notebook
    console.log('NotebookLM: Using automation for notebook:', notebookId);
    
    const selectedArticles = selectedEntryIds.map(id => {
      const entry = this.getEntryById(id);
      return entry ? {
        title: entry.title || 'Untitled',
        url: entry.url || '',
        content: entry.content || ''
      } : null;
    }).filter(Boolean);

    if (selectedArticles.length === 0) {
      Utils.showNotification('No valid articles found for export', 'error');
        return;
      }
      
    // Send to background script for automation
        try {
          await chrome.runtime.sendMessage({
            action: 'addArticlesToNotebookLM',
        notebookId: notebookId,
        articles: selectedArticles
          });
      
      Utils.showNotification(`Exporting ${selectedArticles.length} articles to NotebookLM...`, 'info');
        } catch (error) {
      console.error('NotebookLM: Export failed:', error);
      Utils.showNotification('Export failed: ' + error.message, 'error');
    }
  },

  // Export handler - simplified with auto-detection
  async performExport() {
    console.log('NotebookLM: performExport called');
    
    // Prevent multiple simultaneous executions
    if (this.isButtonActionRunning) {
      console.log('NotebookLM: Export already running, skipping duplicate request');
      Utils.showNotification('Export already in progress, please wait...', 'warning');
      return;
    }
    
    this.isButtonActionRunning = true;
    
    try {
      // Check if NotebookLM is already open with a notebook
      console.log('NotebookLM: Checking for existing notebook...');
      const currentNotebookId = await this.getCurrentNotebook();
      console.log('NotebookLM: getCurrentNotebook result:', currentNotebookId);
      
      // Check if notebook already open - if yes, auto-inject immediately
      if (currentNotebookId) {
        console.log('NotebookLM: Notebook already open, auto-injecting immediately');
        await this.performExportWithNotebook(currentNotebookId);
      } else {
        console.log('NotebookLM: No notebook open, opening NotebookLM and showing dialog');
        await this.showNotebookSelector();
      }
    } catch (error) {
      console.error('NotebookLM: Export error:', error);
      Utils.showNotification('Export failed: ' + error.message, 'error');
    } finally {
      this.isButtonActionRunning = false;
    }
  },
  
  async openNotebookLMAndShowInstructions() {
    // Close any existing NotebookLM tabs that don't have a specific notebook
    try {
      const existingTabs = await chrome.tabs.query({ url: 'https://notebooklm.google.com/*' });
      for (const tab of existingTabs) {
        // Only close tabs that are on the home page, not specific notebooks
        if (!tab.url.includes('/notebook/')) {
          console.log('NotebookLM: Closing existing NotebookLM home tab:', tab.id);
          await chrome.tabs.remove(tab.id);
        }
      }
    } catch (error) {
      console.error('NotebookLM: Error closing existing tabs:', error);
    }
    
    // Open NotebookLM automatically
    try {
      const notebooklmTab = await chrome.tabs.create({ url: 'https://notebooklm.google.com' });
      console.log('NotebookLM: Opened NotebookLM tab:', notebooklmTab.id);
      // Switch to the new tab so user sees it
      await chrome.tabs.update(notebooklmTab.id, { active: true });
    } catch (error) {
      console.error('NotebookLM: Failed to open NotebookLM tab:', error);
    }
    
    // Show simple instructions
    Utils.showNotification('📖 NotebookLM opened! Please navigate to your notebook, then the extension will auto-export your articles.', 'info', 8000);
  },

  // Manual trigger for notebook selector (for debugging)
  async showNotebookSelectorManual() {
    console.log('NotebookLM: Manual notebook selector trigger');
    try {
      await this.showNotebookSelector();
    } catch (error) {
      console.error('NotebookLM: Error showing notebook selector:', error);
      Utils.showNotification('Failed to show notebook selector: ' + error.message, 'error');
      }
  },

  // Flag to prevent multiple simultaneous button clicks
  isButtonActionRunning: false,




};

// === DRAG SELECT FUNCTIONALITY ===
const DragSelect = {
  isDragging: false,
  startElement: null,
  endElement: null,
  dragOverlay: null,
  
  init() {
    this.createDragOverlay();
    this.setupEventListeners();
  },
  
  createDragOverlay() {
    this.dragOverlay = document.createElement('div');
    this.dragOverlay.className = 'drag-overlay';
    this.dragOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 123, 255, 0.05);
      border: 1px solid rgba(0, 123, 255, 0.3);
      pointer-events: none;
      z-index: 9999;
      display: none;
    `;
    document.body.appendChild(this.dragOverlay);
  },
  
  setupEventListeners() {
    // Mouse events for drag selection
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // Prevent text selection during drag
    document.addEventListener('selectstart', this.handleSelectStart.bind(this));
  },
  
  handleMouseDown(e) {
    // Only start drag selection if clicking on entry containers and selection mode is enabled
    const entryContainer = e.target.closest('.entry, .search-result, .citation-item');
    if (!entryContainer || !AppState.isSelectionMode) return;
    
    // Don't start drag if clicking on interactive elements
    if (e.target.closest('button, input, a')) return;
    
    this.isDragging = true;
    this.startElement = entryContainer;
    this.endElement = entryContainer;
    
    // Determine if we're selecting or deselecting based on the starting element's state
    const checkbox = entryContainer.querySelector('.entry-checkbox');
    const entryId = checkbox?.dataset.entryId;
    this.isDeselecting = entryId ? AppState.homeSelectedArticles.has(entryId) : false;
    
    // Add visual feedback
    entryContainer.style.backgroundColor = this.isDeselecting ? 'rgba(255, 0, 0, 0.1)' : 'rgba(0, 123, 255, 0.1)';
    
    // Prevent default to avoid text selection
    e.preventDefault();
  },
  
  handleMouseMove(e) {
    if (!this.isDragging) return;
    
    // Auto-scroll when near edges (do this first)
    this.handleAutoScroll(e);
    
    // Find the element under the current mouse position using enhanced detection
    const currentElement = this.getElementAtPosition(e.clientX, e.clientY);
    if (currentElement && currentElement !== this.endElement) {
      this.endElement = currentElement;
      this.updateSelection();
    }
    
    // Update drag overlay
    this.updateDragOverlay(e);
  },
  
  handleMouseUp(e) {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.clearDragOverlay();
    
    // Remove visual feedback
    if (this.startElement) {
      this.startElement.style.backgroundColor = '';
    }
    
    // Finalize selection
    this.finalizeSelection();
  },
  
  handleSelectStart(e) {
    // Prevent text selection during drag
    if (this.isDragging) {
      e.preventDefault();
    }
  },
  
  updateSelection() {
    if (!this.startElement || !this.endElement) return;
    
    const entries = Array.from(document.querySelectorAll('.entry, .search-result, .citation-item'));
    const startIndex = entries.indexOf(this.startElement);
    const endIndex = entries.indexOf(this.endElement);
    
    if (startIndex === -1 || endIndex === -1) return;
    
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    
    // Clear previous selection visual feedback
    entries.forEach(entry => {
      entry.style.backgroundColor = '';
    });
    
    // Select/deselect range based on starting element's state
    for (let i = minIndex; i <= maxIndex; i++) {
      const entry = entries[i];
      const checkbox = entry.querySelector('.entry-checkbox');
      const entryId = checkbox?.dataset.entryId;
      
      if (checkbox && entryId) {
        const isCurrentlySelected = AppState.homeSelectedArticles.has(entryId);
        const shouldBeSelected = this.isDeselecting ? false : true;
        
        // Apply the action (select or deselect)
        if (shouldBeSelected && !isCurrentlySelected) {
          checkbox.checked = true;
          AppState.homeSelectedArticles.add(entryId);
          entry.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
        } else if (!shouldBeSelected && isCurrentlySelected) {
          checkbox.checked = false;
          AppState.homeSelectedArticles.delete(entryId);
          entry.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
        }
      }
    }
    
    // Update UI
    Data.updateSelectionUI();
  },
  
  // Enhanced element detection that works better with scrolling
  getElementAtPosition(x, y) {
    const element = document.elementFromPoint(x, y);
    return element?.closest('.entry, .search-result, .citation-item') || null;
  },
  
  finalizeSelection() {
    // Clear visual feedback
    const allEntries = document.querySelectorAll('.entry, .search-result, .citation-item');
    allEntries.forEach(entry => {
      entry.style.backgroundColor = '';
    });
    
    // Update UI
    Data.updateSelectionUI();
  },
  
  updateDragOverlay(e) {
    if (!this.dragOverlay) return;
    
    this.dragOverlay.style.display = 'block';
    this.dragOverlay.style.left = Math.min(e.clientX, this.startElement?.getBoundingClientRect().left || 0) + 'px';
    this.dragOverlay.style.top = Math.min(e.clientY, this.startElement?.getBoundingClientRect().top || 0) + 'px';
    this.dragOverlay.style.width = Math.abs(e.clientX - (this.startElement?.getBoundingClientRect().left || 0)) + 'px';
    this.dragOverlay.style.height = Math.abs(e.clientY - (this.startElement?.getBoundingClientRect().top || 0)) + 'px';
  },
  
  clearDragOverlay() {
    if (this.dragOverlay) {
      this.dragOverlay.style.display = 'none';
    }
  },
  
  handleAutoScroll(e) {
    // Now we only scroll the text blocks area, not the entire popup
    const scrollSpeed = 35;
    const scrollThreshold = 60; // Reduced threshold for text blocks area
    
    // Get the scrollable text blocks container
    const scrollContainer = document.querySelector('.scrollable-content-area');
    if (!scrollContainer) return;
    
    const rect = scrollContainer.getBoundingClientRect();
    const mouseY = e.clientY;
    
    // Calculate distances from top and bottom of the scrollable area
    const distanceFromTop = mouseY - rect.top;
    const distanceFromBottom = rect.bottom - mouseY;
    
    // Enhanced scrolling with variable speed based on distance
    let isScrolling = false;
    
    // Scroll down when near bottom of text blocks
    if (distanceFromBottom < scrollThreshold && distanceFromBottom > 0) {
      isScrolling = true;
      const speed = distanceFromBottom < 30 ? 45 : scrollSpeed;
      
      scrollContainer.scrollTop += speed;
    }
    // Scroll up when near top of text blocks
    else if (distanceFromTop < scrollThreshold && distanceFromTop > 0) {
      isScrolling = true;
      const speed = distanceFromTop < 30 ? 45 : scrollSpeed;
      
      scrollContainer.scrollTop -= speed;
    }
    
    // Add visual feedback when scrolling
    if (isScrolling) {
      // Add a subtle visual indicator that scrolling is active
      if (!this.scrollIndicator) {
        this.scrollIndicator = document.createElement('div');
        this.scrollIndicator.style.cssText = `
          position: fixed;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 40px;
          background: rgba(0, 123, 255, 0.6);
          border-radius: 2px;
          z-index: 10000;
          pointer-events: none;
        `;
        document.body.appendChild(this.scrollIndicator);
      }
      this.scrollIndicator.style.display = 'block';
      
      // Hide indicator after a short delay
      clearTimeout(this.scrollIndicatorTimeout);
      this.scrollIndicatorTimeout = setTimeout(() => {
        if (this.scrollIndicator) {
          this.scrollIndicator.style.display = 'none';
        }
      }, 500);
    }
  }
};

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize DOM elements
    Elements.init();
    
    // Initialize UI
    UI.init();
    
    // Initialize sorting functionality
    Sorting.init();
    
    // Initialize drag select functionality
    DragSelect.init();
    
    // Load initial data
    await Promise.all([
      Data.loadEntries(),
      Data.loadStats(),
      Data.loadSelectedArticles(),
      Data.loadSettings(),
      Search.restoreState(),
      Sorting.restoreSortState()
    ]);
    
    // Update AI model status
    await Data.updateAIModelStatus();
    
    // Update embedding status
    await Data.updateEmbeddingStatus();
    
    // Initialize selection mode (enabled by default)
    Data.updateSelectionUI();
    
    // Ensure selection state is properly restored after entries are displayed
    setTimeout(() => {
      Data.updateCheckboxStates();
      Data.updateToggleButtonText();
    }, 50);
    
    // Update shortcut key display
    await UI.updateShortcutDisplay();
    
    // Force update shortcut display after a short delay to ensure it's applied
    setTimeout(async () => {
      await UI.updateShortcutDisplay();
    }, 100);
    
    // Listen for refresh display messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'refreshDisplay' || message.action === 'refresh_display') {
        Data.handleRefreshDisplay();
        sendResponse({ success: true });
      } else if (message.action === 'showNotification') {
        Utils.showNotification(message.message, message.type);
        sendResponse({ success: true });
      } else if (message.action === 'usage_cap_reached') {
        // Surface guidance to set a custom proxy URL
        Utils.showNotification('Free limit reached. Set a Custom Vertex Proxy URL in Settings to continue.', 'warning');
        sendResponse({ success: true });
      }
    });
    
    // Check for recent captures when popup opens (in case shortcut was used)
    await Data.checkForRecentCaptures();

    // If a cap warning was persisted while popup was closed, surface it now
    try {
      const { pendingUsageCapWarning } = await chrome.storage.local.get('pendingUsageCapWarning');
      if (pendingUsageCapWarning && pendingUsageCapWarning.type === 'embed') {
        Utils.showNotification('Free embedding limit reached. Set a Custom Vertex Proxy URL in Settings to continue.', 'warning');
        await chrome.storage.local.remove('pendingUsageCapWarning');
      }
    } catch (_) {}
    

    
    // Onboarding visibility: hide legacy setup card, show new note when no entries
    Utils.showElement(Elements.setupNote, false);
    try {
      const { entries } = await chrome.runtime.sendMessage({ action: 'get_entries' });
      const hasEntries = Array.isArray(entries) && entries.length > 0;
      const onboardingEl = document.getElementById('onboardingNote');
      if (onboardingEl) onboardingEl.style.display = hasEntries ? 'none' : 'block';
    } catch (_) {}
    
    // Clear any lingering error states
    await Data.clearErrorStates();
    
    // Refresh button states after loading data
    await UI.refreshButtonStates();
    // Hide onboarding note as soon as the first entry is present
    try {
      const onboardingEl = document.getElementById('onboardingNote');
      if (onboardingEl) {
        const hideIfHasEntries = async () => {
          try {
            const { entries } = await chrome.runtime.sendMessage({ action: 'get_entries' });
            const hasEntries = Array.isArray(entries) && entries.length > 0;
            onboardingEl.style.display = hasEntries ? 'none' : 'block';
          } catch (_) {}
        };
        // Check once now and again shortly after in case save completes asynchronously
        await hideIfHasEntries();
        setTimeout(hideIfHasEntries, 500);
        setTimeout(hideIfHasEntries, 1500);
      }
    } catch (_) {}
    
    // Initialize clear button visibility
    Search.updateClearButtonVisibility();
    
    // Setup settings icon click handler
    if (Elements.settingsIconBtn) {
      Elements.settingsIconBtn.addEventListener('click', () => {
        UI.showSettingsTab();
      });
    }

    // Allow background/content to request opening the Settings tab explicitly
    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.action === 'open_settings_tab') {
        UI.showSettingsTab();
      }
    });
    
    // Setup customize shortcut link click handler
    const customizeShortcutLink = document.getElementById('customizeShortcutLink');
    if (customizeShortcutLink) {
      customizeShortcutLink.addEventListener('click', (event) => {
        event.preventDefault();
        UI.openShortcutsPage(event);
      });
    }
    

  } catch (error) {
    console.error('Initialization failed:', error);
    Utils.showNotification('Initialization failed', 'error');
  }
});

// === GLOBAL EXPORTS (for inline event handlers) ===
window.Search = Search;
window.Data = Data;
window.NotebookLM = NotebookLM;
window.UI = UI;
window.Filters = Filters;
window.Sorting = Sorting;

// Reference scrolling is now handled by Data.scrollToReference()

 