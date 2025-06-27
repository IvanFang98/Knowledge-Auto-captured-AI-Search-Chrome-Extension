const axios = require('axios');

// Configure axios with a longer timeout
const api = axios.create({
    baseURL: 'http://localhost:3000',
    timeout: 300000, // 5 minutes timeout
    maxContentLength: Infinity,
    maxBodyLength: Infinity
});

// Test the health endpoint
async function testHealth() {
    try {
        const response = await api.get('/health');
        console.log('Health check response:', response.data);
    } catch (error) {
        console.error('Health check failed:', error.message);
    }
}

// Test the search endpoint
async function testSearch(retries = 3) {
    const testData = {
        query: "What are the key features mentioned in this text?",
        context: [
            "SmartGrab AI Search is a powerful Chrome extension that helps users quickly find and analyze information from web pages. It features advanced AI-powered search capabilities, context-aware responses, and seamless integration with OpenAI's latest models. The extension supports multiple languages and can process various types of content including text, tables, and structured data.",
            "The extension uses state-of-the-art natural language processing to understand user queries and provide relevant answers. It maintains user privacy by processing data locally when possible and uses secure API connections for remote processing."
        ]
    };

    console.log('Sending search request with test data:', JSON.stringify(testData, null, 2));
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await api.post('/api/search', testData);
            console.log('Search response:', JSON.stringify(response.data, null, 2));
            return; // Success, exit the function
        } catch (error) {
            console.error(`Search test failed (attempt ${attempt}/${retries}):`, error.message);
            if (error.response) {
                console.error('Error details:', error.response.data);
            } else if (error.request) {
                console.error('No response received:', error.code);
            } else {
                console.error('Error setting up request:', error.message);
            }
            
            if (attempt < retries) {
                console.log(`Waiting 5 seconds before retry ${attempt + 1}...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
}

// Run tests
async function runTests() {
    console.log('Testing server endpoints...');
    await testHealth();
    console.log('\nTesting search endpoint...');
    await testSearch();
}

runTests(); 