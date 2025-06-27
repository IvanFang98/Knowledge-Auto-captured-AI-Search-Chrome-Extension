#!/bin/bash

echo "🧪 Testing SmartGrab AI Search Backend with curl...\n"

# Test 1: Health Check
echo "1. Testing Health Check..."
curl -X GET http://localhost:3000/health
echo -e "\n"

# Test 2: Search API
echo "2. Testing Search API..."
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the main features?",
    "context": [
      "This is a Chrome extension for AI-powered search.",
      "It uses semantic search to find relevant content.",
      "The extension can process multiple web pages.",
      "Users get intelligent answers based on context."
    ]
  }'
echo -e "\n"

# Test 3: Error Handling
echo "3. Testing Error Handling (missing context)..."
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test query"}'
echo -e "\n"

echo "✅ Testing complete!" 