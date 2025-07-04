// Background script (Service Worker) for Manifest V3
console.log('🚀 Text Grabber Extension - Background script starting...');

// NotebookLM Configuration
const NOTEBOOKLM_CONFIG = {
  GOOGLE_DRIVE_FOLDER: 'SmartGrab-NotebookLM-Exports',
  MAX_SOURCES_PER_NOTEBOOK: 50,
  MAX_WORDS_PER_EXPORT: 200000,
  EXPORT_FORMATS: {
    INDIVIDUAL: 'individual',
    BULK: 'bulk',
    THEMED: 'themed'
  }
};

// No external module imports needed for NotebookLM integration

// Configuration will be updated for NotebookLM integration

// Function to clear all persistent storage and error states
async function clearPersistentState() {
  try {
    console.log('🧹 Clearing persistent state on extension reload...');
    
    // Clear all chrome.storage data except for actual entries and API key
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
    
    // Clear only error-related and temporary state
    for (const key of keysToClear) {
      if (currentStorage[key] !== undefined) {
        await chrome.storage.local.remove(key);
        console.log(`🗑️ Cleared ${key} from storage`);
      }
    }
    
    console.log('✅ Persistent state cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing persistent state:', error);
  }
}

// Simple initialization for NotebookLM integration
async function initializeModules() {
  try {
    console.log('📚 Initializing for NotebookLM integration...');
    
    // Clear persistent state first
    await clearPersistentState();
    
    console.log('✅ Initialization completed successfully');
    
  } catch (error) {
    console.error('❌ Error during initialization:', error);
    throw error;
  }
}

// Simple startup check
try {
  console.log('✅ Background script loaded successfully');
  console.log('Chrome runtime available:', !!chrome.runtime);
  console.log('Chrome storage available:', !!chrome.storage);
  console.log('Chrome tabs available:', !!chrome.tabs);
  console.log('Chrome commands available:', !!chrome.commands);
  console.log('Chrome scripting available:', !!chrome.scripting);
} catch (error) {
  console.error('❌ Error during background script startup:', error);
}

// Extension lifecycle events
chrome.runtime.onStartup.addListener(() => {
  console.log('📱 Extension startup event');
  initializeModules().catch(console.error);
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('📦 Extension installed/updated event');
  
  // Log available commands
  chrome.commands.getAll((commands) => {
    console.log('📋 Available commands:', commands);
  });
  
  // Initialize modules on install
  initializeModules().catch(console.error);
});

// Handle side panel - open when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  console.log('🔧 Extension icon clicked, opening side panel');
  
  try {
    // Open the side panel if the API is available
    if (chrome.sidePanel && chrome.sidePanel.open) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    console.log('✅ Side panel opened successfully');
    } else {
      console.warn('⚠️ chrome.sidePanel.open is not available in this Chrome version. Please open the side panel manually.');
    }
  } catch (error) {
    console.error('❌ Error opening side panel:', error);
  }
});

// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener((command) => {
  console.log('⌨️ *** KEYBOARD COMMAND RECEIVED ***:', command);
  
  if (command === 'trigger_action') {
    console.log('🎯 Trigger action command detected - starting text extraction...');
    // Get the active tab and extract text
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        console.log('📄 Active tab found:', tabs[0].url);
        extractAndSavePageText(tabs[0]);
      } else {
        console.log('❌ No active tab found');
      }
    });
  } else {
    console.log('❓ Unknown command received:', command);
  }
});

// Function to ensure content script is injected
async function ensureContentScript(tabId) {
  try {
    console.log('🔍 Checking if content script exists on tab:', tabId);
    // Try to ping the content script first
    const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    if (response && response.status === 'ready') {
      console.log('✅ Content script already loaded');
      return true; // Content script is already loaded
    }
  } catch (error) {
    // Content script not loaded, inject it
    console.log('📥 Content script not found, injecting...', error.message);
  }
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    console.log('✅ Content script injected successfully');
    
    // Wait a moment for the script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  } catch (error) {
    console.error('❌ Failed to inject content script:', error);
    return false;
  }
}

