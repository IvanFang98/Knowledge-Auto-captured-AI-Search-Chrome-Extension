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
      NotebookLM.loadArticles();
      NotebookLM.loadExportHistory();
      
      // Check connection status and load notebooks if connected
      NotebookLM.checkConnectionStatus().then(isConnected => {
        if (isConnected) {
          NotebookLM.loadNotebooks();
        }
      }).catch(console.error);
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
    Elements.refreshNotebooks?.addEventListener('click', NotebookLM.loadNotebooks.bind(NotebookLM));
    Elements.captureAndOpenBtn?.addEventListener('click', NotebookLM.captureAndOpen.bind(NotebookLM));
    Elements.connectDriveBtn?.addEventListener('click', NotebookLM.connectDrive.bind(NotebookLM));
    Elements.debugTokensBtn?.addEventListener('click', (event) => {
      console.log('=== DEBUG BUTTON CLICKED ===');
      console.log('Event:', event);
      console.log('Button element:', Elements.debugTokensBtn);
      console.log('About to call debugTokens...');
      NotebookLM.debugTokens();
    });
    Elements.exportToNotebookLM?.addEventListener('click', NotebookLM.performExport.bind(NotebookLM));
    Elements.openDriveFolder?.addEventListener('click', NotebookLM.openDriveFolder.bind(NotebookLM));
    Elements.importToNotebookLM?.addEventListener('click', NotebookLM.performImport.bind(NotebookLM));
    
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
    Elements.debugNotebookLMBtn?.addEventListener('click', NotebookLM.debug.bind(NotebookLM));
    Elements.testGraphQLBtn?.addEventListener('click', NotebookLM.testNotebookLMAPI.bind(NotebookLM));
    Elements.testGraphQLBtn2?.addEventListener('click', NotebookLM.testNotebookLMAPI.bind(NotebookLM));
    Elements.showReloadBtn?.addEventListener('click', NotebookLM.showReloadInstructions.bind(NotebookLM));
    
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

