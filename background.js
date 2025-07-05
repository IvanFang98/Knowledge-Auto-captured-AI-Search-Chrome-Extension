// Background script for SmartGrab AI Search Extension
// Based on working NotebookLM Web Importer pattern

var background = function() {
    "use strict";
    
    // Browser compatibility layer
    const browser = globalThis.chrome || globalThis.browser;
    
    // Simple logging utility
    const logger = {
        debug: (...args) => console.debug('[SmartGrab]', ...args),
        log: (...args) => console.log('[SmartGrab]', ...args),
        warn: (...args) => console.warn('[SmartGrab]', ...args),
        error: (...args) => console.error('[SmartGrab]', ...args)
    };
    
    // Main initialization function
    function initializeExtension() {
        logger.log('🚀 SmartGrab AI Search Extension - Background script starting...');
        
        // Extension lifecycle events
        browser.runtime.onStartup.addListener(() => {
            logger.log('📱 Extension startup event');
        });
        
        browser.runtime.onInstalled.addListener((details) => {
            logger.log('📦 Extension installed/updated event', details.reason);
            
            // Clear any error states on install/update
            clearErrorStates();
            
            // Log available commands
            if (browser.commands && browser.commands.getAll) {
                browser.commands.getAll((commands) => {
                    logger.log('📋 Available commands:', commands);
                });
            }
        });
        
        // Handle extension icon clicks
        if (browser.action && browser.action.onClicked) {
            browser.action.onClicked.addListener(async (tab) => {
                logger.log('🔧 Extension icon clicked, opening side panel');
                
                try {
                    // Open the side panel if available
                    if (browser.sidePanel && browser.sidePanel.open) {
                        await browser.sidePanel.open({ windowId: tab.windowId });
                        logger.log('✅ Side panel opened successfully');
                    } else {
                        logger.warn('⚠️ Side panel API not available');
                    }
  } catch (error) {
                    logger.error('❌ Error opening side panel:', error);
                }
            });
        }
        
        // Listen for keyboard shortcuts
        if (browser.commands && browser.commands.onCommand) {
            browser.commands.onCommand.addListener((command) => {
                logger.log('⌨️ Keyboard command received:', command);
                
                if (command === 'trigger_action') {
                    logger.log('🎯 Trigger action command - starting text extraction...');
                    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0]) {
                            extractAndSavePageText(tabs[0]);
                        }
                    });
                }
            });
        }
        
        // Message handler
        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
            logger.log('📨 Background received message:', message.action);
            
            try {
                switch (message.action) {
                    case 'ping':
                        sendResponse({ status: 'ok', timestamp: Date.now() });
                        return true;
                        
                    case 'get_entries':
                        handleGetEntries(sendResponse);
                        return true;
                        
                    case 'search_keywords':
                        handleKeywordSearch(message.query, sendResponse);
                        return true;
                        
                    case 'search_similar':
                        handleSemanticSearch(message.query, message.filters, sendResponse);
                        return true;
                        
                    case 'clear_entries':
                        handleClearEntries(sendResponse);
                        return true;
                        
                    case 'get_stats':
                        handleGetStats(sendResponse);
                        return true;
                        
                    case 'clear_error_states':
                        handleClearErrorStates(sendResponse);
                        return true;
                        
                    case 'captureAndOpenNotebookLM':
                        handleCaptureAndOpenNotebookLM(message.tabId, sendResponse);
                        return true;
                        
                    default:
                        logger.warn('❓ Unknown message action:', message.action);
                        sendResponse({ error: 'Unknown action' });
                        return false;
    }
  } catch (error) {
                logger.error('❌ Error in message handler:', error);
                sendResponse({ error: error.message });
                return false;
            }
        });
        
        logger.log('✅ Background script initialized successfully');
    }
    
    // Clear error states
    async function clearErrorStates() {
        try {
            const keysToClear = [
                'searchState',
                'setupNoteDismissed', 
                'userAnswerContentHeight',
                'lastError',
                'errorState',
                'searchError',
                'semanticError'
            ];
            
            await browser.storage.local.remove(keysToClear);
            logger.log('🧹 Error states cleared');
        } catch (error) {
            logger.error('❌ Error clearing states:', error);
        }
    }
    
    // Ensure content script is injected
async function ensureContentScript(tabId) {
  try {
    // Try to ping the content script first
            const response = await browser.tabs.sendMessage(tabId, { action: 'ping' });
    if (response && response.status === 'ready') {
                return true;
    }
  } catch (error) {
    // Content script not loaded, inject it
            logger.log('📥 Injecting content script...');
  }
  
  try {
            await browser.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    
            // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  } catch (error) {
            logger.error('❌ Failed to inject content script:', error);
    return false;
  }
}

    // Extract and save page text
