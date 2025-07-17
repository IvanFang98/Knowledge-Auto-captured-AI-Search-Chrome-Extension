// Build Identifier Finder Script for NotebookLM
// Run this in the browser console on https://notebooklm.google.com

console.log('🔍 Build Identifier Finder - Looking for bl parameter...');

// Get page content
const pageContent = document.documentElement.innerHTML;

// Look for build identifier patterns
const buildPatterns = [
  /(boq_labs-tailwind-frontend_[0-9]+\.[0-9]+_p[0-9]+)/gi,
  /bl=([a-z0-9_.-]+)/gi,
  /"bl":"([^"]+)"/gi,
  /boq_labs[^"'\s]*/gi,
  /tailwind-frontend[^"'\s]*/gi
];

console.log('🔍 Searching for build identifiers...');

buildPatterns.forEach((pattern, i) => {
  const matches = [...pageContent.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}:`, matches.map(m => m[1] || m[0]).slice(0, 5));
  }
});

// Check scripts and meta tags
console.log('\n🔍 Checking scripts and meta tags...');

const scripts = document.querySelectorAll('script');
scripts.forEach((script, i) => {
  if (script.textContent.includes('boq_labs') || script.textContent.includes('tailwind-frontend')) {
    console.log(`Script ${i + 1} contains build info`);
    
    const buildMatch = script.textContent.match(/(boq_labs-tailwind-frontend_[0-9]+\.[0-9]+_p[0-9]+)/);
    if (buildMatch) {
      console.log(`🎯 FOUND BUILD IDENTIFIER: ${buildMatch[1]}`);
    }
  }
});

// Check for any URLs containing build info
console.log('\n🔍 Checking for build info in URLs...');

const urlMatches = pageContent.match(/https?:\/\/[^"'\s]*boq_labs[^"'\s]*/gi);
if (urlMatches) {
  console.log('URLs with build info:', urlMatches.slice(0, 3));
}

// Check current page URL
console.log('\n🔍 Current page URL:', window.location.href);

// Look for any data attributes or hidden inputs
console.log('\n🔍 Checking data attributes...');

const dataElements = document.querySelectorAll('[data-*]');
dataElements.forEach(el => {
  const attrs = el.attributes;
  for (let attr of attrs) {
    if (attr.value.includes('boq_labs') || attr.value.includes('tailwind-frontend')) {
      console.log(`Found in ${attr.name}: ${attr.value}`);
    }
  }
});

console.log('\n✅ Build identifier search complete!');
console.log('💡 Look for messages starting with "🎯 FOUND BUILD IDENTIFIER"'); 