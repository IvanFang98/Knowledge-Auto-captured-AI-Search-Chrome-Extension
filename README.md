# 🧠 SmartGrab AI Search Extension

A Chrome extension that captures visible text from any webpage and saves it locally for easy searching and reference.

## ✨ Features

### 🎯 **Smart Text Extraction**
- One-click text grabbing with **Cmd+Shift+G** (Mac) or **Ctrl+Shift+G** (Windows)
- Extracts only visible text (no hidden elements or ads)
- Automatic title and URL capture

### 🔍 **Fast Search**
- **Keyword search**: Instant search across all saved content
- **Semantic search**: AI-powered search that understands meaning (with OpenAI API key)
- Search through titles, URLs, and text content
- Real-time results with highlighting

### 💾 **Reliable Storage**
- Uses Chrome's built-in storage (always persistent)
- Data survives browser restarts and extension updates
- Stores up to 100 recent entries automatically
- Maintains AI embeddings for semantic search:
  - OpenAI embeddings (1536-dimensional vectors)
  - Fallback embeddings when no API key
  - Auto-generates for new entries
  - Regenerates when API key added

## 🚀 Quick Start

### Installation
1. **Download** the extension files to a folder
2. **Open Chrome** and go to `chrome://extensions/`
3. **Enable Developer mode** (toggle in top-right)
4. **Click "Load unpacked"** and select the extension folder
5. **Set up keyboard shortcut**:
   - Go to `chrome://extensions/shortcuts`
   - Find "SmartGrab AI Search Extension"  
   - Set "Grab visible text from page" to **Cmd+Shift+G** (Mac) or **Ctrl+Shift+G** (Windows)

### Basic Usage
1. **Visit any webpage**
2. **Press your keyboard shortcut** (Cmd+Shift+G)
3. **Text is automatically saved** - you'll see a success notification
4. **Click the extension icon** to search your saved content

## 🔍 How to Search

### Search Modes
1. **Keywords**: Fast text matching - results appear as you type
2. **Semantic**: AI-powered search - type questions and press Enter for intelligent answers

### Simple Search
1. Click the extension icon to open the popup
2. Choose your search mode (Keywords or Semantic)
3. Type your search query
4. **Keywords**: Results appear instantly / **Semantic**: Press Enter to generate AI answers
5. Click any result to revisit that webpage

### Search Tips
- **Keyword mode**: "productivity tips" finds entries with both words
- **Semantic mode**: "How to be more productive?" generates intelligent answers
- **Exact phrases**: Use quotes like "long-term success" for exact matches
- **Clear search**: Use the ✕ button to clear your search

### Advanced Filters
- **Time filters**: Search content from past hour, day, week, month, or year
- **Verbatim matching**: Find exact phrases only
- **Custom date ranges**: Pick specific time periods

## ⚙️ Settings

### Data Management
- **Export Data**: Download all your saved entries as a JSON file
- **Clear All Data**: Remove all saved entries (cannot be undone)

### OpenAI Integration (Optional)
- Add your OpenAI API key to enable semantic search and AI answer generation
- **Without API key**: Keyword search only (still fully functional)
- **With API key**: Semantic search that understands meaning and generates intelligent answers
- **Example**: Ask "How to be productive?" and get synthesized answers from your saved articles

## 🛠 Technical Details

### Storage Format
Your data is stored in Chrome's local storage as:
```javascript
{
  "textEntries": [
    {
      "id": 1643723400000,
      "url": "https://example.com",
      "title": "Page Title", 
      "text": "Extracted content...",
      "wordCount": 150,
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ],
  "embeddings": {
    "1643723400000": {
      "embedding": [...], // 1536-dimensional vector
      "method": "openai" | "fallback",
      "model": "text-embedding-3-small" | "tf-idf",
      "created": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

### Semantic Search Processing
- **Text Processing**:
  - Articles are truncated to 8000 characters (OpenAI token limit)
  - Full article text is used, not just keywords or tags
  - Smart content extraction removes UI elements, ads, and navigation

- **Embedding Generation**:
  - OpenAI's text-embedding-3-small model (1536 dimensions)
  - Fallback to TF-IDF based embeddings if no API key
  - Generated automatically for new articles
  
- **Similarity Matching**:
  1. Query converted to embedding vector
  2. Calculates cosine similarity with all article embeddings
  3. Filters out articles with similarity < 0.1
  4. Sorts by similarity score
  5. Takes top 5 most relevant articles
  6. Extracts relevant sentences for AI answer generation

## 🔒 Privacy & Security

- **All data stays local** - nothing leaves your browser
- **No tracking** - extension doesn't collect usage data
- **Optional API** - OpenAI integration only if you provide a key
- **Secure storage** - uses Chrome's built-in extension storage

## 🐛 Troubleshooting

### Keyboard Shortcut Not Working
1. Go to `chrome://extensions/shortcuts`
2. Make sure the shortcut is set for "Grab visible text from page"
3. Try a different key combination if there are conflicts

### No Search Results
1. Make sure you've saved some text first (use the keyboard shortcut on a webpage)
2. Check that entries appear in the popup (you should see saved content)
3. Try simpler search terms

### Extension Not Working
1. Refresh the webpage you're trying to extract text from
2. Check that the extension is enabled in `chrome://extensions/`
3. Try reloading the extension

## ⚠️ Limitations

