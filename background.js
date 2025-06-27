// Background script (Service Worker) for Manifest V3
console.log('🚀 Text Grabber Extension - Background script starting...');

// Import modules using importScripts (service worker compatible)
try {
  importScripts('./embeddings.js');
  console.log('📚 Modules imported successfully');
} catch (error) {
  console.error('❌ Error importing modules:', error);
}

// Get global instances
let embeddingsService = null;

// Server configuration
const SERVER_CONFIG = {
  baseUrl: 'http://localhost:3000',
  enabled: true, // Enable server since it's working perfectly
  vectorStoreInitialized: false // Track if vector store is initialized
};

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

// Initialize modules
async function initializeModules() {
  try {
    console.log('📚 Initializing database and embeddings modules...');
    
    // Clear persistent state first
    await clearPersistentState();
    
    // Get global instances
    embeddingsService = self.embeddingsService;
    
    if (!embeddingsService) {
      throw new Error('Failed to load required modules');
    }
    
    // Initialize embeddings service only
    await embeddingsService.initialize();
    
    console.log('✅ All modules initialized successfully');
    
  } catch (error) {
    console.error('❌ Error initializing modules:', error);
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
    
    // Ensure modules are initialized
    if (!embeddingsService) {
      console.log('🔄 Initializing modules first...');
      await initializeModules();
    }
    
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
      
      console.log('💾 Saving entry to database...');
      // Save to SQLite database
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
    
    // Automatically generate embedding for the new entry
    try {
      console.log('🧠 AUTO-EMBEDDING: Generating embedding for new entry...');
      await generateEmbeddingForEntry(cleanedEntry);
      console.log('✅ AUTO-EMBEDDING: Embedding generated successfully');
    } catch (error) {
      console.error('⚠️ AUTO-EMBEDDING: Failed to generate embedding (non-critical):', error);
      // Don't throw error - embedding failure shouldn't break the save process
    }
    
    // Upload to persistent vector store (now with already cleaned text)
    try {
      console.log('📤 Uploading to persistent vector store...');
      await uploadDocumentsToVectorStore([cleanedEntry]);
    } catch (error) {
      console.error('⚠️ Failed to upload to vector store (non-critical):', error);
      // Don't throw error - vector store failure shouldn't break the save process
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
      console.log('🧠 Semantic search request:', message.query);
      handleSemanticSearch(message.query, sendResponse, message.filters);
      return true;
    }
    
    if (message.action === 'clear_entries') {
      console.log('🗑️ Clearing all entries');
      handleClearEntries(sendResponse);
      return true;
    }
    
    if (message.action === 'set_api_key') {
      console.log('🔑 Setting API key');
      handleSetApiKey(message.apiKey, sendResponse);
      return true;
    }
    
    if (message.action === 'get_stats') {
      console.log('📊 Getting database stats');
      handleGetStats(sendResponse);
      return true;
    }
    
    if (message.action === 'generate_embeddings') {
      console.log('🧠 Generating embeddings for all entries');
      handleGenerateEmbeddings(sendResponse);
      return true;
    }
    
    if (message.action === 'regenerate_embeddings') {
      console.log('🔄 Regenerating all embeddings with OpenAI');
      handleRegenerateEmbeddings(sendResponse);
      return true;
    }
    
    if (message.action === 'clear_error_states') {
      console.log('🧹 Clearing error states');
      handleClearErrorStates(sendResponse);
      return true;
    }
    
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

async function handleSemanticSearch(query, sendResponse, filters = null) {
  try {
    console.log('🧠 Starting semantic search with query:', query);
    console.log('📊 Query type:', typeof query);
    console.log('📊 Query value:', query);
    
    // Add protection against null/undefined query
    if (!query || typeof query !== 'string') {
      console.warn('⚠️ handleSemanticSearch received invalid query:', query);
      sendResponse({ success: false, error: 'Invalid query provided' });
      return;
    }
    
    // Get all entries for semantic search from chrome.storage.local
    const result = await chrome.storage.local.get(['textEntries']);
    const allEntries = result.textEntries || [];
    console.log(`📚 Found ${allEntries.length} total entries for semantic search`);
    
    // Apply time filter if specified
    let candidateEntries = allEntries;
    if (filters && filters.timeFilter && filters.timeFilter !== 'any') {
      console.log('⏰ Applying time filter:', filters.timeFilter);
      candidateEntries = applyTimeFilterBackend(allEntries, filters);
      console.log(`📊 After time filter: ${candidateEntries.length} entries`);
    }
    
    if (candidateEntries.length === 0) {
      console.log('❌ No entries found after filtering');
      sendResponse({ success: true, results: [] });
      return;
    }
    
    // Generate semantic answers using GPT-4
    console.log('🤖 Generating semantic answers...');
    const semanticResults = await generateSemanticAnswers(query, candidateEntries);
    console.log(`✅ Generated ${semanticResults.length} semantic results`);
    
    sendResponse({ success: true, results: semanticResults });
    
  } catch (error) {
    console.error('❌ Error in semantic search:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Generate semantic answers by extracting relevant sentences from top documents
async function generateSemanticAnswers(query, candidateEntries) {
  console.log('🧠 Generating cohesive semantic answer with GPT-4...');
  console.log('📊 Input query:', query);
  console.log('📊 Input query type:', typeof query);
  console.log('📊 Candidate entries count:', candidateEntries?.length || 0);
  
  // Add protection against null/undefined inputs
  if (!query || typeof query !== 'string') {
    console.warn('⚠️ generateSemanticAnswers received invalid query:', query);
    return [];
  }
  
  if (!candidateEntries || !Array.isArray(candidateEntries)) {
    console.warn('⚠️ generateSemanticAnswers received invalid candidateEntries:', candidateEntries);
    return [];
  }
  
  console.log('✅ Input validation passed');
  
  // Collect all relevant sentences from all documents
  const allRelevantSentences = [];
  
  for (const entry of candidateEntries) {
    try {
      console.log('📄 Processing entry:', entry?.id || 'unknown');
      
      // Add protection against invalid entry structure
      if (!entry || typeof entry !== 'object') {
        console.warn('⚠️ Invalid entry structure in generateSemanticAnswers:', entry);
        continue;
      }
      
      const entryText = entry.text || '';
      if (!entryText || typeof entryText !== 'string') {
        console.warn('⚠️ Invalid entry text in generateSemanticAnswers:', entryText);
        continue;
      }
      
      console.log(`📝 Entry text length: ${entryText.length} characters`);
      
      const relevantSentences = extractRelevantSentencesForQuery(entryText, query);
      console.log(`📋 Found ${relevantSentences.length} relevant sentences for this entry`);
      
      for (const sentence of relevantSentences) {
        const sentenceScore = calculateSentenceRelevance(sentence, tokenizeQuery(query), query);
        allRelevantSentences.push({
          text: sentence.trim(),
          score: sentenceScore,
          sourceEntry: entry,
          sourceId: entry.id || 'unknown',
          sourceTitle: entry.title || 'Unknown',
          sourceUrl: entry.url || ''
        });
      }
    } catch (error) {
      console.error('Error extracting sentences from entry:', entry?.id || 'unknown', error);
    }
  }
  
  console.log(`📊 Total relevant sentences collected: ${allRelevantSentences.length}`);
  
  if (allRelevantSentences.length === 0) {
    console.log('❌ No relevant sentences found, returning empty results');
    return [];
  }
  
  // Sort all sentences by relevance score
  allRelevantSentences.sort((a, b) => b.score - a.score);
  
  // Take the best sentences for answer generation
  const topSentences = allRelevantSentences.slice(0, 8);
  console.log(`📋 Using top ${topSentences.length} sentences for answer generation`);

  // From the top sentences, get the unique source entries (documents)
  const sourceEntriesMap = new Map();
  topSentences.forEach(sentence => {
    // Add protection for sourceEntry
    if (sentence && sentence.sourceEntry && sentence.sourceId && !sourceEntriesMap.has(sentence.sourceId)) {
      sourceEntriesMap.set(sentence.sourceId, sentence.sourceEntry);
    }
  });
  const uniqueSourceEntries = Array.from(sourceEntriesMap.values());
  console.log(`📚 Using ${uniqueSourceEntries.length} unique source documents for context.`);
  
  // If we have no documents, we can't generate an answer
  if (uniqueSourceEntries.length === 0) {
    console.log('❌ No source documents found for the top sentences, returning empty results');
    return [];
  }
  
  // Generate a cohesive answer with GPT-4, passing both full docs and top sentences
  console.log('🤖 Calling generateCohesiveAnswerWithGPT4...');
  const cohesiveAnswer = await generateCohesiveAnswerWithGPT4(query, uniqueSourceEntries, topSentences);
  console.log('✅ Received cohesive answer from GPT-4');
  
  // Return a single result object representing the complete answer
  return [{
    id: 'semantic-answer',
    title: `Answer: ${query}`,
    url: 'semantic-search://ai-generated-answer',
    text: cohesiveAnswer.fullAnswer,
    timestamp: new Date().toISOString(),
    wordCount: cohesiveAnswer.fullAnswer.split(' ').length,
    isSemanticAnswer: true,
    isCohesiveAnswer: true,
    cohesiveAnswer: cohesiveAnswer.bulletPoints,
    references: cohesiveAnswer.references,
    answerScore: 1.0,
    similarity: 1.0,
    generatedByAI: true
  }];
}

// Generate a cohesive answer using GPT-4 via your server (with vector store)
async function generateCohesiveAnswerWithGPT4(query, sourceEntries, relevantSentences) {
  try {
    // Add protection against null/undefined inputs
    if (!query || typeof query !== 'string') {
      console.warn('⚠️ generateCohesiveAnswerWithGPT4 received invalid query:', query);
      return generateCohesiveAnswerFallback('general query', relevantSentences || []);
    }
    
    if (!sourceEntries || !Array.isArray(sourceEntries) || sourceEntries.length === 0) {
      console.warn('⚠️ generateCohesiveAnswerWithGPT4 received no sourceEntries, falling back.');
      return generateCohesiveAnswerWithDirectOpenAI(query, relevantSentences);
    }
    
    if (!relevantSentences || !Array.isArray(relevantSentences)) {
      console.warn('⚠️ generateCohesiveAnswerWithGPT4 received invalid relevantSentences:', relevantSentences);
      return generateCohesiveAnswerFallback(query, []);
    }
    
    // Check if server is enabled
    if (!SERVER_CONFIG.enabled) {
      console.log('⚙️ Server disabled, using direct OpenAI API...');
      return generateCohesiveAnswerWithDirectOpenAI(query, relevantSentences);
    }
    
    console.log('🚀 Using persistent vector store for enhanced search...');
    
    // Call the persistent vector store search API (no need to send documents)
    const response = await fetch(`${SERVER_CONFIG.baseUrl}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query
      })
    });

    if (!response.ok) {
      console.error('🚨 Server API error:', response.status, response.statusText);
      console.log('🔄 Falling back to direct OpenAI API...');
      return generateCohesiveAnswerWithDirectOpenAI(query, relevantSentences);
    }

    const data = await response.json();
    console.log('✅ Server generated answer:', data.answer);
    console.log('📄 Server cleaned content available:', !!data.cleanedContent);
    
    // Convert server response to our format using the cleaned content from server
    const result = parseServerResponse(data.answer, relevantSentences, data.cleanedContent);
    console.log('🔗 Server response parsed. Bullet points with links:', result.bulletPoints.length);
    return result;
    
  } catch (error) {
    console.error('🚨 Error connecting to server:', error);
    console.log('🔄 Falling back to direct OpenAI API...');
    return generateCohesiveAnswerWithDirectOpenAI(query, relevantSentences);
  }
}

// Fallback to direct OpenAI API when server is unavailable
async function generateCohesiveAnswerWithDirectOpenAI(query, relevantSentences) {
  try {
    // Add protection against null/undefined inputs
    if (!query || typeof query !== 'string') {
      console.warn('⚠️ generateCohesiveAnswerWithDirectOpenAI received invalid query:', query);
      return generateCohesiveAnswerFallback('general query', relevantSentences || []);
    }
    
    if (!relevantSentences || !Array.isArray(relevantSentences)) {
      console.warn('⚠️ generateCohesiveAnswerWithDirectOpenAI received invalid relevantSentences:', relevantSentences);
      return generateCohesiveAnswerFallback(query, []);
    }
    
    // Check if we have an API key
    if (!embeddingsService || !embeddingsService.hasApiKey()) {
      console.log('⚠️ No OpenAI API key available, falling back to rule-based answer generation');
      return generateCohesiveAnswerFallback(query, relevantSentences);
    }
    
    console.log('🔄 Server unavailable, using direct OpenAI API...');
    
    // Prepare the context with numbered references
    const contextWithReferences = relevantSentences.map((sentence, index) => {
      // Add protection against invalid sentence structure
      if (!sentence || typeof sentence !== 'object') {
        console.warn('⚠️ Invalid sentence structure in context preparation:', sentence);
        return `[${index + 1}] "Unknown text" (Source: Unknown)`;
      }
      
      const sentenceText = sentence.text || sentence || 'Unknown text';
      const sourceTitle = sentence.sourceTitle || 'Unknown';
      
      return `[${index + 1}] "${sentenceText}" (Source: ${sourceTitle})`;
    }).join('\n\n');
    
    const prompt = `You are an expert knowledge synthesizer. Based on the provided context, generate a cohesive answer to the user's question.

INSTRUCTIONS:
- Write 3-5 clear, concise bullet points that directly answer the question
- Synthesize information from the sources rather than just copying sentences
- Each bullet point should end with reference numbers in brackets like [1] [2]
- Use multiple references per bullet point when combining information
- Make the answer coherent and well-structured
- Keep each bullet point to 1-2 sentences maximum

QUESTION: ${query}

CONTEXT:
${contextWithReferences}

Please provide your answer in this exact format:
• [First synthesized point combining relevant information] [reference numbers]
• [Second synthesized point] [reference numbers]
• [Additional points as needed] [reference numbers]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${embeddingsService.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful knowledge synthesizer that creates cohesive answers with proper citations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.error('GPT-4 API error:', response.status, response.statusText);
      return generateCohesiveAnswerFallback(query, relevantSentences);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content.trim();
    
    console.log('✅ Direct OpenAI generated answer:', generatedText);
    
    // Parse the generated response
    const result = parseGPT4Response(generatedText, relevantSentences);
    console.log(`🔗 Direct OpenAI parsed ${result.bulletPoints.length} bullet points with links`);
    console.log(`📋 References created: ${result.references.length}`);
    result.bulletPoints.forEach((bp, i) => {
      console.log(`   • Bullet ${i + 1}: ${bp.includes('ref-link-') ? '✅ Has ref link' : '❌ Missing ref link'}`);
      if (bp.includes('ref-link-')) {
        const refIds = bp.match(/ref-link-(\d+)/g);
        console.log(`     • Reference IDs found: ${refIds ? refIds.join(', ') : 'none'}`);
      }
    });
    console.log('📄 Full answer (no HTML):', result.fullAnswer);
    return result;
    
  } catch (error) {
    console.error('Error generating answer with direct OpenAI:', error);
    return generateCohesiveAnswerFallback(query, relevantSentences);
  }
}

// Parse server response to our format
function parseServerResponse(serverAnswer, relevantSentences, cleanedContent = null) {
  console.log('🔍 Parsing server response for reference links...');
  
  // Add protection against null/undefined inputs
  if (!serverAnswer || typeof serverAnswer !== 'string') {
    console.warn('⚠️ parseServerResponse received invalid serverAnswer:', serverAnswer);
    return generateCohesiveAnswerFallback('general query', relevantSentences || []);
  }
  
  if (!relevantSentences || !Array.isArray(relevantSentences)) {
    console.warn('⚠️ parseServerResponse received invalid relevantSentences:', relevantSentences);
    return generateCohesiveAnswerFallback('general query', []);
  }
  
  // Clean up double bullet points and other formatting issues
  let cleanedAnswer = serverAnswer
    .replace(/•\s*•/g, '•') // Remove double bullet points
    .replace(/-\s*•/g, '•') // Replace mixed bullet points
    .replace(/•\s*-/g, '•') // Replace mixed bullet points
    .replace(/^\s*•\s*•/gm, '•') // Remove double bullets at start of lines
    .replace(/^\s*-\s*•/gm, '•') // Replace mixed bullets at start of lines
    .replace(/^\s*•\s*-/gm, '•'); // Replace mixed bullets at start of lines
  
  console.log('📝 Original server answer:', serverAnswer);
  console.log('🧹 Cleaned server answer:', cleanedAnswer);
  console.log('📊 Relevant sentences count:', relevantSentences.length);
  console.log('📊 Cleaned content available:', !!cleanedContent);
  
  // Use cleaned content from server if available, otherwise fall back to relevant sentences
  let referenceText = cleanedContent;
  if (!referenceText) {
    console.log('⚠️ No cleaned content from server, using relevant sentences');
    referenceText = relevantSentences.map(s => s.text || s).join('\n');
  }
  
  // Create reference mapping - for vector store, we'll use the first document as reference 1
  const referenceMap = new Map();
  const refId = 1;
  referenceMap.set(refId, {
    id: refId,
    text: referenceText,
    sourceTitle: 'Vector Store Document',
    sourceUrl: '',
    sourceId: '',
    score: 1.0
  });
  
  let bulletPoints = [];
  let references = [];
  
  // Split into lines and process
  const lines = cleanedAnswer.split('\n').filter(line => line.trim());
  console.log('📋 Processing', lines.length, 'lines from server response');
  
  for (const line of lines) {
    console.log('📋 Processing line:', line);
    
    // Check for bullet points (• or -)
    if (line.match(/^[•\-\*]/) || line.trim().startsWith('- ')) {
      let bulletText = line.replace(/^[•\-\*]\s*/, '').replace(/^-\s*/, '').trim();
      console.log('   • Found bullet point:', bulletText);
      
      // Handle simple reference numbers [1], [2], [3], etc.
      const refMatches = bulletText.match(/\[(\d+)\]/g);
      console.log('   • Reference matches found:', refMatches);
      
      if (refMatches) {
        // Convert to clickable reference links
        bulletText = bulletText.replace(/\[(\d+)\]/g, (match, refNumber) => {
          const refId = parseInt(refNumber);
          if (!isNaN(refId)) {
            // For vector store, map all references to the first document (refId = 1)
            const linkHtml = `<a href="#" class="reference-link" data-ref-id="1" id="ref-link-1">[${refId}]</a>`;
            console.log(`     • Converting ${match} to: ${linkHtml}`);
            return linkHtml;
          }
          return match; // Keep original if parsing fails
        });
        
        bulletPoints.push(bulletText);
        console.log('   ✅ Added bullet point with links:', bulletText);
        
        // Add the cleaned document as reference (since vector store has one document)
        if (referenceText && !references.find(r => r.id === 1)) {
          references.push({
            id: 1,
            text: referenceText,
            sourceTitle: 'Vector Store Document',
            sourceUrl: '',
            sourceId: '',
            score: 1.0
          });
          console.log('   • Added reference 1 to references array');
        }
      } else {
        // No references found, add as simple bullet point
        bulletPoints.push(bulletText);
        console.log('   ✅ Added bullet point without links:', bulletText);
      }
    } else if (line.trim()) {
      // Non-bullet point line, check if it has references
      let bulletText = line.trim();
      const refMatches = bulletText.match(/\[(\d+)\]/g);
      
      if (refMatches) {
        // Convert to clickable reference links
        bulletText = bulletText.replace(/\[(\d+)\]/g, (match, refNumber) => {
          const refId = parseInt(refNumber);
          if (!isNaN(refId)) {
            const linkHtml = `<a href="#" class="reference-link" data-ref-id="1" id="ref-link-1">[${refId}]</a>`;
            console.log(`     • Converting ${match} to: ${linkHtml}`);
            return linkHtml;
          }
          return match;
        });
        
        bulletPoints.push(bulletText);
        console.log('   ✅ Added non-bullet line with links:', bulletText);
        
        // Add the cleaned document as reference
        if (referenceText && !references.find(r => r.id === 1)) {
          references.push({
            id: 1,
            text: referenceText,
            sourceTitle: 'Vector Store Document',
            sourceUrl: '',
            sourceId: '',
            score: 1.0
          });
        }
      } else {
        bulletPoints.push(bulletText);
        console.log('   ✅ Added non-bullet line without links:', bulletText);
      }
    }
  }
  
  // If no bullet points were created, fallback
  if (bulletPoints.length === 0) {
    bulletPoints = [`• ${cleanedAnswer}`];
    console.log('⚠️ No bullet points found, using fallback');
  }
  
  // Ensure we have at least one reference
  if (references.length === 0 && referenceText) {
    references.push({
      id: 1,
      text: referenceText,
      sourceTitle: 'Vector Store Document',
      sourceUrl: '',
      sourceId: '',
      score: 1.0
    });
    console.log('⚠️ No references found, using fallback reference');
  }
  
  console.log(`✅ Parsed ${bulletPoints.length} bullet points and ${references.length} references`);
  
  return {
    bulletPoints,
    references: references.sort((a, b) => a.id - b.id),
    fullAnswer: cleanedAnswer,
    queryType: 'server-vector-store'
  };
}

// Parse GPT-4 response and create proper reference structure
function parseGPT4Response(generatedText, relevantSentences) {
  console.log('🔍 Parsing GPT-4 response...');
  
  // Add protection against null/undefined inputs
  if (!generatedText || typeof generatedText !== 'string') {
    console.warn('⚠️ parseGPT4Response received invalid generatedText:', generatedText);
    return generateCohesiveAnswerFallback('general query', relevantSentences || []);
  }
  
  if (!relevantSentences || !Array.isArray(relevantSentences)) {
    console.warn('⚠️ parseGPT4Response received invalid relevantSentences:', relevantSentences);
    return generateCohesiveAnswerFallback('general query', []);
  }
  
  console.log('📝 Generated text:', generatedText);
  console.log('📊 Relevant sentences count:', relevantSentences.length);
  
  const lines = generatedText.split('\n').filter(line => line.trim());
  const bulletPoints = [];
  const references = [];
  
  console.log('📋 Processing', lines.length, 'lines from GPT-4 response');
  
  // Create reference mapping
  const referenceMap = new Map();
  relevantSentences.forEach((sentence, index) => {
    const refId = index + 1;
    referenceMap.set(refId, {
      id: refId,
      text: sentence.text || sentence || 'Unknown text',
      sourceTitle: sentence.sourceTitle || 'Unknown',
      sourceUrl: sentence.sourceUrl || '',
      sourceId: sentence.sourceId || '',
      score: sentence.score || 0
    });
  });
  
  console.log('🗂️ Created reference map with', referenceMap.size, 'entries');
  
  // Process each line that starts with • or -
  for (const line of lines) {
    console.log('📋 Processing line:', line);
    
    if (line.match(/^[•\-\*]/)) {
      let bulletText = line.replace(/^[•\-\*]\s*/, '').trim();
      console.log('   • Found bullet point:', bulletText);
      
      // Extract reference numbers from the text
      const refMatches = bulletText.match(/\[(\d+(?:\s*,?\s*\d+)*)\]/g);
      console.log('   • Reference matches found:', refMatches);
      
      if (refMatches) {
        // Convert clickable reference links with unique IDs for jump-back functionality
        bulletText = bulletText.replace(/\[(\d+(?:\s*,?\s*\d+)*)\]/g, (match, refNumbers) => {
          const refs = refNumbers.split(/\s*,\s*/).map(n => parseInt(n.trim()));
          const linkHtml = refs.map(refId => `<a href="#" class="reference-link" data-ref-id="${refId}" id="ref-link-${refId}">[${refId}]</a>`).join(' ');
          console.log(`     • Converting ${match} to: ${linkHtml}`);
          return linkHtml;
        });
        
        bulletPoints.push(bulletText);
        console.log('   ✅ Added bullet point with links:', bulletText);
        
        // Add referenced sentences to our references array
        refMatches.forEach(match => {
          const refNumbers = match.replace(/[\[\]]/g, '').split(/\s*,\s*/).map(n => parseInt(n.trim()));
          refNumbers.forEach(refId => {
            if (referenceMap.has(refId) && !references.find(r => r.id === refId)) {
              references.push(referenceMap.get(refId));
              console.log(`     • Added reference ${refId} to references array`);
            }
          });
        });
      } else {
        // No references found in this bullet point
        console.log('   ⚠️ No reference numbers found in bullet point');
        bulletPoints.push(bulletText);
      }
    } else {
      console.log('   • Skipping non-bullet line');
    }
  }
  
  // If no bullet points were extracted, fallback
  if (bulletPoints.length === 0) {
    console.warn('❌ Failed to parse GPT-4 response, using fallback');
    // Pass a default query instead of null to prevent TypeError
    return generateCohesiveAnswerFallback('general query', relevantSentences);
  }
  
  // Create the full answer text (without HTML tags for compatibility)
  const fullAnswer = bulletPoints.map(bp => bp.replace(/<[^>]*>/g, '')).join(' ');
  
  console.log(`✅ GPT-4 parsing complete: ${bulletPoints.length} bullet points, ${references.length} references`);
  
  return {
    bulletPoints,
    references: references.sort((a, b) => a.id - b.id),
    fullAnswer,
    queryType: 'ai-generated'
  };
}

// Fallback answer generation when GPT-4 is not available
function generateCohesiveAnswerFallback(query, relevantSentences) {
  console.log('🔄 Using fallback answer generation...');
  
  // Add protection against null/undefined inputs
  if (!query || typeof query !== 'string') {
    console.warn('⚠️ generateCohesiveAnswerFallback received invalid query:', query);
    return {
      bulletPoints: [],
      references: [],
      fullAnswer: 'Unable to generate answer due to invalid query.',
      queryType: 'fallback'
    };
  }
  
  if (!relevantSentences || !Array.isArray(relevantSentences)) {
    console.warn('⚠️ generateCohesiveAnswerFallback received invalid relevantSentences:', relevantSentences);
    return {
      bulletPoints: [],
      references: [],
      fullAnswer: 'Unable to generate answer due to invalid sentences.',
      queryType: 'fallback'
    };
  }
  
  const bulletPoints = [];
  const references = [];
  let referenceIndex = 1;
  
  // Group sentences by topic for better organization
  const groups = groupSentencesByTopic(relevantSentences, query);
  
  // Generate bullet points from grouped sentences
  for (const group of groups) {
    for (const sentenceData of group.sentences) {
      // Add protection against invalid sentence data structure
      if (!sentenceData || typeof sentenceData !== 'object') {
        console.warn('⚠️ Invalid sentence data structure:', sentenceData);
        continue;
      }
      
      const sentence = sentenceData.text || sentenceData;
      if (!sentence || typeof sentence !== 'string') {
        console.warn('⚠️ Invalid sentence text:', sentence);
        continue;
      }
      
      const referenceId = referenceIndex++;
      
      // Create a bullet point
      const bulletPoint = createBulletPoint(sentence, referenceId, 'fallback');
      bulletPoints.push(bulletPoint);
      
      // Create reference entry
      references.push({
        id: referenceId,
        text: sentence,
        sourceTitle: sentenceData.sourceTitle || 'Unknown',
        sourceUrl: sentenceData.sourceUrl || '',
        sourceId: sentenceData.sourceId || '',
        score: sentenceData.score || 0
      });
      
      // Limit to avoid overwhelming the user
      if (bulletPoints.length >= 5) break;
    }
    if (bulletPoints.length >= 5) break;
  }
  
  // Create the full answer text (for compatibility)
  const fullAnswer = bulletPoints.map(bp => bp.replace(/<[^>]*>/g, '')).join(' ');
  
  console.log(`🔗 Fallback generated ${bulletPoints.length} bullet points with reference links`);
  bulletPoints.forEach((bp, i) => {
    console.log(`   • Bullet ${i + 1}: ${bp.includes('ref-link-') ? '✅ Has ref link' : '❌ Missing ref link'}`);
  });
  
  return {
    bulletPoints,
    references,
    fullAnswer,
    queryType: 'fallback'
  };
}

// Create a bullet point with reference
function createBulletPoint(sentence, referenceId, queryType) {
  // Add protection against null/undefined inputs
  if (!sentence || typeof sentence !== 'string') {
    console.warn('⚠️ createBulletPoint received invalid sentence:', sentence);
    return 'Unable to create bullet point due to invalid sentence.';
  }
  
  if (!referenceId || typeof referenceId !== 'number') {
    console.warn('⚠️ createBulletPoint received invalid referenceId:', referenceId);
    return sentence.trim();
  }
  
  // Clean up the sentence and add reference
  let bulletPoint = sentence.trim();
  
  // Ensure it ends with proper punctuation
  if (!/[.!?]$/.test(bulletPoint)) {
    bulletPoint += '.';
  }
  
  // Add clickable reference number with unique ID for jump-back functionality
  bulletPoint += ` <a href="#" class="reference-link" data-ref-id="${referenceId}" id="ref-link-${referenceId}">[${referenceId}]</a>`;
  
  return bulletPoint;
}

// Group sentences by topic for better organization
function groupSentencesByTopic(sentences, query) {
  // Add protection against null/undefined inputs
  if (!sentences || !Array.isArray(sentences)) {
    console.warn('⚠️ groupSentencesByTopic received invalid sentences:', sentences);
    return [];
  }
  
  if (!query || typeof query !== 'string') {
    console.warn('⚠️ groupSentencesByTopic received invalid query:', query);
    return [];
  }
  
  // For now, use a simple approach - could be enhanced with more sophisticated clustering
  const groups = [];
  
  // Group by similar themes/keywords
  const processedSentences = [...sentences];
  
  while (processedSentences.length > 0) {
    const currentSentence = processedSentences.shift();
    
    // Add protection against invalid sentence structure
    if (!currentSentence || typeof currentSentence !== 'object') {
      console.warn('⚠️ Invalid sentence structure in groupSentencesByTopic:', currentSentence);
      continue;
    }
    
    const sentenceText = currentSentence.text || currentSentence;
    if (!sentenceText || typeof sentenceText !== 'string') {
      console.warn('⚠️ Invalid sentence text in groupSentencesByTopic:', sentenceText);
      continue;
    }
    
    const group = {
      theme: extractKeyTheme(sentenceText, query),
      sentences: [currentSentence]
    };
    
    // Find similar sentences (basic approach)
    for (let i = processedSentences.length - 1; i >= 0; i--) {
      const otherSentence = processedSentences[i];
      
      // Add protection against invalid other sentence structure
      if (!otherSentence || typeof otherSentence !== 'object') {
        console.warn('⚠️ Invalid other sentence structure:', otherSentence);
        continue;
      }
      
      const otherSentenceText = otherSentence.text || otherSentence;
      if (!otherSentenceText || typeof otherSentenceText !== 'string') {
        console.warn('⚠️ Invalid other sentence text:', otherSentenceText);
        continue;
      }
      
      if (areThematicallySimilar(sentenceText, otherSentenceText)) {
        group.sentences.push(otherSentence);
        processedSentences.splice(i, 1);
      }
    }
    
    groups.push(group);
    
    // Limit number of groups
    if (groups.length >= 3) {
      // Add remaining sentences to the last group
      if (processedSentences.length > 0) {
        groups[groups.length - 1].sentences.push(...processedSentences);
      }
      break;
    }
  }
  
  return groups;
}

// Extract key theme from a sentence
function extractKeyTheme(sentence, query) {
  if (!sentence || typeof sentence !== 'string') {
    console.warn('⚠️ extractKeyTheme received invalid sentence:', sentence);
    return 'General';
  }
  if (!query || typeof query !== 'string') {
    console.warn('⚠️ extractKeyTheme received invalid query:', query);
    return 'General';
  }
  
  const queryTerms = tokenizeQuery(query);
  const sentenceWords = tokenizeQuery(sentence);
  
  // Find the most relevant words
  const themeWords = sentenceWords.filter(word => 
    queryTerms.includes(word) || 
    word.length > 5 // Longer words are often more thematic
  );
  
  return themeWords.slice(0, 2).join(' ') || 'General';
}

// Check if two sentences are thematically similar
function areThematicallySimilar(sentence1, sentence2) {
  if (!sentence1 || !sentence2 || typeof sentence1 !== 'string' || typeof sentence2 !== 'string') {
    return false;
  }
  
  const words1 = new Set(tokenizeQuery(sentence1));
  const words2 = new Set(tokenizeQuery(sentence2));
  
  // Calculate word overlap
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  const similarity = intersection.size / union.size;
  return similarity > 0.3; // 30% word overlap threshold
}

// Identify the type of query for better answer structuring
function identifyQueryType(query) {
  if (!query || typeof query !== 'string') {
    return 'general';
  }
  
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.match(/^(what|define|definition)/)) return 'definition';
  if (lowerQuery.match(/^(how|ways|steps|method)/)) return 'process';
  if (lowerQuery.match(/^(why|reason|because)/)) return 'explanation';
  if (lowerQuery.match(/^(when|time|date)/)) return 'temporal';
  if (lowerQuery.match(/^(where|location|place)/)) return 'location';
  if (lowerQuery.match(/^(who|person|people)/)) return 'person';
  if (lowerQuery.match(/^(list|examples|types)/)) return 'list';
  
  return 'general';
}

// Extract sentences that are most relevant to answering the query
function extractRelevantSentencesForQuery(text, query) {
  if (!text || typeof text !== 'string') {
    console.warn('⚠️ extractRelevantSentencesForQuery received invalid text:', text);
    return [];
  }
  if (!query || typeof query !== 'string') {
    console.warn('⚠️ extractRelevantSentencesForQuery received invalid query:', query);
    return [];
  }
  
  const sentences = splitIntoSentences(text);
  const queryTerms = tokenizeQuery(query);
  const scoredSentences = [];
  
  for (const sentence of sentences) {
    const score = calculateSentenceRelevance(sentence, queryTerms, query);
    if (score > 0.1) { // Only include sentences with meaningful relevance
      scoredSentences.push({
        text: sentence.trim(),
        score: score
      });
    }
  }
  
  // Sort by relevance score and take top sentences
  scoredSentences.sort((a, b) => b.score - a.score);
  
  // Take top 3-5 sentences depending on their scores
  const topSentences = scoredSentences.slice(0, 5);
  
  // Return the sentence texts, maintaining their original order in the document
  const selectedSentences = topSentences.map(s => s.text);
  
  // Re-order sentences by their position in the original text
  const orderedSentences = sentences.filter(sentence => 
    selectedSentences.some(selected => selected === sentence.trim())
  );
  
  return orderedSentences.slice(0, 3); // Return top 3 in document order
}

// Split text into sentences with improved sentence boundary detection
function splitIntoSentences(text) {
  if (!text || typeof text !== 'string') {
    console.warn('⚠️ splitIntoSentences received invalid text:', text);
    return [];
  }
  
  // More sophisticated sentence splitting that handles common abbreviations
  const sentences = text
    .replace(/([.!?])\s*(?=[A-Z])/g, '$1|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 10); // Filter out very short sentences
  
  return sentences;
}

// Tokenize query into relevant terms for scoring
function tokenizeQuery(query) {
  if (!query || typeof query !== 'string') {
    console.warn('⚠️ tokenizeQuery received invalid input:', query);
    return [];
  }
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 2); // Filter out short words
}

// Calculate how well a sentence answers the query
function calculateSentenceRelevance(sentence, queryTerms, originalQuery) {
  if (!sentence || typeof sentence !== 'string') {
    return 0;
  }
  if (!queryTerms || !Array.isArray(queryTerms)) {
    return 0;
  }
  if (!originalQuery || typeof originalQuery !== 'string') {
    return 0;
  }
  
  const sentenceLower = sentence.toLowerCase();
  let score = 0;
  
  // Direct keyword matching (basic score)
  for (const term of queryTerms) {
    if (sentenceLower.includes(term)) {
      score += 0.3;
      
      // Bonus for exact word boundaries
      const wordRegex = new RegExp(`\\b${term}\\b`, 'i');
      if (wordRegex.test(sentence)) {
        score += 0.2;
      }
    }
  }
  
  // Question pattern matching for better semantic understanding
  if (originalQuery.match(/^(what|how|why|when|where|who)/i)) {
    const questionType = originalQuery.match(/^(what|how|why|when|where|who)/i)[1].toLowerCase();
    
    // Look for answer patterns based on question type
    switch (questionType) {
      case 'what':
        if (sentence.match(/(is|are|means|refers to|definition|describes)/i)) {
          score += 0.4;
        }
        break;
      case 'how':
        if (sentence.match(/(by|through|using|method|process|steps|way)/i)) {
          score += 0.4;
        }
        break;
      case 'why':
        if (sentence.match(/(because|since|due to|reason|cause)/i)) {
          score += 0.4;
        }
        break;
      case 'when':
        if (sentence.match(/(\d{4}|year|time|date|during|before|after)/i)) {
          score += 0.4;
        }
        break;
      case 'where':
        if (sentence.match(/(in|at|on|location|place|country|city)/i)) {
          score += 0.4;
        }
        break;
      case 'who':
        if (sentence.match(/(person|people|author|researcher|scientist|founder)/i)) {
          score += 0.4;
        }
        break;
    }
  }
  
  // Bonus for sentences that seem to provide explanations or definitions
  if (sentence.match(/(means|is defined as|refers to|explanation|because|therefore)/i)) {
    score += 0.3;
  }
  
  // Penalty for very long sentences (they tend to be less focused)
  if (sentence.length > 200) {
    score *= 0.8;
  }
  
  // Penalty for very short sentences (they tend to lack context)
  if (sentence.length < 30) {
    score *= 0.6;
  }
  
  return score;
}

// Calculate overall answer score combining similarity and sentence relevance
function calculateAnswerScore(relevantSentences, query) {
  if (!relevantSentences || !Array.isArray(relevantSentences) || relevantSentences.length === 0) {
    return 0;
  }
  if (!query || typeof query !== 'string') {
    return 0;
  }
  
  const queryTerms = tokenizeQuery(query);
  let totalRelevance = 0;
  
  for (const sentence of relevantSentences) {
    totalRelevance += calculateSentenceRelevance(sentence, queryTerms, query);
  }
  
  // Average relevance with bonus for having multiple relevant sentences
  const averageRelevance = totalRelevance / relevantSentences.length;
  const diversityBonus = Math.min(relevantSentences.length * 0.1, 0.3);
  
  return averageRelevance + diversityBonus;
}

// Helper function to check if we have a valid API key
async function hasValidApiKey() {
  try {
    if (!embeddingsService) {
      await initializeModules();
    }
    const modelInfo = embeddingsService.getModelInfo();
    return modelInfo && modelInfo.hasApiKey;
  } catch (error) {
    return false;
  }
}

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

async function handleSetApiKey(apiKey, sendResponse) {
  try {
    if (!embeddingsService) {
      await initializeModules();
    }
    
    await embeddingsService.setApiKey(apiKey);
    
    // Test the API key by generating a small embedding
    try {
      const testEmbeddingResult = await embeddingsService.generateEmbedding("test");
      if (testEmbeddingResult && testEmbeddingResult.embedding && testEmbeddingResult.embedding.length > 0) {
        console.log('✅ API key validated successfully');
        
        // Check for existing fallback embeddings that should be regenerated
        const fallbackCount = await checkForFallbackEmbeddings();
        
        if (fallbackCount > 0) {
          sendResponse({ 
            success: true, 
            message: 'API key saved and validated',
            offerRegeneration: true,
            fallbackCount: fallbackCount
          });
        } else {
          sendResponse({ success: true, message: 'API key saved and validated' });
        }
      } else {
        console.log('❌ API key validation failed');
        sendResponse({ success: false, error: 'API key validation failed' });
      }
    } catch (testError) {
      console.log('❌ API key test failed:', testError.message);
      sendResponse({ success: false, error: 'Invalid API key: ' + testError.message });
    }
    
  } catch (error) {
    console.error('Error setting API key:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Check for existing fallback embeddings
async function checkForFallbackEmbeddings() {
  try {
    const result = await chrome.storage.local.get(['embeddings']);
    const embeddings = result.embeddings || {};
    
    let fallbackCount = 0;
    for (const [entryId, embeddingData] of Object.entries(embeddings)) {
      // Check if this is a fallback embedding (either old format or explicitly marked as fallback)
      if (!embeddingData.method || embeddingData.method === 'fallback' || embeddingData.model === 'tf-idf') {
        fallbackCount++;
      }
    }
    
    console.log(`🔍 Found ${fallbackCount} fallback embeddings that could be upgraded`);
    return fallbackCount;
  } catch (error) {
    console.error('Error checking for fallback embeddings:', error);
    return 0;
  }
}

async function handleGetStats(sendResponse) {
  try {
    console.log('📊 DEBUG: Getting stats from chrome.storage...');
    const result = await chrome.storage.local.get(['textEntries', 'embeddings']);
    const entries = result.textEntries || [];
    const embeddings = result.embeddings || {};
    
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
      totalEmbeddings: Object.keys(embeddings).length,
      totalWords: totalWords,
      embeddingCoverage: entries.length > 0 ? (Object.keys(embeddings).length / entries.length * 100).toFixed(1) : 0,
      usingFallback: true,
      modelInfo: {
        provider: 'OpenAI',
        hasApiKey: await hasValidApiKey(),
        dimensions: 1536
      }
    };
    
    console.log('📊 Chrome.storage stats:', stats);
    sendResponse({ stats });
  } catch (error) {
    console.error('Error getting stats:', error);
    sendResponse({ stats: null, error: error.message });
  }
}

async function handleGenerateEmbeddings(sendResponse) {
  try {
    console.log('🧠 Starting embedding generation process...');
    
    // Get all entries
    const result = await chrome.storage.local.get(['textEntries', 'embeddings']);
    const entries = result.textEntries || [];
    const existingEmbeddings = result.embeddings || {};
    
    if (entries.length === 0) {
      sendResponse({ success: false, error: 'No entries found to generate embeddings for' });
      return;
    }
    
    // Initialize embeddings service if needed
    if (!embeddingsService) {
      await initializeModules();
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    console.log(`🧠 Processing ${entries.length} entries for embeddings...`);
    
    for (const entry of entries) {
      // Skip if embedding already exists
      if (existingEmbeddings[entry.id]) {
        console.log(`⏭️ Skipping entry ${entry.id} - embedding already exists`);
        successCount++;
        continue;
      }
      
      try {
        console.log(`🧠 Generating embedding for entry ${entry.id}...`);
        const embeddingResult = await embeddingsService.generateEmbedding(entry.text);
        
        if (embeddingResult && embeddingResult.embedding && embeddingResult.embedding.length > 0) {
          existingEmbeddings[entry.id] = embeddingResult;
          successCount++;
          console.log(`✅ Generated embedding for entry ${entry.id} using ${embeddingResult.method}`);
        } else {
          errorCount++;
          console.warn(`❌ Failed to generate embedding for entry ${entry.id}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error generating embedding for entry ${entry.id}:`, error);
      }
    }
    
    // Save updated embeddings
    await chrome.storage.local.set({ embeddings: existingEmbeddings });
    
    console.log(`✅ Embedding generation complete: ${successCount} success, ${errorCount} errors`);
    
    sendResponse({ 
      success: true, 
      count: successCount,
      errors: errorCount,
      total: entries.length
    });
    
  } catch (error) {
    console.error('❌ Error in embedding generation:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleRegenerateEmbeddings(sendResponse) {
  try {
    console.log('🔄 Starting embedding regeneration process...');
    
    // Get all entries
    const result = await chrome.storage.local.get(['textEntries', 'embeddings']);
    const entries = result.textEntries || [];
    const existingEmbeddings = result.embeddings || {};
    
    if (entries.length === 0) {
      sendResponse({ success: false, error: 'No entries found to regenerate embeddings for' });
      return;
    }
    
    // Initialize embeddings service if needed
    if (!embeddingsService) {
      await initializeModules();
    }
    
    // Check if we have an API key
    if (!embeddingsService.hasApiKey()) {
      sendResponse({ success: false, error: 'OpenAI API key required for regeneration' });
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    let regeneratedCount = 0;
    
    console.log(`🔄 Regenerating embeddings for ${entries.length} entries using OpenAI...`);
    
    for (const entry of entries) {
      try {
        console.log(`🔄 Regenerating embedding for entry ${entry.id}...`);
        const embeddingResult = await embeddingsService.generateEmbedding(entry.text);
        
        if (embeddingResult && embeddingResult.embedding && embeddingResult.embedding.length > 0) {
          const wasRegenerated = existingEmbeddings[entry.id] && 
            (!existingEmbeddings[entry.id].method || existingEmbeddings[entry.id].method === 'fallback');
          
          existingEmbeddings[entry.id] = embeddingResult;
          successCount++;
          
          if (wasRegenerated) {
            regeneratedCount++;
            console.log(`✅ Regenerated embedding for entry ${entry.id} (fallback → OpenAI)`);
          } else {
            console.log(`✅ Generated embedding for entry ${entry.id} using OpenAI`);
          }
        } else {
          errorCount++;
          console.warn(`❌ Failed to regenerate embedding for entry ${entry.id}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error regenerating embedding for entry ${entry.id}:`, error);
      }
    }
    
    // Save updated embeddings
    await chrome.storage.local.set({ embeddings: existingEmbeddings });
    
    console.log(`✅ Embedding regeneration complete: ${successCount} success, ${errorCount} errors, ${regeneratedCount} upgraded`);
    
    sendResponse({ 
      success: true, 
      count: successCount,
      errors: errorCount,
      regenerated: regeneratedCount,
      total: entries.length
    });
    
  } catch (error) {
    console.error('❌ Error in embedding regeneration:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Function to generate embedding for a single entry
async function generateEmbeddingForEntry(entry) {
  try {
    console.log(`🧠 Generating embedding for entry ${entry.id}...`);
    
    // Get the text content
    const text = entry.text || '';
    if (!text) {
      console.warn(`⚠️ No text content for entry ${entry.id}`);
      return false;
    }
    
    // Generate embedding using OpenAI
    const embedding = await embeddingsService.generateEmbedding(text);
    if (!embedding) {
      console.warn(`❌ Failed to generate embedding for entry ${entry.id}`);
      return false;
    }
    
    // Save embedding to chrome.storage.local
    try {
      const result = await chrome.storage.local.get(['embeddings']);
      const existingEmbeddings = result.embeddings || {};
      existingEmbeddings[entry.id] = embedding;
      await chrome.storage.local.set({ embeddings: existingEmbeddings });
      console.log(`✅ Embedding saved to chrome.storage for entry ${entry.id}`);
    } catch (storageError) {
      console.error(`❌ Failed to save embedding to storage:`, storageError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error generating embedding for entry ${entry.id}:`, error);
    return false;
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

// Function to upload documents to persistent vector store
async function uploadDocumentsToVectorStore(entries) {
  if (!SERVER_CONFIG.enabled) {
    console.log('⚙️ Server disabled, skipping vector store upload');
    return;
  }

  try {
    console.log('📤 Uploading documents to persistent vector store...');
    
    // Prepare documents for upload (text is already cleaned)
    const documents = entries.map((entry, index) => ({
      text: entry.text, // Already cleaned
      filename: `${entry.title || 'document'}_${entry.id || index + 1}.txt`
    }));

    if (documents.length === 0) {
      console.log('⚠️ No documents to upload');
      return;
    }

    const response = await fetch(`${SERVER_CONFIG.baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        documents: documents
      })
    });

    if (!response.ok) {
      console.error('🚨 Upload API error:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    console.log('✅ Documents uploaded to vector store:', data.uploadedFiles.length, 'files');
    console.log('📊 Vector store stats:', data.stats);
    
    SERVER_CONFIG.vectorStoreInitialized = true;
    
  } catch (error) {
    console.error('🚨 Error uploading to vector store:', error);
  }
}

// Function to clean text content for semantic search using AI
async function cleanTextForSemanticSearch(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }
  
  console.log('🧹 Cleaning text for semantic search...');
  console.log('📊 Original text length:', rawText.length);
  
  // First, do basic HTML cleanup
  let cleanedText = rawText
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
  
  // If text is very short after basic cleanup, return it as is
  if (cleanedText.length < 200) {
    console.log('📊 Text too short for AI processing, returning basic cleaned text');
    return cleanedText;
  }
  
  try {
    // Use ChatGPT to extract meaningful content
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.log('⚠️ No API key available, using basic cleaning');
      return cleanedText;
    }
    
    console.log('🤖 Using AI to extract meaningful content...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a content extraction specialist. Your job is to extract ONLY the meaningful, substantive content from web pages, social media posts, articles, etc. while removing ALL metadata, navigation elements, UI text, timestamps, engagement metrics, and other non-content elements.

CRITICAL RULES - REMOVE ALL OF THESE:
1. ALL social media metadata: "@username", "· Dec 22, 2024", "5:08 PM", "1.3M Views", "137 1K 5.4K 12K"
2. ALL social media headers: "Joe Hudson on X:", "User on Twitter:", "Post on Facebook:", etc.
3. ALL engagement metrics: "Views", "Likes", "Shares", "Comments", "Retweets", "Reposts"
4. ALL navigation elements: "Home", "Explore", "Notifications", "Messages", "Grok", "Bookmarks", "Jobs", "Communities", "Premium", "Verified", "Orgs", "Profile", "More", "Post", "Reply", "See new posts", "Conversation"
5. ALL UI elements: "Post your reply", "Reply", "To view keyboard shortcuts", "View keyboard shortcuts"
6. ALL URLs and links: "https://x.com/...", "🔗 https://..."
7. ALL timestamps and dates: "📅 6/25/2025", "• 📊 1096 words"
8. ALL social media formatting: "(1)", "(2)", "(3)" at the beginning of lines
9. ALL HTML, CSS, JavaScript, and technical elements
10. ALL copyright notices, terms of service, privacy policies
11. ALL error messages and UI text
12. ALL social media platform names: "X", "Twitter", "Facebook", "Instagram", etc.

KEEP ONLY:
- The actual content that a human would want to read
- The substance of articles, tweets, posts, etc.
- Meaningful text that provides value
- The core message or information

If there's no meaningful content after removing all metadata, return "NO_MEANINGFUL_CONTENT"

Return ONLY the cleaned content, no explanations or additional text.`
          },
          {
            role: 'user',
            content: `Extract the meaningful content from this text, removing ALL metadata and UI elements:

${cleanedText}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiCleanedText = data.choices[0].message.content.trim();
    
    // Check if AI returned the special marker
    if (aiCleanedText === 'NO_MEANINGFUL_CONTENT') {
      console.log('⚠️ AI detected no meaningful content');
      return '';
    }
    
    console.log('📊 AI cleaned text length:', aiCleanedText.length);
    console.log('📊 Text reduction:', Math.round((1 - aiCleanedText.length / rawText.length) * 100) + '%');
    
    return aiCleanedText;
    
  } catch (error) {
    console.error('❌ Error using AI for text cleaning:', error);
    console.log('🔄 Falling back to basic cleaning...');
    
    // Fallback to basic cleaning
    return cleanedText
      .replace(/(?:@[a-zA-Z0-9_]+)/g, ' ') // Remove @mentions
      .replace(/(?:#[a-zA-Z0-9_]+)/g, ' ') // Remove #hashtags
      .replace(/(?:https?:\/\/[^\s]+)/g, ' ') // Remove URLs
      .replace(/(?:www\.[^\s]+)/g, ' ') // Remove www URLs
      .replace(/(?:\d{1,2}:\d{2}\s*(?:AM|PM)?\s*·\s*\w+\s+\d{1,2},\s+\d{4}\s*·\s*[\d.]+[KMB]?\s*Views?)/g, ' ') // Remove timestamps with metrics
      .replace(/(?:\d+(?:\.\d+)?[KMB]?\s*(?:Views?|Likes?|Shares?|Comments?|Retweets?))/gi, ' ') // Remove engagement metrics
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}

// Helper function to get API key
async function getApiKey() {
  try {
    const result = await chrome.storage.local.get(['openaiApiKey']);
    return result.openaiApiKey;
  } catch (error) {
    console.error('❌ Error getting API key:', error);
    return null;
  }
}

console.log('🎉 Background script setup complete'); 