// Function to extract and save page text
async function extractAndSavePageText(tab) {
  try {
    console.log('📄 Starting text extraction from:', tab.url);
    
    // Initialize if needed
      await initializeModules();
    
    // Check if this is a supported page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      console.log('⚠️ Cannot extract text from system pages');
      showNotification('❌ Cannot extract text from system pages');
      return;
    }
    
    // Ensure content script is loaded
    const scriptReady = await ensureContentScript(tab.id);
    if (!scriptReady) {
      console.log('❌ Could not load content script');
      showNotification('❌ Could not load content script');
      return;
    }
    
    console.log('📤 Sending extract_text message to content script...');
    // Send message to content script to extract visible text
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'extract_text'
    }).catch(error => {
      console.log('❌ Content script communication failed:', error.message);
      return null;
    });
    
    console.log('📥 Received response from content script:', response ? 'Success' : 'Failed');
    
    if (response && response.text) {
      console.log(`📝 Text extracted: ${response.text.length} characters`);
      
      // Create entry object
      const entry = {
        id: Date.now(), // Simple ID based on timestamp
        url: tab.url,
        title: tab.title,
        text: response.text,
        timestamp: new Date().toISOString(),
        wordCount: response.text.split(/\s+/).filter(word => word.length > 0).length
      };
      
      console.log('💾 Saving entry...');
      await saveTextEntry(entry);
      
      // Show success notification - this is handled later in saveTextEntry based on whether it's new or replacement
      
      console.log('✅ Text entry saved successfully:', {
        id: entry.id,
        url: entry.url,
        wordCount: entry.wordCount,
        timestamp: entry.timestamp
      });
      
    } else {
      console.log('❌ No text extracted from page');
      showNotification('❌ No text found on this page');
    }
    
  } catch (error) {
    console.error('❌ Error extracting text:', error);
    showNotification('❌ Error extracting text: ' + error.message);
  }
}

// Function to ask user if they want to replace existing entry
async function askUserForReplacement(newEntry, existingEntry) {
  try {
    console.log('❓ Asking user for replacement decision...');
    
    // Get the active tab to show the confirmation
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      console.log('❌ No active tab found for user prompt');
      return false;
    }
    
    // Ensure content script is loaded
    await ensureContentScript(tabs[0].id);
    
    // Prepare the confirmation message
    const existingDate = new Date(existingEntry.timestamp).toLocaleDateString();
    const newWordCount = newEntry.wordCount;
    const existingWordCount = existingEntry.wordCount;
    
    const message = `📄 You already have this page saved!\n\n` +
      `Existing: ${existingEntry.title}\n` +
      `Saved: ${existingDate} (${existingWordCount} words)\n\n` +
      `New version: ${newWordCount} words\n\n` +
      `Replace with new version?`;
    
    // Send confirmation request to content script
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'confirm_replacement',
      message: message
    });
    
    console.log('✅ User response received:', response?.replace ? 'Replace' : 'Keep existing');
    return response?.replace || false;
    
  } catch (error) {
    console.error('❌ Error asking user for replacement:', error);
    // Default to not replacing if we can't ask
    return false;
  }
}

