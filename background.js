// Background script (Service Worker) for Manifest V3
console.log('🚀 Text Grabber Extension - Background script starting...');

// Import embeddings functionality
importScripts('embeddings.js');

// Function to clear all persistent storage and error states
async function clearPersistentState() {
  try {
    console.log('🧹 Clearing persistent state on extension reload...');
    
    // Clear all chrome.storage data except for actual entries
    const keysToClear = [
      'searchState',
      'setupNoteDismissed', 
      'userAnswerContentHeight',
      'lastError',
      'errorState',
      'searchError',
      'semanticError'
    ];
    
    // Get current storage to preserve important data
    const currentStorage = await chrome.storage.local.get(null);
    
    // Only clear the specified keys
    for (const key of keysToClear) {
      if (currentStorage[key]) {
        await chrome.storage.local.remove(key);
        console.log(`🗑️ Cleared: ${key}`);
      }
    }
    
    console.log('✅ Persistent state cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing persistent state:', error);
  }
}

// Clear state on extension startup
clearPersistentState();

// Service Worker event handlers
chrome.runtime.onInstalled.addListener(() => {
  console.log('📦 Extension installed/updated');
  
  // Initialize side panel
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  
  // Clear any stale state
  clearPersistentState();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 Extension startup');
  clearPersistentState();
});

// Command handler for keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  console.log('⌨️ Command received:', command);
  
  if (command === 'trigger_action') {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        console.error('❌ No active tab found');
        return;
      }
      
      console.log('🎯 Triggering text extraction on tab:', tab.id);
      
      // Inject and execute content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
    } catch (error) {
      console.error('❌ Error executing command:', error);
    }
  }
});

