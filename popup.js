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

    this.showReloadBtn = Utils.$('#showReloadBtn');
    
    // NotebookLM elements
    this.exportToNotebookLM = Utils.$('#exportToNotebookLM');
    
    // Selection elements
    this.toggleSelectionBtn = Utils.$('#toggleSelectionBtn');
    this.selectionHint = Utils.$('#selectionHint');
    this.homeSelectedCount = Utils.$('#homeSelectedCount');
    this.selectAllHome = Utils.$('#selectAllHome');
    this.selectNoneHome = Utils.$('#selectNoneHome');
    this.selectionToolbar = Utils.$('#selectionToolbar');
    
    // Export section
    this.exportSection = Utils.$('#exportSection');
    
    // Settings elements
    this.settingsIconBtn = Utils.$('#settingsIconBtn');
    
    // Semantic search elements
    this.semanticSearchContainer = Utils.$('#semanticSearchContainer');
    this.semanticInput = Utils.$('#semanticInput');
    this.toggleFiltersSemantic = Utils.$('#toggleFiltersSemantic');
    this.semanticClear = Utils.$('#semanticClear');
    
          // Debug elements
      this.testSidePanelBtn = Utils.$('#testSidePanelBtn');
      this.inspectNotebookLMBtn = Utils.$('#inspectNotebookLMBtn');

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
      if (query) {
        await this.performSearch(query);
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
    try {
      console.log('Search: Performing local semantic search for:', query);
      
      // Show loading indicator
      this.showLoading(true);
      
      // Initialize semantic search if not already done
      if (!window.semanticSearch) {
        window.semanticSearch = new SemanticSearch();
        Utils.showNotification('Loading AI model for semantic search...', 'info');
      }
      
      // Get all entries for search
      const entries = AppState.allEntries || [];
      if (entries.length === 0) {
        console.log('Search: No entries to search');
        this.showLoading(false);
        return [];
      }
      
      // Perform semantic search
      const results = await window.semanticSearch.search(query, entries, 20);
      
      // Debug: Log the raw results from semantic search
      console.log('Search: Raw semantic search results:', results);
      console.log('Search: First result similarity:', results[0]?.similarity);
      console.log('Search: Results sorted by similarity:', results.map(r => ({ title: r.title, similarity: r.similarity })));
      
      // Apply filters
      const filteredResults = this.applyFilters(results, query);
      
      console.log(`Search: Semantic search returned ${filteredResults.length} results`);
      this.showLoading(false);
      return filteredResults;
      
    } catch (error) {
      console.error('Search: Semantic search failed, falling back to keyword search:', error);
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
    
    // Debug: Log before filtering
    console.log('Search: Before filtering - first result similarity:', filtered[0]?.similarity);
    
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
    
    // Debug: Log after filtering
    console.log('Search: After filtering - first result similarity:', filtered[0]?.similarity);
    console.log('Search: Filtered results count:', filtered.length);
    
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
    
    console.log('Search: displayResults called with', results.length, 'results');
    console.log('Search: Elements.searchResults exists:', !!Elements.searchResults);
    console.log('Search: Elements.entriesContainer exists:', !!Elements.entriesContainer);
    
    if (results.length === 0) {
      Utils.showElement(Elements.noResults);
      Utils.hideElement(Elements.searchResults);
      // Show regular entries when no search results
      if (Elements.entriesContainer) {
        Utils.showElement(Elements.entriesContainer);
      }
      return;
    }
    
    Utils.hideElement(Elements.noResults);
    Utils.hideElement(Elements.entriesContainer); // Hide regular entries during search
    
    // Debug: Log the first result to see if similarity scores are present
    console.log('Search: First result for display:', results[0]);
    console.log('Search: Similarity score:', results[0]?.similarity);
    console.log('Search: Search type:', results[0]?.searchType);
    
    // Update search info
    if (Elements.resultCount) Elements.resultCount.textContent = results.length;
    if (Elements.searchTerm) Elements.searchTerm.textContent = query;
    
    // Generate results HTML
    const resultsHTML = results.map(result => this.createResultHTML(result, query)).join('');
    console.log('Search: Generated results HTML length:', resultsHTML.length);
    
    const searchResultsContent = Elements.searchResults.querySelector('.search-results-content');
    console.log('Search: searchResultsContent found:', !!searchResultsContent);
    
    if (searchResultsContent) {
      searchResultsContent.innerHTML = resultsHTML;
      console.log('Search: Updated search-results-content');
    } else {
      // Fallback to old structure
      Elements.searchResults.innerHTML = resultsHTML;
      console.log('Search: Updated searchResults directly');
    }
    
    Utils.showElement(Elements.searchResults);
    console.log('Search: Made searchResults visible');
    
    // Force the search results to be visible and check if it worked
    setTimeout(() => {
      console.log('Search: After timeout - searchResults display:', Elements.searchResults.style.display);
      console.log('Search: After timeout - entriesContainer display:', Elements.entriesContainer.style.display);
      console.log('Search: After timeout - searchResults visible:', Elements.searchResults.offsetParent !== null);
    }, 100);
    
    this.setupResultEventListeners();
  },
  
  createResultHTML(result, query) {
    const fullText = result.text;
    const timestamp = Utils.formatTimestamp(result.timestamp);
    
    // Debug: Log the result object to see what properties it has
    console.log('Search: Creating result HTML for:', {
      id: result.id,
      title: result.title,
      similarity: result.similarity,
      searchType: result.searchType,
      hasSimilarity: !!result.similarity
    });
    
    // Add similarity score if available
    const similarityBadge = result.similarity ? `
      <div class="similarity-badge ${result.searchType || 'keyword'}">
        <span class="similarity-score">${(result.similarity * 100).toFixed(0)}%</span>
        <span class="search-type">${result.searchType === 'semantic' ? '🤖' : '📝'}</span>
      </div>
    ` : '';
    
    // Extract author from URL or use a default
    const url = result.url || '';
    const author = url.includes('paulgraham.com') ? 'Paul Graham' : 
                   url.includes('samaltman.com') ? 'Sam Altman' : 
                   'Unknown Author';
    
    return `
      <div class="search-result" data-entry-id="${result.id}">
        <div class="result-header">
          <h4>${Utils.escapeHtml(result.title)}</h4>
          <div class="result-meta">
            <span class="author">${author}</span>
            <span class="timestamp">${timestamp}</span>
            ${similarityBadge}
          </div>
        </div>
        <div class="result-actions">
          <button class="btn-view-full" data-action="view-full" data-entry-id="${result.id}">View Full Text</button>
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
      } else if (action === 'view-full') {
        this.viewFullText(entryId);
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
    
    // Also try again after a short delay to ensure DOM is ready
    setTimeout(addButtonListeners, 100);
    
    // Selection listeners
    Elements.selectAllHome?.addEventListener('click', () => Data.selectHomeArticlesBulk('all'));
    Elements.selectNoneHome?.addEventListener('click', () => Data.selectHomeArticlesBulk('none'));

    
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
    
    // Debug
    Elements.testSidePanelBtn?.addEventListener('click', async () => {
      console.log('Testing side panel from popup...');
      try {
        await chrome.runtime.sendMessage({ action: 'testSidePanel' });
        Utils.showNotification('Side panel test initiated. Check console for results.', 'info');
      } catch (error) {
        console.error('Failed to test side panel:', error);
        Utils.showNotification('Failed to test side panel', 'error');
      }
    });

    Elements.inspectNotebookLMBtn?.addEventListener('click', async () => {
      console.log('Inspecting NotebookLM page from popup...');
      try {
        // First, open the NotebookLM page
        const url = 'https://notebooklm.google.com/u/0/notebook/1f0075d4-a616-4258-87f7-3c62674d0ac4';
        const { id: tabId } = await chrome.tabs.create({ url });
        
        // Wait for the page to load and then send inspection message
        chrome.tabs.onUpdated.addListener(function listener(tId, info) {
          if (tId === tabId && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, {
                type: "INSPECT_PAGE"
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('NotebookLM: Inspection failed:', chrome.runtime.lastError.message);
                  Utils.showNotification('Inspection failed: ' + chrome.runtime.lastError.message, 'error');
                } else {
                  console.log('NotebookLM: Inspection response:', response);
                  Utils.showNotification('Page inspection completed. Check console for details.', 'success');
                }
              });
            }, 2000);
          }
        });
      } catch (error) {
        console.error('NotebookLM: Inspection failed:', error);
        Utils.showNotification('Inspection failed: ' + error.message, 'error');
      }
    });



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
    
    // Update export section visibility
    if (Elements.exportSection) {
      Utils.showElement(Elements.exportSection, selectedCount > 0);
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
    // This function is now deprecated since we use local AI search
    // Keeping for compatibility but not using API keys anymore
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

// === NOTEBOOKLM CONTENT SCRIPT AUTOMATION ===
// The extension uses content script automation to interact with NotebookLM
// This approach injects scripts into the NotebookLM page to automate the UI

// === NOTEBOOKLM OBJECT (Content Script Automation) ===
const NotebookLM = {
  // State
  notebooks: [],
  sources: [],
  selectedNotebookId: '',

  // UI Elements
  get exportToNotebookLMBtn() { return Elements.exportToNotebookLM; },

  // State
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





  // Export handler - uses content script automation
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
      // Get selected articles from the main search tab
      const selectedEntryIds = Array.from(AppState.homeSelectedArticles);
      console.log('NotebookLM: Selected entry IDs:', selectedEntryIds);
      
      if (!selectedEntryIds || selectedEntryIds.length === 0) {
        console.log('NotebookLM: No entries selected');
        Utils.showNotification('Please select at least one article to export', 'error');
        return;
      }
      
      // Use the hardcoded notebook ID for automation
      const notebookId = '1f0075d4-a616-4258-87f7-3c62674d0ac4';
      console.log('NotebookLM: Using notebook ID:', notebookId);
      
      // Use the automation approach
      console.log('NotebookLM: Using automation for notebook');
      try {
        const articles = selectedEntryIds.map(id => this.getEntryById(id)).filter(Boolean);
        console.log('NotebookLM: Articles to send:', articles);
        
        await chrome.runtime.sendMessage({
          action: 'addArticlesToNotebookLM',
          notebookId: notebookId,
          articles: articles
        });
        console.log('NotebookLM: Message sent successfully');
        Utils.showNotification(`Starting to add ${selectedEntryIds.length} articles to NotebookLM...`, 'success');
      } catch (error) {
        console.error('Failed to add articles to NotebookLM:', error);
        Utils.showNotification('Failed to add articles to NotebookLM', 'error');
      }
    } catch (error) {
      console.error('NotebookLM: Error in performExport:', error);
    } finally {
      this.isButtonActionRunning = false;
      console.log('NotebookLM: Set isButtonActionRunning to false');
    }
  },





  // Flag to prevent multiple simultaneous button clicks
  isButtonActionRunning: false,




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
      Search.restoreState()
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
    
    // Setup event listeners and scroll expansion
    Data.setupEntryEventListeners();
    Data.setupScrollExpansion();
    
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

 