// Function to save text entry to SQLite database
async function saveTextEntry(entry) {
  try {
    console.log('💾 Saving entry...');
    console.log('🔍 DEBUG: Entry to save:', { id: entry.id, title: entry.title, wordCount: entry.wordCount });
    
    // Clean the text using AI before saving
    console.log('🧹 Cleaning text before saving to local storage...');
    const cleanedText = await cleanTextForSemanticSearch(entry.text);
    
    if (!cleanedText || cleanedText.trim().length === 0) {
      console.log('⚠️ No meaningful content after cleaning, skipping save');
      showNotification('⚠️ No meaningful content found to save');
      return;
    }
    
    // Update the entry with cleaned text
    const cleanedEntry = {
      ...entry,
      text: cleanedText,
      wordCount: cleanedText.split(/\s+/).filter(word => word.length > 0).length
    };
    
    console.log('📊 Text cleaned:', {
      originalLength: entry.text.length,
      cleanedLength: cleanedText.length,
      reduction: Math.round((1 - cleanedText.length / entry.text.length) * 100) + '%'
    });
    
    // Check for duplicates first
    console.log('🔍 Checking for duplicates...');
    const result = await chrome.storage.local.get(['textEntries']);
    const existingEntries = result.textEntries || [];
    console.log('🔍 DEBUG: Existing entries in storage:', existingEntries.length);
    
    // Find duplicate by URL
    const duplicateEntry = existingEntries.find(existing => existing.url === cleanedEntry.url);
    
    if (duplicateEntry) {
      console.log('⚠️ Duplicate found for URL:', cleanedEntry.url);
      console.log('🔍 DEBUG: Existing entry:', { id: duplicateEntry.id, title: duplicateEntry.title, wordCount: duplicateEntry.wordCount });
      
      // Show notification about duplicate and ask user
      const userChoice = await askUserForReplacement(cleanedEntry, duplicateEntry);
      
      if (!userChoice) {
        console.log('ℹ️ User chose to keep existing entry');
        showNotification(`📄 Keeping ${duplicateEntry.title}`);
        return;
      }
      
      console.log('🔄 User chose to replace existing entry');
      
      // Remove existing embedding since we're replacing the entry
      try {
        const embeddingResult = await chrome.storage.local.get(['embeddings']);
        const existingEmbeddings = embeddingResult.embeddings || {};
        if (existingEmbeddings[duplicateEntry.id]) {
          delete existingEmbeddings[duplicateEntry.id];
          await chrome.storage.local.set({ embeddings: existingEmbeddings });
          console.log('🗑️ AUTO-EMBEDDING: Removed old embedding for replaced entry');
        }
      } catch (error) {
        console.warn('⚠️ AUTO-EMBEDDING: Failed to remove old embedding:', error);
      }
    }
    
    // Remove duplicate if exists (either for replacement or initial save)
    const filteredEntries = existingEntries.filter(e => e.url !== cleanedEntry.url);
    filteredEntries.unshift(cleanedEntry);
    
    // Keep only last 100 entries
    if (filteredEntries.length > 100) {
      filteredEntries.splice(100);
    }
    
    await chrome.storage.local.set({ textEntries: filteredEntries });
    
    const isReplacement = !!duplicateEntry;
    
    if (isReplacement) {
      console.log('✅ Entry replaced in chrome.storage, total entries now:', filteredEntries.length);
    } else {
      console.log('✅ Entry saved to chrome.storage, total entries now:', filteredEntries.length);
    }
    
    // Verify the save
    const verification = await chrome.storage.local.get(['textEntries']);
    console.log('🔍 DEBUG: Verification - entries in storage after save:', (verification.textEntries || []).length);
    
    // Show appropriate notification based on whether this is new or replacement
    if (isReplacement) {
      showNotification(`🔄 Replaced ${cleanedEntry.title} (${cleanedEntry.wordCount} words)`);
    } else {
      showNotification(`✅ Saved ${cleanedEntry.wordCount} words from ${cleanedEntry.title} (🧠 generating embedding...)`);
    }
    
    // Entry saved successfully - ready for NotebookLM integration
    
  } catch (error) {
    console.error('❌ Error saving text entry:', error);
    showNotification('❌ Error saving text: ' + error.message);
    throw error;
  }
}

// Function to show notification
async function showNotification(message) {
  console.log('📢 Showing notification:', message);
  
  try {
    // Get the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      // Ensure content script is loaded for notifications
      await ensureContentScript(tabs[0].id);
      
      // Send notification message
      await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'show_notification',
        message: message
      });
      console.log('✅ Notification sent to page');
    }
  } catch (error) {
    console.log('❌ Could not show notification on page:', error.message);
  }
}