// === NOTEBOOK LM INTEGRATION ===
const NotebookLM = {
  // NotebookLM API client
  authParams: null,
  isAuthenticated: false,

  clearAuthentication() {
    console.log('Clearing authentication cache...');
    this.authParams = null;
    this.isAuthenticated = false;
  },

  async authenticate(forceRefresh = false) {
    try {
      console.log('=== AUTHENTICATE FUNCTION CALLED ===');
      console.log('Force refresh:', forceRefresh);
      console.log('Current isAuthenticated:', this.isAuthenticated);
      console.log('Current authParams:', this.authParams);
      
      if (forceRefresh) {
        this.clearAuthentication();
      }
      
      // Check if we have invalid tokens and force refresh
      if (this.authParams && this.authParams.at && 
          !this.authParams.at.startsWith('AIzaSy') && 
          !this.authParams.at.startsWith('AJpMio1')) {
        console.log('Detected invalid tokens, forcing refresh...');
        this.clearAuthentication();
      }
      
      console.log('Authenticating with NotebookLM...');
      
      // Check if NotebookLM tab is open
      let tabs = await chrome.tabs.query({url: "https://notebooklm.google.com/*"});
      if (tabs.length === 0) {
        console.log('No NotebookLM tab found, opening one...');
        Utils.showNotification('Opening NotebookLM for authentication...', 'info');
        
        // Open NotebookLM tab
        await chrome.tabs.create({ 
          url: 'https://notebooklm.google.com/',
          active: false // Don't steal focus from extension popup
        });
        
        // Wait for the tab to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check again for tabs
                 tabs = await chrome.tabs.query({url: "https://notebooklm.google.com/*"});
         if (tabs.length === 0) {
           Utils.showNotification('⚠️ Please open NotebookLM manually: notebooklm.google.com', 'error');
           throw new Error('Failed to open NotebookLM tab automatically. Please open https://notebooklm.google.com/ manually in a new tab and try again.');
         }
        
        Utils.showNotification('NotebookLM tab opened, extracting tokens...', 'info');
      }

      console.log('About to execute extractAuthTokens script...');
      console.log('Tab ID:', tabs[0].id);
      console.log('Tab URL:', tabs[0].url);
      
      // Get auth tokens from NotebookLM page
      const result = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        world: 'MAIN',
        func: () => {
          // Standalone token extraction function (no 'this' context)
          try {
            const pageText = document.documentElement.innerHTML;
            console.log('=== EXTRACT AUTH TOKENS CALLED ===');
            console.log('Page text length:', pageText.length);
            console.log('Extracting tokens from NotebookLM page...');
            
            // Try different token patterns that might be used
            const tokenPatterns = [
              { name: 'SNlM0e', regex: /"SNlM0e":"([^"]+)"/ },
              { name: 'at', regex: /"at":"([^"]+)"/ },
              { name: 'FdrFJe', regex: /"FdrFJe":"([^"]+)"/ },
              { name: 'WIZ_global_data.SNlM0e', regex: /WIZ_global_data[.\s\S]*?"SNlM0e":"([^"]+)"/ },
              // New patterns based on debug results
              { name: 'B8SWKb', regex: /"B8SWKb":"([^"]+)"/ },
              { name: 'VqImj', regex: /"VqImj":"([^"]+)"/ },
              { name: 'APIKey1', regex: /"[A-Za-z0-9]{6}":"(AIzaSy[A-Za-z0-9_-]+)"/ },
              { name: 'APIKey2', regex: /"[A-Za-z0-9]{6}":"(AIzaSy[A-Za-z0-9_-]+)"/ }
            ];
            
            const authTokenPatterns = [
              { name: 'cfb2h', regex: /"cfb2h":"([^"]+)"/ },
              { name: 'bl', regex: /"bl":"([^"]+)"/ },
              { name: 'WIZ_global_data.cfb2h', regex: /WIZ_global_data[.\s\S]*?"cfb2h":"([^"]+)"/ },
              // New patterns based on debug results
              { name: 'S06Grb', regex: /"S06Grb":"([^"]+)"/ },
              { name: 'W3Yyqf', regex: /"W3Yyqf":"([^"]+)"/ },
              { name: 'qDCSke', regex: /"qDCSke":"([^"]+)"/ },
              { name: 'UserID', regex: /"[A-Za-z0-9]{6}":"([0-9]{18,})"/ }
            ];
            
            // PRIORITY 1: Check for API key tokens FIRST (more reliable than session tokens)
            console.log('🔍 PRIORITY CHECK: Looking for API key tokens first...');
            
            const b8swkbMatch = pageText.match(/"B8SWKb":"([^"]+)"/);
            const s06grbMatch = pageText.match(/"S06Grb":"([^"]+)"/);
            const vqimjMatch = pageText.match(/"VqImj":"([^"]+)"/);
            
            console.log('B8SWKb API key:', !!b8swkbMatch, b8swkbMatch ? b8swkbMatch[1].substring(0, 20) + '...' : 'null');
            console.log('S06Grb user ID:', !!s06grbMatch, s06grbMatch ? s06grbMatch[1].substring(0, 20) + '...' : 'null');
            console.log('VqImj API key:', !!vqimjMatch, vqimjMatch ? vqimjMatch[1].substring(0, 20) + '...' : 'null');
            
            // Look for build identifier (needed for modern requests)
            const blBuildMatch = pageText.match(/(boq_labs-tailwind-frontend_[0-9]+\.[0-9]+_p[0-9]+)/i);
            console.log('Build identifier found:', !!blBuildMatch, blBuildMatch ? blBuildMatch[1] : 'null');
            
            // Helper function to generate session token format from API key
            function generateSessionToken(apiKey) {
              try {
                // The session token format appears to be: prefixString:timestamp
                // Real format: AJpMio1FdhVkSj7OzqgV02hchFx3:1752685255295
                const timestamp = Date.now();
                
                // Create a base64-like string from the API key
                const keyHash = btoa(apiKey).replace(/[+/=]/g, '').substring(0, 32);
                const sessionToken = `AJpMio1${keyHash}:${timestamp}`;
                
                console.log('Attempting to generate session token from API key...');
                return sessionToken;
              } catch (error) {
                console.error('Failed to generate session token:', error);
                return null;
              }
            }
            
            // Use API key tokens if available (PREFERRED) - but generate session tokens
            if (b8swkbMatch && (blBuildMatch || s06grbMatch)) {
              console.log('✅ SUCCESS: Using B8SWKb + BL tokens with session token generation');
              
              // Generate session token from API key
              const apiKey = b8swkbMatch[1];
              const sessionToken = generateSessionToken(apiKey);
              console.log('Generated session token:', sessionToken ? sessionToken.substring(0, 20) + '...' : 'null');
              
              return {
                at: sessionToken || apiKey,  // Session token or API key fallback
                bl: blBuildMatch ? blBuildMatch[1] : s06grbMatch[1]   // Build ID or User ID
              };
            }
            
            if (vqimjMatch && (blBuildMatch || s06grbMatch)) {
              console.log('✅ SUCCESS: Using VqImj + BL tokens with session token generation');
              
              // Generate session token from API key
              const apiKey = vqimjMatch[1];
              const sessionToken = generateSessionToken(apiKey);
              console.log('Generated session token from VqImj:', sessionToken ? sessionToken.substring(0, 20) + '...' : 'null');
              
              return {
                at: sessionToken || apiKey,   // Session token or API key fallback
                bl: blBuildMatch ? blBuildMatch[1] : s06grbMatch[1]   // Build ID or User ID
              };
            }
            
            // PRIORITY 2: Fall back to traditional tokens only if API keys not found
            console.log('⚠️ API key tokens not found, falling back to traditional session tokens...');
            
            let atToken = null;
            let blToken = null;
            
            // Try to find AT token
            console.log('Searching for traditional AT tokens...');
            for (const pattern of tokenPatterns) {
              const match = pageText.match(pattern.regex);
              if (match) {
                atToken = match[1];
                console.log(`Found traditional AT token using pattern: ${pattern.name}: ${match[1].substring(0, 20)}...`);
                console.log(`Token type: ${match[1].startsWith('AIzaSy') ? 'API Key' : 'Session Token'}`);
                break;
              }
            }
            
            // Try to find BL token
            console.log('Searching for traditional BL tokens...');
            for (const pattern of authTokenPatterns) {
              const match = pageText.match(pattern.regex);
              if (match) {
                blToken = match[1];
                console.log(`Found traditional BL token using pattern: ${pattern.name}: ${match[1].substring(0, 20)}...`);
                break;
              }
            }
            
            console.log(`Traditional token check - AT: ${!!atToken}, BL: ${!!blToken}`);
            
            // If we still don't have tokens, show error
            if (!atToken || !blToken) {
              console.log('❌ No usable tokens found anywhere');
              console.log('AT token value:', atToken);
              console.log('BL token value:', blToken);
              
              // Final error message (we already checked API keys first)
              const errorMsg = `No authentication tokens found. Please make sure you are signed in to NotebookLM.
              Debug info: 
              - API key tokens: Not found (checked first)
              - Traditional AT token found: ${!!atToken}
              - Traditional BL token found: ${!!blToken}
              - Page URL: ${window.location.href}
              - Page title: ${document.title}
              
              Please try:
              1. Refresh the NotebookLM page
              2. Make sure you're signed in to your Google account
              3. Navigate to https://notebooklm.google.com/
              4. Try the connection again`;
              
              throw new Error(errorMsg);
            }
            
            console.log('⚠️ FALLBACK: Using traditional session tokens (not ideal)');
            console.log('AT token:', atToken ? atToken.substring(0, 20) + '...' : 'null');
            console.log('BL token:', blToken ? blToken.substring(0, 20) + '...' : 'null');
            
            return {
              at: atToken,
              bl: blToken
            };
          } catch (error) {
            console.error('❌ ERROR in extractAuthTokens:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            throw error;
          }
        }
      });
      
      console.log('Script execution completed. Result:', result);

      const authData = result?.[0]?.result;
      console.log('Extracted authData:', authData);
      console.log('authData.at exists:', !!authData?.at);
      console.log('authData.bl exists:', !!authData?.bl);
      
      if (!authData || !authData.at || !authData.bl) {
        console.log('❌ Authentication failed - missing or invalid authData');
        console.log('authData:', authData);
        throw new Error('Failed to get authentication tokens. Please make sure you are signed in to NotebookLM.');
      }

      this.authParams = authData;
      this.isAuthenticated = true;
      console.log('✅ NotebookLM authentication successful');
      console.log('AT token length:', authData.at.length);
      console.log('BL token length:', authData.bl.length);
      return true;
    } catch (error) {
      console.error('NotebookLM authentication failed:', error);
      this.isAuthenticated = false;
      throw error;
    }
  },

  // Extract authentication tokens from NotebookLM page
  extractAuthTokens() {
    try {
      const pageText = document.documentElement.innerHTML;
      console.log('=== EXTRACT AUTH TOKENS CALLED ===');
      console.log('Page text length:', pageText.length);
      console.log('Extracting tokens from NotebookLM page...');
      
      // Try different token patterns that might be used
      const tokenPatterns = [
        { name: 'SNlM0e', regex: /"SNlM0e":"([^"]+)"/ },
        { name: 'at', regex: /"at":"([^"]+)"/ },
        { name: 'FdrFJe', regex: /"FdrFJe":"([^"]+)"/ },
        { name: 'WIZ_global_data.SNlM0e', regex: /WIZ_global_data[.\s\S]*?"SNlM0e":"([^"]+)"/ },
        // New patterns based on debug results
        { name: 'B8SWKb', regex: /"B8SWKb":"([^"]+)"/ },
        { name: 'VqImj', regex: /"VqImj":"([^"]+)"/ },
        { name: 'APIKey1', regex: /"[A-Za-z0-9]{6}":"(AIzaSy[A-Za-z0-9_-]+)"/ },
        { name: 'APIKey2', regex: /"[A-Za-z0-9]{6}":"(AIzaSy[A-Za-z0-9_-]+)"/ }
      ];
      
      const authTokenPatterns = [
        { name: 'cfb2h', regex: /"cfb2h":"([^"]+)"/ },
        { name: 'bl', regex: /"bl":"([^"]+)"/ },
        { name: 'WIZ_global_data.cfb2h', regex: /WIZ_global_data[.\s\S]*?"cfb2h":"([^"]+)"/ },
        // New patterns based on debug results
        { name: 'S06Grb', regex: /"S06Grb":"([^"]+)"/ },
        { name: 'W3Yyqf', regex: /"W3Yyqf":"([^"]+)"/ },
        { name: 'qDCSke', regex: /"qDCSke":"([^"]+)"/ },
        { name: 'UserID', regex: /"[A-Za-z0-9]{6}":"([0-9]{18,})"/ }
      ];
      
      let atToken = null;
      let blToken = null;
      
      // Try to find AT token
      console.log('Searching for AT tokens...');
      for (const pattern of tokenPatterns) {
        const match = pageText.match(pattern.regex);
        if (match) {
          atToken = match[1];
          console.log(`Found AT token using pattern: ${pattern.name}: ${match[1].substring(0, 20)}...`);
          console.log(`Full AT token type: ${match[1].startsWith('AIzaSy') ? 'API Key' : 'Session Token'}`);
          break;
        }
      }
      
      // Try to find BL token
      console.log('Searching for BL tokens...');
      for (const pattern of authTokenPatterns) {
        const match = pageText.match(pattern.regex);
        if (match) {
          blToken = match[1];
          console.log(`Found BL token using pattern: ${pattern.name}: ${match[1].substring(0, 20)}...`);
          break;
        } else {
          console.log(`Pattern ${pattern.name} not found`);
        }
      }
      
      // Fallback: try to find any token-like patterns
      if (!atToken || !blToken) {
        console.log('Primary token search failed, trying fallback patterns...');
        
        // Look for common Google service tokens
        const fallbackPatterns = [
          /"[A-Za-z0-9]{6}":"[A-Za-z0-9_-]{20,}"/g,
          /"[A-Za-z0-9]{5}":"[A-Za-z0-9_-]{30,}"/g
        ];
        
        for (const pattern of fallbackPatterns) {
          const matches = pageText.match(pattern);
          if (matches) {
            console.log(`Found potential tokens: ${matches.slice(0, 5).join(', ')}`);
            // This is for debugging - we'll need the user to check what tokens are actually available
          }
        }
      }
      
      console.log(`Final token check - AT: ${!!atToken}, BL: ${!!blToken}`);
      
      // Always check for the discovered tokens first (they're more reliable)
      console.log('Checking for discovered token patterns...');
      
      // Use the actual tokens we found in debug
      const b8swkbMatch = pageText.match(/"B8SWKb":"([^"]+)"/);
      const s06grbMatch = pageText.match(/"S06Grb":"([^"]+)"/);
      const vqimjMatch = pageText.match(/"VqImj":"([^"]+)"/);
      
      // Also look for the session token format that appears in actual requests
      // Look for the session token in various formats
      const sessionTokenMatch = pageText.match(/at=([A-Za-z0-9_-]+%3A[0-9]+)/) || 
                                pageText.match(/at=([A-Za-z0-9_-]+:[0-9]+)/) ||
                                pageText.match(/"at":"([^"]+)"/) ||
                                pageText.match(/at\s*=\s*['"]([^'"]+)['"]/) ||
                                pageText.match(/at=([A-Za-z0-9_-]+:[0-9]+)/);
      
      // Look for the correct bl parameter format (build identifier)
      // We know the format is: boq_labs-tailwind-frontend_20250713.14_p1
      const blBuildMatch = pageText.match(/(boq_labs-tailwind-frontend_[0-9]+\.[0-9]+_p[0-9]+)/i) || 
                          pageText.match(/bl=([a-z0-9_.-]+)/i) || 
                          pageText.match(/"bl":"([^"]+)"/);
      
      console.log('🔍 Authentication token analysis:');
      console.log('B8SWKb match:', !!b8swkbMatch, b8swkbMatch ? b8swkbMatch[1].substring(0, 20) + '...' : 'null');
      console.log('S06Grb match:', !!s06grbMatch, s06grbMatch ? s06grbMatch[1].substring(0, 20) + '...' : 'null');
      console.log('VqImj match:', !!vqimjMatch, vqimjMatch ? vqimjMatch[1].substring(0, 20) + '...' : 'null');
      console.log('Session token match:', !!sessionTokenMatch, sessionTokenMatch ? sessionTokenMatch[1].substring(0, 20) + '...' : 'null');
      console.log('BL build match:', !!blBuildMatch, blBuildMatch ? blBuildMatch[1] : 'null');
      
      // Prefer the session token format if available (most reliable)
      if (sessionTokenMatch && (blBuildMatch || s06grbMatch)) {
        console.log('✅ SUCCESS: Using session token + BL tokens (most reliable)');
        return {
          at: sessionTokenMatch[1],  // Session token
          bl: blBuildMatch ? blBuildMatch[1] : s06grbMatch[1]   // Build ID or User ID
        };
      }
      
      // Helper function to generate session token format from API key (for this scope)
      function generateSessionToken(apiKey) {
        try {
          // The session token format appears to be: prefixString:timestamp
          // Real format: AJpMio1FdhVkSj7OzqgV02hchFx3:1752685255295
          const timestamp = Date.now();
          
          // Create a base64-like string from the API key
          const keyHash = btoa(apiKey).replace(/[+/=]/g, '').substring(0, 32);
          const sessionToken = `AJpMio1${keyHash}:${timestamp}`;
          
          console.log('Attempting to generate session token from API key...');
          return sessionToken;
        } catch (error) {
          console.error('Failed to generate session token:', error);
          return null;
        }
      }
      
      // Fall back to discovered API key tokens with correct bl format
      if (b8swkbMatch && (blBuildMatch || s06grbMatch)) {
        console.log('✅ SUCCESS: Using B8SWKb + BL tokens (preferred)');
        
        // Try to generate session token format from API key
        const apiKey = b8swkbMatch[1];
        const sessionToken = generateSessionToken(apiKey);
        console.log('Generated session token:', sessionToken ? sessionToken.substring(0, 20) + '...' : 'null');
        
        return {
          at: sessionToken || apiKey,  // Session token or API key fallback
          bl: blBuildMatch ? blBuildMatch[1] : s06grbMatch[1]   // Build ID or User ID
        };
      }
      
      if (vqimjMatch && (blBuildMatch || s06grbMatch)) {
        console.log('✅ SUCCESS: Using VqImj + BL tokens (alternative)');
        
        // Try to generate session token format from API key
        const apiKey = vqimjMatch[1];
        const sessionToken = generateSessionToken(apiKey);
        console.log('Generated session token from VqImj:', sessionToken ? sessionToken.substring(0, 20) + '...' : 'null');
        
        return {
          at: sessionToken || apiKey,   // Session token or API key fallback
          bl: blBuildMatch ? blBuildMatch[1] : s06grbMatch[1]   // Build ID or User ID
        };
      }

      // If we didn't find the discovered tokens, fall back to traditional tokens
      if (!atToken || !blToken) {
        console.log('Neither discovered nor traditional tokens found, trying more patterns...');
        console.log('AT token value:', atToken);
        console.log('BL token value:', blToken);
        
        // Enhanced error message with debugging info
        const errorMsg = `Authentication tokens not found. Please make sure you are signed in to NotebookLM.
        Debug info: 
        - Traditional AT token found: ${!!atToken}
        - Traditional BL token found: ${!!blToken}
        - Session token found: ${!!sessionTokenMatch}
        - B8SWKb token found: ${!!b8swkbMatch}
        - S06Grb token found: ${!!s06grbMatch}
        - VqImj token found: ${!!vqimjMatch}
        - BL build token found: ${!!blBuildMatch}
        - Page URL: ${window.location.href}
        - Page title: ${document.title}
        
        Please try:
        1. Refresh the NotebookLM page
        2. Make sure you're signed in to your Google account
        3. Navigate to https://notebooklm.google.com/
        4. Try the connection again`;
        
        throw new Error(errorMsg);
      }
      
      console.log('✅ SUCCESS: Using traditional tokens');
      console.log('AT token:', atToken ? atToken.substring(0, 20) + '...' : 'null');
      console.log('BL token:', blToken ? blToken.substring(0, 20) + '...' : 'null');
      
      return {
        at: atToken,
        bl: blToken
      };
    } catch (error) {
      console.error('❌ ERROR in extractAuthTokens:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    }
  },

  // Execute NotebookLM API calls using the real batchexecute endpoint
  async executeNotebookLMAPI(rpcs) {
    if (!this.isAuthenticated) {
      await this.authenticate();
    }
    
    // Also check if we have wrong token types and force refresh
    if (this.authParams && this.authParams.at && 
        !this.authParams.at.startsWith('AIzaSy') && 
        !this.authParams.at.startsWith('AJpMio1')) {
      console.log('executeNotebookLMAPI: Detected invalid tokens, forcing refresh...');
      await this.authenticate(true);
    }

    try {
      console.log('=== EXECUTING NOTEBOOKLM API ===');
      console.log('RPCs to execute:', rpcs);
      console.log('Auth params:', {
        at: this.authParams.at ? this.authParams.at.substring(0, 20) + '...' : 'null',
        bl: this.authParams.bl ? this.authParams.bl.substring(0, 20) + '...' : 'null'
      });

      // Use the real NotebookLM batchexecute endpoint with required parameters
      const rpcIds = rpcs.map(rpc => rpc.id).join(',');
      const requestId = Math.floor(Math.random() * 1000000) + 546856;
      
      // Extract timestamp from AT token to use as session ID
      let sessionId = Date.now().toString();
      if (this.authParams.at && this.authParams.at.includes(':')) {
        const atTimestamp = this.authParams.at.split(':')[1];
        if (atTimestamp && /^\d+$/.test(atTimestamp)) {
          sessionId = atTimestamp;
        }
      }
      
      const url = `https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute?rpcids=${rpcIds}&source-path=%2F&soc-app=1&soc-platform=1&bl=${this.authParams.bl}&f.sid=${sessionId}&hl=en&_reqid=${requestId}&rt=c`;
      
      // Build the proper request body for Google's batchexecute format
      const requestBody = new URLSearchParams();
      
      // Format the f.req parameter correctly - arguments must be JSON-stringified
      // NotebookLM uses triple nested arrays: [[[...]]]
      const formattedRequests = rpcs.map(rpc => [
        rpc.id,
        JSON.stringify(rpc.args),
        null,
        'generic'
      ]);
      requestBody.append('f.req', JSON.stringify([formattedRequests]));
      
      // Add authentication parameters in the correct format
      if (this.authParams.at) {
        requestBody.append('at', this.authParams.at);
      }
      if (this.authParams.bl) {
        requestBody.append('bl', this.authParams.bl);
      }
      
      // Add additional parameters that might be required
      requestBody.append('f.sid', sessionId);
      requestBody.append('_reqid', requestId);

      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Referer': 'https://notebooklm.google.com/',
        'Origin': 'https://notebooklm.google.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Goog-AuthUser': '0',
        'X-Goog-Encode-Response-If-Executable': 'base64',
        'X-Goog-Visitor-Id': sessionId,
        'X-Same-Domain': '1',
        'X-Client-Data': 'CIW2yQEIo7bJAQipncoBCMD2yQEIlqHLAQiFoM0BCNKfzQEI2qDNAQjWoM0BCIqhzQEI6qLNAQjLpc0BCMutzQEIz7PNAQjYtM0BCOm0zQEI8bTNAQiRts0BCOy2zQEI+7bNAQiMt80BCJ+3zQEImrjNAQiuuM0BCK25zQEIurjNAQi5uM0BCMy4zQEI1rjNAQiYuc0BCL+5zQEI6rnNAQjyuc0BCKu6zQEI9rrNAQjSu80BCKy8zQEI073NAQiRvs0BCOy+zQEI+b7NAQiQv80BCJm/zQEIo7/NAQj2v80BCKzAzQEIssHNAQi5wc0BCNnBzQEI+8HNAQiWws0BCL/CzQEI1sLNAQi+w80BCMDDzQEI5cPNAQjJxM0BCNnEzQEI6cTNAQjLxc0BCOfFzQEI+cXNAQiNxs0BCOPGzQEI8cbNAQiYx80BCJzHzQEIpcfNAQjhx80BCPbHzQEIgcjNAQioyM0BCL7IzQEIv8jNAQi4yc0BCNfJzQEI+MnNAQiWys0BCKrKzQEIy8rNAQiSy80BCJrLzQEIocvNAQiZzM0BCNnMzQEI4szNAQiTzc0BCLbNzQEI4M3NAQiCzs0BCJfOzQEI',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      };

      console.log('Making API request to:', url);
      console.log('Request body:', requestBody.toString());

      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: requestBody,
        credentials: 'include'
      });

      console.log('Response status:', response.status);
      const rawResponse = await response.text();
      console.log('Raw response:', rawResponse.substring(0, 500) + '...');

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} - ${rawResponse}`);
      }

      // Parse NotebookLM's response format
      const results = this.parseNotebookLMResponse(rawResponse);
      console.log('✅ API request successful, parsed results:', results.length);
      return results;
      
    } catch (error) {
      console.error('❌ NotebookLM API execution failed:', error);
      throw error;
    }
  },

  // Parse NotebookLM's batchexecute response format
  parseNotebookLMResponse(text) {
    try {
      // Clean the response text (remove the security prefix)
      const cleanedText = text.split('\n').slice(2).join('');
      const parsed = JSON.parse(cleanedText);
      
      const results = [];
      for (const item of parsed) {
        if (item[0] !== 'wrb.fr') continue;
        
        let index;
        if (item[6] === 'generic') {
          index = 1;
        } else {
          index = parseInt(item[6], 10);
        }
        
        const rpcId = item[1];
        const data = JSON.parse(item[2]);
        results.push({ index, rpcId, data });
      }
      
      return results;
    } catch (error) {
      console.error('Failed to parse NotebookLM response:', error);
      throw new Error('Failed to parse API response');
    }
  },

  // Test the GraphQL integration with NotebookLM
  async testNotebookLMAPI() {
    try {
      console.log('=== TESTING NOTEBOOKLM API INTEGRATION ===');
      Utils.showNotification('🧪 Testing NotebookLM API integration...', 'info');
      
      // Test 1: Fetch notebooks
      console.log('Test 1: Fetching notebooks...');
      Utils.showNotification('Fetching notebooks...', 'info');
      const notebooks = await this.fetchNotebooks();
      console.log('✅ Notebooks fetched:', notebooks.length);
      
      if (notebooks.length > 0) {
        console.log('Sample notebook:', notebooks[0]);
        
        // Test 2: Add a test source to the first notebook
        console.log('Test 2: Adding test source...');
        const testUrl = 'https://en.wikipedia.org/wiki/NotebookLM';
        const result = await this.addSourceToNotebook(notebooks[0].id, testUrl);
        
        if (result.success) {
          console.log('✅ Source added successfully:', result);
          
          // Update UI to show the changes
          await this.updateNotebookLMUI(notebooks[0].id);
        } else {
          console.log('❌ Failed to add source:', result.error);
        }
      } else {
        // Test 3: Create a new notebook if none exist
        console.log('Test 3: Creating new notebook...');
        const notebookId = await this.createNewNotebook('API Test Notebook');
        console.log('✅ Notebook created:', notebookId);
        
        // Add a source to the new notebook
        const testUrl = 'https://notebooklm.google.com/';
        const result = await this.addSourceToNotebook(notebookId, testUrl);
        console.log('Source addition result:', result);
        
        if (result.success) {
          await this.updateNotebookLMUI(notebookId);
        }
      }
      
      console.log('✅ NotebookLM API integration test completed');
      Utils.showNotification('✅ NotebookLM API integration test completed successfully!', 'success');
      
    } catch (error) {
      console.error('❌ NotebookLM API integration test failed:', error);
      Utils.showNotification(`❌ API test failed: ${error.message}`, 'error');
      
      // If authentication failed, show helpful message
      if (error.message.includes('NotebookLM')) {
        Utils.showNotification('💡 Tip: Make sure NotebookLM is open in a browser tab', 'info');
      }
    }
  },

  // Helper function to show extension reload instructions
  showReloadInstructions() {
    const message = `
