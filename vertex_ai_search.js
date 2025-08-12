// Disable non-critical console output in production
(function() {
  const c = globalThis.console;
  if (!c) return;
  const noop = function() {};
  try {
    c.log = noop;
    c.info = noop;
    c.debug = noop;
    c.trace = noop;
  } catch (_) {}
})();

// Default proxy usage gated by config-based allowlist
function getDefaultProxyUrl() {
  try {
    const runtimeId = (chrome && chrome.runtime && chrome.runtime.id) || '';
    const allowedFromConfig = (globalThis.window && window.VERTEX_CONFIG && Array.isArray(window.VERTEX_CONFIG.allowedExtensionIds))
      ? window.VERTEX_CONFIG.allowedExtensionIds
      : null;
    const allowList = Array.isArray(allowedFromConfig) ? allowedFromConfig : [];
    const isAllowed = allowList.includes(runtimeId);
    return isAllowed ? 'https://vertex-ai-proxy-603340132885.us-central1.run.app' : '';
  } catch (_) {
    return '';
  }
}

// Vertex AI NotebookLM-like Implementation
// Uses Cloud Run proxy to access Vertex AI Gemini API for conversational search

class VertexAISearch {
  constructor(config = {}) {
    // Use provided config or fall back to global config
    const globalConfig = window.VERTEX_CONFIG || {};
    this.proxyUrl = config.proxyUrl || globalConfig.proxyUrl || getDefaultProxyUrl();
    this.projectId = config.projectId || globalConfig.projectId || 'chrome-ext-knowledge-base';
    this.model = config.model || globalConfig.model || 'text-embedding-004';
    this.db = null;
    this.isInitialized = false;
    this.isInitializing = false;
    this.documentVectors = new Map();
    this.batchSize = config.batchSize || globalConfig.batchSize || 5; // Rate limiting
    this.requestDelay = config.requestDelay || globalConfig.requestDelay || 1000; // 1 second between requests
  }

  async init() {
    if (this.isInitialized) return;
    if (this.isInitializing) return this.initializationPromise;

    this.isInitializing = true;
    this.initializationPromise = this._initInternal();
    
    try {
      await this.initializationPromise;
      this.isInitialized = true;
      console.log('VertexAISearch: Initialization complete');
    } catch (error) {
      this.isInitializing = false;
      console.error('VertexAISearch: Initialization failed:', error);
      throw error;
    }

    return this.initializationPromise;
  }

