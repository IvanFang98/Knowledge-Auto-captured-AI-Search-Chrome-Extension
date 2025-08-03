// Vertex AI Configuration
// Update these values with your Cloud Run proxy details

const VERTEX_CONFIG = {
  // Your Cloud Run proxy URL (will be provided after deployment)
  proxyUrl: 'https://vertex-ai-proxy-603340132885.us-central1.run.app',
  
  // Your Google Cloud Project ID
  projectId: 'chrome-ext-knowledge-base',
  
  // Text embedding model to use
  // Options: 'text-embedding-004' (latest), 'textembedding-gecko@003'
  model: 'text-embedding-004',
  
  // Rate limiting settings (applied on proxy side)
  batchSize: 5,        // Number of documents to process at once
  requestDelay: 1000,  // Milliseconds between API requests
};

// Make config available globally
window.VERTEX_CONFIG = VERTEX_CONFIG;