// Message handler with full functionality
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received message:', message);
  
  try {
    if (message.action === 'ping') {
      console.log('🏓 Ping received, sending pong');
      sendResponse({ status: 'ok', timestamp: Date.now(), message: 'Background script is working!' });
      return true;
    }
    
    if (message.action === 'get_entries') {
      console.log('📚 Getting entries request');
      handleGetEntries(sendResponse);
      return true;
    }
    
    if (message.action === 'search_keywords') {
      console.log('🔍 Keyword search request:', message.query);
      handleKeywordSearch(message.query, sendResponse);
      return true;
    }
    
    if (message.action === 'search_similar') {
      console.log('🧠 Fallback semantic search request:', message.query);
      handleFallbackSemanticSearch(message.query, message.filters, sendResponse);
      return true;
    }
    
    // Semantic search will be replaced with NotebookLM integration
    
    if (message.action === 'clear_entries') {
      console.log('🗑️ Clearing all entries');
      handleClearEntries(sendResponse);
      return true;
    }
    
    if (message.action === 'get_stats') {
      console.log('📊 Getting stats');
      handleGetStats(sendResponse);
      return true;
    }
    
    if (message.action === 'clear_error_states') {
      console.log('🧹 Clearing error states');
      handleClearErrorStates(sendResponse);
      return true;
    }
    
    if (message.action === 'captureAndOpenNotebookLM') {
      console.log('📄 Capture and open NotebookLM request');
      handleCaptureAndOpenNotebookLM(message.tabId, sendResponse);
      return true;
    }
    
    // importToNotebookLM is now handled by content script
    
    console.log('❓ Unknown message action:', message.action);
    sendResponse({ error: 'Unknown action', received: message });
    
  } catch (error) {
    console.error('❌ Error in message handler:', error);
    sendResponse({ error: error.message, stack: error.stack });
  }
  
  return false;
});

// Handler functions for different message types
async function handleGetEntries(sendResponse) {
  try {
    console.log('📚 DEBUG: handleGetEntries called');
    
    // TEMPORARY: Use chrome.storage directly to bypass SQLite issues
    console.log('💾 DEBUG: Using chrome.storage directly (bypassing SQLite)...');
    const result = await chrome.storage.local.get(['textEntries']);
    const entries = result.textEntries || [];
    console.log('📤 DEBUG: Chrome.storage contains:', entries.length, 'entries');
    console.log('📤 Sending entries to popup:', entries.length);
    sendResponse({ entries });
    
  } catch (error) {
    console.error('❌ DEBUG: Error getting entries from chrome.storage:', error);
    sendResponse({ entries: [], error: error.message });
  }
}

async function handleKeywordSearch(query, sendResponse) {
  try {
    console.log('🔍 DEBUG: Keyword search using chrome.storage...');
    const result = await chrome.storage.local.get(['textEntries']);
    const allEntries = result.textEntries || [];
    
    if (!query) {
      sendResponse({ results: allEntries });
      return;
    }
    
    // Simple keyword search
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    const results = allEntries.filter(entry => {
      const searchableText = [
        entry.title || '',
        entry.url || '',
        entry.text || ''
      ].join(' ').toLowerCase();
      
      return searchTerms.every(term => searchableText.includes(term));
    });
    
    console.log('🎯 Keyword search results:', results.length);
    sendResponse({ results });
  } catch (error) {
    console.error('Error in keyword search:', error);
    sendResponse({ results: [], error: error.message });
  }
}

// Semantic search functionality will be replaced with NotebookLM integration

// Semantic answer generation removed - will be replaced with NotebookLM integration

// GPT-4 answer generation removed - will be replaced with NotebookLM integration

// Direct OpenAI answer generation removed - will be replaced with NotebookLM integration

// Server response parsing removed - will be replaced with NotebookLM integration

// GPT-4 response parsing removed - will be replaced with NotebookLM integration

// All semantic search helper functions removed - will be replaced with NotebookLM integration