async function extractAndSavePageText(tab) {
  try {
            logger.log('📄 Starting text extraction from:', tab.url);
    
    // Check if this is a supported page
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
                tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
                logger.warn('⚠️ Cannot extract text from system pages');
      showNotification('❌ Cannot extract text from system pages');
      return;
    }
    
    // Ensure content script is loaded
    const scriptReady = await ensureContentScript(tab.id);
    if (!scriptReady) {
                logger.error('❌ Could not load content script');
      showNotification('❌ Could not load content script');
      return;
    }
    
            // Send message to content script to extract text
            const response = await browser.tabs.sendMessage(tab.id, {
      action: 'extract_text'
    });
    
    if (response && response.text) {
                logger.log(`📝 Text extracted: ${response.text.length} characters`);
      
      // Create entry object
      const entry = {
                    id: Date.now(),
        url: tab.url,
        title: tab.title,
        text: response.text,
        timestamp: new Date().toISOString(),
        wordCount: response.text.split(/\s+/).filter(word => word.length > 0).length
      };
      
      await saveTextEntry(entry);
                logger.log('✅ Text entry saved successfully');
      
    } else {
                logger.warn('❌ No text extracted from page');
      showNotification('❌ No text found on this page');
    }
    
  } catch (error) {
            logger.error('❌ Error extracting text:', error);
    showNotification('❌ Error extracting text: ' + error.message);
  }
}

         // Save text entry with AI processing
async function saveTextEntry(entry) {
  try {
             logger.log('💾 Saving entry...');
    
    // Clean the text using AI before saving
             logger.log('🧹 Cleaning text before saving...');
    const cleanedText = await cleanTextForSemanticSearch(entry.text);
    
    if (!cleanedText || cleanedText.trim().length === 0) {
                 logger.warn('⚠️ No meaningful content after cleaning, skipping save');
      showNotification('⚠️ No meaningful content found to save');
      return;
    }
    
    // Update the entry with cleaned text
    const cleanedEntry = {
      ...entry,
      text: cleanedText,
      wordCount: cleanedText.split(/\s+/).filter(word => word.length > 0).length
    };
    
             logger.log('📊 Text cleaned:', {
      originalLength: entry.text.length,
      cleanedLength: cleanedText.length,
      reduction: Math.round((1 - cleanedText.length / entry.text.length) * 100) + '%'
    });
    
             // Get existing entries
             const result = await browser.storage.local.get(['textEntries']);
    const existingEntries = result.textEntries || [];
    
             // Check for duplicates by URL
    const duplicateEntry = existingEntries.find(existing => existing.url === cleanedEntry.url);
    
    if (duplicateEntry) {
                 logger.log('⚠️ Duplicate found for URL:', cleanedEntry.url);
      
                 // Ask user for replacement
      const userChoice = await askUserForReplacement(cleanedEntry, duplicateEntry);
      
      if (!userChoice) {
                     logger.log('ℹ️ User chose to keep existing entry');
        showNotification(`📄 Keeping ${duplicateEntry.title}`);
        return;
      }
      
                 logger.log('🔄 User chose to replace existing entry');
      
      // Remove existing embedding since we're replacing the entry
      try {
                     const embeddingResult = await browser.storage.local.get(['embeddings']);
        const existingEmbeddings = embeddingResult.embeddings || {};
        if (existingEmbeddings[duplicateEntry.id]) {
          delete existingEmbeddings[duplicateEntry.id];
                         await browser.storage.local.set({ embeddings: existingEmbeddings });
                         logger.log('🗑️ Removed old embedding for replaced entry');
        }
      } catch (error) {
                     logger.warn('⚠️ Failed to remove old embedding:', error);
      }
    }
    
             // Remove duplicate if exists
    const filteredEntries = existingEntries.filter(e => e.url !== cleanedEntry.url);
    filteredEntries.unshift(cleanedEntry);
    
    // Keep only last 100 entries
    if (filteredEntries.length > 100) {
      filteredEntries.splice(100);
    }
    
             await browser.storage.local.set({ textEntries: filteredEntries });
    
    const isReplacement = !!duplicateEntry;
    
    if (isReplacement) {
                 logger.log('✅ Entry replaced, total entries now:', filteredEntries.length);
      showNotification(`🔄 Replaced ${cleanedEntry.title} (${cleanedEntry.wordCount} words)`);
    } else {
                 logger.log('✅ Entry saved, total entries now:', filteredEntries.length);
      showNotification(`✅ Saved ${cleanedEntry.wordCount} words from ${cleanedEntry.title} (🧠 generating embedding...)`);
    }
    
             // Generate embedding for semantic search
             await generateEmbeddingForEntry(cleanedEntry);
    
  } catch (error) {
             logger.error('❌ Error saving text entry:', error);
    showNotification('❌ Error saving text: ' + error.message);
    throw error;
  }
}

    // Show notification
