// Popup script for SmartGrab AI Search Extension
console.log('SmartGrab AI Search - Popup script starting...');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('📄 DOM loaded, initializing...');
  
  // Search tab elements

  const clearBtn = document.getElementById('clearBtn');
  const entriesContainer = document.getElementById('entries');
  const emptyState = document.getElementById('emptyState');
  const noResults = document.getElementById('noResults');
  const stats = document.getElementById('stats');
  const entryCount = document.getElementById('entryCount');
  const totalWords = document.getElementById('totalWords');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const searchResults = document.getElementById('searchResults');
  const resultCount = document.getElementById('resultCount');
  const searchTerm = document.getElementById('searchTerm');
  const loadingIndicator = document.getElementById('loadingIndicator');
  
  // Settings tab elements
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  const apiStatus = document.getElementById('apiStatus');
  const apiStatusIndicator = document.getElementById('apiStatusIndicator');
  const apiStatusText = document.getElementById('apiStatusText');
  const dbStats = document.getElementById('dbStats');
  const modelInfo = document.getElementById('modelInfo');
  const exportBtn = document.getElementById('exportBtn');
  const generateEmbeddingsBtn = document.getElementById('generateEmbeddingsBtn');
  
  // Setup note elements
  const setupNote = document.getElementById('setupNote');
  const dismissSetupNote = document.getElementById('dismissSetupNote');
  
  // Tab system
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const searchOptions = document.querySelectorAll('.search-option');
  
  // Filter elements
  const toggleFilters = document.getElementById('toggleFilters');
  const searchFilters = document.getElementById('searchFilters');
  const timeFilter = document.getElementById('timeFilter');
  const resultsFilter = document.getElementById('resultsFilter');
  const advancedFilter = document.getElementById('advancedFilter');
  const customDateRange = document.getElementById('customDateRange');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const applyFilters = document.getElementById('applyFilters');
  const resetFilters = document.getElementById('resetFilters');
  const activeFilters = document.getElementById('activeFilters');
  
  // Advanced search elements
  const advancedSearch = document.getElementById('advancedSearch');
  const allWords = document.getElementById('allWords');
  const exactPhrase = document.getElementById('exactPhrase');
  const anyWords = document.getElementById('anyWords');
  const noneWords = document.getElementById('noneWords');
  
  // State variables
  let allEntries = [];
  let currentSearch = '';
  let currentSearchMode = 'semantic'; // 'keyword' or 'semantic'
  let isSearching = false;
  let lastSearchResults = [];
  let searchFilterState = {
    timeFilter: 'any',
    resultsFilter: 'any',
    advancedFilter: 'off',
    dateFrom: '',
    dateTo: '',
    isActive: false
  };
  
  // User preferences
  let userAnswerContentHeight = 200; // Default height for answer content blocks
  
  // Initialize
  await loadEntries();
  await loadStats();
  await loadApiKeyStatus();
  await restoreSearchState();
  await loadSetupNoteVisibility();
  
  // Clear any lingering error states on popup open
  await clearErrorStatesSilently();
  
  // Setup scroll-based expansion after entries are loaded
  setupScrollBasedExpansion();
  
  // Also setup after a delay to ensure DOM is ready
  setTimeout(() => {
    console.log('⏰ Setting up scroll expansion with delay...');
    setupScrollBasedExpansion();
  }, 1000);
  
  // Global keyboard shortcut for clearing error states
  document.addEventListener('keydown', async (e) => {
    // Keyboard shortcut to clear error states: Ctrl+Shift+E
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      await clearErrorStates();
    }
  });
  
  // Ensure correct filter visibility on startup
  updateSearchOptions();
  
  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      switchTab(targetTab);
    });
  });
  
  // Search mode switching
  searchOptions.forEach(option => {
    option.addEventListener('click', async () => {
      currentSearchMode = option.dataset.mode;
      updateSearchOptions();
      
      // Save the new search mode
      await saveSearchState();
      
      // Re-run search if there's an active query
      if (currentSearch) {
        if (currentSearchMode === 'keyword') {
          await performSearch(currentSearch);
        } else {
          // For semantic mode, just show the prompt
          displaySemanticPrompt(currentSearch);
          await saveSearchState();
        }
      }
    });
  });
  
  // Search tab event listeners
  if (clearBtn) {
    clearBtn.addEventListener('click', clearAllEntries);
  }
  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keydown', handleSearchKeydown);
  }
  if (searchClear) {
    searchClear.addEventListener('click', clearSearch);
  }
  
  // Settings tab event listeners
  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', saveApiKey);
  }
  if (exportBtn) {
    exportBtn.addEventListener('click', exportData);
  }
  if (generateEmbeddingsBtn) {
    generateEmbeddingsBtn.addEventListener('click', generateEmbeddings);
  }
  
  // Clear error states button
  const clearErrorStatesBtn = document.getElementById('clearErrorStatesBtn');
  if (clearErrorStatesBtn) {
    clearErrorStatesBtn.addEventListener('click', clearErrorStates);
  }
  
  // Setup note event listener
  if (dismissSetupNote) {
    dismissSetupNote.addEventListener('click', dismissSetupNoteForever);
  }
  
  // Shortcuts link event listener
  const shortcutsLink = document.getElementById('shortcutsLink');
  if (shortcutsLink) {
    shortcutsLink.addEventListener('click', openShortcutsPage);
  }
  
  // Filter event listeners
  if (toggleFilters) {
    toggleFilters.addEventListener('click', toggleFilterVisibility);
  }
  if (timeFilter) {
    timeFilter.addEventListener('change', handleTimeFilterChange);
  }
  if (resultsFilter) {
    resultsFilter.addEventListener('change', handleResultsFilterChange);
  }
  if (advancedFilter) {
    advancedFilter.addEventListener('change', handleAdvancedFilterChange);
  }
  if (applyFilters) {
    applyFilters.addEventListener('click', applySearchFilters);
  }
  if (resetFilters) {
    resetFilters.addEventListener('click', resetSearchFilters);
  }
  
  // Tab switching function
  function switchTab(tabName) {
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Tab`);
    });
    
    // Load data when switching to settings tab
    if (tabName === 'settings') {
      loadStats();
      loadApiKeyStatus();
    }
  }
  
  // Update search options UI
  function updateSearchOptions() {
    searchOptions.forEach(option => {
      option.classList.toggle('active', option.dataset.mode === currentSearchMode);
    });
    
    // Update placeholder text
    if (searchInput) {
      if (currentSearchMode === 'semantic') {
        searchInput.placeholder = "Ask AI about your saved text...";
      } else {
        searchInput.placeholder = "Search your saved text...";
      }
    }
    
    // Show/hide results filter based on search mode
    // Results filter (verbatim) only applies to keyword search
    if (resultsFilter) {
      const resultsFilterGroup = resultsFilter.closest('.filter-group');
      if (resultsFilterGroup) {
        resultsFilterGroup.style.display = currentSearchMode === 'keyword' ? 'flex' : 'none';
      }
    }
    
    // Show/hide advanced filter based on search mode
    // Advanced filter only applies to keyword search
    if (advancedFilter) {
      const advancedFilterGroup = advancedFilter.closest('.filter-group');
      if (advancedFilterGroup) {
        advancedFilterGroup.style.display = currentSearchMode === 'keyword' ? 'flex' : 'none';
      }
    }
    
    // Reset filters when switching to semantic mode
    if (currentSearchMode === 'semantic') {
      if (searchFilterState.resultsFilter !== 'any') {
        searchFilterState.resultsFilter = 'any';
        if (resultsFilter) {
          resultsFilter.value = 'any';
        }
      }
      if (searchFilterState.advancedFilter !== 'off') {
        searchFilterState.advancedFilter = 'off';
        if (advancedFilter) {
          advancedFilter.value = 'off';
        }
        if (advancedSearch) {
          advancedSearch.style.display = 'none';
        }
      }
      updateActiveFiltersDisplay();
    }
  }
  
  // Function to handle search input (for keyword search and UI updates)
  async function handleSearchInput(e) {
    const query = e.target.value.trim();
    currentSearch = query;
    
    // Show/hide clear button
    if (searchClear) {
      searchClear.style.display = query ? 'block' : 'none';
    }
    
    if (query === '') {
      clearSearch();
      return;
    }
    
    // Only perform automatic search for keyword mode
    if (currentSearchMode === 'keyword') {
      console.log('🔍 handleSearchInput: performing keyword search for:', query);
      await performSearch(query);
    } else {
      // For semantic mode, just show a prompt to press Enter
      displaySemanticPrompt(query);
      // Save state even for prompts
      await saveSearchState();
    }
  }
  
  // Function to display semantic search prompt
  function displaySemanticPrompt(query) {
    if (searchTerm) {
      searchTerm.textContent = query;
    }
    if (searchResults) {
      searchResults.innerHTML = `
        <span id="loadingIndicator" class="loading" style="display: none;"></span>
        🧠 Press <kbd>Enter</kbd> to generate AI-powered answer for "<span id="searchTerm">${query}</span>"
      `;
      searchResults.style.display = 'block';
    }
    if (noResults) {
      noResults.style.display = 'none';
    }
    if (entriesContainer) {
      entriesContainer.innerHTML = ''; // Clear previous results
    }
  }

  // Function to show semantic search loading state
  function showSemanticSearchLoading(query) {
    if (searchTerm) {
      searchTerm.textContent = query;
    }
    if (searchResults) {
      searchResults.innerHTML = `
        <span id="loadingIndicator" class="loading" style="display: inline-block;"></span>
        <span class="semantic-loading">🧠 Generating answer...</span>
      `;
      searchResults.style.display = 'block';
    }
    if (noResults) {
      noResults.style.display = 'none';
    }
    if (entriesContainer) {
      entriesContainer.innerHTML = ''; // Clear previous results
    }
  }
  
  // Function to handle keyboard events
  async function handleSearchKeydown(e) {
    // Handle escape key to clear search
    if (e.key === 'Escape') {
      e.preventDefault();
      clearSearch();
      return;
    }

    // Handle enter key for semantic search
    if (e.key === 'Enter' && currentSearchMode === 'semantic' && currentSearch) {
      e.preventDefault();
      // Use performSearch to correctly handle UI updates
      await performSearch(currentSearch);
    }
  }
  
  // Main search function
  async function performSearch(query) {
    if (isSearching) return; // Prevent multiple simultaneous searches
    
    console.log('🚀 performSearch called with query:', `"${query}"`);
    console.log('🚀 Current search mode:', currentSearchMode);
    console.log('🚀 Current filter state:', searchFilterState);
    
    try {
      isSearching = true;
      
      // Only show generic loading for keyword search - semantic has custom loading
      if (currentSearchMode !== 'semantic') {
        showLoading(true);
      }
      
      let results;
      if (currentSearchMode === 'semantic') {
        console.log('🧠 Calling semantic search...');
        results = await performSemanticSearch(query);
      } else {
        console.log('🔍 Calling keyword search...');
        results = await performKeywordSearch(query);
      }
      
      console.log('📊 Raw search results count:', results.length);
      
      // Store results for persistence
      lastSearchResults = results;
      displaySearchResults(results, query);
      
      // Save search state for persistence
      await saveSearchState();
      
    } catch (error) {
      console.error('Search error:', error);
      lastSearchResults = [];
      displaySearchResults([], query);
      await saveSearchState();
    } finally {
      isSearching = false;
      showLoading(false);
    }
  }
  
  // Keyword search function
  async function performKeywordSearch(query) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'search_keywords',
        query: query
      });
      
      if (response && response.results) {
        let results = response.results || [];
        console.log('🔍 Keyword search raw results:', results.length);
        
        // Apply search filters
        results = applyFiltersToResults(results, query);
        console.log('🔍 Keyword search filtered results:', results.length);
        
        return results;
      } else {
        console.error('Keyword search failed:', response);
        return [];
      }
    } catch (error) {
      console.error('Error performing keyword search:', error);
      return [];
    }
  }
  
  // Semantic search function
  async function performSemanticSearch(query) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'search_similar',
        query: query,
        filters: searchFilterState  // Pass filters to backend
      });
      
      if (response && response.results) {
        let results = response.results || [];
        
        console.log('🧠 SEMANTIC SEARCH DEBUG:');
        console.log('  - Raw results from backend:', results.length);
        console.log('  - Filter state before applying:', searchFilterState);
        console.log('  - Filter is active?', searchFilterState.isActive);
        
        // Apply search filters to semantic results
        results = applyFiltersToResults(results, query);
        
        console.log('  - Results after filters:', results.length);
        
        return results;
      } else {
        console.error('Semantic search failed:', response);
        return [];
      }
    } catch (error) {
      console.error('Error performing semantic search:', error);
      return [];
    }
  }
  
  // Extract relevant context around search terms for keyword search
  function extractRelevantContext(text, searchQuery, maxLength = 800) {
    if (!searchQuery || !text) return text;
    
    const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    const lowerText = text.toLowerCase();
    
    // Find the position of the first search term
    let foundPosition = -1;
    let foundTerm = '';
    
    for (const term of searchTerms) {
      const position = lowerText.indexOf(term);
      if (position !== -1 && (foundPosition === -1 || position < foundPosition)) {
        foundPosition = position;
        foundTerm = term;
      }
    }
    
    // If no terms found, return beginning of text
    if (foundPosition === -1) {
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    // Calculate start position to center the found term in the excerpt
    const halfLength = Math.floor(maxLength / 2);
    let startPos = Math.max(0, foundPosition - halfLength);
    
    // Try to start at word boundary
    if (startPos > 0) {
      const wordBoundary = text.lastIndexOf(' ', foundPosition - 50);
      if (wordBoundary > startPos - 100 && wordBoundary !== -1) {
        startPos = wordBoundary + 1;
      }
    }
    
    // Extract the text segment
    let endPos = Math.min(text.length, startPos + maxLength);
    let excerpt = text.substring(startPos, endPos);
    
    // Try to end at word boundary
    if (endPos < text.length) {
      const lastSpace = excerpt.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.8) {
        excerpt = excerpt.substring(0, lastSpace);
        endPos = startPos + lastSpace;
      }
    }
    
    // Add ellipsis if needed
    let result = '';
    if (startPos > 0) result += '...';
    result += excerpt;
    if (endPos < text.length) result += '...';
    
    return result;
  }

  // Count keyword matches in text
  function countKeywordMatches(text, query) {
    if (!text || !query || query.trim() === '') {
      return 0;
    }
    
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    let totalMatches = 0;
    
    const content = text.toLowerCase();
    
    searchTerms.forEach(term => {
      // Count occurrences of each search term
      const regex = new RegExp(escapeRegExp(term), 'gi');
      const matches = content.match(regex);
      if (matches) {
        totalMatches += matches.length;
      }
    });
    
    return totalMatches;
  }

  // Apply search filters to results
  function applyFiltersToResults(results, query) {
    console.log('🔍 applyFiltersToResults called:');
    console.log('  - Input results count:', results.length);
    console.log('  - Query:', `"${query}"`);
    console.log('  - Current search mode:', currentSearchMode);
    console.log('  - Filter state:', searchFilterState);
    
    let filteredResults = [...results];
    
    // Apply time filter to all search types
    if (searchFilterState.timeFilter !== 'any') {
      console.log('⏰ Applying time filter:', searchFilterState.timeFilter);
      filteredResults = applyTimeFilter(filteredResults);
      console.log('  - After time filter:', filteredResults.length, 'results');
    }
    
    // Apply verbatim filter ONLY to keyword search, not semantic search
    const shouldApplyVerbatim = currentSearchMode === 'keyword' && searchFilterState.resultsFilter === 'verbatim';
    console.log('🎯 Should apply verbatim filter?', shouldApplyVerbatim);
    console.log('  - Search mode is keyword:', currentSearchMode === 'keyword');
    console.log('  - Results filter is verbatim:', searchFilterState.resultsFilter === 'verbatim');
    
    // Apply advanced search filter ONLY to keyword search, not semantic search
    const shouldApplyAdvanced = currentSearchMode === 'keyword' && searchFilterState.advancedFilter === 'on';
    console.log('🔍 Should apply advanced filter?', shouldApplyAdvanced);
    console.log('  - Search mode is keyword:', currentSearchMode === 'keyword');
    console.log('  - Advanced filter is on:', searchFilterState.advancedFilter === 'on');
    
    if (shouldApplyVerbatim) {
      console.log('🎯 APPLYING VERBATIM FILTER');
      filteredResults = applyVerbatimFilter(filteredResults, query);
      console.log('  - After verbatim filter:', filteredResults.length, 'results');
    } else if (shouldApplyAdvanced) {
      console.log('🔍 APPLYING ADVANCED SEARCH FILTER');
      filteredResults = applyAdvancedSearchFilter(filteredResults);
      console.log('  - After advanced filter:', filteredResults.length, 'results');
    } else {
      console.log('🎯 SKIPPING SPECIAL FILTERS');
    }
    
    console.log('🔍 Final filtered results count:', filteredResults.length);
    return filteredResults;
  }
  
  // Apply time-based filtering
  function applyTimeFilter(results) {
    const now = new Date();
    let cutoffDate;
    
    console.log('⏰ TIME FILTER DEBUG:');
    console.log('  - Current time:', now.toISOString());
    console.log('  - Filter type:', searchFilterState.timeFilter);
    console.log('  - Input results count:', results.length);
    
    switch (searchFilterState.timeFilter) {
      case 'hour':
        cutoffDate = new Date(now.getTime() - (60 * 60 * 1000));
        break;
      case 'day':
        cutoffDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        break;
      case 'week':
        cutoffDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case 'month':
        cutoffDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        break;
      case 'year':
        cutoffDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
        break;
      case 'custom':
        if (searchFilterState.dateFrom && searchFilterState.dateTo) {
          const fromDate = new Date(searchFilterState.dateFrom);
          const toDate = new Date(searchFilterState.dateTo);
          toDate.setHours(23, 59, 59, 999); // Include end of day
          
          console.log('  - Custom date range:', fromDate.toISOString(), 'to', toDate.toISOString());
          
          return results.filter(result => {
            const entryDate = new Date(result.timestamp);
            const isInRange = entryDate >= fromDate && entryDate <= toDate;
            console.log('  - Entry:', result.title || 'Untitled', 'Date:', entryDate.toISOString(), 'In range:', isInRange);
            return isInRange;
          });
        }
        return results;
      default:
        return results;
    }
    
    console.log('  - Cutoff date:', cutoffDate.toISOString());
    console.log('  - Checking each entry:');
    
    const filteredResults = results.filter(result => {
      const entryDate = new Date(result.timestamp);
      const isAfterCutoff = entryDate >= cutoffDate;
      const hoursDiff = (now - entryDate) / (1000 * 60 * 60);
      
      console.log(`    - "${result.title || 'Untitled'}": ${entryDate.toISOString()} (${hoursDiff.toFixed(1)} hours ago) → ${isAfterCutoff ? 'KEEP' : 'FILTER OUT'}`);
      
      return isAfterCutoff;
    });
    
    console.log('  - Filtered results count:', filteredResults.length);
    return filteredResults;
  }
  
  // Apply verbatim filtering (exact phrase matching)
  function applyVerbatimFilter(results, query) {
    if (!query || query.trim() === '') {
      console.log('🎯 Verbatim filter: empty query, returning all results');
      return results;
    }
    
    // Clean the query - remove quotes if present and trim
    const exactQuery = query.trim().replace(/^["']|["']$/g, '');
    
    // If query is too short, don't apply verbatim (avoid filtering single characters)
    if (exactQuery.length < 2) {
      console.log('🎯 Verbatim filter: query too short, returning all results');
      return results;
    }
    
    console.log('🎯 Applying verbatim filter for:', `"${exactQuery}"`);
    console.log('🎯 Input results count:', results.length);
    
    const filteredResults = results.filter(result => {
      const title = (result.title || '').toLowerCase();
      const text = (result.text || '').toLowerCase();
      const url = (result.url || '').toLowerCase();
      const queryLower = exactQuery.toLowerCase();
      
      // Simple exact phrase matching with word boundaries
      function hasExactPhrase(content, phrase) {
        if (!content || !phrase) return false;
        
        const index = content.indexOf(phrase);
        if (index === -1) return false;
        
        // Check character before the match (if exists)
        const charBefore = index > 0 ? content[index - 1] : '';
        // Check character after the match (if exists)  
        const charAfter = index + phrase.length < content.length ? content[index + phrase.length] : '';
        
        // The phrase is valid if it's bounded by non-alphanumeric characters or string boundaries
        const isValidBefore = charBefore === '' || !(/[a-zA-Z0-9]/.test(charBefore));
        const isValidAfter = charAfter === '' || !(/[a-zA-Z0-9]/.test(charAfter));
        
        return isValidBefore && isValidAfter;
      }
      
      // Check if exact phrase exists in any of the searchable fields
      const foundInTitle = hasExactPhrase(title, queryLower);
      const foundInText = hasExactPhrase(text, queryLower);
      const foundInUrl = hasExactPhrase(url, queryLower);
      
      const hasMatch = foundInTitle || foundInText || foundInUrl;
      
      if (hasMatch) {
        console.log('✅ MATCH:', result.title || 'Untitled');
      }
      
      return hasMatch;
    });
    
    console.log(`🎯 Verbatim filter results: ${results.length} -> ${filteredResults.length}`);
    return filteredResults;
  }

  // Apply advanced search filtering (Google-style)
  function applyAdvancedSearchFilter(results) {
    console.log('🔍 ADVANCED SEARCH FILTER DEBUG:');
    console.log('  - Input results count:', results.length);
    
    // Get the values from advanced search fields
    const allWordsValue = allWords.value.trim();
    const exactPhraseValue = exactPhrase.value.trim();
    const anyWordsValue = anyWords.value.trim();
    const noneWordsValue = noneWords.value.trim();
    
    console.log('  - All words:', `"${allWordsValue}"`);
    console.log('  - Exact phrase:', `"${exactPhraseValue}"`);
    console.log('  - Any words:', `"${anyWordsValue}"`);
    console.log('  - None words:', `"${noneWordsValue}"`);
    
    // If no fields are filled, return all results
    if (!allWordsValue && !exactPhraseValue && !anyWordsValue && !noneWordsValue) {
      console.log('  - No advanced search criteria, returning all results');
      return results;
    }
    
    const filteredResults = results.filter(result => {
      const title = (result.title || '').toLowerCase();
      const text = (result.text || '').toLowerCase();
      const url = (result.url || '').toLowerCase();
      const content = `${title} ${text} ${url}`;
      
      let matches = true;
      
      // All these words (AND logic)
      if (allWordsValue && matches) {
        const words = allWordsValue.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        matches = words.every(word => content.includes(word));
        console.log(`    - All words check (${words.join(', ')}):`, matches);
      }
      
      // Exact phrase
      if (exactPhraseValue && matches) {
        const phrase = exactPhraseValue.toLowerCase().replace(/^["']|["']$/g, '');
        matches = content.includes(phrase);
        console.log(`    - Exact phrase check ("${phrase}"):`, matches);
      }
      
      // Any of these words (OR logic)
      if (anyWordsValue && matches) {
        const words = anyWordsValue.toLowerCase().replace(/\s+OR\s+/gi, ' ').split(/\s+/).filter(w => w.length > 0);
        matches = words.some(word => content.includes(word));
        console.log(`    - Any words check (${words.join(' OR ')}):`, matches);
      }
      
      // None of these words (NOT logic)
      if (noneWordsValue && matches) {
        const excludeTerms = parseExcludeTerms(noneWordsValue.toLowerCase());
        
        // Check if content contains any excluded terms (words or phrases)
        matches = !excludeTerms.some(term => {
          const found = content.includes(term);
          if (found) {
            console.log(`      - Found excluded term "${term}" in content`);
          }
          return found;
        });
        
        console.log(`    - None words/phrases check (exclude: ${excludeTerms.join(', ')}):`, matches);
      }
      
      if (matches) {
        console.log(`✅ MATCH: "${result.title || 'Untitled'}"`);
      }
      
      return matches;
    });
    
    console.log(`🔍 Advanced search results: ${results.length} -> ${filteredResults.length}`);
    return filteredResults;
  }

  // Helper function to parse exclude terms (supports both words and quoted phrases)
  function parseExcludeTerms(input) {
    const terms = [];
    let i = 0;
    
    while (i < input.length) {
      // Skip whitespace
      while (i < input.length && /\s/.test(input[i])) i++;
      if (i >= input.length) break;
      
      // Check for minus sign
      let hasMinus = false;
      if (input[i] === '-') {
        hasMinus = true;
        i++;
      }
      
      // Skip whitespace after minus
      while (i < input.length && /\s/.test(input[i])) i++;
      if (i >= input.length) break;
      
      let term = '';
      
      // Check for quoted phrase
      if (input[i] === '"' || input[i] === "'") {
        const quote = input[i];
        i++; // Skip opening quote
        
        // Extract everything until closing quote
        while (i < input.length && input[i] !== quote) {
          term += input[i];
          i++;
        }
        
        if (i < input.length) i++; // Skip closing quote
      } else {
        // Extract single word
        while (i < input.length && !/\s/.test(input[i])) {
          term += input[i];
          i++;
        }
      }
      
      if (term.length > 0) {
        terms.push(term);
      }
    }
    
    console.log(`    - Parsed exclude terms from "${input}":`, terms);
    return terms;
  }
  

  
  // Function to show/hide loading indicator
  function showLoading(show) {
    loadingIndicator.style.display = show ? 'inline-block' : 'none';
  }
  
  // Function to clear search
  function clearSearch() {
    searchInput.value = '';
    currentSearch = '';
    lastSearchResults = [];
    searchClear.style.display = 'none';
    searchResults.style.display = 'none';
    noResults.style.display = 'none';
    showLoading(false);
    displayEntries(allEntries);
    
    // Reset search filters
    resetSearchFilters();
    
    // Hide filters panel
    searchFilters.style.display = 'none';
    toggleFilters.classList.remove('active');
    
    // Clear saved search state
    saveSearchState();
  }
  
  // Function to save search state to storage
  async function saveSearchState() {
    try {
      const searchState = {
        query: currentSearch,
        mode: currentSearchMode,
        results: lastSearchResults,
        filters: searchFilterState,
        timestamp: Date.now()
      };
      
      await chrome.storage.local.set({ searchState });
      console.log('💾 Search state saved');
    } catch (error) {
      console.error('❌ Error saving search state:', error);
    }
  }
  
  // Function to restore search state from storage
  async function restoreSearchState() {
    try {
      const result = await chrome.storage.local.get(['searchState']);
      const searchState = result.searchState;
      
      if (searchState && searchState.query) {
        // Don't restore very old search states (older than 24 hours)
        const hoursSinceSearch = (Date.now() - searchState.timestamp) / (1000 * 60 * 60);
        if (hoursSinceSearch > 24) {
          console.log('🕒 Search state too old, not restoring');
          return;
        }
        
        console.log('🔄 Restoring search state:', searchState);
        
        // Restore search mode
        currentSearchMode = searchState.mode || 'keyword';
        updateSearchOptions();
        
        // Restore search query
        currentSearch = searchState.query;
        searchInput.value = currentSearch;
        
        // Restore filter state
        if (searchState.filters) {
          searchFilterState = { ...searchFilterState, ...searchState.filters };
          
          // Update filter UI
          timeFilter.value = searchFilterState.timeFilter;
          resultsFilter.value = searchFilterState.resultsFilter;
          dateFrom.value = searchFilterState.dateFrom;
          dateTo.value = searchFilterState.dateTo;
          
          // Show custom date range if needed
          customDateRange.style.display = searchFilterState.timeFilter === 'custom' ? 'block' : 'none';
          
          // Update active filters display
          updateActiveFiltersDisplay();
          
          // Show filters if they were active
          if (searchFilterState.isActive) {
            searchFilters.style.display = 'block';
            toggleFilters.classList.add('active');
          }
        }
        
        // Restore search results
        if (searchState.results && searchState.results.length > 0) {
          lastSearchResults = searchState.results;
          displaySearchResults(lastSearchResults, currentSearch);
        } else if (currentSearchMode === 'semantic') {
          displaySemanticPrompt(currentSearch);
        }
        
        // Show clear button
        searchClear.style.display = currentSearch ? 'block' : 'none';
        
        console.log('✅ Search state restored');
      }
    } catch (error) {
      console.error('❌ Error restoring search state:', error);
    }
  }
  
  // Function to display search results
  function displaySearchResults(results, query) {
    searchTerm.textContent = query;
    resultCount.textContent = results.length;
    
    // Show different messages for different search modes
    if (currentSearchMode === 'semantic') {
      const hasAnswers = results.some(r => r.isSemanticAnswer);
      const hasAIAnswers = results.some(r => r.generatedByAI);
      
      if (hasAnswers && hasAIAnswers) {
        searchResults.innerHTML = `
          <span id="loadingIndicator" class="loading" style="display: none;"></span>
          🤖 GPT-4 answer for your query
        `;
      } else if (hasAnswers) {
        searchResults.innerHTML = `
          <span id="loadingIndicator" class="loading" style="display: none;"></span>
          🧠 Found <span id="resultCount">${results.length}</span> intelligent answer${results.length > 1 ? 's' : ''} for "<span id="searchTerm">${query}</span>"
        `;
      } else {
        searchResults.innerHTML = `
          <span id="loadingIndicator" class="loading" style="display: none;"></span>
          🧠 Found <span id="resultCount">${results.length}</span> semantically related result${results.length > 1 ? 's' : ''} for "<span id="searchTerm">${query}</span>"
        `;
      }
    } else {
      searchResults.innerHTML = `
        <span id="loadingIndicator" class="loading" style="display: none;"></span>
        📝 Found <span id="resultCount">${results.length}</span> document${results.length > 1 ? 's' : ''} containing "<span id="searchTerm">${query}</span>"
      `;
    }
    
    searchResults.style.display = 'block';
    
    if (results.length === 0) {
      entriesContainer.innerHTML = '';
      emptyState.style.display = 'none';
      
      // Different no-results messages for different modes
      if (currentSearchMode === 'semantic') {
        noResults.innerHTML = `
          <p>🧠 No semantically relevant content found</p>
          <p>Try rephrasing your question or switching to keyword search</p>
          <p><small>💡 Add an OpenAI API key in Settings for AI-powered answers</small></p>
        `;
      } else {
        noResults.innerHTML = `
          <p>🔍 No keyword matches found</p>
          <p>Try different keywords or check your spelling</p>
        `;
      }
      
      noResults.style.display = 'block';
      stats.style.display = 'none';
    } else {
      noResults.style.display = 'none';
      displayEntries(results, query);
    }
  }
  
  // Function to load and display entries
  async function loadEntries() {
    try {
      console.log('📚 Loading entries...');
      
      // DEBUG: Check chrome.storage directly
      console.log('🔍 DEBUG: Checking chrome.storage directly...');
      const storageResult = await chrome.storage.local.get(['textEntries']);
      console.log('🔍 DEBUG: Direct chrome.storage content:', storageResult);
      console.log('🔍 DEBUG: Number of entries in storage:', (storageResult.textEntries || []).length);
      
      const response = await chrome.runtime.sendMessage({ action: 'get_entries' });
      
      if (response && response.entries) {
        allEntries = response.entries;
        console.log(`📄 Loaded ${allEntries.length} entries`);
        
        if (currentSearch) {
          handleSearchInput({ target: { value: currentSearch } });
        } else {
          displayEntries(allEntries);
        }
      } else {
        console.log('No entries found or error:', response);
        allEntries = [];
        displayEntries([]);
      }
      
    } catch (error) {
      console.error('❌ Error loading entries:', error);
      allEntries = [];
      displayEntries([]);
    }
  }
  
  // Function to load database statistics
  async function loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'get_stats' });
      
      if (response && response.stats) {
        const { totalEntries, totalWords: wordCount, embeddingCoverage, modelInfo: modelData } = response.stats;
        
        // Update search tab stats
        if (entryCount) {
          entryCount.textContent = totalEntries || 0;
        }
        if (totalWords) {
          totalWords.textContent = wordCount || 0;
        }
        
        console.log('📊 Stats loaded:', response.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }
  
  // Function to load API key status
  async function loadApiKeyStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'get_stats' });
      
      if (response && response.stats && response.stats.modelInfo) {
        const { hasApiKey, provider } = response.stats.modelInfo;
        
        if (hasApiKey) {
          if (apiStatusIndicator) {
            apiStatusIndicator.textContent = '🟢';
          }
          if (apiStatusText) {
            apiStatusText.textContent = `${provider} API connected`;
          }
        } else {
          if (apiStatusIndicator) {
            apiStatusIndicator.textContent = '⚪';
          }
          if (apiStatusText) {
            apiStatusText.textContent = 'Using fallback search';
          }
        }
      }
    } catch (error) {
      console.error('Error loading API key status:', error);
    }
  }
  
  // Function to save API key
  async function saveApiKey() {
    if (!apiKeyInput) {
      alert('API key input not found');
      return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      alert('Please enter an API key');
      return;
    }
    
    try {
      if (saveApiKeyBtn) {
        saveApiKeyBtn.disabled = true;
        saveApiKeyBtn.textContent = 'Saving...';
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'set_api_key',
        apiKey: apiKey
      });
      
      if (response && response.success) {
        apiKeyInput.value = '';
        await loadApiKeyStatus();
        
        // Check if we should offer regeneration of existing embeddings
        if (response.offerRegeneration && response.fallbackCount > 0) {
          showRegenerationOffer(response.fallbackCount);
        } else {
          alert('API key saved successfully!');
        }
      } else {
        alert('Failed to save API key: ' + (response.error || 'Unknown error'));
      }
      
    } catch (error) {
      console.error('Error saving API key:', error);
      alert('Error saving API key: ' + error.message);
    } finally {
      if (saveApiKeyBtn) {
        saveApiKeyBtn.disabled = false;
        saveApiKeyBtn.textContent = 'Save API Key';
      }
    }
  }
  
  // Function to export data
  async function exportData() {
    try {
      exportBtn.disabled = true;
      exportBtn.textContent = 'Exporting...';
      
      const response = await chrome.runtime.sendMessage({ action: 'get_entries' });
      
      if (response && response.entries) {
        const dataStr = JSON.stringify(response.entries, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `text-grabber-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        alert(`Exported ${response.entries.length} entries successfully!`);
      } else {
        alert('No data to export');
      }
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed: ' + error.message);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = '📤 Export Data';
    }
  }
  
  // Function to show regeneration offer
  function showRegenerationOffer(fallbackCount) {
    const message = `🎉 API key saved successfully!\n\n` +
      `Found ${fallbackCount} articles using basic similarity search. ` +
      `Would you like to regenerate embeddings using OpenAI's text-embedding-3-small model?\n\n` +
      `This will:\n` +
      `• Enable semantic search\n` +
      `• Improve search quality\n` +
      `• Take a few minutes\n` +
      `• Use API credits\n\n` +
      `Regenerate embeddings now?`;
    
    if (confirm(message)) {
      regenerateEmbeddings();
    }
  }
  
  // Function to regenerate all embeddings with OpenAI
  async function regenerateEmbeddings() {
    try {
      // Create a temporary status element
      const statusDiv = document.createElement('div');
      statusDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(102, 126, 234, 0.95);
        color: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        z-index: 10000;
        font-size: 14px;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      statusDiv.innerHTML = `
        <div style="margin-bottom: 10px;">🧠 Generating embeddings...</div>
        <div style="font-size: 12px; opacity: 0.9;">
          Generating embeddings using OpenAI's text-embedding-3-small model. 
          This may take a while. Once complete, it will enable semantic search.
        </div>
      `;
      document.body.appendChild(statusDiv);
      
      console.log('🔄 Starting embedding regeneration...');
      
      const response = await chrome.runtime.sendMessage({ 
        action: 'regenerate_embeddings' 
      });
      
      document.body.removeChild(statusDiv);
      
      if (response && response.success) {
        alert(`✅ Successfully regenerated ${response.regenerated} embeddings!\n\n` +
              `${response.count} total embeddings processed. Semantic search is now enabled.`);
        await loadStats(); // Refresh stats
      } else {
        alert(`❌ Failed to regenerate embeddings: ${response.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Regenerate embeddings error:', error);
      alert('Failed to regenerate embeddings: ' + error.message);
    }
  }

  // Function to generate embeddings
  async function generateEmbeddings() {
    try {
      if (generateEmbeddingsBtn) {
        generateEmbeddingsBtn.disabled = true;
        generateEmbeddingsBtn.textContent = 'Generating...';
      }
      
      const response = await chrome.runtime.sendMessage({ 
        action: 'generate_embeddings' 
      });
      
      if (response && response.success) {
        alert(`✅ Successfully generated ${response.count} embeddings!`);
        await loadStats(); // Refresh stats
      } else {
        alert(`❌ Failed to generate embeddings: ${response.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Failed to generate embeddings:', error);
      alert('Failed to generate embeddings: ' + error.message);
    } finally {
      if (generateEmbeddingsBtn) {
        generateEmbeddingsBtn.disabled = false;
        generateEmbeddingsBtn.textContent = 'Generate Embeddings';
      }
    }
  }
  
  // Function to clear error states
  async function clearErrorStates() {
    try {
      const clearErrorStatesBtn = document.getElementById('clearErrorStatesBtn');
      if (clearErrorStatesBtn) {
        clearErrorStatesBtn.disabled = true;
        clearErrorStatesBtn.textContent = 'Clearing...';
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'clear_error_states'
      });
      
      if (response && response.success) {
        alert('✅ Error states cleared successfully!');
        
        // Clear any visible error states in the UI
        if (searchResults) {
          searchResults.style.display = 'none';
        }
        if (noResults) {
          noResults.style.display = 'none';
        }
        if (entriesContainer) {
          entriesContainer.innerHTML = '';
        }
        
        // Reset search state
        currentSearch = '';
        lastSearchResults = [];
        if (searchInput) {
          searchInput.value = '';
        }
        
        // Reload entries to show fresh state
        await loadEntries();
        
      } else {
        alert(`❌ Failed to clear error states: ${response.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Error clearing error states:', error);
      alert('Error clearing error states: ' + error.message);
    } finally {
      const clearErrorStatesBtn = document.getElementById('clearErrorStatesBtn');
      if (clearErrorStatesBtn) {
        clearErrorStatesBtn.disabled = false;
        clearErrorStatesBtn.textContent = '🧹 Clear Error States';
      }
    }
  }
  
  // Function to display entries in the popup
  function displayEntries(entries, searchQuery = '') {
    entriesContainer.innerHTML = '';
    
    if (entries.length === 0 && !searchQuery) {
      emptyState.style.display = 'block';
      stats.style.display = 'none';
      return;
    }
    
    emptyState.style.display = 'none';
    
    if (!searchQuery) {
      stats.style.display = 'block';
    } else {
      stats.style.display = 'none';
    }
    
    entries.forEach(entry => {
      const entryElement = createEntryElement(entry, searchQuery);
      entriesContainer.appendChild(entryElement);
    });
    
    // Setup scroll-based expansion after entries are displayed
    setTimeout(() => {
      console.log('📚 Setting up scroll expansion after displayEntries...');
      setupScrollBasedExpansion();
    }, 100);
  }
  
  // Function to create an entry element
  function createEntryElement(entry, searchQuery = '') {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'entry';
    
    // Check if this is a cohesive semantic answer
    if (entry.isCohesiveAnswer) {
      return createCohesiveAnswerElement(entry, searchQuery);
    }
    
    // Add search result styling for regular entries
    if (searchQuery) {
      if (currentSearchMode === 'semantic') {
        entryDiv.classList.add('semantic-result');
      } else {
        entryDiv.classList.add('search-result');
      }
    }
    
    const date = new Date(entry.timestamp);
    const dateTimeString = date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    // Extract hostname from URL
    const urlObj = new URL(entry.url);
    const hostname = urlObj.hostname.replace('www.', '');
    
    // Combine title with hostname
    const displayTitle = `${entry.title} - ${hostname}`;
    
    // Highlight search terms (only for keyword search)
    const highlightedTitle = (searchQuery && currentSearchMode === 'keyword') ? 
      highlightSearchTerms(displayTitle, searchQuery) : escapeHtml(displayTitle);
    
    // Create the score display for semantic results and match count for keyword search
    let scoreDisplay = '';
    let matchCount = '';
    if (currentSearchMode === 'semantic' && entry.answerScore !== undefined) {
      const scorePercentage = Math.round(entry.answerScore * 100);
      scoreDisplay = `<div class="answer-score">📊 Answer Score: ${scorePercentage}%</div>`;
    } else if (entry.similarity && currentSearchMode === 'semantic') {
      const simPercentage = Math.round(entry.similarity * 100);
      scoreDisplay = `<div class="similarity-score">${simPercentage}% similar</div>`;
    } else if (currentSearchMode === 'keyword' && searchQuery) {
      // Count matches for keyword search
      const totalMatches = countKeywordMatches(entry.title + ' ' + entry.text, searchQuery);
      if (totalMatches > 0) {
        matchCount = `<span class="match-count">🔍 ${totalMatches} match${totalMatches > 1 ? 'es' : ''}</span>`;
      }
    }
    
    entryDiv.innerHTML = `
      <div class="entry-header">
        <a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer" class="entry-title">
          ${highlightedTitle}
        </a>
      </div>
        <div class="entry-meta">
        <span class="date-time">${dateTimeString}</span>
        ${matchCount}
          ${scoreDisplay}
        <button class="view-full-btn" data-entry-id="${entry.id}">View Full Text</button>
        </div>
    `;
    
    // Add click handler for "View Full Text" button
    const viewFullBtn = entryDiv.querySelector('.view-full-btn');
    if (viewFullBtn) {
      viewFullBtn.addEventListener('click', (e) => {
        showFullTextModal(entry, searchQuery);
      });
    }
    
    return entryDiv;
  }
  
  // Create a cohesive answer element with bullet points and references
  function createCohesiveAnswerElement(entry, searchQuery = '') {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'entry cohesive-answer';
    entryDiv.setAttribute('data-entry-id', entry.id);
    
    // Add AI-generated indicator
    const aiIndicator = entry.generatedByAI ? 
      '<div class="ai-generated-indicator">🤖 AI-Generated Response using GPT-4</div>' : 
      '<div class="rule-based-indicator">📋 Rule-Based Response</div>';
    
    // Bullet points: no indent, add line space between
    const bulletPointsHtml = entry.cohesiveAnswer.map(bulletPoint => {
      return `<li class="bullet-point no-indent">${bulletPoint}</li>`;
    }).join('<div class="bullet-space"></div>');
    
    console.log('🔍 Creating cohesive answer element for entry:', entry.id);
    console.log('📋 Bullet points HTML:', bulletPointsHtml);
    console.log('📊 Number of bullet points:', entry.cohesiveAnswer.length);
    
    entryDiv.innerHTML = `
      <div class="cohesive-answer-header">
        <h3 class="answer-title">🧠 ${entry.title}</h3>
        <div class="answer-meta">
          ${entry.references.length} reference${entry.references.length > 1 ? 's' : ''}
        </div>
      </div>
      
      ${aiIndicator}
      
      <div class="answer-content">
        <ul class="bullet-points">
          ${bulletPointsHtml}
        </ul>
      </div>
      
      <div class="references-section">
        <button class="show-references-btn" data-entry-id="${entry.id}">
          📚 Show References (${entry.references.length})
        </button>
        <div class="references-container" id="references-${entry.id}" style="display: none;">
          <div class="references-list">
            ${entry.references.map(ref => `
              <div class="reference-item" id="ref-${ref.id}">
                <div class="reference-number clickable" title="Click to jump back to reference in text" id="ref-number-${ref.id}">[${ref.id}]</div>
                <div class="reference-content">
                  <div class="reference-text">"${escapeHtml(ref.text)}"</div>
                  <div class="reference-source">
                    <a href="${escapeHtml(ref.sourceUrl)}" target="_blank" class="reference-title-link"><strong>${escapeHtml(ref.sourceTitle)}</strong></a>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="references-drag-handle" title="📏 Drag to resize references">
            <span class="drag-icon">⣿</span>
          </div>
        </div>
      </div>
    `;
    
        // Add click handler for show references button
    const showReferencesBtn = entryDiv.querySelector('.show-references-btn');
    if (showReferencesBtn) {
      showReferencesBtn.addEventListener('click', () => {
        toggleReferences(entry.id);
      });
    }

    // Add click handlers for reference links (AI-generated responses have embedded links)
    const referenceLinks = entryDiv.querySelectorAll('.reference-link');
    console.log(`🔗 Setting up ${referenceLinks.length} reference link click handlers for entry ${entry.id}`);
    referenceLinks.forEach(link => {
      console.log(`   • Setting up click handler for ${link.id} (refId: ${link.dataset.refId})`);
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const refId = link.dataset.refId;
        console.log(`🔗 Reference link clicked: ${link.id} -> refId: ${refId}`);
        showReferenceDetails(refId, entry.references);
      });
    });

    // Add click handlers for reference numbers in references section (jump back to bullet points)
    const referenceNumbers = entryDiv.querySelectorAll('.reference-number');
    referenceNumbers.forEach(refNumber => {
      refNumber.addEventListener('click', (e) => {
        e.preventDefault();
        // Extract the reference ID from the text [1], [2], etc.
        const refText = refNumber.textContent.trim();
        const refId = refText.match(/\[(\d+)\]/);
        if (refId) {
          jumpToReferenceInAnswer(refId[1], entry.id);
        }
      });
    });

    // Setup auto-sizing for answer content
    const answerContent = entryDiv.querySelector('.answer-content');
    if (answerContent) {
      console.log('🎯 Setting up auto-sizing for answer content');
      // Start with auto height to fit content
      answerContent.style.height = 'auto';
      // Check if content needs scrolling, if so apply minimum scrollable height
      setTimeout(() => {
        const contentHeight = answerContent.scrollHeight;
        const containerHeight = answerContent.clientHeight;
        if (contentHeight > containerHeight && contentHeight > 150) {
          // Content is larger than container, set a reasonable height
          const optimalHeight = Math.min(contentHeight + 16, 400); // +16 for padding
          answerContent.style.height = optimalHeight + 'px';
        }
      }, 100);
    }

    // Setup references drag handle
    const referencesDragHandle = entryDiv.querySelector('.references-drag-handle');
    const referencesContainer = entryDiv.querySelector('.references-container');
    if (referencesDragHandle && referencesContainer) {
      console.log('🎯 Setting up references drag handle for entry', entry.id);
      setupDragHandleResize(referencesDragHandle, referencesContainer);
      // Apply default height for references container
      referencesContainer.style.height = '200px';
    }

    return entryDiv;
  }
  
  // Function to toggle entry text expansion
  function toggleEntryText(textId, button, fullText, truncatedText, searchQuery = '') {
    const textDiv = document.getElementById(textId);
    const isExpanded = textDiv.classList.contains('expanded');
    
    if (isExpanded) {
      const highlightedText = searchQuery ? 
        highlightSearchTerms(truncatedText, searchQuery) : escapeHtml(truncatedText);
      textDiv.innerHTML = highlightedText;
      textDiv.classList.remove('expanded');
                      button.textContent = 'View Full Text';
    } else {
      const highlightedText = searchQuery ? 
        highlightSearchTerms(fullText, searchQuery) : escapeHtml(fullText);
      textDiv.innerHTML = highlightedText;
      textDiv.classList.add('expanded');
      button.textContent = 'Show less';
    }
  }
  
  // Function to clear all entries
  async function clearAllEntries() {
    // Double confirmation for safety
    if (!confirm('⚠️ WARNING: This will permanently delete ALL your saved text entries!\n\nThis action cannot be undone. Are you absolutely sure you want to continue?')) {
      return;
    }
    
    // Second confirmation with different wording
    if (!confirm('This is your final warning. Click OK to permanently delete ALL data, or Cancel to keep your entries safe.')) {
      return;
    }
    
    try {
      clearBtn.disabled = true;
      clearBtn.textContent = 'Clearing...';
      
      const response = await chrome.runtime.sendMessage({ action: 'clear_entries' });
      
      if (response && response.success) {
        allEntries = [];
        currentSearch = '';
        clearSearch();
        await loadStats();
        console.log('✅ All entries cleared');
      } else {
        alert('Failed to clear entries: ' + (response.error || 'Unknown error'));
      }
      
    } catch (error) {
      console.error('❌ Error clearing entries:', error);
      alert('Error clearing entries: ' + error.message);
    } finally {
      clearBtn.disabled = false;
      clearBtn.textContent = '🗑️ Clear All Data';
    }
  }
  
  // Function to highlight search terms in text
  function highlightSearchTerms(text, query) {
    if (!query || !text) return escapeHtml(text);
    
    let highlightedText = escapeHtml(text);
    
    // Check if verbatim filter is active for keyword search
    const isVerbatimMode = currentSearchMode === 'keyword' && searchFilterState.resultsFilter === 'verbatim';
    
    if (isVerbatimMode) {
      // In verbatim mode, highlight the entire phrase as one unit
      const exactQuery = query.trim().replace(/^["']|["']$/g, '');
      console.log('🎨 Highlighting verbatim phrase:', `"${exactQuery}"`);
      
      // Use case-insensitive global regex to highlight the exact phrase
      const regex = new RegExp(`(${escapeRegExp(exactQuery)})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<span class="highlight">$1</span>');
    } else {
      // Normal mode: highlight individual search terms
      console.log('🎨 Highlighting individual words from:', query);
      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
      
      searchTerms.forEach(term => {
        const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<span class="highlight">$1</span>');
      });
    }
    
    return highlightedText;
  }
  
  // Function to highlight semantic answers with special styling for relevant sentences
  function highlightSemanticAnswer(text, relevantSentences, query) {
    if (!text) return '';
    
    let highlightedText = escapeHtml(text);
    
    // Highlight query terms lightly
    if (query) {
      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
      searchTerms.forEach(term => {
        const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<span class="query-term">$1</span>');
      });
    }
    
    // Mark the entire text as a semantic answer for special styling
    return `<div class="semantic-answer-content">${highlightedText}</div>`;
  }
  
  // Function to escape special regex characters
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  // Function to copy text to clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      console.log('📋 Copied to clipboard:', text.substring(0, 50) + '...');
    } catch (error) {
      console.error('❌ Failed to copy to clipboard:', error);
    }
  }
  
  // Function to show temporary visual feedback
  function showTemporaryFeedback(element, message) {
    const originalText = element.textContent;
    element.textContent = message;
    element.style.color = '#4CAF50';
    
    setTimeout(() => {
      element.textContent = originalText;
      element.style.color = '';
    }, 1000);
  }
  
  // Function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Function to extract sentences containing keywords
  function extractRelevantSentences(text, searchQuery, maxSentences = 3) {
    if (!searchQuery || !text) return text;
    
    // Check if verbatim filter is active
    const isVerbatimMode = currentSearchMode === 'keyword' && searchFilterState.resultsFilter === 'verbatim';
    
    console.log('📝 Extracting relevant sentences:', { query: searchQuery, verbatim: isVerbatimMode });
    
    // Split text into sentences using multiple delimiters
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    
    console.log('📝 Total sentences found:', sentences.length);
    
    // Find the sentence that contains the search term
    let targetSentenceIndex = -1;
    
    if (isVerbatimMode) {
      // In verbatim mode, look for the exact phrase
      const exactQuery = searchQuery.trim().replace(/^["']|["']$/g, '').toLowerCase();
      
      targetSentenceIndex = sentences.findIndex(sentence => {
        const lowerSentence = sentence.toLowerCase();
        return lowerSentence.includes(exactQuery);
      });
      
      console.log('📝 Verbatim search for:', exactQuery, 'found at sentence:', targetSentenceIndex);
    } else {
      // In normal mode, look for any search term
      const searchTerms = searchQuery.toLowerCase().split(' ').filter(term => term.length > 0);
      
      targetSentenceIndex = sentences.findIndex(sentence => {
        const lowerSentence = sentence.toLowerCase();
        return searchTerms.some(term => lowerSentence.includes(term));
      });
      
      console.log('📝 Normal search for terms:', searchTerms, 'found at sentence:', targetSentenceIndex);
    }
    
    // If no relevant sentence found, return first part of text
    if (targetSentenceIndex === -1) {
      console.log('📝 No relevant sentences found, returning truncated text');
      return text.substring(0, 300) + (text.length > 300 ? '...' : '');
    }
    
    // Build snippet: target sentence + next sentence (if it exists)
    let snippetParts = [];
    
    // 1. Add the target sentence (the one with the highlight)
    snippetParts.push(sentences[targetSentenceIndex]);
    
    // 2. Add the next sentence if it exists
    const nextSentenceIndex = targetSentenceIndex + 1;
    if (nextSentenceIndex < sentences.length) {
      snippetParts.push(sentences[nextSentenceIndex]);
    }
    
    console.log('📝 Snippet structure:', {
      target: targetSentenceIndex,
      targetSentence: sentences[targetSentenceIndex].substring(0, 50) + '...',
      hasNextSentence: nextSentenceIndex < sentences.length,
      totalParts: snippetParts.length
    });
    
    let result = snippetParts.join(' ');
    
    // Add indicator if there's more content after
    if (nextSentenceIndex < sentences.length - 1) {
      result += ' ...';
    }
    
    // Add additional match count
    if (isVerbatimMode) {
      // For verbatim, count exact phrase matches
      const exactQuery = searchQuery.trim().replace(/^["']|["']$/g, '').toLowerCase();
      const additionalMatches = sentences.filter((sentence, index) => {
        return index !== targetSentenceIndex && sentence.toLowerCase().includes(exactQuery);
      }).length;
      
      if (additionalMatches > 0) {
        result += ` (+${additionalMatches} more exact match${additionalMatches > 1 ? 'es' : ''})`;
      }
    } else {
      // For normal search, count sentences with any search terms
      const searchTerms = searchQuery.toLowerCase().split(' ').filter(term => term.length > 0);
      const additionalMatches = sentences.filter((sentence, index) => {
        if (index === targetSentenceIndex) return false;
        const lowerSentence = sentence.toLowerCase();
        return searchTerms.some(term => lowerSentence.includes(term));
      }).length;
      
      if (additionalMatches > 0) {
        result += ` (+${additionalMatches} more match${additionalMatches > 1 ? 'es' : ''})`;
      }
    }
    
    console.log('📝 Final snippet length:', result.length);
    return result;
  }
  
  // Function to show full text in a modal
  function showFullTextModal(entry, searchQuery = '') {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    `;
    
    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 700px;
      max-height: 80%;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      transform: scale(0.9);
      transition: transform 0.2s ease;
    `;
    
    // Highlight the full text (only for keyword search)
    const highlightedFullText = (searchQuery && currentSearchMode === 'keyword') ? 
      highlightSearchTerms(entry.text, searchQuery) : escapeHtml(entry.text);
    
    const date = new Date(entry.timestamp);
    const dateString = date.toLocaleDateString();
    
    // Add similarity info for semantic search
    const similarityInfo = (entry.similarity && currentSearchMode === 'semantic') ? 
      `<div style="color: #9C27B0; font-size: 11px; margin-top: 4px;">
        🧠 ${Math.round(entry.similarity * 100)}% semantically similar
      </div>` : '';
    
    modal.innerHTML = `
      <div style="padding: 20px; border-bottom: 1px solid #eee; background: #f8f9fa; border-radius: 12px 12px 0 0;">
        <div style="display: flex; justify-content: between; align-items: flex-start; gap: 15px;">
          <div style="flex: 1;">
            <h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px; font-weight: 600; line-height: 1.3;">
              ${escapeHtml(entry.title)}
            </h3>
            <div style="color: #666; font-size: 12px;">
              📅 ${dateString} • 📊 ${entry.wordCount} words
            </div>
            <div style="color: #007acc; font-size: 11px; margin-top: 4px; word-break: break-all;">
              🔗 <a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer" style="color: #007acc; text-decoration: underline; cursor: pointer;">${escapeHtml(entry.url)}</a>
            </div>
            ${similarityInfo}
          </div>
          <button id="closeModal" style="
            background: #f0f0f0;
            border: none;
            border-radius: 6px;
            width: 32px;
            height: 32px;
            cursor: pointer;
            font-size: 16px;
            color: #666;
            display: flex;
            align-items: center;
            justify-content: center;
          ">✕</button>
        </div>
      </div>
      <div style="padding: 20px; overflow-y: auto; flex: 1; color: #333; line-height: 1.6; font-size: 14px;">
        ${highlightedFullText}
      </div>
      <div style="padding: 15px 20px; border-top: 1px solid #eee; background: #f8f9fa; border-radius: 0 0 12px 12px;">
        <button id="copyFullText" style="
          background: #007acc;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
        ">📋 Copy Full Text</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Animate in
    setTimeout(() => {
      modal.style.transform = 'scale(1)';
      
      // Auto-scroll to first highlighted element if search query exists
      if (searchQuery && currentSearchMode === 'keyword') {
        setTimeout(() => {
          const contentDiv = modal.querySelector('div[style*="overflow-y: auto"]');
          const firstHighlight = contentDiv.querySelector('.highlight');
          
          if (firstHighlight && contentDiv) {
            console.log('🎯 Auto-scrolling to first highlight in modal');
            
            // Calculate the position to scroll to (with some offset for better visibility)
            const highlightRect = firstHighlight.getBoundingClientRect();
            const contentRect = contentDiv.getBoundingClientRect();
            const scrollOffset = firstHighlight.offsetTop - (contentDiv.clientHeight / 3);
            
            // Smooth scroll to the highlighted content
            contentDiv.scrollTo({
              top: Math.max(0, scrollOffset),
              behavior: 'smooth'
            });
            
            // Optional: Add a subtle flash effect to draw attention
            firstHighlight.style.boxShadow = '0 0 10px rgba(255, 224, 130, 0.8)';
            setTimeout(() => {
              firstHighlight.style.boxShadow = '';
            }, 2000);
          }
        }, 300); // Small delay to ensure DOM is ready
      }
    }, 10);
    
    // Event listeners
    const closeModal = () => {
      modal.style.transform = 'scale(0.9)';
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 200);
    };
    
    // Close button
    modal.querySelector('#closeModal').addEventListener('click', closeModal);
    
    // Copy button
    modal.querySelector('#copyFullText').addEventListener('click', async () => {
      await copyToClipboard(entry.text);
      const copyBtn = modal.querySelector('#copyFullText');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1000);
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
    
    // Close on Escape key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  }
  
  // Function to toggle references visibility
  function toggleReferences(entryId) {
    const referencesDiv = document.getElementById(`references-${entryId}`);
    const button = document.querySelector(`.show-references-btn[data-entry-id="${entryId}"]`);
    
    if (referencesDiv && button) {
      if (referencesDiv.style.display === 'none') {
        referencesDiv.style.display = 'flex';
        button.textContent = button.textContent.replace('Show', 'Hide');
      } else {
        referencesDiv.style.display = 'none';
        button.textContent = button.textContent.replace('Hide', 'Show');
      }
    }
  }
  
  // Function to show reference details
  function showReferenceDetails(refId, references) {
    const reference = references.find(ref => ref.id == refId);
    if (!reference) return;
    
    // Highlight the reference in the references list
    const referenceElement = document.getElementById(`ref-${refId}`);
    if (referenceElement) {
      // Remove any existing highlights from reference items and reference numbers
      document.querySelectorAll('.reference-item.highlighted').forEach(el => {
        el.classList.remove('highlighted');
      });
      document.querySelectorAll('.reference-link.highlighted').forEach(el => {
        el.classList.remove('highlighted');
      });
      
      // Add highlight to current reference
      referenceElement.classList.add('highlighted');
      
      // Scroll to the reference
      referenceElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Show the references section if it's hidden
      const referencesContainer = referenceElement.closest('.references-container');
      if (referencesContainer && referencesContainer.style.display === 'none') {
        const entryId = referencesContainer.id.replace('references-', '');
        toggleReferences(entryId);
      }
      
      // Remove highlight after a few seconds
      setTimeout(() => {
        referenceElement.classList.remove('highlighted');
      }, 3000);
    }
  }

  // Function to jump to reference in answer (reverse direction)
  function jumpToReferenceInAnswer(refId, entryId) {
    console.log(`🔗 Jumping to reference ${refId} in entry ${entryId}`);
    
    // Find the specific entry container
    const entryContainer = document.querySelector(`[data-entry-id="${entryId}"]`)?.closest('.entry') || 
                          document.querySelector(`#references-${entryId}`)?.closest('.entry');
    
    if (!entryContainer) {
      console.warn('❌ Entry container not found for entryId:', entryId);
      return;
    }
    
    console.log('✅ Found entry container:', entryContainer);
    
    // Debug: Log all reference links in this entry
    const allRefLinks = entryContainer.querySelectorAll('.reference-link');
    console.log(`📋 Found ${allRefLinks.length} reference links in entry ${entryId}:`);
    allRefLinks.forEach(link => {
      console.log(`   • ${link.id} (text: "${link.textContent}")`);
    });
    
    // Find the reference link within this specific entry
    const referenceLink = entryContainer.querySelector(`#ref-link-${refId}`);
    if (referenceLink) {
      console.log('✅ Found reference link:', referenceLink.id);
      
      // Remove any existing highlights from reference links and reference numbers
      entryContainer.querySelectorAll('.reference-link.highlighted').forEach(el => {
        el.classList.remove('highlighted');
      });
      entryContainer.querySelectorAll('.reference-number.highlighted').forEach(el => {
        el.classList.remove('highlighted');
      });
      
      // Add highlight to the reference link
      referenceLink.classList.add('highlighted');
      
      // Scroll to the reference link in the answer
      referenceLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Remove highlight after a few seconds
      setTimeout(() => {
        referenceLink.classList.remove('highlighted');
      }, 3000);
    } else {
      console.warn('❌ Reference link not found for refId:', refId);
      console.log('🔍 Looking for alternative patterns...');
      
      // Try to find any reference links with class within this entry
      const allRefLinksByClass = entryContainer.querySelectorAll('.reference-link');
      console.log('📋 All .reference-link elements in this entry:', allRefLinksByClass.length);
      allRefLinksByClass.forEach(link => {
        console.log(`   • Class-based: ${link.id || 'no-id'} (text: "${link.textContent}", data-ref-id: "${link.dataset.refId || 'none'}")`);
      });
    }
  }
  
  // Filter functions
  function toggleFilterVisibility() {
    if (!searchFilters || !toggleFilters) return;
    
    const isVisible = searchFilters.style.display !== 'none';
    searchFilters.style.display = isVisible ? 'none' : 'block';
    toggleFilters.classList.toggle('active', !isVisible);
  }

  function handleTimeFilterChange() {
    if (!timeFilter || !customDateRange) return;
    
    const isCustom = timeFilter.value === 'custom';
    customDateRange.style.display = isCustom ? 'block' : 'none';
    
    if (isCustom && dateTo && dateFrom) {
      // Set default dates - from one year ago to today
      const today = new Date();
      const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      
      dateTo.value = today.toISOString().split('T')[0];
      dateFrom.value = oneYearAgo.toISOString().split('T')[0];
    }
  }

  function handleResultsFilterChange() {
    // This function now only handles verbatim filter changes
    // Advanced search is handled by the separate advanced filter
  }

  function handleAdvancedFilterChange() {
    if (!advancedFilter || !advancedSearch) return;
    
    const isAdvanced = advancedFilter.value === 'on';
    advancedSearch.style.display = isAdvanced ? 'block' : 'none';
    
    // Clear advanced search fields when switching off advanced mode
    if (!isAdvanced) {
      if (allWords) allWords.value = '';
      if (exactPhrase) exactPhrase.value = '';
      if (anyWords) anyWords.value = '';
      if (noneWords) noneWords.value = '';
    }
  }

  async function applySearchFilters() {
    console.log('🔧 Applying search filters...');
    
    if (!timeFilter || !resultsFilter || !advancedFilter) {
      console.log('⚠️ Filter elements not found, skipping filter application');
      return;
    }
    
    console.log('  - Before update - timeFilter:', timeFilter.value);
    console.log('  - Before update - resultsFilter:', resultsFilter.value);
    console.log('  - Before update - advancedFilter:', advancedFilter.value);
    
    // Update filter state
    searchFilterState = {
      timeFilter: timeFilter.value,
      resultsFilter: resultsFilter.value,
      advancedFilter: advancedFilter.value,
      dateFrom: dateFrom ? dateFrom.value : '',
      dateTo: dateTo ? dateTo.value : '',
      isActive: timeFilter.value !== 'any' || resultsFilter.value !== 'any' || advancedFilter.value !== 'off'
    };
    
    console.log('  - After update - searchFilterState:', searchFilterState);
    
    // Update active filters display
    updateActiveFiltersDisplay();
    
    // Re-run search with filters if there's an active query
    if (currentSearch) {
      console.log('  - Re-running search with query:', currentSearch);
      await performSearch(currentSearch);
    } else {
      console.log('  - No active search query to re-run');
    }
    
    // Save filter state for persistence
    await saveSearchState();
    console.log('✅ Search filters applied and saved');
  }

  function resetSearchFilters() {
    // Reset filter state
    searchFilterState = {
      timeFilter: 'any',
      resultsFilter: 'any',
      advancedFilter: 'off',
      dateFrom: '',
      dateTo: '',
      isActive: false
    };
    
    // Reset UI
    if (timeFilter) timeFilter.value = 'any';
    if (resultsFilter) resultsFilter.value = 'any';
    if (advancedFilter) advancedFilter.value = 'off';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    if (customDateRange) customDateRange.style.display = 'none';
    
    // Reset advanced search fields
    if (allWords) allWords.value = '';
    if (exactPhrase) exactPhrase.value = '';
    if (anyWords) anyWords.value = '';
    if (noneWords) noneWords.value = '';
    if (advancedSearch) advancedSearch.style.display = 'none';
    
    // Update display
    updateActiveFiltersDisplay();
    
    // Re-run search if there's an active query
    if (currentSearch) {
      performSearch(currentSearch);
    }
  }

  function updateActiveFiltersDisplay() {
    const filters = [];
    
    // Always show time filter if active
    if (searchFilterState.timeFilter !== 'any') {
      if (searchFilterState.timeFilter === 'custom') {
        if (searchFilterState.dateFrom && searchFilterState.dateTo) {
          filters.push(`📅 ${searchFilterState.dateFrom} to ${searchFilterState.dateTo}`);
        }
      } else {
        const timeLabels = {
          hour: 'Past hour',
          day: 'Past 24 hours', 
          week: 'Past week',
          month: 'Past month',
          year: 'Past year'
        };
        filters.push(`⏰ ${timeLabels[searchFilterState.timeFilter]}`);
      }
    }
    
    // Only show results filter for keyword search mode
    if (currentSearchMode === 'keyword' && searchFilterState.resultsFilter !== 'any') {
      if (searchFilterState.resultsFilter === 'verbatim') {
        filters.push(`🎯 Verbatim`);
      }
    }
    
    // Show advanced filter status for keyword search mode
    if (currentSearchMode === 'keyword' && searchFilterState.advancedFilter === 'on') {
      // Show active advanced search criteria
      const advancedCriteria = [];
      if (allWords && allWords.value.trim()) advancedCriteria.push(`all: ${allWords.value.trim()}`);
      if (exactPhrase && exactPhrase.value.trim()) advancedCriteria.push(`exact: "${exactPhrase.value.trim()}"`);
      if (anyWords && anyWords.value.trim()) advancedCriteria.push(`any: ${anyWords.value.trim()}`);
      if (noneWords && noneWords.value.trim()) advancedCriteria.push(`exclude: ${noneWords.value.trim()}`);
      
      if (advancedCriteria.length > 0) {
        filters.push(`🔍 Advanced: ${advancedCriteria.join(', ')}`);
      } else {
        filters.push(`🔍 Advanced`);
      }
    }
    
    if (activeFilters) {
      activeFilters.textContent = filters.length > 0 ? filters.join(' • ') : '';
    }
  }
  
  // Setup note functions
  async function loadSetupNoteVisibility() {
    if (!setupNote) return;
    
    try {
      const result = await chrome.storage.local.get(['setupNoteDismissed']);
      const isDismissed = result.setupNoteDismissed || false;
      
      if (isDismissed) {
        setupNote.style.display = 'none';
      } else {
        setupNote.style.display = 'flex';
      }
    } catch (error) {
      console.error('Error loading setup note visibility:', error);
    }
  }
  
  async function dismissSetupNoteForever() {
    if (!setupNote) return;
    
    try {
      // Hide the setup note immediately
      setupNote.style.display = 'none';
      
      // Save the dismissal state
      await chrome.storage.local.set({ setupNoteDismissed: true });
      
      console.log('✅ Setup note dismissed permanently');
    } catch (error) {
      console.error('Error dismissing setup note:', error);
    }
  }

  function openShortcutsPage(event) {
    event.preventDefault();
    try {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      console.log('🔗 Opened shortcuts page');
    } catch (error) {
      console.error('❌ Error opening shortcuts page:', error);
      // Fallback - copy URL to clipboard
      navigator.clipboard.writeText('chrome://extensions/shortcuts').then(() => {
        console.log('📋 Copied shortcuts URL to clipboard as fallback');
      });
    }
  }
  
  // Function to save user's preferred answer content height
  async function saveAnswerContentHeight(height) {
    try {
      userAnswerContentHeight = height;
      await chrome.storage.local.set({ userAnswerContentHeight: height });
      console.log('📏 Saved answer content height:', height);
    } catch (error) {
      console.error('❌ Error saving answer content height:', error);
    }
  }

  // Function to load user's preferred answer content height
  async function loadAnswerContentHeight() {
    try {
      const result = await chrome.storage.local.get(['userAnswerContentHeight']);
      if (result.userAnswerContentHeight) {
        userAnswerContentHeight = result.userAnswerContentHeight;
        console.log('📏 Loaded user answer content height:', userAnswerContentHeight);
      }
    } catch (error) {
      console.error('❌ Error loading answer content height:', error);
    }
  }

  // Function to setup drag handle functionality
  function setupDragHandleResize(dragHandle, answerContent) {
    let isDragging = false;
    let startY = 0;
    let startHeight = 0;

    // Ensure the drag handle and its children are clickable
    dragHandle.style.pointerEvents = 'auto';
    dragHandle.style.cursor = 'ns-resize';
    
    // Make sure child elements don't interfere
    const dragIcon = dragHandle.querySelector('.drag-icon');
    if (dragIcon) {
      dragIcon.style.pointerEvents = 'none';
    }
    
    console.log('🎯 Setting up drag handle for:', dragHandle, 'with content:', answerContent);

    const handleMouseDown = (e) => {
      console.log('🖱️ Mouse down on drag handle, target:', e.target);
      isDragging = true;
      startY = e.clientY;
      startHeight = parseInt(window.getComputedStyle(answerContent).height, 10);
      
      console.log('📏 Starting drag - startY:', startY, 'startHeight:', startHeight);
      
      // Add visual feedback
      dragHandle.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ns-resize';
      
      // Add visual indication that dragging is active
      dragHandle.style.backgroundColor = 'rgba(156, 39, 176, 0.9)';
      
      e.preventDefault();
      e.stopPropagation();
    };

    dragHandle.addEventListener('mousedown', handleMouseDown);
    
    // Also add to the icon in case it's clicked directly
    if (dragIcon) {
      dragIcon.addEventListener('mousedown', handleMouseDown);
    }

    // Add hover effects for better user feedback
    dragHandle.addEventListener('mouseenter', () => {
      console.log('🖱️ Mouse entered drag handle');
      dragHandle.style.cursor = 'ns-resize';
    });

    dragHandle.addEventListener('mouseleave', () => {
      if (!isDragging) {
        dragHandle.style.cursor = 'ns-resize';
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(150, Math.min(800, startHeight + deltaY));
      
      // Apply the new height to the answer content - simple downward expansion
      answerContent.style.height = newHeight + 'px';
      answerContent.style.minHeight = newHeight + 'px';
      answerContent.style.maxHeight = newHeight + 'px';
      answerContent.style.overflowY = 'auto';
      
      // Auto-scroll the content container to show the expanded area
      if (deltaY > 0) { // Only when expanding (dragging down)
        const contentContainer = document.querySelector('.content');
        if (contentContainer) {
          // Scroll to bottom to show the expanded content
          setTimeout(() => {
            contentContainer.scrollTop = contentContainer.scrollHeight;
          }, 0);
        }
      }
      
      e.preventDefault();
    });

    document.addEventListener('mouseup', (e) => {
      if (isDragging) {
        console.log('🖱️ Mouse up - ending drag');
        isDragging = false;
        dragHandle.style.cursor = 'ns-resize';
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // Reset visual feedback
        dragHandle.style.backgroundColor = '';
        
        // Get the final height and clean up the style constraints
        const finalHeight = parseInt(window.getComputedStyle(answerContent).height, 10);
        console.log('📏 Final height saved:', finalHeight);
        
        // Apply the final height and restore normal constraints
        answerContent.style.height = finalHeight + 'px';
        answerContent.style.minHeight = '150px';
        answerContent.style.maxHeight = '800px';
        answerContent.style.overflowY = 'auto';
        
        // Auto-scroll to show the final expanded content
        const contentContainer = document.querySelector('.content');
        if (contentContainer && finalHeight > startHeight) {
          setTimeout(() => {
            contentContainer.scrollTop = contentContainer.scrollHeight;
          }, 100);
        }
        
        // Save the new height
        saveAnswerContentHeight(finalHeight);
        
        e.preventDefault();
      }
    });

    // Also handle mouse leave to stop dragging
    document.addEventListener('mouseleave', () => {
      if (isDragging) {
        isDragging = false;
        dragHandle.style.cursor = 'ns-resize';
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // Reset visual feedback
        dragHandle.style.backgroundColor = '';
        
        // Clean up constraints when drag ends unexpectedly
        const finalHeight = parseInt(window.getComputedStyle(answerContent).height, 10);
        
        answerContent.style.height = finalHeight + 'px';
        answerContent.style.minHeight = '150px';
        answerContent.style.maxHeight = '800px';
        answerContent.style.overflowY = 'auto';
      }
    });
  }

  // Function to setup scroll-based auto-expansion
  function setupScrollBasedExpansion() {
    console.log('🚀 Setting up scroll-based auto-expansion...');
    
    // Add debugging to see what's happening with scrolling
    let currentScrollPosition = 0;
    let lastScrollTime = 0;
    
    // Since answer blocks now auto-size, scroll-based expansion is no longer needed
    const performExpansion = (source, scrollTop) => {
      console.log(`📜 Scroll event detected from ${source}, but auto-sizing handles answer blocks now`);
      // No longer needed since answer blocks auto-size to their content
    };
    
    // Try multiple approaches to detect scrolling
    
    // 1. Traditional scroll event listeners
    const scrollTargets = [
      document.querySelector('.content'),
      document.body,
      window
    ].filter(Boolean);
    
    scrollTargets.forEach((target, index) => {
      // Extra safety check
      if (!target || typeof target.addEventListener !== 'function') {
        console.warn(`⚠️ Invalid scroll target at index ${index}:`, target);
        return;
      }
      
      const scrollHandler = () => {
        const scrollTop = target === window ? 
          (window.pageYOffset || document.documentElement.scrollTop) :
          target.scrollTop;
        performExpansion(`scroll-${index}`, scrollTop);
      };
      
      if (target === window) {
        window.addEventListener('scroll', scrollHandler, { passive: true });
        console.log('✅ Scroll listener added to window');
      } else {
        target.addEventListener('scroll', scrollHandler, { passive: true });
        console.log(`✅ Scroll listener added to ${target.className || target.tagName}`);
      }
    });
    
    // 2. Wheel event for mouse scroll detection
    document.addEventListener('wheel', (e) => {
      const contentContainer = document.querySelector('.content') || document.body;
      const scrollTop = contentContainer.scrollTop || window.pageYOffset || document.documentElement.scrollTop;
      performExpansion('wheel', scrollTop);
    }, { passive: true });
    console.log('✅ Wheel event listener added');
    
    // 3. Touch events for mobile/trackpad
    document.addEventListener('touchmove', (e) => {
      const contentContainer = document.querySelector('.content') || document.body;
      const scrollTop = contentContainer.scrollTop || window.pageYOffset || document.documentElement.scrollTop;
      performExpansion('touch', scrollTop);
    }, { passive: true });
    console.log('✅ Touch event listener added');
    
    // 4. Manual polling as fallback
    let lastKnownScroll = 0;
    setInterval(() => {
      const contentContainer = document.querySelector('.content') || document.body;
      const currentScroll = contentContainer.scrollTop || window.pageYOffset || document.documentElement.scrollTop;
      
      if (currentScroll !== lastKnownScroll) {
        console.log('📊 Polling detected scroll change:', lastKnownScroll, '→', currentScroll);
        performExpansion('polling', currentScroll);
        lastKnownScroll = currentScroll;
      }
    }, 100); // Check every 100ms
    console.log('✅ Polling fallback started');
    
    // Test expansion immediately
    setTimeout(() => {
      console.log('🧪 Testing expansion in 2 seconds...');
      performExpansion('test', 0);
      
      setTimeout(() => {
        performExpansion('test', 50);
      }, 1000);
      
      setTimeout(() => {
        performExpansion('test', 100);
      }, 2000);
    }, 2000);
    
    console.log('✅ Multi-method scroll-based auto-expansion setup complete');
  }

  // Function to setup resize observers for answer content blocks
  function setupAnswerContentResize() {
    // Use MutationObserver to watch for new answer content blocks and drag handles
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Handle references drag handles
            const referencesDragHandles = node.querySelectorAll ? node.querySelectorAll('.references-drag-handle') : [];
            
            // Also check if the node itself is a references drag handle
            if (node.classList && node.classList.contains('references-drag-handle')) {
              const referencesContainer = node.closest('.references-container');
              if (referencesContainer) {
                setupDragHandleResize(node, referencesContainer);
                // Apply default height to the references container
                referencesContainer.style.height = '200px';
              }
            }
            
            // Setup references drag handles found in child nodes
            referencesDragHandles.forEach(dragHandle => {
              const referencesContainer = dragHandle.closest('.references-container');
              if (referencesContainer) {
                setupDragHandleResize(dragHandle, referencesContainer);
                // Apply default height to the references container
                referencesContainer.style.height = '200px';
              }
            });
          }
        });
      });
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize resize functionality
  await loadAnswerContentHeight();
  setupAnswerContentResize();
  
  console.log('✅ Popup script loaded successfully');

  // Auto-update entries and stats if textEntries changes in storage
  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.textEntries) {
        loadEntries();
        loadStats();
      }
    });
  }

  // Settings icon toggles settings tab
  const settingsIconBtn = document.getElementById('settingsIconBtn');
  const searchTab = document.getElementById('searchTab');
  const settingsTab = document.getElementById('settingsTab');
  if (settingsIconBtn && searchTab && settingsTab) {
    settingsIconBtn.addEventListener('click', () => {
      const isSettingsOpen = settingsTab.style.display === 'block' || settingsTab.style.display === '';
      if (isSettingsOpen) {
        settingsTab.style.display = 'none';
        searchTab.style.display = 'block';
      } else {
        settingsTab.style.display = 'block';
        searchTab.style.display = 'none';
      }
    });
    // By default, show search tab and hide settings
    settingsTab.style.display = 'none';
    searchTab.style.display = 'block';
  }

  // Function to clear error states silently (without user notification)
  async function clearErrorStatesSilently() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'clear_error_states'
      });
      
      if (response && response.success) {
        console.log('✅ Error states cleared silently on popup open');
        
        // Also clear any visible error states in the UI
        if (searchResults && searchResults.style.display !== 'none') {
          searchResults.style.display = 'none';
        }
        if (noResults && noResults.style.display !== 'none') {
          noResults.style.display = 'none';
        }
        
        // Reset search state if it contains error indicators
        if (currentSearch && (currentSearch.includes('Error') || currentSearch.includes('❌'))) {
          currentSearch = '';
          if (searchInput) {
            searchInput.value = '';
          }
        }
        
      } else {
        console.log('⚠️ Failed to clear error states silently:', response?.error);
      }
      
    } catch (error) {
      console.log('⚠️ Error clearing error states silently:', error.message);
    }
  }
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('🔥 Global error in popup:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🔥 Unhandled promise rejection in popup:', event.reason);
}); 