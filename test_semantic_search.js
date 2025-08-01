// Test script for semantic search
// Run this in the browser console to test the implementation

async function testSemanticSearch() {
  console.log('🧪 Testing Semantic Search Implementation...');
  
  try {
    // Test 1: Load the module
    console.log('📋 Test 1: Loading SemanticSearchV2 module...');
    await import('./semantic_search_v2.js');
    
    if (typeof window.SemanticSearchV2 === 'undefined') {
      console.error('❌ SemanticSearchV2 not found!');
      return;
    }
    console.log('✅ SemanticSearchV2 is available');
    
    // Test 2: Initialize SemanticSearchV2
    console.log('📋 Test 2: Initializing SemanticSearchV2...');
    const semanticSearch = new window.SemanticSearchV2();
    await semanticSearch.init();
    console.log('✅ SemanticSearchV2 initialized successfully');
    
    // Test 3: Check status
    console.log('📋 Test 3: Checking status...');
    const status = await semanticSearch.getStatus();
    console.log('Status:', status);
    console.log('✅ Status check completed');
    
    // Test 4: Test embedding
    console.log('📋 Test 4: Testing embedding...');
    const testText = 'This is a test article about artificial intelligence and machine learning.';
    const embedding = await semanticSearch.embed(testText);
    console.log('Embedding shape:', embedding.length);
    console.log('✅ Embedding test completed');
    
    // Test 5: Test search (if we have articles)
    console.log('📋 Test 5: Testing search...');
    const searchResult = await semanticSearch.semanticSearch('how to do great work', 5);
    console.log('Search result:', searchResult);
    console.log('✅ Search test completed');
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Test the background script message handler
async function testBackgroundSearch() {
  console.log('🧪 Testing Background Search...');
  
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'search',
      q: 'how to do great work',
      k: 5
    });
    
    console.log('Background search result:', result);
    console.log('✅ Background search test completed');
    
  } catch (error) {
    console.error('❌ Background search test failed:', error);
  }
}

// Run tests
console.log('🚀 Starting semantic search tests...');
testSemanticSearch().then(() => {
  console.log('⏳ Waiting 2 seconds before testing background search...');
  setTimeout(testBackgroundSearch, 2000);
}); 