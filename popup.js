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
  const loadingIndicator = document.getElementById('loadingIndicator');
  
  // Setup note elements
  const setupNote = document.getElementById('setupNote');
  const dismissSetupNote = document.getElementById('dismissSetupNote');
  const shortcutsLink = document.getElementById('shortcutsLink');
  
  // Tab system
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Search mode elements (add these back)
  const searchOptions = document.querySelectorAll('.search-option');
  
  // State variables
  let allEntries = [];
  let currentSearch = '';
  let currentSearchMode = 'similarity'; // Default to similarity search
  let isSearching = false;
  
  // Initialize
  await loadEntries();
  await loadStats();
  await initializeSimilarity();
  await loadSetupNoteVisibility();
  
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
      
      // Re-run search if there's an active query
      if (currentSearch) {
        await performSearch(currentSearch);
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
  
  // Setup note event listeners
  if (dismissSetupNote) {
    dismissSetupNote.addEventListener('click', dismissSetupNoteForever);
  }
  if (shortcutsLink) {
    shortcutsLink.addEventListener('click', openShortcutsPage);
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
  
  // Update search options UI
  function updateSearchOptions() {
    searchOptions.forEach(option => {
      option.classList.toggle('active', option.dataset.mode === currentSearchMode);
    });
    
    // Update placeholder text
    if (searchInput) {
      if (currentSearchMode === 'similarity') {
        searchInput.placeholder = "Find similar content...";
      } else {
        searchInput.placeholder = "Search keywords...";
      }
    }
  }
  
  // Function to handle search input
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
    
    // Perform search based on current mode
    console.log(`🔍 handleSearchInput: performing ${currentSearchMode} search for:`, query);
    await performSearch(query);
  }
  
  // Function to handle keyboard events
  async function handleSearchKeydown(e) {
    // Handle escape key to clear search
    if (e.key === 'Escape') {
      e.preventDefault();
      clearSearch();
      return;
    }
  }
  
  // Main search function
  async function performSearch(query) {
    if (isSearching) return; // Prevent multiple simultaneous searches
    
    console.log('🚀 performSearch called with query:', `"${query}"`);
    console.log('🔍 Search mode:', currentSearchMode);
    
    try {
      isSearching = true;
      showLoading(true);
      
      let results;
      if (currentSearchMode === 'similarity') {
        results = await performSimilaritySearch(query);
      } else {
        results = await performKeywordSearch(query);
      }
      
      console.log('📊 Search results count:', results.length);
      
      displaySearchResults(results, query);
      
    } catch (error) {
      console.error('Search error:', error);
      displaySearchResults([], query);
    } finally {
      isSearching = false;
      showLoading(false);
    }
  }
  
  // Similarity search function
  async function performSimilaritySearch(query) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'search_similar',
        query: query,
        options: {
          limit: 10,
          threshold: 0.1
        }
      });
      
      if (response && response.success && response.results) {
        return response.results;
      } else {
        console.error('Similarity search failed:', response);
        return [];
      }
    } catch (error) {
      console.error('Error performing similarity search:', error);
      return [];
    }
  }
  
  // Keyword search function
  async function performKeywordSearch(query) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'search_keywords',
        query: query
      });
      
      if (response && response.success && response.results) {
        return response.results;
      } else {
        console.error('Keyword search failed:', response);
        return [];
      }
    } catch (error) {
      console.error('Error performing keyword search:', error);
      return [];
    }
  }
  
  // Initialize similarity engine
  async function initializeSimilarity() {
    try {
      console.log('🔄 Initializing similarity engine...');
      const response = await chrome.runtime.sendMessage({
        action: 'initialize_embeddings'
      });
      
      if (response && response.success) {
        console.log('✅ Similarity engine initialized');
        updateSearchOptions(); // Set initial search mode
      } else {
        console.warn('⚠️ Similarity engine initialization failed');
      }
    } catch (error) {
      console.error('❌ Error initializing similarity engine:', error);
    }
  }
  
  function showLoading(show) {
    if (loadingIndicator) {
      loadingIndicator.style.display = show ? 'inline-block' : 'none';
    }
  }
  
  function clearSearch() {
    currentSearch = '';
    if (searchInput) {
      searchInput.value = '';
    }
    if (searchClear) {
      searchClear.style.display = 'none';
    }
    if (searchResults) {
      searchResults.style.display = 'none';
    }
    if (noResults) {
      noResults.style.display = 'none';
    }
    
    // Show all entries
    displayEntries(allEntries);
  }
  
  function displaySearchResults(results, query) {
    if (!results || results.length === 0) {
      // No results found
      if (entriesContainer) {
        entriesContainer.innerHTML = '';
      }
      if (noResults) {
        noResults.textContent = `No results found for "${query}"`;
        noResults.style.display = 'block';
      }
      if (searchResults) {
        searchResults.style.display = 'none';
      }
      if (emptyState) {
        emptyState.style.display = 'none';
      }
    } else {
      // Display results
      if (noResults) {
        noResults.style.display = 'none';
      }
      if (emptyState) {
        emptyState.style.display = 'none';
      }
      if (searchResults) {
        const searchModeText = currentSearchMode === 'similarity' ? 'similar' : 'keyword';
        searchResults.innerHTML = `Found ${results.length} ${searchModeText} result${results.length === 1 ? '' : 's'} for "${query}"`;
        searchResults.style.display = 'block';
      }
      
      displayEntries(results, query);
    }
  }
  
  async function loadEntries() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'get_entries' });
      
      if (response && response.success && response.entries) {
        allEntries = response.entries;
        console.log(`📚 Loaded ${allEntries.length} entries`);
        
        if (currentSearch) {
          // If there's an active search, filter the entries
          await performSearch(currentSearch);
        } else {
          // Display all entries
          displayEntries(allEntries);
        }
      } else {
        console.error('Failed to load entries:', response);
        allEntries = [];
        displayEntries([]);
      }
    } catch (error) {
      console.error('Error loading entries:', error);
      allEntries = [];
      displayEntries([]);
    }
  }
  
  async function loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'get_stats' });
      
      if (response && response.success && response.stats) {
        const { totalEntries, totalWords } = response.stats;
        
        if (entryCount) {
          entryCount.textContent = totalEntries;
        }
        if (totalWords) {
          totalWords.textContent = totalWords.toLocaleString();
        }
        if (stats) {
          stats.style.display = 'block';
        }
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }
  
  function displayEntries(entries, searchQuery = '') {
    if (!entriesContainer) return;
    
    if (!entries || entries.length === 0) {
      if (allEntries.length === 0) {
        // No entries at all
        if (emptyState) {
          emptyState.style.display = 'block';
        }
        entriesContainer.innerHTML = '';
      } else {
        // No search results
        entriesContainer.innerHTML = '';
      }
      return;
    }
    
    if (emptyState) {
      emptyState.style.display = 'none';
    }
    
    // Create entry elements
    const entryElements = entries.map(entry => createEntryElement(entry, searchQuery));
    entriesContainer.innerHTML = entryElements.join('');
    
    // Add click handlers for copy buttons
    entriesContainer.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const entryId = btn.dataset.entryId;
        const entry = entries.find(e => e.id == entryId);
        if (entry) {
          await copyToClipboard(entry.text);
          showTemporaryFeedback(btn, 'Copied!');
        }
      });
    });
    
    // Add click handlers for expand/collapse buttons
    entriesContainer.querySelectorAll('.expand-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const textId = btn.dataset.textId;
        const entryId = btn.dataset.entryId;
        const entry = entries.find(e => e.id == entryId);
        
        if (entry) {
          const isExpanded = btn.textContent.includes('Less');
          if (isExpanded) {
            // Collapse
            const truncatedText = entry.text.length > 300 ? entry.text.substring(0, 300) + '...' : entry.text;
            toggleEntryText(textId, btn, entry.text, truncatedText, searchQuery);
          } else {
            // Expand
            toggleEntryText(textId, btn, entry.text, entry.text, searchQuery);
          }
        }
      });
    });
  }
  
  function createEntryElement(entry, searchQuery = '') {
    const date = new Date(entry.timestamp).toLocaleDateString();
    const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Truncate text for initial display
    const maxLength = 300;
    const truncatedText = entry.text.length > maxLength ? entry.text.substring(0, maxLength) + '...' : entry.text;
    const needsExpansion = entry.text.length > maxLength;
    
    // Highlight search terms if present
    const displayText = searchQuery ? highlightSearchTerms(truncatedText, searchQuery) : escapeHtml(truncatedText);
    
    // Add similarity score if available
    let similarityInfo = '';
    if (entry.similarity && currentSearchMode === 'similarity') {
      const simPercentage = Math.round(entry.similarity * 100);
      similarityInfo = `<span class="similarity-score">📊 ${simPercentage}% similar</span>`;
    }
    
    return `
      <div class="entry" data-entry-id="${entry.id}">
        <div class="entry-header">
          <div class="entry-meta">
            <span class="entry-title">${escapeHtml(entry.title || 'Untitled')}</span>
            <span class="entry-date">${date} ${time}</span>
            <span class="entry-words">${entry.wordCount || 0} words</span>
            ${similarityInfo}
          </div>
          <button class="copy-btn" data-entry-id="${entry.id}" title="Copy text">📋</button>
        </div>
        <div class="entry-url">
          <a href="${entry.url}" target="_blank" rel="noopener noreferrer">${entry.url}</a>
        </div>
        <div class="entry-text" id="text-${entry.id}">
          ${displayText}
        </div>
        ${needsExpansion ? `
          <button class="expand-btn" data-text-id="text-${entry.id}" data-entry-id="${entry.id}">
            Show More
          </button>
        ` : ''}
      </div>
    `;
  }
  
  function toggleEntryText(textId, button, fullText, newText, searchQuery = '') {
    const textElement = document.getElementById(textId);
    if (!textElement) return;
    
    const isExpanded = button.textContent.includes('Less');
    const displayText = searchQuery ? highlightSearchTerms(newText, searchQuery) : escapeHtml(newText);
    
    textElement.innerHTML = displayText;
    button.textContent = isExpanded ? 'Show More' : 'Show Less';
  }
  
  async function clearAllEntries() {
    if (!confirm('Are you sure you want to clear all saved entries? This cannot be undone.')) {
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'clear_entries' });
      
      if (response && response.success) {
        allEntries = [];
        displayEntries([]);
        await loadStats();
        console.log('✅ All entries cleared');
      } else {
        console.error('Failed to clear entries:', response);
        alert('Failed to clear entries. Please try again.');
      }
    } catch (error) {
      console.error('Error clearing entries:', error);
      alert('Error clearing entries. Please try again.');
    }
  }
  
  function highlightSearchTerms(text, query) {
    if (!query || !text) return escapeHtml(text);
    
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    let highlightedText = escapeHtml(text);
    
    for (const term of searchTerms) {
      const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    }
    
    return highlightedText;
  }
  
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }
  
  function showTemporaryFeedback(element, message) {
    const originalText = element.textContent;
    element.textContent = message;
    setTimeout(() => {
      element.textContent = originalText;
    }, 1000);
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Initialize search mode
  updateSearchOptions();
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('🔥 Global error in popup:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🔥 Unhandled promise rejection in popup:', event.reason);
}); 