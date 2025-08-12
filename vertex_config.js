// Vertex AI Configuration
// Update these values with your Cloud Run proxy details

const VERTEX_CONFIG = {
  // Your Cloud Run proxy URL (will be provided after deployment)
  proxyUrl: '',
  
  // Your Google Cloud Project ID
  projectId: 'chrome-ext-knowledge-base',
  
  // Text embedding model to use
  // Options: 'text-embedding-004' (latest), 'textembedding-gecko@003'
  model: 'text-embedding-004',
  
  // Rate limiting settings (applied on proxy side)
  batchSize: 5,        // Number of documents to process at once
  requestDelay: 1000,  // Milliseconds between API requests
  
  // Optional: allowlist of extension IDs that may use the built-in default proxy
  // Manage IDs here to avoid code edits. Include Web Store and dev IDs as needed.
  allowedExtensionIds: [
    'ncjpgepmkgekadjmigeajanfgfcjhebm', // Web Store build (official)
    'bdejnceffielomjpkbapcdpahbmjgjfl'  // Your current build ID
  ]
};

// Make config available in both window (DOM) and service worker (globalThis)
try { if (typeof window !== 'undefined') { window.VERTEX_CONFIG = VERTEX_CONFIG; } } catch (_) {}
try { if (typeof globalThis !== 'undefined') { globalThis.VERTEX_CONFIG = VERTEX_CONFIG; } } catch (_) {}