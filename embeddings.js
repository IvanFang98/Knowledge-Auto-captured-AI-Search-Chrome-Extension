// Embeddings service for generating text embeddings
console.log('🧠 Embeddings service loading...');

class EmbeddingsService {
  constructor() {
    this.apiKey = null;
    this.baseUrl = 'https://api.openai.com/v1';
    this.model = 'text-embedding-3-small';
    this.dimensions = 1536; // Default for text-embedding-3-small
  }

  async initialize() {
    // Try to get API key from chrome.storage
    try {
      const result = await chrome.storage.local.get(['openai_api_key']);
      if (result.openai_api_key) {
        this.apiKey = result.openai_api_key;
        console.log('✅ OpenAI API key loaded from storage');
      } else {
        console.log('⚠️ No OpenAI API key found - vector search will use fallback method');
      }
    } catch (error) {
      console.log('⚠️ Could not access storage for API key');
    }
  }

  async setApiKey(apiKey) {
    this.apiKey = apiKey;
    try {
      await chrome.storage.local.set({ openai_api_key: apiKey });
      console.log('✅ API key saved to storage');
    } catch (error) {
      console.error('❌ Failed to save API key:', error);
    }
  }

  async generateEmbedding(text, maxLength = 8000) {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for embedding generation');
    }

    // Truncate text if too long (OpenAI has token limits)
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

    const result = this.apiKey ? 
      await this.generateOpenAIEmbedding(truncatedText) :
      await this.generateFallbackEmbedding(truncatedText);

    // Add timestamp and return structured result
    return {
      ...result,
      created: new Date().toISOString()
    };
  }

  async generateOpenAIEmbedding(text) {
    try {
      console.log('🌐 Generating OpenAI embedding...');
      
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          dimensions: this.dimensions
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid response from OpenAI API');
      }

      console.log('✅ OpenAI embedding generated');
      return {
        embedding: data.data[0].embedding,
        method: 'openai',
        model: this.model
      };
      
    } catch (error) {
      console.error('❌ OpenAI embedding generation failed:', error);
      // Fallback to local method
      console.log('🔄 Falling back to local embedding method...');
      return await this.generateFallbackEmbedding(text);
    }
  }

  async generateFallbackEmbedding(text) {
    console.log('🏠 Generating fallback embedding...');
    
    // Simple fallback: TF-IDF inspired approach
    // This won't be as good as OpenAI embeddings but will work for basic similarity
    
    const words = this.tokenize(text.toLowerCase());
    const wordFreq = new Map();
    
    // Count word frequencies
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
    
    // Create a hash-based embedding
    const embedding = new Array(this.dimensions).fill(0);
    
    for (const [word, freq] of wordFreq.entries()) {
      const hash = this.hashString(word);
      for (let i = 0; i < 10; i++) { // Use multiple hash positions
        const pos = (hash + i * 17) % this.dimensions;
        embedding[pos] += freq * 0.1; // Weight by frequency
      }
    }
    
    // Normalize the embedding
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }
    
    console.log('✅ Fallback embedding generated');
    return {
      embedding: embedding,
      method: 'fallback',
      model: 'tf-idf'
    };
  }

  tokenize(text) {
    // Simple tokenization - remove punctuation and split on whitespace
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2); // Filter out very short words
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async generateBatchEmbeddings(texts, batchSize = 100) {
    console.log(`🔄 Generating embeddings for ${texts.length} texts...`);
    
    const results = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.generateEmbedding(text));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        console.log(`✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
        
        // Small delay to avoid rate limiting
        if (this.apiKey && i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Error processing batch ${Math.floor(i / batchSize) + 1}:`, error);
        // Add empty embeddings for failed batch
        results.push(...new Array(batch.length).fill(null));
      }
    }
    
    console.log(`✅ Generated ${results.filter(r => r !== null).length}/${texts.length} embeddings`);
    return results;
  }

  hasApiKey() {
    return !!this.apiKey;
  }

  getModelInfo() {
    return {
      model: this.model,
      dimensions: this.dimensions,
      hasApiKey: this.hasApiKey(),
      provider: this.hasApiKey() ? 'OpenAI' : 'Fallback'
    };
  }
}

// Create and export the embeddings service
// Make it available globally for the extension
if (typeof window !== 'undefined') {
  window.embeddingsService = new EmbeddingsService();
} else if (typeof self !== 'undefined') {
  self.embeddingsService = new EmbeddingsService();
}

console.log('✅ Embeddings service loaded'); 