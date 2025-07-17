// NotebookLM Debug Script - Capture Real API Requests
// Run this in the browser console on https://notebooklm.google.com

console.log('🔍 NotebookLM API Request Interceptor Started');

// Store original fetch function
const originalFetch = window.fetch;

// Override fetch to intercept requests
window.fetch = function(...args) {
  const [url, options] = args;
  
  // Check if this is a NotebookLM API request
  if (url.includes('batchexecute') || url.includes('LabsTailwindUi')) {
    console.log('📡 INTERCEPTED NOTEBOOKLM API REQUEST:');
    console.log('URL:', url);
    console.log('Method:', options?.method || 'GET');
    console.log('Headers:', options?.headers || {});
    
    if (options?.body) {
      console.log('Body (raw):', options.body);
      
      // Try to parse URLSearchParams
      if (typeof options.body === 'string' || options.body instanceof URLSearchParams) {
        const params = new URLSearchParams(options.body);
        console.log('🔍 PARSED PARAMETERS:');
        for (const [key, value] of params.entries()) {
          console.log(`${key}:`, value);
          
          // Special handling for f.req
          if (key === 'f.req') {
            try {
              const parsed = JSON.parse(value);
              console.log('📋 PARSED f.req:', JSON.stringify(parsed, null, 2));
            } catch (e) {
              console.log('❌ Could not parse f.req as JSON');
            }
          }
        }
      }
    }
    
    // Call original fetch and log response
    return originalFetch(...args).then(response => {
      console.log('📥 RESPONSE STATUS:', response.status);
      
      // Clone response to read it without consuming the stream
      const clonedResponse = response.clone();
      clonedResponse.text().then(text => {
        console.log('📥 RESPONSE BODY:', text.substring(0, 500) + '...');
        
        // Try to parse NotebookLM response
        try {
          const cleanText = text.substring(4); // Remove )]}' prefix
          const lines = cleanText.split('\n').filter(line => line.trim());
          lines.forEach((line, index) => {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                console.log(`📋 PARSED RESPONSE LINE ${index}:`, parsed);
              } catch (e) {
                console.log(`❌ Could not parse response line ${index}:`, line);
              }
            }
          });
        } catch (e) {
          console.log('❌ Could not parse response');
        }
      });
      
      return response;
    });
  }
  
  // For non-NotebookLM requests, call original fetch
  return originalFetch(...args);
};

// Also intercept XMLHttpRequest
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...args) {
  this._url = url;
  this._method = method;
  return originalXHROpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = function(data) {
  if (this._url && (this._url.includes('batchexecute') || this._url.includes('LabsTailwindUi'))) {
    console.log('📡 INTERCEPTED XHR NOTEBOOKLM REQUEST:');
    console.log('URL:', this._url);
    console.log('Method:', this._method);
    console.log('Data:', data);
    
    // Set up response handler
    const originalOnReadyStateChange = this.onreadystatechange;
    this.onreadystatechange = function() {
      if (this.readyState === 4) {
        console.log('📥 XHR RESPONSE STATUS:', this.status);
        console.log('📥 XHR RESPONSE:', this.responseText.substring(0, 500) + '...');
      }
      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.apply(this, arguments);
      }
    };
  }
  
  return originalXHRSend.apply(this, [data]);
};

console.log('✅ Request interceptor installed. Now perform some actions in NotebookLM:');
console.log('1. Refresh the page or navigate to a notebook');
console.log('2. Create a new notebook');
console.log('3. Add a source');
console.log('4. Check the console for intercepted requests');

// Helper function to manually test what tokens are available
function checkAvailableTokens() {
  console.log('🔍 Checking available authentication tokens:');
  
  // Check common token patterns
  const patterns = [
    /window\.WIZ_global_data\s*=\s*({[^}]+})/,
    /\["b8swkb","([^"]+)"\]/g,
    /\["s06grb","([^"]+)"\]/g,
    /\["vqimj","([^"]+)"\]/g,
    /\["at","([^"]+)"\]/g,
    /\["bl","([^"]+)"\]/g,
    /window\.WIZ_global_data\.([^=]+)=\s*"([^"]+)"/g
  ];
  
  const pageContent = document.documentElement.innerHTML;
  
  patterns.forEach((pattern, index) => {
    const matches = pageContent.match(pattern);
    if (matches) {
      console.log(`Pattern ${index + 1} matches:`, matches);
    }
  });
  
  // Check cookies
  console.log('🍪 Relevant cookies:');
  document.cookie.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name.includes('at') || name.includes('bl') || name.includes('session')) {
      console.log(`${name}: ${value ? value.substring(0, 20) + '...' : 'null'}`);
    }
  });
}

// Run token check
checkAvailableTokens(); 