// Focused NotebookLM API Debugging Script
// Paste this directly into the NotebookLM console (F12 -> Console tab)

console.log('🕵️ Focused NotebookLM API Debugger Loading...');

// Store original fetch
const originalFetch = window.fetch;

// Override fetch to log ONLY real API calls
window.fetch = function(...args) {
  const [url, options] = args;
  
  // EXCLUDE analytics and other noise, INCLUDE only real API calls
  const isNotebookLMAPI = url.includes('NotebookLm') || 
                         (url.includes('_/') && !url.includes('analytics')) ||
                         url.includes('batchexecute') ||
                         (url.includes('rpc') && !url.includes('analytics')) ||
                         (url.includes('/api/') && url.includes('google.com'));
  
  // EXCLUDE analytics completely
  const isAnalytics = url.includes('analytics.google.com') || 
                     url.includes('RotateCookies') ||
                     url.includes('g/collect') ||
                     url.includes('firebase') ||
                     url.includes('doubleclick');
  
  if (isNotebookLMAPI && !isAnalytics) {
    console.log('🎯 REAL NotebookLM API Call Found!');
    console.log('📍 URL:', url);
    console.log('⚙️ Method:', options?.method || 'GET');
    console.log('🏷️ Headers:', options?.headers || {});
    
    if (options && options.body) {
      console.log('📦 Request Body (raw):', options.body);
      
      // Handle different body types
      if (typeof options.body === 'string') {
        // Check for Google RPC format
        if (options.body.includes('f.req=')) {
          console.log('🔧 Google RPC Format Detected');
          const match = options.body.match(/f\.req=([^&]*)/);
          if (match) {
            try {
              const decoded = decodeURIComponent(match[1]);
              console.log('🔓 Decoded f.req:', decoded);
              const parsed = JSON.parse(decoded);
              console.log('📋 Parsed f.req JSON:', JSON.stringify(parsed, null, 2));
            } catch (e) {
              console.log('📄 f.req (raw):', decoded);
            }
          }
        } else {
          // Try JSON parsing
          try {
            const parsedBody = JSON.parse(options.body);
            console.log('📋 Parsed JSON Body:', JSON.stringify(parsedBody, null, 2));
          } catch (e) {
            console.log('📄 Non-JSON Body String:', options.body);
          }
        }
      } else if (options.body instanceof URLSearchParams) {
        console.log('📄 URLSearchParams Body:');
        for (let [key, value] of options.body) {
          console.log(`  ${key}: ${value}`);
          if (key === 'f.req') {
            try {
              const parsed = JSON.parse(value);
              console.log('📋 Parsed f.req:', JSON.stringify(parsed, null, 2));
            } catch (e) {
              console.log('📄 f.req (raw):', value);
            }
          }
        }
      }
    }
    console.log('========== REAL API CALL END ==========');
  }
  
  // Call original fetch and log response for real API calls only
  const response = originalFetch.apply(this, args);
  
  if (isNotebookLMAPI && !isAnalytics) {
    response.then(res => {
      console.log('📥 REAL API Response for:', url);
      console.log('📊 Status:', res.status);
      console.log('✅ OK:', res.ok);
      
      // Clone response to read body
      const responseClone = res.clone();
      responseClone.text().then(text => {
        console.log('📄 Response Body (first 2000 chars):', text.substring(0, 2000));
        
        try {
          const jsonData = JSON.parse(text);
          console.log('📋 Parsed Response JSON:', JSON.stringify(jsonData, null, 2));
        } catch (e) {
          console.log('📝 Non-JSON Response');
        }
        console.log('========== REAL API RESPONSE END ==========');
      }).catch(err => {
        console.log('❌ Could not read response body:', err);
      });
    }).catch(err => {
      console.log('❌ Request failed:', err);
    });
  }
  
  return response;
};

// Monitor XMLHttpRequest for real API calls only
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...args) {
  this._method = method;
  this._url = url;
  return originalXHROpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = function(body) {
  const isNotebookLMAPI = this._url && (
    this._url.includes('NotebookLm') || 
    (this._url.includes('_/') && !this._url.includes('analytics')) ||
    this._url.includes('batchexecute') ||
    (this._url.includes('rpc') && !this._url.includes('analytics'))
  );
  
  const isAnalytics = this._url && (
    this._url.includes('analytics.google.com') || 
    this._url.includes('g/collect') ||
    this._url.includes('firebase')
  );
  
  if (isNotebookLMAPI && !isAnalytics) {
    console.log('🎯 REAL XMLHttpRequest API Call!');
    console.log('📍 URL:', this._url);
    console.log('⚙️ Method:', this._method);
    if (body) {
      console.log('📦 XHR Body:', body);
    }
    console.log('========== REAL XHR CALL END ==========');
  }
  
  return originalXHRSend.apply(this, [body]);
};

console.log('✅ Focused NotebookLM API monitoring active!');
console.log('🚫 Analytics calls are now filtered out');
console.log('🎯 Only REAL NotebookLM API calls will be shown');
console.log('');
console.log('Now try these key actions:');
console.log('  📝 1. Create a new notebook');
console.log('  📄 2. Add a source to a notebook');
console.log('  💬 3. Ask a question to the notebook');
console.log('  🎧 4. Generate an audio overview');
console.log('  📋 5. Go to notebooks list');
console.log('');
console.log('Look for messages starting with "🎯 REAL NotebookLM API Call Found!"'); 