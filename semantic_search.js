// Semantic Search Module using TensorFlow.js and Universal Sentence Encoder
// No API key required - runs entirely locally

class SemanticSearch {
  constructor() {
    this.model = null;
    this.isModelLoaded = false;
    this.isLoading = false;
    this.embeddingsCache = new Map();
  }

  async init() {
    if (this.isModelLoaded || this.isLoading) return;
    
    this.isLoading = true;
    console.log('SemanticSearch: Initializing...');
    
    try {
      // Load the lightweight semantic search model
      await this.loadModel();
      
      this.isModelLoaded = true;
      console.log('SemanticSearch: Model loaded successfully');
    } catch (error) {
      console.error('SemanticSearch: Failed to initialize:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async loadTensorFlow() {
    // For the lightweight approach, we don't need TensorFlow.js
    // This method is kept for compatibility but does nothing
    console.log('SemanticSearch: Using lightweight approach - no TensorFlow.js needed');
    return Promise.resolve();
  }

  async loadModel() {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('SemanticSearch: Using lightweight semantic search...');
        
        // For now, we'll use a simple but effective approach
        // This can be enhanced later with a proper model
        this.model = {
          // Simple text preprocessing and keyword extraction
          preprocess: (text) => {
            return text.toLowerCase()
              .replace(/[^\w\s]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .split(' ')
              .filter(word => word.length > 2);
          },
          
          // Simple semantic similarity using word overlap and TF-IDF-like scoring
          similarity: (query, text) => {
            const queryWords = this.model.preprocess(query);
            const textWords = this.model.preprocess(text);
            
            if (queryWords.length === 0 || textWords.length === 0) return 0;
            
            // Calculate word overlap
            const commonWords = queryWords.filter(word => textWords.includes(word));
            const overlapScore = commonWords.length / queryWords.length;
            
            // Calculate word frequency bonus
            const frequencyBonus = commonWords.reduce((score, word) => {
              const textFreq = textWords.filter(w => w === word).length;
              return score + Math.min(textFreq / textWords.length, 0.1);
            }, 0);
            
            return Math.min(overlapScore + frequencyBonus, 1);
          }
        };
        
        console.log('SemanticSearch: Lightweight semantic search ready');
        resolve();
      } catch (error) {
        console.error('SemanticSearch: Failed to load model:', error);
        reject(error);
      }
    });
  }

  async generateEmbedding(text) {
    if (!this.isModelLoaded) {
      await this.init();
    }

    // For the lightweight approach, we just return the preprocessed text
    // This is used for caching purposes
    const cleanText = this.preprocessText(text);
    return cleanText;
  }

  async search(query, entries, topK = 10) {
    if (!this.isModelLoaded) {
      await this.init();
    }

    console.log(`SemanticSearch: Searching for "${query}" in ${entries.length} entries`);
    
    try {
      // Calculate similarities using the lightweight model
      const results = entries
        .map(entry => {
          const similarity = this.model.similarity(query, entry.text);
          const result = {
            ...entry,
            similarity: Math.round(similarity * 100) / 100, // Round to 2 decimal places
            searchType: 'semantic'
          };
          
          // Log similarity calculation
          if (result.similarity > 0.1) {
            console.log(`SemanticSearch: "${entry.title}" - similarity: ${result.similarity}`);
          }
          
          return result;
        })
        .filter(result => result.similarity > 0) // Only include results with some similarity
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      console.log(`SemanticSearch: Found ${results.length} results`);
      console.log('SemanticSearch: Top 3 results:', results.slice(0, 3).map(r => ({ title: r.title, similarity: r.similarity })));
      return results;
    } catch (error) {
      console.error('SemanticSearch: Search failed:', error);
      throw error;
    }
  }



  preprocessText(text) {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000); // Limit length for performance
  }

  getCacheKey(text) {
    return text.toLowerCase().trim();
  }

  async clearCache() {
    this.embeddingsCache.clear();
    console.log('SemanticSearch: Cache cleared');
  }

  getStatus() {
    return {
      isModelLoaded: this.isModelLoaded,
      isLoading: this.isLoading,
      cacheSize: this.embeddingsCache.size
    };
  }

  // Fallback to keyword search if semantic search fails
  async fallbackSearch(query, entries, topK = 10) {
    console.log('SemanticSearch: Using fallback keyword search');
    
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const results = [];

    for (const entry of entries) {
      const text = entry.text.toLowerCase();
      let score = 0;
      let matches = 0;

      for (const word of queryWords) {
        if (text.includes(word)) {
          score += 1;
          matches++;
        }
      }

      if (matches > 0) {
        const similarity = matches / queryWords.length;
        results.push({
          ...entry,
          similarity: Math.round(similarity * 100) / 100,
          searchType: 'keyword'
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}

// Export for use in other modules
window.SemanticSearch = SemanticSearch; 