📋 To reload the extension:
1. Go to chrome://extensions/
2. Find "SmartGrab AI Search Extension"
3. Click the reload/refresh button
4. Come back to test the GraphQL integration

The "🧪 Test GraphQL Integration" button should now be visible in:
- NotebookLM tab (near connection status)
- Settings tab (debug section)
    `;
    
    console.log(message);
    Utils.showNotification('Extension reload instructions logged to console', 'info');
    
    // Also copy instructions to clipboard if possible
    if (navigator.clipboard) {
      navigator.clipboard.writeText(message.trim()).then(() => {
        Utils.showNotification('Instructions copied to clipboard!', 'success');
      }).catch(() => {
        console.log('Could not copy to clipboard, but instructions are in console');
      });
    }
  },

  async loadArticles() {
    await Data.loadEntries();
    this.updateSelectionUI();
  },
  
  updateSelectionUI() {
    const selectedCount = AppState.homeSelectedArticles.size;
    const importButton = Elements.importToNotebookLM;
    
    if (importButton) {
      Utils.setDisabled(importButton, selectedCount === 0);
      importButton.textContent = selectedCount > 0 
        ? `Import ${selectedCount} articles to NotebookLM`
        : 'Select articles to import';
    }
    
    // Update NotebookLM selection counts
    if (Elements.selectedCount) {
      Elements.selectedCount.textContent = selectedCount;
    }
    
    if (Elements.exportToNotebookLM) {
      Utils.setDisabled(Elements.exportToNotebookLM, selectedCount === 0);
    }
    
    // Calculate estimated words and files
    const selectedEntries = AppState.allEntries.filter(entry => 
      AppState.homeSelectedArticles.has(entry.id)
    );
    
    const totalWords = selectedEntries.reduce((sum, entry) => 
      sum + (entry.text ? entry.text.split(' ').length : 0), 0
    );
    
    const estimatedFiles = Math.ceil(totalWords / 1000); // Rough estimate
    
    if (Elements.selectedWords) {
      Elements.selectedWords.textContent = totalWords.toLocaleString();
    }
    
    if (Elements.estimatedFiles) {
      Elements.estimatedFiles.textContent = estimatedFiles;
    }
  },
  
  selectArticlesBulk(mode) {
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
      case 'high':
        // Select top 10 most recent entries
        const sortedEntries = [...AppState.allEntries]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10);
        AppState.homeSelectedArticles.clear();
        sortedEntries.forEach(entry => AppState.homeSelectedArticles.add(entry.id));
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
  
    async loadNotebooks() {
    if (!Elements.notebookDropdown) return;
    
    try {
      Elements.notebookDropdown.innerHTML = '<option value="">Loading notebooks...</option>';
      
      // Authenticate first
      await this.authenticate();
      
      // Fetch notebooks using proper API
      const notebooks = await this.fetchNotebooks();
      
      if (notebooks && notebooks.length > 0) {
        Elements.notebookDropdown.innerHTML = '<option value="">Select a notebook...</option>';
        
        notebooks.forEach(notebook => {
          const option = document.createElement('option');
          option.value = notebook.id;
          option.textContent = `${notebook.emoji || '📔'} ${notebook.title}`;
          Elements.notebookDropdown.appendChild(option);
        });
        
        const createOption = document.createElement('option');
        createOption.value = 'CREATE_NEW';
        createOption.textContent = '➕ Create New Notebook';
        Elements.notebookDropdown.appendChild(createOption);
      } else {
        Elements.notebookDropdown.innerHTML = `
          <option value="">No notebooks found</option>
          <option value="CREATE_NEW">➕ Create New Notebook</option>
        `;
      }
    } catch (error) {
      console.error('Failed to load notebooks:', error);
      Elements.notebookDropdown.innerHTML = '<option value="">❌ Error loading notebooks</option>';
      Utils.showNotification(`Failed to load notebooks: ${error.message}`, 'error');
    }
  },
  
  async fetchNotebooks() {
    try {
      console.log('Fetching notebooks from NotebookLM...');
      
      // Use the correct RPC call for fetching notebooks with the real format
      // Try multiple RPC calls and variations to see which one works
      const rpcVariations = [
        {
          id: 'wXbhsf',
          args: [null, 1, null, [2]]
        },
        {
          id: 'wXbhsf',
          args: [null, 1]
        },
        {
          id: 'wXbhsf',
          args: [null, 1, null, []]
        },
        {
          id: 'wXbhsf',
          args: []
        },
        {
          id: 'CCqFvf',
          args: [null, 1]
        },
        {
          id: 'izAoDd',
          args: [null, 1]
        },
        {
          id: 'KjsqPd',
          args: [null, 1]
        }
      ];
      
      console.log('Trying different RPC variations...');
      let results = null;
      
      for (let i = 0; i < rpcVariations.length; i++) {
        try {
          console.log(`Trying RPC variation ${i + 1}:`, rpcVariations[i]);
          results = await this.executeNotebookLMAPIInPage([rpcVariations[i]]);
          console.log('✅ RPC variation succeeded:', i + 1);
          break;
        } catch (error) {
          console.log(`❌ RPC variation ${i + 1} failed:`, error.message);
          if (i === rpcVariations.length - 1) {
            throw error; // Re-throw the last error if all variations fail
          }
        }
      }
      
      if (results.length === 0) {
        console.log('No notebooks found in response');
        return [];
      }
      
      const notebooksData = results[0].data[0];
      if (!Array.isArray(notebooksData)) {
        console.log('Invalid notebooks data format');
        return [];
      }
      
      // Parse and sort notebooks by creation date (newest first)
      notebooksData.sort((a, b) => (b[5] && b[5][1] || 0) - (a[5] && a[5][1] || 0));
      
      const notebooks = notebooksData.map(notebook => ({
        id: notebook[2],
        title: notebook[0] || 'Untitled Notebook',
        emoji: notebook[3] || '📔'
      }));
      
      console.log(`Found ${notebooks.length} notebooks`);
      return notebooks;
    } catch (error) {
      console.error('Error fetching notebooks:', error);
      throw error;
    }
  },
  
  async createNewNotebook(title) {
    try {
      console.log(`Creating new notebook: ${title}`);
      
      // Use the correct RPC call for creating a new notebook with the real format
      const results = await this.executeNotebookLMAPI([{
        id: 'CCqFvf',
        args: ["", null, null, [2]]
      }]);
      
      if (results.length === 0) {
        throw new Error('Failed to create notebook - no response');
      }
      
      const notebookId = results[0].data[2];
      if (!notebookId) {
        throw new Error('Failed to create notebook - no ID returned');
      }
      
      console.log(`Created notebook with ID: ${notebookId}`);
      return notebookId;
    } catch (error) {
      console.error('Error creating notebook:', error);
      throw error;
    }
  },

  async addSourceToNotebook(notebookId, url) {
    try {
      console.log(`Adding source to notebook ${notebookId}: ${url}`);
      
      // Use the correct format from captured requests
      const sourceData = [null, null, [url], null, null, null, null, null, null, null, 1];
      
      // Use the correct RPC call for adding sources with the real format
      const results = await this.executeNotebookLMAPI([{
        id: 'izAoDd',
        args: [[sourceData], notebookId, [2]]
      }]);
      
      if (results.length === 0) {
        throw new Error('Failed to add source - no response');
      }
      
      console.log(`Successfully added source to notebook`);
      return { success: true, url };
    } catch (error) {
      console.error('Error adding source:', error);
      return { success: false, url, error: error.message };
    }
  },

  async importArticlesToNotebook(notebookId, articles) {
    const results = [];
    
    for (const article of articles) {
      try {
        // Use the article URL if available, otherwise create a data URL with the content
        let sourceUrl = article.url;
        
        if (!sourceUrl || sourceUrl === 'Untitled') {
          // Create a data URL with the article content for articles without URLs
          const content = `# ${article.title}\n\n${article.text}`;
          sourceUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`;
        }
        
        const result = await this.addSourceToNotebook(notebookId, sourceUrl);
        results.push({ ...result, title: article.title });
        
        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to import article "${article.title}":`, error);
        results.push({ 
          success: false, 
          url: article.url || 'no-url',
          title: article.title,
          error: error.message 
        });
      }
    }
    
    return results;
  },
  
    async performImport() {
    const selectedEntries = AppState.allEntries.filter(entry => 
      AppState.homeSelectedArticles.has(entry.id)
    );
    
    if (selectedEntries.length === 0) {
      Utils.showNotification('No articles selected', 'error');
      return;
    }
    
    let notebookId = Elements.notebookDropdown?.value;
    if (!notebookId) {
      Utils.showNotification('Please select a notebook or create a new one', 'error');
      return;
    }
    
    try {
      // Show loading state
      Utils.setDisabled(Elements.importToNotebookLM, true);
      if (Elements.importToNotebookLM) {
        Elements.importToNotebookLM.textContent = '⏳ Importing...';
      }
      
      // Create new notebook if needed
      if (notebookId === 'CREATE_NEW') {
        Utils.showNotification('Creating new notebook...', 'info');
        const title = `SmartGrab Import - ${new Date().toLocaleDateString()}`;
        notebookId = await this.createNewNotebook(title);
        Utils.showNotification(`Created notebook: ${title}`, 'success');
      }
      
      // Import articles
      Utils.showNotification(`Importing ${selectedEntries.length} articles...`, 'info');
      const results = await this.importArticlesToNotebook(notebookId, selectedEntries);
      
      // Show results
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      
      if (successCount > 0) {
        Utils.showNotification(`✅ Successfully imported ${successCount} articles to NotebookLM`, 'success');
        
        // Update NotebookLM UI to show new content (following web importer behavior)
        await this.updateNotebookLMUI(notebookId);
      }
      
      if (failCount > 0) {
        Utils.showNotification(`⚠️ Failed to import ${failCount} articles`, 'error');
      }
      
      // Clear selection
      AppState.homeSelectedArticles.clear();
      this.updateSelectionUI();
      
      // Refresh notebooks list
      await this.loadNotebooks();
      
    } catch (error) {
      console.error('Import failed:', error);
      Utils.showNotification(`Import failed: ${error.message}`, 'error');
    } finally {
      // Reset button state
      Utils.setDisabled(Elements.importToNotebookLM, false);
      if (Elements.importToNotebookLM) {
        const selectedCount = AppState.homeSelectedArticles.size;
        Elements.importToNotebookLM.textContent = selectedCount > 0 
          ? `Import ${selectedCount} articles to NotebookLM`
          : 'Select articles to import';
      }
    }
  },
  
  loadExportHistory() {
    // Placeholder for export history functionality
    console.log('Loading export history...');
  },

  async checkConnectionStatus() {
    try {
      // Try to authenticate and load notebooks to test connection
      console.log('=== CHECK CONNECTION STATUS ===');
      await this.authenticate(true); // Always force refresh to get latest tokens
      
      // Update UI to show connected status
      if (Elements.driveStatus) {
        Elements.driveStatus.className = 'google-drive-status connected';
        Elements.driveStatus.innerHTML = '✅ <span>Connected to NotebookLM</span>';
      }
      
      if (Elements.connectDriveBtn) {
        Elements.connectDriveBtn.textContent = '🔄 Refresh Connection';
      }
      
      return true;
    } catch (error) {
      console.log('NotebookLM not connected:', error.message);
      
      // Update UI to show disconnected status
      if (Elements.driveStatus) {
        Elements.driveStatus.className = 'google-drive-status disconnected';
        Elements.driveStatus.innerHTML = '⚠️ <span>Not connected to NotebookLM</span>';
      }
      
      if (Elements.connectDriveBtn) {
        Elements.connectDriveBtn.textContent = '🔗 Connect to NotebookLM';
      }
      
      return false;
    }
  },
  
  debug() {
    console.log('NotebookLM Debug - Use browser DevTools Network tab to monitor requests');
    Utils.showNotification('Use DevTools Network tab to monitor NotebookLM requests', 'info');
  },

  // Simple test function to verify script injection is working
  async testScriptInjection() {
    console.log('=== TESTING SCRIPT INJECTION ===');
    console.log('Function called at:', new Date().toISOString());
    
    Utils.showNotification('Testing script injection...', 'info');
    
    // Check if Elements.debugTokensBtn exists
    console.log('debugTokensBtn element:', Elements.debugTokensBtn);
    console.log('NotebookLM object:', typeof NotebookLM);
    console.log('testScriptInjection function:', typeof this.testScriptInjection);
    
    try {
      const tabs = await chrome.tabs.query({url: "https://notebooklm.google.com/*"});
      console.log('Found tabs:', tabs.length);
      
      if (tabs.length === 0) {
        Utils.showNotification('No NotebookLM tab found', 'error');
        return;
      }

      const result = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        world: 'MAIN',
        func: () => {
          console.log('=== SCRIPT INJECTION TEST SUCCESS ===');
          return {
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toISOString()
          };
        }
      });

      console.log('Script injection result:', result);
      Utils.showNotification('Script injection test completed - check console', 'success');
    } catch (error) {
      console.error('Script injection test failed:', error);
      Utils.showNotification('Script injection failed: ' + error.message, 'error');
    }
  },

  // Debug function to check what tokens are available on NotebookLM page
  async debugTokens() {
    console.log('=== DEBUG TOKENS FUNCTION CALLED ===');
    Utils.showNotification('Starting token debug...', 'info');
    
    try {
      console.log('Debugging NotebookLM tokens...');
      
      // Check if NotebookLM tab is open
      console.log('Querying for NotebookLM tabs...');
      const tabs = await chrome.tabs.query({url: "https://notebooklm.google.com/*"});
      console.log('Found tabs:', tabs.length);
      
      if (tabs.length === 0) {
        console.log('No NotebookLM tab found');
        Utils.showNotification('No NotebookLM tab found. Please open https://notebooklm.google.com/', 'error');
        return;
      }

      console.log('Executing script on tab:', tabs[0].id);
      // Execute debug script on NotebookLM page
      const result = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        world: 'MAIN',
        func: () => {
          // Debug function to run on NotebookLM page
          const pageText = document.documentElement.innerHTML;
          
          // Look for all potential token patterns
          const tokenPatterns = [
            { name: 'SNlM0e', regex: /"SNlM0e":"([^"]+)"/ },
            { name: 'cfb2h', regex: /"cfb2h":"([^"]+)"/ },
            { name: 'at', regex: /"at":"([^"]+)"/ },
            { name: 'bl', regex: /"bl":"([^"]+)"/ },
            { name: 'FdrFJe', regex: /"FdrFJe":"([^"]+)"/ },
          ];
          
          const foundTokens = [];
          
          for (const pattern of tokenPatterns) {
            const match = pageText.match(pattern.regex);
            if (match) {
              foundTokens.push({
                name: pattern.name,
                value: match[1].substring(0, 20) + '...' // Show first 20 chars for debugging
              });
            }
          }
          
          // Look for any pattern that might be a token
          const allTokenMatches = pageText.match(/"[A-Za-z0-9]{5,10}":"[A-Za-z0-9_-]{20,}"/g);
          const uniqueTokens = [...new Set(allTokenMatches || [])].slice(0, 10);
          
          // Better signed-in detection for NotebookLM
          const signedInIndicators = [
            'Sign out',
            'account_circle',
            'profile',
            'avatar',
            'user_menu',
            'account_menu',
            'signed_in',
            'logout'
          ];
          
          let userSignedIn = false;
          const bodyText = document.body.innerHTML.toLowerCase();
          
          for (const indicator of signedInIndicators) {
            if (bodyText.includes(indicator.toLowerCase())) {
              userSignedIn = true;
              console.log(`Sign-in detected via: ${indicator}`);
              break;
            }
          }
          
          // Also check for user email patterns
          const emailPattern = /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
          if (emailPattern.test(bodyText)) {
            userSignedIn = true;
            console.log('Sign-in detected via email pattern');
          }
          
          return {
            url: window.location.href,
            title: document.title,
            userSignedIn: userSignedIn,
            foundTokens: foundTokens,
            allPotentialTokens: uniqueTokens,
            pageContainsWizGlobalData: pageText.includes('WIZ_global_data')
          };
        }
      });

      console.log('Script execution result:', result);
      const debugInfo = result[0].result;
      console.log('NotebookLM Debug Results:', debugInfo);
      
      // Log detailed token information
      console.log('=== DETAILED TOKEN ANALYSIS ===');
      console.log('User signed in:', debugInfo.userSignedIn);
      console.log('Found tokens:', debugInfo.foundTokens);
      console.log('All potential tokens:', debugInfo.allPotentialTokens);
      
      // Display results to user
      Utils.showNotification(`Debug complete. Check console for token details. Found ${debugInfo.foundTokens.length} known tokens.`, 'info');
      
      return debugInfo;
    } catch (error) {
      console.error('=== DEBUG TOKENS ERROR ===');
      console.error('Full error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      Utils.showNotification('Debug failed: ' + error.message, 'error');
    }
  },
  
  async captureAndOpen() {
    try {
      // Show loading state
      Utils.setDisabled(Elements.captureAndOpenBtn, true);
      if (Elements.captureAndOpenBtn) {
        Elements.captureAndOpenBtn.textContent = '⏳ Capturing...';
      }
      
      // First, capture the current page
      Utils.showNotification('Capturing current page...', 'info');
      
      const captureResponse = await Utils.sendMessage({ action: 'capture_page' });
      
      if (captureResponse.success) {
        const entry = captureResponse.entry;
        Utils.showNotification(`✅ Captured: ${entry.title}`, 'success');
        
        // Reload the articles list to show the new capture
        await Data.loadEntries();
        await this.loadArticles();
        
        // Try to automatically import to NotebookLM
        try {
          Utils.showNotification('Importing to NotebookLM...', 'info');
          
          // Authenticate with NotebookLM
          await this.authenticate();
          
          // Create a new notebook for this capture
          const notebookTitle = `${entry.title} - ${new Date().toLocaleDateString()}`;
          const notebookId = await this.createNewNotebook(notebookTitle);
          
          // Import the article
          const results = await this.importArticlesToNotebook(notebookId, [entry]);
          
          if (results[0]?.success) {
            Utils.showNotification('✅ Successfully imported to NotebookLM!', 'success');
            
            // Open the notebook
            const notebookUrl = `https://notebooklm.google.com/notebook/${notebookId}`;
            await chrome.tabs.create({ url: notebookUrl });
          } else {
            throw new Error(results[0]?.error || 'Import failed');
          }
        } catch (importError) {
          console.error('Auto-import failed:', importError);
          Utils.showNotification(`⚠️ Captured but import failed: ${importError.message}`, 'error');
          
          // Fallback: just open NotebookLM
          await chrome.tabs.create({ url: 'https://notebooklm.google.com' });
        }
      } else {
        throw new Error(captureResponse.error || 'Capture failed');
      }
    } catch (error) {
      console.error('Capture and open failed:', error);
      Utils.showNotification(`Failed to capture page: ${error.message}`, 'error');
    } finally {
      // Reset button state
      Utils.setDisabled(Elements.captureAndOpenBtn, false);
      if (Elements.captureAndOpenBtn) {
        Elements.captureAndOpenBtn.textContent = '📄 Capture & Open NotebookLM';
      }
    }
  },
  
  async connectDrive() {
    try {
      // Test NotebookLM connection instead of Google Drive
      Utils.showNotification('Testing NotebookLM connection...', 'info');
      
      console.log('=== REFRESH CONNECTION CLICKED ===');
      console.log('Forcing fresh authentication...');
      
      await this.authenticate(true); // Force refresh to get new tokens
      await this.loadNotebooks();
      
      // Update connection status
      if (Elements.driveStatus) {
        Elements.driveStatus.className = 'google-drive-status connected';
        Elements.driveStatus.innerHTML = '✅ <span>Connected to NotebookLM</span>';
      }
      
      if (Elements.connectDriveBtn) {
        Elements.connectDriveBtn.textContent = '🔄 Refresh Connection';
      }
      
      Utils.showNotification('✅ NotebookLM connection successful!', 'success');
    } catch (error) {
      console.error('NotebookLM connection failed:', error);
      Utils.showNotification(`Connection failed: ${error.message}`, 'error');
      
      // Update status to show error
      if (Elements.driveStatus) {
        Elements.driveStatus.className = 'google-drive-status disconnected';
        Elements.driveStatus.innerHTML = '❌ <span>Not connected to NotebookLM</span>';
      }
      
      if (Elements.connectDriveBtn) {
        Elements.connectDriveBtn.textContent = '🔗 Connect to NotebookLM';
      }
    }
  },
  
  async performExport() {
    const selectedEntries = AppState.allEntries.filter(entry => 
      AppState.homeSelectedArticles.has(entry.id)
    );
    
    if (selectedEntries.length === 0) {
      Utils.showNotification('No articles selected for export', 'error');
      return;
    }
    
    try {
      // Create export data
      const exportData = {
        timestamp: Date.now(),
        entries: selectedEntries,
        count: selectedEntries.length
      };
      
      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notebooklm-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      Utils.showNotification(`Exported ${selectedEntries.length} articles`, 'success');
      
      // Clear selection
      AppState.homeSelectedArticles.clear();
      this.updateSelectionUI();
      
    } catch (error) {
      console.error('Export failed:', error);
      Utils.showNotification('Export failed', 'error');
    }
  },
  
  async openDriveFolder() {
    try {
      // Placeholder for opening Google Drive folder
      Utils.showNotification('Google Drive integration not yet implemented', 'info');
    } catch (error) {
      console.error('Failed to open Drive folder:', error);
      Utils.showNotification('Failed to open Drive folder', 'error');
    }
  },

  // Alternative: Use official Gemini API for audio overviews
  async testGeminiAudioAPI() {
    try {
      console.log('=== TESTING GEMINI API AUDIO FEATURES ===');
      
      // This would require a proper Gemini API key and endpoint
      // Example of what the official API call might look like:
      
      const apiKey = 'YOUR_GEMINI_API_KEY'; // Would need to be obtained from Google AI Studio
      const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
      
      const requestBody = {
        contents: [{
          parts: [{
            text: `Generate a podcast-style audio overview discussion between two hosts about the following content: 
                   
                   ${this.getPageContent()}
                   
                   Please create an engaging, conversational discussion that summarizes the key points.`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.9,
          maxOutputTokens: 2048,
          // Note: Audio generation might require special configuration
          responseMimeType: "audio/wav" // This is hypothetical - actual API might differ
        }
      };
      
      console.log('Making request to official Gemini API...');
      console.log('Request body:', requestBody);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`Gemini API request failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Gemini API response:', result);
      
      // Handle the response based on actual API format
      return result;
      
    } catch (error) {
      console.error('❌ Gemini API test failed:', error);
      throw error;
    }
  },

  getPageContent() {
    // Extract text content from the current page
    const content = document.body.innerText || document.body.textContent || '';
    return content.substring(0, 5000); // Limit to avoid token limits
  },

  // Update NotebookLM UI after operations (following web importer behavior)
  async updateNotebookLMUI(notebookId = null) {
    try {
      console.log('Updating NotebookLM UI...');
      
      // Find any open NotebookLM tabs
      const tabs = await chrome.tabs.query({ url: 'https://notebooklm.google.com/*' });
      
      if (tabs.length > 0) {
        // Refresh existing NotebookLM tabs to show new content
        for (const tab of tabs) {
          await chrome.tabs.reload(tab.id);
        }
        console.log(`Refreshed ${tabs.length} NotebookLM tabs`);
      } else {
        // Open NotebookLM if no tabs are open
        const url = notebookId 
          ? `https://notebooklm.google.com/notebook/${notebookId}`
          : 'https://notebooklm.google.com/';
        
        await chrome.tabs.create({ url });
        console.log('Opened new NotebookLM tab');
      }
    } catch (error) {
      console.error('Error updating NotebookLM UI:', error);
    }
  },

  // Execute NotebookLM API calls by injecting script into the NotebookLM page
  async executeNotebookLMAPIInPage(rpcs) {
    if (!this.isAuthenticated) {
      await this.authenticate();
    }

    try {
      console.log('=== EXECUTING NOTEBOOKLM API IN PAGE ===');
      console.log('RPCs to execute:', rpcs);
      
      // Get the NotebookLM tab
      const tabs = await chrome.tabs.query({url: "https://notebooklm.google.com/*"});
      if (tabs.length === 0) {
        throw new Error('No NotebookLM tab found');
      }
      
      const tab = tabs[0];
      
      // Execute the script in the NotebookLM page
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async function(rpcs, authParams) {
          console.log('🚀 Executing NotebookLM API call in page context...');
          
          try {
            // Use the real NotebookLM batchexecute endpoint with required parameters
            const rpcIds = rpcs.map(rpc => rpc.id).join(',');
            const requestId = Math.floor(Math.random() * 1000000) + 546856;
            
            // Extract timestamp from AT token to use as session ID
            let sessionId = Date.now().toString();
            if (authParams.at && authParams.at.includes(':')) {
              const atTimestamp = authParams.at.split(':')[1];
              if (atTimestamp && /^\d+$/.test(atTimestamp)) {
                sessionId = atTimestamp;
              }
            }
            
            const url = `https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute?rpcids=${rpcIds}&source-path=%2F&soc-app=1&soc-platform=1&bl=${authParams.bl}&f.sid=${sessionId}&hl=en&_reqid=${requestId}&rt=c`;
            
            // Build the proper request body for Google's batchexecute format
            const requestBody = new URLSearchParams();
            
            // Format the f.req parameter correctly - arguments must be JSON-stringified
            const formattedRequests = rpcs.map(rpc => [
              rpc.id,
              JSON.stringify(rpc.args),
              null,
              'generic'
            ]);
            requestBody.append('f.req', JSON.stringify([formattedRequests]));
            
            // Add authentication parameters in the correct format
            if (authParams.at) {
              requestBody.append('at', authParams.at);
            }
            if (authParams.bl) {
              requestBody.append('bl', authParams.bl);
            }
            
            // Add additional parameters that might be required
            requestBody.append('f.sid', sessionId);
            requestBody.append('_reqid', requestId);
            
            // Try to extract CSRF token or similar security tokens from the page
            const pageText = document.documentElement.outerHTML;
            const csrfMatches = [
              pageText.match(/"csrf_token":\s*"([^"]+)"/),
              pageText.match(/"csrfToken":\s*"([^"]+)"/),
              pageText.match(/"xsrf_token":\s*"([^"]+)"/),
              pageText.match(/"security_token":\s*"([^"]+)"/),
              pageText.match(/"at":\s*"([^"]+)"/),
              pageText.match(/csrf[_-]?token["'\s]*[:=]["'\s]*([A-Za-z0-9+/]{16,})/gi)
            ];
            
            const csrfToken = csrfMatches.find(match => match && match[1]);
            if (csrfToken) {
              console.log('🔐 Found potential CSRF token, adding to request...');
              requestBody.append('csrf_token', csrfToken[1]);
            }

            const headers = {
              'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              'X-Same-Domain': '1'
            };

            console.log('📡 Making API request from page context...');
            console.log('URL:', url);
            console.log('Request body:', requestBody.toString());

            const response = await fetch(url, {
              method: 'POST',
              headers: headers,
              body: requestBody,
              credentials: 'include'
            });

            console.log('📥 Response status:', response.status);
            const rawResponse = await response.text();
            console.log('📥 Raw response:', rawResponse.substring(0, 500) + '...');

            if (!response.ok) {
              return {
                success: false,
                error: `API request failed: ${response.status} - ${rawResponse}`
              };
            }

            // Parse NotebookLM's response format
            const lines = rawResponse.substring(4).split('\n').filter(line => line.trim());
            const results = [];
            
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const parsed = JSON.parse(line);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    results.push(parsed);
                  }
                } catch (e) {
                  console.log('Could not parse line:', line);
                }
              }
            }

            console.log('✅ API request successful, parsed results:', results.length);
            return {
              success: true,
              data: results
            };
            
          } catch (error) {
            console.error('❌ NotebookLM API execution failed:', error);
            return {
              success: false,
              error: error.message
            };
          }
        },
        args: [rpcs, this.authParams]
      });
      
      if (results && results[0] && results[0].result) {
        const result = results[0].result;
        if (result.success) {
          console.log('✅ Page-based API execution successful');
          return result.data;
        } else {
          throw new Error(result.error);
        }
      } else {
        throw new Error('No result from page-based execution');
      }
      
    } catch (error) {
      console.error('❌ Page-based NotebookLM API execution failed:', error);
      throw error;
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
    
    // Load setup note visibility
    const setupDismissed = await Utils.get('setupNoteDismissed');
    Utils.showElement(Elements.setupNote, !setupDismissed);
    
    // Clear any lingering error states
    await Data.clearErrorStates();
    
    // Setup event listeners and scroll expansion
    Data.setupEntryEventListeners();
    Data.setupScrollExpansion();
    
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