// Apply time-based filtering in backend
function applyTimeFilterBackend(entries, filters) {
  const now = new Date();
  let cutoffDate;
  
  console.log('⏰ BACKEND TIME FILTER DEBUG:');
  console.log('  - Current time:', now.toISOString());
  console.log('  - Filter type:', filters.timeFilter);
  console.log('  - Input entries count:', entries.length);
  
  switch (filters.timeFilter) {
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
      if (filters.dateFrom && filters.dateTo) {
        const fromDate = new Date(filters.dateFrom);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        
        console.log('  - Custom date range:', fromDate.toISOString(), 'to', toDate.toISOString());
        
        return entries.filter(entry => {
          const entryDate = new Date(entry.timestamp);
          const isInRange = entryDate >= fromDate && entryDate <= toDate;
          console.log('  - Entry:', entry.title || 'Untitled', 'Date:', entryDate.toISOString(), 'In range:', isInRange);
          return isInRange;
        });
      }
      return entries;
    default:
      return entries;
  }
  
  console.log('  - Cutoff date:', cutoffDate.toISOString());
  console.log('  - Checking each entry:');
  
  const filteredEntries = entries.filter(entry => {
    const entryDate = new Date(entry.timestamp);
    const isAfterCutoff = entryDate >= cutoffDate;
    const hoursDiff = (now - entryDate) / (1000 * 60 * 60);
    
    console.log(`    - "${entry.title || 'Untitled'}": ${entryDate.toISOString()} (${hoursDiff.toFixed(1)} hours ago) → ${isAfterCutoff ? 'KEEP' : 'FILTER OUT'}`);
    
    return isAfterCutoff;
  });
  
  console.log('  - Backend filtered entries count:', filteredEntries.length);
  return filteredEntries;
}

