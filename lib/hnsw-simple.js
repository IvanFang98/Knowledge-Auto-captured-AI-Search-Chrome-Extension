// Simple HNSW implementation for Chrome extension
// This is a basic fallback that always uses brute-force search

class SimpleHNSW {
  constructor(metric = 'cosine', dimensions = 384) {
    this.metric = metric;
    this.dimensions = dimensions;
    this.points = new Map(); // id -> vector
    this.isInitialized = false;
    this.elementCount = 0;
  }

  async init() {
    this.isInitialized = true;
    console.log('SimpleHNSW: Initialized (using brute-force search)');
  }

  addPoint(vector, id) {
    this.points.set(id, vector);
    this.elementCount = this.points.size;
  }

  searchKnn(queryVector, k) {
    if (!this.isInitialized) {
      console.warn('SimpleHNSW: Not initialized, returning empty results');
      return { neighbors: [], distances: [] };
    }

    const similarities = [];
    
    for (const [id, vector] of this.points) {
      const similarity = this.cosineSimilarity(queryVector, vector);
      similarities.push({ id, similarity });
    }

    // Sort by similarity (descending) and take top k
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topK = similarities.slice(0, k);

    return {
      neighbors: topK.map(item => item.id),
      distances: topK.map(item => 1 - item.similarity) // Convert similarity to distance
    };
  }

  cosineSimilarity(vecA, vecB) {
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

  clear() {
    this.points.clear();
    this.elementCount = 0;
  }
}

// Export for use in other modules
window.SimpleHNSW = SimpleHNSW; 