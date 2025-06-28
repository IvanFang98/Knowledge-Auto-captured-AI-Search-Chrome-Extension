// Background script (Service Worker) for Manifest V3
console.log('🚀 Text Grabber Extension - Background script starting...');

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
  clearPersistentState().catch(console.error);
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('📦 Extension installed/updated event');
  
  // Log available commands
  chrome.commands.getAll((commands) => {
    console.log('📋 Available commands:', commands);
  });
  
  // Clear persistent state on install
  clearPersistentState().catch(console.error);
});

// Handle side panel - open when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  console.log('🔧 Extension icon clicked, opening side panel');
  
  try {
    // Open the side panel
    await chrome.sidePanel.open({ windowId: tab.windowId });
    console.log('✅ Side panel opened successfully');
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
      
      console.log('💾 Saving entry to storage...');
      // Save to chrome.storage
      await saveTextEntry(entry);
      
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

// Function to save text entry to chrome.storage
async function saveTextEntry(entry) {
  try {
    console.log('💾 Saving entry...');
    console.log('🔍 DEBUG: Entry to save:', { id: entry.id, title: entry.title, wordCount: entry.wordCount });
    
    // Check for duplicates first
    console.log('🔍 Checking for duplicates...');
    const result = await chrome.storage.local.get(['textEntries']);
    const existingEntries = result.textEntries || [];
    console.log('🔍 DEBUG: Existing entries in storage:', existingEntries.length);
    
    // Find duplicate by URL
    const duplicateEntry = existingEntries.find(existing => existing.url === entry.url);
    
    if (duplicateEntry) {
      console.log('⚠️ Duplicate found for URL:', entry.url);
      console.log('🔍 DEBUG: Existing entry:', { id: duplicateEntry.id, title: duplicateEntry.title, wordCount: duplicateEntry.wordCount });
      
      // Show notification about duplicate and ask user
      const userChoice = await askUserForReplacement(entry, duplicateEntry);
      
      if (!userChoice) {
        console.log('ℹ️ User chose to keep existing entry');
        showNotification(`📄 Keeping ${duplicateEntry.title}`);
        return;
      }
      
      console.log('🔄 User chose to replace existing entry');
    }
    
    // Remove duplicate if exists (either for replacement or initial save)
    const filteredEntries = existingEntries.filter(e => e.url !== entry.url);
    filteredEntries.unshift(entry);
    
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
      showNotification(`🔄 Replaced ${entry.title} (${entry.wordCount} words)`);
    } else {
      showNotification(`✅ Saved ${entry.wordCount} words from ${entry.title}`);
    }
    
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

// Message handler with simplified functionality
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
    
    if (message.action === 'clear_entries') {
      console.log('🗑️ Clearing all entries');
      handleClearEntries(sendResponse);
      return true;
    }
    
    if (message.action === 'get_stats') {
      console.log('📊 Getting storage stats');
      handleGetStats(sendResponse);
      return true;
    }
    
    console.log('❓ Unknown message action:', message.action);
    sendResponse({ error: 'Unknown action' });
    
  } catch (error) {
    console.error('❌ Error handling message:', error);
    sendResponse({ error: error.message });
  }
  
  return false;
});

// Handle get entries
async function handleGetEntries(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['textEntries']);
    const entries = result.textEntries || [];
    console.log(`📚 Retrieved ${entries.length} entries from chrome.storage`);
    
    sendResponse({
      success: true,
      entries: entries
    });
    
  } catch (error) {
    console.error('❌ Error getting entries:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Handle keyword search
async function handleKeywordSearch(query, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['textEntries']);
    const allEntries = result.textEntries || [];
    
    if (!query || query.trim() === '') {
      sendResponse({
        success: true,
        results: allEntries
      });
      return;
    }
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    const results = allEntries.filter(entry => {
      const searchableText = [
        entry.title || '',
        entry.url || '',
        entry.text || ''
      ].join(' ').toLowerCase();
      
      return searchTerms.every(term => searchableText.includes(term));
    });
    
    console.log(`🎯 Keyword search found ${results.length} results for "${query}"`);
    
    sendResponse({
      success: true,
      results: results
    });
    
  } catch (error) {
    console.error('❌ Error in keyword search:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Handle clear entries
async function handleClearEntries(sendResponse) {
  try {
    await chrome.storage.local.set({ textEntries: [] });
    console.log('✅ All entries cleared from chrome.storage');
    
    sendResponse({
      success: true,
      message: 'All entries cleared'
    });
    
  } catch (error) {
    console.error('❌ Error clearing entries:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Handle get stats
async function handleGetStats(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['textEntries']);
    const entries = result.textEntries || [];
    
    const totalWords = entries.reduce((sum, entry) => sum + (entry.wordCount || 0), 0);
    
    sendResponse({
      success: true,
      stats: {
        totalEntries: entries.length,
        totalWords: totalWords,
        storageType: 'chrome.storage.local'
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

console.log('🎉 Background script setup complete'); 