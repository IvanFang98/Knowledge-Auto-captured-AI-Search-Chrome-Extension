// Vertex AI Semantic Search Implementation
// Uses Cloud Run proxy to access Vertex AI Text Embedding API

class VertexAISearch {
  constructor(config = {}) {
    // Use provided config or fall back to global config
    const globalConfig = window.VERTEX_CONFIG || {};
    this.proxyUrl = config.proxyUrl || globalConfig.proxyUrl || 'YOUR_CLOUD_RUN_URL';
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
      
      // Get all entries and ensure they have embeddings
      const entries = AppState.allEntries || [];
      if (entries.length === 0) {
        return { results: [], isFallback: false, queryTime: 0 };
      }

      await this.ensureDocumentEmbeddings(entries);

      // Generate query embedding
      const queryVector = await this.embed(query, 'RETRIEVAL_QUERY');
      
      // Calculate similarities
      const results = [];
      for (const entry of entries) {
        const docVector = this.documentVectors.get(String(entry.id));
        if (docVector) {
          const similarity = this.cosineSimilarity(queryVector, docVector);
          if (similarity > 0.1) { // Filter very low similarities
            results.push({
              id: String(entry.id),
              score: similarity,
              searchType: 'semantic'
            });
          }
        }
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