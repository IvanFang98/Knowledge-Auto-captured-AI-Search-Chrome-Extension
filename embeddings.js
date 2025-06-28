// Local text similarity and embedding functionality
// This provides semantic similarity matching without external APIs

console.log('📊 Loading embeddings module...');

// Simple TF-IDF based text similarity implementation
class LocalTextSimilarity {
  constructor() {
    this.vocabulary = new Set();
    this.documents = [];
    this.tfidfVectors = [];
  }

  // Tokenize text into words
  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word));
  }

  // Basic stop words list
  isStopWord(word) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we',
      'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her',
      'its', 'our', 'their'
    ]);
    return stopWords.has(word);
  }

  // Calculate term frequency
  calculateTF(tokens) {
    const tf = {};
    const totalTokens = tokens.length;
    
    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1;
    }
    
    // Normalize by document length
    for (const token in tf) {
      tf[token] = tf[token] / totalTokens;
    }
    
    return tf;
  }

  // Calculate inverse document frequency
  calculateIDF() {
    const idf = {};
    const totalDocs = this.documents.length;
    
    for (const word of this.vocabulary) {
      let docsWithWord = 0;
      for (const doc of this.documents) {
        if (doc.tokens.includes(word)) {
          docsWithWord++;
        }
      }
      idf[word] = Math.log(totalDocs / (docsWithWord || 1));
    }
    
    return idf;
  }

  // Add document to the corpus
  addDocument(id, text, metadata = {}) {
    const tokens = this.tokenize(text);
    const tf = this.calculateTF(tokens);
    
    // Add tokens to vocabulary
    tokens.forEach(token => this.vocabulary.add(token));
    
    const doc = {
      id,
      text,
      tokens,
      tf,
      metadata
    };
    
    this.documents.push(doc);
    
    // Recalculate TF-IDF vectors when a new document is added
    this.updateTFIDFVectors();
    
    return doc;
  }

  // Update TF-IDF vectors for all documents
  updateTFIDFVectors() {
    const idf = this.calculateIDF();
    this.tfidfVectors = [];
    
    for (const doc of this.documents) {
      const vector = {};
      for (const word of this.vocabulary) {
        const tfValue = doc.tf[word] || 0;
        const idfValue = idf[word] || 0;
        vector[word] = tfValue * idfValue;
      }
      this.tfidfVectors.push(vector);
    }
  }

  // Calculate cosine similarity between two vectors
  cosineSimilarity(vectorA, vectorB) {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    const allWords = new Set([...Object.keys(vectorA), ...Object.keys(vectorB)]);
    
    for (const word of allWords) {
      const valueA = vectorA[word] || 0;
      const valueB = vectorB[word] || 0;
      
      dotProduct += valueA * valueB;
      magnitudeA += valueA * valueA;
      magnitudeB += valueB * valueB;
    }
    
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Find similar documents to a query
  findSimilar(queryText, limit = 10, threshold = 0.1) {
    if (this.documents.length === 0) {
      return [];
    }

    const queryTokens = this.tokenize(queryText);
    const queryTF = this.calculateTF(queryTokens);
    const idf = this.calculateIDF();
    
    // Create query vector
    const queryVector = {};
    for (const word of this.vocabulary) {
      const tfValue = queryTF[word] || 0;
      const idfValue = idf[word] || 0;
      queryVector[word] = tfValue * idfValue;
    }
    
    // Calculate similarities
    const similarities = [];
    for (let i = 0; i < this.documents.length; i++) {
      const similarity = this.cosineSimilarity(queryVector, this.tfidfVectors[i]);
      if (similarity > threshold) {
        similarities.push({
          document: this.documents[i],
          similarity: similarity,
          score: similarity
        });
      }
    }
    
    // Sort by similarity (descending) and limit results
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  // Get statistics about the corpus
  getStats() {
    return {
      totalDocuments: this.documents.length,
      vocabularySize: this.vocabulary.size,
      averageDocumentLength: this.documents.length > 0 
        ? this.documents.reduce((sum, doc) => sum + doc.tokens.length, 0) / this.documents.length 
        : 0
    };
  }

  // Clear all documents
  clear() {
    this.vocabulary.clear();
    this.documents = [];
    this.tfidfVectors = [];
  }

  // Export corpus data
  exportData() {
    return {
      documents: this.documents.map(doc => ({
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata
      })),
      vocabulary: Array.from(this.vocabulary),
      stats: this.getStats()
    };
  }

  // Import corpus data
  importData(data) {
    this.clear();
    
    if (data.documents) {
      for (const doc of data.documents) {
        this.addDocument(doc.id, doc.text, doc.metadata);
      }
    }
  }
}

// Global instance
const textSimilarity = new LocalTextSimilarity();

// Initialize with existing entries from storage
async function initializeEmbeddings() {
  try {
    console.log('🔄 Initializing text similarity with existing entries...');
    
    const result = await chrome.storage.local.get(['textEntries']);
    const entries = result.textEntries || [];
    
    console.log(`📚 Loading ${entries.length} entries into similarity engine...`);
    
    for (const entry of entries) {
      // Combine title and text for better similarity matching
      const fullText = `${entry.title || ''} ${entry.text || ''}`.trim();
      
      textSimilarity.addDocument(entry.id, fullText, {
        timestamp: entry.timestamp,
        url: entry.url,
        title: entry.title,
        wordCount: entry.wordCount
      });
    }
    
    const stats = textSimilarity.getStats();
    console.log('📊 Text similarity initialized:', stats);
    
    return {
      success: true,
      stats
    };
    
  } catch (error) {
    console.error('❌ Error initializing embeddings:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Add a new entry to the similarity engine
async function addEntryEmbedding(entry) {
  try {
    const fullText = `${entry.title || ''} ${entry.text || ''}`.trim();
    
    const doc = textSimilarity.addDocument(entry.id, fullText, {
      timestamp: entry.timestamp,
      url: entry.url,
      title: entry.title,
      wordCount: entry.wordCount
    });
    
    console.log(`✅ Added entry ${entry.id} to similarity engine`);
    return { success: true, document: doc };
    
  } catch (error) {
    console.error('❌ Error adding entry embedding:', error);
    return { success: false, error: error.message };
  }
}

// Find similar entries
async function findSimilarEntries(query, options = {}) {
  try {
    const {
      limit = 10,
      threshold = 0.1,
      includeScores = true
    } = options;
    
    console.log(`🔍 Finding similar entries for: "${query.substring(0, 50)}..."`);
    
    const results = textSimilarity.findSimilar(query, limit, threshold);
    
    // Convert results to the expected format
    const formattedResults = results.map(result => ({
      id: result.document.id,
      title: result.document.metadata.title,
      text: result.document.text,
      url: result.document.metadata.url,
      timestamp: result.document.metadata.timestamp,
      wordCount: result.document.metadata.wordCount,
      similarity: result.similarity,
      score: result.score
    }));
    
    console.log(`📊 Found ${formattedResults.length} similar entries`);
    
    return {
      success: true,
      results: formattedResults,
      query,
      stats: {
        totalChecked: textSimilarity.documents.length,
        resultsFound: formattedResults.length,
        threshold
      }
    };
    
  } catch (error) {
    console.error('❌ Error finding similar entries:', error);
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
}

// Get similarity statistics
function getSimilarityStats() {
  const stats = textSimilarity.getStats();
  return {
    success: true,
    stats: {
      ...stats,
      hasEmbeddings: stats.totalDocuments > 0,
      embeddingCoverage: stats.totalDocuments > 0 ? 100 : 0 // All documents have "embeddings" in this local approach
    }
  };
}

// Clear all embeddings
function clearEmbeddings() {
  textSimilarity.clear();
  console.log('🧹 Cleared all text similarity data');
  return { success: true };
}

// Export similarity data
function exportSimilarityData() {
  try {
    const data = textSimilarity.exportData();
    return {
      success: true,
      data,
      exportedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error exporting similarity data:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Auto-initialize when the module loads
if (typeof chrome !== 'undefined' && chrome.storage) {
  // Add a small delay to ensure storage is available
  setTimeout(() => {
    initializeEmbeddings().then(result => {
      if (result.success) {
        console.log('✅ Text similarity auto-initialized successfully');
      } else {
        console.warn('⚠️ Text similarity auto-initialization failed:', result.error);
      }
    });
  }, 1000);
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeEmbeddings,
    addEntryEmbedding,
    findSimilarEntries,
    getSimilarityStats,
    clearEmbeddings,
    exportSimilarityData,
    textSimilarity
  };
} else if (typeof window !== 'undefined') {
  window.embeddings = {
    initializeEmbeddings,
    addEntryEmbedding,
    findSimilarEntries,
    getSimilarityStats,
    clearEmbeddings,
    exportSimilarityData,
    textSimilarity
  };
}

console.log('✅ Local text similarity module loaded successfully'); 