// Cosine similarity function
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function handleClearEntries(sendResponse) {
  try {
    console.log('🗑️ DEBUG: Clearing chrome.storage entries and embeddings...');
    await chrome.storage.local.set({ 
      textEntries: [],
      embeddings: {}
    });
    console.log('✅ All entries and embeddings cleared from chrome.storage');
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error clearing entries:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// All embedding-related functions removed - will be replaced with NotebookLM integration

async function handleGetStats(sendResponse) {
  try {
    console.log('📊 Getting stats from chrome.storage...');
    const result = await chrome.storage.local.get(['textEntries']);
    const entries = result.textEntries || [];
    
    // Calculate total word count across all entries
    const totalWords = entries.reduce((sum, entry) => {
      if (entry.wordCount) {
        return sum + entry.wordCount;
      }
      // Fallback: calculate word count if not stored
      return sum + (entry.text ? entry.text.split(/\s+/).filter(word => word.length > 0).length : 0);
    }, 0);
    
    const stats = {
      totalEntries: entries.length,
      totalWords: totalWords
    };
    
    console.log('📊 Chrome.storage stats:', stats);
    sendResponse({ stats });
  } catch (error) {
    console.error('Error getting stats:', error);
    sendResponse({ stats: null, error: error.message });
  }
}

// Handler for clearing error states
async function handleClearErrorStates(sendResponse) {
  try {
    console.log('🧹 Clearing all error states and temporary data...');
    
    // Clear error-related storage keys
    const errorKeys = [
      'lastError',
      'errorState', 
      'searchError',
      'semanticError',
      'searchState',
      'lastSearchResults'
    ];
    
    // Get current storage
    const currentStorage = await chrome.storage.local.get(null);
    
    // Clear error states
    for (const key of errorKeys) {
      if (currentStorage[key] !== undefined) {
        await chrome.storage.local.remove(key);
        console.log(`🗑️ Cleared error state: ${key}`);
      }
    }
    
    console.log('✅ All error states cleared successfully');
    sendResponse({ success: true, message: 'Error states cleared' });
    
  } catch (error) {
    console.error('❌ Error clearing error states:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Global error handlers
self.addEventListener('error', (event) => {
  console.error('🔥 Global error in background script:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('🔥 Unhandled promise rejection in background script:', event.reason);
});

// Vector store upload functionality removed - will be replaced with NotebookLM integration

// Simple text cleaning for NotebookLM integration
async function cleanTextForSemanticSearch(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }
  
  console.log('🧹 Basic text cleaning for NotebookLM...');
  
  // Basic HTML cleanup only (no AI processing)
  const cleanedText = rawText
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove HTML entities
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Replace ampersand entities
    .replace(/&lt;/g, '<') // Replace less than entities
    .replace(/&gt;/g, '>') // Replace greater than entities
    .replace(/&quot;/g, '"') // Replace quote entities
    .replace(/&#39;/g, "'") // Replace apostrophe entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  console.log('📊 Basic cleaned text length:', cleanedText.length);
  return cleanedText;
}

// NotebookLM integration functions will be added here

// Fallback semantic search handler (word overlap)
async function handleFallbackSemanticSearch(query, filters, sendResponse) {
  try {
    console.log('🧠 Performing fallback semantic search...');
    const result = await chrome.storage.local.get(['textEntries']);
    let allEntries = result.textEntries || [];

    // Apply time filter if present
    if (filters && filters.timeFilter && filters.timeFilter !== 'any') {
      allEntries = applyTimeFilterBackend(allEntries, filters);
    }

    if (!query || query.trim().length === 0) {
      sendResponse({ results: allEntries });
      return;
    }
    
    // Tokenize query (remove stopwords, lowercase)
    const stopwords = new Set([
      'the','is','at','which','on','a','an','and','or','for','to','of','in','with','by','as','from','that','this','it','be','are','was','were','has','have','had','but','not','so','if','then','than','too','very','can','will','just','do','does','did','about','into','over','after','before','such','no','yes','you','your','we','our','they','their','i','me','my','he','him','his','she','her','them','us','who','what','when','where','why','how'
    ]);
    const queryWords = query.toLowerCase().split(/\W+/).filter(w => w && !stopwords.has(w));
    if (queryWords.length === 0) {
      sendResponse({ results: [] });
      return;
    }

    // Score entries by word overlap
    const scored = allEntries.map(entry => {
      const text = [entry.title || '', entry.text || ''].join(' ').toLowerCase();
      const entryWords = new Set(text.split(/\W+/).filter(w => w && !stopwords.has(w)));
      let overlap = 0;
      queryWords.forEach(qw => { if (entryWords.has(qw)) overlap++; });
      // Simple similarity: overlap / queryWords.length
      const similarity = queryWords.length > 0 ? overlap / queryWords.length : 0;
      return { ...entry, similarity };
    });

    // Sort by similarity, descending
    scored.sort((a, b) => b.similarity - a.similarity);
    // Only keep entries with some overlap
    const filtered = scored.filter(e => e.similarity > 0);
    // Return top 10
    const topResults = filtered.slice(0, 10);
    console.log('🧠 Fallback semantic search results:', topResults.length);
    sendResponse({ results: topResults });
  } catch (error) {
    console.error('Error in fallback semantic search:', error);
    sendResponse({ results: [], error: error.message });
  }
}

// NotebookLM Export Manager
class NotebookLMExportManager {
  constructor() {
    // Initialize the exporter for direct capture functionality
  }

  // Format article for NotebookLM (for direct capture functionality)
  formatArticleForNotebookLM(article) {
    const content = article.text
      .replace(/\n\s*\n/g, '\n\n') // Clean up extra line breaks
      .trim();
    
    return `# ${article.title}

**Source:** ${article.url}  
**Captured:** ${new Date(article.timestamp).toLocaleString()}  
**Word Count:** ${article.wordCount}

---

${content}

---

*Captured by SmartGrab - NotebookLM Connector*`;
  }
}

// Initialize NotebookLM Export Manager
const notebookLMExporter = new NotebookLMExportManager();

// Export Status Handler
async function handleGetExportStatus(sendResponse) {
  try {
    const exportHistory = await getExportHistory();
    sendResponse({ 
      success: true, 
      driveAuthenticated: false, // Always false since we removed Google Drive
      exportHistory: exportHistory
    });
  } catch (error) {
    console.error('❌ Error getting export status:', error);
    sendResponse({
      success: false,
      error: error.message,
      driveAuthenticated: false, // Always false since we removed Google Drive
      exportHistory: []
    });
  }
}

async function handleCaptureAndOpenNotebookLM(tabId, sendResponse) {
  try {
    console.log('📄 Capturing and opening NotebookLM for tab:', tabId);
    
    // Get the tab information
    const tab = await chrome.tabs.get(tabId);
    console.log('🔍 Tab URL:', tab.url);
    
    // Check if this is a supported page
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:') ||
        tab.url.startsWith('moz-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url === 'about:blank') {
      sendResponse({ 
        success: false, 
        error: 'Cannot capture system pages. Please navigate to a regular webpage (http:// or https://) and try again.' 
      });
      return;
    }

    // Check if URL is a regular web page
    if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
      sendResponse({ 
        success: false, 
        error: 'Please navigate to a regular webpage (starting with http:// or https://) and try again.' 
      });
      return;
    }
    
    // Ensure content script is loaded
    await ensureContentScript(tabId);
    
    // Extract page content
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'extract_text'
    });
    
    if (response && response.success) {
      const article = {
        id: Date.now(),
        title: response.title || tab.title,
        url: tab.url,
        text: response.text,
        timestamp: new Date().toISOString(),
        wordCount: response.text.split(' ').length
      };
      
      // Save to local storage
      await saveTextEntry(article);
      
      // Format content for NotebookLM using the exporter
      const notebookLMExporter = new NotebookLMExportManager();
      const markdownContent = notebookLMExporter.formatArticleForNotebookLM(article);
      
      // Store the content for the popup to access
      await chrome.storage.local.set({ 
        lastCapturedContent: markdownContent,
        lastCapturedArticle: article
      });
      
      // Open NotebookLM in a new tab
      await chrome.tabs.create({
        url: 'https://notebooklm.google.com/',
        active: true
      });
      
      // Show success notification
      showNotification(`✅ Captured: ${article.title}`);
      
      sendResponse({ success: true, article: article });
      
    } else {
      sendResponse({ 
        success: false, 
        error: 'Failed to extract content from this page. The page might not be fully loaded or may have restrictions.' 
      });
    }
    
  } catch (error) {
    console.error('❌ Error capturing and opening NotebookLM:', error);
    
    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.message.includes('Could not establish connection')) {
      errorMessage = 'Unable to connect to the page. Please refresh the page and try again.';
    } else if (error.message.includes('Receiving end does not exist')) {
      errorMessage = 'Page is not ready for capture. Please refresh the page and try again.';
    }
    
    sendResponse({ success: false, error: errorMessage });
  }
}

async function handleImportToNotebookLM(articles, sendResponse) {
  try {
    console.log('📚 Importing articles to NotebookLM:', articles.length);
    
    if (!articles || articles.length === 0) {
      sendResponse({ success: false, error: 'No articles provided for import' });
      return;
    }
    
    // Limit to reasonable number for NotebookLM
    if (articles.length > 20) {
      sendResponse({ 
        success: false, 
        error: 'Too many articles selected. Please select 20 or fewer articles for optimal performance.' 
      });
      return;
    }
    
    // Prepare the import payload (mimic official NotebookLM Web Importer)
    const sources = articles.map(article => ({
      title: article.title,
      url: article.url,
      text: article.text,
      timestamp: article.timestamp
    }));
    
    // Encode the sources as a base64 JSON string for transfer
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(sources))));
    
    // Open NotebookLM import page with the payload as a query param
    const importUrl = `https://notebooklm.google.com/import?sources=${payload}`;
    await chrome.tabs.create({ url: importUrl, active: true });
    
    sendResponse({ 
      success: true, 
      articleCount: articles.length,
      message: `Successfully sent ${articles.length} articles to NotebookLM for import`,
      instructions: 'NotebookLM will open in a new tab and import your sources.'
    });
    
  } catch (error) {
    console.error('❌ Error importing to NotebookLM:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Export Record Management
async function saveExportRecord(exportRecord) {
  try {
    const result = await chrome.storage.local.get(['exportHistory']);
    const history = result.exportHistory || [];
    
    history.unshift(exportRecord);
    
    // Keep only last 50 export records
    if (history.length > 50) {
      history.splice(50);
    }
    
    await chrome.storage.local.set({ exportHistory: history });
    console.log('✅ Export record saved');
  } catch (error) {
    console.error('❌ Error saving export record:', error);
  }
}

async function getExportHistory() {
  try {
    const result = await chrome.storage.local.get(['exportHistory']);
    return result.exportHistory || [];
  } catch (error) {
    console.error('❌ Error getting export history:', error);
    return [];
  }
}

console.log('🎉 Background script setup complete'); 