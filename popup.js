// SmartGrab AI Search Extension - Popup Script
'use strict';

// === BROWSER COMPATIBILITY ===
const browser = globalThis.chrome || globalThis.browser;

// === GLOBAL STATE ===
const AppState = {
  homeSelectedArticles: new Set(),
  isSelectionMode: false,
  allEntries: [],
  currentSearch: '',
  currentSearchMode: 'semantic',
  lastSearchResults: [],
  isSearching: false,
  userAnswerContentHeight: 200,
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
    if (element) element.classList.toggle(className, condition);
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
    this.debugNotebookLMBtn = Utils.$('#debugNotebookLMBtn');
    this.testGraphQLBtn = Utils.$('#testGraphQLBtn');
    this.testGraphQLBtn2 = Utils.$('#testGraphQLBtn2');
    this.showReloadBtn = Utils.$('#showReloadBtn');
    
    // NotebookLM elements
    this.notebookDropdown = Utils.$('#notebookDropdown');
    this.importToNotebookLM = Utils.$('#importToNotebookLM');
    this.refreshNotebooks = Utils.$('#refreshNotebooks');
    this.captureAndOpenBtn = Utils.$('#captureAndOpenBtn');
    this.driveStatus = Utils.$('#driveStatus');
    this.connectDriveBtn = Utils.$('#connectDriveBtn');
    this.debugTokensBtn = Utils.$('#debugTokensBtn');
    this.exportToNotebookLM = Utils.$('#exportToNotebookLM');
    this.openDriveFolder = Utils.$('#openDriveFolder');
    this.notebooklmEntries = Utils.$('#notebooklmEntries');
    this.exportHistory = Utils.$('#exportHistory');
    
    // Selection elements
    this.toggleSelectionBtn = Utils.$('#toggleSelectionBtn');
    this.selectionHint = Utils.$('#selectionHint');
    this.homeSelectedCount = Utils.$('#homeSelectedCount');
    this.selectAllHome = Utils.$('#selectAllHome');
    this.selectNoneHome = Utils.$('#selectNoneHome');
    this.selectedCount = Utils.$('#selectedCount');
    this.selectedWords = Utils.$('#selectedWords');
    this.estimatedFiles = Utils.$('#estimatedFiles');
    this.selectAll = Utils.$('#selectAll');
    this.selectNone = Utils.$('#selectNone');
    this.selectRecentWeek = Utils.$('#selectRecentWeek');
    this.selectHighSimilarity = Utils.$('#selectHighSimilarity');
    this.selectionToolbar = Utils.$('#selectionToolbar');
    
    // Settings elements
    this.settingsIconBtn = Utils.$('#settingsIconBtn');
    
    // Semantic search elements
    this.semanticSearchContainer = Utils.$('#semanticSearchContainer');
    this.semanticInput = Utils.$('#semanticInput');
    this.toggleFiltersSemantic = Utils.$('#toggleFiltersSemantic');
    this.semanticClear = Utils.$('#semanticClear');
  }
};

