// SmartGrab AI Search Extension - Popup Script
'use strict';

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
  userAnswerContentHeight: 200,
  currentSort: 'date-desc', // 'date-desc', 'date-asc', 'alpha'
  searchFilterState: {
    timeFilter: 'any',
    resultsFilter: 'any',
    advancedFilter: 'off',
    dateFrom: '',
    dateTo: '',
    isActive: false
  }
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
      console.log('Search: Empty query, clearing results');
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
    
    try {
      let results;
      if (AppState.currentSearchMode === 'semantic') {
        results = await this.performSemanticSearch(query);
      } else {
        results = await this.performKeywordSearch(query);
      }
      
      this.displayResults(results, query);
      AppState.lastSearchResults = results;
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
    const response = await Utils.sendMessage({
      action: 'search_keywords',
      query: query
    });
    
    if (response?.results) {
      const filteredResults = this.applyFilters(response.results, query);
      return filteredResults.slice(0, 50); // Limit results
    }
    return [];
  },
  
  async performSemanticSearch(query) {
    try {
      // Show loading indicator
      this.showLoading(true);
      
      // Initialize Vertex AI semantic search if not already done
      if (!window.vertexAISearch) {
        try {
          // Initialize with configuration from vertex_config.js
          window.vertexAISearch = new window.VertexAISearch();
          await window.vertexAISearch.init();
          Utils.showNotification('Connecting to Google AI...', 'info');
        } catch (error) {
          console.error('Search: Failed to initialize VertexAISearch:', error);
          // Fallback to old semantic search
          if (!window.semanticSearchV2) {
            await import('./semantic_search_v2.js');
            window.semanticSearchV2 = new window.SemanticSearchV2();
            await window.semanticSearchV2.init();
          }
        }
      }
      
      // Get all entries for search
      const entries = AppState.allEntries || [];
      if (entries.length === 0) {
        this.showLoading(false);
        return [];
      }
      
      // Perform semantic search with Vertex AI or fallback
      let searchResult;
      if (window.vertexAISearch) {
        searchResult = await window.vertexAISearch.semanticSearch(query, 20);
      } else if (window.semanticSearchV2) {
        searchResult = await window.semanticSearchV2.semanticSearch(query, 20);
      } else {
        throw new Error('No semantic search implementation available');
      }
      
      // Get the actual entries for the returned IDs
      const entryMap = new Map(entries.map(entry => [String(entry.id), entry]));
      const results = searchResult.results
        .map(({ id, score }) => {
          const entry = entryMap.get(String(id));
          if (!entry) {
            console.warn(`Search: Entry not found for ID: ${id} (type: ${typeof id})`);
            return null;
          }
          
          return {
            ...entry,
            similarity: Math.round(score * 100) / 100,
            searchType: 'semantic'
          };
        })
        .filter(Boolean);
      
      // Apply filters
      const filteredResults = this.applyFilters(results, query);
      
      this.showLoading(false);
      return filteredResults;
      
    } catch (error) {
      console.error('Search: Semantic search failed:', error);
      Utils.showNotification('AI search failed, using keyword search instead', 'warning');
      
      // Fallback to keyword search
      try {
        const entries = AppState.allEntries || [];
        const fallbackResults = await window.semanticSearch.fallbackSearch(query, entries, 20);
        const filteredResults = this.applyFilters(fallbackResults, query);
        this.showLoading(false);
        return filteredResults;
      } catch (fallbackError) {
        console.error('Search: Fallback search also failed:', fallbackError);
        this.showLoading(false);
        return [];
      }
    }
  },
  
  applyFilters(results, query) {
    let filtered = [...results];
    
    // Apply time filter
    if (AppState.searchFilterState.timeFilter !== 'any') {
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
    const now = Date.now();
    const timeRanges = {
      'hour': 60 * 60 * 1000,
      'day': 24 * 60 * 60 * 1000,
      'week': 7 * 24 * 60 * 60 * 1000,
      'month': 30 * 24 * 60 * 60 * 1000,
      'year': 365 * 24 * 60 * 60 * 1000
    };
    
    const timeRange = timeRanges[AppState.searchFilterState.timeFilter];
    if (!timeRange) return results;
    
    return results.filter(result => (now - result.timestamp) <= timeRange);
  },
  
  applyVerbatimFilter(results, query) {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    return results.filter(result => {
      const content = (result.text + ' ' + result.title).toLowerCase();
      return searchTerms.some(term => content.includes(term));
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
    if (!results || results.length === 0) {
      Utils.showElement(Elements.noResults);
      // Show regular entries when no search results
      if (Elements.entriesContainer) {
        Utils.showElement(Elements.entriesContainer);
      }
      return;
    }
    
    Utils.hideElement(Elements.noResults);
    
    // Generate entries HTML for the main entries container
    const entriesHTML = results.map(result => this.createEntryHTML(result, query)).join('');
    
    if (Elements.entriesContainer) {
      Elements.entriesContainer.innerHTML = entriesHTML;
      Utils.showElement(Elements.entriesContainer);
    } else {
      console.error('Search: entriesContainer not found!');
    }
    
    // Set up event listeners for the new entries
    Data.setupEntryEventListeners();
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
    
    // Add similarity score if available
    const similarityBadge = result.similarity ? `
      <span class="similarity-badge" style="background: #E4EEFB; color: #1C3F99; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; margin-left: 8px; border: 1px solid #D0E1F9; display: inline-flex; align-items: center; gap: 4px;">
        <span class="similarity-score">${(result.similarity * 100).toFixed(0)}%</span>
        <span class="search-type">${result.searchType === 'semantic' ? '🤖' : '📝'}</span>
      </span>
    ` : '';
    
    // Extract author from URL or use a default
    const url = result.url || '';
    const author = url.includes('paulgraham.com') ? 'Paul Graham' : 
                   url.includes('samaltman.com') ? 'Sam Altman' : 
                   'Unknown Author';
    
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
                ${Utils.escapeHtml(result.title)}
              </a>
            </h3>
            <div class="entry-meta">
            <span class="author">${author}</span>
          <span class="timestamp">${timestamp}</span>
            ${similarityBadge}
        </div>
        </div>
        </div>
      </div>
    `;
    
    return html;
  },
  
  highlightSearchTerms(text, query) {
    if (!query) return Utils.escapeHtml(text);
    
    const terms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    let highlighted = Utils.escapeHtml(text);
    
    terms.forEach(term => {
      const regex = new RegExp(`(${Utils.escapeRegExp(term)})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    
    return highlighted;
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
  
  viewFullText(entryId) {
    const entry = AppState.allEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    UI.showFullTextModal(entry, AppState.currentSearch);
  },
  
  clearResults() {
    AppState.currentSearch = '';
    AppState.lastSearchResults = [];
    
    Utils.hideElement(Elements.searchResults);
    Utils.hideElement(Elements.noResults);
    
    // Show regular entries when search is cleared
    if (Elements.entriesContainer) {
      Utils.showElement(Elements.entriesContainer);
    }
    
    if (Elements.searchInput) Elements.searchInput.value = '';
    
    this.saveState();
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
    }
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
    
    // Set up message listener for auto-detection
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'NOTEBOOKLM_AUTO_DETECTED') {
        console.log('Popup: Received auto-detection notification:', message);
        
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
    Elements.tabs.forEach(tab => {
      Utils.toggleClass(tab, 'active', tab.dataset.tab === tabName);
    });
    
    Elements.tabContents.forEach(content => {
      Utils.toggleClass(content, 'active', content.id === `${tabName}Tab`);
    });
    
    // Load tab-specific data
    if (tabName === 'settings') {
      Data.loadStats();
      Data.loadApiKeyStatus();
    }
  },
  
  setupSearchOptions() {
    console.log('UI: Setting up search options, found:', Elements.searchOptions.length);
    Elements.searchOptions.forEach(option => {
      console.log('UI: Adding click listener to:', option.dataset.mode);
      option.addEventListener('click', async () => {
        console.log('UI: Search option clicked:', option.dataset.mode);
        AppState.currentSearchMode = option.dataset.mode;
        console.log('UI: Current search mode set to:', AppState.currentSearchMode);
        this.updateSearchOptions();
        await Search.saveState();
        
        // Re-run search if active
        if (AppState.currentSearch) {
            await Search.performSearch(AppState.currentSearch);
        }
      });
    });
  },
  
  updateSearchOptions() {
    console.log('UI: Updating search options, current mode:', AppState.currentSearchMode);
    Elements.searchOptions.forEach(option => {
      const shouldBeActive = option.dataset.mode === AppState.currentSearchMode;
      console.log('UI: Option', option.dataset.mode, 'should be active:', shouldBeActive);
      
      if (shouldBeActive) {
        // Set active styles
        option.style.background = 'var(--clr-btn-hover-bg)';
        option.style.border = '1.5px solid var(--clr-primary-10)';
        option.style.color = 'var(--clr-heading)';
      } else {
        // Set inactive styles
        option.style.background = 'var(--clr-btn-bg)';
        option.style.border = '1.5px solid var(--clr-btn-border)';
        option.style.color = 'var(--clr-heading)';
      }
      
      Utils.toggleClass(option, 'active', shouldBeActive);
    });
    
    // Update search input placeholder
    if (Elements.searchInput) {
      const newPlaceholder = AppState.currentSearchMode === 'semantic' 
        ? "Semantic search your saved text..."
        : "Keyword search your saved text...";
      console.log('UI: Updating placeholder to:', newPlaceholder, 'for mode:', AppState.currentSearchMode);
      Elements.searchInput.placeholder = newPlaceholder;
    } else {
      console.log('UI: searchInput element not found!');
    }
    
    // Show/hide results filter for keyword search only
    const resultsFilterGroup = Elements.resultsFilter?.closest('.filter-group');
    if (resultsFilterGroup) {
      Utils.showElement(resultsFilterGroup, AppState.currentSearchMode === 'keyword');
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
    console.log('UI: Setting up search input listeners');
    console.log('UI: searchInput element:', Elements.searchInput);
    
    if (Elements.searchInput) {
      Elements.searchInput.addEventListener('input', (e) => {
        console.log('UI: Search input event triggered');
        Search.handleInput(e);
      });
      
      Elements.searchInput.addEventListener('keydown', (e) => {
        console.log('UI: Search keydown event triggered');
        Search.handleKeydown(e);
      });
      
      // Prevent any form submission
      Elements.searchInput.addEventListener('submit', (e) => {
        console.log('UI: Search submit event prevented');
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
    });
    
    // Global event listeners to prevent unwanted navigation
    document.addEventListener('submit', (e) => {
      console.log('UI: Global submit event detected and prevented');
      e.preventDefault();
      e.stopPropagation();
      return false;
    });
    
    // Monitor for any navigation attempts
    const originalOpen = window.open;
    window.open = function(...args) {
      console.log('UI: window.open called with args:', args);
      console.trace('UI: window.open stack trace');
      return originalOpen.apply(this, args);
    };
    
    // Settings
    Elements.saveApiKeyBtn?.addEventListener('click', Data.saveApiKey.bind(Data));
    
    // Filters
    Elements.toggleFilters?.addEventListener('click', Filters.toggleVisibility.bind(Filters));
    Elements.timeFilter?.addEventListener('change', Filters.handleTimeChange.bind(Filters));
    Elements.resultsFilter?.addEventListener('change', Filters.handleResultsChange.bind(Filters));
    Elements.advancedFilter?.addEventListener('change', Filters.handleAdvancedChange.bind(Filters));
    Elements.applyFilters?.addEventListener('click', Filters.apply.bind(Filters));
    Elements.resetFilters?.addEventListener('click', Filters.reset.bind(Filters));
    
    // NotebookLM listeners
    console.log('UI: Setting up NotebookLM event listeners...');
    console.log('UI: Elements.exportToNotebookLM:', Elements.exportToNotebookLM);
    
    // Add event listeners with retry logic
    const addButtonListeners = () => {
      if (Elements.exportToNotebookLM) {
        console.log('UI: Adding click listener to export button');
        // Remove existing listeners to avoid duplicates
        Elements.exportToNotebookLM.removeEventListener('click', handleExportClick);
        Elements.exportToNotebookLM.addEventListener('click', handleExportClick);
      } else {
        console.error('UI: exportToNotebookLM element not found!');
      }
    };
    
    const handleExportClick = () => {
      console.log('UI: Export button clicked!');
      console.log('UI: NotebookLM object:', !!NotebookLM);
      console.log('UI: NotebookLM.performExport:', !!NotebookLM?.performExport);
      try {
        NotebookLM.performExport();
      } catch (error) {
        console.error('UI: Error calling performExport:', error);
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
      }
    });
    
    // Also try again after a short delay to ensure DOM is ready
    setTimeout(addButtonListeners, 100);
    
    // Detect current notebook button
    Elements.detectNotebook?.addEventListener('click', async () => {
      console.log('UI: Detect notebook button clicked');
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
    console.log('Setting up selection toggle button:', {
      selectToggleBtn: Elements.selectToggleBtn
    });
    
    if (Elements.selectToggleBtn) {
      Elements.selectToggleBtn.addEventListener('click', () => {
        const isAllSelected = AppState.homeSelectedArticles.size === AppState.allEntries.length;
        const mode = isAllSelected ? 'none' : 'all';
        console.log(`Select toggle clicked, mode: ${mode}`);
        Data.selectHomeArticlesBulk(mode);
        Data.updateToggleButtonText();
      });
    }
    
    // Misc
    Elements.dismissSetupNote?.addEventListener('click', this.dismissSetupNote.bind(this));
    Elements.shortcutsLink?.addEventListener('click', this.openShortcutsPage.bind(this));
    Elements.clearErrorStatesBtn?.addEventListener('click', Data.clearErrorStates.bind(Data));
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
  
  async dismissSetupNote() {
    Utils.hideElement(Elements.setupNote);
    await Utils.set('setupNoteDismissed', true);
  },
  
  openShortcutsPage(event) {
    event.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
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
    
    if (this.importToNotebookBtn) {
      this.importToNotebookBtn.disabled = !hasNotebook;
      console.log('NotebookLM: Import button enabled:', !!hasNotebook);
    }
    if (this.exportToNotebookLMBtn) {
      this.exportToNotebookLMBtn.disabled = !hasNotebook;
      console.log('NotebookLM: Export button enabled:', !!hasNotebook);
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
    const isVisible = Elements.searchFilters.style.display !== 'none';
    Utils.showElement(Elements.searchFilters, !isVisible);
    
    if (Elements.toggleFilters) {
      Elements.toggleFilters.textContent = isVisible ? 'Show Filters' : 'Hide Filters';
    }
  },
  
  handleTimeChange() {
    AppState.searchFilterState.timeFilter = Elements.timeFilter.value;
    this.updateCustomDateRange();
    this.updateActiveDisplay();
  },
  
  handleResultsChange() {
    AppState.searchFilterState.resultsFilter = Elements.resultsFilter.value;
    this.updateActiveDisplay();
  },
  
  handleAdvancedChange() {
    AppState.searchFilterState.advancedFilter = Elements.advancedFilter.value;
    Utils.showElement(Elements.advancedSearch, Elements.advancedFilter.value === 'on');
    this.updateActiveDisplay();
  },
  
  updateCustomDateRange() {
    const showCustom = Elements.timeFilter.value === 'custom';
    Utils.showElement(Elements.customDateRange, showCustom);
  },
  
  async apply() {
    if (Elements.timeFilter.value === 'custom') {
      AppState.searchFilterState.dateFrom = Elements.dateFrom.value;
      AppState.searchFilterState.dateTo = Elements.dateTo.value;
    }
    
    AppState.searchFilterState.isActive = true;
    await Search.saveState();
    
    if (AppState.currentSearch) {
      await Search.performSearch(AppState.currentSearch);
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
    Search.saveState();
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
  }
};

// === DATA MANAGEMENT ===
const Data = {
  async loadEntries() {
    try {
      const response = await Utils.sendMessage({ action: 'get_entries' });
      AppState.allEntries = response?.entries || [];
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
    
    // Don't override search results if they're currently active
    if (Elements.searchResults && Elements.searchResults.style.display !== 'none') {
      console.log('Search: Skipping displayEntries because search results are active');
      return;
    }
    
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
    
    this.setupEntryEventListeners();
    this.setupScrollExpansion();
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
  },
  
  selectHomeArticlesBulk(mode) {
    console.log('selectHomeArticlesBulk called with mode:', mode);
    console.log('AppState.allEntries:', AppState.allEntries);
    
    switch (mode) {
      case 'all':
        AppState.allEntries.forEach(entry => AppState.homeSelectedArticles.add(String(entry.id)));
        break;
      case 'none':
        AppState.homeSelectedArticles.clear();
        break;
      case 'recent':
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        AppState.allEntries
          .filter(entry => entry.timestamp > oneWeekAgo)
          .forEach(entry => AppState.homeSelectedArticles.add(String(entry.id)));
        break;
    }
    
    console.log('After selection, homeSelectedArticles:', AppState.homeSelectedArticles);
    
    // Update checkboxes
    const checkboxes = Utils.$$('.entry-checkbox');
    console.log('Found checkboxes:', checkboxes.length);
    checkboxes.forEach(checkbox => {
      const entryId = checkbox.closest('.entry').dataset.entryId;
      const shouldBeChecked = AppState.homeSelectedArticles.has(String(entryId));
      console.log(`Checkbox for entry ${entryId}: shouldBeChecked=${shouldBeChecked}, current=${checkbox.checked}`);
      checkbox.checked = shouldBeChecked;
      // Force a visual update
      checkbox.style.display = 'block';
    });
    
    this.updateSelectionUI();
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
      const isAllSelected = AppState.homeSelectedArticles.size === AppState.allEntries.length && AppState.allEntries.length > 0;
      Elements.selectToggleBtn.textContent = isAllSelected ? 'Select None' : 'Select All';
    }
  },
  
  async saveSelectedArticles() {
    try {
      const selectedIds = Array.from(AppState.homeSelectedArticles);
      await Utils.sendMessage({ 
        action: 'save_selected_articles', 
        selectedIds: selectedIds 
      });
      console.log('Saved selected articles:', selectedIds);
    } catch (error) {
      console.error('Failed to save selected articles:', error);
    }
  },
  
  async loadSelectedArticles() {
    try {
      const response = await Utils.sendMessage({ action: 'get_selected_articles' });
      const selectedIds = response?.selectedIds || [];
      AppState.homeSelectedArticles.clear();
      selectedIds.forEach(id => AppState.homeSelectedArticles.add(String(id)));
      console.log('Loaded selected articles:', selectedIds);
      this.updateSelectionUI();
      this.updateToggleButtonText();
      this.updateCheckboxStates();
    } catch (error) {
      console.error('Failed to load selected articles:', error);
    }
  },
  
  updateCheckboxStates() {
    const checkboxes = Utils.$$('.entry-checkbox');
    checkboxes.forEach(checkbox => {
      const entryId = checkbox.closest('.entry')?.dataset.entryId;
      if (entryId) {
        const shouldBeChecked = AppState.homeSelectedArticles.has(String(entryId));
        checkbox.checked = shouldBeChecked;
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
    console.log('viewEntry called with entryId:', entryId);
    console.log('AppState.allEntries:', AppState.allEntries);
    const entry = AppState.allEntries.find(e => String(e.id) === String(entryId));
    console.log('Found entry:', entry);
    if (entry) {
      console.log('Calling UI.showFullTextModal');
      UI.showFullTextModal(entry);
    } else {
      console.log('Entry not found!');
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
      await this.loadApiKeyStatus();
      Utils.showNotification('API key saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save API key:', error);
      Utils.showNotification('Failed to save API key', 'error');
    }
  },
  
  async exportData() {
    try {
      // Export data directly from the popup
      const stats = await this.getStats();
      const exportData = {
        timestamp: Date.now(),
        version: '2.0.0',
        entries: AppState.allEntries,
        stats: stats,
        searchFilterState: AppState.searchFilterState
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartgrab-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Utils.showNotification('Data exported successfully', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      Utils.showNotification('Export failed', 'error');
    }
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
      Utils.showNotification('Error states cleared', 'success');
    } catch (error) {
      console.error('Failed to clear error states:', error);
      Utils.showNotification('Failed to clear error states', 'error');
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
        Utils.showNotification(`✅ Captured: ${response.entry.title}`, 'success');
        
        // Reload the articles list to show the new capture
        await this.loadEntries();
        await this.loadStats();
        
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
  
  setupEntryEventListeners() {
    if (!Elements.entriesContainer) return;
    
    // Remove existing listeners to prevent duplicates
    Elements.entriesContainer.removeEventListener('click', this.handleEntryClick);
    Elements.entriesContainer.removeEventListener('change', this.handleEntryChange);
    
    // Add event delegation for entry actions
    this.handleEntryClick = (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;
      
      const action = button.dataset.action;
      const entryId = button.dataset.entryId;
      console.log('Button clicked:', { action, entryId });
      
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
        <h3>📖 Navigate to Your Notebook</h3>
        <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">
          NotebookLM is ready. Please:
        </p>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <ol style="margin: 0; padding-left: 20px; line-height: 1.6;">
            <li><strong>Switch to the NotebookLM tab</strong></li>
            <li><strong>Navigate to your notebook</strong> (or create a new one)</li>
            <li><strong>Wait for auto-export</strong> - it will start automatically!</li>
          </ol>
          <div style="margin-top: 12px; padding: 8px; background: #e8f5e8; border-radius: 4px; font-size: 12px; color: #2e7d32;">
            ✅ <strong>Auto-Export Active:</strong> Once you open a specific notebook, the extension will automatically detect it and start exporting your selected articles!
          </div>
        </div>
        <div style="text-align: center; color: #666; font-size: 12px; font-style: italic;">
          This dialog will close automatically when you open a notebook
        </div>
      </div>
    `;
    
    console.log('NotebookLM: Dialog HTML created');
    
    // No manual close options - dialog only closes when notebook is detected
    console.log('NotebookLM: Dialog configured to only close on notebook detection');
    
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
    const entryContainer = e.target.closest('.entry, .search-result');
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
    
    const entries = Array.from(document.querySelectorAll('.entry, .search-result'));
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
    return element?.closest('.entry, .search-result') || null;
  },
  
  finalizeSelection() {
    // Clear visual feedback
    const allEntries = document.querySelectorAll('.entry, .search-result');
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
  console.log('SmartGrab AI Search - Initializing...');
  
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
      Search.restoreState(),
      Sorting.restoreSortState()
    ]);
    
    // Update AI model status
    await Data.updateAIModelStatus();
    
    // Initialize selection mode (enabled by default)
    Data.updateSelectionUI();
    

    
    // Load setup note visibility
    const setupDismissed = await Utils.get('setupNoteDismissed');
    Utils.showElement(Elements.setupNote, !setupDismissed);
    
    // Clear any lingering error states
    await Data.clearErrorStates();
    
    // Refresh button states after loading data
    await UI.refreshButtonStates();
    


    console.log('SmartGrab AI Search - Initialization complete');
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

 