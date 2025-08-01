// Real Semantic Search Module using @xenova/transformers and HNSW
// No API keys required - runs entirely locally

// Load @xenova/transformers from CDN
let pipeline = null;
let openDB = null;
let HNSW = null;

// Load dependencies dynamically
async function loadDependencies() {
  if (pipeline && openDB && HNSW) return; // Already loaded
  
  try {
    // Load @xenova/transformers from local file
    const transformers = await import('./lib/transformers.min.js');
    pipeline = transformers.pipeline;
    
    // Use global idb (loaded via script tag)
    openDB = window.idb.openDB;
    
    // Use global SimpleHNSW (loaded via script tag)
    HNSW = window.SimpleHNSW;
    
    console.log('SemanticSearchV2: Dependencies loaded successfully');
  } catch (error) {
    console.error('SemanticSearchV2: Failed to load dependencies:', error);
    throw error;
  }
}

class SemanticSearchV2 {
  constructor() {
    this.embedder = null;
    this.hnsw = null;
    this.db = null;
    this.isInitialized = false;
    this.isInitializing = false;
    this.initializationPromise = null;
  }

  async init() {
    if (this.isInitialized) return;
    if (this.isInitializing) return this.initializationPromise;

    this.isInitializing = true;
    this.initializationPromise = this._initInternal();
    
    try {
      await this.initializationPromise;
      this.isInitialized = true;
    } catch (error) {
      this.isInitializing = false;
      throw error;
    }

    return this.initializationPromise;
  }

  async _initInternal() {
    console.log('SemanticSearchV2: Initializing...');

    try {
      // Load dependencies first
      await loadDependencies();
      
      // Initialize IndexedDB
      this.db = await openDB('kb', 2, {
        upgrade(db) {
          // Create articles store if it doesn't exist
          if (!db.objectStoreNames.contains('articles')) {
            db.createObjectStore('articles', { keyPath: 'id' });
          }
          // Create vectors store
          if (!db.objectStoreNames.contains('vectors')) {
            db.createObjectStore('vectors', { keyPath: 'id' });
          }
        }
      });

      // Load the embedding model
      console.log('SemanticSearchV2: Loading embedding model...');
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { quantized: true }
      );

      // Initialize HNSW index
      console.log('SemanticSearchV2: Initializing HNSW index...');
      this.hnsw = new HNSW('cosine', 384);
      await this.hnsw.init();

      // Back-fill existing articles
      await this._backfillEmbeddings();

      console.log('SemanticSearchV2: Initialization complete');
    } catch (error) {
      console.error('SemanticSearchV2: Initialization failed:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async _backfillEmbeddings() {
    console.log('SemanticSearchV2: Back-filling embeddings...');
    
    const articles = await this.db.getAll('articles');
    let processed = 0;
    let added = 0;

    for (const article of articles) {
      processed++;
      
      // Check if vector already exists
      const existingVector = await this.db.get('vectors', article.id);
      if (existingVector) {
        // Add to HNSW if not already there
        if (!this.hnsw.isInitialized || this.hnsw.elementCount < 1000) {
          this.hnsw.addPoint(existingVector.vec, article.id);
        }
        continue;
      }

      try {
        // Generate embedding for article content
        const vec = await this.embed(article.content || article.text || '');
        await this.storeVector(article.id, vec);
        added++;
        
        // Log progress every 10 articles
        if (processed % 10 === 0) {
          console.log(`SemanticSearchV2: Processed ${processed}/${articles.length} articles, added ${added} embeddings`);
        }
      } catch (error) {
        console.error(`SemanticSearchV2: Failed to embed article ${article.id}:`, error);
      }
    }

    console.log(`SemanticSearchV2: Back-fill complete. Processed ${processed} articles, added ${added} embeddings`);
    
    // Notify UI that HNSW is warm if we have enough points
    if (this.hnsw.elementCount >= 1000) {
      chrome.runtime.sendMessage({ action: 'hnswWarm' });
    }
  }

  async embed(text) {
    if (!this.embedder) {
      await this.init();
    }
    
    // Clean and truncate text
    const cleanText = this._preprocessText(text);
    const embedding = await this.embedder(cleanText);
    return embedding[0]; // Float32Array(384)
  }

  async storeVector(id, vec) {
    if (!this.db) {
      await this.init();
    }

    // Store in IndexedDB
    await this.db.put('vectors', { id, vec });
    
    // Add to HNSW index
    if (this.hnsw && this.hnsw.isInitialized) {
      this.hnsw.addPoint(vec, id);
    }
  }

  async semanticSearch(query, k = 10) {
    if (!this.isInitialized) {
      await this.init();
    }

    const startTime = performance.now();
    let isFallback = false;

    try {
      // Embed the query
      const qVec = await this.embed(query);

      let results;

      // Check if HNSW is ready
      if (this.hnsw && this.hnsw.isInitialized && this.hnsw.elementCount >= 1000) {
        // Use HNSW for fast approximate search
        const { neighbors, distances } = this.hnsw.searchKnn(qVec, k);
        results = neighbors.map((id, i) => ({ 
          id, 
          score: 1 - distances[i] 
        }));
      } else {
        // Fallback to brute-force search
        isFallback = true;
        console.log('SemanticSearchV2: Using fallback search - HNSW not ready');
        
        const vectors = await this.db.getAll('vectors');
        const similarities = vectors.map(({ id, vec }) => ({
          id,
          score: this._cosineSimilarity(qVec, vec)
        }));

        results = similarities
          .sort((a, b) => b.score - a.score)
          .slice(0, k);
      }

      const queryTime = performance.now() - startTime;
      console.log(`SemanticSearchV2: Search completed in ${queryTime.toFixed(2)}ms (${isFallback ? 'fallback' : 'HNSW'})`);

      return {
        results,
        isFallback,
        queryTime
      };

    } catch (error) {
      console.error('SemanticSearchV2: Search failed:', error);
      throw error;
    }
  }

  _cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  _preprocessText(text) {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000); // Limit length for performance
  }

  async getStatus() {
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing,
      hnswInitialized: this.hnsw?.isInitialized || false,
      hnswElementCount: this.hnsw?.elementCount || 0,
      dbReady: !!this.db,
      embedderReady: !!this.embedder
    };
  }

  async clearCache() {
    if (this.db) {
      await this.db.clear('vectors');
    }
    if (this.hnsw) {
      this.hnsw.clear();
    }
    console.log('SemanticSearchV2: Cache cleared');
  }
}

// Export for use in other modules
window.SemanticSearchV2 = SemanticSearchV2; 