### Pages That Cannot Be Captured
- **System pages**: `chrome://extensions`, `chrome://settings`, `about:` pages
- **Local files**: `file://` URLs (unless file access is enabled)
- **Heavily protected sites**: Some Google services, banking sites with strict security
- **PDF files**: Browser handles these differently than web pages

### Limited Capture Scenarios
- **Dynamic content**: Text that loads after scrolling or clicking "Read More"
- **Paywall content**: Only captures visible teaser text
- **Heavy JavaScript sites**: Content that loads long after page appears
- **Social media feeds**: Mostly UI elements rather than article content

### Semantic Search Limitations
- **Text Length**: Articles are truncated to 8000 characters for embedding generation
- **Content Priority**: First 8000 characters are used, which may miss content later in very long articles
- **Processing Time**: Generating embeddings takes a moment, especially for new articles
- **API Usage**: Each semantic search and embedding generation counts toward OpenAI API usage

### Best Results With
- **blog posts** 
- **Static web content** with visible text
- **Documentation** and **academic papers**

## 🚀 Tips for Best Results

### What Gets Saved
- **Main content**: Article text, blog posts, documentation
- **Page metadata**: Title, URL, timestamp, word count
- **Visible text only**: No hidden content, ads, or navigation

### Search Best Practices
- Use specific keywords from the content you remember
- Try searching by website name or page title
- Use time filters if you remember when you saved something
- Export your data regularly as backup

## 📄 License

This project is open source. Feel free to modify and distribute.

---

**Happy text grabbing! 🎯** 

# SmartGrab AI Search Backend

This is the backend proxy service for SmartGrab AI Search Chrome extension, implementing OpenAI's Retrieval API with file store for enhanced semantic search quality.

## Features

- **OpenAI Retrieval API Integration**: Uses OpenAI's file store and assistants API for superior semantic search
- **Document Upload & Management**: Automatically uploads context documents to OpenAI's file store
- **Intelligent Answer Generation**: Leverages GPT-4 with retrieval capabilities for accurate responses
- **Rate Limiting and Security**: Built-in protection against abuse
- **CORS Support**: Cross-origin request handling
- **Error Handling and Logging**: Comprehensive error management
- **Health Check Endpoint**: Service monitoring

## How It Works

1. **Document Upload**: Context documents are uploaded to OpenAI's file store
2. **Assistant Creation**: A specialized assistant is created with retrieval capabilities
3. **Query Processing**: User queries are processed through the assistant with access to uploaded documents
4. **Answer Generation**: GPT-4 generates intelligent answers based on the retrieved context
5. **Cleanup**: Files are automatically cleaned up after processing

## Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```bash
OPENAI_API_KEY=your_api_key_here
PORT=3000
NODE_ENV=development
MAX_REQUESTS_PER_HOUR=100
```

4. Start the server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### POST /api/search
Performs semantic search using OpenAI's Retrieval API with file store.

**Request body:**
```json
{
  "query": "Your search query",
  "context": ["Array of text chunks to search through"]
}
```

**Response:**
```json
{
  "answer": "Generated answer based on context",
  "model": "gpt-4-turbo-preview",
  "usage": {
    "files_processed": 5,
    "thread_id": "thread_abc123",
    "run_id": "run_xyz789"
  }
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

## Testing

Run the automated tests:
```bash
npm test
```

Or use the curl script:
```bash
./test/test-curl.sh
```

## Rate Limiting

The API is rate-limited to protect against abuse. By default, it allows 100 requests per hour per IP address. This can be configured using the `MAX_REQUESTS_PER_HOUR` environment variable.

## Error Handling

The API returns appropriate HTTP status codes and error messages:
- **400**: Invalid request (missing query or context)
- **429**: Too many requests
- **500**: Server error

## Cost Considerations

This implementation uses OpenAI's Assistants API which has different pricing:
- **File uploads**: $0.10 per 1M tokens
- **Assistant runs**: $0.03 per 1K input tokens, $0.06 per 1K output tokens
- **File storage**: $0.20 per GB per day

**Estimated cost per search**: $0.05-0.15 depending on document size and query complexity.

## Deployment

The service can be deployed to various platforms:
- **Vercel**: Serverless deployment with function timeout considerations
- **AWS**: EC2 or Lambda with proper scaling
- **Google Cloud Platform**: Cloud Run or Compute Engine
- **Heroku**: Standard deployment

Remember to set the environment variables on your deployment platform.

## Advantages of This Approach

1. **Superior Search Quality**: OpenAI's Retrieval API is specifically optimized for document search
2. **Better Context Understanding**: Advanced retrieval algorithms understand document structure
3. **Automatic Relevance Scoring**: Built-in relevance ranking of document sections
4. **Citation Support**: Can provide source citations when available
5. **Scalable**: Handles large document collections efficiently

## Limitations

1. **API Costs**: Higher cost compared to simple embedding-based search
2. **Latency**: File upload and assistant creation adds processing time
3. **File Size Limits**: OpenAI has file size and token limits
4. **Rate Limits**: Subject to OpenAI's API rate limits

## Troubleshooting

### Common Issues

1. **"Missing required parameter"**: Ensure your OpenAI API key has access to the Assistants API
2. **File upload failures**: Check file size and content format
3. **Assistant creation errors**: Verify API key permissions and quota
4. **Timeout errors**: Consider increasing timeout limits for large documents

### Performance Optimization

1. **Batch processing**: Process multiple documents together when possible
2. **File reuse**: Consider keeping frequently used files in OpenAI's store
3. **Caching**: Implement response caching for repeated queries
4. **Document chunking**: Split large documents into smaller chunks 