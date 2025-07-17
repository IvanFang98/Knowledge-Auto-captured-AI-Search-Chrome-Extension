// Token Finder Script for NotebookLM
// Run this in the browser console on https://notebooklm.google.com

console.log('🔍 Token Finder - Looking for all possible auth tokens...');

// Get page content
const pageContent = document.documentElement.innerHTML;

// Look for different token patterns
console.log('\n=== SEARCHING FOR TOKENS ===');

// 1. Look for session tokens like we saw in debug
const sessionTokenPatterns = [
  /at=([A-Za-z0-9_-]+%3A[0-9]+)/g,
  /at=([A-Za-z0-9_-]+:[0-9]+)/g,
  /"at":"([^"]+)"/g,
  /at\s*=\s*['"]([^'"]+)['"]/g,
  /at=([A-Za-z0-9_:-]+)/g
];

console.log('🔍 Session Token Patterns:');
sessionTokenPatterns.forEach((pattern, i) => {
  const matches = [...pageContent.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}:`, matches.map(m => m[1].substring(0, 30) + '...'));
  }
});

// 2. Look for traditional Google API tokens
const apiTokenPatterns = [
  /"B8SWKb":"([^"]+)"/g,
  /"S06Grb":"([^"]+)"/g,
  /"VqImj":"([^"]+)"/g,
  /"at":"([^"]+)"/g,
  /"bl":"([^"]+)"/g
];

console.log('\n🔍 API Token Patterns:');
apiTokenPatterns.forEach((pattern, i) => {
  const matches = [...pageContent.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}:`, matches.map(m => m[1].substring(0, 30) + '...'));
  }
});

// 3. Look for bl parameter variations
const blPatterns = [
  /bl=([^&"'\s]+)/g,
  /"bl":"([^"]+)"/g,
  /bl\s*=\s*['"]([^'"]+)['"]/g
];

console.log('\n🔍 BL Parameter Patterns:');
blPatterns.forEach((pattern, i) => {
  const matches = [...pageContent.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}:`, matches.map(m => m[1].substring(0, 40) + '...'));
  }
});

// 4. Look for cookies
console.log('\n🔍 Cookies:');
const cookies = document.cookie.split(';').map(c => c.trim().split('='));
cookies.forEach(([name, value]) => {
  if (name.toLowerCase().includes('at') || name.toLowerCase().includes('bl') || name.toLowerCase().includes('session')) {
    console.log(`${name}: ${value ? value.substring(0, 30) + '...' : 'null'}`);
  }
});

// 5. Look for WIZ_global_data
console.log('\n🔍 WIZ_global_data:');
if (window.WIZ_global_data) {
  console.log('Found WIZ_global_data:', Object.keys(window.WIZ_global_data));
  
  // Look for specific tokens
  ['B8SWKb', 'S06Grb', 'VqImj', 'at', 'bl'].forEach(key => {
    if (window.WIZ_global_data[key]) {
      console.log(`${key}: ${window.WIZ_global_data[key].toString().substring(0, 30) + '...'}`);
    }
  });
}

// 6. Check if there are any network requests happening
console.log('\n🔍 Monitoring network requests for tokens...');
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const [url, options] = args;
  if (url.includes('batchexecute')) {
    console.log('📡 Found batchexecute request:');
    console.log('URL:', url);
    if (options?.body) {
      console.log('Body:', options.body);
      
      // Extract at parameter from body
      const atMatch = options.body.match(/at=([^&]+)/);
      if (atMatch) {
        console.log('🎯 FOUND AT TOKEN IN REQUEST:', atMatch[1]);
      }
    }
  }
  return originalFetch.apply(this, args);
};

console.log('\n✅ Token finder complete! Try interacting with the page to capture more tokens.');
console.log('💡 Look for the "🎯 FOUND AT TOKEN IN REQUEST" message when you perform actions.'); 