async function showNotification(message) {
  try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      await ensureContentScript(tabs[0].id);
                await browser.tabs.sendMessage(tabs[0].id, {
        action: 'show_notification',
        message: message
      });
    }
  } catch (error) {
            logger.warn('❌ Could not show notification:', error.message);
        }
    }
    
    // Message handlers
async function handleGetEntries(sendResponse) {
  try {
            const result = await browser.storage.local.get(['textEntries']);
    const entries = result.textEntries || [];
    sendResponse({ entries });
  } catch (error) {
            logger.error('❌ Error getting entries:', error);
    sendResponse({ entries: [], error: error.message });
  }
}

async function handleKeywordSearch(query, sendResponse) {
  try {
            const result = await browser.storage.local.get(['textEntries']);
    const allEntries = result.textEntries || [];
    
    // Simple keyword search
            const searchTerms = query.toLowerCase().split(/\s+/);
    const results = allEntries.filter(entry => {
                const searchText = (entry.title + ' ' + entry.text).toLowerCase();
                return searchTerms.some(term => searchText.includes(term));
            });
            
    sendResponse({ results });
  } catch (error) {
            logger.error('❌ Error in keyword search:', error);
    sendResponse({ results: [], error: error.message });
  }
}

         async function handleSemanticSearch(query, filters, sendResponse) {
         try {
             logger.log('🧠 Performing semantic search...');
             const result = await browser.storage.local.get(['textEntries', 'embeddings']);
             let allEntries = result.textEntries || [];
             const embeddings = result.embeddings || {};
             
             // Apply time filter if present
             if (filters && filters.timeFilter && filters.timeFilter !== 'any') {
                 allEntries = applyTimeFilterBackend(allEntries, filters);
             }
             
             if (!query || query.trim().length === 0) {
                 sendResponse({ results: allEntries });
                 return;
             }
             
             // Try semantic search with embeddings
             try {
                 const queryEmbedding = await generateEmbedding(query);
                 if (queryEmbedding) {
                     const semanticResults = [];
                     
                     for (const entry of allEntries) {
                         if (embeddings[entry.id]) {
                             const similarity = cosineSimilarity(queryEmbedding, embeddings[entry.id]);
                             if (similarity > 0.1) { // Threshold for relevance
                                 semanticResults.push({ ...entry, similarity });
                             }
                         }
                     }
                     
                     // Sort by similarity, descending
                     semanticResults.sort((a, b) => b.similarity - a.similarity);
                     const topResults = semanticResults.slice(0, 10);
                     
                     logger.log('🧠 Semantic search results:', topResults.length);
                     sendResponse({ results: topResults });
                     return;
                 }
             } catch (embeddingError) {
                 logger.warn('⚠️ Embedding search failed, falling back to keyword search:', embeddingError.message);
             }
             
             // Fallback to keyword-based semantic search
             await handleFallbackSemanticSearch(query, filters, sendResponse);
             
         } catch (error) {
             logger.error('❌ Error in semantic search:', error);
             sendResponse({ results: [], error: error.message });
         }
}