// Message handler for communication with popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received:', request.action);
  
  // Handle async operations
  (async () => {
    try {
      let response = { success: false };
      
      switch (request.action) {
        case 'save_text':
          response = await saveTextEntry(request.data);
          break;
          
        case 'get_entries':
          response = await getTextEntries();
          break;
          
        case 'search_keywords':
          response = await searchKeywords(request.query);
          break;
          
        case 'search_similar':
          response = await searchSimilar(request.query, request.options);
          break;
          
        case 'clear_entries':
          response = await clearAllEntries();
          break;
          
        case 'get_stats':
          response = await getStorageStats();
          break;
          
        case 'initialize_embeddings':
          response = await initializeEmbeddings();
          break;
          
        case 'get_similarity_stats':
          response = getSimilarityStats();
          break;
          
        default:
          console.warn('⚠️ Unknown action:', request.action);
          response = { success: false, error: 'Unknown action' };
      }
      
      sendResponse(response);
      
    } catch (error) {
      console.error('❌ Error handling message:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  })();
  
  // Return true to indicate we will send a response asynchronously
  return true;
});

// Save text entry function
async function saveTextEntry(data) {
  try {
    console.log('💾 Saving text entry...');
    
    // Get existing entries
    const result = await chrome.storage.local.get(['textEntries']);
    const entries = result.textEntries || [];
    
    // Create new entry with ID and timestamp
    const newEntry = {
      ...data,
      id: Date.now(),
      timestamp: new Date().toISOString(),
      wordCount: data.text ? data.text.split(/\s+/).length : 0
    };
    
    // Add to beginning of array (most recent first)
    entries.unshift(newEntry);
    
    // Save back to storage
    await chrome.storage.local.set({ textEntries: entries });
    
    // Add to embeddings/similarity engine
    if (typeof addEntryEmbedding === 'function') {
      try {
        await addEntryEmbedding(newEntry);
      } catch (embeddingError) {
        console.warn('⚠️ Error adding to embeddings:', embeddingError);
        // Don't fail the entire operation if embeddings fail
      }
    }
    
    console.log('✅ Text entry saved successfully:', newEntry.id);
    
    return { 
      success: true, 
      entry: newEntry,
      totalEntries: entries.length
    };
    
  } catch (error) {
    console.error('❌ Error saving text entry:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Get all text entries
async function getTextEntries() {
  try {
    const result = await chrome.storage.local.get(['textEntries']);
    const entries = result.textEntries || [];
    
    console.log(`📚 Retrieved ${entries.length} text entries`);
    
    return { 
      success: true, 
      entries: entries 
    };
    
  } catch (error) {
    console.error('❌ Error getting text entries:', error);
    return { 
      success: false, 
      error: error.message,
      entries: []
    };
  }
}

// Search entries by keywords
async function searchKeywords(query) {
  try {
    console.log(`🔍 Searching keywords: "${query}"`);
    
    if (!query || query.trim() === '') {
      return { success: true, results: [] };
    }
    
    const result = await chrome.storage.local.get(['textEntries']);
    const entries = result.textEntries || [];
    
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    
    const results = entries.filter(entry => {
      const title = (entry.title || '').toLowerCase();
      const text = (entry.text || '').toLowerCase();
      const url = (entry.url || '').toLowerCase();
      
      // Check if all search terms are found in title, text, or URL
      return searchTerms.every(term => 
        title.includes(term) || 
        text.includes(term) || 
        url.includes(term)
      );
    });
    
    console.log(`📊 Found ${results.length} keyword matches`);
    
    return { 
      success: true, 
      results: results,
      query: query,
      searchType: 'keyword'
    };
    
  } catch (error) {
    console.error('❌ Error searching keywords:', error);
    return { 
      success: false, 
      error: error.message,
      results: []
    };
  }
}

// Search entries by similarity
async function searchSimilar(query, options = {}) {
  try {
    console.log(`🧠 Searching similar content: "${query}"`);
    
    if (!query || query.trim() === '') {
      return { success: true, results: [] };
    }
    
    // Use embeddings module if available
    if (typeof findSimilarEntries === 'function') {
      const result = await findSimilarEntries(query, options);
      if (result.success) {
        console.log(`📊 Found ${result.results.length} similar entries`);
        return {
          success: true,
          results: result.results,
          query: query,
          searchType: 'similarity',
          stats: result.stats
        };
      }
    }
    
    // Fallback to keyword search if embeddings not available
    console.log('⚠️ Embeddings not available, falling back to keyword search');
    return await searchKeywords(query);
    
  } catch (error) {
    console.error('❌ Error searching similar content:', error);
    
    // Fallback to keyword search on error
    try {
      return await searchKeywords(query);
    } catch (fallbackError) {
      console.error('❌ Fallback search also failed:', fallbackError);
      return { 
        success: false, 
        error: error.message,
        results: []
      };
    }
  }
}

// Clear all entries
async function clearAllEntries() {
  try {
    console.log('🗑️ Clearing all text entries...');
    
    await chrome.storage.local.set({ textEntries: [] });
    
    // Clear embeddings if available
    if (typeof clearEmbeddings === 'function') {
      clearEmbeddings();
    }
    
    console.log('✅ All entries cleared successfully');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error clearing entries:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Get storage statistics
async function getStorageStats() {
  try {
    const result = await chrome.storage.local.get(['textEntries']);
    const entries = result.textEntries || [];
    
    const totalWords = entries.reduce((sum, entry) => sum + (entry.wordCount || 0), 0);
    
    let similarityStats = null;
    if (typeof getSimilarityStats === 'function') {
      const simStats = getSimilarityStats();
      if (simStats.success) {
        similarityStats = simStats.stats;
      }
    }
    
    const stats = {
      totalEntries: entries.length,
      totalWords: totalWords,
      averageWordsPerEntry: entries.length > 0 ? Math.round(totalWords / entries.length) : 0,
      oldestEntry: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
      newestEntry: entries.length > 0 ? entries[0].timestamp : null,
      similarity: similarityStats
    };
    
    console.log('📊 Storage stats:', stats);
    
    return { 
      success: true, 
      stats: stats 
    };
    
  } catch (error) {
    console.error('❌ Error getting storage stats:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

console.log('✅ Background script loaded successfully'); 