  async _initInternal() {
    console.log('VertexAISearch: Initializing...');

    try {
      // Initialize IndexedDB for vector storage
      this.db = await window.idb.openDB('vertex-embeddings', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('vectors')) {
            db.createObjectStore('vectors', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'key' });
          }
        }
      });

      // Test proxy connection
      await this.testProxyConnection();

      // Load existing vectors
      await this.loadExistingVectors();

      console.log('VertexAISearch: Ready with', this.documentVectors.size, 'cached vectors');
    } catch (error) {
      console.error('VertexAISearch: Initialization error:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async testProxyConnection() {
    if (!this.proxyUrl || !this.proxyUrl.trim()) {
      throw new Error('Proxy URL not configured');
    }
    console.log('VertexAISearch: Testing proxy connection...');
    
    try {
      const response = await fetch(`${this.proxyUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-ID': chrome.runtime.id
        }
      });

      if (!response.ok) {
        throw new Error(`Proxy health check failed: ${response.status}`);
      }

      const health = await response.json();
      console.log('VertexAISearch: Proxy connection successful:', health);
      return health;
    } catch (error) {
      console.error('VertexAISearch: Proxy connection failed:', error);
      throw new Error(`Cannot connect to proxy: ${error.message}`);
    }
  }

  async loadExistingVectors() {
    const storedVectors = await this.db.getAll('vectors');
    this.documentVectors = new Map(storedVectors.map(v => [v.id, v.vector]));
    console.log('VertexAISearch: Loaded', storedVectors.length, 'existing vectors');
  }

  async embed(text, taskType = 'RETRIEVAL_DOCUMENT') {
    if (!this.proxyUrl || !this.proxyUrl.trim()) {
      throw new Error('Proxy URL not configured');
    }
    // Enforce freemium embed cap via background manager (skip if custom proxy set)
    try {
      const status = await chrome.runtime.sendMessage({ action: 'usage_status' });
      const hasCustomProxy = !!status?.hasCustomProxy;
      if (!hasCustomProxy) {
        const gate = await chrome.runtime.sendMessage({ action: 'usage_consume', usageType: 'embed' });
        if (!gate || gate.allowed === false) {
          try { await chrome.runtime.sendMessage({ action: 'usage_cap_reached', type: 'embed' }); } catch (_) {}
          throw new Error('Free embedding limit reached. Add a custom Vertex proxy URL in Settings to continue.');
        }
      }
    } catch (capErr) {
      // If background messaging fails, proceed silently to avoid blocking basic use
      if (capErr && capErr.message && capErr.message.includes('limit')) throw capErr;
    }

    // Optional: respect user custom proxy from extension settings if available
    try {
      const settingsResp = await chrome.storage.local.get('extensionSettings');
      const settings = settingsResp?.extensionSettings || {};
      if (settings.customProxyUrl) {
        this.proxyUrl = settings.customProxyUrl;
      }
    } catch (_) {}
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    try {
      const payload = {
        text: text.substring(0, 3000), // Vertex AI limit
        task_type: taskType
      };

      console.log('VertexAISearch: Calling proxy for embedding...');
      const response = await fetch(`${this.proxyUrl}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-ID': chrome.runtime.id
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('VertexAISearch: Proxy Error:', response.status, errorText);
        throw new Error(`Proxy API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.embedding) {
        console.error('VertexAISearch: Invalid proxy response:', data);
        throw new Error('Invalid response format from proxy');
      }

      const embedding = data.embedding;
      console.log(`VertexAISearch: Generated ${embedding.length}D embedding via proxy`);
      
      return embedding;

    } catch (error) {
      console.error('VertexAISearch: Embedding failed:', error);
      throw error;
    }
  }

  async storeVector(id, vector) {
    // Store in IndexedDB
    await this.db.put('vectors', { id, vector });
    
    // Update in-memory cache
    this.documentVectors.set(id, vector);
  }

  async ensureDocumentEmbeddings(entries) {
    if (!this.proxyUrl || !this.proxyUrl.trim()) {
      throw new Error('Proxy URL not configured');
    }
    const entriesNeedingEmbeddings = entries.filter(entry => 
      !this.documentVectors.has(String(entry.id))
    );

    if (entriesNeedingEmbeddings.length === 0) {
      console.log('VertexAISearch: All documents already have embeddings');
      return;
    }

    console.log(`VertexAISearch: Creating embeddings for ${entriesNeedingEmbeddings.length} documents...`);
    
    // Process in batches to respect rate limits
    for (let i = 0; i < entriesNeedingEmbeddings.length; i += this.batchSize) {
      const batch = entriesNeedingEmbeddings.slice(i, i + this.batchSize);
      console.log(`VertexAISearch: Processing batch ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(entriesNeedingEmbeddings.length/this.batchSize)}`);
      
      for (const entry of batch) {
        try {
          const text = this.extractTextForEmbedding(entry);
          const embedding = await this.embed(text, 'RETRIEVAL_DOCUMENT');
          await this.storeVector(String(entry.id), embedding);
          
          // Delay between requests
          if (batch.indexOf(entry) < batch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, this.requestDelay));
          }
        } catch (error) {
          console.error(`VertexAISearch: Failed to embed document ${entry.id}:`, error);
          // Continue with other documents
        }
      }
      
      // Longer delay between batches
      if (i + this.batchSize < entriesNeedingEmbeddings.length) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay * 2));
      }
    }
  }

  extractTextForEmbedding(entry) {
    // Combine title and content for better semantic understanding
    const parts = [];
    if (entry.title) parts.push(entry.title);
    if (entry.content) parts.push(entry.content);
    if (entry.text) parts.push(entry.text);
    
    return parts.join('\n\n').substring(0, 3000); // Vertex AI limit
  }

  async semanticSearch(query, k = 10) {
    if (!this.isInitialized) {
      await this.init();
    }

    const startTime = performance.now();

    try {
      console.log('VertexAISearch: Performing semantic search for:', query);
      
      // Get all entries directly from storage and ensure they have embeddings
      const entriesResponse = await chrome.runtime.sendMessage({ action: 'get_entries' });
      const entries = entriesResponse?.entries || [];
      if (entries.length === 0) {
        return { results: [], isFallback: false, queryTime: 0 };
      }

      // Freemium cap gating for search counts
      // Always increment the search counter so the meter reflects actual usage,
      // but only block when the user is on the default proxy (no custom proxy).
      try {
        const status = await chrome.runtime.sendMessage({ action: 'usage_status' });
        const hasCustomProxy = !!status?.hasCustomProxy;
        const gate = await chrome.runtime.sendMessage({ action: 'usage_consume', usageType: 'search' });
        if (!hasCustomProxy) {
          if (!gate || gate.allowed === false) {
            try {
              await chrome.runtime.sendMessage({ action: 'usage_cap_reached', type: 'search' });
              // Also request page banner for current tab
              await chrome.runtime.sendMessage({ action: 'broadcast_usage_cap_embed' });
            } catch (_) {}
            throw new Error('Free semantic search limit reached. Set a Custom Vertex Proxy URL in Settings to continue.');
          }
        }
        // If hasCustomProxy, proceed regardless of cap; the counter still increments.
      } catch (err) {
        // Surface error back to caller
        throw err;
      }

      await this.ensureDocumentEmbeddings(entries);

      // Generate query embedding
      const queryVector = await this.embed(query, 'RETRIEVAL_QUERY');
      
      // Calculate similarities with optimizations
      const results = [];
      let processedCount = 0;
      
      for (const entry of entries) {
        const docVector = this.documentVectors.get(String(entry.id));
        if (docVector) {
          const similarity = this.cosineSimilarity(queryVector, docVector);
          // Use dynamic threshold based on dataset size
          const threshold = entries.length > 50 ? 0.15 : 0.1;
          
          if (similarity > threshold) {
            results.push({
              id: String(entry.id),
              score: similarity,
              searchType: 'semantic'
            });
            
            // Early termination if we have enough high-quality results
            if (results.length >= k * 3 && similarity > 0.8) {
              console.log(`VertexAISearch: Early termination after ${processedCount} entries`);
              break;
            }
          }
        }
        processedCount++;
      }

      // Sort by similarity and take top k
      results.sort((a, b) => b.score - a.score);
      const topResults = results.slice(0, k);

      const queryTime = performance.now() - startTime;
      console.log(`VertexAISearch: Found ${topResults.length} results in ${queryTime.toFixed(2)}ms`);

      return {
        results: topResults,
        isFallback: false,
        queryTime
      };

    } catch (error) {
      console.error('VertexAISearch: Search failed:', error);
      throw error;
    }
  }

  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // New: Conversational search with citations like NotebookLM
  async conversationalSearch(query, k = 10, conversationHistory = []) {
    if (!this.isInitialized) {
      await this.init();
    }

    console.log('VertexAISearch: Starting conversational search for:', query);



    let searchResults = null;
    try {
      // First, get the most relevant documents using semantic search
      searchResults = await this.semanticSearch(query, k);
      
      if (searchResults.results.length === 0) {
        return {
          response: "I couldn't find any relevant information in your saved articles to answer this question.",
          citations: [],
          summary: null
        };
      }

      // Get the actual documents
      const entriesResponse = await chrome.runtime.sendMessage({ action: 'get_entries' });
      const entries = entriesResponse?.entries || [];
      const relevantDocs = searchResults.results.map(result => {
        const entry = entries.find(e => String(e.id) === result.id);
        return entry ? {
          id: result.id,
          title: entry.title,
          content: this.extractTextForEmbedding(entry),
          url: entry.url || '',
          similarity: result.score
        } : null;
      }).filter(Boolean);

      // Generate a conversational response with citations
      const response = await this.generateCitedResponse(query, relevantDocs, conversationHistory);
      
      return {
        response: response.answer,
        citations: response.citations,
        summary: response.summary,
        sources: relevantDocs
      };

    } catch (error) {
      console.error('VertexAISearch: Conversational search failed:', error);
      
      // Provide a helpful fallback with the search results
      if (searchResults && searchResults.results.length > 0) {
        const entriesResponse = await chrome.runtime.sendMessage({ action: 'get_entries' });
        const entries = entriesResponse?.entries || [];
        const relevantDocs = searchResults.results.slice(0, 3).map(result => {
          const entry = entries.find(e => String(e.id) === result.id);
          return entry ? {
            id: result.id,
            title: entry.title,
            url: entry.url || '',
            similarity: result.score
          } : null;
        }).filter(Boolean);
        
        let fallbackResponse = `I found ${searchResults.results.length} relevant articles about "${query}" but couldn't generate a conversational response due to a technical issue. Here are the most relevant sources:\n\n`;
        
        relevantDocs.forEach((doc, index) => {
          fallbackResponse += `${index + 1}. ${doc.title} [${(doc.similarity * 100).toFixed(0)}% relevant]\n`;
        });
        
        return {
          response: fallbackResponse,
          citations: relevantDocs.map((doc, index) => ({
            id: doc.id,
            number: index + 1,
            title: doc.title,
            url: doc.url
          })),
          summary: `Found ${searchResults.results.length} sources (showing top ${relevantDocs.length})`,
          sources: relevantDocs
        };
      }
      
      return {
        response: "I encountered an error while searching your documents. Please check your connection and try again.",
        citations: [],
        summary: null
      };
    }
  }

  // Generate a response with proper citations using Gemini
  async generateCitedResponse(query, documents, conversationHistory = []) {
    const context = documents.map((doc, index) => 
      `[${index + 1}] ${doc.title}\n${doc.content.substring(0, 2500)}`
    ).join('\n\n---\n\n');

    // Build conversation history context
    let historyContext = '';
    if (conversationHistory.length > 0) {
      historyContext = '\n\nPREVIOUS CONVERSATION:\n' + 
        conversationHistory.map(turn => `${turn.role.toUpperCase()}: ${turn.content}`).join('\n') + '\n';
    }

    const prompt = `

DOCUMENTS:
${context}${historyContext}

CURRENT QUESTION: ${query}

INSTRUCTIONS:
1. Format your response as clear, readable bullet points using the • symbol
2. Put each bullet point on a separate line
3. Each bullet point should contain one key insight or piece of information FROM THE ACTUAL DOCUMENT CONTENT PROVIDED
4. Use [1], [2], etc. to cite specific documents after each relevant bullet point
5. Make sure it begins at [1] and ends at [10]. Do not use any other citation numbers and follow the wrong order
6. ONLY use information from the provided documents - READ THE FULL CONTENT of each document carefully
7. If this is a follow-up question, reference the previous conversation context appropriately
8. If a specific document doesn't contain relevant information about the query, extract the most relevant information it DOES contain
9. 10 comprehensive bullet points, one for each of the top 10 most relevant articles based on similarity score
10. Make sure to use the correct citation number for each bullet point, and each citation number should be used only once for each article
11. NEVER say "The provided document does not contain information about X" - instead find the most relevant content from that document

CRITICAL: Use this exact format with each bullet point on its own line. Do NOT add any introductory text or explanations:

• Key insight from the most relevant article based on similarity score [1]
• Next most relevant information from second article [2] 
• Supporting point from third most relevant source [3]
• Important insight from fourth ranked article [4]
• Relevant details from fifth ranked source [5]
• Key point from sixth most relevant article [6]
• Notable information from seventh ranked source [7]
• Important detail from eighth ranked article [8]
• Supporting insight from ninth ranked source [9]
• Final relevant point from tenth ranked article [10]

Do NOT use asterisks (*) or dashes (-). Use the bullet symbol (•) and put each point on a separate line. Do NOT add any introductory text like "Here's a summary" or "Based on the documents". Start directly with the first bullet point.`;

    try {
      const response = await this.callGemini(prompt);
      
      // Parse the response to extract citations
      const citations = this.extractCitations(response, documents);
      
      return {
        answer: response,
        citations: citations,
        summary: `Based on ${documents.length} sources from your saved articles`
      };
    } catch (error) {
      console.error('VertexAISearch: Failed to generate cited response:', error);
      throw error;
    }
  }



  // Call Vertex AI Gemini through the proxy
  async callGemini(prompt, model = 'gemini-2.0-flash-exp') {
    // Respect custom proxy
    try {
      const settingsResp = await chrome.storage.local.get('extensionSettings');
      const settings = settingsResp?.extensionSettings || {};
      if (settings.customProxyUrl) {
        this.proxyUrl = settings.customProxyUrl;
      }
    } catch (_) {}
    try {
      const response = await fetch(`${this.proxyUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-ID': chrome.runtime.id
        },
        body: JSON.stringify({
          prompt: prompt,
          model: model,
          max_tokens: 2000,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data.response || data.text || '';
    } catch (error) {
      console.error('VertexAISearch: Gemini call failed:', error);
      throw error;
    }
  }

  // Extract citations from the response
  extractCitations(response, documents) {
    const citations = [];
    const citationPattern = /\[(\d+)\]/g;
    let match;

    while ((match = citationPattern.exec(response)) !== null) {
      const citationNum = parseInt(match[1]);
      if (citationNum > 0 && citationNum <= documents.length) {
        const doc = documents[citationNum - 1];
        if (!citations.find(c => c.id === doc.id)) {
          citations.push({
            id: doc.id,
            number: citationNum,
            title: doc.title,
            url: doc.url,
            similarity: doc.similarity || 0
          });
        }
      }
    }

    return citations;
  }

  // Summarize a specific article
  async summarizeArticle(articleId) {
    const entriesResponse = await chrome.runtime.sendMessage({ action: 'get_entries' });
    const entries = entriesResponse?.entries || [];
    const article = entries.find(e => String(e.id) === String(articleId));
    
    if (!article) {
      throw new Error('Article not found');
    }

    const content = this.extractTextForEmbedding(article);
    const prompt = `

Title: ${article.title}
Content: ${content}

Format your response as:

Overview: 
1-2 sentences maximum explaining what this article is about.

Key Points:
• First main point from the article
• Second important insight  
• Third key takeaway

Main Takeaway: 
One sentence conclusion about the article's central message.

Keep it concise and easy to scan. Make the header of each section bold. Focus on the most important insights only. Keep the format clean and human readable.`;

    try {
      const summary = await this.callGemini(prompt);
      return {
        title: article.title,
        url: article.url,
        summary: summary,
        wordCount: content.split(' ').length
      };
    } catch (error) {
      console.error('VertexAISearch: Article summarization failed:', error);
      throw error;
    }
  }

  async getStatus() {
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing,
      documentCount: this.documentVectors.size,
      proxyUrl: this.proxyUrl,
      projectId: this.projectId,
      model: this.model
    };
  }

  async clearCache() {
    if (this.db) {
      await this.db.clear('vectors');
      await this.db.clear('metadata');
    }
    this.documentVectors.clear();
    
    console.log('VertexAISearch: Cache cleared');
  }
}

// Make available globally
window.VertexAISearch = VertexAISearch;