async function handleClearEntries(sendResponse) {
  try {
            await browser.storage.local.remove(['textEntries']);
    sendResponse({ success: true });
  } catch (error) {
            logger.error('❌ Error clearing entries:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetStats(sendResponse) {
  try {
            const result = await browser.storage.local.get(['textEntries']);
    const entries = result.textEntries || [];
    
    const stats = {
      totalEntries: entries.length,
                totalWords: entries.reduce((sum, entry) => sum + (entry.wordCount || 0), 0),
                oldestEntry: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
                newestEntry: entries.length > 0 ? entries[0].timestamp : null
    };
    
    sendResponse({ stats });
  } catch (error) {
            logger.error('❌ Error getting stats:', error);
    sendResponse({ stats: null, error: error.message });
  }
}

async function handleClearErrorStates(sendResponse) {
  try {
            await clearErrorStates();
            sendResponse({ success: true });
        } catch (error) {
            logger.error('❌ Error clearing error states:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    async function handleCaptureAndOpenNotebookLM(tabId, sendResponse) {
        try {
            logger.log('📄 Capture and open NotebookLM request');
            
            // Get the tab
            const tab = await browser.tabs.get(tabId);
            
            // Extract text from the page
            await extractAndSavePageText(tab);
            
            // Open NotebookLM
            await browser.tabs.create({ 
                url: 'https://notebooklm.google.com/', 
                active: true 
            });
            
            sendResponse({ success: true });
  } catch (error) {
            logger.error('❌ Error in capture and open NotebookLM:', error);
    sendResponse({ success: false, error: error.message });
  }
}

         // Ask user for replacement
     async function askUserForReplacement(newEntry, existingEntry) {
         try {
             logger.log('❓ Asking user for replacement decision...');
             
             // Get the active tab to show the confirmation
             const tabs = await browser.tabs.query({ active: true, currentWindow: true });
             if (!tabs[0]) {
                 logger.log('❌ No active tab found for user prompt');
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
             const response = await browser.tabs.sendMessage(tabs[0].id, {
                 action: 'confirm_replacement',
                 message: message
             });
             
             logger.log('✅ User response received:', response?.replace ? 'Replace' : 'Keep existing');
             return response?.replace || false;
             
         } catch (error) {
             logger.error('❌ Error asking user for replacement:', error);
             // Default to not replacing if we can't ask
             return false;
         }
     }
     
     // AI text cleaning function
async function cleanTextForSemanticSearch(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }
  
         logger.log('🧹 Cleaning text for semantic search...');
  
         // Basic HTML cleanup
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
  
         logger.log('📊 Text cleaned, length:', cleanedText.length);
  return cleanedText;
}

     // Generate embedding for entry
     async function generateEmbeddingForEntry(entry) {
         try {
             logger.log('🧠 Generating embedding for entry:', entry.title);
             
             const embedding = await generateEmbedding(entry.text);
             if (embedding) {
                 // Store embedding
                 const result = await browser.storage.local.get(['embeddings']);
                 const embeddings = result.embeddings || {};
                 embeddings[entry.id] = embedding;
                 
                 await browser.storage.local.set({ embeddings });
                 logger.log('✅ Embedding generated and stored for entry:', entry.id);
             }
  } catch (error) {
             logger.warn('⚠️ Failed to generate embedding:', error.message);
         }
     }
     
     // Generate embedding using OpenAI API
     async function generateEmbedding(text) {
         try {
             // Get API key
             const result = await browser.storage.local.get(['openaiApiKey']);
             const apiKey = result.openaiApiKey;
             
             if (!apiKey) {
                 logger.warn('⚠️ No OpenAI API key found for embedding generation');
                 return null;
             }
             
             const response = await fetch('https://api.openai.com/v1/embeddings', {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${apiKey}`
                 },
                 body: JSON.stringify({
                     model: 'text-embedding-3-small',
                     input: text.substring(0, 8000), // Limit text length
                     encoding_format: 'float'
                 })
             });
             
             if (!response.ok) {
                 throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
             }
             
             const data = await response.json();
             return data.data[0].embedding;
             
  } catch (error) {
             logger.error('❌ Error generating embedding:', error);
             return null;
         }
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
     
     // Apply time-based filtering
     function applyTimeFilterBackend(entries, filters) {
         const now = new Date();
         let cutoffDate;
         
         logger.log('⏰ Applying time filter:', filters.timeFilter);
         
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
                     
                     return entries.filter(entry => {
                         const entryDate = new Date(entry.timestamp);
                         return entryDate >= fromDate && entryDate <= toDate;
                     });
                 }
                 return entries;
             default:
                 return entries;
         }
         
         const filteredEntries = entries.filter(entry => {
             const entryDate = new Date(entry.timestamp);
             return entryDate >= cutoffDate;
         });
         
         logger.log('⏰ Time filter results:', entries.length, '->', filteredEntries.length);
         return filteredEntries;
     }
     
     // Fallback semantic search (word overlap)
     async function handleFallbackSemanticSearch(query, filters, sendResponse) {
         try {
             logger.log('🧠 Performing fallback semantic search...');
             const result = await browser.storage.local.get(['textEntries']);
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
                 const similarity = queryWords.length > 0 ? overlap / queryWords.length : 0;
                 return { ...entry, similarity };
             });
             
             // Sort by similarity, descending
             scored.sort((a, b) => b.similarity - a.similarity);
             const filtered = scored.filter(e => e.similarity > 0);
             const topResults = filtered.slice(0, 10);
             
             logger.log('🧠 Fallback semantic search results:', topResults.length);
             sendResponse({ results: topResults });
  } catch (error) {
             logger.error('❌ Error in fallback semantic search:', error);
             sendResponse({ results: [], error: error.message });
         }
     }
     
     // Add API key management
     browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
         if (message.action === 'set_api_key') {
             handleSetApiKey(message.apiKey, sendResponse);
             return true;
         }
     });
     
     async function handleSetApiKey(apiKey, sendResponse) {
         try {
             await browser.storage.local.set({ openaiApiKey: apiKey });
             logger.log('✅ API key saved successfully');
             sendResponse({ success: true });
  } catch (error) {
             logger.error('❌ Error saving API key:', error);
             sendResponse({ success: false, error: error.message });
         }
     }
     
     // Initialize the extension
     return initializeExtension();
 }();
 
 // Export for compatibility
 if (typeof module !== 'undefined' && module.exports) {
     module.exports = background;
 } 