// === SEARCH FUNCTIONALITY ===
const Search = {
  async handleInput(e) {
    const query = e.target.value.trim();
    AppState.currentSearch = query;
    
    if (!query) {
      this.clearResults();
      return;
    }
    
    await this.saveState();
    
    if (AppState.currentSearchMode === 'semantic') {
      this.displaySemanticPrompt(query);
    } else {
      await this.performSearch(query);
    }
  },
  
  async handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const query = e.target.value.trim();
      if (query && AppState.currentSearchMode === 'semantic') {
        await this.performSemanticSearch(query);
      }
    }
  },
  
  async performSearch(query) {
    if (AppState.isSearching) return;
    
    AppState.isSearching = true;
    this.showLoading(true);
    
    try {
      const results = AppState.currentSearchMode === 'semantic' 
        ? await this.performSemanticSearch(query)
        : await this.performKeywordSearch(query);
      
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
    const response = await Utils.sendMessage({
      action: 'search_similar',
      query: query,
      filters: AppState.searchFilterState
    });
    
    if (response?.results) {
      return response.results.slice(0, 20); // Limit semantic results
    }
    return [];
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
  
  displaySemanticPrompt(query) {
    if (!Elements.searchResults) return;
    
    Elements.searchResults.innerHTML = `
      <div class="semantic-prompt">
        <div class="semantic-icon">🤖</div>
        <h3>Ask AI about: "${Utils.escapeHtml(query)}"</h3>
        <p>Press Enter to search with AI, or switch to keyword search for exact matches.</p>
      </div>
    `;
    Utils.showElement(Elements.searchResults);
  },
  
  displayResults(results, query) {
    if (!Elements.searchResults) return;
    
    if (results.length === 0) {
      Utils.showElement(Elements.noResults);
      Utils.hideElement(Elements.searchResults);
      return;
    }
    
    Utils.hideElement(Elements.noResults);
    
    // Update search info
    if (Elements.resultCount) Elements.resultCount.textContent = results.length;
    if (Elements.searchTerm) Elements.searchTerm.textContent = query;
    
    // Generate results HTML
    const resultsHTML = results.map(result => this.createResultHTML(result, query)).join('');
    Elements.searchResults.innerHTML = resultsHTML;
    
    Utils.showElement(Elements.searchResults);
    this.setupResultEventListeners();
  },
  
  createResultHTML(result, query) {
    const highlightedText = this.highlightSearchTerms(result.text, query);
    const timestamp = Utils.formatTimestamp(result.timestamp);
    
    return `
      <div class="search-result" data-entry-id="${result.id}">
        <div class="result-header">
          <h4>${Utils.escapeHtml(result.title)}</h4>
          <span class="timestamp">${timestamp}</span>
        </div>
        <div class="result-content">
          <p>${highlightedText}</p>
        </div>
        <div class="result-actions">
          <button class="btn-copy" data-action="copy" data-entry-id="${result.id}">Copy</button>
          <button class="btn-view" data-action="view" data-entry-id="${result.id}">View</button>
        </div>
      </div>
    `;
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
  
  setupResultEventListeners() {
    // Event delegation for result actions
    Elements.searchResults?.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;
      
      const action = button.dataset.action;
      const entryId = button.dataset.entryId;
      
      if (action === 'copy') {
        this.copyResult(entryId);
      } else if (action === 'view') {
        this.viewResult(entryId);
      }
    });
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
    AppState.currentSearch = '';
    AppState.lastSearchResults = [];
    
    Utils.hideElement(Elements.searchResults);
    Utils.hideElement(Elements.noResults);
    
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

// === UI MANAGEMENT ===
const UI = {
  init() {
    this.setupTabs();
    this.setupSearchOptions();
    this.setupEventListeners();
    this.updateSearchOptions();
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
    } else if (tabName === 'notebooklm') {
      NotebookLM.initialLoad().catch(error => {
        console.error('NotebookLM: Failed to initialize:', error);
      });
      // NotebookLM.loadExportHistory(); // Removed: no such function
      // Check connection status and load notebooks if connected
      // NotebookLM.checkConnectionStatus().then(isConnected => {
      //   if (isConnected) {
      //     NotebookLM.loadNotebooks();
      //   }
      // }).catch(console.error);
    }
  },
  
  setupSearchOptions() {
    Elements.searchOptions.forEach(option => {
      option.addEventListener('click', async () => {
        AppState.currentSearchMode = option.dataset.mode;
        this.updateSearchOptions();
        await Search.saveState();
        
        // Re-run search if active
        if (AppState.currentSearch) {
          if (AppState.currentSearchMode === 'keyword') {
            await Search.performSearch(AppState.currentSearch);
          } else {
            Search.displaySemanticPrompt(AppState.currentSearch);
          }
        }
      });
    });
  },
  
  updateSearchOptions() {
    Elements.searchOptions.forEach(option => {
      Utils.toggleClass(option, 'active', option.dataset.mode === AppState.currentSearchMode);
    });
    
    // Update search input placeholder
    if (Elements.searchInput) {
      Elements.searchInput.placeholder = AppState.currentSearchMode === 'semantic' 
        ? "Ask AI about your saved text..."
        : "Search your saved text...";
    }
    
    // Show/hide results filter for keyword search only
    const resultsFilterGroup = Elements.resultsFilter?.closest('.filter-group');
    if (resultsFilterGroup) {
      Utils.showElement(resultsFilterGroup, AppState.currentSearchMode === 'keyword');
    }
  },
  
  setupEventListeners() {
    // Search listeners
    Elements.searchInput?.addEventListener('input', Search.handleInput.bind(Search));
    Elements.searchInput?.addEventListener('keydown', Search.handleKeydown.bind(Search));
    Elements.searchClear?.addEventListener('click', Search.clearResults.bind(Search));
    
    // Entry management
    Elements.clearBtn?.addEventListener('click', Data.clearAllEntries.bind(Data));
    Elements.exportBtn?.addEventListener('click', Data.exportData.bind(Data));
    Elements.capturePageBtn?.addEventListener('click', Data.capturePage.bind(Data));
    
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
    console.log('UI: Elements.importToNotebookLM:', Elements.importToNotebookLM);
    
    Elements.refreshNotebooks?.addEventListener('click', NotebookLM.loadNotebooks.bind(NotebookLM));
    Elements.connectDriveBtn?.addEventListener('click', NotebookLM.createNotebook.bind(NotebookLM));
    
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
      
      if (Elements.importToNotebookLM) {
        console.log('UI: Adding click listener to import button');
        // Remove existing listeners to avoid duplicates
        Elements.importToNotebookLM.removeEventListener('click', handleImportClick);
        Elements.importToNotebookLM.addEventListener('click', handleImportClick);
      } else {
        console.error('UI: importToNotebookLM element not found!');
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
    
    const handleImportClick = () => {
      console.log('UI: Import button clicked!');
      NotebookLM.performImport();
    };
    
    // Try to add listeners immediately
    addButtonListeners();
    
    // Also try again after a short delay to ensure DOM is ready
    setTimeout(addButtonListeners, 100);
    
    // Selection listeners
    Elements.toggleSelectionBtn?.addEventListener('click', this.toggleSelectionMode.bind(this));
    Elements.selectAllHome?.addEventListener('click', () => Data.selectHomeArticlesBulk('all'));
    Elements.selectNoneHome?.addEventListener('click', () => Data.selectHomeArticlesBulk('none'));
    Elements.selectAll?.addEventListener('click', () => NotebookLM.selectArticlesBulk('all'));
    Elements.selectNone?.addEventListener('click', () => NotebookLM.selectArticlesBulk('none'));
    Elements.selectRecentWeek?.addEventListener('click', () => NotebookLM.selectArticlesBulk('recent'));
    Elements.selectHighSimilarity?.addEventListener('click', () => NotebookLM.selectArticlesBulk('high'));
    
    // Settings listeners
    Elements.settingsIconBtn?.addEventListener('click', () => this.switchTab('settings'));
    
    // Semantic search listeners
    Elements.semanticInput?.addEventListener('input', Search.handleInput.bind(Search));
    Elements.semanticInput?.addEventListener('keydown', Search.handleKeydown.bind(Search));
    Elements.toggleFiltersSemantic?.addEventListener('click', Filters.toggleVisibility.bind(Filters));
    Elements.semanticClear?.addEventListener('click', Search.clearResults.bind(Search));
    
    // Misc
    Elements.dismissSetupNote?.addEventListener('click', this.dismissSetupNote.bind(this));
    Elements.shortcutsLink?.addEventListener('click', this.openShortcutsPage.bind(this));
    Elements.clearErrorStatesBtn?.addEventListener('click', Data.clearErrorStates.bind(Data));
    // Elements.debugNotebookLMBtn?.addEventListener('click', NotebookLM.debug.bind(NotebookLM));
    // Elements.testGraphQLBtn?.addEventListener('click', NotebookLM.testNotebookLMAPI.bind(NotebookLM));
    // Elements.testGraphQLBtn2?.addEventListener('click', NotebookLM.testNotebookLMAPI.bind(NotebookLM));
    // Elements.showReloadBtn?.addEventListener('click', NotebookLM.showReloadInstructions.bind(NotebookLM));
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        Data.clearErrorStates();
      }
    });
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
    } catch (error) {
      console.error('Failed to load entries:', error);
      AppState.allEntries = [];
      this.displayEntries([]);
    }
  },
  
  displayEntries(entries) {
    if (!Elements.entriesContainer) return;
    
    if (entries.length === 0) {
      Utils.showElement(Elements.emptyState);
      Utils.hideElement(Elements.entriesContainer);
      return;
    }
    
    Utils.hideElement(Elements.emptyState);
    Utils.showElement(Elements.entriesContainer);
    
    const entriesHTML = entries.map(entry => this.createEntryHTML(entry)).join('');
    Elements.entriesContainer.innerHTML = entriesHTML;
    
    this.setupEntryEventListeners();
    this.setupScrollExpansion();
  },
  
  createEntryHTML(entry) {
    const timestamp = Utils.formatTimestamp(entry.timestamp);
    const truncatedText = Utils.truncateText(entry.text, 300);
    const isSelected = AppState.homeSelectedArticles.has(entry.id);
    const checkboxVisible = AppState.isSelectionMode ? 'block' : 'none';
    
    return `
      <div class="entry" data-entry-id="${entry.id}">
        <div class="entry-header">
          <div class="entry-selection">
            <input type="checkbox" class="entry-checkbox" 
                   style="display: ${checkboxVisible};"
                   ${isSelected ? 'checked' : ''}
                   data-entry-id="${entry.id}">
          </div>
          <h3>${Utils.escapeHtml(entry.title)}</h3>
          <span class="timestamp">${timestamp}</span>
        </div>
        <div class="entry-content">
          <div class="entry-text">${Utils.escapeHtml(truncatedText)}</div>
          ${entry.text.length > 300 ? '<button class="expand-btn" data-action="expand">Show more</button>' : ''}
        </div>
        <div class="entry-actions">
          <button data-action="copy" data-entry-id="${entry.id}">Copy</button>
          <button data-action="view" data-entry-id="${entry.id}">View</button>
          <button data-action="delete" data-entry-id="${entry.id}">Delete</button>
        </div>
      </div>
    `;
  },
  
  handleEntrySelection(entryId, isSelected) {
    if (isSelected) {
      AppState.homeSelectedArticles.add(entryId);
    } else {
      AppState.homeSelectedArticles.delete(entryId);
    }
    this.updateSelectionUI();
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
    
    // Update selection toolbar visibility
    if (Elements.selectionToolbar) {
      Utils.showElement(Elements.selectionToolbar, selectedCount > 0);
    }
  },
  
  selectHomeArticlesBulk(mode) {
    switch (mode) {
      case 'all':
        AppState.allEntries.forEach(entry => AppState.homeSelectedArticles.add(entry.id));
        break;
      case 'none':
        AppState.homeSelectedArticles.clear();
        break;
      case 'recent':
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        AppState.allEntries
          .filter(entry => entry.timestamp > oneWeekAgo)
          .forEach(entry => AppState.homeSelectedArticles.add(entry.id));
        break;
    }
    
    // Update checkboxes
    const checkboxes = Utils.$$('.entry-checkbox');
    checkboxes.forEach(checkbox => {
      const entryId = checkbox.closest('.entry').dataset.entryId;
      checkbox.checked = AppState.homeSelectedArticles.has(entryId);
    });
    
    this.updateSelectionUI();
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
    const entry = AppState.allEntries.find(e => e.id === entryId);
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
  
  async loadApiKeyStatus() {
    try {
      const apiKey = await Utils.get('openai_api_key');
      const hasKey = !!(apiKey && apiKey.trim());
      
      if (Elements.apiStatusIndicator) {
        Elements.apiStatusIndicator.className = hasKey ? 'status-indicator active' : 'status-indicator';
      }
      
      if (Elements.apiStatusText) {
        Elements.apiStatusText.textContent = hasKey ? 'API Key Configured' : 'No API Key';
      }
      
      if (Elements.apiKeyInput) {
        Elements.apiKeyInput.value = hasKey ? '••••••••••••••••' : '';
      }
    } catch (error) {
      console.error('Failed to load API key status:', error);
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
      
      switch (action) {
        case 'copy':
          this.copyEntry(entryId);
          break;
        case 'view':
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

// === INLINED NOTEBOOKLM PROXY CLIENT ===
// Use your local proxy server instead of the official one
const SYNC_HOST = "http://localhost:3000";

async function notebooklmApi(path, method = "GET", body) {
  console.log(`NotebookLM API: ${method} ${SYNC_HOST}${path}`, body ? body : '');
  const headers = {
    "Content-Type": "application/json",
  };
  const opts = {
    method,
    headers,
    credentials: "omit",
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${SYNC_HOST}${path}`, opts);
    console.log(`NotebookLM API: Response status: ${res.status}`);
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`NotebookLM API: Error response:`, errorText);
      throw new Error(`Proxy API error: ${res.status} - ${errorText}`);
    }
    const data = await res.json();
    console.log(`NotebookLM API: Response data:`, data);
    return data;
  } catch (error) {
    console.error(`NotebookLM API: Fetch error:`, error);
    throw error;
  }
}

class NotebookLMProxyClient {
  async listNotebooks() {
    return notebooklmApi("/api/notebooks");
  }

  async addSource(notebookId, url) {
    return notebooklmApi(`/api/notebooks/${notebookId}/sources`, "POST", { url });
  }

  async addTextSource(notebookId, text) {
    return notebooklmApi(`/api/notebooks/${notebookId}/sources`, "POST", { text });
  }

  async createNotebook(title, emoji = "📔") {
    return notebooklmApi("/api/notebooks", "POST", { title, emoji });
  }
}

const notebooklmClient = new NotebookLMProxyClient();

// === NOTEBOOKLM OBJECT (Unified Proxy Integration) ===
const NotebookLM = {
  // State
  notebooks: [],
  sources: [],
  selectedNotebookId: '',

  // UI Elements
  get notebookDropdown() { return Elements.notebookDropdown; },
  get refreshNotebooksBtn() { return Elements.refreshNotebooks; },
  get importToNotebookBtn() { return Elements.importToNotebookLM; },
  get exportToNotebookLMBtn() { return Elements.exportToNotebookLM; },
  get createNotebookBtn() { return Elements.connectDriveBtn; },
  get notebooklmEntries() { return Elements.notebooklmEntries; },
  get selectionCount() { return Elements.selectedCount; },
  get selectAllBtn() { return Elements.selectAll; },
  get selectNoneBtn() { return Elements.selectNone; },
  get selectRecentWeekBtn() { return Elements.selectRecentWeek; },
  get selectHighSimilarityBtn() { return Elements.selectHighSimilarity; },

  // Load notebooks from proxy
  async loadNotebooks() {
    console.log('NotebookLM: Loading notebooks...');
    console.log('NotebookLM: Using server:', SYNC_HOST);
    
    if (!this.notebookDropdown) {
      console.error('NotebookLM: notebookDropdown element not found!');
      return;
    }
    
    this.notebookDropdown.innerHTML = '<option>Loading...</option>';
    try {
      this.notebooks = await notebooklmClient.listNotebooks();
      console.log('NotebookLM: Loaded notebooks:', this.notebooks);
      this.renderNotebooks();
    } catch (e) {
      console.error('NotebookLM: Error loading notebooks:', e);
      this.notebookDropdown.innerHTML = '<option>Error loading</option>';
      if (this.importToNotebookBtn) this.importToNotebookBtn.disabled = true;
      if (this.exportToNotebookLMBtn) this.exportToNotebookLMBtn.disabled = true;
    }
  },

  renderNotebooks() {
    console.log('NotebookLM: Rendering notebooks...');
    const dropdown = this.notebookDropdown;
    if (!dropdown) {
      console.error('NotebookLM: No notebook dropdown found');
      return;
    }

    // Clear existing options
    dropdown.innerHTML = '';
    
    console.log('NotebookLM: Notebooks to render:', this.notebooks);
    
    // Add notebooks to dropdown
    this.notebooks.forEach(notebook => {
      const option = document.createElement('option');
      option.value = notebook.id;
      option.textContent = `${notebook.emoji} ${notebook.title}`;
      dropdown.appendChild(option);
      console.log('NotebookLM: Added notebook option:', notebook.title);
    });

    // Try to select the real notebook by default, fallback to first notebook
    const realNotebookId = '1f0075d4-a616-4258-87f7-3c62674d0ac4';
    const realNotebook = this.notebooks.find(n => n.id === realNotebookId);
    
    if (realNotebook) {
      dropdown.value = realNotebookId;
      console.log('NotebookLM: Selected real notebook by default:', realNotebookId);
    } else if (this.notebooks.length > 0) {
      dropdown.value = this.notebooks[0].id;
      console.log('NotebookLM: Selected first notebook:', this.notebooks[0].id);
    }

    // Enable/disable buttons based on selection
    this.updateButtonStates();
    
    console.log('NotebookLM: Notebook rendering complete');
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

  // Create notebook
  async createNotebook() {
    const title = prompt('Notebook title:');
    if (!title) return;
    this.createNotebookBtn.disabled = true;
    try {
      await notebooklmClient.createNotebook(title, '📔');
      await this.loadNotebooks();
      Utils.showNotification('Notebook created!', 'success');
    } catch (e) {
      Utils.showNotification('Failed to create notebook', 'error');
    } finally {
      this.createNotebookBtn.disabled = false;
    }
  },

  // Render sources in NotebookLM tab
  renderSources(sources) {
    this.sources = sources;
    const container = this.notebooklmEntries;
    container.innerHTML = '';
    
    // Show entries from Home tab that can be imported
    const homeEntries = AppState.allEntries || [];
    console.log('NotebookLM: Rendering home entries for import:', homeEntries.length);
    
    homeEntries.forEach(entry => {
      const div = document.createElement('div');
      div.className = 'entry';
      div.dataset.entryId = entry.id;
      
      // Check if this entry is selected in Home tab
      const isSelected = AppState.homeSelectedArticles && AppState.homeSelectedArticles.has(entry.id);
      if (isSelected) {
        div.classList.add('selected');
      }
      
      div.innerHTML = `
        <div class="entry-header with-checkbox">
          <input type="checkbox" class="entry-checkbox" data-entry-id="${entry.id}" ${isSelected ? 'checked' : ''}>
          <span class="entry-title">${Utils.escapeHtml(entry.title || 'Untitled')}</span>
        </div>
        <div class="entry-text">${Utils.escapeHtml(entry.text || entry.url || '')}</div>
      `;
      container.appendChild(div);
    });
    
    this.updateSelectionUI();
  },

  // Selection logic
  updateSelectionUI() {
    const selectedIds = this.getSelectedEntryIds();
    this.selectionCount.textContent = selectedIds.length;
    Array.from(this.notebooklmEntries.querySelectorAll('.entry')).forEach(entry => {
      const id = entry.dataset.entryId;
      entry.classList.toggle('selected', selectedIds.includes(id));
      const checkbox = entry.querySelector('.entry-checkbox');
      if (checkbox) checkbox.checked = selectedIds.includes(id);
    });
  },

  getSelectedEntryIds() {
    // Get selected entries from NotebookLM tab
    const notebooklmSelected = Array.from(this.notebooklmEntries.querySelectorAll('.entry.selected')).map(e => e.dataset.entryId);
    
    // Get selected entries from Home tab (if we're in selection mode)
    const homeSelected = AppState.homeSelectedArticles ? Array.from(AppState.homeSelectedArticles) : [];
    
    // Combine both sources
    const allSelected = [...notebooklmSelected, ...homeSelected];
    
    console.log('NotebookLM: Selected entry IDs:', allSelected);
    console.log('NotebookLM: From NotebookLM tab:', notebooklmSelected);
    console.log('NotebookLM: From Home tab:', homeSelected);
    
    return allSelected;
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

  // Selection toolbar
  selectArticlesBulk(mode) {
    const entries = Array.from(this.notebooklmEntries.querySelectorAll('.entry'));
    if (mode === 'all') {
      entries.forEach(entry => {
        entry.classList.add('selected');
        const checkbox = entry.querySelector('.entry-checkbox');
        if (checkbox) checkbox.checked = true;
      });
    } else if (mode === 'none') {
      entries.forEach(entry => {
        entry.classList.remove('selected');
        const checkbox = entry.querySelector('.entry-checkbox');
        if (checkbox) checkbox.checked = false;
      });
    } else if (mode === 'recent') {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      entries.forEach(entry => {
        const entryData = this.getEntryById(entry.dataset.entryId);
        const isRecent = entryData && entryData.timestamp && entryData.timestamp > oneWeekAgo;
        entry.classList.toggle('selected', isRecent);
        const checkbox = entry.querySelector('.entry-checkbox');
        if (checkbox) checkbox.checked = isRecent;
      });
    } else if (mode === 'high') {
      entries.forEach((entry, i) => {
        const selected = i < 10;
        entry.classList.toggle('selected', selected);
        const checkbox = entry.querySelector('.entry-checkbox');
        if (checkbox) checkbox.checked = selected;
      });
    }
    this.updateSelectionUI();
  },

  // Import handler
  async performImport() {
    console.log('NotebookLM: performImport called');
    console.log('NotebookLM: selectedNotebookId:', this.selectedNotebookId);
    
    if (!this.selectedNotebookId) {
      console.log('NotebookLM: No notebook selected');
      Utils.showNotification('Please select a notebook first', 'error');
      return;
    }
    
    const entryIds = this.getSelectedEntryIds();
    console.log('NotebookLM: Selected entry IDs:', entryIds);
    
    if (!entryIds.length) {
      console.log('NotebookLM: No sources selected');
      Utils.showNotification('No sources selected', 'error');
      return;
    }
    
    console.log('NotebookLM: Starting import...');
    if (this.importToNotebookBtn) {
      this.importToNotebookBtn.disabled = true;
      this.importToNotebookBtn.textContent = 'Importing...';
    }
    
    let successCount = 0, failCount = 0;
    try {
      for (const entryId of entryIds) {
        const entry = this.getEntryById(entryId);
        if (!entry) {
          console.log('NotebookLM: Entry not found for ID:', entryId);
          continue;
        }
        
        console.log('NotebookLM: Processing entry:', entry.title || entry.url);
        
        try {
          if (entry.url) {
            console.log('NotebookLM: Adding URL source:', entry.url);
            await notebooklmClient.addSource(this.selectedNotebookId, entry.url);
          } else if (entry.text) {
            console.log('NotebookLM: Adding text source:', entry.text.substring(0, 100) + '...');
            await notebooklmClient.addTextSource(this.selectedNotebookId, entry.text);
          }
          successCount++;
          console.log('NotebookLM: Successfully added source');
        } catch (err) {
          console.error('NotebookLM: Error adding source:', err);
          failCount++;
        }
      }
      
      console.log('NotebookLM: Import completed. Success:', successCount, 'Failed:', failCount);
      
      if (successCount) Utils.showNotification(`Imported ${successCount} to NotebookLM!`, 'success');
      if (failCount) Utils.showNotification(`Failed to import ${failCount} sources`, 'error');
    } catch (e) {
      console.error('NotebookLM: Import failed:', e);
      Utils.showNotification('Import failed', 'error');
    } finally {
      if (this.importToNotebookBtn) {
        this.importToNotebookBtn.disabled = false;
        this.importToNotebookBtn.textContent = '🧠 Import to NotebookLM';
      }
    }
  },

  // Export handler (same as import for now)
  async performExport() {
    console.log('NotebookLM: performExport called');
    console.log('NotebookLM: this.isButtonActionRunning:', this.isButtonActionRunning);
    
    // Prevent multiple simultaneous executions
    if (this.isButtonActionRunning) {
      console.log('NotebookLM: Export already running, skipping duplicate request');
      Utils.showNotification('Export already in progress, please wait...', 'warning');
      return;
    }
    
    this.isButtonActionRunning = true;
    console.log('NotebookLM: Set isButtonActionRunning to true');
    
    try {
      const selectedEntryIds = this.getSelectedEntryIds();
      console.log('NotebookLM: Selected entry IDs:', selectedEntryIds);
      
      if (!selectedEntryIds || selectedEntryIds.length === 0) {
        console.log('NotebookLM: No entries selected');
        Utils.showNotification('Please select at least one article to export', 'error');
        return;
      }
      
      // Check if this is the real notebook ID
      const selectedNotebookId = document.getElementById('notebookDropdown')?.value;
      console.log('NotebookLM: Selected notebook ID:', selectedNotebookId);
      const isRealNotebook = this.isRealNotebook(selectedNotebookId);
      console.log('NotebookLM: Is real notebook:', isRealNotebook);
      
      if (isRealNotebook) {
        // Use the automation approach for real notebook
        console.log('NotebookLM: Using automation for real notebook');
        try {
          const articles = selectedEntryIds.map(id => this.getEntryById(id)).filter(Boolean);
          console.log('NotebookLM: Articles to send:', articles);
          
          await chrome.runtime.sendMessage({
            action: 'addArticlesToNotebookLM',
            notebookId: selectedNotebookId,
            articles: articles
          });
          console.log('NotebookLM: Message sent successfully');
          Utils.showNotification(`Starting to add ${selectedEntryIds.length} articles to NotebookLM...`, 'success');
        } catch (error) {
          console.error('Failed to add articles to NotebookLM:', error);
          Utils.showNotification('Failed to add articles to NotebookLM', 'error');
        }
      } else {
        // Use the mock server approach for test notebooks
        console.log('NotebookLM: Using mock server for test notebook');
        await this.performImport();
      }
    } catch (error) {
      console.error('NotebookLM: Error in performExport:', error);
    } finally {
      this.isButtonActionRunning = false;
      console.log('NotebookLM: Set isButtonActionRunning to false');
    }
  },

  isRealNotebook(notebookId) {
    return notebookId === '1f0075d4-a616-4258-87f7-3c62674d0ac4';
  },

  // Event listeners for selection
  setupSelectionListeners() {
    this.notebooklmEntries.addEventListener('change', e => {
      const checkbox = e.target.closest('.entry-checkbox');
      if (!checkbox) return;
      const entryDiv = checkbox.closest('.entry');
      if (!entryDiv) return;
      entryDiv.classList.toggle('selected', checkbox.checked);
      this.updateSelectionUI();
    });
    this.notebooklmEntries.addEventListener('click', e => {
      const entryDiv = e.target.closest('.entry');
      if (!entryDiv) return;
      if (e.target.classList.contains('entry-checkbox')) return;
      const checkbox = entryDiv.querySelector('.entry-checkbox');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        entryDiv.classList.toggle('selected', checkbox.checked);
        this.updateSelectionUI();
      }
    });
  },

  // Flag to prevent multiple simultaneous button clicks
  isButtonActionRunning: false,

  // Initial load for NotebookLM tab
  async initialLoad() {
    console.log('NotebookLM: Initial load called');
    console.log('NotebookLM: Elements.notebookDropdown:', Elements.notebookDropdown);
    console.log('NotebookLM: Elements initialized:', !!Elements.notebookDropdown);
    
    // Load entries first to populate AppState.allEntries
    await Data.loadEntries();
    console.log('NotebookLM: Loaded entries, count:', AppState.allEntries.length);
    
    this.loadNotebooks(); // Always fetch notebooks first
    this.renderSources(); // Render home entries for import
    this.setupSelectionListeners();
    
    // Load last detected notebook ID
    await this.loadLastDetectedNotebook();
    
    // Hide connection status and connect button if present
    const driveStatus = document.getElementById('driveStatus');
    if (driveStatus) driveStatus.style.display = 'none';
    const connectBtn = document.getElementById('connectDriveBtn');
    if (connectBtn) connectBtn.style.display = 'none';
  },

  // Load last detected notebook ID from storage
  async loadLastDetectedNotebook() {
    try {
      const result = await chrome.storage.local.get(['lastNotebookId', 'lastNotebookUrl', 'lastNotebookTimestamp']);
      if (result.lastNotebookId) {
        console.log('NotebookLM: Found last detected notebook:', result.lastNotebookId);
        
        // Add to dropdown if not already present
        const dropdown = document.getElementById('notebookDropdown');
        if (dropdown) {
          const existingOption = Array.from(dropdown.options).find(opt => opt.value === result.lastNotebookId);
          if (!existingOption) {
            const option = document.createElement('option');
            option.value = result.lastNotebookId;
            option.textContent = `🧠 Auto-Detected Notebook (${result.lastNotebookId.substring(0, 8)}...)`;
            dropdown.appendChild(option);
          }
          
          // Select the auto-detected notebook
          dropdown.value = result.lastNotebookId;
          console.log('NotebookLM: Selected auto-detected notebook:', result.lastNotebookId);
        }
      }
    } catch (error) {
      console.error('NotebookLM: Failed to load last detected notebook:', error);
    }
  },
};

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', async () => {
  console.log('SmartGrab AI Search - Initializing...');
  
  try {
    // Initialize DOM elements
    Elements.init();
    
    // Initialize UI
    UI.init();
    
    // Load initial data
    await Promise.all([
      Data.loadEntries(),
      Data.loadStats(),
      Data.loadApiKeyStatus(),
      Search.restoreState()
    ]);
    
    // Load NotebookLM data
    await Promise.all([
      NotebookLM.loadNotebooks(),
      NotebookLM.loadLastDetectedNotebook()
    ]);
    
    // Initialize NotebookLM functionality
    await NotebookLM.initialLoad();
    
    // Load setup note visibility
    const setupDismissed = await Utils.get('setupNoteDismissed');
    Utils.showElement(Elements.setupNote, !setupDismissed);
    
    // Clear any lingering error states
    await Data.clearErrorStates();
    
    // Setup event listeners and scroll expansion
    Data.setupEntryEventListeners();
    Data.setupScrollExpansion();
    
    // Refresh button states after loading data
    await UI.refreshButtonStates();
    
    // Add event listener for notebook dropdown changes
    const notebookDropdown = document.getElementById('notebookDropdown');
    if (notebookDropdown) {
      notebookDropdown.addEventListener('change', async () => {
        await UI.refreshButtonStates();
      });
    }

    // Add event listener for Automate NotebookLM UI button
    const automateBtn = document.getElementById('automateNotebookLMBtn');
    console.log('NotebookLM: Found automate button:', !!automateBtn);
    if (automateBtn) {
      automateBtn.addEventListener('click', async () => {
        console.log('NotebookLM: Automate button clicked');
        // Use the real notebook ID that we know works
        const realNotebookId = '1f0075d4-a616-4258-87f7-3c62674d0ac4';
        console.log('NotebookLM: Using real notebook ID for automation:', realNotebookId);
        
        // Call service worker function via message
        try {
          await chrome.runtime.sendMessage({
            action: 'automateNotebookLM',
            notebookId: realNotebookId
          });
          Utils.showNotification('Opening NotebookLM notebook...', 'success');
        } catch (error) {
          console.error('Failed to automate NotebookLM:', error);
          Utils.showNotification('Failed to open NotebookLM', 'error');
        }
      });
    }

    // Add event listener for Add All Articles to NotebookLM button
    const addAllArticlesBtn = document.getElementById('addAllArticlesToNotebookLM');
    console.log('NotebookLM: Found add all articles button:', !!addAllArticlesBtn);
    if (addAllArticlesBtn) {
      addAllArticlesBtn.addEventListener('click', async () => {
        console.log('NotebookLM: Add All Articles button clicked');
        
        // Prevent multiple simultaneous executions
        if (NotebookLM.isButtonActionRunning) {
          console.log('NotebookLM: Add All Articles already running, skipping duplicate request');
          Utils.showNotification('Add All Articles already in progress, please wait...', 'warning');
          return;
        }
        
        NotebookLM.isButtonActionRunning = true;
        
        try {
          // Get all captured articles from AppState
          const entries = AppState.allEntries || [];
          console.log('NotebookLM: Found entries:', entries.length);
          if (!entries || entries.length === 0) {
            Utils.showNotification('No articles to add. Please capture some articles first.', 'error');
            return;
          }

          // Get selected notebook ID
          const notebookId = document.getElementById('notebookDropdown')?.value;
          console.log('NotebookLM: Selected notebook ID:', notebookId);
          if (!notebookId) {
            Utils.showNotification('Please select a NotebookLM notebook first', 'error');
            return;
          }

          console.log(`NotebookLM: Adding ${entries.length} articles to notebook ${notebookId}`);
          Utils.showNotification(`Starting to add ${entries.length} articles to NotebookLM...`, 'success');

          // Call service worker to add articles as sources
          await chrome.runtime.sendMessage({
            action: 'addArticlesToNotebookLM',
            notebookId: notebookId,
            articles: entries
          });

        } catch (error) {
          console.error('Failed to add articles to NotebookLM:', error);
          Utils.showNotification('Failed to add articles to NotebookLM', 'error');
        } finally {
          NotebookLM.isButtonActionRunning = false;
        }
      });
    }

    // Add event listener for Export to NotebookLM button
    const exportBtn = document.getElementById('exportToNotebookLM');
    console.log('NotebookLM: Found export button:', !!exportBtn);
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        console.log('NotebookLM: Export button clicked');
        try {
          await NotebookLM.performExport();
        } catch (error) {
          console.error('Failed to export to NotebookLM:', error);
          Utils.showNotification('Failed to export to NotebookLM', 'error');
        }
      });
    }

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

// Debug function to test button clicks
window.testNotebookLMButtons = () => {
  console.log('Testing NotebookLM buttons...');
  console.log('Elements.exportToNotebookLM:', Elements.exportToNotebookLM);
  console.log('Elements.importToNotebookLM:', Elements.importToNotebookLM);
  
  if (Elements.exportToNotebookLM) {
    console.log('Export button disabled:', Elements.exportToNotebookLM.disabled);
    console.log('Export button text:', Elements.exportToNotebookLM.textContent);
  }
  
  if (Elements.importToNotebookLM) {
    console.log('Import button disabled:', Elements.importToNotebookLM.disabled);
    console.log('Import button text:', Elements.importToNotebookLM.textContent);
  }
  
  // Test click handlers
  if (Elements.exportToNotebookLM) {
    console.log('Manually triggering export button click...');
    Elements.exportToNotebookLM.click();
  }
}; 