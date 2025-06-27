const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing SmartGrab AI Search Backend API (OpenAI Retrieval API)...\n');

  // Test 1: Health Check
  console.log('1. Testing Health Check...');
  try {
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return;
  }

  // Test 2: Search API with OpenAI Retrieval
  console.log('\n2. Testing Search API with OpenAI Retrieval...');
  const testData = {
    query: "What are the main features and benefits of this product?",
    context: [
      "SmartGrab AI Search is a Chrome extension that helps users capture and search through web content using advanced AI technology. The extension allows users to grab text from any webpage with a simple keyboard shortcut.",
      "Key features include semantic search capabilities that understand the meaning of queries, not just keywords. Users can search through their saved content using natural language questions and get intelligent, synthesized answers.",
      "The extension uses OpenAI's text-embedding-3-small model for generating embeddings and GPT-4 for answer generation. It supports both keyword-based search and semantic search modes, providing flexibility for different use cases.",
      "Privacy and security are top priorities. All data is stored locally in the user's browser, and the extension only connects to OpenAI's API when the user provides their own API key. No user data is ever sent to third-party servers.",
      "The interface is clean and intuitive, with advanced filtering options including time-based filters, verbatim matching, and custom date ranges. Users can export their data as JSON files and manage their saved entries easily."
    ]
  };

  try {
    console.log('📤 Uploading documents to OpenAI and processing query...');
    const searchResponse = await axios.post(`${API_BASE_URL}/api/search`, testData);
    console.log('✅ Search API test passed!');
    console.log('Response:', {
      answer: searchResponse.data.answer,
      model: searchResponse.data.model,
      usage: searchResponse.data.usage
    });
  } catch (error) {
    console.log('❌ Search API test failed:', error.response?.data || error.message);
  }

  // Test 3: Error Handling
  console.log('\n3. Testing Error Handling...');
  try {
    await axios.post(`${API_BASE_URL}/api/search`, { query: "test" }); // Missing context
    console.log('❌ Should have failed with missing context');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Error handling working correctly for invalid requests');
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }

  // Test 4: Empty context handling
  console.log('\n4. Testing Empty Context Handling...');
  try {
    await axios.post(`${API_BASE_URL}/api/search`, { 
      query: "test query", 
      context: [] 
    });
    console.log('❌ Should have failed with empty context');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Error handling working correctly for empty context');
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
}

// Run the tests
testAPI().catch(console.error); 